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
    const { nombre, descripcion, precio, stock } = body;

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
