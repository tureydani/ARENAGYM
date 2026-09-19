// Limpieza puntual de los artefactos creados por test-http-jornada-cerrada.js
// y la prueba de concurrencia (jornadas TEST_HTTP_*/TEST_CONCURRENCIA_*).
// Borra SOLO filas cuya caja tenga descripcion que empiece con 'TEST_' --
// nunca toca id_caja 1-4 ni ninguna otra. Verificado con SELECT antes del
// DELETE para confirmar el alcance exacto.
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
  const [cajasTest] = await sequelize.query(`SELECT id_caja, descripcion FROM cajas WHERE descripcion LIKE 'TEST\\_%' ORDER BY id_caja`);
  console.log('Cajas de prueba a eliminar:', cajasTest);
  if (cajasTest.length === 0) { console.log('Nada que limpiar.'); await sequelize.close(); return; }
  const ids = cajasTest.map(c => c.id_caja);

  const t = await sequelize.transaction();
  try {
    const [movs] = await sequelize.query(`DELETE FROM movimientos_caja WHERE id_caja IN (:ids) RETURNING id_movimiento`, { replacements: { ids }, transaction: t });
    const [pagos] = await sequelize.query(`DELETE FROM pagos WHERE id_caja IN (:ids) RETURNING id_pago`, { replacements: { ids }, transaction: t });
    const [ventas] = await sequelize.query(`DELETE FROM ventas WHERE id_caja IN (:ids) RETURNING id_venta`, { replacements: { ids }, transaction: t });
    const [cajas] = await sequelize.query(`DELETE FROM cajas WHERE id_caja IN (:ids) RETURNING id_caja`, { replacements: { ids }, transaction: t });
    await t.commit();
    console.log('Eliminados -> movimientos:', movs.length, '| pagos:', pagos.length, '| ventas:', ventas.length, '| cajas:', cajas.length);
  } catch (e) {
    await t.rollback();
    throw e;
  }

  const [verificacion] = await sequelize.query(`SELECT COUNT(*) AS restantes FROM cajas WHERE descripcion LIKE 'TEST\\_%'`);
  console.log('Cajas TEST_ restantes tras limpieza:', verificacion[0].restantes);

  const [historicas] = await sequelize.query(`SELECT id_caja, descripcion, estado, saldo_actual FROM cajas WHERE id_caja IN (1,2,3,4) ORDER BY id_caja`);
  console.log('Cajas historicas 1-4 (deben seguir igual):', historicas);

  await sequelize.close();
}
main().catch(e => { console.error(e); process.exit(1); });
