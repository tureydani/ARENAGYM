import { NextResponse } from 'next/server';
import sequelize from '@/lib/db/sequelize';
import { Fondo, MovimientoFinanciero, Administrativo } from '@/lib/db/models';
import { requerirEscrituraFinanzas } from '@/lib/auth/permisosFinanzas';

// Transferencia = 2 filas de movimientos_financieros (EGRESO en origen,
// INGRESO en destino) creadas en una sola transacción y unidas por
// id_transferencia = id_movimiento de la fila EGRESO. El dinero total
// nunca cambia: solo se mueve de ubicación.
export async function POST(request) {
  const { error, auth } = await requerirEscrituraFinanzas(request);
  if (error) return NextResponse.json(error.body, { status: error.status });

  const transaction = await sequelize.transaction();
  try {
    const body = await request.json();
    const { id_fondo_origen, id_fondo_destino, monto, descripcion } = body;

    const idOrigen = parseInt(id_fondo_origen);
    const idDestino = parseInt(id_fondo_destino);
    const montoNum = parseFloat(monto);

    if (Number.isNaN(idOrigen) || Number.isNaN(idDestino)) {
      await transaction.rollback();
      return NextResponse.json({ error: 'Debe indicar fondo de origen y de destino.' }, { status: 400 });
    }
    if (idOrigen === idDestino) {
      await transaction.rollback();
      return NextResponse.json({ error: 'El fondo de origen y el de destino no pueden ser el mismo.' }, { status: 400 });
    }
    if (Number.isNaN(montoNum) || montoNum <= 0) {
      await transaction.rollback();
      return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 });
    }

    // Bloquear ambos fondos en orden de ID ascendente, siempre igual, para
    // que dos transferencias concurrentes entre los mismos dos fondos no
    // puedan bloquearse en un deadlock esperándose una a la otra (mismo
    // patrón ya usado en pagos/[id] y ventas/[id] al mover de caja).
    const idsOrdenados = [idOrigen, idDestino].sort((a, b) => a - b);
    const [fondoA, fondoB] = await Promise.all(
      idsOrdenados.map(fid => Fondo.scope('withInactive').findByPk(fid, { transaction, lock: transaction.LOCK.UPDATE }))
    );
    const fondoOrigen = idOrigen === idsOrdenados[0] ? fondoA : fondoB;
    const fondoDestino = idDestino === idsOrdenados[0] ? fondoA : fondoB;

    if (!fondoOrigen || !fondoDestino) {
      await transaction.rollback();
      return NextResponse.json({ error: 'Alguno de los fondos indicados no existe.' }, { status: 404 });
    }
    if (!fondoOrigen.activo || !fondoDestino.activo) {
      await transaction.rollback();
      return NextResponse.json({ error: 'Ambos fondos deben estar activos.' }, { status: 400 });
    }
    if (parseFloat(fondoOrigen.saldo_actual) < montoNum) {
      await transaction.rollback();
      return NextResponse.json({
        error: `Saldo insuficiente en ${fondoOrigen.nombre}. Disponible: Bs. ${parseFloat(fondoOrigen.saldo_actual).toFixed(2)}, solicitado: Bs. ${montoNum.toFixed(2)}`
      }, { status: 400 });
    }

    const descripcionFinal = descripcion?.trim()
      ? descripcion.trim()
      : `Transferencia de ${fondoOrigen.nombre} a ${fondoDestino.nombre}`;

    const movimientoEgreso = await MovimientoFinanciero.create({
      id_fondo: idOrigen, tipo: 'EGRESO', categoria: 'TRANSFERENCIA',
      descripcion: descripcionFinal, monto: montoNum, id_admin: auth.id_admin, origen: 'TRANSFERENCIA'
    }, { transaction });

    const movimientoIngreso = await MovimientoFinanciero.create({
      id_fondo: idDestino, tipo: 'INGRESO', categoria: 'TRANSFERENCIA',
      descripcion: descripcionFinal, monto: montoNum, id_admin: auth.id_admin, origen: 'TRANSFERENCIA',
      id_transferencia: movimientoEgreso.id_movimiento
    }, { transaction });

    await movimientoEgreso.update({ id_transferencia: movimientoEgreso.id_movimiento }, { transaction });

    await Fondo.update(
      { saldo_actual: sequelize.literal(`saldo_actual - (${montoNum})`) },
      { where: { id_fondo: idOrigen }, transaction }
    );
    await Fondo.update(
      { saldo_actual: sequelize.literal(`saldo_actual + (${montoNum})`) },
      { where: { id_fondo: idDestino }, transaction }
    );

    await transaction.commit();

    const movimientos = await MovimientoFinanciero.findAll({
      where: { id_transferencia: movimientoEgreso.id_movimiento },
      include: [
        { model: Fondo, as: 'Fondo' },
        { model: Administrativo, as: 'Administrativo', attributes: ['id_admin', 'nombre', 'apellido'] }
      ],
      order: [['tipo', 'DESC']] // EGRESO antes que INGRESO
    });

    return NextResponse.json({
      message: `Transferencia de Bs. ${montoNum.toFixed(2)} de "${fondoOrigen.nombre}" a "${fondoDestino.nombre}" completada.`,
      id_transferencia: movimientoEgreso.id_movimiento,
      movimientos
    }, { status: 201 });
  } catch (err) {
    if (!transaction.finished) await transaction.rollback();
    console.error('Error al transferir entre fondos:', err);
    if (err.name === 'SequelizeDatabaseError' && /chk_fondos_saldo_no_negativo/.test(err.original?.message || '')) {
      return NextResponse.json({ error: 'La transferencia dejaría el fondo de origen con saldo negativo.' }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
