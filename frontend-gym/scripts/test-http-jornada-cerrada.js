// Prueba HTTP real (no a nivel de modelos) contra las rutas Next.js reales
// en ejecución, para verificar que rechazan operaciones sobre una jornada
// CERRADA. Crea una jornada + 1 pago + 1 venta de prueba (nombre
// "TEST_HTTP_..."), los cierra, intenta las operaciones que deben
// rechazarse, y al final deja todo documentado para limpieza manual por
// SQL directo (el propio sistema no permite borrar vía API una vez
// cerrada la jornada -- es la regla de inmutabilidad que se está
// probando).
//
// Uso: BASE_URL=http://localhost:3001 TOKEN=... node scripts/test-http-jornada-cerrada.js

const fs = require('fs');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
let TOKEN = process.env.TOKEN;
if (!TOKEN && process.env.TOKEN_FILE) {
  TOKEN = JSON.parse(fs.readFileSync(process.env.TOKEN_FILE, 'utf-8')).token;
}
if (!TOKEN) {
  console.error('Falta TOKEN (ver scripts/_generar-token-test.js) o TOKEN_FILE');
  process.exit(1);
}

const resultados = [];
function assert(nombre, condicion, detalle = '') {
  resultados.push({ caso: nombre, resultado: condicion ? 'PASA' : 'FALLA', detalle });
  console.log(`${condicion ? '✓' : '✗'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

async function main() {
  const nombreJornada = 'TEST_HTTP_' + Date.now();
  const idAdmin = 3; // el mismo que firmó el token

  // Necesitamos un id_usuario y un id_registro reales para crear pago/venta.
  const usuarios = await api('GET', '/api/usuarios');
  const usuario = usuarios.data?.[0];
  const registros = await api('GET', '/api/registro-membresias');
  const registro = registros.data?.[0];
  if (!usuario || !registro) {
    console.error('No hay usuarios/registros de membresía para usar en la prueba.');
    console.error('usuarios:', usuarios.status, JSON.stringify(usuarios.data)?.slice(0, 300));
    console.error('registros:', registros.status, JSON.stringify(registros.data)?.slice(0, 300));
    process.exit(1);
  }

  // 1. Abrir jornada de prueba
  const apertura = await api('POST', '/api/cajas/abrir', {
    descripcion: nombreJornada, saldo_inicial: 1, id_admin: idAdmin
  });
  assert('Abrir jornada de prueba (HTTP)', apertura.status === 201, `status=${apertura.status}`);
  const idCaja = apertura.data?.id_caja;

  // 2. Crear un pago y una venta MIENTRAS está abierta (para tener algo que
  // intentar modificar después de cerrar)
  const pago = await api('POST', '/api/pagos', {
    id_registro: registro.id_registro, id_admin: idAdmin, id_caja: idCaja,
    canal_cobro: 'Efectivo', monto_pagado: 1, estado_pago: 'Completo'
  });
  assert('Crear pago en jornada abierta (control, debe pasar)', pago.status === 201, `status=${pago.status}`);
  const idPago = pago.data?.id_pago;

  const venta = await api('POST', '/api/ventas', {
    id_usuario: usuario.id_usuario, id_admin: idAdmin, id_caja: idCaja,
    canal_cobro: 'QR', total: 1
  });
  assert('Crear venta en jornada abierta (control, debe pasar)', venta.status === 201, `status=${venta.status}`);
  const idVenta = venta.data?.id_venta;

  // 3. Cerrar la jornada
  const cierre = await api('POST', `/api/cajas/${idCaja}/cerrar`, {
    saldo_contado: 2, id_admin: idAdmin
  });
  assert('Cerrar jornada de prueba (HTTP)', cierre.status === 200, `status=${cierre.status}`);

  // 4. Intentar registrar pago en jornada cerrada -> debe rechazar
  const pagoRechazado = await api('POST', '/api/pagos', {
    id_registro: registro.id_registro, id_admin: idAdmin, id_caja: idCaja,
    canal_cobro: 'Efectivo', monto_pagado: 1, estado_pago: 'Completo'
  });
  assert('Rechaza registrar PAGO en jornada cerrada', pagoRechazado.status === 400, `status=${pagoRechazado.status}, body=${JSON.stringify(pagoRechazado.data)}`);

  // 5. Intentar registrar venta en jornada cerrada -> debe rechazar
  const ventaRechazada = await api('POST', '/api/ventas', {
    id_usuario: usuario.id_usuario, id_admin: idAdmin, id_caja: idCaja,
    canal_cobro: 'QR', total: 1
  });
  assert('Rechaza registrar VENTA en jornada cerrada', ventaRechazada.status === 400, `status=${ventaRechazada.status}, body=${JSON.stringify(ventaRechazada.data)}`);

  // 6. Intentar registrar movimiento manual en jornada cerrada -> debe rechazar
  const movRechazado = await api('POST', '/api/movimientos-caja', {
    id_caja: idCaja, id_admin: idAdmin, tipo_movimiento: 'Ingreso',
    descripcion: 'Test', monto: 1, origen: 'Otro', canal_cobro: 'Efectivo'
  });
  assert('Rechaza registrar MOVIMIENTO en jornada cerrada', movRechazado.status === 400, `status=${movRechazado.status}, body=${JSON.stringify(movRechazado.data)}`);

  // 7. Intentar modificar el pago que pertenece a la jornada ya cerrada -> debe rechazar
  const pagoEditRechazado = await api('PUT', `/api/pagos/${idPago}`, { monto_pagado: 5 });
  assert('Rechaza MODIFICAR pago de jornada cerrada', pagoEditRechazado.status === 400, `status=${pagoEditRechazado.status}, body=${JSON.stringify(pagoEditRechazado.data)}`);

  // 8. Intentar modificar la venta que pertenece a la jornada ya cerrada -> debe rechazar
  const ventaEditRechazada = await api('PUT', `/api/ventas/${idVenta}`, { total: 5 });
  assert('Rechaza MODIFICAR venta de jornada cerrada', ventaEditRechazada.status === 400, `status=${ventaEditRechazada.status}, body=${JSON.stringify(ventaEditRechazada.data)}`);

  // 9. Intentar cerrar la misma jornada dos veces -> debe rechazar
  const doblecierre = await api('POST', `/api/cajas/${idCaja}/cerrar`, { saldo_contado: 2, id_admin: idAdmin });
  assert('Rechaza CERRAR dos veces la misma jornada', doblecierre.status === 400, `status=${doblecierre.status}, body=${JSON.stringify(doblecierre.data)}`);

  const fallas = resultados.filter(r => r.resultado === 'FALLA');
  console.log(`\n=== Resumen HTTP: ${resultados.length - fallas.length}/${resultados.length} casos OK ===`);
  console.log('\nArtefactos de prueba creados (requieren limpieza manual por SQL, ver reporte):');
  console.log({ idCaja, nombreJornada, idPago, idVenta });

  process.exit(fallas.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
