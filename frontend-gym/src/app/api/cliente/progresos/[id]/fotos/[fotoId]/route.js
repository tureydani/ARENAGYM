import { NextResponse } from 'next/server';
import { FotoProgreso } from '@/lib/db/models';
import { verificarAuth } from '@/lib/auth/clienteAuth';
import { cargarProgresoDelUsuario } from '@/lib/seguimientoFisico/progresoAcceso';
import { leerFoto } from '@/lib/storage/seguimientoFisicoStorage';

const EXTENSION_A_CONTENT_TYPE = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

// Única vía para obtener los bytes de una fotografía corporal: nunca hay
// una URL pública. Verifica que la evaluación (progreso) a la que
// pertenece la foto sea del usuario autenticado antes de leer el archivo
// -- un cliente no puede ver la foto de otro cambiando :fotoId o :id.
export async function GET(request, { params }) {
  const auth = verificarAuth(request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id, fotoId } = await params;
  const progreso = await cargarProgresoDelUsuario(parseInt(id, 10), auth.id_usuario);
  if (!progreso) return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 });

  const foto = await FotoProgreso.findOne({
    where: { id_foto: parseInt(fotoId, 10), id_progreso: progreso.id_progreso },
  });
  if (!foto) return NextResponse.json({ error: 'Fotografía no encontrada' }, { status: 404 });

  try {
    const bytes = await leerFoto(foto.url_foto);
    const extension = foto.url_foto.split('.').pop()?.toLowerCase();
    const contentType = EXTENSION_A_CONTENT_TYPE[extension] || 'application/octet-stream';
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Error al leer fotografía de progreso:', error);
    return NextResponse.json({ error: 'No se pudo leer la fotografía' }, { status: 500 });
  }
}
