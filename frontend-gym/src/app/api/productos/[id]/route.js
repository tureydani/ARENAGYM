import { NextResponse } from 'next/server';
import { Producto } from '@/lib/db/models';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    // Buscar tanto en activos como inactivos
    const producto = await Producto.scope('withInactive').findByPk(id);

    if (!producto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    return NextResponse.json(producto);
  } catch (error) {
    console.error('Error al obtener producto:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { nombre, descripcion, precio, stock, precio_mayoreo, cantidad_mayoreo } = body;

    const producto = await Producto.findByPk(id);
    if (!producto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    if (precio !== undefined && precio < 0) {
      return NextResponse.json({
        error: 'El precio no puede ser negativo'
      }, { status: 400 });
    }

    if (stock !== undefined && stock < 0) {
      return NextResponse.json({
        error: 'El stock no puede ser negativo'
      }, { status: 400 });
    }

    const updateData = {};
    if (nombre !== undefined) updateData.nombre = nombre.trim();
    if (descripcion !== undefined) updateData.descripcion = descripcion ? descripcion.trim() : null;
    if (precio !== undefined) updateData.precio = parseFloat(precio);
    if (stock !== undefined) updateData.stock = parseInt(stock);

    // El precio por mayor solo se ACTUALIZA si el request trae
    // explícitamente alguno de los dos campos (para no pisar el valor
    // existente en updates parciales que no tocan el mayoreo). Pero la
    // comparación "mayoreo < normal" se valida siempre que exista una regla
    // de mayoreo vigente después de este update -- ya sea porque este mismo
    // request la está definiendo, o porque el producto ya la tenía y este
    // request solo está bajando el precio normal por debajo de ella.
    if (precio_mayoreo !== undefined || cantidad_mayoreo !== undefined) {
      const tieneMayoreo = precio_mayoreo !== undefined && precio_mayoreo !== null && precio_mayoreo !== '';
      const tieneCantidadMayoreo = cantidad_mayoreo !== undefined && cantidad_mayoreo !== null && cantidad_mayoreo !== '';
      if (tieneMayoreo !== tieneCantidadMayoreo) {
        return NextResponse.json({
          error: 'Para definir un precio por mayor debes indicar tanto el precio como la cantidad mínima'
        }, { status: 400 });
      }
      if (tieneMayoreo && parseFloat(precio_mayoreo) < 0) {
        return NextResponse.json({ error: 'El precio por mayor no puede ser negativo' }, { status: 400 });
      }
      if (tieneCantidadMayoreo && parseInt(cantidad_mayoreo) < 2) {
        return NextResponse.json({ error: 'La cantidad mínima para el precio por mayor debe ser al menos 2' }, { status: 400 });
      }
      updateData.precio_mayoreo = tieneMayoreo ? parseFloat(precio_mayoreo) : null;
      updateData.cantidad_mayoreo = tieneCantidadMayoreo ? parseInt(cantidad_mayoreo) : null;
    }

    const precioMayoreoVigente = updateData.precio_mayoreo !== undefined
      ? updateData.precio_mayoreo
      : (producto.precio_mayoreo != null ? parseFloat(producto.precio_mayoreo) : null);
    const precioNormalVigente = updateData.precio !== undefined ? updateData.precio : parseFloat(producto.precio);
    if (precioMayoreoVigente != null && precioMayoreoVigente >= precioNormalVigente) {
      return NextResponse.json({ error: 'El precio por mayor debe ser menor al precio normal' }, { status: 400 });
    }

    await producto.update(updateData);

    return NextResponse.json(producto);
  } catch (error) {
    console.error('Error al actualizar producto:', error);

    if (error.name === 'SequelizeValidationError') {
      return NextResponse.json({
        error: 'Datos de producto inválidos',
        details: error.errors.map(e => e.message)
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const producto = await Producto.scope('withInactive').findByPk(id);
    if (!producto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    if (!producto.activo) {
      return NextResponse.json({ error: 'El producto ya está eliminado' }, { status: 400 });
    }

    await producto.update({ activo: false });

    const productoActualizado = await Producto.scope('withInactive').findByPk(id);

    return NextResponse.json({
      message: 'Producto eliminado lógicamente',
      producto: productoActualizado
    });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
