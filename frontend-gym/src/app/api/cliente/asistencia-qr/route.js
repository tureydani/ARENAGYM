import { NextResponse } from 'next/server';
import { verificarAuth, firmarTokenAsistencia } from '@/lib/auth/clienteAuth';
import { Usuario } from '@/lib/db/models';

// La app pide este token cada vez que el cliente abre la pantalla de "mi QR"
// (y lo vuelve a pedir automáticamente antes de que expire). Dura solo 2
// minutos: es intencional, ver la nota en clienteAuth.js.
export async function GET(request) {
  const auth = verificarAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const usuario = await Usuario.findOne({ where: { id_usuario: auth.id_usuario, activo: true } });
    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const token = firmarTokenAsistencia(usuario);
    return NextResponse.json({ token, expiraEnSegundos: 120 });
  } catch (error) {
    console.error('Error al generar QR de asistencia:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
