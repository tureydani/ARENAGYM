import { Pago, RegistroMembresia } from '@/lib/db/models';

// Últimos pagos del cliente identificado, vía sus registros de membresía.
async function consultarPagos(idUsuario, limite = 5) {
  const registros = await RegistroMembresia.findAll({
    where: { id_usuario: idUsuario },
    attributes: ['id_registro']
  });
  const idsRegistro = registros.map((r) => r.id_registro);
  if (idsRegistro.length === 0) return [];

  const pagos = await Pago.findAll({
    where: { id_registro: idsRegistro },
    order: [['fecha_pago', 'DESC']],
    limit: limite
  });

  return pagos.map((p) => ({
    fecha_pago: p.fecha_pago,
    monto_pagado: Number(p.monto_pagado),
    estado_pago: p.estado_pago,
    canal_cobro: p.canal_cobro
  }));
}

export { consultarPagos };
