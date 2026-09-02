import { NextResponse } from 'next/server';
import { Caja, MovimientoCaja, Administrativo } from '@/lib/db/models';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const caja = await Caja.findByPk(id);
    if (!caja) {
      return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 });
    }

    const movimientos = await MovimientoCaja.findAll({
      where: { id_caja: id },
      include: [{
        model: Administrativo,
        as: 'Administrativo',
        attributes: ['nombre', 'apellido']
      }],
      order: [['fecha_movimiento', 'DESC'], ['id_movimiento', 'DESC']]
    });

    return NextResponse.json(movimientos);
  } catch (error) {
    console.error('Error al obtener movimientos:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
