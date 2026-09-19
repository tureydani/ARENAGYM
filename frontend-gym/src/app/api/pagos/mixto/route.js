import { NextResponse } from 'next/server';
import sequelize from '@/lib/db/sequelize';
import { Pago, RegistroMembresia, Administrativo, Caja } from '@/lib/db/models';
import { esCanalCobroValido } from '@/lib/db/canalesCobro';

// Un pago mixto (ej. parte en efectivo, parte por QR) se modela como
// varias filas normales de "pagos" para el mismo id_registro, todas con la
// MISMA id_caja (misma jornada) y distinto canal_cobro, creadas dentro de
// una única transacción -- o se registran todas, o ninguna. Cada fila
// sigue actualizando el saldo de su jornada exactamente igual que un pago
// normal (vía el trigger de la BD que ya usa /api/pagos), así que el resto
// del sistema (historial de movimientos, reportes, editar/eliminar un
// pago) no necesita saber que este pago vino repartido entre canales.
//
// No existe todavía un identificador que agrupe estas filas como "un solo
// pago mixto" (ni lo había antes de este cambio, cuando se repartía entre
// cajas en vez de canales): el vínculo sigue siendo id_registro + fecha_pago
// + haberse creado en la misma petición. Agregar un id_grupo_pago explícito
// queda documentado como mejora futura, no se implementa en esta fase.
export async function POST(request) {
  const transaction = await sequelize.transaction();
  try {
    const body = await request.json();
    const { id_registro, id_admin, fecha_pago, estado_pago, id_caja, patas } = body;

    if (!id_caja) {
      await transaction.rollback();
      return NextResponse.json({ error: 'Debe indicar la jornada (id_caja) del pago mixto.' }, { status: 400 });
    }
    if (!Array.isArray(patas) || patas.length < 2) {
      await transaction.rollback();
      return NextResponse.json({ error: 'Un pago mixto necesita al menos dos canales' }, { status: 400 });
    }

    const canales = patas.map(p => p.canal_cobro);
    if (canales.some(c => !esCanalCobroValido(c))) {
      await transaction.rollback();
      return NextResponse.json({ error: 'Cada parte del pago mixto debe tener un canal_cobro válido (Efectivo, QR, Transferencia o Tarjeta).' }, { status: 400 });
    }
    if (new Set(canales).size !== canales.length) {
      await transaction.rollback();
      return NextResponse.json({ error: 'No puedes repetir el mismo canal en un pago mixto.' }, { status: 400 });
    }
    for (const pata of patas) {
      if (Number.isNaN(parseFloat(pata.monto)) || parseFloat(pata.monto) <= 0) {
        await transaction.rollback();
        return NextResponse.json({ error: 'Cada monto del pago mixto debe ser mayor a 0' }, { status: 400 });
      }
    }

    // La jornada debe existir y estar ABIERTA (una sola jornada recibe
    // todas las patas, así que se valida una sola vez).
    const caja = await Caja.findByPk(id_caja, { transaction });
    if (!caja) {
      await transaction.rollback();
      return NextResponse.json({ error: `La caja/jornada ${id_caja} no existe.` }, { status: 404 });
    }
    if (caja.estado === 'CERRADA') {
      await transaction.rollback();
      return NextResponse.json({
        error: `No se puede registrar el pago: la jornada "${caja.descripcion}" está cerrada.`
      }, { status: 400 });
    }

    const pagosCreados = [];
    for (const pata of patas) {
      const pago = await Pago.create({
        id_registro,
        monto_pagado: pata.monto,
        fecha_pago,
        id_admin: id_admin || 1,
        id_caja,
        canal_cobro: pata.canal_cobro,
        estado_pago: estado_pago || 'Completo'
      }, { transaction });
      pagosCreados.push(pago);
    }

    await transaction.commit();

    const pagosCompletos = await Pago.scope('withInactive').findAll({
      where: { id_pago: pagosCreados.map(p => p.id_pago) },
      include: [
        { model: RegistroMembresia.scope('withInactive'), as: 'RegistroMembresia' },
        { model: Administrativo, as: 'Administrativo' },
        { model: Caja, as: 'Caja' }
      ]
    });

    return NextResponse.json(pagosCompletos, { status: 201 });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    console.error('Error al crear pago mixto:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
