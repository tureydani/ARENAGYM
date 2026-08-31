// Migración única e idempotente: hashea con bcrypt cualquier contraseña de
// "administrativos" que todavía esté en texto plano.
//
// Idempotente a propósito: detecta si un valor YA es un hash bcrypt (patrón
// $2a$/$2b$/$2y$ + 60 caracteres) y lo deja intacto, así que se puede volver
// a correr sin riesgo (por ejemplo, si se agregan admins nuevos a mano por
// SQL directo sin pasar por el endpoint de creación, que ya hashea solo).
//
// Uso: node scripts/hash-admin-passwords.js
// (requiere las mismas variables de entorno que usa la app: DB_NAME,
// DB_USER, DB_PASS, DB_HOST, DB_PORT, DB_SSL)

const bcrypt = require('bcryptjs');
const sequelize = require('../src/lib/db/sequelize');
const Administrativo = require('../src/lib/db/models/administrativo');

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$.{53}$/;

async function main() {
  const admins = await Administrativo.unscoped().findAll();

  let migrados = 0;
  let yaHasheados = 0;

  for (const admin of admins) {
    if (BCRYPT_HASH_PATTERN.test(admin.contraseña)) {
      yaHasheados++;
      continue;
    }

    const hash = await bcrypt.hash(admin.contraseña, 10);
    await admin.update({ contraseña: hash });
    migrados++;
    console.log(`✓ Contraseña migrada a hash para el usuario "${admin.usuario}" (id_admin=${admin.id_admin})`);
  }

  console.log(`\nListo. ${migrados} contraseña(s) migrada(s), ${yaHasheados} ya estaban hasheadas.`);
  await sequelize.close();
}

main().catch((error) => {
  console.error('Error al migrar contraseñas:', error);
  process.exit(1);
});
