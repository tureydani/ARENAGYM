import { NextResponse } from 'next/server';
import { Caja, Administrativo } from '@/lib/db/models';
import { calcularResumenCaja } from '@/lib/db/cajaResumen';

// Vista previa del cierre: lo que el sistema espera que haya en la jornada
// ANTES de que el responsable cuente el efectivo físico. No modifica nada.
//
// Separa explícitamente (ver diseño acordado, Fase 5):
//   saldo_registrado = saldo_inicial + ingresos(todos los canales) - egresos(todos los canales)
//   efectivo_esperado = saldo_inicial + ingresos(Efectivo) - egresos(Efectivo)
// El saldo_inicial se asume 100% efectivo (es lo único que se cuenta
// físicamente al abrir la jornada). El arqueo de cierre se hace SIEMPRE
// sobre efectivo_esperado, nunca sobre saldo_registrado.
export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const caja = await Caja.findByPk(id, {
      include: [{ model: Administrativo, as: 'AdminApertura', attributes: ['id_admin', 'nombre', 'apellido'], required: false }]
    });
    if (!caja) return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 });

    const resumen = await calcularResumenCaja(caja.id_caja);
    const saldoInicial = parseFloat(caja.saldo_inicial);
    const saldo_registrado = saldoInicial + resumen.total_ingresos - resumen.total_egresos;
    const efectivo_esperado = saldoInicial + resumen.total_ingresos_efectivo - resumen.total_egresos_efectivo;

    return NextResponse.json({
      id_caja: caja.id_caja,
      descripcion: caja.descripcion,
      estado: caja.estado,
      fecha_apertura: caja.fecha_apertura,
      responsable_apertura: caja.AdminApertura
        ? `${caja.AdminApertura.nombre} ${caja.AdminApertura.apellido}`
        : null,
      saldo_inicial: saldoInicial,
      total_ingresos: resumen.total_ingresos,
      total_egresos: resumen.total_egresos,
      saldo_registrado,
      // saldo_esperado se conserva como alias de saldo_registrado por
      // compatibilidad con consumidores existentes del endpoint.
      saldo_esperado: saldo_registrado,
      total_ingresos_efectivo: resumen.total_ingresos_efectivo,
      total_egresos_efectivo: resumen.total_egresos_efectivo,
      efectivo_esperado,
      desglose_por_canal: resumen.desglose_por_canal
    });
  } catch (error) {
    console.error('Error al calcular arqueo de caja:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
