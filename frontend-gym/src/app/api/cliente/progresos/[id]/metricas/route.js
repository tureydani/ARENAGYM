import { NextResponse } from 'next/server';
import { MetricaFisica, Progreso } from '@/lib/db/models';
import sequelize from '@/lib/db/sequelize';
import { verificarAuth } from '@/lib/auth/clienteAuth';
import { cargarProgresoDelUsuario } from '@/lib/seguimientoFisico/progresoAcceso';
import { calcularIndiceEvolucion } from '@/lib/seguimientoFisico/indiceEvolucion';

const CAMPOS_METRICA = [
  'ancho_hombros_relativo', 'ancho_cadera_relativo', 'relacion_hombros_cadera',
  'torso_relativo', 'brazo_relativo', 'pierna_relativa',
  'simetria_hombros', 'simetria_cadera', 'simetria_brazos', 'simetria_piernas',
  'inclinacion_hombros', 'inclinacion_cadera', 'alineacion_postural',
  'angulo_rodillas', 'angulo_codos',
  'confianza_media', 'landmarks_validos', 'porcentaje_cuerpo_detectado', 'calidad_analisis',
  'algoritmo_version',
];

export async function GET(request, { params }) {
  const auth = verificarAuth(request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const progreso = await cargarProgresoDelUsuario(parseInt(id, 10), auth.id_usuario);
  if (!progreso) return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 });

  const metricas = await MetricaFisica.findOne({ where: { id_progreso: progreso.id_progreso } });
  return NextResponse.json(metricas ?? {});
}

// Las métricas llegan YA CALCULADAS desde la app (normalización y cálculo
// de características se hacen localmente, en el dispositivo, a partir de
// los landmarks de ML Kit -- ver pose_analysis_service.dart). Este
// endpoint solo valida rangos, persiste y recalcula el índice de
// evolución de la evaluación completa.
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

  const datos = {};
  for (const campo of CAMPOS_METRICA) {
    if (body[campo] !== undefined) datos[campo] = body[campo];
  }

  if (datos.confianza_media !== undefined && datos.confianza_media !== null) {
    if (datos.confianza_media < 0 || datos.confianza_media > 1) {
      return NextResponse.json({ error: 'confianza_media debe estar entre 0 y 1' }, { status: 400 });
    }
  }
  if (datos.porcentaje_cuerpo_detectado !== undefined && datos.porcentaje_cuerpo_detectado !== null) {
    if (datos.porcentaje_cuerpo_detectado < 0 || datos.porcentaje_cuerpo_detectado > 100) {
      return NextResponse.json({ error: 'porcentaje_cuerpo_detectado debe estar entre 0 y 100' }, { status: 400 });
    }
  }
  if (datos.calidad_analisis && !['ALTA', 'MEDIA', 'BAJA'].includes(datos.calidad_analisis)) {
    return NextResponse.json({ error: 'calidad_analisis debe ser ALTA, MEDIA o BAJA' }, { status: 400 });
  }

  try {
    const resultado = await sequelize.transaction(async (tx) => {
      const existente = await MetricaFisica.findOne({
        where: { id_progreso: progreso.id_progreso },
        transaction: tx,
      });

      const metricas = existente
        ? await existente.update({ ...datos, updated_at: new Date() }, { transaction: tx })
        : await MetricaFisica.create({ id_progreso: progreso.id_progreso, ...datos }, { transaction: tx });

      const indice = calcularIndiceEvolucion(progreso, metricas);
      await Progreso.update(
        { indice_evolucion: indice },
        { where: { id_progreso: progreso.id_progreso }, transaction: tx }
      );

      return { metricas, indice };
    });

    return NextResponse.json({ metricas: resultado.metricas, indice_evolucion: resultado.indice });
  } catch (error) {
    console.error('Error al guardar métricas físicas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
