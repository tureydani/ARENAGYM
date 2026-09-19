// Chequeo de SOLO LECTURA: ¿todo movimiento derivado de un Pago/Venta tiene
// el mismo id_caja que su operación de origen? Se corre ANTES del backfill
// de canal_cobro para no propagar un canal incorrecto si hay algo
// inconsistente. No modifica nada.

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
  console.log('=== Movimientos origen Pago cuyo id_caja difiere del pago de origen ===');
  const [mismatchPago] = await sequelize.query(`
    SELECT m.id_movimiento, m.id_caja AS caja_movimiento, m.monto AS monto_movimiento,
           p.id_pago, p.id_caja AS caja_pago, p.monto_pagado
    FROM movimientos_caja m
    JOIN pagos p ON p.id_pago = m.id_referencia
    WHERE m.origen = 'Pago' AND m.id_caja IS DISTINCT FROM p.id_caja
  `);
  console.table(mismatchPago.length ? mismatchPago : [{ resultado: 'sin inconsistencias' }]);

  console.log('\n=== Movimientos origen Venta cuyo id_caja difiere de la venta de origen ===');
  const [mismatchVenta] = await sequelize.query(`
    SELECT m.id_movimiento, m.id_caja AS caja_movimiento, m.monto AS monto_movimiento,
           v.id_venta, v.id_caja AS caja_venta, v.total
    FROM movimientos_caja m
    JOIN ventas v ON v.id_venta = m.id_referencia
    WHERE m.origen = 'Venta' AND m.id_caja IS DISTINCT FROM v.id_caja
  `);
  console.table(mismatchVenta.length ? mismatchVenta : [{ resultado: 'sin inconsistencias' }]);

  console.log('\n=== Conteo cruzado: movimientos por (origen, id_referencia) que no matchean 1 a 1 ===');
  // Un id_referencia con más de un movimiento del mismo origen es sospechoso
  // (¿movimiento duplicado por trigger + código de la app?).
  const [duplicados] = await sequelize.query(`
    SELECT origen, id_referencia, COUNT(*) AS cantidad_movimientos
    FROM movimientos_caja
    WHERE origen IN ('Pago', 'Venta') AND id_referencia IS NOT NULL
    GROUP BY origen, id_referencia
    HAVING COUNT(*) > 1
    ORDER BY cantidad_movimientos DESC
  `);
  console.table(duplicados.length ? duplicados : [{ resultado: 'sin duplicados' }]);

  console.log('\n=== Ventas/Pagos sin ningún movimiento asociado (id_referencia) ===');
  const [ventasSinMov] = await sequelize.query(`
    SELECT v.id_venta, v.id_caja, v.total, v.fecha_venta
    FROM ventas v
    LEFT JOIN movimientos_caja m ON m.origen = 'Venta' AND m.id_referencia = v.id_venta
    WHERE m.id_movimiento IS NULL
  `);
  console.table(ventasSinMov.length ? ventasSinMov : [{ resultado: 'todas las ventas tienen movimiento' }]);

  const [pagosSinMov] = await sequelize.query(`
    SELECT p.id_pago, p.id_caja, p.monto_pagado, p.fecha_pago
    FROM pagos p
    LEFT JOIN movimientos_caja m ON m.origen = 'Pago' AND m.id_referencia = p.id_pago
    WHERE m.id_movimiento IS NULL
  `);
  console.table(pagosSinMov.length ? pagosSinMov : [{ resultado: 'todos los pagos tienen movimiento' }]);

  await sequelize.close();
}

main().catch((error) => {
  console.error('Error en el chequeo de consistencia:', error);
  process.exit(1);
});
