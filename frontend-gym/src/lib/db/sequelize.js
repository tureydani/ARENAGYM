const { Sequelize } = require('sequelize');

// Sequelize elige el driver del dialecto ('pg') de forma dinámica en tiempo
// de ejecución a partir de un string, así que el tracer de dependencias de
// Vercel (@vercel/nft) no puede detectar ese require() y no incluye 'pg' en
// el bundle de la función serverless ("Please install pg package manually").
// Forzamos un require() estático y directo para que sí quede registrado
// como dependencia real de este archivo.
require('pg');

// En serverless (Vercel), cada invocación puede reutilizar el contenedor entre
// llamadas "calientes". Cacheamos la instancia en globalThis para no crear una
// nueva conexión/pool en cada invocación (mismo patrón recomendado por Next.js
// para reutilizar clientes de base de datos entre recargas / invocaciones).
const globalForSequelize = globalThis;

function createSequelize() {
  return new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: false,
      dialectOptions: process.env.DB_SSL === 'true'
        ? { ssl: { require: true, rejectUnauthorized: false } }
        : {},
      // Cada invocación serverless es su propio proceso: no necesita (ni debe)
      // mantener un pool grande de conexiones propio. Con el Session Pooler de
      // Supabase (límite bajo, ej. 15 conexiones totales) muchas invocaciones
      // concurrentes agotaban ese límite ("max clients reached in session
      // mode"). Se recomienda además usar el Transaction Pooler (puerto 6543)
      // en vez del Session Pooler (5432) para este tipo de carga.
      pool: {
        max: 2,
        min: 0,
        acquire: 30000,
        idle: 5000,
      },
    }
  );
}

const sequelize = globalForSequelize.__sequelize || createSequelize();

if (!globalForSequelize.__sequelize) {
  globalForSequelize.__sequelize = sequelize;
}

module.exports = sequelize;
