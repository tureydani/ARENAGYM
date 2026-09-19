const fs = require('fs');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3055';
const TOKEN_DATA = JSON.parse(fs.readFileSync(process.env.TOKEN_FILE || './token_temp.json', 'utf-8'));
const TOKEN = TOKEN_DATA.token;
const ID_ADMIN = TOKEN_DATA.id_admin;
const ID_CAJA = parseInt(process.env.ID_CAJA || '16', 10);

const resultados = [];
function assert(nombre, condicion, detalle = '') {
  resultados.push({ caso: nombre, resultado: condicion ? 'PASA' : 'FALLA', detalle });
  console.log(`${condicion ? '✓' : '✗'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}
async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, data };
}
async function getCaja() {
  const r = await api('GET', '/api/cajas');
  return r.data.find(c => c.id_caja === ID_CAJA);
}
async function getArqueo() {
  const r = await api('GET', `/api/cajas/${ID_CAJA}/arqueo`);
  return r.data;
}

const idsMovimientosCreados = [];

async function crearMovimiento(tipo, canal, monto, descripcion) {
  const r = await api('POST', '/api/movimientos-caja', {
    id_caja: ID_CAJA, id_admin: ID_ADMIN, tipo_movimiento: tipo,
    descripcion, monto, origen: 'Otro', canal_cobro: canal
  });
  if (r.status === 201) idsMovimientosCreados.push(r.data.id_movimiento);
  return r;
}

async function main() {
  const antes = await getCaja();
  assert('Estado inicial: jornada Recepción ABIERTA, saldo_actual=200', antes.estado === 'ABIERTA' && parseFloat(antes.saldo_actual) === 200, `saldo_actual=${antes.saldo_actual}`);

  // A. Ingreso Efectivo Bs 10
  await crearMovimiento('Ingreso', 'Efectivo', 10, 'TEST ingreso efectivo');
  let caja = await getCaja();
  let arqueo = await getArqueo();
  assert('A. Ingreso Efectivo +10 -> saldo_actual=210', parseFloat(caja.saldo_actual) === 210, `obtenido=${caja.saldo_actual}`);
  assert('A. efectivo_esperado=210', arqueo.efectivo_esperado === 210, `obtenido=${arqueo.efectivo_esperado}`);

  // B. Ingreso QR Bs 20
  await crearMovimiento('Ingreso', 'QR', 20, 'TEST ingreso QR');
  caja = await getCaja(); arqueo = await getArqueo();
  assert('B. saldo registrado sube a 230', parseFloat(caja.saldo_actual) === 230, `obtenido=${caja.saldo_actual}`);
  assert('B. efectivo_esperado sigue en 210', arqueo.efectivo_esperado === 210, `obtenido=${arqueo.efectivo_esperado}`);

  // C. Ingreso Transferencia Bs 30
  await crearMovimiento('Ingreso', 'Transferencia', 30, 'TEST ingreso transferencia');
  caja = await getCaja(); arqueo = await getArqueo();
  assert('C. saldo registrado = 260', parseFloat(caja.saldo_actual) === 260, `obtenido=${caja.saldo_actual}`);
  assert('C. efectivo_esperado = 210', arqueo.efectivo_esperado === 210, `obtenido=${arqueo.efectivo_esperado}`);

  // D. Ingreso Tarjeta Bs 40
  await crearMovimiento('Ingreso', 'Tarjeta', 40, 'TEST ingreso tarjeta');
  caja = await getCaja(); arqueo = await getArqueo();
  assert('D. saldo registrado = 300', parseFloat(caja.saldo_actual) === 300, `obtenido=${caja.saldo_actual}`);
  assert('D. efectivo_esperado = 210', arqueo.efectivo_esperado === 210, `obtenido=${arqueo.efectivo_esperado}`);

  // E. Egreso Efectivo Bs 10
  await crearMovimiento('Egreso', 'Efectivo', 10, 'TEST egreso efectivo');
  caja = await getCaja(); arqueo = await getArqueo();
  assert('E. saldo registrado = 290', parseFloat(caja.saldo_actual) === 290, `obtenido=${caja.saldo_actual}`);
  assert('E. efectivo_esperado = 200', arqueo.efectivo_esperado === 200, `obtenido=${arqueo.efectivo_esperado}`);

  // F. Arqueo: saldo registrado vs efectivo esperado vs efectivo contado (simulado, sin cerrar)
  assert('F. Arqueo distingue saldo_registrado (290) != efectivo_esperado (200)', arqueo.saldo_registrado === 290 && arqueo.efectivo_esperado === 200);
  const diferenciaSimulada = Math.round((195 - arqueo.efectivo_esperado) * 100) / 100;
  assert('F. Fórmula de diferencia funciona sobre efectivo (contado simulado 195 -> diferencia -5)', diferenciaSimulada === -5);

  // G. NO cerrar la jornada -- se deja ABIERTA. Limpiar los movimientos de
  // prueba con el mecanismo seguro existente (DELETE revierte el saldo).
  console.log('\nLimpiando movimientos de prueba...');
  for (const id of idsMovimientosCreados) {
    const del = await api('DELETE', `/api/movimientos-caja/${id}`);
    console.log(`  DELETE movimiento #${id}: status=${del.status}`);
  }

  const despues = await getCaja();
  assert('G. Tras limpiar: saldo_actual vuelve a 200 (sin residuos)', parseFloat(despues.saldo_actual) === 200, `obtenido=${despues.saldo_actual}`);
  assert('G. Jornada sigue ABIERTA (no se cerró durante la prueba)', despues.estado === 'ABIERTA');

  const fallas = resultados.filter(r => r.resultado === 'FALLA');
  console.log(`\n=== Resumen: ${resultados.length - fallas.length}/${resultados.length} casos OK ===`);
  if (fallas.length) console.log(JSON.stringify(fallas, null, 2));
  process.exit(fallas.length ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
