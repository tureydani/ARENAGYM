import { NextResponse } from 'next/server';
import sequelize from '@/lib/db/sequelize';
import { Fondo, MovimientoFinanciero, Administrativo } from '@/lib/db/models';
import { requerirLecturaFinanzas, requerirEscrituraFinanzas } from '@/lib/auth/permisosFinanzas';
import { esTipoFondoValido } from '@/lib/db/finanzasCatalogos';

export async function GET(request) {
  const { error } = await requerirLecturaFinanzas(request);
  if (error) return NextResponse.json(error.body, { status: error.status });

  try {
    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';
    const fondos = await Fondo.scope(includeInactive ? 'withInactive' : 'defaultScope').findAll({
      include: [{ model: Administrativo, as: 'AdminCreacion', attributes: ['id_admin', 'nombre', 'apellido'], required: false }],
      order: [['id_fondo', 'ASC']]
    });
    return NextResponse.json(fondos);
  } catch (err) {
    console.error('Error al listar fondos:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Crea un fondo. Si se manda saldo_inicial > 0, NO se escribe directo en
// fondos.saldo_actual: se crea como un movimiento_financiero con
// origen=SALDO_INICIAL (ver diseño acordado), dentro de la misma
// transacción -- así el alta queda auditada igual que cualquier otro
// movimiento, no como un número mágico en la fila del fondo.
export async function POST(request) {
  const { error, auth } = await requerirEscrituraFinanzas(request);
  if (error) return NextResponse.json(error.body, { status: error.status });

  const transaction = await sequelize.transaction();
  try {
    const body = await request.json();
    const { nombre, tipo_fondo, descripcion, saldo_inicial } = body;

    if (!nombre || !nombre.trim()) {
      await transaction.rollback();
      return NextResponse.json({ error: 'El nombre del fondo es obligatorio' }, { status: 400 });
    }
    if (!esTipoFondoValido(tipo_fondo)) {
      await transaction.rollback();
      return NextResponse.json({ error: 'tipo_fondo inválido' }, { status: 400 });
    }
    const saldoInicial = saldo_inicial !== undefined && saldo_inicial !== null && saldo_inicial !== ''
      ? parseFloat(saldo_inicial) : 0;
    if (Number.isNaN(saldoInicial) || saldoInicial < 0) {
      await transaction.rollback();
      return NextResponse.json({ error: 'El saldo inicial no puede ser negativo' }, { status: 400 });
    }

    let fondo;
    try {
      fondo = await Fondo.create({
        nombre: nombre.trim(),
        tipo_fondo,
        descripcion: descripcion || null,
        saldo_actual: 0,
        id_admin_creacion: auth.id_admin
      }, { transaction });
    } catch (e) {
      const codigoPostgres = e?.original?.code || e?.parent?.code;
      if (codigoPostgres === '23505') {
        await transaction.rollback();
        return NextResponse.json({ error: `Ya existe un fondo activo llamado "${nombre.trim()}".` }, { status: 400 });
      }
      throw e;
    }

    if (saldoInicial > 0) {
      await MovimientoFinanciero.create({
        id_fondo: fondo.id_fondo,
        tipo: 'INGRESO',
        categoria: 'SALDO_INICIAL',
        descripcion: 'Saldo inicial al crear el fondo',
        monto: saldoInicial,
        id_admin: auth.id_admin,
        origen: 'SALDO_INICIAL'
      }, { transaction });
      await Fondo.update(
        { saldo_actual: sequelize.literal(`saldo_actual + (${saldoInicial})`) },
        { where: { id_fondo: fondo.id_fondo }, transaction }
      );
    }

    await transaction.commit();

    const fondoCompleto = await Fondo.findByPk(fondo.id_fondo, {
      include: [{ model: Administrativo, as: 'AdminCreacion', attributes: ['id_admin', 'nombre', 'apellido'], required: false }]
    });
    return NextResponse.json(fondoCompleto, { status: 201 });
  } catch (err) {
    if (!transaction.finished) await transaction.rollback();
    console.error('Error al crear fondo:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
