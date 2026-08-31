import { NextResponse } from 'next/server';
import Membresia from '@/lib/db/models/membresia';

export async function GET() {
  try {
    const membresias = await Membresia.scope('onlyInactive').findAll();
    return NextResponse.json(membresias);
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
