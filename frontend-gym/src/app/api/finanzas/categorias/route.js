import { NextResponse } from 'next/server';
import sequelize from '@/lib/db/sequelize';
import { requerirLecturaFinanzas } from '@/lib/auth/permisosFinanzas';

export async function GET(request) {
  const { error } = await requerirLecturaFinanzas(request);
  if (error) return NextResponse.json(error.body, { status: error.status });

  try {
    const [tiposFondo] = await sequelize.query('SELECT codigo, nombre, orden FROM tipos_fondo WHERE activo = true ORDER BY orden');
    const [categorias] = await sequelize.query('SELECT codigo, nombre, tipo, orden FROM categorias_financieras WHERE activo = true ORDER BY orden');
    return NextResponse.json({ tipos_fondo: tiposFondo, categorias });
  } catch (err) {
    console.error('Error al obtener catálogos de finanzas:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
