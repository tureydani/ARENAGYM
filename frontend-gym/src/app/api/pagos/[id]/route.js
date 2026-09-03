import { NextResponse } from 'next/server';
import sequelize from '@/lib/db/sequelize';
import { Pago, RegistroMembresia, Administrativo, Caja, Usuario, MovimientoCaja } from '@/lib/db/models';
import { mensajeErrorSaldoNegativo } from '@/lib/db/erroresCaja';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const pago = await Pago.scope('withInactive').findByPk(id, {
      include: [
        {
          model: RegistroMembresia.scope('withInactive'),
          as: 'RegistroMembresia'
        },
        {
          model: Administrativo.scope('withInactive'),
          as: 'Administrativo'
        },
        {
          model: Caja,
          as: 'Caja'
        }
      ]
    });
    if (!pago) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json(pago);
  } catch (error) {
    console.error('Error al obtener pago:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const pago = await Pago.scope('withInactive').findByPk(id);
    if (!pago) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const body = await request.json();

    // Si cambia la caja y/o el monto, hay que mover el dinero de verdad:
    // el pago original ya sumó su monto a la caja con la que se creó, así
    // que un simple pago.update(body) dejaba el registro apuntando a la
    // caja nueva pero el saldo seguía reflejado en la caja vieja -- y al
    // eliminar el pago después, se restaba de la caja nueva (que nunca
    // recibió ese dinero), dejándola en negativo.
    const oldCajaId = pago.id_caja;
    const oldMonto = parseFloat(pago.monto_pagado);
    const newCajaId = body.id_caja !== undefined ? parseInt(body.id_caja) : oldCajaId;
    const newMonto = body.monto_pagado !== undefined ? parseFloat(body.monto_pagado) : oldMonto;

    if (body.monto_pagado !== undefined && (Number.isNaN(newMonto) || newMonto <= 0)) {
      return NextResponse.json({ error: 'El monto pagado debe ser mayor a 0' }, { status: 400 });
    }

    const huboCambioDeDinero = newCajaId !== oldCajaId || newMonto !== oldMonto;

    if (huboCambioDeDinero) {
      const transaction = await sequelize.transaction();
      try {
        if (newCajaId !== oldCajaId) {
          // Se bloquean las dos filas de caja involucradas (en orden de ID
          // ascendente, siempre igual, para que dos ediciones concurrentes
          // que muevan dinero entre las mismas dos cajas no puedan
          // bloquearse en un deadlock esperándose una a la otra).
          const idsOrdenados = [oldCajaId, newCajaId].sort((a, b) => a - b);
          const [cajaA, cajaB] = await Promise.all(
            idsOrdenados.map(cid => Caja.findByPk(cid, { transaction, lock: transaction.LOCK.UPDATE }))
          );
          const cajaAnterior = oldCajaId === idsOrdenados[0] ? cajaA : cajaB;
          const cajaNueva = newCajaId === idsOrdenados[0] ? cajaA : cajaB;

          if (!cajaNueva) {
            await transaction.rollback();
            return NextResponse.json({ error: 'La caja de destino no existe' }, { status: 404 });
          }
          if (cajaAnterior && parseFloat(cajaAnterior.saldo_actual) - oldMonto < 0) {
            await transaction.rollback();
            return NextResponse.json({
              error: `No se puede cambiar de caja: el saldo de ${cajaAnterior.descripcion} quedaría en negativo (saldo actual Bs. ${parseFloat(cajaAnterior.saldo_actual).toFixed(2)}, este pago era de Bs. ${oldMonto.toFixed(2)}). Ese dinero ya se usó en otros movimientos de esa caja.`
            }, { status: 400 });
          }

          await Caja.update(
            { saldo_actual: sequelize.literal(`saldo_actual - (${oldMonto})`) },
            { where: { id_caja: oldCajaId }, transaction }
          );
          await MovimientoCaja.create({
            id_caja: oldCajaId,
            id_admin: pago.id_admin,
            tipo_movimiento: 'Egreso',
            descripcion: `Corrección: pago movido a otra caja (ID Pago: ${pago.id_pago})`,
            monto: oldMonto,
            origen: 'Reembolso',
            id_referencia: pago.id_pago
          }, { transaction });

          await Caja.update(
            { saldo_actual: sequelize.literal(`saldo_actual + (${newMonto})`) },
            { where: { id_caja: newCajaId }, transaction }
          );
          await MovimientoCaja.create({
            id_caja: newCajaId,
            id_admin: pago.id_admin,
            tipo_movimiento: 'Ingreso',
            descripcion: `Corrección: pago movido desde otra caja (ID Pago: ${pago.id_pago})`,
            monto: newMonto,
            origen: 'Pago',
            id_referencia: pago.id_pago
          }, { transaction });
        } else {
          // Misma caja, solo cambió el monto
          const delta = newMonto - oldMonto;
          if (delta !== 0) {
            const caja = await Caja.findByPk(oldCajaId, { transaction, lock: transaction.LOCK.UPDATE });
            if (delta < 0 && caja && parseFloat(caja.saldo_actual) + delta < 0) {
              await transaction.rollback();
              return NextResponse.json({
                error: `No se puede reducir el monto: el saldo de ${caja.descripcion} quedaría en negativo (saldo actual Bs. ${parseFloat(caja.saldo_actual).toFixed(2)}).`
              }, { status: 400 });
            }
            await Caja.update(
              { saldo_actual: sequelize.literal(`saldo_actual + (${delta})`) },
              { where: { id_caja: oldCajaId }, transaction }
            );
            await MovimientoCaja.create({
              id_caja: oldCajaId,
              id_admin: pago.id_admin,
              tipo_movimiento: delta > 0 ? 'Ingreso' : 'Egreso',
              descripcion: `Corrección de monto de pago (ID Pago: ${pago.id_pago})`,
              monto: Math.abs(delta),
              origen: delta > 0 ? 'Pago' : 'Reembolso',
              id_referencia: pago.id_pago
            }, { transaction });
          }
        }

        await pago.update(body, { transaction });
        await transaction.commit();
      } catch (error) {
        if (!transaction.finished) await transaction.rollback();
        throw error;
      }
    } else {
      await pago.update(body);
    }

    const pagoActualizado = await Pago.scope('withInactive').findByPk(id, {
      include: [
        { model: RegistroMembresia.scope('withInactive'), as: 'RegistroMembresia' },
        { model: Administrativo.scope('withInactive'), as: 'Administrativo' },
        { model: Caja, as: 'Caja' }
      ]
    });

    return NextResponse.json(pagoActualizado);
  } catch (error) {
    console.error('Error al actualizar pago:', error);
    const mensajeSaldo = mensajeErrorSaldoNegativo(error);
    if (mensajeSaldo) return NextResponse.json({ error: mensajeSaldo }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const pago = await Pago.scope('withInactive').findByPk(id, {
      include: [
        {
          model: RegistroMembresia.scope('withInactive'),
          as: 'RegistroMembresia',
          include: [
            {
              model: Usuario.scope('withInactive'),
              as: 'Usuario'
            }
          ]
        },
        { model: Caja, as: 'Caja' }
      ]
    });

    if (!pago) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });

    // Iniciar transacción para asegurar consistencia
    const transaction = await sequelize.transaction();

    try {
      const cajaBloqueada = await Caja.findByPk(pago.id_caja, { transaction, lock: transaction.LOCK.UPDATE });
      if (cajaBloqueada && parseFloat(cajaBloqueada.saldo_actual) - parseFloat(pago.monto_pagado) < 0) {
        await transaction.rollback();
        return NextResponse.json({
          error: `No se puede eliminar: el saldo de ${cajaBloqueada.descripcion} quedaría en negativo (saldo actual Bs. ${parseFloat(cajaBloqueada.saldo_actual).toFixed(2)}, este pago era de Bs. ${parseFloat(pago.monto_pagado).toFixed(2)}). Ese dinero ya se usó en otros movimientos de la caja.`
        }, { status: 400 });
      }

      // Obtener información del cliente para el movimiento
      const nombreCliente = pago.RegistroMembresia?.Usuario ?
        `${pago.RegistroMembresia.Usuario.nombre} ${pago.RegistroMembresia.Usuario.apellido}` :
        'Cliente desconocido';

      // 1. Restar el monto de la caja
      await Caja.update(
        {
          saldo_actual: sequelize.literal(`saldo_actual - ${pago.monto_pagado}`)
        },
        {
          where: { id_caja: pago.id_caja },
          transaction
        }
      );

      // 2. Crear movimiento de egreso en la tabla de movimientos
      await MovimientoCaja.create({
        id_caja: pago.id_caja,
        id_admin: pago.id_admin,
        tipo_movimiento: 'Egreso',
        descripcion: `Eliminación de pago de membresía de ${nombreCliente} (ID Pago: ${pago.id_pago})`,
        monto: pago.monto_pagado,
        origen: 'Reembolso',
        id_referencia: pago.id_pago
      }, { transaction });

      // 3. Eliminar el pago (soft delete: se conserva el registro para el
      // historial financiero, igual que en el resto de entidades de la app)
      await pago.update({ activo: false }, { transaction });

      // Confirmar transacción
      await transaction.commit();

      // Obtener saldo actualizado de la caja
      const cajaActualizada = await Caja.findByPk(pago.id_caja);

      return NextResponse.json({
        message: "Pago eliminado correctamente",
        montoPago: pago.monto_pagado,
        cajaAfectada: {
          id: cajaActualizada.id_caja,
          descripcion: cajaActualizada.descripcion,
          saldoAnterior: parseFloat(cajaActualizada.saldo_actual) + parseFloat(pago.monto_pagado),
          saldoActual: parseFloat(cajaActualizada.saldo_actual),
          diferencia: -parseFloat(pago.monto_pagado)
        },
        cliente: nombreCliente
      });

    } catch (error) {
      // Revertir transacción en caso de error
      if (!transaction.finished) await transaction.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error al eliminar pago:', error);
    const mensajeSaldo = mensajeErrorSaldoNegativo(error);
    if (mensajeSaldo) return NextResponse.json({ error: mensajeSaldo }, { status: 400 });
    return NextResponse.json({
      error: "Error al eliminar pago: " + error.message,
      details: "No se pudo completar la eliminación del pago y actualización de caja"
    }, { status: 500 });
  }
}
