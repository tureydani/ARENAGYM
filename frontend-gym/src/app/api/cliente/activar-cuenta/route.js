import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { Usuario } from '@/lib/db/models';

// Primera activación de la cuenta de app para un cliente ya existente
// (dado de alta por un administrativo en el panel web, sin password_hash
// todavía). Solo funciona una vez: si ya tiene password_hash, hay que
// usar el flujo de "olvidé mi contraseña" (pendiente de implementar)
// en vez de este endpoint.
//
// Como el panel web todavía no tiene un campo para el correo al crear
// un cliente, la mayoría solo tiene teléfono — por eso se puede activar
// con teléfono o con correo, lo que exista. Si además se manda "email"
// y el cliente no tenía uno guardado, se aprovecha para agregárselo.
export async function POST(request) {
  try {
    const { identificador, password, email } = await request.json();

    if (!identificador || !password) {
      return NextResponse.json({ error: 'Teléfono/correo y contraseña son obligatorios' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
    }

    const valor = identificador.trim();

    const candidatos = await Usuario.findAll({
      where: {
        activo: true,
        [Op.or]: [{ email: valor }, { telefono: valor }]
      }
    });

    if (candidatos.length === 0) {
      return NextResponse.json({
        error: 'No se encontró un cliente activo con ese teléfono o correo'
      }, { status: 404 });
    }

    if (candidatos.length > 1) {
      // Varios clientes comparten ese mismo teléfono en el sistema (dato
      // de relleno/repetido) — no hay forma segura de saber cuál de todos
      // es la persona real, así que se pide desambiguar con el correo.
      return NextResponse.json({
        error: 'Ese teléfono está registrado en más de un cliente. Activa tu cuenta con tu correo electrónico, o pide en recepción que corrijan tu número.'
      }, { status: 409 });
    }

    const usuario = candidatos[0];

    if (usuario.password_hash) {
      return NextResponse.json({
        error: 'Esta cuenta ya fue activada. Usa la opción de inicio de sesión.'
      }, { status: 409 });
    }

    const updateData = { password_hash: await bcrypt.hash(password, 10) };

    if (email && !usuario.email) {
      updateData.email = email.trim();
    }

    await usuario.update(updateData);

    return NextResponse.json({ message: 'Cuenta activada correctamente. Ya puedes iniciar sesión.' });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return NextResponse.json({ error: 'Ese correo ya está en uso por otra cuenta' }, { status: 409 });
    }
    console.error('Error al activar cuenta de cliente:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
