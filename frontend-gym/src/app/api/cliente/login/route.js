import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Usuario } from '@/lib/db/models';
import { firmarToken } from '@/lib/auth/clienteAuth';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son obligatorios' }, { status: 400 });
    }

    const usuario = await Usuario.findOne({ where: { email, activo: true } });

    if (!usuario || !usuario.password_hash) {
      return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValida) {
      return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 });
    }

    await usuario.update({ ultimo_acceso: new Date() });

    const token = firmarToken(usuario);

    return NextResponse.json({
      token,
      usuario: {
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        foto_perfil: usuario.foto_perfil,
        email_verificado: usuario.email_verificado
      }
    });
  } catch (error) {
    console.error('Error en login de cliente:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
