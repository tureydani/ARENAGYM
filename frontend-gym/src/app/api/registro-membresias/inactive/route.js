import { NextResponse } from 'next/server';
import { RegistroMembresia, Usuario, Membresia, Administrativo } from '@/lib/db/models';

export async function GET() {
  try {
    const registros = await RegistroMembresia.scope('onlyInactive').findAll({
      include: [
        {
          model: Usuario.scope('withInactive'),
          as: 'Usuario',
          required: false
        },
        {
          model: Membresia.scope('withInactive'),
          as: 'Membresia',
          required: false
        },
        {
          model: Administrativo.scope('withInactive'),
          as: 'Administrativo',
          required: false
        }
      ]
    });
    return NextResponse.json(registros);
  } catch (error) {
    console.error('Error al obtener registros inactivos:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
