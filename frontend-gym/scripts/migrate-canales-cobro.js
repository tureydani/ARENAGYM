// Migración versionada: introduce el catálogo `canales_cobro` y la columna
// `canal_cobro` en pagos/ventas/movimientos_caja (Bloques A, B, C del
// diseño acordado), más la conversión de `cajas.fecha_apertura` a TIMESTAMP
// (Bloque D). Documentada en DB__Gimnasio.txt bajo la misma sección.
//
// Idempotente: si se vuelve a correr, detecta que la migración ya quedó
// registrada en `migraciones_sistema` y no repite el backfill (evita
// pisar canal_cobro en filas nuevas que ya lo traigan asignado por la app).
//
// Uso: node scripts/migrate-canales-cobro.js

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

const NOMBRE_MIGRACION = 'canal_cobro_2026_09';

// Mapeo verificado contra el diagnóstico real (ver conversación): las 4
// cajas existentes son inequívocamente identificables por descripción, no
// hay ninguna que requiera revisión manual.
const MAPEO_CAJA_CANAL = {
  1: 'Efectivo',       // "Efectivo"
  2: 'QR',             // "Qr"
  3: 'Efectivo',       // "PRODUCTOS EFECTIVO"
  4: 'QR'              // "PRODUCTOS QR"
};

const SQL_TABLA_MIGRACIONES = `
CREATE TABLE IF NOT EXISTS migraciones_sistema (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    fecha_aplicada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);
COMMENT ON TABLE migraciones_sistema IS 'Registro de migraciones puntuales (scripts/migrate-*.js) ya aplicadas contra esta base, con metadata para permitir un rollback seguro (ver scripts/rollback-canales-cobro.js).';
`;

// ---- Bloque A: catálogo de canales ----
const SQL_BLOQUE_A = `
CREATE TABLE IF NOT EXISTS canales_cobro (
    codigo VARCHAR(15) PRIMARY KEY,
    nombre VARCHAR(30) NOT NULL,
    orden INT NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);
COMMENT ON TABLE canales_cobro IS 'Catalogo unico de canales de cobro. Referenciado por pagos/ventas/movimientos_caja.canal_cobro. Ampliar un canal nuevo = INSERT aca, no ALTER TABLE en otras tablas.';

INSERT INTO canales_cobro (codigo, nombre, orden) VALUES
  ('Efectivo', 'Efectivo', 1),
  ('QR', 'QR', 2),
  ('Transferencia', 'Transferencia', 3),
  ('Tarjeta', 'Tarjeta', 4)
ON CONFLICT (codigo) DO NOTHING;
`;

// ---- Bloque B: columna canal_cobro ----
const SQL_BLOQUE_B = `
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS canal_cobro VARCHAR(15) REFERENCES canales_cobro(codigo);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS canal_cobro VARCHAR(15) REFERENCES canales_cobro(codigo);
ALTER TABLE movimientos_caja ADD COLUMN IF NOT EXISTS canal_cobro VARCHAR(15) REFERENCES canales_cobro(codigo);

CREATE INDEX IF NOT EXISTS idx_pagos_canal_cobro ON pagos(canal_cobro);
CREATE INDEX IF NOT EXISTS idx_ventas_canal_cobro ON ventas(canal_cobro);
CREATE INDEX IF NOT EXISTS idx_movimientos_caja_canal_cobro ON movimientos_caja(canal_cobro);

COMMENT ON COLUMN pagos.canal_cobro IS 'Canal por el que se cobro esta fila de pago (Efectivo/QR/Transferencia/Tarjeta). En un pago mixto, cada fila tiene su propio canal.';
COMMENT ON COLUMN ventas.canal_cobro IS 'Canal por el que se cobro esta venta.';
COMMENT ON COLUMN movimientos_caja.canal_cobro IS 'Canal afectado por ESTE movimiento puntual (Ingreso o Egreso). Se deriva del id_caja que tenia el movimiento en el momento en que se creo, no del id_caja actual del pago/venta relacionado (que puede haber cambiado despues por una edicion). Un Egreso en Efectivo reduce el efectivo fisico del arqueo; un Egreso en QR/Transferencia/Tarjeta no.';
`;

