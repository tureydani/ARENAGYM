import { NextResponse } from 'next/server';
import { Producto } from '@/lib/db/models';

export async function POST(request) {
  try {
    const body = await request.json();
    const { productos } = body; // Array de {id_producto, cantidad}

    if (!productos || !Array.isArray(productos)) {
      return NextResponse.json({
        error: 'Debe proporcionar un array de productos con id_producto y cantidad'
      }, { status: 400 });
    }

    const resultados = [];
    let todasDisponibles = true;

    for (const item of productos) {
      const producto = await Producto.findByPk(item.id_producto);
      if (!producto) {
        resultados.push({
          id_producto: item.id_producto,
          error: 'Producto no encontrado',
          disponible: false
        });
        todasDisponibles = false;
        continue;
      }

      const disponible = producto.stock >= item.cantidad;
      if (!disponible) todasDisponibles = false;

      resultados.push({
        id_producto: producto.id_producto,
        nombre: producto.nombre,
        stock_actual: producto.stock,
        cantidad_solicitada: item.cantidad,
        disponible,
        stock_faltante: disponible ? 0 : item.cantidad - producto.stock
      });
    }

    return NextResponse.json({
      todas_disponibles: todasDisponibles,
      productos: resultados
    });
  } catch (error) {
    console.error('Error al verificar stock múltiple:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
