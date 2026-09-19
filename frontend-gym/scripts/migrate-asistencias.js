// Migración única e idempotente: agrega a "asistencias" las columnas
// metodo/id_admin/observacion/activo/fecha_actualizacion y crea la tabla
// auditoria_asistencias, para el módulo profesional de Control de
// Asistencias. Es exactamente el mismo SQL documentado en DB__Gimnasio.txt
// (sección "MÓDULO DE CONTROL DE ASISTENCIAS..."), puesto acá para poder
// ejecutarlo con un solo comando en vez de copiarlo a mano al editor SQL.
//
// Uso: node scripts/migrate-asistencias.js
// (lee las mismas variables de entorno que usa la app desde .env.local,
// ya que un script de Node suelto no las carga automáticamente como sí
// hace `next dev`/`next build`)

const fs = require('fs');
const path = require('path');

// Carga manual de .env.local (no hay `dotenv` instalado en el proyecto y
// no queremos agregar una dependencia nueva solo para esto).
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
ALTER TABLE asistencias
ADD COLUMN IF NOT EXISTS metodo VARCHAR(10) NOT NULL DEFAULT 'Manual',
ADD COLUMN IF NOT EXISTS id_admin INT REFERENCES administrativos(id_admin),
ADD COLUMN IF NOT EXISTS observacion TEXT,
ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_asistencias_metodo'
  ) THEN
    ALTER TABLE asistencias ADD CONSTRAINT chk_asistencias_metodo CHECK (metodo IN ('QR', 'Manual'));
  END IF;
END $$;

UPDATE asistencias SET metodo = 'Manual' WHERE metodo IS NULL;
UPDATE asistencias SET activo = TRUE WHERE activo IS NULL;

CREATE INDEX IF NOT EXISTS idx_asistencias_usuario ON asistencias(id_usuario);
CREATE INDEX IF NOT EXISTS idx_asistencias_registro ON asistencias(id_registro);
CREATE INDEX IF NOT EXISTS idx_asistencias_fecha ON asistencias(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_asistencias_metodo ON asistencias(metodo);
CREATE INDEX IF NOT EXISTS idx_asistencias_activo ON asistencias(activo);
CREATE INDEX IF NOT EXISTS idx_asistencias_admin ON asistencias(id_admin);

CREATE TABLE IF NOT EXISTS auditoria_asistencias (
    id_auditoria SERIAL PRIMARY KEY,
    id_asistencia INT NOT NULL REFERENCES asistencias(id_asistencia),
    id_admin INT REFERENCES administrativos(id_admin),
    accion VARCHAR(20) NOT NULL CHECK (accion IN ('CREACION', 'EDICION', 'ANULACION', 'REACTIVACION')),
    fecha_accion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    motivo TEXT,
    datos_anteriores JSONB,
    datos_nuevos JSONB
);

CREATE INDEX IF NOT EXISTS idx_auditoria_asistencias_asistencia ON auditoria_asistencias(id_asistencia);
CREATE INDEX IF NOT EXISTS idx_auditoria_asistencias_fecha ON auditoria_asistencias(fecha_accion);
CREATE INDEX IF NOT EXISTS idx_auditoria_asistencias_admin ON auditoria_asistencias(id_admin);
`;

async function main() {
  console.log('Conectando a la base de datos...');

  const [countAntes] = await sequelize.query(
    "SELECT COUNT(*) FILTER (WHERE id_registro IS NULL) as sin_registro, COUNT(*) as total FROM asistencias"
  );
  console.log(`Asistencias existentes: ${countAntes[0].total} (${countAntes[0].sin_registro} sin id_registro)`);

  await sequelize.query(SQL);

  console.log('✓ Columnas metodo/id_admin/observacion/activo/fecha_actualizacion agregadas a asistencias (o ya existían).');
  console.log('✓ Tabla auditoria_asistencias creada (o ya existía).');
  console.log('✓ Índices creados (o ya existían).');

  const [resumen] = await sequelize.query(
    "SELECT metodo, activo, COUNT(*) as cantidad FROM asistencias GROUP BY metodo, activo ORDER BY metodo, activo"
  );
  console.log('\nResumen de asistencias tras la migración:');
  for (const fila of resumen) {
    console.log(`  metodo=${fila.metodo} activo=${fila.activo} -> ${fila.cantidad}`);
  }

  await sequelize.close();
  console.log('\nListo.');
}

main().catch((error) => {
  console.error('Error al migrar asistencias:', error);
  process.exit(1);
});
