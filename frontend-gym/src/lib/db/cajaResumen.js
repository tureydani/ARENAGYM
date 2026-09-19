const { MovimientoCaja } = require('./models');

// Fuente única de verdad para "cuánto debería haber en una caja": suma los
// movimientos_caja reales en vez de confiar ciegamente en saldo_actual (que
// puede desalinearse si algo lo tocó por fuera de este flujo). Se usa tanto
// para la vista previa del arqueo (GET .../arqueo) como para el cierre
// definitivo (POST .../cerrar), así ambos calculan exactamente lo mismo.
async function calcularResumenCaja(id_caja, { transaction } = {}) {
  const [ingresos, egresos] = await Promise.all([
    MovimientoCaja.sum('monto', { where: { id_caja, tipo_movimiento: 'Ingreso' }, transaction }),
    MovimientoCaja.sum('monto', { where: { id_caja, tipo_movimiento: 'Egreso' }, transaction })
  ]);

  return {
    total_ingresos: parseFloat(ingresos) || 0,
    total_egresos: parseFloat(egresos) || 0
  };
}

module.exports = { calcularResumenCaja };
