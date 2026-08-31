import { NextResponse } from 'next/server';
import { Op } from 'sequelize';
import { Usuario, Administrativo } from '@/lib/db/models';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const usuario = await Usuario.scope('withInactive').findByPk(id, {
      include: [{ model: Administrativo, as: 'Administrativo' }]
    });
    if (!usuario) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json(usuario);
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const body = await request.json();

    if (body.email === '') {
      body.email = null;
    }

    if (body.fecha_nacimiento === '') {
      body.fecha_nacimiento = null;
    }

    const usuario = await Usuario.findByPk(id);
    if (!usuario) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    if (body.nombre && body.apellido) {
      const usuarioExistente = await Usuario.findOne({
        where: {
          nombre: body.nombre,
          apellido: body.apellido,
          activo: true,
          id_usuario: { [Op.ne]: id }
        }
      });

      if (usuarioExistente) {
        return NextResponse.json({
          error: 'Ya existe otro usuario registrado con el mismo nombre y apellido'
        }, { status: 400 });
      }
    }

    await usuario.update(body);
    const usuarioCompleto = await Usuario.findByPk(id, {
      include: [{ model: Administrativo, as: 'Administrativo' }]
    });
    return NextResponse.json(usuarioCompleto);
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const usuario = await Usuario.scope('withInactive').findByPk(id);
    if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    if (!usuario.activo) {
      return NextResponse.json({ error: "El usuario ya está eliminado" }, { status: 400 });
    }

    await usuario.update({ activo: false });

    const usuarioActualizado = await Usuario.scope('withInactive').findByPk(id, {
      include: [{ model: Administrativo, as: 'Administrativo' }]
    });

    return NextResponse.json({
      message: "Usuario eliminado lógicamente",
      usuario: usuarioActualizado
    });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
