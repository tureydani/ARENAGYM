import { NextResponse } from 'next/server';
import { reactivarAsistencia } from '@/lib/db/asistenciaService';

// Reactiva una asistencia anulada (activo = TRUE), solo si no supera el
// límite de asistencias de la membresía a la que pertenece (ver
// asistenciaService.reactivarAsistencia). Motivo y admin responsable son
// obligatorios.
export async function PATCH(request, { params }) {
  const { id } = await params;
  try {
    const { motivo, id_admin } = await request.json();
    const resultado = await reactivarAsistencia(id, { motivo, id_admin });

    if (resultado.tipo === 'no_encontrado') return NextResponse.json({ error: resultado.error }, { status: 404 });
    if (resultado.tipo === 'error') return NextResponse.json({ error: resultado.error }, { status: 400 });

    return NextResponse.json({ message: 'Asistencia reactivada correctamente', asistencia: resultado.asistencia });
  } catch (error) {
    console.error('Error al reactivar asistencia:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
