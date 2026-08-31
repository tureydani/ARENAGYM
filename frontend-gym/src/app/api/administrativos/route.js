import { NextResponse } from 'next/server';
import { Administrativo } from '@/lib/db/models';

export async function GET(request) {
  try {
    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';
    const scope = includeInactive ? 'withInactive' : 'defaultScope';

    const admins = await Administrativo.scope(scope).findAll({
      order: [['fecha_contratacion', 'DESC'], ['id_admin', 'ASC']]
    });
    return NextResponse.json(admins);
  } catch (error) {
    console.error('Error al obtener administrativos:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { nombre, apellido, usuario, contraseña, fecha_contratacion } = body;

    if (!nombre || !apellido || !usuario || !contraseña) {
      return NextResponse.json({
        error: "Datos incompletos",
        message: "Los campos nombre, apellido, usuario y contraseña son obligatorios"
      }, { status: 400 });
    }

    const existingAdmin = await Administrativo.findOne({ where: { usuario } });
    if (existingAdmin) {
      return NextResponse.json({
        error: "Usuario duplicado",
        message: `El nombre de usuario '${usuario}' ya está en uso`
      }, { status: 409 });
    }

    const admin = await Administrativo.create({
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      usuario: usuario.trim(),
      contraseña,
      fecha_contratacion: fecha_contratacion || new Date()
    });

    return NextResponse.json(admin, { status: 201 });
  } catch (error) {
    console.error('Error al crear administrativo:', error);

    if (error.name === 'SequelizeUniqueConstraintError') {
      return NextResponse.json({
        error: "Usuario duplicado",
        message: "El nombre de usuario ya está en uso"
      }, { status: 409 });
    }

    return NextResponse.json({
      error: error.message,
      message: "Error al crear el administrativo"
    }, { status: 400 });
  }
}
