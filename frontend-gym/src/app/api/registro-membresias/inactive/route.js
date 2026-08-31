import { NextResponse } from 'next/server';
import RegistroMembresia from '@/lib/db/models/registroMembresia';
import Usuario from '@/lib/db/models/usuario';
import Membresia from '@/lib/db/models/membresia';
import Administrativo from '@/lib/db/models/administrativo';

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