// ---- Bloque D: fecha_apertura a TIMESTAMP ----
const SQL_BLOQUE_D = `
ALTER TABLE cajas ALTER COLUMN fecha_apertura TYPE TIMESTAMP USING fecha_apertura::timestamp;
COMMENT ON COLUMN cajas.fecha_apertura IS 'Fecha y hora de apertura de la jornada. Para las jornadas creadas antes de esta migracion, la columna era DATE (sin hora): el valor 00:00:00 en esas filas NO es una hora real de apertura, es un artefacto de la conversion de tipo -- solo la fecha es confiable para ese historico. Ver migraciones_sistema.metadata (canal_cobro_2026_09) para la lista exacta de id_caja afectados.';
`;

async function consultarInconsistenciasHistoricas() {
  const [mismatchPago] = await sequelize.query(`
    SELECT COUNT(*)::int AS cantidad
    FROM movimientos_caja m
    JOIN pagos p ON p.id_pago = m.id_referencia
    WHERE m.origen = 'Pago' AND m.id_caja IS DISTINCT FROM p.id_caja
  `);
  const [mismatchVenta] = await sequelize.query(`
    SELECT COUNT(*)::int AS cantidad
    FROM movimientos_caja m
    JOIN ventas v ON v.id_venta = m.id_referencia
    WHERE m.origen = 'Venta' AND m.id_caja IS DISTINCT FROM v.id_caja
  `);
  return {
    movimientos_pago_con_caja_distinta_al_pago_actual: mismatchPago[0].cantidad,
    movimientos_venta_con_caja_distinta_a_la_venta_actual: mismatchVenta[0].cantidad,
    nota: 'Esperado > 0: son el rastro de ediciones de caja/monto en pagos/[id]/route.js (PUT), donde el movimiento historico conserva el id_caja de cuando ocurrio, no el id_caja actual del pago. No es corrupcion de datos; confirmado contra el codigo antes de migrar.'
  };
}

