import { NextResponse } from 'next/server';
import { MovimientoCaja, Caja, Administrativo } from '@/lib/db/models';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const movimiento = await MovimientoCaja.findByPk(id, {
      include: [
        { model: Caja, as: 'Caja' },
        { model: Administrativo, as: 'Administrativo' }
      ]
    });
    if (!movimiento) return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
    return NextResponse.json(movimiento);
  } catch (error) {
    console.error('Error al obtener movimiento:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const movimiento = await MovimientoCaja.findByPk(id);
    if (!movimiento) return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });

    const body = await request.json();
    await movimiento.update(body);

    const movimientoActualizado = await MovimientoCaja.findByPk(id, {
      include: [
        { model: Caja, as: 'Caja' },
        { model: Administrativo, as: 'Administrativo' }
      ]
    });

    return NextResponse.json(movimientoActualizado);
  } catch (error) {
    console.error('Error al actualizar movimiento:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const movimiento = await MovimientoCaja.findByPk(id);
    if (!movimiento) return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });

    await movimiento.destroy();
    return NextResponse.json({ message: "Movimiento eliminado correctamente" });
  } catch (error) {
    console.error('Error al eliminar movimiento:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
