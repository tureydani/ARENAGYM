// Migración versionada del módulo Finanzas: rol en administrativos +
// fondos + movimientos_financieros + catálogos. Idempotente (registrada
// en migraciones_sistema). No toca cajas/pagos/ventas/movimientos_caja.
//
// Uso: node scripts/migrate-finanzas.js
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

const NOMBRE_MIGRACION = 'finanzas_2026_09';

const SQL = `
-- ==========================================================
-- ROLES (solo para Finanzas por ahora; el resto del sistema no los
-- valida todavia -- ver DB__Gimnasio.txt para el detalle de esta
-- decision).
-- ==========================================================
ALTER TABLE administrativos ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'ADMIN';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_administrativos_rol') THEN
    ALTER TABLE administrativos ADD CONSTRAINT chk_administrativos_rol
      CHECK (rol IN ('SUPER_ADMIN', 'ADMIN', 'RECEPCIONISTA', 'ENTRENADOR'));
  END IF;
END $$;
COMMENT ON COLUMN administrativos.rol IS 'Rol del administrativo. Introducido para el modulo Finanzas (ver api/finanzas/*), que es el unico que hoy lo valida en el backend. El resto de endpoints del sistema no distinguen por rol todavia -- cualquier admin autenticado los usa igual que antes.';

-- ==========================================================
-- CATALOGOS (mismo patron que canales_cobro: ampliar = INSERT, no ALTER)
-- ==========================================================
CREATE TABLE IF NOT EXISTS tipos_fondo (
    codigo VARCHAR(30) PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    orden INT NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO tipos_fondo (codigo, nombre, orden) VALUES
  ('CAJA_FISICA', 'Caja física', 1),
  ('BANCO', 'Banco', 2),
  ('CUENTA_QR', 'Cuenta QR', 3),
  ('TARJETA_POR_COBRAR', 'Tarjeta por cobrar', 4),
  ('OTRO', 'Otro', 5)
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE IF NOT EXISTS categorias_financieras (
    codigo VARCHAR(40) PRIMARY KEY,
    nombre VARCHAR(60) NOT NULL,
    -- AMBOS: categorías estructurales que existen tanto del lado INGRESO
    -- como EGRESO (transferencia, anulación) -- el signo real lo decide
    -- movimientos_financieros.tipo en cada fila, esto es solo la etiqueta.
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('INGRESO', 'EGRESO', 'AMBOS')),
    orden INT NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO categorias_financieras (codigo, nombre, tipo, orden) VALUES
  ('SALDO_INICIAL', 'Saldo inicial', 'INGRESO', 1),
  ('APORTE', 'Aporte', 'INGRESO', 2),
  ('COBRO', 'Cobro', 'INGRESO', 3),
  ('RECUPERACION', 'Recuperación', 'INGRESO', 4),
  ('OTRO_INGRESO', 'Otro ingreso', 'INGRESO', 5),
  ('PROVEEDOR', 'Proveedor', 'EGRESO', 6),
  ('COMPRA', 'Compra', 'EGRESO', 7),
  ('SERVICIOS', 'Servicios', 'EGRESO', 8),
  ('MANTENIMIENTO', 'Mantenimiento', 'EGRESO', 9),
  ('RETIRO_PROPIETARIO', 'Retiro propietario', 'EGRESO', 10),
  ('GASTO_OPERATIVO', 'Gasto operativo', 'EGRESO', 11),
  ('OTRO_EGRESO', 'Otro egreso', 'EGRESO', 12),
  ('TRANSFERENCIA', 'Transferencia entre fondos', 'AMBOS', 13),
  ('ANULACION', 'Anulación / reversión', 'AMBOS', 14),
  ('CIERRE_JORNADA', 'Efectivo de cierre de jornada', 'INGRESO', 15)
ON CONFLICT (codigo) DO NOTHING;

-- ==========================================================
-- FONDOS
-- ==========================================================
CREATE TABLE IF NOT EXISTS fondos (
    id_fondo SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    tipo_fondo VARCHAR(30) NOT NULL REFERENCES tipos_fondo(codigo),
    descripcion TEXT,
    saldo_actual DECIMAL(12,2) NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_admin_creacion INT REFERENCES administrativos(id_admin)
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fondos_saldo_no_negativo') THEN
    ALTER TABLE fondos ADD CONSTRAINT chk_fondos_saldo_no_negativo CHECK (saldo_actual >= 0);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_fondos_nombre_activo ON fondos (nombre) WHERE activo = TRUE;
COMMENT ON TABLE fondos IS 'Representa DONDE esta el dinero de la empresa (caja fisica, banco, cuenta QR...). No confundir con cajas/jornadas: una jornada es un periodo de cobro, un fondo es una ubicacion de dinero persistente entre jornadas.';
COMMENT ON COLUMN fondos.saldo_actual IS 'Mantenido incrementalmente por movimientos_financieros (igual que cajas.saldo_actual) -- nunca se escribe directo desde el frontend.';

-- ==========================================================
-- MOVIMIENTOS FINANCIEROS
-- ==========================================================
CREATE TABLE IF NOT EXISTS movimientos_financieros (
    id_movimiento SERIAL PRIMARY KEY,
    id_fondo INT NOT NULL REFERENCES fondos(id_fondo),
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('INGRESO', 'EGRESO')),
    categoria VARCHAR(40) NOT NULL REFERENCES categorias_financieras(codigo),
    descripcion TEXT,
    monto DECIMAL(12,2) NOT NULL CHECK (monto > 0),
    fecha_movimiento TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_admin INT NOT NULL REFERENCES administrativos(id_admin),
    origen VARCHAR(20) NOT NULL CHECK (origen IN ('SALDO_INICIAL', 'MANUAL', 'TRANSFERENCIA', 'CIERRE_JORNADA', 'ANULACION')),
    id_referencia INT,
    id_jornada INT REFERENCES cajas(id_caja),
    id_transferencia INT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    motivo_anulacion TEXT,
    fecha_anulacion TIMESTAMP,
    id_admin_anulacion INT REFERENCES administrativos(id_admin)
);
CREATE INDEX IF NOT EXISTS idx_movfin_fondo ON movimientos_financieros(id_fondo);
CREATE INDEX IF NOT EXISTS idx_movfin_fecha ON movimientos_financieros(fecha_movimiento);
CREATE INDEX IF NOT EXISTS idx_movfin_jornada ON movimientos_financieros(id_jornada);
CREATE INDEX IF NOT EXISTS idx_movfin_transferencia ON movimientos_financieros(id_transferencia);
CREATE INDEX IF NOT EXISTS idx_movfin_categoria ON movimientos_financieros(categoria);
CREATE INDEX IF NOT EXISTS idx_movfin_origen ON movimientos_financieros(origen);

COMMENT ON TABLE movimientos_financieros IS 'Movimientos de los fondos de la empresa. Una TRANSFERENCIA son 2 filas (EGRESO en origen, INGRESO en destino) que comparten id_transferencia = id_movimiento de la fila EGRESO. id_jornada + origen=CIERRE_JORNADA vincula un movimiento con la jornada de la que salio el efectivo contado, sin duplicar el dato: el monto de la jornada sigue viviendo solo en movimientos_caja, este movimiento es la decision explicita de "que se hizo con ese efectivo despues".';
COMMENT ON COLUMN movimientos_financieros.origen IS 'SALDO_INICIAL (alta de fondo), MANUAL (ingreso/egreso suelto), TRANSFERENCIA (par de filas), CIERRE_JORNADA (efectivo contado de una jornada trasladado a un fondo), ANULACION (fila de reversion generada al anular otro movimiento).';
COMMENT ON COLUMN movimientos_financieros.id_referencia IS 'Para ANULACION: id_movimiento del movimiento que se esta revirtiendo. Reservado para futuras integraciones (ej. gasto ligado a una compra de productos).';
COMMENT ON COLUMN movimientos_financieros.activo IS 'TRUE = vigente. Anular un movimiento pone esto en FALSE Y crea una fila de reversion (origen=ANULACION) -- nunca se borra fisicamente ni se reescribe el monto original.';
`;

