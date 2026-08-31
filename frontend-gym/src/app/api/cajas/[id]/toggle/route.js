import { NextResponse } from 'next/server';
import { Caja } from '@/lib/db/models';

export async function PATCH(request, { params }) {
  const { id } = await params;
  try {
    const caja = await Caja.findByPk(id);
    if (!caja) {
      return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 });
    }

    await caja.update({ abierta: !caja.abierta });

    return NextResponse.json({
      message: `Caja ${caja.abierta ? 'abierta' : 'cerrada'} correctamente`,
      caja
    });
  } catch (error) {
    console.error('Error al cambiar estado de caja:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
