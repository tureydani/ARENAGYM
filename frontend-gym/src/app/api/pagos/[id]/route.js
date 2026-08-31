import { NextResponse } from 'next/server';
import sequelize from '@/lib/db/sequelize';
import Pago from '@/lib/db/models/pago';
import RegistroMembresia from '@/lib/db/models/registroMembresia';
import Administrativo from '@/lib/db/models/administrativo';
import Caja from '@/lib/db/models/caja';
import Usuario from '@/lib/db/models/usuario';
import MovimientoCaja from '@/lib/db/models/movimientoCaja';

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
    await pago.update(body);

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

      // 3. Eliminar el pago (soft delete)
      await pago.destroy({ transaction });

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
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error al eliminar pago:', error);
    return NextResponse.json({
      error: "Error al eliminar pago: " + error.message,
      details: "No se pudo completar la eliminación del pago y actualización de caja"
    }, { status: 500 });
  }
}
