import { NextResponse } from 'next/server';
import { Meta } from '@/lib/db/models';
import { verificarAuth } from '@/lib/auth/clienteAuth';

export async function GET(request) {
  const auth = verificarAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const metas = await Meta.findAll({
      where: { id_usuario: auth.id_usuario },
      order: [['fecha_inicio', 'DESC']]
    });
    return NextResponse.json(metas);
  } catch (error) {
    console.error('Error al obtener metas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = verificarAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { tipo_meta, valor_inicial, valor_objetivo, valor_actual, fecha_objetivo, descripcion } = await request.json();

    if (!tipo_meta) {
      return NextResponse.json({ error: 'tipo_meta es obligatorio' }, { status: 400 });
    }

    const meta = await Meta.create({
      id_usuario: auth.id_usuario,
      tipo_meta,
      valor_inicial,
      valor_objetivo,
      valor_actual,
      fecha_objetivo,
      descripcion
    });

    return NextResponse.json(meta, { status: 201 });
  } catch (error) {
    console.error('Error al crear meta:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
