import { NextResponse } from 'next/server';
import { verificarTokenAsistencia } from '@/lib/auth/clienteAuth';
import { registrarAsistencia } from '@/lib/db/asistenciaService';

// Usado desde el panel administrativo: registra la asistencia de un
// cliente, ya sea escaneando su código QR (qrToken) o marcándola
// manualmente eligiéndolo en el sistema (id_usuario). Ambas vías pasan por
// el mismo servicio (asistenciaService.registrarAsistencia); solo cambia
// el valor de "metodo" que se guarda.
export async function POST(request) {
  try {
    const { qrToken, id_usuario, id_admin, observacion } = await request.json();

    let idUsuario = id_usuario;
    let metodo = 'Manual';

    if (qrToken) {
      idUsuario = verificarTokenAsistencia(qrToken);
      metodo = 'QR';
      if (!idUsuario) {
        return NextResponse.json({
          error: 'Código QR inválido o expirado. Pide al cliente que lo genere de nuevo.'
        }, { status: 400 });
      }
    }

    if (!idUsuario) {
      return NextResponse.json({ error: 'Falta el código QR o el usuario' }, { status: 400 });
    }

    if (!id_admin) {
      return NextResponse.json({ error: 'Falta el administrativo responsable del registro' }, { status: 400 });
    }

    const resultado = await registrarAsistencia({ id_usuario: idUsuario, metodo, id_admin, observacion });

    switch (resultado.tipo) {
      case 'no_encontrado':
        return NextResponse.json({ error: resultado.error }, { status: 404 });
      case 'membresia_vencida':
        return NextResponse.json({ error: resultado.error, usuario: resultado.usuario, membresiaVencida: true }, { status: 403 });
      case 'limite':
        return NextResponse.json({ error: resultado.error, usuario: resultado.usuario, limiteAlcanzado: true }, { status: 403 });
      case 'duplicado':
        return NextResponse.json({
          message: resultado.message,
          usuario: resultado.usuario,
          fecha_hora: resultado.fecha_hora,
          duplicado: true
        });
      case 'ok':
        return NextResponse.json({
          usuario: resultado.usuario,
          fecha_hora: resultado.fecha_hora,
          id_asistencia: resultado.id_asistencia,
          metodo: resultado.metodo,
          message: resultado.message,
          duplicado: false,
          asistenciasUsadas: resultado.asistenciasUsadas,
          limiteAsistencias: resultado.limiteAsistencias
        }, { status: 201 });
      default:
        return NextResponse.json({ error: 'No se pudo registrar la asistencia' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error al registrar asistencia:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
