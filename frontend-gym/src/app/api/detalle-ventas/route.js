import { NextResponse } from 'next/server';
import sequelize from '@/lib/db/sequelize';
import DetalleVenta from '@/lib/db/models/detalleVenta';
import Venta from '@/lib/db/models/venta';
import Producto from '@/lib/db/models/producto';

export async function GET() {
  try {
    const detalles = await DetalleVenta.findAll({
      include: [
        { model: Venta, as: 'Venta' },
        { model: Producto, as: 'Producto' }
      ]
    });
    return NextResponse.json(detalles);
  } catch (error) {
    console.error('Error al obtener detalles de venta:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const transaction = await sequelize.transaction();

  try {
    const body = await request.json();
    const { id_venta, id_producto, cantidad, precio_unitario, skip_stock_update = false } = body;

    // Si no se debe saltar la actualización de stock, validar stock disponible
    if (!skip_stock_update) {
      const producto = await Producto.findByPk(id_producto, { transaction });
      if (!producto) {
        await transaction.rollback();
        return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
      }

      if (producto.stock < cantidad) {
        await transaction.rollback();
        return NextResponse.json({
          error: `Stock insuficiente para ${producto.nombre}. Stock disponible: ${producto.stock}, cantidad solicitada: ${cantidad}`
        }, { status: 400 });
      }
    }

    // Crear detalle de venta
    const nuevoDetalle = await DetalleVenta.create({
      id_venta,
      id_producto,
      cantidad,
      precio_unitario
    }, { transaction });

    // Si no se debe saltar la actualización, actualizar stock del producto
    if (!skip_stock_update) {
      await Producto.update(
        { stock: sequelize.literal(`stock - ${cantidad}`) },
        {
          where: { id_producto },
          transaction
        }
      );
    }

    await transaction.commit();

    // Obtener el detalle completo con relaciones
    const detalleCompleto = await DetalleVenta.findByPk(nuevoDetalle.id_detalle, {
      include: [
        { model: Venta, as: 'Venta' },
        { model: Producto, as: 'Producto' }
      ]
    });

    return NextResponse.json(detalleCompleto, { status: 201 });
  } catch (error) {
    await transaction.rollback();
    console.error('Error al crear detalle de venta:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
