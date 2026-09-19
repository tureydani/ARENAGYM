import { NextResponse } from 'next/server';
import { Op } from 'sequelize';
import sequelize from '@/lib/db/sequelize';
import { Fondo, MovimientoFinanciero, Administrativo, Caja } from '@/lib/db/models';
import { requerirLecturaFinanzas, requerirEscrituraFinanzas } from '@/lib/auth/permisosFinanzas';
import { esCategoriaValidaParaTipo } from '@/lib/db/finanzasCatalogos';

// Filtros: id_fondo, tipo, categoria, id_admin, origen, fecha_desde, fecha_hasta, includeInactive
export async function GET(request) {
  const { error } = await requerirLecturaFinanzas(request);
  if (error) return NextResponse.json(error.body, { status: error.status });

  try {
    const params = request.nextUrl.searchParams;
    const where = {};
    if (params.get('includeInactive') !== 'true') where.activo = true;
    for (const campo of ['id_fondo', 'tipo', 'categoria', 'id_admin', 'origen', 'id_jornada']) {
      const valor = params.get(campo);
      if (valor) where[campo] = valor;
    }
    const fecha_desde = params.get('fecha_desde');
    const fecha_hasta = params.get('fecha_hasta');
    if (fecha_desde || fecha_hasta) {
      where.fecha_movimiento = {};
      if (fecha_desde) where.fecha_movimiento[Op.gte] = new Date(fecha_desde);
      if (fecha_hasta) where.fecha_movimiento[Op.lte] = new Date(fecha_hasta);
    }

    const movimientos = await MovimientoFinanciero.findAll({
      where,
      include: [
        { model: Fondo.scope('withInactive'), as: 'Fondo' },
        { model: Administrativo, as: 'Administrativo', attributes: ['id_admin', 'nombre', 'apellido'] },
        { model: Administrativo, as: 'AdminAnulacion', attributes: ['id_admin', 'nombre', 'apellido'], required: false },
        { model: Caja, as: 'Jornada', attributes: ['id_caja', 'descripcion'], required: false }
      ],
      order: [['fecha_movimiento', 'DESC'], ['id_movimiento', 'DESC']]
    });
    return NextResponse.json(movimientos);
  } catch (err) {
    console.error('Error al listar movimientos financieros:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Ingreso/Egreso manual sobre UN fondo. Para mover dinero ENTRE fondos usar
// /api/finanzas/transferencias (nunca un Egreso + un Ingreso sueltos acá,
// porque eso no queda vinculado por id_transferencia y rompe la
// trazabilidad "de dónde a dónde").
export async function POST(request) {
  const { error, auth } = await requerirEscrituraFinanzas(request);
  if (error) return NextResponse.json(error.body, { status: error.status });

  const transaction = await sequelize.transaction();
  try {
    const body = await request.json();
    const { id_fondo, tipo, categoria, descripcion, monto, id_jornada } = body;

    if (tipo !== 'INGRESO' && tipo !== 'EGRESO') {
      await transaction.rollback();
      return NextResponse.json({ error: 'tipo debe ser INGRESO o EGRESO' }, { status: 400 });
    }
    if (!esCategoriaValidaParaTipo(categoria, tipo)) {
      await transaction.rollback();
      return NextResponse.json({ error: `categoria inválida para ${tipo}` }, { status: 400 });
    }
    const montoNum = parseFloat(monto);
    if (Number.isNaN(montoNum) || montoNum <= 0) {
      await transaction.rollback();
      return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 });
    }
    if (categoria === 'TRANSFERENCIA' || categoria === 'SALDO_INICIAL') {
      await transaction.rollback();
      return NextResponse.json({ error: `La categoría ${categoria} no se registra por este endpoint (usa /transferencias o crea el fondo con saldo_inicial).` }, { status: 400 });
    }

    // scope('withInactive'): Fondo.findByPk normal aplica el defaultScope
    // (activo=true) y devolvería null también para un fondo inactivo,
    // haciendo que el chequeo de abajo nunca se alcance (404 en vez de
    // 400 "fondo inactivo").
    const fondo = await Fondo.scope('withInactive').findByPk(id_fondo, { transaction, lock: transaction.LOCK.UPDATE });
    if (!fondo) {
      await transaction.rollback();
      return NextResponse.json({ error: 'Fondo no encontrado' }, { status: 404 });
    }
    if (!fondo.activo) {
      await transaction.rollback();
      return NextResponse.json({ error: `El fondo "${fondo.nombre}" está inactivo.` }, { status: 400 });
    }
    if (tipo === 'EGRESO' && parseFloat(fondo.saldo_actual) < montoNum) {
      await transaction.rollback();
      return NextResponse.json({
        error: `Saldo insuficiente en ${fondo.nombre}. Disponible: Bs. ${parseFloat(fondo.saldo_actual).toFixed(2)}, solicitado: Bs. ${montoNum.toFixed(2)}`
      }, { status: 400 });
    }
    if (id_jornada) {
      const jornada = await Caja.findByPk(id_jornada, { transaction });
      if (!jornada) {
        await transaction.rollback();
        return NextResponse.json({ error: 'La jornada indicada no existe.' }, { status: 404 });
      }
    }

    const movimiento = await MovimientoFinanciero.create({
      id_fondo, tipo, categoria, descripcion: descripcion || null, monto: montoNum,
      id_admin: auth.id_admin,
      origen: id_jornada ? 'CIERRE_JORNADA' : 'MANUAL',
      id_jornada: id_jornada || null
    }, { transaction });

    const ajuste = tipo === 'INGRESO' ? montoNum : -montoNum;
    await Fondo.update(
      { saldo_actual: sequelize.literal(`saldo_actual + (${ajuste})`) },
      { where: { id_fondo }, transaction }
    );

    await transaction.commit();

    const movimientoCompleto = await MovimientoFinanciero.findByPk(movimiento.id_movimiento, {
      include: [
        { model: Fondo, as: 'Fondo' },
        { model: Administrativo, as: 'Administrativo', attributes: ['id_admin', 'nombre', 'apellido'] }
      ]
    });
    return NextResponse.json(movimientoCompleto, { status: 201 });
  } catch (err) {
    if (!transaction.finished) await transaction.rollback();
    console.error('Error al crear movimiento financiero:', err);
    if (err.name === 'SequelizeDatabaseError' && /chk_fondos_saldo_no_negativo/.test(err.original?.message || '')) {
      return NextResponse.json({ error: 'La operación dejaría el fondo con saldo negativo.' }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
