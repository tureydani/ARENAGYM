// Actualiza (CREATE OR REPLACE FUNCTION, no toca los triggers en sí) las
// funciones reflejar_pago_en_caja / reflejar_venta_en_caja para que el
// movimiento_caja que generan automáticamente incluya NEW.canal_cobro.
// No crea triggers nuevos, no duplica los existentes, no toca los
// triggers de reversión (siguen sin instalarse).
//
// Requiere haber corrido antes scripts/migrate-canales-cobro.js (columna
// canal_cobro debe existir en pagos/ventas/movimientos_caja).
//
// Uso: node scripts/migrate-triggers-canal-cobro.js

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
CREATE OR REPLACE FUNCTION reflejar_pago_en_caja()
RETURNS TRIGGER AS $$
DECLARE
    nombre_cliente TEXT;
BEGIN
    SELECT u.nombre || ' ' || u.apellido INTO nombre_cliente
    FROM usuarios u
    JOIN registro_membresias r ON r.id_usuario = u.id_usuario
    WHERE r.id_registro = NEW.id_registro;

    UPDATE cajas
    SET saldo_actual = saldo_actual + NEW.monto_pagado
    WHERE id_caja = NEW.id_caja;

    INSERT INTO movimientos_caja (id_caja, id_admin, tipo_movimiento, descripcion, monto, origen, id_referencia, canal_cobro)
    VALUES (NEW.id_caja, NEW.id_admin, 'Ingreso', 'Pago de membresía de ' || nombre_cliente, NEW.monto_pagado, 'Pago', NEW.id_pago, NEW.canal_cobro);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reflejar_venta_en_caja()
RETURNS TRIGGER AS $$
DECLARE
    nombre_cliente TEXT;
BEGIN
    SELECT u.nombre || ' ' || u.apellido INTO nombre_cliente
    FROM usuarios u
    WHERE u.id_usuario = NEW.id_usuario;

    UPDATE cajas
    SET saldo_actual = saldo_actual + NEW.total
    WHERE id_caja = NEW.id_caja;

    INSERT INTO movimientos_caja (id_caja, id_admin, tipo_movimiento, descripcion, monto, origen, id_referencia, canal_cobro)
    VALUES (NEW.id_caja, NEW.id_admin, 'Ingreso', 'Venta de productos a ' || nombre_cliente, NEW.total, 'Venta', NEW.id_venta, NEW.canal_cobro);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;

const NOMBRE_MIGRACION = 'triggers_canal_cobro_2026_09';

async function main() {
  console.log('Conectando a la base de datos...\n');

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS migraciones_sistema (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) UNIQUE NOT NULL,
        fecha_aplicada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB
    );
  `);

  const [existente] = await sequelize.query(
    'SELECT * FROM migraciones_sistema WHERE nombre = :nombre',
    { replacements: { nombre: NOMBRE_MIGRACION } }
  );
  if (existente.length > 0) {
    console.log(`Ya aplicada el ${existente[0].fecha_aplicada}. Se vuelve a aplicar igual (CREATE OR REPLACE es idempotente) por si el código cambió, pero no se duplica el registro.`);
  }

  await sequelize.query(SQL);
  console.log('✓ Funciones reflejar_pago_en_caja / reflejar_venta_en_caja actualizadas (mismos triggers, ninguno nuevo).');

  if (existente.length === 0) {
    await sequelize.query(
      `INSERT INTO migraciones_sistema (nombre, metadata) VALUES (:nombre, :metadata)`,
      { replacements: { nombre: NOMBRE_MIGRACION, metadata: JSON.stringify({ funciones: ['reflejar_pago_en_caja', 'reflejar_venta_en_caja'] }) } }
    );
  }

  // Verificación: confirmar que el trigger sigue habiendo exactamente uno
  // por tabla/evento (no se duplicó nada).
  const [triggers] = await sequelize.query(`
    SELECT event_object_table, trigger_name, action_timing, event_manipulation
    FROM information_schema.triggers
    WHERE event_object_table IN ('pagos', 'ventas')
    ORDER BY event_object_table, trigger_name
  `);
  console.log('\nTriggers instalados actualmente sobre pagos/ventas:');
  console.table(triggers);

  await sequelize.close();
  console.log('\nListo.');
}

main().catch((error) => {
  console.error('Error al actualizar triggers:', error);
  process.exit(1);
});
