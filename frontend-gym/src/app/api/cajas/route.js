import { NextResponse } from 'next/server';
import { Caja, Administrativo } from '@/lib/db/models';

// ?estado=ABIERTA|CERRADA filtra (usado por el historial de cajas
// cerradas); sin el parámetro devuelve todas, igual que antes.
export async function GET(request) {
  try {
    const estado = request.nextUrl.searchParams.get('estado');
    const where = estado ? { estado } : {};

    const cajas = await Caja.findAll({
      where,
      include: [
        { model: Administrativo, as: 'AdminApertura', attributes: ['id_admin', 'nombre', 'apellido'], required: false },
        { model: Administrativo, as: 'AdminCierre', attributes: ['id_admin', 'nombre', 'apellido'], required: false }
      ],
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

    const estaAbierta = abierta !== undefined ? Boolean(abierta) : true;
    const descripcionTrim = descripcion.trim();

    if (estaAbierta) {
      const yaAbierta = await Caja.findOne({ where: { descripcion: descripcionTrim, estado: 'ABIERTA' } });
      if (yaAbierta) {
        return NextResponse.json({
          error: `Ya existe una caja abierta con el nombre "${descripcionTrim}" (Caja #${yaAbierta.id_caja}).`
        }, { status: 400 });
      }
    }

    let caja;
    try {
      caja = await Caja.create({
        descripcion: descripcionTrim,
        saldo_inicial: saldoInicial,
        saldo_actual: saldoInicial, // El saldo actual empieza igual al inicial
        abierta: estaAbierta,
        estado: estaAbierta ? 'ABIERTA' : 'CERRADA',
        fecha_apertura: new Date()
      });
    } catch (error) {
      const codigoPostgres = error?.original?.code || error?.parent?.code;
      if (codigoPostgres === '23505') {
        return NextResponse.json({
          error: `Ya existe una caja abierta con el nombre "${descripcionTrim}".`
        }, { status: 400 });
      }
      throw error;
    }

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