async function main() {
  console.log('Conectando a la base de datos...\n');

  await sequelize.query(SQL_TABLA_MIGRACIONES);

  const [existente] = await sequelize.query(
    'SELECT * FROM migraciones_sistema WHERE nombre = :nombre',
    { replacements: { nombre: NOMBRE_MIGRACION } }
  );
  if (existente.length > 0) {
    console.log(`La migracion "${NOMBRE_MIGRACION}" ya fue aplicada el ${existente[0].fecha_aplicada}. No se repite el backfill.`);
    console.log('Metadata guardada:', JSON.stringify(existente[0].metadata, null, 2));
    await sequelize.close();
    return;
  }

  console.log('=== Bloque A: catálogo canales_cobro ===');
  await sequelize.query(SQL_BLOQUE_A);
  console.log('✓ Tabla canales_cobro creada/poblada.');

  console.log('\n=== Bloque B: columna canal_cobro en pagos/ventas/movimientos_caja ===');
  await sequelize.query(SQL_BLOQUE_B);
  console.log('✓ Columnas + índices + comentarios agregados.');

  console.log('\n=== Chequeo de consistencia histórica (informativo, no bloquea) ===');
  const inconsistencias = await consultarInconsistenciasHistoricas();
  console.log(inconsistencias);

  // IDs máximos ANTES del backfill: sirven para que el rollback pueda
  // distinguir "datos que llegaron por este backfill" de "datos nuevos
  // creados por la app después de la migración" (ver rollback-canales-cobro.js).
  const [[maxIds]] = await sequelize.query(`
    SELECT
      (SELECT COALESCE(MAX(id_pago), 0) FROM pagos) AS max_id_pago,
      (SELECT COALESCE(MAX(id_venta), 0) FROM ventas) AS max_id_venta,
      (SELECT COALESCE(MAX(id_movimiento), 0) FROM movimientos_caja) AS max_id_movimiento
  `);

  console.log('\n=== Bloque C: backfill de canal_cobro (transaccional) ===');
  const transaction = await sequelize.transaction();
  const resultadosBackfill = { pagos: {}, ventas: {}, movimientos_caja: {} };
  try {
    for (const [idCaja, canal] of Object.entries(MAPEO_CAJA_CANAL)) {
      const [, metaPago] = await sequelize.query(
        `UPDATE pagos SET canal_cobro = :canal WHERE id_caja = :idCaja AND canal_cobro IS NULL`,
        { replacements: { canal, idCaja }, transaction }
      );
      const [, metaVenta] = await sequelize.query(
        `UPDATE ventas SET canal_cobro = :canal WHERE id_caja = :idCaja AND canal_cobro IS NULL`,
        { replacements: { canal, idCaja }, transaction }
      );
      const [, metaMov] = await sequelize.query(
        `UPDATE movimientos_caja SET canal_cobro = :canal WHERE id_caja = :idCaja AND canal_cobro IS NULL`,
        { replacements: { canal, idCaja }, transaction }
      );
      resultadosBackfill.pagos[idCaja] = metaPago.rowCount;
      resultadosBackfill.ventas[idCaja] = metaVenta.rowCount;
      resultadosBackfill.movimientos_caja[idCaja] = metaMov.rowCount;
    }

    const [verificacion] = await sequelize.query(
      `SELECT
         (SELECT COUNT(*) FROM pagos WHERE canal_cobro IS NULL) AS pagos_sin_canal,
         (SELECT COUNT(*) FROM ventas WHERE canal_cobro IS NULL) AS ventas_sin_canal,
         (SELECT COUNT(*) FROM movimientos_caja WHERE canal_cobro IS NULL) AS movimientos_sin_canal`,
      { transaction }
    );
    const { pagos_sin_canal, ventas_sin_canal, movimientos_sin_canal } = verificacion[0];
    if (Number(pagos_sin_canal) > 0 || Number(ventas_sin_canal) > 0 || Number(movimientos_sin_canal) > 0) {
      throw new Error(
        `Backfill incompleto: pagos_sin_canal=${pagos_sin_canal}, ventas_sin_canal=${ventas_sin_canal}, movimientos_sin_canal=${movimientos_sin_canal}. Se revierte la transacción.`
      );
    }

    console.log('✓ Backfill aplicado, sin filas sin canal:', resultadosBackfill);

    console.log('\n=== Bloque D: cajas.fecha_apertura -> TIMESTAMP ===');
    await sequelize.query(SQL_BLOQUE_D, { transaction });
    console.log('✓ Columna convertida.');

    const cajasSinHoraReal = [1, 2, 3, 4]; // las 4 filas existentes antes de esta migración

    await sequelize.query(
      `INSERT INTO migraciones_sistema (nombre, metadata) VALUES (:nombre, :metadata)`,
      {
        replacements: {
          nombre: NOMBRE_MIGRACION,
          metadata: JSON.stringify({
            mapeo_caja_canal: MAPEO_CAJA_CANAL,
            filas_backfill: resultadosBackfill,
            inconsistencias_historicas_documentadas: inconsistencias,
            max_id_pago_al_migrar: maxIds.max_id_pago,
            max_id_venta_al_migrar: maxIds.max_id_venta,
            max_id_movimiento_al_migrar: maxIds.max_id_movimiento,
            cajas_sin_hora_real_de_apertura: cajasSinHoraReal,
            bloques_aplicados: ['A', 'B', 'C', 'D']
          })
        },
        transaction
      }
    );

    await transaction.commit();
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }

  console.log('\n=== Verificación final: conteo y montos por canal ===');
  for (const tabla of ['pagos', 'ventas', 'movimientos_caja']) {
    const [filas] = await sequelize.query(`
      SELECT canal_cobro, COUNT(*) AS cantidad,
             SUM(${tabla === 'pagos' ? 'monto_pagado' : tabla === 'ventas' ? 'total' : 'monto'}) AS suma_montos
      FROM ${tabla}
      GROUP BY canal_cobro
      ORDER BY canal_cobro
    `);
    console.log(`\n-- ${tabla} --`);
    console.table(filas);
  }

  console.log('\n=== Estado final de las cajas ===');
  const [cajas] = await sequelize.query('SELECT id_caja, descripcion, estado, fecha_apertura, saldo_inicial, saldo_actual FROM cajas ORDER BY id_caja');
  console.table(cajas);

  console.log('\n=== Estructura final (columnas relevantes) ===');
  const [estructura] = await sequelize.query(`
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE (table_name IN ('pagos','ventas','movimientos_caja') AND column_name = 'canal_cobro')
       OR (table_name = 'cajas' AND column_name = 'fecha_apertura')
       OR table_name = 'canales_cobro'
    ORDER BY table_name, column_name
  `);
  console.table(estructura);

  await sequelize.close();
  console.log('\nListo.');
}

main().catch((error) => {
  console.error('Error en la migración:', error);
  process.exit(1);
});
