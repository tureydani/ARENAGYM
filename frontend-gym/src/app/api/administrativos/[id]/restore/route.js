import { NextResponse } from 'next/server';
import { Op } from 'sequelize';
import { Administrativo } from '@/lib/db/models';

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const admin = await Administrativo.scope('withInactive').findByPk(id);
    if (!admin) {
      return NextResponse.json({
        error: "Administrativo no encontrado"
      }, { status: 404 });
    }

    if (admin.activo) {
      return NextResponse.json({
        error: "El administrativo ya está activo"
      }, { status: 400 });
    }

    const existingAdmin = await Administrativo.findOne({
      where: {
        usuario: admin.usuario,
        id_admin: { [Op.ne]: id }
      }
    });

    if (existingAdmin) {
      return NextResponse.json({
        error: "Usuario duplicado",
        message: `No se puede restaurar: el nombre de usuario '${admin.usuario}' ya está en uso por otro administrativo activo`
      }, { status: 409 });
    }

    await admin.update({ activo: true });

    const adminActualizado = await Administrativo.findByPk(id);

    return NextResponse.json({
      message: "Administrativo restaurado exitosamente",
      administrativo: adminActualizado
    });
  } catch (error) {
    console.error('Error al restaurar administrativo:', error);
    return NextResponse.json({
      error: error.message,
      message: "Error al restaurar el administrativo"
    }, { status: 400 });
  }
}
