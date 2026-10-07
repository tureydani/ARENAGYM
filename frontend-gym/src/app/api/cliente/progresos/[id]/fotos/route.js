import { NextResponse } from 'next/server';
import { FotoProgreso, PoseLandmark } from '@/lib/db/models';
import sequelize from '@/lib/db/sequelize';
import { verificarAuth } from '@/lib/auth/clienteAuth';
import { cargarProgresoDelUsuario } from '@/lib/seguimientoFisico/progresoAcceso';
import { guardarFoto, eliminarFoto } from '@/lib/storage/seguimientoFisicoStorage';

const TIPOS_VALIDOS = ['frente', 'espalda', 'lateral', 'lateral_derecha'];
const MIME_A_EXTENSION = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export async function GET(request, { params }) {
  const auth = verificarAuth(request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const progreso = await cargarProgresoDelUsuario(parseInt(id, 10), auth.id_usuario);
  if (!progreso) return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 });

  const fotos = await FotoProgreso.findAll({
    where: { id_progreso: progreso.id_progreso },
    attributes: { exclude: ['url_foto'] },
    order: [['fecha_subida', 'ASC']],
  });
  return NextResponse.json(fotos);
}

export async function POST(request, { params }) {
  const auth = verificarAuth(request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const progreso = await cargarProgresoDelUsuario(parseInt(id, 10), auth.id_usuario);
  if (!progreso) return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });
  }

  const {
    tipo, imagen_base64, mime_type, ancho_px, alto_px, calidad, confianza, landmarks,
    encuadre, quality_score, calidad_captura,
  } = body;

  if (!TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json({ error: `tipo debe ser uno de: ${TIPOS_VALIDOS.join(', ')}` }, { status: 400 });
  }
  if (!imagen_base64 || typeof imagen_base64 !== 'string') {
    return NextResponse.json({ error: 'imagen_base64 es requerido' }, { status: 400 });
  }
  if (calidad && !['ACEPTABLE', 'INSUFICIENTE'].includes(calidad)) {
    return NextResponse.json({ error: 'calidad debe ser ACEPTABLE o INSUFICIENTE' }, { status: 400 });
  }
  if (confianza !== undefined && confianza !== null && (confianza < 0 || confianza > 1)) {
    return NextResponse.json({ error: 'confianza debe estar entre 0 y 1' }, { status: 400 });
  }
  if (landmarks !== undefined && !Array.isArray(landmarks)) {
    return NextResponse.json({ error: 'landmarks debe ser un arreglo' }, { status: 400 });
  }
  if (encuadre !== undefined && encuadre !== null && !['completo', 'medioCuerpo'].includes(encuadre)) {
    return NextResponse.json({ error: "encuadre debe ser 'completo' o 'medioCuerpo'" }, { status: 400 });
  }
  if (quality_score !== undefined && quality_score !== null && (quality_score < 0 || quality_score > 100)) {
    return NextResponse.json({ error: 'quality_score debe estar entre 0 y 100' }, { status: 400 });
  }
  if (calidad_captura && !['EXCELENTE', 'BUENA', 'ACEPTABLE', 'INSUFICIENTE'].includes(calidad_captura)) {
    return NextResponse.json({ error: 'calidad_captura inválida' }, { status: 400 });
  }

  let buffer;
  try {
    const base64Limpio = imagen_base64.includes(',') ? imagen_base64.split(',').pop() : imagen_base64;
    buffer = Buffer.from(base64Limpio, 'base64');
  } catch {
    return NextResponse.json({ error: 'imagen_base64 no es base64 válido' }, { status: 400 });
  }
  if (buffer.length === 0) {
    return NextResponse.json({ error: 'La fotografía está vacía o corrupta' }, { status: 400 });
  }
  // Límite generoso (15MB) para evitar que una captura sin comprimir del
  // lado de la app agote memoria del servidor; la app debe comprimir antes
  // de enviar (sección 21 del pedido), esto es solo una red de seguridad.
  const LIMITE_BYTES = 15 * 1024 * 1024;
  if (buffer.length > LIMITE_BYTES) {
    return NextResponse.json({ error: 'La fotografía supera el tamaño máximo permitido (15MB)' }, { status: 413 });
  }

  const extension = MIME_A_EXTENSION[mime_type] || 'jpg';

  let rutaRelativa;
  try {
    rutaRelativa = await guardarFoto({
      idUsuario: auth.id_usuario,
      idProgreso: progreso.id_progreso,
      tipo,
      extension,
      buffer,
    });
  } catch (error) {
    console.error('Error al guardar fotografía en storage:', error);
    return NextResponse.json({ error: 'No se pudo guardar la fotografía' }, { status: 500 });
  }

  try {
    const foto = await sequelize.transaction(async (tx) => {
      const nuevaFoto = await FotoProgreso.create({
        id_progreso: progreso.id_progreso,
        url_foto: rutaRelativa,
        tipo,
        calidad: calidad ?? null,
        confianza: confianza ?? null,
        ancho_px: ancho_px ?? null,
        alto_px: alto_px ?? null,
        encuadre: encuadre ?? null,
        quality_score: quality_score ?? null,
        calidad_captura: calidad_captura ?? null,
      }, { transaction: tx });

      if (Array.isArray(landmarks) && landmarks.length > 0) {
        const filas = landmarks
          .filter((lm) => Number.isFinite(lm?.index) && Number.isFinite(lm?.x) && Number.isFinite(lm?.y))
          .map((lm) => ({
            id_foto: nuevaFoto.id_foto,
            landmark_index: lm.index,
            x: lm.x,
            y: lm.y,
            z: Number.isFinite(lm.z) ? lm.z : null,
            visibility: Number.isFinite(lm.visibility) ? lm.visibility : null,
          }));
        if (filas.length > 0) await PoseLandmark.bulkCreate(filas, { transaction: tx });
      }

      return nuevaFoto;
    });

    const { url_foto: _urlFoto, ...fotoSinRuta } = foto.toJSON();
    return NextResponse.json(fotoSinRuta, { status: 201 });
  } catch (error) {
    await eliminarFoto(rutaRelativa);
    console.error('Error al registrar fotografía de progreso:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
