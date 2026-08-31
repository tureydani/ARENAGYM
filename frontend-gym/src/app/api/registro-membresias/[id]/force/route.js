import { NextResponse } from 'next/server';
import { RegistroMembresia } from '@/lib/db/models';

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const registro = await RegistroMembresia.scope('withInactive').findByPk(id);
    if (!registro) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

    await registro.destroy();

    return NextResponse.json({ message: "Registro de membresía eliminado permanentemente" });
  } catch (error) {
    console.error('Error al eliminar permanentemente registro:', error);
    return NextResponse.json({
      error: "Error al eliminar permanentemente. Puede que el registro tenga pagos asociados.",
      details: error.message
    }, { status: 400 });
  }
}
