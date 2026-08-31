import { NextResponse } from 'next/server';
import sequelize from '@/lib/db/sequelize';
import { DetalleVenta, Venta, Producto } from '@/lib/db/models';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const detalle = await DetalleVenta.findByPk(id, {
      include: [
        { model: Venta, as: 'Venta' },
        { model: Producto, as: 'Producto' }
      ]
    });
    if (!detalle) return NextResponse.json({ error: "Detalle no encontrado" }, { status: 404 });
    return NextResponse.json(detalle);
  } catch (error) {
    console.error('Error al obtener detalle de venta:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const transaction = await sequelize.transaction();

  try {
    const detalleOriginal = await DetalleVenta.findByPk(id, {
      include: [{ model: Producto, as: 'Producto' }],
      transaction
    });

    if (!detalleOriginal) {
      await transaction.rollback();
      return NextResponse.json({ error: "Detalle no encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const { cantidad: nuevaCantidad, precio_unitario } = body;

    // Si se está actualizando la cantidad, validar stock
    if (nuevaCantidad !== undefined && nuevaCantidad !== detalleOriginal.cantidad) {
      const diferencia = nuevaCantidad - detalleOriginal.cantidad;

      if (diferencia > 0) {
        // Se está aumentando la cantidad, verificar stock disponible
        const producto = await Producto.findByPk(detalleOriginal.id_producto, { transaction });
        if (producto.stock < diferencia) {
          await transaction.rollback();
          return NextResponse.json({
            error: `Stock insuficiente para ${producto.nombre}. Stock disponible: ${producto.stock}, cantidad adicional solicitada: ${diferencia}`
          }, { status: 400 });
        }

        // Descontar del stock
        await Producto.update(
          { stock: sequelize.literal(`stock - ${diferencia}`) },
          {
            where: { id_producto: detalleOriginal.id_producto },
            transaction
          }
        );
      } else {
        // Se está disminuyendo la cantidad, devolver al stock
        const cantidadADevolver = Math.abs(diferencia);
        await Producto.update(
          { stock: sequelize.literal(`stock + ${cantidadADevolver}`) },
          {
            where: { id_producto: detalleOriginal.id_producto },
            transaction
          }
        );
      }
    }

    // Actualizar el detalle
    const updateData = {};
    if (nuevaCantidad !== undefined) updateData.cantidad = nuevaCantidad;
    if (precio_unitario !== undefined) updateData.precio_unitario = precio_unitario;

    await detalleOriginal.update(updateData, { transaction });

    await transaction.commit();

    const detalleActualizado = await DetalleVenta.findByPk(id, {
      include: [
        { model: Venta, as: 'Venta' },
        { model: Producto, as: 'Producto' }
      ]
    });

    return NextResponse.json(detalleActualizado);
  } catch (error) {
    await transaction.rollback();
    console.error('Error al actualizar detalle de venta:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const transaction = await sequelize.transaction();

  try {
    const detalle = await DetalleVenta.findByPk(id, {
      include: [{ model: Producto, as: 'Producto' }],
      transaction
    });

    if (!detalle) {
      await transaction.rollback();
      return NextResponse.json({ error: "Detalle no encontrado" }, { status: 404 });
    }

    // Restaurar stock antes de eliminar el detalle
    await Producto.update(
      { stock: sequelize.literal(`stock + ${detalle.cantidad}`) },
      {
        where: { id_producto: detalle.id_producto },
        transaction
      }
    );

    await detalle.destroy({ transaction });

    await transaction.commit();
    return NextResponse.json({ message: "Detalle eliminado correctamente y stock restaurado" });
  } catch (error) {
    await transaction.rollback();
    console.error('Error al eliminar detalle de venta:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
