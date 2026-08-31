import { NextResponse } from 'next/server';
import Usuario from '@/lib/db/models/usuario';
import Administrativo from '@/lib/db/models/administrativo';

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
