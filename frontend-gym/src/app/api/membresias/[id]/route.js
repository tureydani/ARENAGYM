import { NextResponse } from 'next/server';
import { Membresia } from '@/lib/db/models';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const membresia = await Membresia.scope('withInactive').findByPk(id);
    if (!membresia) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json(membresia);
  } catch (error) {
    console.error('Error al obtener membresía:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const membresia = await Membresia.scope('withInactive').findByPk(id);
    if (!membresia) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    const body = await request.json();
    await membresia.update(body);
    return NextResponse.json(membresia);
  } catch (error) {
    console.error('Error al actualizar membresía:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const membresia = await Membresia.scope('withInactive').findByPk(id);
    if (!membresia) return NextResponse.json({ error: "Membresía no encontrada" }, { status: 404 });

    if (!membresia.activo) {
      return NextResponse.json({ error: "La membresía ya está inactiva" }, { status: 400 });
    }

    await membresia.update({ activo: false });

    const membresiaActualizada = await Membresia.scope('withInactive').findByPk(id);

    return NextResponse.json({
      message: "Membresía eliminada lógicamente",
      membresia: membresiaActualizada
    });
  } catch (error) {
    console.error('Error en soft delete de membresía:', error);
    return NextResponse.json({
      error: error.message || 'Error al eliminar membresía',
      details: error
    }, { status: 400 });
  }
}
