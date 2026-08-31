import { NextResponse } from 'next/server';
import { MovimientoCaja, Caja, Administrativo } from '@/lib/db/models';

export async function GET() {
  try {
    const movimientos = await MovimientoCaja.findAll({
      include: [
        { model: Caja, as: 'Caja' },
        { model: Administrativo, as: 'Administrativo' }
      ],
      order: [['fecha_movimiento', 'DESC'], ['id_movimiento', 'DESC']]
    });
    return NextResponse.json(movimientos);
  } catch (error) {
    console.error('Error al obtener movimientos de caja:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { id_caja, id_admin, tipo_movimiento, descripcion, monto, origen, id_referencia } = body;

    // Crear el movimiento
    const movimiento = await MovimientoCaja.create({
      id_caja,
      id_admin,
      tipo_movimiento,
      descripcion,
      monto,
      origen,
      id_referencia
    });

    // Solo actualizar el saldo si es un movimiento manual (no viene de Pago o Venta)
    // Los triggers ya manejan automáticamente los movimientos de Pago y Venta
    if (origen !== 'Pago' && origen !== 'Venta') {
      const caja = await Caja.findByPk(id_caja);
      if (caja) {
        if (tipo_movimiento === 'Ingreso') {
          caja.saldo_actual = parseFloat(caja.saldo_actual) + parseFloat(monto);
        } else {
          caja.saldo_actual = parseFloat(caja.saldo_actual) - parseFloat(monto);
        }
        await caja.save();
      }
    }

    // Retornar el movimiento con relaciones
    const movimientoCompleto = await MovimientoCaja.findByPk(movimiento.id_movimiento, {
      include: [
        { model: Caja, as: 'Caja' },
        { model: Administrativo, as: 'Administrativo' }
      ]
    });

    return NextResponse.json(movimientoCompleto, { status: 201 });
  } catch (error) {
    console.error('Error al crear movimiento:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
