// Diagnóstico de SOLO LECTURA (ninguna sentencia UPDATE/ALTER) para decidir
// cómo mapear la `descripcion` de cada caja histórica a uno de los cuatro
// canales de cobro (Efectivo/QR/Transferencia/Tarjeta) antes de correr
// cualquier backfill. No modifica nada.
//
// Uso: node scripts/diagnostico-canales-caja.js

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

const SQL_DIAGNOSTICO = `
SELECT
  c.id_caja,
  c.descripcion,
  c.estado,
  c.abierta,
  c.fecha_apertura,
  c.fecha_cierre,
  c.saldo_inicial,
  c.saldo_actual,
  (SELECT COUNT(*) FROM pagos p WHERE p.id_caja = c.id_caja) AS cantidad_pagos,
  (SELECT COUNT(*) FROM ventas v WHERE v.id_caja = c.id_caja) AS cantidad_ventas,
  (SELECT COUNT(*) FROM movimientos_caja m WHERE m.id_caja = c.id_caja) AS cantidad_movimientos,
  (SELECT MIN(m.fecha_movimiento) FROM movimientos_caja m WHERE m.id_caja = c.id_caja) AS primer_movimiento,
  (SELECT MAX(m.fecha_movimiento) FROM movimientos_caja m WHERE m.id_caja = c.id_caja) AS ultimo_movimiento
FROM cajas c
ORDER BY c.id_caja ASC;
`;

// Agrupa las descripciones para ver de un vistazo qué nombres de caja
// existen realmente en la base (para decidir el mapeo nombre -> canal).
const SQL_DESCRIPCIONES = `
SELECT descripcion, COUNT(*) AS cantidad_cajas, SUM(CASE WHEN estado = 'ABIERTA' THEN 1 ELSE 0 END) AS abiertas
FROM cajas
GROUP BY descripcion
ORDER BY descripcion;
`;

// Origen de los movimientos por caja: para saber si una caja histórica
// mezcló Pago/Venta/manuales, útil para decidir si es mapeable a un único
// canal o si hay que dejarla para revisión manual.
const SQL_ORIGENES_POR_CAJA = `
SELECT id_caja, origen, tipo_movimiento, COUNT(*) AS cantidad, SUM(monto) AS total
FROM movimientos_caja
GROUP BY id_caja, origen, tipo_movimiento
ORDER BY id_caja, origen, tipo_movimiento;
`;

async function main() {
  console.log('Conectando a la base de datos...\n');

  console.log('=== 1) Cajas: pagos/ventas/movimientos asociados ===');
  const [cajas] = await sequelize.query(SQL_DIAGNOSTICO);
  console.table(cajas);

  console.log('\n=== 2) Descripciones distintas usadas como nombre de caja ===');
  const [descripciones] = await sequelize.query(SQL_DESCRIPCIONES);
  console.table(descripciones);

  console.log('\n=== 3) Movimientos por caja, desglosados por origen y tipo ===');
  const [origenes] = await sequelize.query(SQL_ORIGENES_POR_CAJA);
  console.table(origenes);

  await sequelize.close();
  console.log('\nListo (solo lectura, no se modificó nada).');
}

main().catch((error) => {
  console.error('Error al ejecutar el diagnóstico:', error);
  process.exit(1);
});
