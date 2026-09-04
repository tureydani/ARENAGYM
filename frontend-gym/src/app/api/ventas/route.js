import { NextResponse } from 'next/server';
import sequelize from '@/lib/db/sequelize';
import { Venta, DetalleVenta, Usuario, Administrativo, Caja, Producto } from '@/lib/db/models';
import { mensajeErrorSaldoNegativo } from '@/lib/db/erroresCaja';

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
    const { id_usuario, id_admin, id_caja, fecha_venta, estado, productos } = body;
    let { total } = body;

    // Función para obtener fecha local en formato YYYY-MM-DD
    const getFechaHoy = () => {
      const hoy = new Date();
      const año = hoy.getFullYear();
      const mes = String(hoy.getMonth() + 1).padStart(2, '0');
      const dia = String(hoy.getDate()).padStart(2, '0');
      return `${año}-${mes}-${dia}`;
    };

    // Si la venta incluye productos del catálogo, el precio de cada línea lo
    // decide el backend a partir del producto real en la base de datos
    // (precio normal, o precio_mayoreo si la cantidad alcanza
    // cantidad_mayoreo) -- NUNCA a partir del precio_unitario que mande el
    // frontend, que ahí solo es una vista previa. Si no, cualquiera podría
    // mandar cualquier precio_unitario/total desde las devtools o un
    // cliente HTTP directo y pagar lo que quisiera. El total de la venta
    // también se recalcula como la suma de esas líneas, ignorando el
    // "total" que venga en el body cuando hay productos.
    //
    // Una venta SIN productos (el formulario manual de un solo total en
    // TablaVentas, sin línea de productos) no tiene contra qué recalcular,
    // así que ahí se mantiene el total que manda el admin, como antes.
    const detallesCalculados = [];
    if (productos && productos.length > 0) {
      let totalCalculado = 0;

      for (const item of productos) {
        const cantidad = parseInt(item.cantidad, 10);
        if (!item.id_producto || !Number.isInteger(cantidad) || cantidad <= 0) {
          await transaction.rollback();
          return NextResponse.json({ error: 'Cada producto debe tener un id_producto y una cantidad válida mayor a 0' }, { status: 400 });
        }

        const producto = await Producto.findByPk(item.id_producto, { transaction });
        if (!producto) {
          await transaction.rollback();
          return NextResponse.json({ error: `Producto con ID ${item.id_producto} no encontrado` }, { status: 404 });
        }

        if (producto.stock < cantidad) {
          await transaction.rollback();
          return NextResponse.json({
            error: `Stock insuficiente para ${producto.nombre}. Stock disponible: ${producto.stock}, cantidad solicitada: ${cantidad}`
          }, { status: 400 });
        }

        const aplicaMayoreo = producto.cantidad_mayoreo && producto.precio_mayoreo != null && cantidad >= producto.cantidad_mayoreo;
        const precioUnitario = aplicaMayoreo ? parseFloat(producto.precio_mayoreo) : parseFloat(producto.precio);

        totalCalculado += precioUnitario * cantidad;
        detallesCalculados.push({ id_producto: producto.id_producto, cantidad, precio_unitario: precioUnitario });
      }

      // Redondeo a centavos: evita arrastrar errores de punto flotante
      // (ej. 0.1 + 0.2) hacia la columna DECIMAL(10,2) de ventas.total.
      total = Math.round(totalCalculado * 100) / 100;
    }

    // El trigger de la BD suma total directo al saldo de la caja sin
    // ninguna validación propia -- un total negativo se colaría como una
    // forma de vaciar la caja sin pasar por ninguno de los controles de
    // Egreso. (total puede venir 0/undefined en la venta rápida sin
    // productos todavía seleccionados, así que solo se rechaza si es
    // explícitamente negativo.)
    if (total !== undefined && total !== null && parseFloat(total) < 0) {
      await transaction.rollback();
      return NextResponse.json({ error: 'El total no puede ser negativo' }, { status: 400 });
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

    // Crear detalles de venta (con el precio recalculado arriba) y
    // descontar el stock correspondiente.
    for (const item of detallesCalculados) {
      await DetalleVenta.create({
        id_venta: nuevaVenta.id_venta,
        id_producto: item.id_producto,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario
      }, { transaction });

      await Producto.update(
        { stock: sequelize.literal(`stock - ${item.cantidad}`) },
        {
          where: { id_producto: item.id_producto },
          transaction
        }
      );
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
    if (!transaction.finished) await transaction.rollback();
    console.error('Error al crear venta:', error);
    const mensajeSaldo = mensajeErrorSaldoNegativo(error);
    if (mensajeSaldo) return NextResponse.json({ error: mensajeSaldo }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
