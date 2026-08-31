import { NextResponse } from 'next/server';
import { Membresia } from '@/lib/db/models';

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const membresia = await Membresia.scope('withInactive').findByPk(id);
    if (!membresia) return NextResponse.json({ error: "Membresía no encontrada" }, { status: 404 });

    if (membresia.activo) {
      return NextResponse.json({ error: "La membresía ya está activa" }, { status: 400 });
    }

    await membresia.update({ activo: true });

    const membresiaActualizada = await Membresia.findByPk(id);

    return NextResponse.json({
      message: "Membresía restaurada exitosamente",
      membresia: membresiaActualizada
    });
  } catch (error) {
    console.error('Error al restaurar membresía:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
