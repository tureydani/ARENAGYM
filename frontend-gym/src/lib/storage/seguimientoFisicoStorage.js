import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Storage de las fotos del módulo de Seguimiento físico, en un bucket
// PRIVADO de Supabase Storage.
//
// Por qué Supabase Storage (y no disco local, que es lo que usaba esto
// antes): el backend se despliega en Vercel, cuyas funciones serverless
// tienen un filesystem de solo lectura (salvo /tmp, que es efímero y no se
// comparte entre invocaciones) -- escribir en disco funcionaba en
// `next dev` local pero se rompe en producción. Supabase Storage usa el
// mismo proyecto que ya aloja la base de datos (ver sequelize.js), así que
// no se agrega un proveedor nuevo.
//
// Nunca se expone una URL pública: el bucket es privado y las fotos solo
// se leen a través de GET /api/cliente/progresos/:id/fotos/:fotoId, que
// verifica que el progreso pertenezca al usuario autenticado antes de
// descargar los bytes del bucket.

const BUCKET = 'seguimiento-fisico';

function obtenerCliente() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      'Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno -- requeridas para el storage de fotos ' +
      '(ver Project Settings > API en el dashboard de Supabase; la service role key es necesaria porque el ' +
      'bucket es privado y el servidor necesita leer/escribir sin pasar por RLS).'
    );
  }
  // Se recrea por invocación en vez de cachear en globalThis (como
  // sequelize.js): el cliente de supabase-js no mantiene una conexión
  // persistente como un pool de BD, así que no hay el mismo costo de
  // reconexión que justifique cachearlo.
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

let bucketVerificado = false;

/** Crea el bucket privado si todavía no existe. Idempotente. */
async function asegurarBucket(supabase) {
  if (bucketVerificado) return;
  const { data, error } = await supabase.storage.getBucket(BUCKET);
  if (!data && error) {
    const { error: errorCreacion } = await supabase.storage.createBucket(BUCKET, { public: false });
    // Si otra invocación concurrente ya lo creó justo antes, Supabase
    // responde con un error de "ya existe" -- no es un fallo real.
    if (errorCreacion && !/already exists/i.test(errorCreacion.message || '')) {
      throw errorCreacion;
    }
  }
  bucketVerificado = true;
}

/**
 * Sube una fotografía recibida como Buffer y devuelve la ruta relativa
 * dentro del bucket (la misma que se guarda en fotos_progreso.url_foto)
 * para poder leerla después con leerFoto().
 */
async function guardarFoto({ idUsuario, idProgreso, tipo, extension, buffer }) {
  const idUsuarioSeguro = Number(idUsuario);
  const idProgresoSeguro = Number(idProgreso);
  if (!Number.isInteger(idUsuarioSeguro) || !Number.isInteger(idProgresoSeguro)) {
    throw new Error('idUsuario/idProgreso inválidos para guardar la foto');
  }

  const tipoSeguro = /^[a-z_]+$/.test(tipo) ? tipo : 'foto';
  const extensionSegura = /^[a-z0-9]{2,5}$/i.test(extension || '') ? extension : 'jpg';
  const nombreArchivo = `${tipoSeguro}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${extensionSegura}`;
  const rutaRelativa = `${idUsuarioSeguro}/${idProgresoSeguro}/${nombreArchivo}`;

  const supabase = obtenerCliente();
  await asegurarBucket(supabase);

  const { error } = await supabase.storage.from(BUCKET).upload(rutaRelativa, buffer, {
    contentType: `image/${extensionSegura === 'jpg' ? 'jpeg' : extensionSegura}`,
    upsert: false,
  });
  if (error) throw error;

  return rutaRelativa;
}

/**
 * Lee una fotografía a partir de su ruta relativa (fotos_progreso.url_foto)
 * y devuelve un Buffer. La autorización real -- que la foto pertenezca al
 * usuario -- la hace el endpoint consultando fotos_progreso/progresos
 * antes de llamar a esta función, no esta función en sí.
 */
async function leerFoto(rutaRelativa) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase.storage.from(BUCKET).download(rutaRelativa);
  if (error) throw error;
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function eliminarFoto(rutaRelativa) {
  try {
    const supabase = obtenerCliente();
    await supabase.storage.from(BUCKET).remove([rutaRelativa]);
  } catch {
    // Best-effort: si falla la limpieza de un archivo huérfano no debe
    // tumbar la respuesta del endpoint que la llamó.
  }
}

export { guardarFoto, leerFoto, eliminarFoto, BUCKET };
