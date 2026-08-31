import { NextResponse } from 'next/server';
import { Op } from 'sequelize';
import { Usuario, RegistroMembresia, Membresia } from '@/lib/db/models';
import { verificarAuth } from '@/lib/auth/clienteAuth';

export async function GET(request) {
  const auth = verificarAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const usuario = await Usuario.findOne({
      where: { id_usuario: auth.id_usuario, activo: true },
      attributes: { exclude: ['password_hash'] }
    });

    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Membresía activa más reciente (por fecha_fin) que no haya vencido
    const hoy = new Date().toISOString().slice(0, 10);
    const membresiaActiva = await RegistroMembresia.findOne({
      where: {
        id_usuario: auth.id_usuario,
        activo: true,
        fecha_fin: { [Op.gte]: hoy }
      },
      include: [{ model: Membresia, as: 'Membresia' }],
      order: [['fecha_fin', 'DESC']]
    });

    return NextResponse.json({ usuario, membresiaActiva });
  } catch (error) {
    console.error('Error al obtener perfil de cliente:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// Edición limitada a datos de contacto/app. nombre y apellido no son
// editables por el cliente porque identifican su membresía física en el
// sistema del gimnasio; esos cambios los sigue haciendo el administrativo
// desde el panel web. El email sí es editable aquí: como el panel web
// todavía no tiene un campo para capturarlo al crear un cliente, muchos
// usuarios se activan solo con teléfono y agregan su correo después,
// desde la app.
export async function PATCH(request) {
  const auth = verificarAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const usuario = await Usuario.findOne({ where: { id_usuario: auth.id_usuario, activo: true } });
    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const { telefono, foto_perfil, email } = await request.json();
    const updateData = {};
    if (telefono !== undefined) updateData.telefono = telefono;
    if (foto_perfil !== undefined) updateData.foto_perfil = foto_perfil;
    if (email !== undefined) updateData.email = email ? email.trim() : null;

    await usuario.update(updateData);

    const usuarioActualizado = usuario.toJSON();
    delete usuarioActualizado.password_hash;

    return NextResponse.json({ usuario: usuarioActualizado });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return NextResponse.json({ error: 'Ese correo ya está en uso por otra cuenta' }, { status: 409 });
    }
    console.error('Error al actualizar perfil de cliente:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
