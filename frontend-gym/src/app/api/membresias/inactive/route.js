import { NextResponse } from 'next/server';
import { Membresia } from '@/lib/db/models';

export async function GET() {
  try {
    const membresias = await Membresia.scope('onlyInactive').findAll();
    return NextResponse.json(membresias);
  } catch (error) {
    console.error('Error al obtener membresías inactivas:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
