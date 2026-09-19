import { NextResponse } from 'next/server';
import { Caja, MovimientoCaja, Administrativo } from '@/lib/db/models';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const caja = await Caja.findByPk(id, {
      include: [{
        model: MovimientoCaja,
        include: [{
          model: Administrativo,
          as: 'Administrativo',
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

    // Abrir/cerrar una caja ya no se hace togueleando `abierta` acá: abrir
    // crea una caja nueva (POST /api/cajas/abrir) y cerrar exige el arqueo
    // (POST /api/cajas/:id/cerrar). Permitir `abierta` en este PUT genérico
    // se saltaría esas validaciones (saldo esperado, saldo contado,
    // responsable, índice único de "una sola caja abierta por nombre").
    if (abierta !== undefined) {
      return NextResponse.json({
        error: 'Para abrir o cerrar una caja usa los endpoints dedicados (POST /api/cajas/abrir y POST /api/cajas/:id/cerrar), no este PUT.'
      }, { status: 400 });
    }

    if (caja.estado === 'CERRADA') {
      return NextResponse.json({
        error: 'Esta caja ya está cerrada y es un registro histórico: no admite modificaciones.'
      }, { status: 400 });
    }

    const updateData = {};
    if (descripcion !== undefined) updateData.descripcion = descripcion.trim();

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
