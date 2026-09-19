import { NextResponse } from 'next/server';
import { Caja, Administrativo } from '@/lib/db/models';
import { calcularResumenCaja } from '@/lib/db/cajaResumen';

// Vista previa del cierre: lo que el sistema espera que haya en la caja
// ANTES de que el responsable cuente el dinero físico. No modifica nada.
export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const caja = await Caja.findByPk(id, {
      include: [{ model: Administrativo, as: 'AdminApertura', attributes: ['id_admin', 'nombre', 'apellido'], required: false }]
    });
    if (!caja) return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 });

    const { total_ingresos, total_egresos } = await calcularResumenCaja(caja.id_caja);
    const saldo_esperado = parseFloat(caja.saldo_inicial) + total_ingresos - total_egresos;

    return NextResponse.json({
      id_caja: caja.id_caja,
      descripcion: caja.descripcion,
      estado: caja.estado,
      fecha_apertura: caja.fecha_apertura,
      responsable_apertura: caja.AdminApertura
        ? `${caja.AdminApertura.nombre} ${caja.AdminApertura.apellido}`
        : null,
      saldo_inicial: parseFloat(caja.saldo_inicial),
      total_ingresos,
      total_egresos,
      saldo_esperado
    });
  } catch (error) {
    console.error('Error al calcular arqueo de caja:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
