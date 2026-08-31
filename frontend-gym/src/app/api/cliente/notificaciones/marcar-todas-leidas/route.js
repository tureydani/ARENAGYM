import { NextResponse } from 'next/server';
import { Notificacion } from '@/lib/db/models';
import { verificarAuth } from '@/lib/auth/clienteAuth';

export async function PATCH(request) {
  const auth = verificarAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const [cantidad] = await Notificacion.update(
      { leida: true, fecha_lectura: new Date() },
      { where: { id_usuario: auth.id_usuario, leida: false } }
    );

    return NextResponse.json({ message: 'Notificaciones marcadas como leídas', cantidad });
  } catch (error) {
    console.error('Error al marcar todas las notificaciones como leídas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
