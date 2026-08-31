import { NextResponse } from 'next/server';
import Administrativo from '@/lib/db/models/administrativo';
import Usuario from '@/lib/db/models/usuario';
import Pago from '@/lib/db/models/pago';
import RegistroMembresia from '@/lib/db/models/registroMembresia';
import Venta from '@/lib/db/models/venta';

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const admin = await Administrativo.scope('withInactive').findByPk(id);
    if (!admin) {
      return NextResponse.json({
        error: "Administrativo no encontrado"
      }, { status: 404 });
    }

    const [usuarios, pagos, registros, ventas] = await Promise.all([
      Usuario.count({ where: { registrado_por: id } }),
      Pago.count({ where: { id_admin: id } }),
      RegistroMembresia.count({ where: { id_admin: id } }),
      Venta.count({ where: { id_admin: id } })
    ]);

    const totalRegistros = usuarios + pagos + registros + ventas;

    if (totalRegistros > 0) {
      return NextResponse.json({
        error: "No se puede eliminar permanentemente",
        message: `Este administrativo tiene ${totalRegistros} registro(s) asociado(s)`,
        details: {
          usuarios,
          pagos,
          registros_membresias: registros,
          ventas
        }
      }, { status: 409 });
    }

    await admin.destroy();

    return NextResponse.json({
      message: "Administrativo eliminado permanentemente",
      id
    });
  } catch (error) {
    console.error('Error al eliminar permanentemente administrativo:', error);
    return NextResponse.json({
      error: "Error al eliminar permanentemente. Puede que el administrativo tenga registros asociados.",
      details: error.message
    }, { status: 400 });
  }
}
