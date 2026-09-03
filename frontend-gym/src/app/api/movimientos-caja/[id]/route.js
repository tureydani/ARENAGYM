import { NextResponse } from 'next/server';
import sequelize from '@/lib/db/sequelize';
import { MovimientoCaja, Caja, Administrativo } from '@/lib/db/models';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const movimiento = await MovimientoCaja.findByPk(id, {
      include: [
        { model: Caja, as: 'Caja' },
        { model: Administrativo, as: 'Administrativo' }
      ]
    });
    if (!movimiento) return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
    return NextResponse.json(movimiento);
  } catch (error) {
    console.error('Error al obtener movimiento:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const movimiento = await MovimientoCaja.findByPk(id);
    if (!movimiento) return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });

    const body = await request.json();
    await movimiento.update(body);

    const movimientoActualizado = await MovimientoCaja.findByPk(id, {
      include: [
        { model: Caja, as: 'Caja' },
        { model: Administrativo, as: 'Administrativo' }
      ]
    });

    return NextResponse.json(movimientoActualizado);
  } catch (error) {
    console.error('Error al actualizar movimiento:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const movimiento = await MovimientoCaja.findByPk(id);
    if (!movimiento) return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });

    // Los movimientos con id_referencia vienen de un pago o una venta (el
    // trigger de la BD los crea automáticamente, o los crean las rutas de
    // eliminación de pagos/ventas como reversión). Borrarlos acá dejaría el
    // saldo de la caja desincronizado del pago/venta que sigue activo, o
    // borraría el rastro de una reversión ya hecha. Para esos casos hay que
    // eliminar el pago o la venta original, no el movimiento.
    if (movimiento.id_referencia !== null) {
      return NextResponse.json({
        error: `Este movimiento viene de ${movimiento.origen === 'Pago' ? 'un pago' : movimiento.origen === 'Venta' ? 'una venta' : 'otro registro'} y no se puede eliminar directamente. Elimina el ${movimiento.origen === 'Pago' ? 'pago' : 'registro'} original desde su propia sección.`
      }, { status: 400 });
    }

    // Revertir el efecto del movimiento en el saldo de la caja: un
    // Ingreso se resta, un Egreso se vuelve a sumar.
    const ajuste = movimiento.tipo_movimiento === 'Ingreso'
      ? -parseFloat(movimiento.monto)
      : parseFloat(movimiento.monto);

    // Solo un Ingreso puede dejar el saldo en negativo al revertirse (un
    // Egreso siempre lo aumenta). Si ese dinero ya se gastó con Egresos
    // posteriores, no se puede deshacer el Ingreso sin dejar la caja
    // negativa.
    if (ajuste < 0) {
      const caja = await Caja.findByPk(movimiento.id_caja);
      if (caja && parseFloat(caja.saldo_actual) + ajuste < 0) {
        return NextResponse.json({
          error: `No se puede eliminar: el saldo de ${caja.descripcion} quedaría en negativo (saldo actual Bs. ${parseFloat(caja.saldo_actual).toFixed(2)}, este ingreso era de Bs. ${parseFloat(movimiento.monto).toFixed(2)}). Ese dinero ya se usó en otros movimientos.`
        }, { status: 400 });
      }
    }

    const transaction = await sequelize.transaction();
    try {
      await Caja.update(
        { saldo_actual: sequelize.literal(`saldo_actual + (${ajuste})`) },
        { where: { id_caja: movimiento.id_caja }, transaction }
      );

      await movimiento.destroy({ transaction });
      await transaction.commit();

      const cajaActualizada = await Caja.findByPk(movimiento.id_caja);

      return NextResponse.json({
        message: "Movimiento eliminado correctamente",
        cajaAfectada: {
          id: cajaActualizada.id_caja,
          descripcion: cajaActualizada.descripcion,
          saldoActual: parseFloat(cajaActualizada.saldo_actual)
        }
      });
    } catch (error) {
      if (!transaction.finished) await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error al eliminar movimiento:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
