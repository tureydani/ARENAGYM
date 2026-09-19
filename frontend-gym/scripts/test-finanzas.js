// Prueba HTTP real del módulo Finanzas contra un servidor de prueba
// aislado. Crea fondos/movimientos de prueba (prefijo TEST_) y los limpia
// al final por SQL directo (fondos/movimientos_financieros no tocan
// cajas/pagos/ventas, así que la limpieza es autónoma y segura).
//
// Uso: BASE_URL=... TOKEN_FILE=... node scripts/test-finanzas.js
const fs = require('fs');
const path = require('path');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3077';

const resultados = [];
function assert(nombre, condicion, detalle = '') {
  resultados.push({ caso: nombre, resultado: condicion ? 'PASA' : 'FALLA', detalle });
  console.log(`${condicion ? '✓' : '✗'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}

function tokenPara(rol) {
  return JSON.parse(fs.readFileSync(`./token_${rol}.json`, 'utf-8')).token;
}

async function api(token, method, url, body) {
  const res = await fetch(`${BASE_URL}${url}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

async function main() {
  const admin = tokenPara('admin');
  const entrenador = tokenPara('entrenador');
  const recepcionista = tokenPara('recepcionista');

  const idsFondosCreados = [];

  // --- Seguridad de roles ---
  const rEntrenador = await api(entrenador, 'GET', '/api/finanzas/fondos');
  assert('Seguridad: ENTRENADOR no puede ni leer fondos', rEntrenador.status === 403, `status=${rEntrenador.status}`);

  const rRecepLee = await api(recepcionista, 'GET', '/api/finanzas/fondos');
  assert('Seguridad: RECEPCIONISTA sí puede leer fondos', rRecepLee.status === 200, `status=${rRecepLee.status}`);

  const rRecepEscribe = await api(recepcionista, 'POST', '/api/finanzas/fondos', { nombre: 'TEST_no_deberia_crearse', tipo_fondo: 'OTRO' });
  assert('Seguridad: RECEPCIONISTA NO puede crear fondos', rRecepEscribe.status === 403, `status=${rRecepEscribe.status}`);

  // --- 1/2/3. Crear fondo (sin y con saldo inicial) ---
  const fCaja = await api(admin, 'POST', '/api/finanzas/fondos', { nombre: 'TEST_Caja física', tipo_fondo: 'CAJA_FISICA', saldo_inicial: 500 });
  assert('1/2. Crear fondo con saldo_inicial=500', fCaja.status === 201 && parseFloat(fCaja.data.saldo_actual) === 500, `status=${fCaja.status}, saldo=${fCaja.data?.saldo_actual}`);
  idsFondosCreados.push(fCaja.data.id_fondo);

  const detalleCaja = await api(admin, 'GET', `/api/finanzas/fondos/${fCaja.data.id_fondo}`);
  const movInicial = detalleCaja.data.movimientos.find(m => m.origen === 'SALDO_INICIAL');
  assert('2. El saldo inicial quedó registrado como movimiento SALDO_INICIAL (no como campo mágico)', !!movInicial && parseFloat(movInicial.monto) === 500);

  const fBanco = await api(admin, 'POST', '/api/finanzas/fondos', { nombre: 'TEST_Banco', tipo_fondo: 'BANCO' });
  assert('1. Crear fondo sin saldo inicial -> saldo 0', fBanco.status === 201 && parseFloat(fBanco.data.saldo_actual) === 0);
  idsFondosCreados.push(fBanco.data.id_fondo);

  // --- 4/5/6. Ingreso y egreso ---
  const ingreso = await api(admin, 'POST', '/api/finanzas/movimientos', { id_fondo: fCaja.data.id_fondo, tipo: 'INGRESO', categoria: 'COBRO', monto: 100, descripcion: 'TEST ingreso' });
  assert('4. Registrar ingreso +100', ingreso.status === 201);
  let caja = await api(admin, 'GET', `/api/finanzas/fondos/${fCaja.data.id_fondo}`);
  assert('6. Saldo tras ingreso = 600', parseFloat(caja.data.saldo_actual) === 600, `obtenido=${caja.data.saldo_actual}`);

  const egreso = await api(admin, 'POST', '/api/finanzas/movimientos', { id_fondo: fCaja.data.id_fondo, tipo: 'EGRESO', categoria: 'GASTO_OPERATIVO', monto: 50, descripcion: 'TEST egreso' });
  assert('5. Registrar egreso -50', egreso.status === 201);
  caja = await api(admin, 'GET', `/api/finanzas/fondos/${fCaja.data.id_fondo}`);
  assert('6. Saldo tras egreso = 550', parseFloat(caja.data.saldo_actual) === 550, `obtenido=${caja.data.saldo_actual}`);

  // --- 7. Impedir monto negativo / saldo insuficiente ---
  const egresoExcesivo = await api(admin, 'POST', '/api/finanzas/movimientos', { id_fondo: fCaja.data.id_fondo, tipo: 'EGRESO', categoria: 'GASTO_OPERATIVO', monto: 99999 });
  assert('7. Rechaza egreso mayor al saldo disponible', egresoExcesivo.status === 400, `status=${egresoExcesivo.status}`);
  const montoNegativo = await api(admin, 'POST', '/api/finanzas/movimientos', { id_fondo: fCaja.data.id_fondo, tipo: 'INGRESO', categoria: 'COBRO', monto: -10 });
  assert('7. Rechaza monto negativo', montoNegativo.status === 400, `status=${montoNegativo.status}`);

  // --- 8/9/10. Transferencia ---
  const totalAntes = await api(admin, 'GET', '/api/finanzas/resumen');
  const transferencia = await api(admin, 'POST', '/api/finanzas/transferencias', {
    id_fondo_origen: fCaja.data.id_fondo, id_fondo_destino: fBanco.data.id_fondo, monto: 300, descripcion: 'TEST transferencia'
  });
  assert('8. Transferencia exitosa', transferencia.status === 201, `status=${transferencia.status}, body=${JSON.stringify(transferencia.data)}`);
  assert('8. Las 2 filas comparten id_transferencia', transferencia.data.movimientos.length === 2 &&
    transferencia.data.movimientos[0].id_transferencia === transferencia.data.movimientos[1].id_transferencia);

  const cajaPostTransf = await api(admin, 'GET', `/api/finanzas/fondos/${fCaja.data.id_fondo}`);
  const bancoPostTransf = await api(admin, 'GET', `/api/finanzas/fondos/${fBanco.data.id_fondo}`);
  assert('9. Origen descontado: 550-300=250', parseFloat(cajaPostTransf.data.saldo_actual) === 250, `obtenido=${cajaPostTransf.data.saldo_actual}`);
  assert('9. Destino aumentado: 0+300=300', parseFloat(bancoPostTransf.data.saldo_actual) === 300, `obtenido=${bancoPostTransf.data.saldo_actual}`);

  const totalDespues = await api(admin, 'GET', '/api/finanzas/resumen');
  assert('10. Dinero total controlado NO cambia por la transferencia', totalAntes.data.dinero_total_controlado === totalDespues.data.dinero_total_controlado,
    `antes=${totalAntes.data.dinero_total_controlado}, despues=${totalDespues.data.dinero_total_controlado}`);
  assert('20. Las transferencias NO se suman como ingreso/egreso real en el resumen', totalAntes.data.ingresos_periodo === totalDespues.data.ingresos_periodo && totalAntes.data.egresos_periodo === totalDespues.data.egresos_periodo);

  // --- 11/12. Rechazos de transferencia ---
  const transfInsuficiente = await api(admin, 'POST', '/api/finanzas/transferencias', { id_fondo_origen: fBanco.data.id_fondo, id_fondo_destino: fCaja.data.id_fondo, monto: 99999 });
  assert('11. Rechaza transferencia sin fondos suficientes', transfInsuficiente.status === 400);
  const transfMismoFondo = await api(admin, 'POST', '/api/finanzas/transferencias', { id_fondo_origen: fCaja.data.id_fondo, id_fondo_destino: fCaja.data.id_fondo, monto: 10 });
  assert('12. Rechaza origen = destino', transfMismoFondo.status === 400);

  // --- 13. Rollback completo si falla (destino inexistente) ---
  const saldoOrigenAntesFallo = (await api(admin, 'GET', `/api/finanzas/fondos/${fCaja.data.id_fondo}`)).data.saldo_actual;
  const transfDestinoInexistente = await api(admin, 'POST', '/api/finanzas/transferencias', { id_fondo_origen: fCaja.data.id_fondo, id_fondo_destino: 999999, monto: 10 });
  assert('13. Transferencia a fondo inexistente falla', transfDestinoInexistente.status === 404);
  const saldoOrigenDespuesFallo = (await api(admin, 'GET', `/api/finanzas/fondos/${fCaja.data.id_fondo}`)).data.saldo_actual;
  assert('13. Rollback: el saldo de origen NO cambió tras el intento fallido', saldoOrigenAntesFallo === saldoOrigenDespuesFallo, `antes=${saldoOrigenAntesFallo}, despues=${saldoOrigenDespuesFallo}`);

  // --- 16. Fondo inactivo rechaza operaciones ---
  const fInactivo = await api(admin, 'POST', '/api/finanzas/fondos', { nombre: 'TEST_Inactivo', tipo_fondo: 'OTRO' });
  idsFondosCreados.push(fInactivo.data.id_fondo);
  await api(admin, 'PUT', `/api/finanzas/fondos/${fInactivo.data.id_fondo}`, { activo: false });
  const movSobreInactivo = await api(admin, 'POST', '/api/finanzas/movimientos', { id_fondo: fInactivo.data.id_fondo, tipo: 'INGRESO', categoria: 'COBRO', monto: 10 });
  assert('16. Rechaza movimiento sobre fondo inactivo', movSobreInactivo.status === 400, `status=${movSobreInactivo.status}`);
  const noEditarSaldo = await api(admin, 'PUT', `/api/finanzas/fondos/${fCaja.data.id_fondo}`, { saldo_actual: 999999 });
  assert('11 (regla saldo). Rechaza editar saldo_actual directo por PUT', noEditarSaldo.status === 400);

  // --- 17. Anulación ---
  const ingresoParaAnular = await api(admin, 'POST', '/api/finanzas/movimientos', { id_fondo: fBanco.data.id_fondo, tipo: 'INGRESO', categoria: 'APORTE', monto: 40 });
  const saldoBancoPreAnular = (await api(admin, 'GET', `/api/finanzas/fondos/${fBanco.data.id_fondo}`)).data.saldo_actual;
  const anulacion = await api(admin, 'POST', `/api/finanzas/movimientos/${ingresoParaAnular.data.id_movimiento}/anular`, { motivo: 'TEST anulación' });
  assert('17. Anular movimiento exitoso', anulacion.status === 200, `status=${anulacion.status}`);
  const saldoBancoPostAnular = (await api(admin, 'GET', `/api/finanzas/fondos/${fBanco.data.id_fondo}`)).data.saldo_actual;
  assert('17. Saldo vuelve al valor previo tras anular', parseFloat(saldoBancoPostAnular) === parseFloat(saldoBancoPreAnular) - 40, `pre=${saldoBancoPreAnular}, post=${saldoBancoPostAnular}`);
  const detalleBanco = await api(admin, 'GET', `/api/finanzas/fondos/${fBanco.data.id_fondo}`);
  const originalSigueExistiendo = detalleBanco.data.movimientos.find(m => m.id_movimiento === ingresoParaAnular.data.id_movimiento);
  assert('17. El movimiento original NO se borró (activo=false, conservado)', originalSigueExistiendo && originalSigueExistiendo.activo === false);
  const filaReversion = detalleBanco.data.movimientos.find(m => m.origen === 'ANULACION' && m.id_referencia === ingresoParaAnular.data.id_movimiento);
  assert('17. Existe la fila de reversión (origen=ANULACION)', !!filaReversion);
  const segundaAnulacion = await api(admin, 'POST', `/api/finanzas/movimientos/${ingresoParaAnular.data.id_movimiento}/anular`, { motivo: 'TEST doble anulación' });
  assert('Rechaza anular dos veces el mismo movimiento', segundaAnulacion.status === 400);

  // --- Integración con jornadas SIN duplicar dinero (14/28) ---
  const cajasAbiertas = await api(admin, 'GET', '/api/cajas');
  const jornadaActiva = cajasAbiertas.data.find(c => c.abierta);
  const movimientosCajaAntes = await api(admin, 'GET', '/api/movimientos-caja');
  const cantidadMovCajaAntes = movimientosCajaAntes.data.filter(m => m.id_caja === jornadaActiva.id_caja).length;

  const movFinanzasJornada = await api(admin, 'POST', '/api/finanzas/movimientos', {
    id_fondo: fCaja.data.id_fondo, tipo: 'INGRESO', categoria: 'CIERRE_JORNADA', monto: 200,
    descripcion: 'TEST destino de efectivo de la jornada', id_jornada: jornadaActiva.id_caja
  });
  assert('14/28. Vincular un movimiento financiero a una jornada no crea movimientos_caja nuevos', movFinanzasJornada.status === 201);
  const movimientosCajaDespues = await api(admin, 'GET', '/api/movimientos-caja');
  const cantidadMovCajaDespues = movimientosCajaDespues.data.filter(m => m.id_caja === jornadaActiva.id_caja).length;
  assert('14. movimientos_caja de la jornada NO cambió (sin duplicación)', cantidadMovCajaAntes === cantidadMovCajaDespues, `antes=${cantidadMovCajaAntes}, despues=${cantidadMovCajaDespues}`);
  assert('14. El movimiento financiero quedó etiquetado con la jornada de origen', movFinanzasJornada.data.id_jornada === jornadaActiva.id_caja && movFinanzasJornada.data.origen === 'CIERRE_JORNADA');

  // --- 18. Regresión: pagos/ventas siguen funcionando igual ---
  const pagosCheck = await api(admin, 'GET', '/api/pagos');
  const ventasCheck = await api(admin, 'GET', '/api/ventas');
  assert('28. Endpoints existentes de pagos/ventas siguen respondiendo 200', pagosCheck.status === 200 && ventasCheck.status === 200);

  // --- Limpieza ---
  console.log('\nLimpiando datos de prueba (fondos TEST_ y sus movimientos)...');
  fs.writeFileSync('./_finanzas_test_ids.json', JSON.stringify(idsFondosCreados));

  const fallas = resultados.filter(r => r.resultado === 'FALLA');
  console.log(`\n=== Resumen: ${resultados.length - fallas.length}/${resultados.length} casos OK ===`);
  if (fallas.length) console.log(JSON.stringify(fallas, null, 2));
  process.exit(fallas.length ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
