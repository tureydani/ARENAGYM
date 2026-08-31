import { NextResponse } from 'next/server';
import { Usuario, Administrativo } from '@/lib/db/models';

export async function GET() {
  try {
    const usuarios = await Usuario.scope('onlyInactive').findAll({
      include: [{ model: Administrativo, as: 'Administrativo' }]
    });
    return NextResponse.json(usuarios);
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
