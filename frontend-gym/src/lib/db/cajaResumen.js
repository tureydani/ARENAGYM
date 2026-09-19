const { MovimientoCaja } = require('./models');
const { CANALES_COBRO, CANAL_EFECTIVO } = require('./canalesCobro');

// Fuente única de verdad para "cuánto debería haber en una jornada": suma
// los movimientos_caja reales en vez de confiar ciegamente en saldo_actual
// (que puede desalinearse si algo lo tocó por fuera de este flujo). Se usa
// tanto para la vista previa del arqueo (GET .../arqueo) como para el
// cierre definitivo (POST .../cerrar), así ambos calculan exactamente lo
// mismo.
//
// Separa dos conceptos que NO deben confundirse (ver conversación de
// diseño): el saldo_registrado es la suma de TODOS los canales (lo que
// entró/salió de la jornada en total, incluyendo QR/Transferencia/
// Tarjeta), mientras que efectivo_esperado es solo el canal Efectivo --
// es lo único que se puede contar físicamente al cerrar. El arqueo se
// hace SIEMPRE sobre efectivo_esperado, nunca sobre saldo_registrado.
async function calcularResumenCaja(id_caja, { transaction } = {}) {
  const [ingresos, egresos] = await Promise.all([
    MovimientoCaja.sum('monto', { where: { id_caja, tipo_movimiento: 'Ingreso' }, transaction }),
    MovimientoCaja.sum('monto', { where: { id_caja, tipo_movimiento: 'Egreso' }, transaction })
  ]);

  const [ingresosEfectivo, egresosEfectivo] = await Promise.all([
    MovimientoCaja.sum('monto', { where: { id_caja, tipo_movimiento: 'Ingreso', canal_cobro: CANAL_EFECTIVO }, transaction }),
    MovimientoCaja.sum('monto', { where: { id_caja, tipo_movimiento: 'Egreso', canal_cobro: CANAL_EFECTIVO }, transaction })
  ]);

  // Desglose por canal (para la tarjeta de jornada activa / detalle):
  // ingresos - egresos de cada canal, incluyendo los que dieron 0
  // movimientos (para mostrarlos igual en Bs. 0,00 en vez de omitirlos).
  const desglosePorCanal = {};
  for (const canal of CANALES_COBRO) {
    const [ingresoCanal, egresoCanal] = await Promise.all([
      MovimientoCaja.sum('monto', { where: { id_caja, tipo_movimiento: 'Ingreso', canal_cobro: canal.codigo }, transaction }),
      MovimientoCaja.sum('monto', { where: { id_caja, tipo_movimiento: 'Egreso', canal_cobro: canal.codigo }, transaction })
    ]);
    desglosePorCanal[canal.codigo] = (parseFloat(ingresoCanal) || 0) - (parseFloat(egresoCanal) || 0);
  }

  return {
    total_ingresos: parseFloat(ingresos) || 0,
    total_egresos: parseFloat(egresos) || 0,
    total_ingresos_efectivo: parseFloat(ingresosEfectivo) || 0,
    total_egresos_efectivo: parseFloat(egresosEfectivo) || 0,
    desglose_por_canal: desglosePorCanal
  };
}

module.exports = { calcularResumenCaja };
