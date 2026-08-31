import { NextResponse } from 'next/server';
import { Producto } from '@/lib/db/models';

// Nota: el controlador original definía `forceDelete` dos veces; se porta la
// última definición (sin el manejo especial de SequelizeForeignKeyConstraintError).
export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const producto = await Producto.scope('withInactive').findByPk(id);

    if (!producto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    await producto.destroy();

    return NextResponse.json({ message: "Producto eliminado permanentemente" });
  } catch (error) {
    console.error('Error al eliminar producto permanentemente:', error);
    return NextResponse.json({
      error: "Error al eliminar permanentemente. Puede que el producto tenga registros asociados.",
      details: error.message
    }, { status: 400 });
  }
}
