import { NextResponse } from 'next/server';
import { Op } from 'sequelize';
import { Asistencia } from '@/lib/db/models';
import { verificarAuth } from '@/lib/auth/clienteAuth';
import { ahoraBolivia, claveDiaBolivia, medianocheBoliviaUTC } from '@/lib/fecha';

// Para fechas "sintéticas" construidas a partir de ahoraBolivia() (que ya
// tiene el año/mes/día correctos de Bolivia horneados en sus getters
// locales): no son timestamps reales, así que se formatean con sus propios
// getters en vez de claveDiaBolivia(), que espera un instante real (una
// fecha_hora de la BD) y lo convierte a la zona horaria de Bolivia.
function claveLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Devuelve los días únicos (YYYY-MM-DD, en Bolivia) con asistencia dentro
// del mes dado ("YYYY-MM"), consultando directamente ese rango de fechas en
// vez de depender de un límite de filas que podría no alcanzar para meses
// viejos.
async function diasConAsistenciaDelMes(idUsuario, anio, mesIndice) {
  const inicioMes = medianocheBoliviaUTC(anio, mesIndice, 1);
  const inicioMesSiguiente = medianocheBoliviaUTC(anio, mesIndice + 1, 1);

  const registros = await Asistencia.findAll({
    where: {
      id_usuario: idUsuario,
      fecha_hora: { [Op.gte]: inicioMes, [Op.lt]: inicioMesSiguiente }
    },
    order: [['fecha_hora', 'ASC']]
  });

  return [...new Set(registros.map(a => claveDiaBolivia(a.fecha_hora)))];
}

export async function GET(request) {
  const auth = verificarAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const ahora = ahoraBolivia();
    const mesParam = request.nextUrl.searchParams.get('mes'); // "YYYY-MM" opcional

    let anio = ahora.getFullYear();
    let mesIndice = ahora.getMonth();
    if (mesParam && /^\d{4}-\d{2}$/.test(mesParam)) {
      const [y, m] = mesParam.split('-').map(Number);
      anio = y;
      mesIndice = m - 1;
    }

    const diasDelMes = await diasConAsistenciaDelMes(auth.id_usuario, anio, mesIndice);

    // Racha e "última visita": se calculan sobre un historial reciente
    // (suficiente para cualquier racha real), no sobre el mes consultado.
    const recientes = await Asistencia.findAll({
      where: { id_usuario: auth.id_usuario },
      order: [['fecha_hora', 'DESC']],
      limit: 200
    });
    const diasRecientesSet = new Set(recientes.map(a => claveDiaBolivia(a.fecha_hora)));

    let racha = 0;
    const cursor = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    if (!diasRecientesSet.has(claveLocal(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (diasRecientesSet.has(claveLocal(cursor))) {
      racha++;
      cursor.setDate(cursor.getDate() - 1);
    }

    const totalHistorico = await Asistencia.count({ where: { id_usuario: auth.id_usuario } });

    return NextResponse.json({
      mes: `${anio}-${String(mesIndice + 1).padStart(2, '0')}`,
      diasDelMes,
      totalDelMes: diasDelMes.length,
      // Alias por compatibilidad con la app: antes de agregar navegación
      // por mes, este campo siempre reflejaba el mes actual.
      totalMes: diasDelMes.length,
      totalHistorico,
      racha,
      ultimaVisita: recientes[0]?.fecha_hora ?? null
    });
  } catch (error) {
    console.error('Error al obtener asistencias de cliente:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
