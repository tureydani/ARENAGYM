import { NextResponse } from 'next/server';
import { Fondo, MovimientoFinanciero, Administrativo } from '@/lib/db/models';
import { requerirLecturaFinanzas, requerirEscrituraFinanzas } from '@/lib/auth/permisosFinanzas';
import { esTipoFondoValido } from '@/lib/db/finanzasCatalogos';

export async function GET(request, { params }) {
  const { error } = await requerirLecturaFinanzas(request);
  if (error) return NextResponse.json(error.body, { status: error.status });

  const { id } = await params;
  try {
    const fondo = await Fondo.scope('withInactive').findByPk(id, {
      include: [{ model: Administrativo, as: 'AdminCreacion', attributes: ['id_admin', 'nombre', 'apellido'], required: false }]
    });
    if (!fondo) return NextResponse.json({ error: 'Fondo no encontrado' }, { status: 404 });

    const movimientos = await MovimientoFinanciero.findAll({
      where: { id_fondo: id },
      include: [
        { model: Administrativo, as: 'Administrativo', attributes: ['id_admin', 'nombre', 'apellido'] },
        { model: Administrativo, as: 'AdminAnulacion', attributes: ['id_admin', 'nombre', 'apellido'], required: false }
      ],
      order: [['fecha_movimiento', 'DESC'], ['id_movimiento', 'DESC']]
    });

    return NextResponse.json({ ...fondo.toJSON(), movimientos });
  } catch (err) {
    console.error('Error al obtener fondo:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Edita SOLO metadata (nombre/tipo_fondo/descripcion/activo). saldo_actual
// nunca se acepta acá -- se mueve exclusivamente vía movimientos/transferencias.
export async function PUT(request, { params }) {
  const { error } = await requerirEscrituraFinanzas(request);
  if (error) return NextResponse.json(error.body, { status: error.status });

  const { id } = await params;
  try {
    const fondo = await Fondo.scope('withInactive').findByPk(id);
    if (!fondo) return NextResponse.json({ error: 'Fondo no encontrado' }, { status: 404 });

    const body = await request.json();
    if (body.saldo_actual !== undefined) {
      return NextResponse.json({ error: 'saldo_actual no se puede editar directamente. Usa un movimiento o una transferencia.' }, { status: 400 });
    }
    if (body.tipo_fondo !== undefined && !esTipoFondoValido(body.tipo_fondo)) {
      return NextResponse.json({ error: 'tipo_fondo inválido' }, { status: 400 });
    }

    const cambios = {};
    if (body.nombre !== undefined) cambios.nombre = body.nombre.trim();
    if (body.tipo_fondo !== undefined) cambios.tipo_fondo = body.tipo_fondo;
    if (body.descripcion !== undefined) cambios.descripcion = body.descripcion;
    if (body.activo !== undefined) cambios.activo = Boolean(body.activo);

    await fondo.update(cambios);

    const fondoActualizado = await Fondo.scope('withInactive').findByPk(id, {
      include: [{ model: Administrativo, as: 'AdminCreacion', attributes: ['id_admin', 'nombre', 'apellido'], required: false }]
    });
    return NextResponse.json(fondoActualizado);
  } catch (err) {
    console.error('Error al actualizar fondo:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
