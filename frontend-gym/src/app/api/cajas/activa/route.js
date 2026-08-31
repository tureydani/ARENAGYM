import { NextResponse } from 'next/server';
import { Caja } from '@/lib/db/models';

// Nota: el controlador original definía `getCajaActiva` dos veces (idénticas en
// lógica); se porta una sola copia.
export async function GET() {
  try {
    const caja = await Caja.findOne({
      where: { abierta: true },
      order: [['id_caja', 'ASC']]
    });

    if (!caja) {
      return NextResponse.json({ error: 'No hay cajas abiertas' }, { status: 404 });
    }

    return NextResponse.json(caja);
  } catch (error) {
    console.error('Error al obtener caja activa:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
