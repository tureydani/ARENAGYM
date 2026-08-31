import { NextResponse } from 'next/server';
import Usuario from '@/lib/db/models/usuario';
import Administrativo from '@/lib/db/models/administrativo';

export async function GET(request) {
  try {
    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';
    const scope = includeInactive ? 'withInactive' : 'defaultScope';

    const usuarios = await Usuario.scope(scope).findAll({
      include: [{ model: Administrativo, as: 'Administrativo' }]
    });
    return NextResponse.json(usuarios);
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    if (body.email === '') {
      body.email = null;
    }

    if (body.fecha_nacimiento === '') {
      body.fecha_nacimiento = null;
    }

    const usuarioExistente = await Usuario.findOne({
      where: {
        nombre: body.nombre,
        apellido: body.apellido,
        activo: true
      }
    });

    if (usuarioExistente) {
      return NextResponse.json({
        error: 'Ya existe un usuario registrado con el mismo nombre y apellido'
      }, { status: 400 });
    }

    const usuario = await Usuario.create(body);
    const usuarioCompleto = await Usuario.findByPk(usuario.id_usuario, {
      include: [{ model: Administrativo, as: 'Administrativo' }]
    });
    return NextResponse.json(usuarioCompleto, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
}
