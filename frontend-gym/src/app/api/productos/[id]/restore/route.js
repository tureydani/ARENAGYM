import { NextResponse } from 'next/server';
import { Producto } from '@/lib/db/models';

// Nota: el controlador original (productosController.js) definía `restore` dos
// veces; en un objeto literal JS gana la última definición, que es la que se
// porta aquí (catch -> status 400 con mensaje genérico).
export async function PATCH(request, { params }) {
  const { id } = await params;
  try {
    const producto = await Producto.scope('withInactive').findByPk(id);

    if (!producto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    if (producto.activo) {
      return NextResponse.json({ error: 'El producto ya está activo' }, { status: 400 });
    }

    await producto.update({ activo: true });

    const productoActualizado = await Producto.findByPk(id);

    return NextResponse.json({
      message: "Producto restaurado exitosamente",
      producto: productoActualizado
    });
  } catch (error) {
    console.error('Error al restaurar producto:', error);
    return NextResponse.json({ error: 'Error al restaurar producto' }, { status: 400 });
  }
}
