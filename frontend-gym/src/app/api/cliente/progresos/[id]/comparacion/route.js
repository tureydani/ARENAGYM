import { NextResponse } from 'next/server';
import { Op } from 'sequelize';
import { Progreso, FotoProgreso, MetricaFisica } from '@/lib/db/models';
import { verificarAuth } from '@/lib/auth/clienteAuth';
import { cargarProgresoDelUsuario } from '@/lib/seguimientoFisico/progresoAcceso';

// Campos antropométricos manuales y de métricas que se comparan.
// Deliberadamente NO se compara aquí "composición corporal" ni se afirma
// cambio de masa muscular/grasa a partir de proporciones (sección 11 del
// pedido): solo cambio relativo porcentual de cada dato disponible.
const CAMPOS_MANUALES = ['peso', 'porcentaje_grasa', 'pecho', 'cintura', 'brazo', 'pierna', 'cadera'];
const CAMPOS_METRICA = [
  'ancho_hombros_relativo', 'ancho_cadera_relativo', 'relacion_hombros_cadera',
  'torso_relativo', 'brazo_relativo', 'pierna_relativa',
  'simetria_hombros', 'simetria_cadera', 'simetria_brazos', 'simetria_piernas',
];

function construirCambios(anterior, actual, campos) {
  const cambios = {};
  for (const campo of campos) {
    const v1 = anterior?.[campo];
    const v2 = actual?.[campo];
    if (v1 === null || v1 === undefined || v2 === null || v2 === undefined) continue;
    const n1 = Number(v1);
    const n2 = Number(v2);
    const cambioAbsoluto = n2 - n1;
    const cambioRelativoPorcentual = n1 !== 0 ? (cambioAbsoluto / Math.abs(n1)) * 100 : null;
    cambios[campo] = {
      anterior: n1,
      actual: n2,
      cambio_absoluto: Math.round(cambioAbsoluto * 1000) / 1000,
      cambio_relativo_porcentual: cambioRelativoPorcentual !== null
        ? Math.round(cambioRelativoPorcentual * 100) / 100
        : null,
    };
  }
  return cambios;
}

async function cargarFotosYMetricas(idProgreso) {
  const [fotos, metricas] = await Promise.all([
    FotoProgreso.findAll({ where: { id_progreso: idProgreso }, attributes: { exclude: ['url_foto'] } }),
    MetricaFisica.findOne({ where: { id_progreso: idProgreso } }),
  ]);
  return { fotos, metricas };
}

export async function GET(request, { params }) {
  const auth = verificarAuth(request);
  if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const actual = await cargarProgresoDelUsuario(parseInt(id, 10), auth.id_usuario);
  if (!actual) return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 });

  const contra = request.nextUrl.searchParams.get('contra') || 'anterior';

  let referencia = null;
  if (contra === 'inicial') {
    referencia = await Progreso.findOne({
      where: { id_usuario: auth.id_usuario },
      order: [['fecha', 'ASC'], ['id_progreso', 'ASC']],
    });
  } else if (contra === 'anterior') {
    referencia = await Progreso.findOne({
      where: {
        id_usuario: auth.id_usuario,
        [Op.or]: [
          { fecha: { [Op.lt]: actual.fecha } },
          { fecha: actual.fecha, id_progreso: { [Op.lt]: actual.id_progreso } },
        ],
      },
      order: [['fecha', 'DESC'], ['id_progreso', 'DESC']],
    });
  } else {
    const idReferencia = parseInt(contra, 10);
    referencia = await cargarProgresoDelUsuario(idReferencia, auth.id_usuario);
  }

  if (!referencia) {
    return NextResponse.json({ error: 'No hay una evaluación de referencia disponible para comparar' }, { status: 404 });
  }
  if (referencia.id_progreso === actual.id_progreso) {
    return NextResponse.json({ error: 'La evaluación de referencia no puede ser la misma que la actual' }, { status: 400 });
  }

  const [datosActual, datosReferencia] = await Promise.all([
    cargarFotosYMetricas(actual.id_progreso),
    cargarFotosYMetricas(referencia.id_progreso),
  ]);

  // Sección 27: no comparar silenciosamente evaluaciones incompatibles. La
  // señal disponible hoy es el encuadre (completo/medioCuerpo) de la foto
  // frontal de cada lado -- si difieren, las métricas de piernas de un lado
  // existen y del otro no, lo cual es correcto (null-safe) pero conviene
  // avisarlo explícitamente en vez de dejar que el cliente lo infiera de
  // valores faltantes.
  const encuadreFrontal = (fotos) => fotos.find((f) => f.tipo === 'frente')?.encuadre ?? null;
  const encuadreReferencia = encuadreFrontal(datosReferencia.fotos);
  const encuadreActual = encuadreFrontal(datosActual.fotos);

  const advertencias = [];
  if (encuadreReferencia && encuadreActual && encuadreReferencia !== encuadreActual) {
    advertencias.push(
      'Las evaluaciones comparadas tienen encuadres distintos (una es de cuerpo completo y la otra de medio cuerpo): ' +
      'las métricas de piernas no son comparables entre ambas.'
    );
  }

  return NextResponse.json({
    tipo_comparacion: contra,
    advertencias,
    referencia: {
      id_progreso: referencia.id_progreso,
      fecha: referencia.fecha,
      indice_evolucion: referencia.indice_evolucion,
      encuadre: encuadreReferencia,
      fotos: datosReferencia.fotos,
    },
    actual: {
      id_progreso: actual.id_progreso,
      fecha: actual.fecha,
      indice_evolucion: actual.indice_evolucion,
      encuadre: encuadreActual,
      fotos: datosActual.fotos,
    },
    cambios_medidas_manuales: construirCambios(referencia, actual, CAMPOS_MANUALES),
    cambios_metricas: construirCambios(datosReferencia.metricas, datosActual.metricas, CAMPOS_METRICA),
    cambio_indice_evolucion: (referencia.indice_evolucion !== null && actual.indice_evolucion !== null)
      ? Math.round((Number(actual.indice_evolucion) - Number(referencia.indice_evolucion)) * 100) / 100
      : null,
  });
}
