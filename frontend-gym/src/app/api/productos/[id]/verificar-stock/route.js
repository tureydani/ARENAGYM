import { NextResponse } from 'next/server';
import { Producto } from '@/lib/db/models';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const cantidad = request.nextUrl.searchParams.get('cantidad');

    const producto = await Producto.findByPk(id);
    if (!producto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    const cantidadSolicitada = parseInt(cantidad) || 1;
    const disponible = producto.stock >= cantidadSolicitada;

    return NextResponse.json({
      producto: {
        id: producto.id_producto,
        nombre: producto.nombre,
        stock_actual: producto.stock,
        precio: producto.precio
      },
      cantidad_solicitada: cantidadSolicitada,
      disponible,
      stock_faltante: disponible ? 0 : cantidadSolicitada - producto.stock
    });
  } catch (error) {
    console.error('Error al verificar stock:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
