import { NextResponse, type NextRequest } from 'next/server';
import { verificarAuthAdmin } from './lib/auth/adminAuth';

// CORS para /api/*: la app Flutter (web/emulador/dispositivo) y la web
// del gimnasio pueden vivir en orígenes distintos al de esta API.
//
// El fix real está en la respuesta al preflight (OPTIONS): antes solo se
// agregaba "Access-Control-Allow-Origin" a las respuestas normales, pero
// nunca se respondía el OPTIONS que el navegador manda primero cuando la
// petición lleva headers como Content-Type/Authorization — esa ruta no
// tenía un handler OPTIONS, así que devolvía 405 y el navegador bloqueaba
// todo antes de llegar a hacer el POST/GET real.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Rutas /api/* que NO requieren sesión de administrativo:
// - /api/cliente/*: tiene su propio JWT (app móvil de clientes, ver
//   src/lib/auth/clienteAuth.js), validado dentro de cada route handler.
// - /api/administrativos/login: es justamente la ruta que entrega el token,
//   no puede exigirlo para sí misma.
// - /api (raíz): healthcheck público, sin datos sensibles.
function requiereSesionAdmin(pathname: string) {
  if (pathname === '/api') return false;
  if (pathname.startsWith('/api/cliente/')) return false;
  if (pathname === '/api/administrativos/login') return false;
  return pathname.startsWith('/api/');
}

export async function middleware(request: NextRequest) {
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  const { pathname } = request.nextUrl;

  if (requiereSesionAdmin(pathname)) {
    const auth = await verificarAuthAdmin(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401, headers: CORS_HEADERS }
      );
    }
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
