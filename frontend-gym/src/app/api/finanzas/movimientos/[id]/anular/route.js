import { NextResponse } from 'next/server';
import sequelize from '@/lib/db/sequelize';
import { Fondo, MovimientoFinanciero } from '@/lib/db/models';
import { requerirEscrituraFinanzas } from '@/lib/auth/permisosFinanzas';

// Anular NUNCA borra el movimiento original ni le cambia el monto: lo
// marca activo=false (etiqueta/auditoría) y crea una fila de reversión
// (origen=ANULACION, signo contrario) que es la que realmente corrige el
// saldo_actual del fondo -- mismo patrón que ya usa el sistema para
// pagos/ventas/movimientos_caja.
export async function POST(request, { params }) {
  const { error, auth } = await requerirEscrituraFinanzas(request);
  if (error) return NextResponse.json(error.body, { status: error.status });

  const { id } = await params;
  const transaction = await sequelize.transaction();
  try {
    const body = await request.json();
    const { motivo } = body;
    if (!motivo || !motivo.trim()) {
      await transaction.rollback();
      return NextResponse.json({ error: 'El motivo de anulación es obligatorio.' }, { status: 400 });
    }

    const movimiento = await MovimientoFinanciero.findByPk(id, { transaction });
    if (!movimiento) {
      await transaction.rollback();
      return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 });
    }
    if (!movimiento.activo) {
      await transaction.rollback();
      return NextResponse.json({ error: 'Este movimiento ya fue anulado.' }, { status: 400 });
    }
    if (movimiento.origen === 'ANULACION') {
      await transaction.rollback();
      return NextResponse.json({ error: 'No se puede anular una fila de reversión.' }, { status: 400 });
    }
    if (movimiento.categoria === 'TRANSFERENCIA') {
      await transaction.rollback();
      return NextResponse.json({ error: 'Esta fila pertenece a una transferencia: anula la transferencia completa, no un solo lado.' }, { status: 400 });
    }

    // withInactive: anular debe poder revertir un movimiento aunque el
    // fondo se haya desactivado después -- no depende de que siga activo.
    const fondo = await Fondo.scope('withInactive').findByPk(movimiento.id_fondo, { transaction, lock: transaction.LOCK.UPDATE });
    const montoOriginal = parseFloat(movimiento.monto);
    // Revertir: un Ingreso se resta al anularlo, un Egreso se vuelve a sumar.
    const ajuste = movimiento.tipo === 'INGRESO' ? -montoOriginal : montoOriginal;

    if (ajuste < 0 && fondo && parseFloat(fondo.saldo_actual) + ajuste < 0) {
      await transaction.rollback();
      return NextResponse.json({
        error: `No se puede anular: el saldo de ${fondo.nombre} quedaría en negativo (saldo actual Bs. ${parseFloat(fondo.saldo_actual).toFixed(2)}). Ese dinero ya se usó en otros movimientos del fondo.`
      }, { status: 400 });
    }

    await MovimientoFinanciero.create({
      id_fondo: movimiento.id_fondo,
      tipo: movimiento.tipo === 'INGRESO' ? 'EGRESO' : 'INGRESO',
      categoria: 'ANULACION',
      descripcion: `Anulación de movimiento #${movimiento.id_movimiento}: ${motivo.trim()}`,
      monto: montoOriginal,
      id_admin: auth.id_admin,
      origen: 'ANULACION',
      id_referencia: movimiento.id_movimiento
    }, { transaction });

    // unscoped(): Model.update() también aplica el defaultScope
    // (activo=true) por defecto -- sin esto, anular un movimiento de un
    // fondo ya inactivo actualizaría 0 filas en silencio.
    await Fondo.unscoped().update(
      { saldo_actual: sequelize.literal(`saldo_actual + (${ajuste})`) },
      { where: { id_fondo: movimiento.id_fondo }, transaction }
    );

    await movimiento.update({
      activo: false,
      motivo_anulacion: motivo.trim(),
      fecha_anulacion: new Date(),
      id_admin_anulacion: auth.id_admin
    }, { transaction });

    await transaction.commit();

    const fondoActualizado = await Fondo.findByPk(movimiento.id_fondo);
    return NextResponse.json({
      message: 'Movimiento anulado correctamente.',
      movimiento_anulado: movimiento,
      saldo_actual_fondo: parseFloat(fondoActualizado.saldo_actual)
    });
  } catch (err) {
    if (!transaction.finished) await transaction.rollback();
    console.error('Error al anular movimiento financiero:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
