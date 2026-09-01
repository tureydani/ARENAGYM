import { NextResponse } from 'next/server';
import { Membresia } from '@/lib/db/models';

export async function GET(request) {
  try {
    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';
    const scope = includeInactive ? 'withInactive' : 'defaultScope';

    const membresias = await Membresia.scope(scope).findAll({
      order: [['id_membresia', 'DESC']]
    });
    return NextResponse.json(membresias);
  } catch (error) {
    console.error('Error al obtener membresías:', error);
    return NextResponse.json({
      error: error.message || 'Error al obtener membresías',
      details: error
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const membresia = await Membresia.create(body);
    return NextResponse.json(membresia, { status: 201 });
  } catch (error) {
    console.error('Error al crear membresía:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
