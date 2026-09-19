// Snapshot lógico de solo lectura, ANTES de cerrar las 4 cajas históricas.
// No modifica nada. Guarda un JSON en scripts/_snapshots/ para comparar
// después del cierre y demostrar que no se alteró ningún dato histórico.
const fs = require('fs');
const path = require('path');
function cargarEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const contenido = fs.readFileSync(envPath, 'utf-8');
  for (const linea of contenido.split('\n')) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const idx = limpia.indexOf('=');
    if (idx === -1) continue;
    const clave = limpia.slice(0, idx).trim();
    const valor = limpia.slice(idx + 1).trim();
    if (!(clave in process.env)) process.env[clave] = valor;
  }
}
cargarEnvLocal();
const sequelize = require('../src/lib/db/sequelize');

async function main() {
  const [cajas] = await sequelize.query(`
    SELECT id_caja, descripcion, fecha_apertura, fecha_cierre, saldo_inicial, saldo_actual,
           saldo_esperado, saldo_contado, diferencia, estado, id_admin_apertura, id_admin_cierre
    FROM cajas WHERE id_caja IN (1,2,3,4) ORDER BY id_caja
  `);

  const [pagosAgg] = await sequelize.query(`
    SELECT id_caja, canal_cobro, activo, COUNT(*) AS cantidad, SUM(monto_pagado) AS suma
    FROM pagos WHERE id_caja IN (1,2,3,4) GROUP BY id_caja, canal_cobro, activo ORDER BY id_caja, canal_cobro, activo
  `);
  const [ventasAgg] = await sequelize.query(`
    SELECT id_caja, canal_cobro, estado, COUNT(*) AS cantidad, SUM(total) AS suma
    FROM ventas WHERE id_caja IN (1,2,3,4) GROUP BY id_caja, canal_cobro, estado ORDER BY id_caja, canal_cobro, estado
  `);
  const [movsAgg] = await sequelize.query(`
    SELECT id_caja, canal_cobro, origen, tipo_movimiento, COUNT(*) AS cantidad, SUM(monto) AS suma
    FROM movimientos_caja WHERE id_caja IN (1,2,3,4) GROUP BY id_caja, canal_cobro, origen, tipo_movimiento
    ORDER BY id_caja, canal_cobro, origen, tipo_movimiento
  `);
  const [movsTotalPorCaja] = await sequelize.query(`
    SELECT id_caja, COUNT(*) AS total_movimientos FROM movimientos_caja WHERE id_caja IN (1,2,3,4) GROUP BY id_caja ORDER BY id_caja
  `);

  // Detalle fila por fila (para comparar 1 a 1 después: mismos IDs, montos, canales, fechas)
  const [pagosDetalle] = await sequelize.query(`SELECT id_pago, id_registro, id_admin, id_caja, canal_cobro, monto_pagado, fecha_pago, estado_pago, activo FROM pagos WHERE id_caja IN (1,2,3,4) ORDER BY id_pago`);
  const [ventasDetalle] = await sequelize.query(`SELECT id_venta, id_usuario, id_admin, id_caja, canal_cobro, total, fecha_venta, estado FROM ventas WHERE id_caja IN (1,2,3,4) ORDER BY id_venta`);
  const [movsDetalle] = await sequelize.query(`SELECT id_movimiento, id_caja, id_admin, canal_cobro, origen, tipo_movimiento, monto, descripcion, fecha_movimiento, id_referencia FROM movimientos_caja WHERE id_caja IN (1,2,3,4) ORDER BY id_movimiento`);

  const snapshot = {
    generado: new Date().toISOString(),
    cajas, pagosAgg, ventasAgg, movsAgg, movsTotalPorCaja,
    pagosDetalle, ventasDetalle, movsDetalle
  };

  const dir = path.join(__dirname, '_snapshots');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const archivo = path.join(dir, 'snapshot-pre-transicion.json');
  fs.writeFileSync(archivo, JSON.stringify(snapshot, null, 2));

  console.log('=== Cajas 1-4 (estado actual) ===');
  console.table(cajas);
  console.log('\n=== Totales de movimientos por caja ===');
  console.table(movsTotalPorCaja);
  console.log(`\nPagos: ${pagosDetalle.length} filas | Ventas: ${ventasDetalle.length} filas | Movimientos: ${movsDetalle.length} filas`);
  console.log(`\nSnapshot guardado en: ${archivo}`);

  await sequelize.close();
}
main().catch(e => { console.error(e); process.exit(1); });
