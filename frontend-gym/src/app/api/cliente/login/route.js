import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { Usuario } from '@/lib/db/models';
import { firmarToken } from '@/lib/auth/clienteAuth';

export async function POST(request) {
  try {
    const { identificador, password } = await request.json();

    if (!identificador || !password) {
      return NextResponse.json({ error: 'Teléfono/correo y contraseña son obligatorios' }, { status: 400 });
    }

    const valor = identificador.trim();

    // El teléfono NO es único entre clientes (varios pueden compartir el
    // mismo dato en el sistema), así que en vez de asumir una sola
    // coincidencia, se comparan las contraseñas contra todas las cuentas
    // que coincidan por email o teléfono — solo la persona con la
    // contraseña correcta entra, sin importar cuántas cuentas compartan
    // ese mismo teléfono.
    const candidatos = await Usuario.findAll({
      where: {
        activo: true,
        [Op.or]: [{ email: valor }, { telefono: valor }]
      }
    });

    let usuario = null;
    for (const candidato of candidatos) {
      if (candidato.password_hash && await bcrypt.compare(password, candidato.password_hash)) {
        usuario = candidato;
        break;
      }
    }

    if (!usuario) {
      return NextResponse.json({ error: 'Datos de acceso incorrectos' }, { status: 401 });
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
        telefono: usuario.telefono,
        foto_perfil: usuario.foto_perfil,
        email_verificado: usuario.email_verificado
      }
    });
  } catch (error) {
    console.error('Error en login de cliente:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
