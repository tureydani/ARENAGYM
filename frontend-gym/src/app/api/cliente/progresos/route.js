import { NextResponse } from 'next/server';
import { Progreso } from '@/lib/db/models';
import { verificarAuth } from '@/lib/auth/clienteAuth';

export async function GET(request) {
  const auth = verificarAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const progresos = await Progreso.findAll({
      where: { id_usuario: auth.id_usuario },
      order: [['fecha', 'DESC']]
    });
    return NextResponse.json(progresos);
  } catch (error) {
    console.error('Error al obtener progresos:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = verificarAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { peso, porcentaje_grasa, pecho, cintura, brazo, pierna, cadera, observaciones } = await request.json();

    if (peso === undefined && porcentaje_grasa === undefined && !pecho && !cintura && !brazo && !pierna && !cadera) {
      return NextResponse.json({ error: 'Registra al menos una medición' }, { status: 400 });
    }

    const progreso = await Progreso.create({
      id_usuario: auth.id_usuario,
      peso,
      porcentaje_grasa,
      pecho,
      cintura,
      brazo,
      pierna,
      cadera,
      observaciones
    });

    return NextResponse.json(progreso, { status: 201 });
  } catch (error) {
    console.error('Error al crear progreso:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
