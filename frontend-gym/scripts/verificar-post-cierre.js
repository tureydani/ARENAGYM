const fs = require('fs');
const path = require('path');
function cargarEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const c = fs.readFileSync(envPath, 'utf-8');
  for (const l of c.split('\n')) { const t = l.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; const k = t.slice(0, i).trim(), v = t.slice(i + 1).trim(); if (!(k in process.env)) process.env[k] = v; }
}
cargarEnvLocal();
const sequelize = require('../src/lib/db/sequelize');

const ESPERADO = {
  1: { estado: 'CERRADA', saldo_actual: 8080.00, saldo_esperado: 7930.00, saldo_contado: 8080.00, diferencia: 150.00 },
  2: { estado: 'CERRADA', saldo_actual: 5160.00, saldo_esperado: 0.00, saldo_contado: 0.00, diferencia: 0.00 },
  3: { estado: 'CERRADA', saldo_actual: 88.90, saldo_esperado: 89.40, saldo_contado: 88.90, diferencia: -0.50 },
  4: { estado: 'CERRADA', saldo_actual: 8.00, saldo_esperado: 0.00, saldo_contado: 0.00, diferencia: 0.00 }
};

const resultados = [];
function assert(nombre, condicion, detalle = '') {
  resultados.push({ caso: nombre, resultado: condicion ? 'PASA' : 'FALLA', detalle });
  console.log(`${condicion ? '✓' : '✗'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}

async function main() {
  const [cajas] = await sequelize.query(`SELECT * FROM cajas WHERE id_caja IN (1,2,3,4) ORDER BY id_caja`);
  console.log('=== Estado post-cierre ===');
  console.table(cajas);

  for (const c of cajas) {
    const e = ESPERADO[c.id_caja];
    assert(`Caja #${c.id_caja}: estado=CERRADA`, c.estado === 'CERRADA');
    assert(`Caja #${c.id_caja}: saldo_actual sin cambios (${e.saldo_actual})`, parseFloat(c.saldo_actual) === e.saldo_actual, `obtenido=${c.saldo_actual}`);
    assert(`Caja #${c.id_caja}: saldo_esperado=${e.saldo_esperado}`, parseFloat(c.saldo_esperado) === e.saldo_esperado, `obtenido=${c.saldo_esperado}`);
    assert(`Caja #${c.id_caja}: saldo_contado=${e.saldo_contado}`, parseFloat(c.saldo_contado) === e.saldo_contado, `obtenido=${c.saldo_contado}`);
    assert(`Caja #${c.id_caja}: diferencia=${e.diferencia}`, parseFloat(c.diferencia) === e.diferencia, `obtenido=${c.diferencia}`);
    assert(`Caja #${c.id_caja}: fecha_cierre no nula`, c.fecha_cierre !== null);
    assert(`Caja #${c.id_caja}: id_admin_cierre registrado`, c.id_admin_cierre !== null);
  }

  // Comparación de integridad contra el snapshot pre-transición
  const snapshotPath = path.join(__dirname, '_snapshots', 'snapshot-pre-transicion.json');
  const antes = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));

  const [pagosAhora] = await sequelize.query(`SELECT id_pago, id_registro, id_admin, id_caja, canal_cobro, monto_pagado, fecha_pago, estado_pago, activo FROM pagos WHERE id_caja IN (1,2,3,4) ORDER BY id_pago`);
  const [ventasAhora] = await sequelize.query(`SELECT id_venta, id_usuario, id_admin, id_caja, canal_cobro, total, fecha_venta, estado FROM ventas WHERE id_caja IN (1,2,3,4) ORDER BY id_venta`);
  const [movsAhora] = await sequelize.query(`SELECT id_movimiento, id_caja, id_admin, canal_cobro, origen, tipo_movimiento, monto, descripcion, fecha_movimiento, id_referencia FROM movimientos_caja WHERE id_caja IN (1,2,3,4) ORDER BY id_movimiento`);

  const pagosIguales = JSON.stringify(pagosAhora) === JSON.stringify(antes.pagosDetalle);
  const ventasIguales = JSON.stringify(ventasAhora) === JSON.stringify(antes.ventasDetalle);
  const movsIguales = JSON.stringify(movsAhora) === JSON.stringify(antes.movsDetalle);

  assert('Integridad: pagos idénticos al snapshot (mismos IDs, montos, canales, fechas)', pagosIguales, `${pagosAhora.length} filas antes y después`);
  assert('Integridad: ventas idénticas al snapshot', ventasIguales, `${ventasAhora.length} filas antes y después`);
  assert('Integridad: movimientos_caja idénticos al snapshot', movsIguales, `${movsAhora.length} filas antes y después`);

  const fallas = resultados.filter(r => r.resultado === 'FALLA');
  console.log(`\n=== Resumen: ${resultados.length - fallas.length}/${resultados.length} casos OK ===`);
  if (fallas.length) console.log(JSON.stringify(fallas, null, 2));

  await sequelize.close();
  process.exit(fallas.length ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
