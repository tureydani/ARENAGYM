import { NextResponse } from 'next/server';
import { listarAsistencias } from '@/lib/db/asistenciaService';

// Listado paginado con filtros combinables, usado por las pestañas
// "Hoy" e "Historial". La paginación y todos los filtros se resuelven en
// el backend (ver src/lib/db/asistenciaService.js#listarAsistencias) para
// no descargar todo el historial al navegador.
export async function GET(request) {
  try {
    const params = request.nextUrl.searchParams;

    const resultado = await listarAsistencias({
      page: params.get('page') || 1,
      pageSize: params.get('pageSize') || 10,
      fechaInicio: params.get('fechaInicio') || undefined,
      fechaFin: params.get('fechaFin') || undefined,
      metodo: params.get('metodo') || undefined,
      estado: params.get('estado') || undefined,
      id_admin: params.get('id_admin') || undefined,
      busqueda: params.get('busqueda') || undefined,
      id_usuario: params.get('id_usuario') || undefined
    });

    return NextResponse.json(resultado);
  } catch (error) {
    console.error('Error al listar asistencias:', error);
    return NextResponse.json({ error: 'No se pudieron cargar las asistencias' }, { status: 500 });
  }
}
