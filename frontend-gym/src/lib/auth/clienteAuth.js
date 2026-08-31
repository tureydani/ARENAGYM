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

// Token de vida muy corta (2 minutos) que la app codifica en el QR para
// marcar asistencia. Vida corta a propósito: limita la ventana en la que
// una captura de pantalla del QR de otra persona podría reutilizarse.
// Se distingue de un token de sesión normal con "tipo: asistencia" para
// que el endpoint de registro no acepte por error un token de sesión de
// 30 días como si fuera un QR de asistencia.
export function firmarTokenAsistencia(usuario) {
  return jwt.sign(
    { id_usuario: usuario.id_usuario, tipo: 'asistencia' },
    getSecret(),
    { expiresIn: '2m' }
  );
}

// Verifica un token de QR de asistencia. Devuelve el id_usuario si es
// válido, no expiró y es realmente un token de este tipo; null si no.
export function verificarTokenAsistencia(token) {
  try {
    const payload = jwt.verify(token, getSecret());
    if (payload.tipo !== 'asistencia') return null;
    return payload.id_usuario;
  } catch {
    return null;
  }
}
