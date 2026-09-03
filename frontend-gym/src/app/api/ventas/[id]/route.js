import { NextResponse } from 'next/server';
import sequelize from '@/lib/db/sequelize';
import { Venta, DetalleVenta, Usuario, Administrativo, Caja, Producto, MovimientoCaja } from '@/lib/db/models';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const venta = await Venta.scope('withInactive').findByPk(id, {
      include: [
        { model: Usuario.scope('withInactive'), as: 'Usuario' },
        { model: Administrativo.scope('withInactive'), as: 'Administrativo' },
        { model: Caja, as: 'Caja' },
        {
          model: DetalleVenta,
          as: 'Detalles',
          include: [{ model: Producto, as: 'Producto' }]
        }
      ]
    });
    if (!venta) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    return NextResponse.json(venta);
  } catch (error) {
    console.error('Error al obtener venta:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const venta = await Venta.findByPk(id);
    if (!venta) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const body = await request.json();

    // Mismo caso que en pagos: si cambia la caja y/o el total, hay que
    // mover el dinero de verdad, si no el saldo queda reflejado en la
    // caja vieja mientras el registro apunta a la nueva.
    const oldCajaId = venta.id_caja;
    const oldTotal = parseFloat(venta.total);
    const newCajaId = body.id_caja !== undefined ? parseInt(body.id_caja) : oldCajaId;
    const newTotal = body.total !== undefined ? parseFloat(body.total) : oldTotal;
    const huboCambioDeDinero = newCajaId !== oldCajaId || newTotal !== oldTotal;

    if (huboCambioDeDinero) {
      const transaction = await sequelize.transaction();
      try {
        if (newCajaId !== oldCajaId) {
          const cajaAnterior = await Caja.findByPk(oldCajaId, { transaction });
          if (cajaAnterior && parseFloat(cajaAnterior.saldo_actual) - oldTotal < 0) {
            await transaction.rollback();
            return NextResponse.json({
              error: `No se puede cambiar de caja: el saldo de ${cajaAnterior.descripcion} quedaría en negativo (saldo actual Bs. ${parseFloat(cajaAnterior.saldo_actual).toFixed(2)}, esta venta era de Bs. ${oldTotal.toFixed(2)}). Ese dinero ya se usó en otros movimientos de esa caja.`
            }, { status: 400 });
          }

          await Caja.update(
            { saldo_actual: sequelize.literal(`saldo_actual - (${oldTotal})`) },
            { where: { id_caja: oldCajaId }, transaction }
          );
          await MovimientoCaja.create({
            id_caja: oldCajaId,
            id_admin: venta.id_admin,
            tipo_movimiento: 'Egreso',
            descripcion: `Corrección: venta movida a otra caja (ID Venta: ${venta.id_venta})`,
            monto: oldTotal,
            origen: 'Reembolso',
            id_referencia: venta.id_venta
          }, { transaction });

          await Caja.update(
            { saldo_actual: sequelize.literal(`saldo_actual + (${newTotal})`) },
            { where: { id_caja: newCajaId }, transaction }
          );
          await MovimientoCaja.create({
            id_caja: newCajaId,
            id_admin: venta.id_admin,
            tipo_movimiento: 'Ingreso',
            descripcion: `Corrección: venta movida desde otra caja (ID Venta: ${venta.id_venta})`,
            monto: newTotal,
            origen: 'Venta',
            id_referencia: venta.id_venta
          }, { transaction });
        } else {
          const delta = newTotal - oldTotal;
          if (delta !== 0) {
            const caja = await Caja.findByPk(oldCajaId, { transaction });
            if (delta < 0 && caja && parseFloat(caja.saldo_actual) + delta < 0) {
              await transaction.rollback();
              return NextResponse.json({
                error: `No se puede reducir el total: el saldo de ${caja.descripcion} quedaría en negativo (saldo actual Bs. ${parseFloat(caja.saldo_actual).toFixed(2)}).`
              }, { status: 400 });
            }
            await Caja.update(
              { saldo_actual: sequelize.literal(`saldo_actual + (${delta})`) },
              { where: { id_caja: oldCajaId }, transaction }
            );
            await MovimientoCaja.create({
              id_caja: oldCajaId,
              id_admin: venta.id_admin,
              tipo_movimiento: delta > 0 ? 'Ingreso' : 'Egreso',
              descripcion: `Corrección de total de venta (ID Venta: ${venta.id_venta})`,
              monto: Math.abs(delta),
              origen: delta > 0 ? 'Venta' : 'Reembolso',
              id_referencia: venta.id_venta
            }, { transaction });
          }
        }

        await venta.update(body, { transaction });
        await transaction.commit();
      } catch (error) {
        if (!transaction.finished) await transaction.rollback();
        throw error;
      }
    } else {
      await venta.update(body);
    }

    const ventaActualizada = await Venta.findByPk(id, {
      include: [
        { model: Usuario, as: 'Usuario' },
        { model: Administrativo, as: 'Administrativo' },
        { model: Caja, as: 'Caja' }
      ]
    });

    return NextResponse.json(ventaActualizada);
  } catch (error) {
    console.error('Error al actualizar venta:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const transaction = await sequelize.transaction();
  try {
    const venta = await Venta.scope('withInactive').findByPk(id, {
      include: [
        { model: DetalleVenta, as: 'Detalles', include: [{ model: Producto, as: 'Producto' }] },
        { model: Usuario.scope('withInactive'), as: 'Usuario' },
        { model: Caja, as: 'Caja' }
      ],
      transaction
    });

    if (!venta) {
      await transaction.rollback();
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
    }

    if (venta.Caja && parseFloat(venta.Caja.saldo_actual) - parseFloat(venta.total) < 0) {
      await transaction.rollback();
      return NextResponse.json({
        error: `No se puede eliminar: el saldo de ${venta.Caja.descripcion} quedaría en negativo (saldo actual Bs. ${parseFloat(venta.Caja.saldo_actual).toFixed(2)}, esta venta era de Bs. ${parseFloat(venta.total).toFixed(2)}). Ese dinero ya se usó en otros movimientos de la caja.`
      }, { status: 400 });
    }

    // Obtener información del cliente para el movimiento
    const nombreCliente = venta.Usuario ? `${venta.Usuario.nombre} ${venta.Usuario.apellido}` : 'Cliente desconocido';

    // 1. Restaurar stock de productos antes de eliminar
    for (const detalle of venta.Detalles) {
      await Producto.update(
        { stock: sequelize.literal(`stock + ${detalle.cantidad}`) },
        { where: { id_producto: detalle.id_producto }, transaction }
      );
    }

    // 2. Restar el total de la venta de la caja
    await Caja.update(
      { saldo_actual: sequelize.literal(`saldo_actual - ${venta.total}`) },
      { where: { id_caja: venta.id_caja }, transaction }
    );

    // 3. Crear movimiento de egreso en la tabla de movimientos
    await MovimientoCaja.create({
      id_caja: venta.id_caja,
      id_admin: venta.id_admin,
      tipo_movimiento: 'Egreso',
      descripcion: `Eliminación de venta de productos a ${nombreCliente} (ID Venta: ${venta.id_venta})`,
      monto: venta.total,
      origen: 'Reembolso',
      id_referencia: venta.id_venta
    }, { transaction });

    // 4. Eliminar detalles de venta (hard delete ya que no tienen soft delete)
    await DetalleVenta.destroy({
      where: { id_venta: id },
      transaction
    });

    // 5. Marcar la venta como eliminada (soft delete usando estado)
    await Venta.update(
      { estado: 'Eliminada' },
      { where: { id_venta: venta.id_venta }, transaction }
    );

    await transaction.commit();

    // Obtener saldo actualizado de la caja
    const cajaActualizada = await Caja.findByPk(venta.id_caja);

    return NextResponse.json({
      message: "Venta eliminada correctamente, stock restaurado y caja actualizada",
      montoVenta: venta.total,
      productosRestaurados: venta.Detalles.length,
      cajaAfectada: {
        id: cajaActualizada.id_caja,
        descripcion: cajaActualizada.descripcion,
        saldoAnterior: parseFloat(cajaActualizada.saldo_actual) + parseFloat(venta.total),
        saldoActual: parseFloat(cajaActualizada.saldo_actual),
        diferencia: -parseFloat(venta.total)
      },
      cliente: nombreCliente
    });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    console.error('Error al eliminar venta:', error);
    return NextResponse.json({
      error: "Error al eliminar venta: " + error.message,
      details: "No se pudo completar la eliminación de la venta, restauración de stock y actualización de caja"
    }, { status: 500 });
  }
}
