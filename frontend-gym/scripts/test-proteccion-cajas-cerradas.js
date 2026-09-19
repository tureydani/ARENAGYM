// Verifica que las 4 cajas YA cerradas realmente rechacen operaciones.
// Solo hace peticiones que deben ser RECHAZADAS (400): no escribe ningún
// dato histórico nuevo si todo funciona como se espera.
const fs = require('fs');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3055';
const TOKEN = JSON.parse(fs.readFileSync(process.env.TOKEN_FILE || '/tmp/token.json', 'utf-8')).token;
const ID_ADMIN = JSON.parse(fs.readFileSync(process.env.TOKEN_FILE || '/tmp/token.json', 'utf-8')).id_admin;

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

async function main() {
  const usuarios = await api('GET', '/api/usuarios');
  const usuario = usuarios.data?.[0];
  const registros = await api('GET', '/api/registro-membresias');
  const registro = registros.data?.[0];
  const pagos = await api('GET', '/api/pagos');
  const pagoExistenteCaja1 = pagos.data.find(p => p.id_caja === 1);
  const ventas = await api('GET', '/api/ventas');
  const ventaExistenteCaja1 = ventas.data.find(v => v.id_caja === 1);

  for (const idCaja of [1, 2, 3, 4]) {
    const nuevoPago = await api('POST', '/api/pagos', {
      id_registro: registro.id_registro, id_admin: ID_ADMIN, id_caja: idCaja,
      canal_cobro: 'Efectivo', monto_pagado: 1, estado_pago: 'Completo'
    });
    assert(`Caja #${idCaja}: rechaza nuevo PAGO`, nuevoPago.status === 400, `status=${nuevoPago.status}`);

    const nuevaVenta = await api('POST', '/api/ventas', {
      id_usuario: usuario.id_usuario, id_admin: ID_ADMIN, id_caja: idCaja,
      canal_cobro: 'QR', total: 1
    });
    assert(`Caja #${idCaja}: rechaza nueva VENTA`, nuevaVenta.status === 400, `status=${nuevaVenta.status}`);

    const nuevoMov = await api('POST', '/api/movimientos-caja', {
      id_caja: idCaja, id_admin: ID_ADMIN, tipo_movimiento: 'Ingreso',
      descripcion: 'Test proteccion', monto: 1, origen: 'Otro', canal_cobro: 'Efectivo'
    });
    assert(`Caja #${idCaja}: rechaza nuevo MOVIMIENTO`, nuevoMov.status === 400, `status=${nuevoMov.status}`);

    const segundoCierre = await api('POST', `/api/cajas/${idCaja}/cerrar`, { saldo_contado: 0, id_admin: ID_ADMIN });
    assert(`Caja #${idCaja}: rechaza SEGUNDO CIERRE`, segundoCierre.status === 400, `status=${segundoCierre.status}`);
  }

  // Modificación de pago/venta EXISTENTE que pertenece a la caja 1 (ya cerrada)
  if (pagoExistenteCaja1) {
    const editPago = await api('PUT', `/api/pagos/${pagoExistenteCaja1.id_pago}`, { monto_pagado: 999 });
    assert('Rechaza MODIFICAR pago existente de caja #1 (cerrada)', editPago.status === 400, `status=${editPago.status}, pago=${pagoExistenteCaja1.id_pago}`);
  }
  if (ventaExistenteCaja1) {
    const editVenta = await api('PUT', `/api/ventas/${ventaExistenteCaja1.id_venta}`, { total: 999 });
    assert('Rechaza MODIFICAR venta existente de caja #1 (cerrada)', editVenta.status === 400, `status=${editVenta.status}, venta=${ventaExistenteCaja1.id_venta}`);
  }

  const fallas = resultados.filter(r => r.resultado === 'FALLA');
  console.log(`\n=== Resumen: ${resultados.length - fallas.length}/${resultados.length} casos OK ===`);
  if (fallas.length) console.log(JSON.stringify(fallas, null, 2));
  process.exit(fallas.length ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
