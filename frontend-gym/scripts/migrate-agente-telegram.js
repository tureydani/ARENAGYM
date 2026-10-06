// Migración única e idempotente: agrega usuarios.telegram_user_id y crea
// las tablas conversaciones/mensajes para el agente de atención al cliente
// (canal Telegram). Es el mismo SQL de add_agente_telegram_tables.sql en la
// raíz del repo, puesto acá para poder ejecutarlo con un solo comando.
//
// Uso: node scripts/migrate-agente-telegram.js
// (lee las mismas variables de entorno que usa la app desde .env.local,
// ya que un script de Node suelto no las carga automáticamente como sí
// hace `next dev`/`next build`)

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

const SQL = `
ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_usuarios_telegram_user_id
    ON usuarios(telegram_user_id);

CREATE TABLE IF NOT EXISTS conversaciones (
    id_conversacion SERIAL PRIMARY KEY,
    canal VARCHAR(20) NOT NULL DEFAULT 'telegram',
    chat_id BIGINT NOT NULL,
    id_usuario INT,
    estado VARCHAR(20) NOT NULL DEFAULT 'activa'
        CHECK (estado IN ('activa', 'esperando_humano', 'cerrada')),
    fecha_inicio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_ultimo_mensaje TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_conversacion_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
);
CREATE INDEX IF NOT EXISTS idx_conversaciones_chat ON conversaciones(canal, chat_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_estado ON conversaciones(estado);
CREATE INDEX IF NOT EXISTS idx_conversaciones_usuario ON conversaciones(id_usuario);

CREATE TABLE IF NOT EXISTS mensajes (
    id_mensaje SERIAL PRIMARY KEY,
    id_conversacion INT NOT NULL,
    emisor VARCHAR(10) NOT NULL CHECK (emisor IN ('cliente', 'agente', 'humano')),
    contenido TEXT NOT NULL,
    fecha_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mensaje_conversacion
        FOREIGN KEY (id_conversacion)
        REFERENCES conversaciones(id_conversacion)
        ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mensajes_conversacion ON mensajes(id_conversacion);
CREATE INDEX IF NOT EXISTS idx_mensajes_fecha ON mensajes(fecha_hora);
`;

async function main() {
  console.log('Conectando a la base de datos...');

  await sequelize.query(SQL);

  console.log('✓ Columna usuarios.telegram_user_id agregada (o ya existía).');
  console.log('✓ Tablas conversaciones y mensajes creadas (o ya existían).');
  console.log('✓ Índices creados (o ya existían).');

  const [[{ columna_existe }]] = await sequelize.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = 'usuarios' AND column_name = 'telegram_user_id'
     ) AS columna_existe`
  );
  const [[{ existen_tablas }]] = await sequelize.query(
    `SELECT COUNT(*) = 2 AS existen_tablas
     FROM information_schema.tables
     WHERE table_name IN ('conversaciones', 'mensajes')`
  );

  console.log(`\nVerificación: columna telegram_user_id = ${columna_existe}, tablas creadas = ${existen_tablas}`);

  await sequelize.close();
  console.log('\nListo.');
}

main().catch((error) => {
  console.error('Error al migrar agente/telegram:', error);
  process.exit(1);
});
