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
    const nuevaLeida = leida !== undefined ? leida : true;

    await notificacion.update({
      leida: nuevaLeida,
      // Se registra cuándo se marcó como leída la primera vez; si se
      // "desmarca" no se borra ese dato, solo se actualiza al volver a leer.
      fecha_lectura: nuevaLeida ? new Date() : notificacion.fecha_lectura
    });

    return NextResponse.json(notificacion);
  } catch (error) {
    console.error('Error al actualizar notificación:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
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

    await notificacion.destroy();

    return NextResponse.json({ message: 'Notificación eliminada' });
  } catch (error) {
    console.error('Error al eliminar notificación:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
