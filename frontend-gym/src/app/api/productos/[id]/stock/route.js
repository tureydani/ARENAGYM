import { NextResponse } from 'next/server';
import { Producto } from '@/lib/db/models';

export async function PATCH(request, { params }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { cantidad, operacion } = body; // operacion: 'suma' o 'resta'

    const producto = await Producto.findByPk(id);
    if (!producto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    if (!cantidad || cantidad <= 0) {
      return NextResponse.json({
        error: 'La cantidad debe ser mayor a 0'
      }, { status: 400 });
    }

    let nuevoStock = producto.stock;

    if (operacion === 'suma') {
      nuevoStock += parseInt(cantidad);
    } else if (operacion === 'resta') {
      nuevoStock -= parseInt(cantidad);
      if (nuevoStock < 0) {
        return NextResponse.json({
          error: 'No hay suficiente stock disponible'
        }, { status: 400 });
      }
    } else {
      return NextResponse.json({
        error: 'Operación inválida. Use "suma" o "resta"'
      }, { status: 400 });
    }

    await producto.update({ stock: nuevoStock });

    return NextResponse.json(producto);
  } catch (error) {
    console.error('Error al actualizar stock:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
