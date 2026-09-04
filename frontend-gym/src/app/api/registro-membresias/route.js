import { NextResponse } from 'next/server';
import { RegistroMembresia, Usuario, Membresia, Administrativo } from '@/lib/db/models';

export async function GET(request) {
  try {
    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';
    const scope = includeInactive ? 'withInactive' : 'defaultScope';

    const registros = await RegistroMembresia.scope(scope).findAll({
      include: [
        {
          model: Usuario, // Solo usuarios activos por defecto
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
      ],
      order: [['fecha_inicio', 'DESC'], ['id_registro', 'DESC']]
    });
    return NextResponse.json(registros);
  } catch (error) {
    console.error('Error al obtener registros de membresías:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('🔍 Datos recibidos para crear registro:', body);

    const { id_usuario, id_membresia, id_admin, fecha_inicio, activo } = body;

    console.log('🔍 Datos extraídos:', { id_usuario, id_membresia, id_admin, fecha_inicio, activo });

    // El límite de asistencias se copia del plan al momento de la compra, para
    // que un cambio posterior en el plan no afecte a clientes que ya compraron.
    const membresia = await Membresia.scope('withInactive').findByPk(id_membresia);

    const registro = await RegistroMembresia.create({
      id_usuario,
      id_membresia,
      id_admin: id_admin || 1, // Valor por defecto
      fecha_inicio,
      activo,
      limite_asistencias: membresia?.limite_asistencias ?? null
      // fecha_fin se calculará automáticamente por trigger
    });

    console.log('✅ Registro creado exitosamente:', registro.toJSON());
    return NextResponse.json(registro, { status: 201 });
  } catch (error) {
    console.error('Error al crear registro de membresía:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
