import { SignJWT, jwtVerify } from 'jose';

// Secreto exclusivo para sesiones administrativas (distinto de
// CLIENTE_JWT_SECRET, que es de la app móvil de clientes). Usamos "jose" en
// vez de "jsonwebtoken" porque este módulo también se importa desde
// middleware.ts, que corre en el Edge Runtime (sin las APIs de Node que
// "jsonwebtoken" necesita) — "jose" funciona igual en Node y en Edge.
function getSecretKey() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error('Falta la variable de entorno ADMIN_JWT_SECRET');
  }
  return new TextEncoder().encode(secret);
}

// Sesión de 12 horas: suficiente para una jornada de trabajo sin dejar
// tokens robados utilizables por días.
const DURACION_SESION = '12h';

export async function firmarTokenAdmin(admin) {
  return new SignJWT({
    id_admin: admin.id_admin,
    usuario: admin.usuario,
    nombre: admin.nombre,
    apellido: admin.apellido,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(DURACION_SESION)
    .sign(getSecretKey());
}

// Extrae y valida el Bearer token de la request. Devuelve el payload
// decodificado ({ id_admin, usuario, ... }) o null si no hay token / es
// inválido / expiró.
export async function verificarAuthAdmin(request) {
  const header = request.headers.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload;
  } catch {
    return null;
  }
}
