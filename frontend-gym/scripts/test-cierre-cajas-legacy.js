// Prueba específica para el cierre de las 4 cajas históricas (Efectivo,
// Qr, PRODUCTOS EFECTIVO, PRODUCTOS QR). Corre DENTRO de una transacción
// que se revierte SIEMPRE al final: las cajas reales 1-4 quedan exactamente
// igual (ABIERTA, mismos saldos) después de correr este script. Replica la
// lógica YA CORREGIDA de cajas/[id]/cerrar/route.js (que ya NO toca
// saldo_actual) para verificar el comportamiento antes de ejecutar los
// cierres reales.
//
// Uso: node scripts/test-cierre-cajas-legacy.js

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
const { Caja, Pago, Venta, MovimientoCaja } = require('../src/lib/db/models');
const { calcularResumenCaja } = require('../src/lib/db/cajaResumen');

const resultados = [];
function assert(nombre, condicion, detalle = '') {
  resultados.push({ caso: nombre, resultado: condicion ? 'PASA' : 'FALLA', detalle });
  console.log(`${condicion ? '✓' : '✗'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}

// Replica EXACTA de la lógica corregida de POST /cajas/[id]/cerrar
async function simularCierre(idCaja, saldoContado, idAdmin, t) {
  const caja = await Caja.findByPk(idCaja, { transaction: t, lock: t.LOCK.UPDATE });
  const resumen = await calcularResumenCaja(caja.id_caja, { transaction: t });
  const saldoInicial = parseFloat(caja.saldo_inicial);
  const saldoRegistrado = saldoInicial + resumen.total_ingresos - resumen.total_egresos;
  const efectivoEsperado = saldoInicial + resumen.total_ingresos_efectivo - resumen.total_egresos_efectivo;
  const diferencia = Math.round((saldoContado - efectivoEsperado) * 100) / 100;

  await caja.update({
    fecha_cierre: new Date(),
    saldo_esperado: efectivoEsperado,
    saldo_contado: saldoContado,
    diferencia,
    id_admin_cierre: idAdmin,
    estado: 'CERRADA',
    abierta: false
    // (sin tocar saldo_actual, como quedó corregido)
  }, { transaction: t });

  return { saldoRegistrado, efectivoEsperado, diferencia, saldoActualPrevio: parseFloat(caja.saldo_actual) };
}

async function main() {
  const t = await sequelize.transaction();
  try {
    const idAdmin = 3;

    // Snapshot ANTES de tocar nada, para comparar después (E/F/G/H/J)
    const snapshotAntes = {};
    for (const id of [1, 2, 3, 4]) {
      const [pagos] = await sequelize.query(`SELECT id_pago, id_caja, monto_pagado, canal_cobro FROM pagos WHERE id_caja=:id ORDER BY id_pago`, { replacements: { id }, transaction: t });
      const [ventas] = await sequelize.query(`SELECT id_venta, id_caja, total, canal_cobro FROM ventas WHERE id_caja=:id ORDER BY id_venta`, { replacements: { id }, transaction: t });
      const [movs] = await sequelize.query(`SELECT id_movimiento, id_caja, monto, canal_cobro, tipo_movimiento FROM movimientos_caja WHERE id_caja=:id ORDER BY id_movimiento`, { replacements: { id }, transaction: t });
      snapshotAntes[id] = { pagos, ventas, movs };
    }

    // --- A. Caja #1 Efectivo, diferencia positiva ---
    const r1 = await simularCierre(1, 8080, idAdmin, t); // contado = saldo_actual real (8080), esperado = 7930
    assert('A. Caja #1 Efectivo: diferencia positiva = +150', r1.diferencia === 150, `esperado=${r1.efectivoEsperado}, contado=8080, diferencia=${r1.diferencia}`);

    // --- B. Caja #3 PRODUCTOS EFECTIVO, diferencia negativa ---
    const r3 = await simularCierre(3, 88.90, idAdmin, t);
    assert('B. Caja #3 Efectivo: diferencia negativa = -0.50', r3.diferencia === -0.5, `esperado=${r3.efectivoEsperado}, contado=88.90, diferencia=${r3.diferencia}`);

    // --- C. Caja #2 Qr, efectivo físico 0 ---
    const r2 = await simularCierre(2, 0, idAdmin, t);
    assert('C. Caja #2 Qr: efectivo esperado = 0 (sin movimientos Efectivo)', r2.efectivoEsperado === 0, `efectivo_esperado=${r2.efectivoEsperado}`);
    assert('C. Caja #2 Qr: efectivo contado 0 -> diferencia 0', r2.diferencia === 0, `diferencia=${r2.diferencia}`);

    // --- D. Caja #2 Qr, saldo registrado distinto de 0 ---
    assert('D. Caja #2 Qr: saldo registrado (todos los canales) != 0 mientras efectivo esperado = 0', r2.saldoRegistrado !== 0 && r2.efectivoEsperado === 0, `saldo_registrado=${r2.saldoRegistrado}, efectivo_esperado=${r2.efectivoEsperado}`);

    // También cerrar #4 para completar las 4
    const r4 = await simularCierre(4, 0, idAdmin, t);
    assert('Caja #4 PRODUCTOS QR: efectivo esperado = 0, diferencia = 0', r4.efectivoEsperado === 0 && r4.diferencia === 0);

    // --- E/F/G/H. Nada de pagos/ventas/movimientos cambió (ni id_caja) ---
    let pagosIntactos = true, ventasIntactas = true, movsIntactos = true;
    for (const id of [1, 2, 3, 4]) {
      const [pagosDespues] = await sequelize.query(`SELECT id_pago, id_caja, monto_pagado, canal_cobro FROM pagos WHERE id_caja=:id ORDER BY id_pago`, { replacements: { id }, transaction: t });
      const [ventasDespues] = await sequelize.query(`SELECT id_venta, id_caja, total, canal_cobro FROM ventas WHERE id_caja=:id ORDER BY id_venta`, { replacements: { id }, transaction: t });
      const [movsDespues] = await sequelize.query(`SELECT id_movimiento, id_caja, monto, canal_cobro, tipo_movimiento FROM movimientos_caja WHERE id_caja=:id ORDER BY id_movimiento`, { replacements: { id }, transaction: t });
      if (JSON.stringify(pagosDespues) !== JSON.stringify(snapshotAntes[id].pagos)) pagosIntactos = false;
      if (JSON.stringify(ventasDespues) !== JSON.stringify(snapshotAntes[id].ventas)) ventasIntactas = false;
      if (JSON.stringify(movsDespues) !== JSON.stringify(snapshotAntes[id].movs)) movsIntactos = false;
    }
    assert('E. Cerrar no modifica ningún movimiento_caja', movsIntactos);
    assert('F. Cerrar no modifica ningún pago (ni su id_caja)', pagosIntactos);
    assert('G. Cerrar no modifica ninguna venta (ni su id_caja)', ventasIntactas);
    assert('H. id_caja de pagos/ventas/movimientos permanece igual (implícito en E/F/G)', pagosIntactos && ventasIntactas && movsIntactos);

    // --- I. Una caja cerrada no acepta operaciones (mismo guard que ya usan las rutas) ---
    const cajasCerradas = await Caja.findAll({ where: { id_caja: [1, 2, 3, 4] }, transaction: t });
    const todasCerradas = cajasCerradas.every(c => c.estado === 'CERRADA');
    assert('I. Las 4 cajas quedan estado=CERRADA (las rutas de pagos/ventas/movimientos ya rechazan sobre este estado, verificado por HTTP en la fase anterior)', todasCerradas);

    // --- J. El saldo registrado histórico sigue siendo visible/calculable después del cierre ---
    let saldoVisiblePostCierre = true;
    for (const id of [1, 2, 3, 4]) {
      const resumenPost = await calcularResumenCaja(id, { transaction: t });
      const cajaPost = await Caja.findByPk(id, { transaction: t });
      // saldo_actual NO debe haber cambiado (sigue siendo el valor histórico preexistente)
      const saldoActualOriginal = { 1: 8080, 2: 5160, 3: 88.90, 4: 8 }[id];
      if (Math.abs(parseFloat(cajaPost.saldo_actual) - saldoActualOriginal) > 0.001) saldoVisiblePostCierre = false;
      if (resumenPost.total_ingresos === undefined) saldoVisiblePostCierre = false;
    }
    assert('J. saldo_actual histórico permanece visible sin alterar tras el cierre (no se "corrige" el +150/-0.50)', saldoVisiblePostCierre);

  } catch (error) {
    console.error('\nERROR durante las pruebas:', error);
    resultados.push({ caso: 'EXCEPCIÓN NO MANEJADA', resultado: 'FALLA', detalle: error.message });
  } finally {
    await t.rollback();
    console.log('\n(Transacción revertida: las cajas 1-4 reales siguen ABIERTA, sin cambios.)');
  }

  // Verificación final fuera de la transacción: confirmar que en la BD real no cambió nada.
  const [verificacionFinal] = await sequelize.query(`SELECT id_caja, estado, saldo_actual, fecha_cierre FROM cajas WHERE id_caja IN (1,2,3,4) ORDER BY id_caja`);
  console.log('\nEstado real de las cajas 1-4 después de correr el test (deben seguir ABIERTA, fecha_cierre NULL):');
  console.table(verificacionFinal);
  const realmenteIntacto = verificacionFinal.every(c => c.estado === 'ABIERTA' && c.fecha_cierre === null);
  assert('Verificación post-test: las cajas reales 1-4 no fueron alteradas por este script', realmenteIntacto);

  const fallas = resultados.filter(r => r.resultado === 'FALLA');
  console.log(`\n=== Resumen: ${resultados.length - fallas.length}/${resultados.length} casos OK ===`);
  if (fallas.length) console.log('Casos fallidos:', fallas);

  await sequelize.close();
  process.exit(fallas.length ? 1 : 0);
}

main();
