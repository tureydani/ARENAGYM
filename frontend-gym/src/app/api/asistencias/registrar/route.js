import { NextResponse } from 'next/server';
import { Op } from 'sequelize';
import { Asistencia, Usuario } from '@/lib/db/models';
import { verificarTokenAsistencia } from '@/lib/auth/clienteAuth';

// Usado desde el panel administrativo: registra la asistencia de un
// cliente, ya sea escaneando su código QR (qrToken) o marcándola
// manualmente eligiéndolo en el sistema (id_usuario).
export async function POST(request) {
  try {
    const { qrToken, id_usuario } = await request.json();

    let idUsuario = id_usuario;

    if (qrToken) {
      idUsuario = verificarTokenAsistencia(qrToken);
      if (!idUsuario) {
        return NextResponse.json({
          error: 'Código QR inválido o expirado. Pide al cliente que lo genere de nuevo.'
        }, { status: 400 });
      }
    }

    if (!idUsuario) {
      return NextResponse.json({ error: 'Falta el código QR o el usuario' }, { status: 400 });
    }

    const usuario = await Usuario.findOne({ where: { id_usuario: idUsuario, activo: true } });
    if (!usuario) {
      return NextResponse.json({ error: 'Cliente no encontrado o inactivo' }, { status: 404 });
    }

    // Evitar duplicados si el mismo QR/click se procesa dos veces seguidas
    // (doble escaneo accidental, doble clic, etc.)
    const dosMinutosAtras = new Date(Date.now() - 2 * 60 * 1000);
    const yaRegistrada = await Asistencia.findOne({
      where: {
        id_usuario: idUsuario,
        fecha_hora: { [Op.gte]: dosMinutosAtras }
      },
      order: [['fecha_hora', 'DESC']]
    });

    if (yaRegistrada) {
      return NextResponse.json({
        message: `Ya se registró la asistencia de ${usuario.nombre} ${usuario.apellido} hace un momento`,
        usuario: { id_usuario: usuario.id_usuario, nombre: usuario.nombre, apellido: usuario.apellido },
        fecha_hora: yaRegistrada.fecha_hora,
        duplicado: true
      });
    }

    const asistencia = await Asistencia.create({ id_usuario: idUsuario });

    return NextResponse.json({
      message: `Asistencia registrada: ${usuario.nombre} ${usuario.apellido}`,
      usuario: { id_usuario: usuario.id_usuario, nombre: usuario.nombre, apellido: usuario.apellido },
      fecha_hora: asistencia.fecha_hora,
      duplicado: false
    }, { status: 201 });
  } catch (error) {
    console.error('Error al registrar asistencia:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
