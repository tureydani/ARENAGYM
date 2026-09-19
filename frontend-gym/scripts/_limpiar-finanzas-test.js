// Limpia los fondos/movimientos TEST_ creados por test-finanzas.js y los
// administrativos TEST_ creados por _generar-tokens-roles.js. No toca
// ningún fondo/administrativo real.
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

async function main() {
  const [fondosTest] = await sequelize.query(`SELECT id_fondo, nombre FROM fondos WHERE nombre LIKE 'TEST\\_%'`);
  console.log('Fondos de prueba a eliminar:', fondosTest);
  if (fondosTest.length > 0) {
    const ids = fondosTest.map(f => f.id_fondo);
    const t = await sequelize.transaction();
    try {
      const [movs] = await sequelize.query(`DELETE FROM movimientos_financieros WHERE id_fondo IN (:ids) RETURNING id_movimiento`, { replacements: { ids }, transaction: t });
      const [fondos] = await sequelize.query(`DELETE FROM fondos WHERE id_fondo IN (:ids) RETURNING id_fondo`, { replacements: { ids }, transaction: t });
      await t.commit();
      console.log('Eliminados -> movimientos_financieros:', movs.length, '| fondos:', fondos.length);
    } catch (e) { await t.rollback(); throw e; }
  }

  const [adminsTest] = await sequelize.query(`SELECT id_admin, usuario FROM administrativos WHERE usuario LIKE 'TEST\\_%'`);
  console.log('Administrativos de prueba a eliminar:', adminsTest);
  if (adminsTest.length > 0) {
    const ids = adminsTest.map(a => a.id_admin);
    await sequelize.query(`DELETE FROM administrativos WHERE id_admin IN (:ids)`, { replacements: { ids } });
    console.log('Administrativos de prueba eliminados:', ids.length);
  }

  const [verificacion] = await sequelize.query(`SELECT COUNT(*) AS restantes FROM fondos WHERE nombre LIKE 'TEST\\_%'`);
  console.log('Fondos TEST_ restantes:', verificacion[0].restantes);

  for (const f of ['./token_admin.json', './token_entrenador.json', './token_recepcionista.json', './_admins_test_ids.json', './_finanzas_test_ids.json']) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  await sequelize.close();
}
main().catch(e => { console.error(e); process.exit(1); });
