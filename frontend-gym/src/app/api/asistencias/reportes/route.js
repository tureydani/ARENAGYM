import { NextResponse } from 'next/server';
import { reportes } from '@/lib/db/asistenciaService';

// Métricas para la pestaña "Reportes" sobre un rango de fechas: total,
// clientes únicos, promedio diario, QR/Manual, clientes más frecuentes,
// días con más asistencias y horarios pico. Todo calculado en el momento
// contra la base de datos (ver asistenciaService.reportes).
export async function GET(request) {
  try {
    const params = request.nextUrl.searchParams;
    const resultado = await reportes({
      fechaInicio: params.get('fechaInicio') || undefined,
      fechaFin: params.get('fechaFin') || undefined
    });
    return NextResponse.json(resultado);
  } catch (error) {
    console.error('Error al generar reporte de asistencias:', error);
    return NextResponse.json({ error: 'No se pudo generar el reporte' }, { status: 500 });
  }
}
