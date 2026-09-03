import { NextResponse } from 'next/server';
import sequelize from '@/lib/db/sequelize';
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

    // Los movimientos de origen Pago/Venta no ajustan el saldo acá (lo hace
    // el trigger de la BD cuando se crea el pago/la venta); este endpoint
    // sirve para movimientos manuales. Un Egreso manual no puede dejar la
    // caja en negativo.
    const afectaSaldo = origen !== 'Pago' && origen !== 'Venta';

    if (afectaSaldo && tipo_movimiento === 'Egreso') {
      const caja = await Caja.findByPk(id_caja);
      if (!caja) {
        return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 });
      }
      if (parseFloat(monto) > parseFloat(caja.saldo_actual)) {
        return NextResponse.json({
          error: `Saldo insuficiente en ${caja.descripcion}. Saldo disponible: Bs. ${parseFloat(caja.saldo_actual).toFixed(2)}, monto solicitado: Bs. ${parseFloat(monto).toFixed(2)}`
        }, { status: 400 });
      }
    }

    const transaction = await sequelize.transaction();
    try {
      // Crear el movimiento
      const movimiento = await MovimientoCaja.create({
        id_caja,
        id_admin,
        tipo_movimiento,
        descripcion,
        monto,
        origen,
        id_referencia
      }, { transaction });

      if (afectaSaldo) {
        const ajuste = tipo_movimiento === 'Ingreso' ? parseFloat(monto) : -parseFloat(monto);
        await Caja.update(
          { saldo_actual: sequelize.literal(`saldo_actual + (${ajuste})`) },
          { where: { id_caja }, transaction }
        );
      }

      await transaction.commit();

      // Retornar el movimiento con relaciones
      const movimientoCompleto = await MovimientoCaja.findByPk(movimiento.id_movimiento, {
        include: [
          { model: Caja, as: 'Caja' },
          { model: Administrativo, as: 'Administrativo' }
        ]
      });

      return NextResponse.json(movimientoCompleto, { status: 201 });
    } catch (error) {
      if (!transaction.finished) await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error al crear movimiento:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
