import { NextResponse } from 'next/server';
import { Caja } from '@/lib/db/models';

// Deprecado: togglear `abierta` a ciegas se saltaría el arqueo del cierre
// (saldo esperado vs. contado) y la apertura formal (nueva fila, admin
// responsable). Usar POST /api/cajas/abrir y POST /api/cajas/:id/cerrar.
export async function PATCH(request, { params }) {
  const { id } = await params;
  try {
    const caja = await Caja.findByPk(id);
    if (!caja) {
      return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      error: 'Este endpoint fue reemplazado por POST /api/cajas/abrir y POST /api/cajas/:id/cerrar.'
    }, { status: 410 });
  } catch (error) {
    console.error('Error al cambiar estado de caja:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
