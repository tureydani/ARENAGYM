import { NextResponse } from 'next/server';
import { anularAsistencia } from '@/lib/db/asistenciaService';

// Anulación mediante soft delete (activo = FALSE). Nunca borra la fila:
// queda en la base de datos para auditoría. Motivo y admin responsable
// son obligatorios (ver asistenciaService.anularAsistencia).
export async function PATCH(request, { params }) {
  const { id } = await params;
  try {
    const { motivo, id_admin } = await request.json();
    const resultado = await anularAsistencia(id, { motivo, id_admin });

    if (resultado.tipo === 'no_encontrado') return NextResponse.json({ error: resultado.error }, { status: 404 });
    if (resultado.tipo === 'error') return NextResponse.json({ error: resultado.error }, { status: 400 });

    return NextResponse.json({ message: 'Asistencia anulada correctamente', asistencia: resultado.asistencia });
  } catch (error) {
    console.error('Error al anular asistencia:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
