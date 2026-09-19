import { NextResponse } from 'next/server';
import { clientesBajaFrecuencia } from '@/lib/db/asistenciaService';

// Clientes con membresía vigente que no vienen hace más de `umbral` días
// (o que nunca asistieron): herramienta de seguimiento al cliente, ver
// asistenciaService.clientesBajaFrecuencia.
export async function GET(request) {
  try {
    const umbral = parseInt(request.nextUrl.searchParams.get('umbral')) || 7;
    const resultado = await clientesBajaFrecuencia(umbral);
    return NextResponse.json(resultado);
  } catch (error) {
    console.error('Error al calcular clientes con baja asistencia:', error);
    return NextResponse.json({ error: 'No se pudo calcular la lista' }, { status: 500 });
  }
}
