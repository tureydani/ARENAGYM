import { NextResponse } from 'next/server';
import sequelize from '@/lib/db/sequelize';
import { Pago, RegistroMembresia, Administrativo, Caja } from '@/lib/db/models';

// Un pago mixto (ej. parte en efectivo, parte por Qr) se modela como varias
// filas normales de "pagos" para el mismo id_registro, una por caja,
// creadas dentro de una única transacción -- o se registran todas, o
// ninguna. Cada fila sigue actualizando su caja exactamente igual que un
// pago normal (vía el trigger de la BD que ya usa /api/pagos), así que el
// resto del sistema (historial de movimientos, reportes, editar/eliminar
// un pago) no necesita saber que este pago vino repartido entre cajas.
export async function POST(request) {
  const transaction = await sequelize.transaction();
  try {
    const body = await request.json();
    const { id_registro, id_admin, fecha_pago, estado_pago, cajas } = body;

    if (!Array.isArray(cajas) || cajas.length < 2) {
      await transaction.rollback();
      return NextResponse.json({ error: 'Un pago mixto necesita al menos dos cajas' }, { status: 400 });
    }

    const idsCajas = cajas.map(c => parseInt(c.id_caja));
    if (idsCajas.some(id => Number.isNaN(id))) {
      await transaction.rollback();
      return NextResponse.json({ error: 'Selecciona una caja válida para cada parte del pago' }, { status: 400 });
    }
    if (new Set(idsCajas).size !== idsCajas.length) {
      await transaction.rollback();
      return NextResponse.json({ error: 'No puedes repetir la misma caja en un pago mixto' }, { status: 400 });
    }
    for (const leg of cajas) {
      if (Number.isNaN(parseFloat(leg.monto)) || parseFloat(leg.monto) <= 0) {
        await transaction.rollback();
        return NextResponse.json({ error: 'Cada monto del pago mixto debe ser mayor a 0' }, { status: 400 });
      }
    }

    const pagosCreados = [];
    for (const leg of cajas) {
      const pago = await Pago.create({
        id_registro,
        monto_pagado: leg.monto,
        fecha_pago,
        id_admin: id_admin || 1,
        id_caja: leg.id_caja,
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
