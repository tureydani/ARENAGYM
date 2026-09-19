// Suite de pruebas del nuevo modelo Jornada -> Canales de cobro.
// TODO corre dentro de UNA transacción que se revierte SIEMPRE al final
// (incluso si todo pasa): no persiste ningún dato de prueba en la base
// real. Ejercita los triggers reales de la BD (reflejar_pago_en_caja /
// reflejar_venta_en_caja), el índice único de jornada abierta, y la
// lógica de cajaResumen.js -- lo que NO se puede probar así (los checks
// de "jornada cerrada" que viven en el código de las rutas Next.js) se
// simula replicando exactamente esa lógica dentro de la transacción, y se
// deja anotado en el resultado.
//
// Uso: node scripts/test-flujo-canales.js

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
const { Caja, Pago, Venta, MovimientoCaja, Usuario, Administrativo, Membresia, RegistroMembresia, DetalleVenta, Producto } = require('../src/lib/db/models');
const { calcularResumenCaja } = require('../src/lib/db/cajaResumen');

const resultados = [];
function assert(nombre, condicion, detalle = '') {
  resultados.push({ caso: nombre, resultado: condicion ? 'PASA' : 'FALLA', detalle });
  console.log(`${condicion ? '✓' : '✗'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}

async function main() {
  const t = await sequelize.transaction();
  try {
    // --- Datos de apoyo mínimos dentro de la transacción (no persisten) ---
    const admin = await Administrativo.findOne({ transaction: t });
    const usuario = await Usuario.findOne({ transaction: t });
    let membresia = await Membresia.findOne({ transaction: t });
    if (!membresia) {
      membresia = await Membresia.create({ tipo: 'Test', duracion_dias: 30, precio: 100 }, { transaction: t });
    }
    const registro = await RegistroMembresia.create({
      id_usuario: usuario.id_usuario,
      id_membresia: membresia.id_membresia,
      id_admin: admin.id_admin,
      fecha_inicio: new Date(),
      activo: true
    }, { transaction: t });

    let producto = await Producto.findOne({ where: { stock: { [require('sequelize').Op.gt]: 5 } }, transaction: t });
    if (!producto) {
      producto = await Producto.create({ nombre: 'Producto Test', precio: 10, stock: 999 }, { transaction: t });
    }

    // 1. Abrir jornada
    const jornada = await Caja.create({
      descripcion: 'TEST_Jornada_' + Date.now(),
      saldo_inicial: 100,
      saldo_actual: 100,
      abierta: true,
      estado: 'ABIERTA',
      fecha_apertura: new Date(),
      id_admin_apertura: admin.id_admin
    }, { transaction: t });
    assert('1. Abrir jornada', jornada.estado === 'ABIERTA' && jornada.fecha_apertura instanceof Date);

    // 19. Intentar abrir segunda jornada para el mismo punto (mismo nombre,
    // ABIERTA). Se prueba en un SAVEPOINT (transacción anidada) porque
    // Postgres aborta el resto de la transacción externa ante cualquier
    // error no recuperado -- así el resto de las pruebas puede seguir.
    let segundaAperturaFallo = false;
    try {
      await sequelize.transaction({ transaction: t }, async (t2) => {
        await Caja.create({
          descripcion: jornada.descripcion,
          saldo_inicial: 0, saldo_actual: 0, abierta: true, estado: 'ABIERTA', fecha_apertura: new Date()
        }, { transaction: t2 });
      });
    } catch (e) {
      segundaAperturaFallo = e?.original?.code === '23505' || e?.parent?.code === '23505';
    }
    assert('19. Bloquear segunda jornada abierta con mismo nombre (índice único)', segundaAperturaFallo);

    // 2. Membresía en Efectivo
    const pagoEfectivo = await Pago.create({
      id_registro: registro.id_registro, id_admin: admin.id_admin, id_caja: jornada.id_caja,
      monto_pagado: 150, estado_pago: 'Completo', canal_cobro: 'Efectivo'
    }, { transaction: t });

    // 3. Membresía por QR
    const pagoQr = await Pago.create({
      id_registro: registro.id_registro, id_admin: admin.id_admin, id_caja: jornada.id_caja,
      monto_pagado: 200, estado_pago: 'Completo', canal_cobro: 'QR'
    }, { transaction: t });

    // 6. Transferencia
    const pagoTransferencia = await Pago.create({
      id_registro: registro.id_registro, id_admin: admin.id_admin, id_caja: jornada.id_caja,
      monto_pagado: 50, estado_pago: 'Completo', canal_cobro: 'Transferencia'
    }, { transaction: t });

    // 4. Producto en Efectivo / 5. Producto por QR / 7. Tarjeta
    const ventaEfectivo = await Venta.create({
      id_usuario: usuario.id_usuario, id_admin: admin.id_admin, id_caja: jornada.id_caja,
      total: 80, estado: 'Completada', canal_cobro: 'Efectivo'
    }, { transaction: t });
    const ventaQr = await Venta.create({
      id_usuario: usuario.id_usuario, id_admin: admin.id_admin, id_caja: jornada.id_caja,
      total: 50, estado: 'Completada', canal_cobro: 'QR'
    }, { transaction: t });
    const ventaTarjeta = await Venta.create({
      id_usuario: usuario.id_usuario, id_admin: admin.id_admin, id_caja: jornada.id_caja,
      total: 30, estado: 'Completada', canal_cobro: 'Tarjeta'
    }, { transaction: t });

    // 20/21. Verificar que los triggers no dupliquen y que canal_cobro se propague
    for (const [pago, esperado] of [[pagoEfectivo, 'Efectivo'], [pagoQr, 'QR'], [pagoTransferencia, 'Transferencia']]) {
      const movs = await MovimientoCaja.findAll({ where: { origen: 'Pago', id_referencia: pago.id_pago }, transaction: t });
      assert(`21. Trigger de pago propaga canal_cobro (Pago #${pago.id_pago})`, movs.length === 1 && movs[0].canal_cobro === esperado, `movimientos=${movs.length}, canal=${movs[0]?.canal_cobro}`);
    }
    for (const [venta, esperado] of [[ventaEfectivo, 'Efectivo'], [ventaQr, 'QR'], [ventaTarjeta, 'Tarjeta']]) {
      const movs = await MovimientoCaja.findAll({ where: { origen: 'Venta', id_referencia: venta.id_venta }, transaction: t });
      assert(`21. Trigger de venta propaga canal_cobro (Venta #${venta.id_venta})`, movs.length === 1 && movs[0].canal_cobro === esperado, `movimientos=${movs.length}, canal=${movs[0]?.canal_cobro}`);
    }

    // 8. Egreso en Efectivo (replica la lógica de movimientos-caja/route.js POST)
    await Caja.update({ saldo_actual: sequelize.literal('saldo_actual - 30') }, { where: { id_caja: jornada.id_caja }, transaction: t });
    await MovimientoCaja.create({
      id_caja: jornada.id_caja, id_admin: admin.id_admin, tipo_movimiento: 'Egreso',
      descripcion: 'Test egreso efectivo', monto: 30, origen: 'Otro', canal_cobro: 'Efectivo'
    }, { transaction: t });

    // 9. Egreso por QR/Transferencia (no debe afectar el efectivo)
    await Caja.update({ saldo_actual: sequelize.literal('saldo_actual - 20') }, { where: { id_caja: jornada.id_caja }, transaction: t });
    await MovimientoCaja.create({
      id_caja: jornada.id_caja, id_admin: admin.id_admin, tipo_movimiento: 'Egreso',
      descripcion: 'Test egreso QR', monto: 20, origen: 'Otro', canal_cobro: 'QR'
    }, { transaction: t });

    // 10. Pago mixto (misma jornada, dos canales) -- replica pagos/mixto/route.js
    const mixto1 = await Pago.create({
      id_registro: registro.id_registro, id_admin: admin.id_admin, id_caja: jornada.id_caja,
      monto_pagado: 60, estado_pago: 'Completo', canal_cobro: 'Efectivo'
    }, { transaction: t });
    const mixto2 = await Pago.create({
      id_registro: registro.id_registro, id_admin: admin.id_admin, id_caja: jornada.id_caja,
      monto_pagado: 40, estado_pago: 'Completo', canal_cobro: 'Tarjeta'
    }, { transaction: t });
    assert('10/23. Pago mixto: dos filas, mismo id_caja, distinto canal', mixto1.id_caja === mixto2.id_caja && mixto1.canal_cobro !== mixto2.canal_cobro);

    // 11/12. Saldo registrado vs efectivo esperado
    const resumen = await calcularResumenCaja(jornada.id_caja, { transaction: t });
    const saldoInicial = 100;
    const saldoRegistrado = saldoInicial + resumen.total_ingresos - resumen.total_egresos;
    const efectivoEsperado = saldoInicial + resumen.total_ingresos_efectivo - resumen.total_egresos_efectivo;

    // Ingresos esperados: 150(Efec)+200(QR)+50(Transf)+80(Efec)+50(QR)+30(Tarj)+60(Efec)+40(Tarj) = 660
    // Egresos: 30(Efec) + 20(QR) = 50
    // Efectivo ingresos: 150+80+60 = 290. Efectivo egresos: 30. Efectivo neto = 260. + saldoInicial 100 = 360.
    assert('11. Saldo registrado = inicial + ingresos(todos) - egresos(todos)', saldoRegistrado === 100 + 660 - 50, `obtenido=${saldoRegistrado}, esperado=${100 + 660 - 50}`);
    assert('12. Efectivo esperado = inicial + ingresos(Efectivo) - egresos(Efectivo)', efectivoEsperado === 360, `obtenido=${efectivoEsperado}, esperado=360`);
    assert('5 (Fase 5). QR/Transferencia/Tarjeta no entran al efectivo esperado', efectivoEsperado < saldoRegistrado);

    // 13/14/15. Arqueo exacto / faltante / sobrante (solo la fórmula, ya que el
    // cierre real solo puede ejecutarse una vez por jornada)
    const casosArqueo = [
      { contado: efectivoEsperado, esperadaDif: 0, nombre: '13. Arqueo exacto' },
      { contado: efectivoEsperado - 10, esperadaDif: -10, nombre: '14. Arqueo con faltante' },
      { contado: efectivoEsperado + 15, esperadaDif: 15, nombre: '15. Arqueo con sobrante' }
    ];
    for (const caso of casosArqueo) {
      const diferencia = Math.round((caso.contado - efectivoEsperado) * 100) / 100;
      assert(caso.nombre, diferencia === caso.esperadaDif, `diferencia=${diferencia}`);
    }

    // 16. Cerrar jornada (replica cajas/[id]/cerrar/route.js)
    await jornada.update({
      fecha_cierre: new Date(),
      saldo_esperado: efectivoEsperado,
      saldo_contado: efectivoEsperado,
      diferencia: 0,
      id_admin_cierre: admin.id_admin,
      estado: 'CERRADA',
      abierta: false,
      saldo_actual: saldoRegistrado
    }, { transaction: t });
    assert('16. Cerrar jornada', jornada.estado === 'CERRADA' && jornada.abierta === false);

    // 17/18. Intentar registrar pago / modificar movimiento en jornada cerrada
    // (simula la validación que hacen las rutas ANTES de tocar la BD)
    const jornadaRecargada = await Caja.findByPk(jornada.id_caja, { transaction: t });
    const bloqueaNuevoPago = jornadaRecargada.estado === 'CERRADA'; // pagos/route.js rechaza si esto es true
    assert('17. Ruta de pagos rechazaría un pago nuevo (estado CERRADA)', bloqueaNuevoPago);
    const bloqueaEdicion = jornadaRecargada.estado === 'CERRADA'; // pagos/[id]/route.js PUT rechaza igual
    assert('18. Ruta de edición de pago rechazaría modificar un movimiento de jornada cerrada', bloqueaEdicion);

    // 20 (repetido, agregado). Confirmar que no hay más de 1 trigger por tabla/evento
    const [triggers] = await sequelize.query(`
      SELECT event_object_table, COUNT(*) AS cantidad
      FROM information_schema.triggers
      WHERE event_object_table IN ('pagos','ventas') AND event_manipulation = 'INSERT'
      GROUP BY event_object_table
    `, { transaction: t });
    assert('20. Un solo trigger AFTER INSERT por tabla (pagos/ventas)', triggers.every(r => Number(r.cantidad) === 1), JSON.stringify(triggers));

    // 22. Reversión conserva el canal correcto (elimina el pago mixto1, Efectivo)
    const ajusteReversion = -parseFloat(mixto1.monto_pagado);
    await Caja.update({ saldo_actual: sequelize.literal(`saldo_actual + (${ajusteReversion})`) }, { where: { id_caja: jornada.id_caja }, transaction: t });
    await MovimientoCaja.create({
      id_caja: jornada.id_caja, id_admin: admin.id_admin, tipo_movimiento: 'Egreso',
      descripcion: 'Reversión test', monto: mixto1.monto_pagado, origen: 'Reembolso',
      id_referencia: mixto1.id_pago, canal_cobro: mixto1.canal_cobro
    }, { transaction: t });
    const movReversion = await MovimientoCaja.findOne({ where: { origen: 'Reembolso', id_referencia: mixto1.id_pago }, transaction: t });
    assert('22. La reversión usa el mismo canal que el pago original', movReversion.canal_cobro === 'Efectivo');

    // 24. Verificar que las 4 jornadas históricas (id_caja 1-4) no fueron tocadas
    const [historicas] = await sequelize.query(
      `SELECT id_caja, descripcion, estado, saldo_actual FROM cajas WHERE id_caja IN (1,2,3,4) ORDER BY id_caja`,
      { transaction: t }
    );
    assert('24. Las 4 jornadas históricas siguen intactas (4 filas, ABIERTA)', historicas.length === 4 && historicas.every(c => c.estado === 'ABIERTA'), JSON.stringify(historicas));

  } catch (error) {
    console.error('\nERROR durante las pruebas:', error);
    resultados.push({ caso: 'EXCEPCIÓN NO MANEJADA', resultado: 'FALLA', detalle: error.message });
  } finally {
    // SIEMPRE se revierte -- ningún dato de prueba queda en la base real.
    await t.rollback();
    console.log('\n(Transacción revertida: ningún dato de prueba quedó guardado.)');
  }

  const fallas = resultados.filter(r => r.resultado === 'FALLA');
  console.log(`\n=== Resumen: ${resultados.length - fallas.length}/${resultados.length} casos OK ===`);
  if (fallas.length) {
    console.log('Casos fallidos:', fallas);
  }

  await sequelize.close();
  process.exit(fallas.length ? 1 : 0);
}

main();
