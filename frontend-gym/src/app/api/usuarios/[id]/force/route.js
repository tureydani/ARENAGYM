import { NextResponse } from 'next/server';
import { Usuario } from '@/lib/db/models';

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const usuario = await Usuario.scope('withInactive').findByPk(id);
    if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    await usuario.destroy();

    return NextResponse.json({ message: "Usuario eliminado permanentemente" });
  } catch (error) {
    return NextResponse.json({
      error: "Error al eliminar permanentemente. Puede que el usuario tenga registros asociados.",
      details: error.message
    }, { status: 400 });
  }
}
