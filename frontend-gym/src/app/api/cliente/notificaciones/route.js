import { NextResponse } from 'next/server';
import { Notificacion } from '@/lib/db/models';
import { verificarAuth } from '@/lib/auth/clienteAuth';

export async function GET(request) {
  const auth = verificarAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const notificaciones = await Notificacion.findAll({
      where: { id_usuario: auth.id_usuario },
      order: [['fecha_creacion', 'DESC']],
      limit: 50
    });

    return NextResponse.json(notificaciones);
  } catch (error) {
    console.error('Error al obtener notificaciones de cliente:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
