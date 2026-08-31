import { NextResponse } from 'next/server';
import { Membresia } from '@/lib/db/models';

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const membresia = await Membresia.scope('withInactive').findByPk(id);
    if (!membresia) return NextResponse.json({ error: "Membresía no encontrada" }, { status: 404 });

    await membresia.destroy();

    return NextResponse.json({ message: "Membresía eliminada permanentemente" });
  } catch (error) {
    return NextResponse.json({
      error: "Error al eliminar permanentemente. Puede que la membresía tenga registros asociados.",
      details: error.message
    }, { status: 400 });
  }
}
