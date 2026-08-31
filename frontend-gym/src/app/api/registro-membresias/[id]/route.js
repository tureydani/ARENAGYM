import { NextResponse } from 'next/server';
import sequelize from '@/lib/db/sequelize';
import { RegistroMembresia, Usuario, Membresia, Administrativo, Pago } from '@/lib/db/models';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const registro = await RegistroMembresia.scope('withInactive').findByPk(id, {
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
    if (!registro) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json(registro);
  } catch (error) {
    console.error('Error al obtener registro de membresía:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const registro = await RegistroMembresia.scope('withInactive').findByPk(id);
    if (!registro) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    const body = await request.json();
    await registro.update(body);
    return NextResponse.json(registro);
  } catch (error) {
    console.error('Error al actualizar registro de membresía:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
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

    if (!registro.activo) {
      await transaction.rollback();
      return NextResponse.json({ error: "El registro ya está inactivo" }, { status: 400 });
    }

    // 1. Buscar todos los pagos asociados al registro
    const pagosAsociados = await Pago.scope('withInactive').findAll({
      where: { id_registro: id, activo: true },
      transaction
    });

    console.log(`Encontrados ${pagosAsociados.length} pagos asociados al registro ${id}`);

    // 2. Calcular el monto total de pagos activos para revertir en caja
    const montoTotalRevertir = pagosAsociados.reduce((total, pago) => {
      return total + parseFloat(pago.monto_pagado);
    }, 0);

    console.log(`Monto total a revertir en caja: ${montoTotalRevertir}`);

    // 3. Marcar todos los pagos asociados como inactivos (soft delete)
    if (pagosAsociados.length > 0) {
      await Pago.update(
        { activo: false },
        {
          where: { id_registro: id, activo: true },
          transaction
        }
      );

      // 4. Obtener información de la caja del primer pago para revertir
      const primerPago = pagosAsociados[0];

      // 5. Revertir el monto en la caja
      if (montoTotalRevertir > 0) {
        await sequelize.query(`
          UPDATE cajas
          SET saldo_actual = saldo_actual - :monto
          WHERE id_caja = :id_caja
        `, {
          replacements: {
            monto: montoTotalRevertir,
            id_caja: primerPago.id_caja
          },
          transaction
        });

        // 6. Registrar el movimiento de egreso en movimientos_caja
        await sequelize.query(`
          INSERT INTO movimientos_caja (id_caja, id_admin, tipo_movimiento, descripcion, monto, origen, id_referencia)
          VALUES (:id_caja, :id_admin, 'Egreso', :descripcion, :monto, 'Reembolso', :id_referencia)
        `, {
          replacements: {
            id_caja: primerPago.id_caja,
            id_admin: primerPago.id_admin,
            descripcion: `Reembolso por eliminación de registro de membresía ID ${id}`,
            monto: montoTotalRevertir,
            id_referencia: id
          },
          transaction
        });
      }
    }

    // 7. Finalmente, marcar el registro de membresía como inactivo
    await registro.update({ activo: false }, { transaction });

    // 8. Confirmar la transacción
    await transaction.commit();

    // 9. Obtener el registro actualizado con sus relaciones
    const registroActualizado = await RegistroMembresia.scope('withInactive').findByPk(id, {
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
      message: "Registro de membresía eliminado lógicamente con eliminación en cascada",
      registro: registroActualizado,
      pagosEliminados: pagosAsociados.length,
      montoRevertido: montoTotalRevertir,
      detalles: {
        registroEliminado: true,
        pagosEliminados: pagosAsociados.length,
        montoRevertidoEnCaja: montoTotalRevertir
      }
    });

  } catch (error) {
    console.error('Error al eliminar registro de membresía con cascada:', error);
    await transaction.rollback();
    return NextResponse.json({
      error: error.message,
      message: "Error al eliminar el registro de membresía con eliminación en cascada"
    }, { status: 500 });
  }
}
