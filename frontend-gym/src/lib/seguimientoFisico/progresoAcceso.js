import { Progreso, FotoProgreso, MetricaFisica } from '../db/models';

// Carga una evaluación (Progreso) verificando que pertenezca al usuario
// autenticado. Centralizado acá porque TODAS las rutas de Seguimiento
// físico (fotos, métricas, comparación) necesitan la misma verificación de
// dueño antes de tocar nada -- un cliente nunca debe poder leer/escribir
// la evaluación de otro cambiando el :id en la URL.
async function cargarProgresoDelUsuario(idProgreso, idUsuario, { conDetalle = false } = {}) {
  if (!Number.isInteger(idProgreso)) return null;
  return Progreso.findOne({
    where: { id_progreso: idProgreso, id_usuario: idUsuario },
    include: conDetalle
      ? [
          { model: FotoProgreso, as: 'Fotos', attributes: { exclude: ['url_foto'] } },
          { model: MetricaFisica, as: 'Metricas' },
        ]
      : [],
  });
}

export { cargarProgresoDelUsuario };
