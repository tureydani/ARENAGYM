import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Usuario } from '@/lib/db/models';

// Primera activación de la cuenta de app para un cliente ya existente
// (dado de alta por un administrativo en el panel web, sin password_hash
// todavía). Solo funciona una vez: si ya tiene password_hash, hay que
// usar el flujo de "olvidé mi contraseña" (pendiente de implementar)
// en vez de este endpoint.
export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son obligatorios' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
    }

    const usuario = await Usuario.findOne({ where: { email, activo: true } });

    if (!usuario) {
      return NextResponse.json({ error: 'No se encontró un cliente activo con ese email' }, { status: 404 });
    }

    if (usuario.password_hash) {
      return NextResponse.json({
        error: 'Esta cuenta ya fue activada. Usa la opción de inicio de sesión.'
      }, { status: 409 });
    }

    const password_hash = await bcrypt.hash(password, 10);
    await usuario.update({ password_hash });

    return NextResponse.json({ message: 'Cuenta activada correctamente. Ya puedes iniciar sesión.' });
  } catch (error) {
    console.error('Error al activar cuenta de cliente:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
