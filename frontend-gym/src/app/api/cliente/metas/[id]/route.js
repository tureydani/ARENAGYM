import { NextResponse } from 'next/server';
import { Meta } from '@/lib/db/models';
import { verificarAuth } from '@/lib/auth/clienteAuth';

export async function PATCH(request, { params }) {
  const auth = verificarAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const meta = await Meta.findOne({ where: { id_meta: id, id_usuario: auth.id_usuario } });

    if (!meta) {
      return NextResponse.json({ error: 'Meta no encontrada' }, { status: 404 });
    }

    const { valor_actual, valor_objetivo, estado, descripcion, fecha_objetivo } = await request.json();
    const updateData = {};
    if (valor_actual !== undefined) updateData.valor_actual = valor_actual;
    if (valor_objetivo !== undefined) updateData.valor_objetivo = valor_objetivo;
    if (estado !== undefined) updateData.estado = estado;
    if (descripcion !== undefined) updateData.descripcion = descripcion;
    if (fecha_objetivo !== undefined) updateData.fecha_objetivo = fecha_objetivo;

    await meta.update(updateData);

    return NextResponse.json(meta);
  } catch (error) {
    console.error('Error al actualizar meta:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
