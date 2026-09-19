// Diagnóstico de SOLO LECTURA de las 4 cajas históricas (id_caja 1-4) para
// decidir su transición futura. No modifica nada. Ver conversación para el
// detalle de qué se pidió.
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
  const [cajas] = await sequelize.query(`SELECT * FROM cajas WHERE id_caja IN (1,2,3,4) ORDER BY id_caja`);

  console.log('=== 1) Datos base + saldo calculado vs saldo_actual ===');
  const resumenGeneral = [];
  for (const c of cajas) {
    const [[ing]] = await sequelize.query(`SELECT COALESCE(SUM(monto),0) AS total FROM movimientos_caja WHERE id_caja=:id AND tipo_movimiento='Ingreso'`, { replacements: { id: c.id_caja } });
    const [[egr]] = await sequelize.query(`SELECT COALESCE(SUM(monto),0) AS total FROM movimientos_caja WHERE id_caja=:id AND tipo_movimiento='Egreso'`, { replacements: { id: c.id_caja } });
    const saldoCalculado = parseFloat(c.saldo_inicial) + parseFloat(ing.total) - parseFloat(egr.total);
    const diferencia = Math.round((parseFloat(c.saldo_actual) - saldoCalculado) * 100) / 100;
    resumenGeneral.push({
      id_caja: c.id_caja, descripcion: c.descripcion, estado: c.estado,
      fecha_apertura: c.fecha_apertura, saldo_inicial: parseFloat(c.saldo_inicial),
      saldo_actual: parseFloat(c.saldo_actual), ingresos: parseFloat(ing.total), egresos: parseFloat(egr.total),
      saldo_calculado: saldoCalculado, diferencia_vs_saldo_actual: diferencia
    });
  }
  console.table(resumenGeneral);

  console.log('\n=== 2) Desglose por CANAL (neto = ingresos - egresos) ===');
  const [porCanal] = await sequelize.query(`
    SELECT id_caja, canal_cobro,
      COALESCE(SUM(CASE WHEN tipo_movimiento='Ingreso' THEN monto ELSE 0 END),0) AS ingresos,
      COALESCE(SUM(CASE WHEN tipo_movimiento='Egreso' THEN monto ELSE 0 END),0) AS egresos
    FROM movimientos_caja WHERE id_caja IN (1,2,3,4)
    GROUP BY id_caja, canal_cobro ORDER BY id_caja, canal_cobro
  `);
  console.table(porCanal.map(r => ({ ...r, neto: (parseFloat(r.ingresos) - parseFloat(r.egresos)).toFixed(2) })));

  console.log('\n=== 3) Desglose por ORIGEN ===');
  const [porOrigen] = await sequelize.query(`
    SELECT id_caja, origen, tipo_movimiento, COUNT(*) AS cantidad, SUM(monto) AS total
    FROM movimientos_caja WHERE id_caja IN (1,2,3,4)
    GROUP BY id_caja, origen, tipo_movimiento ORDER BY id_caja, origen, tipo_movimiento
  `);
  console.table(porOrigen);

  console.log('\n=== 4) Dependencias (cantidad de filas que apuntan a cada id_caja) ===');
  const [depsPagos] = await sequelize.query(`SELECT id_caja, COUNT(*) AS cantidad_pagos FROM pagos WHERE id_caja IN (1,2,3,4) GROUP BY id_caja ORDER BY id_caja`);
  const [depsVentas] = await sequelize.query(`SELECT id_caja, COUNT(*) AS cantidad_ventas FROM ventas WHERE id_caja IN (1,2,3,4) GROUP BY id_caja ORDER BY id_caja`);
  const [depsMovs] = await sequelize.query(`SELECT id_caja, COUNT(*) AS cantidad_movimientos FROM movimientos_caja WHERE id_caja IN (1,2,3,4) GROUP BY id_caja ORDER BY id_caja`);
  console.log('Pagos:', depsPagos);
  console.log('Ventas:', depsVentas);
  console.log('Movimientos:', depsMovs);

  console.log('\n=== 5) Movimientos de corrección (mueven dinero ENTRE las 4 cajas) ===');
  const [correcciones] = await sequelize.query(`
    SELECT id_movimiento, id_caja, tipo_movimiento, origen, monto, canal_cobro, descripcion, id_referencia
    FROM movimientos_caja
    WHERE id_caja IN (1,2,3,4) AND descripcion ILIKE '%orrecci%'
    ORDER BY id_movimiento
  `);
  console.log(`Total movimientos de corrección: ${correcciones.length}`);
  console.table(correcciones);

  console.log('\n=== 6) Pagos/Ventas cuyo id_caja ACTUAL difiere del id_caja de su(s) movimiento(s) histórico(s) ===');
  const [pagosMismatch] = await sequelize.query(`
    SELECT p.id_pago, p.id_caja AS caja_actual, m.id_caja AS caja_del_movimiento, m.id_movimiento, m.monto, m.canal_cobro
    FROM pagos p JOIN movimientos_caja m ON m.origen='Pago' AND m.id_referencia=p.id_pago
    WHERE p.id_caja IN (1,2,3,4) AND m.id_caja IS DISTINCT FROM p.id_caja
    ORDER BY p.id_pago
  `);
  console.log(`Pagos con mismatch: ${pagosMismatch.length}`);
  console.table(pagosMismatch);
  const [ventasMismatch] = await sequelize.query(`
    SELECT v.id_venta, v.id_caja AS caja_actual, m.id_caja AS caja_del_movimiento, m.id_movimiento, m.monto, m.canal_cobro
    FROM ventas v JOIN movimientos_caja m ON m.origen='Venta' AND m.id_referencia=v.id_venta
    WHERE v.id_caja IN (1,2,3,4) AND m.id_caja IS DISTINCT FROM v.id_caja
    ORDER BY v.id_venta
  `);
  console.log(`Ventas con mismatch: ${ventasMismatch.length}`);
  console.table(ventasMismatch);

  console.log('\n=== 7) Señales que complicarían una consolidación ===');
  const [sinCanal] = await sequelize.query(`SELECT COUNT(*) AS cantidad FROM movimientos_caja WHERE id_caja IN (1,2,3,4) AND canal_cobro IS NULL`);
  console.log('Movimientos sin canal_cobro:', sinCanal[0].cantidad);
  const [pagosInactivos] = await sequelize.query(`SELECT id_caja, COUNT(*) AS cantidad FROM pagos WHERE id_caja IN (1,2,3,4) AND activo=false GROUP BY id_caja`);
  console.log('Pagos inactivos (soft-deleted) por caja:', pagosInactivos);
  const [ventasEliminadas] = await sequelize.query(`SELECT id_caja, COUNT(*) AS cantidad FROM ventas WHERE id_caja IN (1,2,3,4) AND estado='Eliminada' GROUP BY id_caja`);
  console.log('Ventas eliminadas por caja:', ventasEliminadas);
  // Movimientos cuyo id_referencia aparece más de una vez para el mismo origen (ver nota: es normal por correcciones, no es un error)
  const [refDuplicados] = await sequelize.query(`
    SELECT origen, id_referencia, COUNT(*) AS cantidad
    FROM movimientos_caja WHERE id_caja IN (1,2,3,4) AND id_referencia IS NOT NULL
    GROUP BY origen, id_referencia HAVING COUNT(*) > 1 ORDER BY cantidad DESC
  `);
  console.log(`Pagos/ventas con más de 1 movimiento asociado (por correcciones, no error): ${refDuplicados.length}`);

  await sequelize.close();
}
main().catch(e => { console.error(e); process.exit(1); });
