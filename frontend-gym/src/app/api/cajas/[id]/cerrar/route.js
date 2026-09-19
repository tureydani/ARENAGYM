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

    const resumen = await calcularResumenCaja(caja.id_caja, { transaction });
    const saldoInicial = parseFloat(caja.saldo_inicial);
    // Saldo registrado: los 4 canales juntos. Es informativo, NO es lo que
    // se arquea (no se puede contar físicamente el QR/Transferencia/
    // Tarjeta). Se recalcula siempre desde movimientos_caja -- no se
    // persiste, porque los movimientos son inmutables y alcanza con volver
    // a sumarlos si hace falta después.
    const saldoRegistrado = saldoInicial + resumen.total_ingresos - resumen.total_egresos;
    // Efectivo esperado: lo único que se cuenta al cerrar. Esto es lo que
    // se guarda en cajas.saldo_esperado / se compara contra saldo_contado.
    const efectivoEsperado = saldoInicial + resumen.total_ingresos_efectivo - resumen.total_egresos_efectivo;
    const diferencia = Math.round((saldoContado - efectivoEsperado) * 100) / 100;

    await caja.update({
      fecha_cierre: new Date(),
      saldo_esperado: efectivoEsperado,
      saldo_contado: saldoContado,
      diferencia,
      id_admin_cierre: id_admin,
      estado: 'CERRADA',
      abierta: false
      // NO se toca saldo_actual: es un valor histórico (puede diferir de lo
      // recalculado desde movimientos_caja por eventos previos a este
      // flujo de cajas). Cerrar la jornada no debe "corregir" esa
      // diferencia por la puerta trasera -- si existe, queda expuesta en
      // `diferencia` para auditoría, nunca oculta reescribiendo el saldo.
      // El saldo "vivo" recalculado (saldoRegistrado, arriba) solo se usa
      // para el mensaje/respuesta de este cierre, nunca se persiste.
    }, { transaction });

    await transaction.commit();

    const cajaCerrada = await Caja.findByPk(id);

    return NextResponse.json({
      message: diferencia === 0
        ? 'Jornada cerrada correctamente. El efectivo cuadra.'
        : diferencia > 0
          ? `Jornada cerrada correctamente. Sobrante de efectivo: Bs. ${diferencia.toFixed(2)}.`
          : `Jornada cerrada correctamente. Faltante de efectivo: Bs. ${Math.abs(diferencia).toFixed(2)}.`,
      caja: cajaCerrada,
      saldo_inicial: saldoInicial,
      total_ingresos: resumen.total_ingresos,
      total_egresos: resumen.total_egresos,
      saldo_registrado: saldoRegistrado,
      efectivo_esperado: efectivoEsperado,
      efectivo_contado: saldoContado,
      // Alias por compatibilidad con quien ya leía estos nombres:
      saldo_esperado: efectivoEsperado,
      saldo_contado: saldoContado,
      diferencia,
      desglose_por_canal: resumen.desglose_por_canal
    });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    console.error('Error al cerrar caja:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
