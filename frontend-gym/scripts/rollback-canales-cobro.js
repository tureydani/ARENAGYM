// Rollback seguro de migrate-canales-cobro.js. NO hace DROP COLUMN a
// ciegas: primero comprueba, usando los max_id_* guardados en
// migraciones_sistema al momento de migrar, si existen pagos/ventas/
// movimientos CREADOS DESPUÉS de la migración que ya tengan canal_cobro
// asignado por la app (es decir, información nueva que se perdería). Si
// encuentra alguno, se niega a continuar y pide reconciliar esos datos
// primero (exportarlos o decidir a qué canal legado equivalen antes de
// quitar la columna).
//
// Uso: node scripts/rollback-canales-cobro.js
//      node scripts/rollback-canales-cobro.js --forzar   (solo si ya reconciliaste manualmente)

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
const forzado = process.argv.includes('--forzar');

async function main() {
  console.log('Conectando a la base de datos...\n');

  const [registros] = await sequelize.query(
    'SELECT * FROM migraciones_sistema WHERE nombre = :nombre',
    { replacements: { nombre: NOMBRE_MIGRACION } }
  );
  if (registros.length === 0) {
    console.log(`La migración "${NOMBRE_MIGRACION}" no está registrada como aplicada. Nada que revertir.`);
    await sequelize.close();
    return;
  }

  const meta = registros[0].metadata;
  console.log('Metadata de la migración aplicada el', registros[0].fecha_aplicada, ':', meta);

  const [[posteriores]] = await sequelize.query(`
    SELECT
      (SELECT COUNT(*) FROM pagos WHERE id_pago > :maxPago AND canal_cobro IS NOT NULL) AS pagos_nuevos_con_canal,
      (SELECT COUNT(*) FROM ventas WHERE id_venta > :maxVenta AND canal_cobro IS NOT NULL) AS ventas_nuevas_con_canal,
      (SELECT COUNT(*) FROM movimientos_caja WHERE id_movimiento > :maxMov AND canal_cobro IS NOT NULL) AS movimientos_nuevos_con_canal
  `, {
    replacements: {
      maxPago: meta.max_id_pago_al_migrar,
      maxVenta: meta.max_id_venta_al_migrar,
      maxMov: meta.max_id_movimiento_al_migrar
    }
  });

  const hayDatosNuevos =
    Number(posteriores.pagos_nuevos_con_canal) > 0 ||
    Number(posteriores.ventas_nuevas_con_canal) > 0 ||
    Number(posteriores.movimientos_nuevos_con_canal) > 0;

  if (hayDatosNuevos && !forzado) {
    console.error('\n⚠ ABORTADO: existen filas creadas DESPUÉS de la migración que ya tienen canal_cobro asignado:');
    console.table(posteriores);
    console.error(
      '\nQuitar la columna ahora perdería esa información. Antes de revertir, exportá/reconciliá esas filas ' +
      '(por ejemplo, decidí a qué "caja legado" equivaldría cada canal_cobro nuevo, o simplemente confirmá que ' +
      'aceptás perder ese dato) y volvé a correr este script con --forzar.'
    );
    await sequelize.close();
    process.exit(1);
  }

  if (hayDatosNuevos && forzado) {
    console.warn('\n⚠ Continuando con --forzar a pesar de que hay datos nuevos con canal_cobro:', posteriores);
  } else {
    console.log('\n✓ No hay datos nuevos con canal_cobro posteriores a la migración. Es seguro revertir.');
  }

  const transaction = await sequelize.transaction();
  try {
    console.log('\nRevirtiendo Bloque D (fecha_apertura -> DATE)...');
    // Con pérdida: si ya se guardó alguna hora real distinta de medianoche
    // después de la migración, DATE la descarta. Documentado en el propio
    // mensaje de confirmación de este script.
    await sequelize.query(
      `ALTER TABLE cajas ALTER COLUMN fecha_apertura TYPE DATE USING fecha_apertura::date`,
      { transaction }
    );

    console.log('Revirtiendo Bloque B/C (columnas canal_cobro)...');
    await sequelize.query(`ALTER TABLE pagos DROP COLUMN IF EXISTS canal_cobro`, { transaction });
    await sequelize.query(`ALTER TABLE ventas DROP COLUMN IF EXISTS canal_cobro`, { transaction });
    await sequelize.query(`ALTER TABLE movimientos_caja DROP COLUMN IF EXISTS canal_cobro`, { transaction });

    console.log('Revirtiendo Bloque A (catálogo canales_cobro)...');
    await sequelize.query(`DROP TABLE IF EXISTS canales_cobro`, { transaction });

    await sequelize.query(
      `DELETE FROM migraciones_sistema WHERE nombre = :nombre`,
      { replacements: { nombre: NOMBRE_MIGRACION }, transaction }
    );

    await transaction.commit();
    console.log('\n✓ Rollback completo.');
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }

  await sequelize.close();
}

main().catch((error) => {
  console.error('Error en el rollback:', error);
  process.exit(1);
});
