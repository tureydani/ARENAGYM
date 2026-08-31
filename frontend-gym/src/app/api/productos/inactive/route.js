import { NextResponse } from 'next/server';
import { Producto } from '@/lib/db/models';

export async function GET() {
  try {
    const productos = await Producto.scope('onlyInactive').findAll({
      order: [['id_producto', 'ASC']]
    });
    return NextResponse.json(productos);
  } catch (error) {
    console.error('Error al obtener productos inactivos:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
