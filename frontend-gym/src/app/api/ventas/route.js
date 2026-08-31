import { NextResponse } from 'next/server';
import sequelize from '@/lib/db/sequelize';
import { Venta, DetalleVenta, Usuario, Administrativo, Caja, Producto } from '@/lib/db/models';

export async function GET(request) {
  try {
    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';
    const scope = includeInactive ? 'withInactive' : 'defaultScope';

    const ventas = await Venta.scope(scope).findAll({
      include: [
        { model: Usuario.scope('withInactive'), as: 'Usuario' },
        { model: Administrativo.scope('withInactive'), as: 'Administrativo' },
        { model: Caja, as: 'Caja' },
        {
          model: DetalleVenta,
          as: 'Detalles',
          include: [{ model: Producto, as: 'Producto' }]
        }
      ],
      order: [['fecha_venta', 'DESC'], ['id_venta', 'DESC']]
    });
    return NextResponse.json(ventas);
  } catch (error) {
    console.error('Error al obtener ventas:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const transaction = await sequelize.transaction();

  try {
    const body = await request.json();
    const { id_usuario, id_admin, id_caja, fecha_venta, total, estado, productos } = body;

    // Función para obtener fecha local en formato YYYY-MM-DD
    const getFechaHoy = () => {
      const hoy = new Date();
      const año = hoy.getFullYear();
      const mes = String(hoy.getMonth() + 1).padStart(2, '0');
      const dia = String(hoy.getDate()).padStart(2, '0');
      return `${año}-${mes}-${dia}`;
    };

    // Si incluye productos, validar stock antes de crear la venta
    if (productos && productos.length > 0) {
      for (const item of productos) {
        const producto = await Producto.findByPk(item.id_producto, { transaction });
        if (!producto) {
          await transaction.rollback();
          return NextResponse.json({ error: `Producto con ID ${item.id_producto} no encontrado` }, { status: 404 });
        }

        if (producto.stock < item.cantidad) {
          await transaction.rollback();
          return NextResponse.json({
            error: `Stock insuficiente para ${producto.nombre}. Stock disponible: ${producto.stock}, cantidad solicitada: ${item.cantidad}`
          }, { status: 400 });
        }
      }
    }

    // Crear la venta principal con valores por defecto
    const nuevaVenta = await Venta.create({
      id_usuario,
      id_admin: id_admin || 1,
      id_caja: id_caja || 1,
      fecha_venta: fecha_venta || getFechaHoy(),
      total: total || 0,
      estado: estado || 'Completada'
    }, { transaction });

    // Si incluye productos, crear detalles de venta y actualizar stock
    if (productos && productos.length > 0) {
      for (const item of productos) {
        // Crear detalle de venta
        await DetalleVenta.create({
          id_venta: nuevaVenta.id_venta,
          id_producto: item.id_producto,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario
        }, { transaction });

        // Actualizar stock del producto
        await Producto.update(
          { stock: sequelize.literal(`stock - ${item.cantidad}`) },
          {
            where: { id_producto: item.id_producto },
            transaction
          }
        );
      }
    }

    await transaction.commit();

    // El trigger automáticamente:
    // 1. Actualiza el saldo de la caja
    // 2. Crea el movimiento en movimientos_caja
    // No necesitamos hacerlo manualmente aquí

    // Obtener la venta completa con relaciones
    const ventaCompleta = await Venta.findByPk(nuevaVenta.id_venta, {
      include: [
        { model: Usuario, as: 'Usuario' },
        { model: Administrativo, as: 'Administrativo' },
        { model: Caja, as: 'Caja' },
        {
          model: DetalleVenta,
          as: 'Detalles',
          include: [{ model: Producto, as: 'Producto' }]
        }
      ]
    });

    return NextResponse.json(ventaCompleta, { status: 201 });
  } catch (error) {
    await transaction.rollback();
    console.error('Error al crear venta:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
