import { NextResponse } from 'next/server';
import { Producto } from '@/lib/db/models';

export async function GET(request) {
  try {
    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';
    const scope = includeInactive ? 'withInactive' : 'defaultScope';

    const productos = await Producto.scope(scope).findAll({
      order: [['id_producto', 'DESC']]
    });
    return NextResponse.json(productos);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { nombre, descripcion, precio, stock } = body;

    if (!nombre || !precio) {
      return NextResponse.json({
        error: 'Los campos nombre y precio son obligatorios'
      }, { status: 400 });
    }

    if (precio < 0) {
      return NextResponse.json({
        error: 'El precio no puede ser negativo'
      }, { status: 400 });
    }

    if (stock && stock < 0) {
      return NextResponse.json({
        error: 'El stock no puede ser negativo'
      }, { status: 400 });
    }

    const producto = await Producto.create({
      nombre: nombre.trim(),
      descripcion: descripcion ? descripcion.trim() : null,
      precio: parseFloat(precio),
      stock: stock ? parseInt(stock) : 0
    });

    return NextResponse.json(producto, { status: 201 });
  } catch (error) {
    console.error('Error al crear producto:', error);

    if (error.name === 'SequelizeValidationError') {
      return NextResponse.json({
        error: 'Datos de producto inválidos',
        details: error.errors.map(e => e.message)
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
