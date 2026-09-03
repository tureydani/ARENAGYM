import { NextResponse } from 'next/server';
import { Pago, RegistroMembresia, Administrativo, Caja } from '@/lib/db/models';
import { mensajeErrorSaldoNegativo } from '@/lib/db/erroresCaja';

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

    // El trigger de la BD suma monto_pagado directo al saldo de la caja sin
    // ninguna validación propia -- un monto negativo (o 0) se colaría como
    // una forma de vaciar la caja sin pasar por ninguno de los controles de
    // Egreso.
    if (parseFloat(monto_pagado) <= 0 || Number.isNaN(parseFloat(monto_pagado))) {
      return NextResponse.json({ error: 'El monto pagado debe ser mayor a 0' }, { status: 400 });
    }

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
    const mensajeSaldo = mensajeErrorSaldoNegativo(error);
    if (mensajeSaldo) return NextResponse.json({ error: mensajeSaldo }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
