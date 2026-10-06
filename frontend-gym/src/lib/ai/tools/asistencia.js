import { Asistencia } from '@/lib/db/models';
import { Op } from 'sequelize';

// Asistencias del cliente identificado en los últimos N días (por defecto 30).
async function consultarAsistencias(idUsuario, diasAtras = 30) {
  const desde = new Date();
  desde.setDate(desde.getDate() - diasAtras);

  const asistencias = await Asistencia.findAll({
    where: {
      id_usuario: idUsuario,
      fecha_hora: { [Op.gte]: desde }
    },
    order: [['fecha_hora', 'DESC']]
  });

  return {
    total: asistencias.length,
    ultimas: asistencias.slice(0, 5).map((a) => a.fecha_hora)
  };
}

export { consultarAsistencias };
