import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Administrativo } from '@/lib/db/models';
import { firmarTokenAdmin } from '@/lib/auth/adminAuth';

// Único endpoint administrativo que NO requiere token (ver middleware.ts):
// es el que entrega el token. Valida usuario/contraseña contra el hash
// guardado en BD y devuelve un JWT de sesión de 12h.
export async function POST(request) {
  try {
    const { usuario, contraseña } = await request.json();

    if (!usuario || !contraseña) {
      return NextResponse.json(
        { error: 'Usuario y contraseña son obligatorios' },
        { status: 400 }
      );
    }

    // .unscoped() porque el defaultScope excluye "contraseña" (para que
    // ningún otro endpoint la filtre); acá sí la necesitamos para comparar.
    // Solo administrativos activos pueden iniciar sesión.
    const admin = await Administrativo.unscoped().findOne({ where: { usuario, activo: true } });

    if (!admin) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
    }

    const coincide = await bcrypt.compare(contraseña, admin.contraseña);
    if (!coincide) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
    }

    const token = await firmarTokenAdmin(admin);

    return NextResponse.json({
      token,
      administrativo: {
        id_admin: admin.id_admin,
        nombre: admin.nombre,
        apellido: admin.apellido,
        usuario: admin.usuario,
      },
    });
  } catch (error) {
    console.error('Error en login de administrativo:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
