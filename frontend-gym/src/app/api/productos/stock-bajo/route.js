import { NextResponse } from 'next/server';
import { Op } from 'sequelize';
import { Producto } from '@/lib/db/models';

export async function GET(request) {
  try {
    const limiteParam = request.nextUrl.searchParams.get('limite');
    const limite = limiteParam !== null ? limiteParam : 5; // Stock mínimo considerado como "bajo"

    // Solo productos activos con stock bajo
    const productos = await Producto.findAll({
      where: {
        stock: {
          [Op.lte]: parseInt(limite)
        },
        activo: true
      },
      order: [['stock', 'ASC']],
      attributes: ['id_producto', 'nombre', 'descripcion', 'precio', 'stock']
    });

    return NextResponse.json({
      limite_configurado: parseInt(limite),
      productos_con_stock_bajo: productos,
      total: productos.length
    });
  } catch (error) {
    console.error('Error al obtener productos con stock bajo:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
