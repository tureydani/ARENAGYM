import { NextResponse } from 'next/server';
import { estadisticasHoy } from '@/lib/db/asistenciaService';

// Indicadores rápidos del día para "Asistencia rápida"/"Hoy": total,
// registros QR, registros manuales, clientes atendidos y membresías que
// vencen dentro de 7 días. Todo calculado con COUNT reales, sin inventar
// "personas dentro" (no existe control de salida en este módulo).
export async function GET() {
  try {
    const estadisticas = await estadisticasHoy();
    return NextResponse.json(estadisticas);
  } catch (error) {
    console.error('Error al calcular estadísticas de asistencias:', error);
    return NextResponse.json({ error: 'No se pudieron calcular las estadísticas' }, { status: 500 });
  }
}
