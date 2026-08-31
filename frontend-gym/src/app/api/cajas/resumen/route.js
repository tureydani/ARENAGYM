import { NextResponse } from 'next/server';
import { Caja } from '@/lib/db/models';

export async function GET() {
  try {
    const cajas = await Caja.findAll();

    const resumen = {
      total_cajas: cajas.length,
      cajas_abiertas: cajas.filter(c => c.abierta).length,
      cajas_cerradas: cajas.filter(c => !c.abierta).length,
      saldo_total: cajas.reduce((sum, c) => sum + (c.saldo_actual || 0), 0),
      saldo_inicial_total: cajas.reduce((sum, c) => sum + (c.saldo_inicial || 0), 0)
    };

    return NextResponse.json(resumen);
  } catch (error) {
    console.error('Error al obtener resumen de cajas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
