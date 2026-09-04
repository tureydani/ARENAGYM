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
    const { nombre, descripcion, precio, stock, precio_mayoreo, cantidad_mayoreo } = body;

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

    // El precio por mayor es opcional, pero si se define uno de los dos
    // campos (precio o cantidad mínima) el otro también es obligatorio,
    // y la cantidad mínima debe ser de al menos 2 unidades (con 1 no hay
    // "mayoreo").
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
    if (tieneMayoreo && parseFloat(precio_mayoreo) >= parseFloat(precio)) {
      return NextResponse.json({ error: 'El precio por mayor debe ser menor al precio normal' }, { status: 400 });
    }

    const producto = await Producto.create({
      nombre: nombre.trim(),
      descripcion: descripcion ? descripcion.trim() : null,
      precio: parseFloat(precio),
      stock: stock ? parseInt(stock) : 0,
      precio_mayoreo: tieneMayoreo ? parseFloat(precio_mayoreo) : null,
      cantidad_mayoreo: tieneCantidadMayoreo ? parseInt(cantidad_mayoreo) : null
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
