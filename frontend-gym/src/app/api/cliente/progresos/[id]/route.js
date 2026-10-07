import { NextResponse } from 'next/server';
import { verificarAuth } from '@/lib/auth/clienteAuth';
import { cargarProgresoDelUsuario } from '@/lib/seguimientoFisico/progresoAcceso';

export async function GET(request, { params }) {
  const auth = verificarAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const progreso = await cargarProgresoDelUsuario(parseInt(id, 10), auth.id_usuario, { conDetalle: true });
    if (!progreso) {
      return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 });
    }
    return NextResponse.json(progreso);
  } catch (error) {
    console.error('Error al obtener evaluación física:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
