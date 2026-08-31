import { NextResponse, type NextRequest } from 'next/server';

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

export function middleware(request: NextRequest) {
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
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
