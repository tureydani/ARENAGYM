import { NextResponse } from 'next/server';
import { Usuario, Administrativo } from '@/lib/db/models';

export async function PATCH(request, { params }) {
  const { id } = await params;
  try {
    const usuario = await Usuario.scope('withInactive').findByPk(id);
    if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    if (usuario.activo) {
      return NextResponse.json({ error: "El usuario ya está activo" }, { status: 400 });
    }

    await usuario.update({ activo: true });

    const usuarioActualizado = await Usuario.findByPk(id, {
      include: [{ model: Administrativo, as: 'Administrativo' }]
    });

    return NextResponse.json({
      message: "Usuario restaurado exitosamente",
      usuario: usuarioActualizado
    });
  } catch (error) {
    console.error('Error al restaurar usuario:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
