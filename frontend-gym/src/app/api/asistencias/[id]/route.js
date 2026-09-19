import { NextResponse } from 'next/server';
import { obtenerDetalle, editarAsistencia } from '@/lib/db/asistenciaService';

// Detalle completo de una asistencia (cliente, membresía usada, vigencia,
// quién la registró, uso actual de la membresía y su historial de
// auditoría completo).
export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const detalle = await obtenerDetalle(id);
    if (!detalle) return NextResponse.json({ error: 'Asistencia no encontrada' }, { status: 404 });
    return NextResponse.json(detalle);
  } catch (error) {
    console.error('Error al obtener detalle de asistencia:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// Edición con motivo obligatorio: fecha/hora, cliente u observación.
// Registra auditoría EDICION con snapshot antes/después.
export async function PATCH(request, { params }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const resultado = await editarAsistencia(id, {
      fecha_hora: body.fecha_hora,
      id_usuario: body.id_usuario,
      observacion: body.observacion,
      motivo: body.motivo,
      id_admin: body.id_admin
    });

    if (resultado.tipo === 'no_encontrado') return NextResponse.json({ error: resultado.error }, { status: 404 });
    if (resultado.tipo === 'error') return NextResponse.json({ error: resultado.error }, { status: 400 });

    return NextResponse.json(resultado.asistencia);
  } catch (error) {
    console.error('Error al editar asistencia:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
