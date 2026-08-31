import { NextResponse } from 'next/server';
import { Pago, RegistroMembresia, Administrativo, Caja } from '@/lib/db/models';

export async function GET(request) {
  try {
    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';
    const scope = includeInactive ? 'withInactive' : 'defaultScope';

    const pagos = await Pago.scope(scope).findAll({
      include: [
        {
          model: RegistroMembresia.scope('withInactive'),
          as: 'RegistroMembresia'
        },
        {
          model: Administrativo.scope('withInactive'),
          as: 'Administrativo'
        },
        {
          model: Caja,
          as: 'Caja'
        }
      ],
      order: [['fecha_pago', 'DESC'], ['id_pago', 'DESC']]
    });
    return NextResponse.json(pagos);
  } catch (error) {
    console.error('Error al obtener pagos:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { id_registro, monto_pagado, fecha_pago, id_admin, id_caja, estado_pago } = body;

    const nuevoPago = await Pago.create({
      id_registro,
      monto_pagado,
      fecha_pago,
      id_admin: id_admin || 1,
      id_caja: id_caja || 1,
      estado_pago: estado_pago || 'Pendiente'
    });

    // El trigger automáticamente:
    // 1. Actualiza el saldo de la caja
    // 2. Crea el movimiento en movimientos_caja
    // No necesitamos hacerlo manualmente aquí

    const pagoConRelaciones = await Pago.scope('withInactive').findByPk(nuevoPago.id_pago, {
      include: [
        { model: RegistroMembresia.scope('withInactive'), as: 'RegistroMembresia' },
        { model: Administrativo, as: 'Administrativo' },
        { model: Caja, as: 'Caja' }
      ]
    });

    return NextResponse.json(pagoConRelaciones, { status: 201 });
  } catch (error) {
    console.error('Error al crear pago:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
