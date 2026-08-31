import { NextResponse } from 'next/server';
import { Notificacion } from '@/lib/db/models';
import { verificarAuth } from '@/lib/auth/clienteAuth';

export async function PATCH(request, { params }) {
  const auth = verificarAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const notificacion = await Notificacion.findOne({
      where: { id_notificacion: id, id_usuario: auth.id_usuario }
    });

    if (!notificacion) {
      return NextResponse.json({ error: 'Notificación no encontrada' }, { status: 404 });
    }

    const { leida } = await request.json();
    await notificacion.update({ leida: leida !== undefined ? leida : true });

    return NextResponse.json(notificacion);
  } catch (error) {
    console.error('Error al actualizar notificación:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
