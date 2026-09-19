import { NextResponse } from 'next/server';
import sequelize from '@/lib/db/sequelize';
import { Caja } from '@/lib/db/models';
import { calcularResumenCaja } from '@/lib/db/cajaResumen';

// Cierre formal con arqueo: distinto de solo togglear `abierta`. Calcula el
// saldo esperado a partir de movimientos_caja, lo compara contra el dinero
// contado que ingresa el responsable, y deja la diferencia registrada para
// auditoría (nunca se oculta ni se impide el cierre por tenerla).
export async function POST(request, { params }) {
  const { id } = await params;
  const transaction = await sequelize.transaction();
  try {
    const body = await request.json();
    const { saldo_contado, id_admin } = body;

    if (!id_admin) {
      await transaction.rollback();
      return NextResponse.json({ error: 'Falta el administrativo responsable del cierre' }, { status: 400 });
    }

    const saldoContado = parseFloat(saldo_contado);
    if (Number.isNaN(saldoContado) || saldoContado < 0) {
      await transaction.rollback();
      return NextResponse.json({ error: 'El dinero contado debe ser un número mayor o igual a 0' }, { status: 400 });
    }

    // Bloquea la fila para que dos intentos de cierre simultáneos sobre la
    // misma caja no pasen ambos la validación de estado === 'ABIERTA'.
    const caja = await Caja.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!caja) {
      await transaction.rollback();
      return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 });
    }
    if (caja.estado === 'CERRADA') {
      await transaction.rollback();
      return NextResponse.json({ error: 'Esta caja ya está cerrada.' }, { status: 400 });
    }

    const { total_ingresos, total_egresos } = await calcularResumenCaja(caja.id_caja, { transaction });
    const saldoInicial = parseFloat(caja.saldo_inicial);
    const saldoEsperado = saldoInicial + total_ingresos - total_egresos;
    const diferencia = Math.round((saldoContado - saldoEsperado) * 100) / 100;

    await caja.update({
      fecha_cierre: new Date(),
      saldo_esperado: saldoEsperado,
      saldo_contado: saldoContado,
      diferencia,
      id_admin_cierre: id_admin,
      estado: 'CERRADA',
      abierta: false,
      // Se sincroniza saldo_actual con lo esperado al cerrar, por si algún
      // movimiento manual lo hubiera dejado desalineado.
      saldo_actual: saldoEsperado
    }, { transaction });

    await transaction.commit();

    const cajaCerrada = await Caja.findByPk(id);

    return NextResponse.json({
      message: diferencia === 0
        ? 'Caja cerrada correctamente. La caja cuadra.'
        : diferencia > 0
          ? `Caja cerrada correctamente. Sobrante de Bs. ${diferencia.toFixed(2)}.`
          : `Caja cerrada correctamente. Faltante de Bs. ${Math.abs(diferencia).toFixed(2)}.`,
      caja: cajaCerrada,
      saldo_inicial: saldoInicial,
      total_ingresos,
      total_egresos,
      saldo_esperado: saldoEsperado,
      saldo_contado: saldoContado,
      diferencia
    });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    console.error('Error al cerrar caja:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
