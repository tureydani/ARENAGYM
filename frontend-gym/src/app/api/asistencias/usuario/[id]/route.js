import { NextResponse } from 'next/server';
import { Op } from 'sequelize';
import { Asistencia, Usuario } from '@/lib/db/models';

function aClaveDelDia(fecha) {
  const d = new Date(fecha);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Usado desde el panel administrativo: calendario y total histórico de
// asistencias de un cliente puntual (para revisar su constancia, ej. al
// hacer clic en un cliente desde la pestaña de Asistencias).
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const usuario = await Usuario.scope('withInactive').findByPk(id, {
      attributes: ['id_usuario', 'nombre', 'apellido']
    });
    if (!usuario) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const ahora = new Date();
    const mesParam = request.nextUrl.searchParams.get('mes'); // "YYYY-MM" opcional

    let anio = ahora.getFullYear();
    let mesIndice = ahora.getMonth();
    if (mesParam && /^\d{4}-\d{2}$/.test(mesParam)) {
      const [y, m] = mesParam.split('-').map(Number);
      anio = y;
      mesIndice = m - 1;
    }

    const inicioMes = new Date(anio, mesIndice, 1);
    const inicioMesSiguiente = new Date(anio, mesIndice + 1, 1);

    const registrosDelMes = await Asistencia.findAll({
      where: {
        id_usuario: id,
        fecha_hora: { [Op.gte]: inicioMes, [Op.lt]: inicioMesSiguiente }
      },
      order: [['fecha_hora', 'ASC']]
    });
    const diasDelMes = [...new Set(registrosDelMes.map(a => aClaveDelDia(a.fecha_hora)))];

    const totalHistorico = await Asistencia.count({ where: { id_usuario: id } });
    const ultima = await Asistencia.findOne({
      where: { id_usuario: id },
      order: [['fecha_hora', 'DESC']]
    });

    return NextResponse.json({
      usuario,
      mes: `${anio}-${String(mesIndice + 1).padStart(2, '0')}`,
      diasDelMes,
      totalDelMes: diasDelMes.length,
      totalHistorico,
      ultimaVisita: ultima?.fecha_hora ?? null
    });
  } catch (error) {
    console.error('Error al obtener asistencias de usuario:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
