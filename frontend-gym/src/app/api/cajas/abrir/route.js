import { NextResponse } from 'next/server';
import { Caja, Administrativo } from '@/lib/db/models';

// Apertura formal de una caja operativa: crea una fila NUEVA en `cajas`
// (una caja = un ciclo apertura→cierre, igual que ya lo hacía el sistema
// con sus cajas históricas), a diferencia del viejo PUT/toggle que solo
// invertía el booleano `abierta` sobre la misma fila sin dejar rastro de
// quién ni cuándo.
//
// Se permiten varias cajas abiertas a la vez (ej. "Efectivo" y "Qr", para
// que el pago mixto siga funcionando); lo único que se bloquea es reabrir
// una caja con el MISMO nombre mientras ya haya una abierta con ese nombre.
export async function POST(request) {
  try {
    const body = await request.json();
    const { descripcion, saldo_inicial, id_admin } = body;

    if (!descripcion || descripcion.trim() === '') {
      return NextResponse.json({ error: 'La descripción es obligatoria' }, { status: 400 });
    }
    if (!id_admin) {
      return NextResponse.json({ error: 'Falta el administrativo responsable de la apertura' }, { status: 400 });
    }

    const saldoInicial = saldo_inicial !== undefined && saldo_inicial !== null && saldo_inicial !== ''
      ? parseFloat(saldo_inicial)
      : 0;
    if (Number.isNaN(saldoInicial) || saldoInicial < 0) {
      return NextResponse.json({ error: 'El saldo inicial no puede ser negativo' }, { status: 400 });
    }

    const descripcionTrim = descripcion.trim();

    // Chequeo previo para dar un mensaje claro; la garantía real ante dos
    // peticiones simultáneas es el índice único parcial en la base
    // (idx_cajas_unica_abierta_por_descripcion), capturado más abajo.
    const yaAbierta = await Caja.findOne({ where: { descripcion: descripcionTrim, estado: 'ABIERTA' } });
    if (yaAbierta) {
      return NextResponse.json({
        error: `Ya existe una caja abierta con el nombre "${descripcionTrim}" (Caja #${yaAbierta.id_caja}). Debe cerrarla antes de abrir otra con el mismo nombre.`
      }, { status: 400 });
    }

    let caja;
    try {
      caja = await Caja.create({
        descripcion: descripcionTrim,
        saldo_inicial: saldoInicial,
        saldo_actual: saldoInicial,
        abierta: true,
        estado: 'ABIERTA',
        fecha_apertura: new Date(),
        id_admin_apertura: id_admin
      });
    } catch (error) {
      const codigoPostgres = error?.original?.code || error?.parent?.code;
      if (codigoPostgres === '23505') {
        return NextResponse.json({
          error: `Ya existe una caja abierta con el nombre "${descripcionTrim}". Debe cerrarla antes de abrir otra con el mismo nombre.`
        }, { status: 400 });
      }
      throw error;
    }

    const cajaCompleta = await Caja.findByPk(caja.id_caja, {
      include: [{ model: Administrativo, as: 'AdminApertura', attributes: ['id_admin', 'nombre', 'apellido'], required: false }]
    });

    return NextResponse.json(cajaCompleta, { status: 201 });
  } catch (error) {
    console.error('Error al abrir caja:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
