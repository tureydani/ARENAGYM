import { NextResponse } from 'next/server';
import { Op } from 'sequelize';
import { Fondo, MovimientoFinanciero } from '@/lib/db/models';
import { requerirLecturaFinanzas } from '@/lib/auth/permisosFinanzas';

// Dinero total controlado = suma de saldo_actual de fondos activos.
// Ingresos/egresos del período EXCLUYEN categoria=TRANSFERENCIA (mover
// dinero entre fondos no es un ingreso/egreso real de la empresa, ver
// diseño acordado) -- se reportan aparte.
export async function GET(request) {
  const { error } = await requerirLecturaFinanzas(request);
  if (error) return NextResponse.json(error.body, { status: error.status });

  try {
    const params = request.nextUrl.searchParams;
    const fecha_desde = params.get('fecha_desde');
    const fecha_hasta = params.get('fecha_hasta');
    const whereFecha = {};
    if (fecha_desde || fecha_hasta) {
      whereFecha.fecha_movimiento = {};
      if (fecha_desde) whereFecha.fecha_movimiento[Op.gte] = new Date(fecha_desde);
      if (fecha_hasta) whereFecha.fecha_movimiento[Op.lte] = new Date(fecha_hasta);
    }

    const fondos = await Fondo.findAll();
    const dineroTotalControlado = fondos.reduce((sum, f) => sum + parseFloat(f.saldo_actual), 0);

    const [ingresos, egresos, transferencias] = await Promise.all([
      MovimientoFinanciero.sum('monto', { where: { ...whereFecha, tipo: 'INGRESO', categoria: { [Op.ne]: 'TRANSFERENCIA' }, activo: true } }),
      MovimientoFinanciero.sum('monto', { where: { ...whereFecha, tipo: 'EGRESO', categoria: { [Op.ne]: 'TRANSFERENCIA' }, activo: true } }),
      MovimientoFinanciero.sum('monto', { where: { ...whereFecha, categoria: 'TRANSFERENCIA', tipo: 'EGRESO', activo: true } })
    ]);

    return NextResponse.json({
      dinero_total_controlado: dineroTotalControlado,
      ingresos_periodo: parseFloat(ingresos) || 0,
      egresos_periodo: parseFloat(egresos) || 0,
      transferencias_internas_periodo: parseFloat(transferencias) || 0,
      fondos: fondos.map(f => ({ id_fondo: f.id_fondo, nombre: f.nombre, tipo_fondo: f.tipo_fondo, saldo_actual: parseFloat(f.saldo_actual) }))
    });
  } catch (err) {
    console.error('Error al calcular resumen de finanzas:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
