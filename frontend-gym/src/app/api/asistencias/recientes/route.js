import { NextResponse } from 'next/server';
import { Asistencia, Usuario } from '@/lib/db/models';

// Lista de las últimas asistencias registradas (cualquier cliente), para
// mostrar en el panel de control de asistencias del administrativo.
export async function GET(request) {
  try {
    const limite = Number(request.nextUrl.searchParams.get('limite')) || 20;

    const asistencias = await Asistencia.findAll({
      include: [{ model: Usuario.scope('withInactive'), as: 'Usuario', attributes: ['id_usuario', 'nombre', 'apellido'] }],
      order: [['fecha_hora', 'DESC']],
      limit: limite
    });

    return NextResponse.json(asistencias);
  } catch (error) {
    console.error('Error al obtener asistencias recientes:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