async function main() {
  console.log('Conectando...');
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS migraciones_sistema (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) UNIQUE NOT NULL,
        fecha_aplicada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB
    );
  `);
  const [existente] = await sequelize.query('SELECT * FROM migraciones_sistema WHERE nombre = :n', { replacements: { n: NOMBRE_MIGRACION } });
  if (existente.length > 0) {
    console.log(`Ya aplicada el ${existente[0].fecha_aplicada}.`);
    await sequelize.close();
    return;
  }

  await sequelize.query(SQL);
  console.log('✓ Rol + catálogos + fondos + movimientos_financieros creados.');

  const [adminsAntes] = await sequelize.query(`SELECT id_admin, rol FROM administrativos ORDER BY id_admin`);
  await sequelize.query(
    `INSERT INTO migraciones_sistema (nombre, metadata) VALUES (:n, :m)`,
    { replacements: { n: NOMBRE_MIGRACION, m: JSON.stringify({ administrativos_rol_default: adminsAntes, bloques: ['rol', 'tipos_fondo', 'categorias_financieras', 'fondos', 'movimientos_financieros'] }) } }
  );

  console.log('\n=== Administrativos (rol por defecto = ADMIN para todos, no se adivinó nadie como SUPER_ADMIN/RECEPCIONISTA/ENTRENADOR) ===');
  console.table(adminsAntes);

  const [estructura] = await sequelize.query(`
    SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE table_name IN ('fondos','movimientos_financieros','tipos_fondo','categorias_financieras')
       OR (table_name='administrativos' AND column_name='rol')
    ORDER BY table_name, ordinal_position
  `);
  console.log('\n=== Estructura creada ===');
  console.table(estructura);

  await sequelize.close();
  console.log('\nListo.');
}
main().catch(e => { console.error(e); process.exit(1); });
