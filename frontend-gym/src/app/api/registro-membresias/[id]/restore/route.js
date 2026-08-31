import { NextResponse } from 'next/server';
import sequelize from '@/lib/db/sequelize';
import RegistroMembresia from '@/lib/db/models/registroMembresia';
import Usuario from '@/lib/db/models/usuario';
import Membresia from '@/lib/db/models/membresia';
import Administrativo from '@/lib/db/models/administrativo';
import Pago from '@/lib/db/models/pago';

export async function PUT(request, { params }) {
  const { id } = await params;
  const transaction = await sequelize.transaction();

  try {
    const registro = await RegistroMembresia.scope('withInactive').findByPk(id, {
      transaction
    });

    if (!registro) {
      await transaction.rollback();
      return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    }

    if (registro.activo) {
      await transaction.rollback();
      return NextResponse.json({ error: "El registro ya está activo" }, { status: 400 });
    }

    // 1. Buscar todos los pagos inactivos asociados al registro
    const pagosInactivos = await Pago.scope('onlyInactive').findAll({
      where: { id_registro: id, activo: false },
      transaction
    });

    console.log(`Encontrados ${pagosInactivos.length} pagos inactivos para restaurar`);

    // 2. Calcular el monto total de pagos a restaurar
    const montoTotalRestaurar = pagosInactivos.reduce((total, pago) => {
      return total + parseFloat(pago.monto_pagado);
    }, 0);

    console.log(`Monto total a restaurar en caja: ${montoTotalRestaurar}`);

    // 3. Restaurar todos los pagos asociados (marcar como activos)
    if (pagosInactivos.length > 0) {
      await Pago.update(
        { activo: true },
        {
          where: { id_registro: id, activo: false },
          transaction
        }
      );

      // 4. Obtener información de la caja del primer pago para restaurar
      const primerPago = pagosInactivos[0];

      // 5. Restaurar el monto en la caja
      if (montoTotalRestaurar > 0) {
        await sequelize.query(`
          UPDATE cajas
          SET saldo_actual = saldo_actual + :monto
          WHERE id_caja = :id_caja
        `, {
          replacements: {
            monto: montoTotalRestaurar,
            id_caja: primerPago.id_caja
          },
          transaction
        });

        // 6. Registrar el movimiento de ingreso en movimientos_caja
        await sequelize.query(`
          INSERT INTO movimientos_caja (id_caja, id_admin, tipo_movimiento, descripcion, monto, origen, id_referencia)
          VALUES (:id_caja, :id_admin, 'Ingreso', :descripcion, :monto, 'Pago', :id_referencia)
        `, {
          replacements: {
            id_caja: primerPago.id_caja,
            id_admin: primerPago.id_admin,
            descripcion: `Restauración de pagos por registro de membresía ID ${id}`,
            monto: montoTotalRestaurar,
            id_referencia: id
          },
          transaction
        });
      }
    }

    // 7. Finalmente, restaurar el registro de membresía
    await registro.update({ activo: true }, { transaction });

    // 8. Confirmar la transacción
    await transaction.commit();

    // 9. Obtener el registro actualizado con sus relaciones
    const registroActualizado = await RegistroMembresia.findByPk(id, {
      include: [
        {
          model: Usuario.scope('withInactive'),
          as: 'Usuario',
          required: false
        },
        {
          model: Membresia.scope('withInactive'),
          as: 'Membresia',
          required: false
        },
        {
          model: Administrativo.scope('withInactive'),
          as: 'Administrativo',
          required: false
        }
      ]
    });

    return NextResponse.json({
      message: "Registro de membresía restaurado exitosamente con restauración en cascada",
      registro: registroActualizado,
      pagosRestaurados: pagosInactivos.length,
      montoRestaurado: montoTotalRestaurar,
      detalles: {
        registroRestaurado: true,
        pagosRestaurados: pagosInactivos.length,
        montoRestauradoEnCaja: montoTotalRestaurar
      }
    });

  } catch (error) {
    console.error('Error al restaurar registro de membresía con cascada:', error);
    await transaction.rollback();
    return NextResponse.json({
      error: error.message,
      message: "Error al restaurar el registro de membresía con restauración en cascada"
    }, { status: 400 });
  }
}
