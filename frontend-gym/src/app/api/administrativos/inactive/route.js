import { NextResponse } from 'next/server';
import Administrativo from '@/lib/db/models/administrativo';

export async function GET() {
  try {
    const admins = await Administrativo.scope('onlyInactive').findAll({
      order: [['fecha_contratacion', 'DESC'], ['id_admin', 'ASC']]
    });
    return NextResponse.json(admins);
  } catch (error) {
    console.error('Error al obtener administrativos inactivos:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
