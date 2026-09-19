// Genera tokens de prueba para los 3 roles relevantes a Finanzas. Para
// ADMIN reutiliza un administrativo real existente (no cambia nada). Para
// ENTRENADOR y RECEPCIONISTA crea administrativos TEST_ temporales (se
// eliminan con scripts/_limpiar-tokens-roles.js).
const fs = require('fs');
const path = require('path');
function cargarEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const c = fs.readFileSync(envPath, 'utf-8');
  for (const l of c.split('\n')) { const t = l.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; const k = t.slice(0, i).trim(), v = t.slice(i + 1).trim(); if (!(k in process.env)) process.env[k] = v; }
}
cargarEnvLocal();
const bcrypt = require('bcryptjs');
const sequelize = require('../src/lib/db/sequelize');
const { Administrativo } = require('../src/lib/db/models');
const { firmarTokenAdmin } = require('../src/lib/auth/adminAuth');

async function main() {
  const adminReal = await Administrativo.findOne();
  fs.writeFileSync('./token_admin.json', JSON.stringify({ id_admin: adminReal.id_admin, token: await firmarTokenAdmin(adminReal) }));
  console.log('token_admin.json listo (admin real, rol=', adminReal.rol, ')');

  const hash = await bcrypt.hash('test_temporal_12345', 4);

  const entrenador = await Administrativo.create({
    nombre: 'TEST', apellido: 'Entrenador', usuario: 'TEST_entrenador_' + Date.now(),
    contraseña: hash, rol: 'ENTRENADOR'
  });
  fs.writeFileSync('./token_entrenador.json', JSON.stringify({ id_admin: entrenador.id_admin, token: await firmarTokenAdmin(entrenador) }));
  console.log('token_entrenador.json listo (id_admin=', entrenador.id_admin, ')');

  const recepcionista = await Administrativo.create({
    nombre: 'TEST', apellido: 'Recepcionista', usuario: 'TEST_recepcionista_' + Date.now(),
    contraseña: hash, rol: 'RECEPCIONISTA'
  });
  fs.writeFileSync('./token_recepcionista.json', JSON.stringify({ id_admin: recepcionista.id_admin, token: await firmarTokenAdmin(recepcionista) }));
  console.log('token_recepcionista.json listo (id_admin=', recepcionista.id_admin, ')');

  fs.writeFileSync('./_admins_test_ids.json', JSON.stringify([entrenador.id_admin, recepcionista.id_admin]));
  await sequelize.close();
}
main().catch(e => { console.error(e); process.exit(1); });
