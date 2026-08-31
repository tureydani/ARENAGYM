import jwt from 'jsonwebtoken';

// OJO: no leer/validar process.env.CLIENTE_JWT_SECRET a nivel de módulo.
// Next.js evalúa (importa) los route handlers durante "next build" para
// recolectar metadata de cada página/ruta, incluso sin invocar el
// handler — si esta validación estuviera en el top-level y la variable
// de entorno no estuviera disponible en tiempo de build, el build entero
// fallaría con "Failed to collect page data". Se valida de forma
// perezosa, dentro de cada función, para que solo falle en runtime si
// de verdad se intenta firmar/verificar un token sin el secreto configurado.
function getSecret() {
  const SECRET = process.env.CLIENTE_JWT_SECRET;
  if (!SECRET) {
    throw new Error('Falta la variable de entorno CLIENTE_JWT_SECRET');
  }
  return SECRET;
}

export function firmarToken(usuario) {
  return jwt.sign(
    { id_usuario: usuario.id_usuario, email: usuario.email },
    getSecret(),
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
    return jwt.verify(token, getSecret());
  } catch {
    return null;
  }
}
