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
const { firmarTokenAdmin } = require('../src/lib/auth/adminAuth');
const { Administrativo } = require('../src/lib/db/models');
const sequelize = require('../src/lib/db/sequelize');

(async () => {
  const admin = await Administrativo.findOne();
  const token = await firmarTokenAdmin(admin);
  console.log(JSON.stringify({ id_admin: admin.id_admin, token }));
  await sequelize.close();
})();
