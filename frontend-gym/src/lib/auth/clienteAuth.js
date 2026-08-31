import jwt from 'jsonwebtoken';

const SECRET = process.env.CLIENTE_JWT_SECRET;

if (!SECRET) {
  // Falla rápido y claro en vez de firmar tokens con "undefined".
  throw new Error('Falta la variable de entorno CLIENTE_JWT_SECRET');
}

export function firmarToken(usuario) {
  return jwt.sign(
    { id_usuario: usuario.id_usuario, email: usuario.email },
    SECRET,
    { expiresIn: '30d' }
  );
}

// Extrae y valida el Bearer token de la request. Devuelve el payload
// decodificado ({ id_usuario, email }) o null si no hay token / es inválido.
export function verificarAuth(request) {
  const header = request.headers.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) return null;

  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}
