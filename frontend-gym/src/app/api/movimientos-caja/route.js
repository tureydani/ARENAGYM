import { NextResponse } from 'next/server';
import sequelize from '@/lib/db/sequelize';
import { MovimientoCaja, Caja, Administrativo } from '@/lib/db/models';
import { mensajeErrorSaldoNegativo } from '@/lib/db/erroresCaja';

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

    if (parseFloat(monto) <= 0 || Number.isNaN(parseFloat(monto))) {
      return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 });
    }

    // Los movimientos de origen Pago/Venta no ajustan el saldo acá (lo hace
    // el trigger de la BD cuando se crea el pago/la venta); este endpoint
    // sirve para movimientos manuales. Un Egreso manual no puede dejar la
    // caja en negativo.
    const afectaSaldo = origen !== 'Pago' && origen !== 'Venta';

    const transaction = await sequelize.transaction();
    try {
      if (afectaSaldo) {
        // Bloquea la fila de la caja hasta que termine esta transacción, así
        // dos Egresos simultáneos sobre la misma caja no pueden leer el mismo
        // saldo "viejo" y pasar la validación los dos a la vez (condición de
        // carrera clásica: sin este lock, ambos verían saldo suficiente por
        // separado y la caja terminaría en negativo aunque cada uno, por su
        // cuenta, haya validado bien).
        const caja = await Caja.findByPk(id_caja, { transaction, lock: transaction.LOCK.UPDATE });
        if (!caja) {
          await transaction.rollback();
          return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 });
        }
        if (tipo_movimiento === 'Egreso' && parseFloat(monto) > parseFloat(caja.saldo_actual)) {
          await transaction.rollback();
          return NextResponse.json({
            error: `Saldo insuficiente en ${caja.descripcion}. Saldo disponible: Bs. ${parseFloat(caja.saldo_actual).toFixed(2)}, monto solicitado: Bs. ${parseFloat(monto).toFixed(2)}`
          }, { status: 400 });
        }

        const ajuste = tipo_movimiento === 'Ingreso' ? parseFloat(monto) : -parseFloat(monto);
        await Caja.update(
          { saldo_actual: sequelize.literal(`saldo_actual + (${ajuste})`) },
          { where: { id_caja }, transaction }
        );
      }

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
    const mensajeSaldo = mensajeErrorSaldoNegativo(error);
    if (mensajeSaldo) return NextResponse.json({ error: mensajeSaldo }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
