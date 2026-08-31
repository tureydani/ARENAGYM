import { NextResponse } from 'next/server';
import { Caja } from '@/lib/db/models';

export async function GET() {
  try {
    const cajas = await Caja.findAll({
      order: [['id_caja', 'ASC']]
    });
    return NextResponse.json(cajas);
  } catch (error) {
    console.error('Error al obtener cajas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { descripcion, saldo_inicial, abierta } = body;

    if (!descripcion || descripcion.trim() === '') {
      return NextResponse.json({
        error: 'La descripción es obligatoria'
      }, { status: 400 });
    }

    const saldoInicial = saldo_inicial ? parseFloat(saldo_inicial) : 0;

    if (saldoInicial < 0) {
      return NextResponse.json({
        error: 'El saldo inicial no puede ser negativo'
      }, { status: 400 });
    }

    const caja = await Caja.create({
      descripcion: descripcion.trim(),
      saldo_inicial: saldoInicial,
      saldo_actual: saldoInicial, // El saldo actual empieza igual al inicial
      abierta: abierta !== undefined ? abierta : true,
      fecha_apertura: new Date()
    });

    return NextResponse.json(caja, { status: 201 });
  } catch (error) {
    console.error('Error al crear caja:', error);

    if (error.name === 'SequelizeValidationError') {
      return NextResponse.json({
        error: 'Datos de caja inválidos',
        details: error.errors.map(e => e.message)
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
