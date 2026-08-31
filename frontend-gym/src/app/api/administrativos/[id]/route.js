import { NextResponse } from 'next/server';
import { Op } from 'sequelize';
import Administrativo from '@/lib/db/models/administrativo';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const admin = await Administrativo.scope('withInactive').findByPk(id);
    if (!admin) {
      return NextResponse.json({
        error: "Administrativo no encontrado",
        message: `No se encontró un administrativo con ID ${id}`
      }, { status: 404 });
    }
    return NextResponse.json(admin);
  } catch (error) {
    console.error('Error al obtener administrativo:', error);
    return NextResponse.json({
      error: error.message,
      message: "Error interno del servidor al obtener el administrativo"
    }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const admin = await Administrativo.scope('withInactive').findByPk(id);
    if (!admin) {
      return NextResponse.json({
        error: "Administrativo no encontrado",
        message: `No se encontró un administrativo con ID ${id}`
      }, { status: 404 });
    }

    const body = await request.json();
    const { nombre, apellido, usuario, contraseña, fecha_contratacion } = body;

    if (usuario && usuario !== admin.usuario) {
      const existingAdmin = await Administrativo.scope('withInactive').findOne({
        where: {
          usuario,
          id_admin: { [Op.ne]: id }
        }
      });
      if (existingAdmin) {
        return NextResponse.json({
          error: "Usuario duplicado",
          message: `El nombre de usuario '${usuario}' ya está en uso`
        }, { status: 409 });
      }
    }

    const updateData = {};
    if (nombre) updateData.nombre = nombre.trim();
    if (apellido) updateData.apellido = apellido.trim();
    if (usuario) updateData.usuario = usuario.trim();
    if (contraseña) updateData.contraseña = contraseña;
    if (fecha_contratacion) updateData.fecha_contratacion = fecha_contratacion;

    await admin.update(updateData);

    const adminActualizado = await Administrativo.scope('withInactive').findByPk(id);
    return NextResponse.json(adminActualizado);
  } catch (error) {
    console.error('Error al actualizar administrativo:', error);

    if (error.name === 'SequelizeUniqueConstraintError') {
      return NextResponse.json({
        error: "Usuario duplicado",
        message: "El nombre de usuario ya está en uso"
      }, { status: 409 });
    }

    return NextResponse.json({
      error: error.message,
      message: "Error al actualizar el administrativo"
    }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const admin = await Administrativo.findByPk(id);
    if (!admin) {
      return NextResponse.json({
        error: "Administrativo no encontrado",
        message: `No se encontró un administrativo con ID ${id}`
      }, { status: 404 });
    }

    if (!admin.activo) {
      return NextResponse.json({
        error: "El administrativo ya está inactivo"
      }, { status: 400 });
    }

    await admin.update({ activo: false });

    const adminActualizado = await Administrativo.scope('withInactive').findByPk(id);

    return NextResponse.json({
      message: "Administrativo eliminado lógicamente",
      administrativo: adminActualizado
    });
  } catch (error) {
    console.error('Error al eliminar administrativo:', error);
    return NextResponse.json({
      error: error.message,
      message: "Error interno del servidor al eliminar el administrativo"
    }, { status: 500 });
  }
}
