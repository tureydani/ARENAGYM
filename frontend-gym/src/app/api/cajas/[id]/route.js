import { NextResponse } from 'next/server';
import { Caja, MovimientoCaja, Administrativo } from '@/lib/db/models';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const caja = await Caja.findByPk(id, {
      include: [{
        model: MovimientoCaja,
        as: 'movimientos',
        include: [{
          model: Administrativo,
          as: 'administrativo',
          attributes: ['nombre', 'apellido']
        }]
      }]
    });

    if (!caja) {
      return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 });
    }

    return NextResponse.json(caja);
  } catch (error) {
    console.error('Error al obtener caja:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { descripcion, abierta } = body;

    const caja = await Caja.findByPk(id);
    if (!caja) {
      return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 });
    }

    const updateData = {};
    if (descripcion !== undefined) updateData.descripcion = descripcion.trim();
    if (abierta !== undefined) updateData.abierta = abierta;

    await caja.update(updateData);

    return NextResponse.json(caja);
  } catch (error) {
    console.error('Error al actualizar caja:', error);

    if (error.name === 'SequelizeValidationError') {
      return NextResponse.json({
        error: 'Datos de caja inválidos',
        details: error.errors.map(e => e.message)
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const caja = await Caja.findByPk(id);
    if (!caja) {
      return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 });
    }

    const movimientos = await MovimientoCaja.count({
      where: { id_caja: id }
    });

    if (movimientos > 0) {
      return NextResponse.json({
        error: 'No se puede eliminar la caja porque tiene movimientos asociados'
      }, { status: 400 });
    }

    await caja.destroy();
    return NextResponse.json({ message: 'Caja eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar caja:', error);

    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return NextResponse.json({
        error: 'No se puede eliminar la caja porque tiene transacciones asociadas'
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
