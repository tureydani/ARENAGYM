import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class Notificacion {
  final int idNotificacion;
  final String titulo;
  final String mensaje;
  final String? tipo;
  final bool leida;
  final String fechaCreacion;
  final String? fechaLectura;
  final int? referenciaId;

  Notificacion({
    required this.idNotificacion,
    required this.titulo,
    required this.mensaje,
    required this.tipo,
    required this.leida,
    required this.fechaCreacion,
    this.fechaLectura,
    this.referenciaId,
  });

  factory Notificacion.fromJson(Map<String, dynamic> json) {
    return Notificacion(
      idNotificacion: json['id_notificacion'] as int,
      titulo: json['titulo']?.toString() ?? '',
      mensaje: json['mensaje']?.toString() ?? '',
      tipo: json['tipo'] as String?,
      leida: json['leida'] as bool? ?? false,
      fechaCreacion: json['fecha_creacion']?.toString() ?? '',
      fechaLectura: json['fecha_lectura']?.toString(),
      referenciaId: json['referencia_id'] as int?,
    );
  }

  /// Crea una copia de esta notificación reemplazando los campos indicados.
  /// Útil para actualizar el estado local (ej. `leida`) sin volver a pedir
  /// al servidor.
  Notificacion copyWith({
    bool? leida,
    String? fechaLectura,
  }) {
    return Notificacion(
      idNotificacion: idNotificacion,
      titulo: titulo,
      mensaje: mensaje,
      tipo: tipo,
      leida: leida ?? this.leida,
      fechaCreacion: fechaCreacion,
      fechaLectura: fechaLectura ?? this.fechaLectura,
      referenciaId: referenciaId,
    );
  }
}

/// Tonos adicionales de advertencia/dorado que no existen todavía en
/// [AppColors] pero se necesitan para distinguir tipos de notificación
/// (ámbar para "membresía por vencer" y dorado para "motivación").
class _NotificacionColors {
  _NotificacionColors._();

  static const amber = Color(0xFFD97706);
  static const gold = Color(0xFFCA8A04);
  static const slate = Color(0xFF475569);
}

/// Metadatos visuales (ícono + color) asociados a cada `tipo` de
/// notificación que puede llegar desde el backend.
class TipoNotificacionInfo {
  final IconData icono;
  final Color color;

  const TipoNotificacionInfo(this.icono, this.color);
}

/// Resuelve el ícono y color a usar para un `tipo` de notificación dado.
/// Cualquier tipo desconocido o nulo cae en el estilo genérico "info".
TipoNotificacionInfo infoParaTipo(String? tipo) {
  switch (tipo) {
    case 'pago':
      return TipoNotificacionInfo(Icons.payments_outlined, AppColors.success);
    case 'asistencia':
      return TipoNotificacionInfo(Icons.qr_code_2, AppColors.accent);
    case 'membresia':
      return const TipoNotificacionInfo(Icons.card_membership, _NotificacionColors.amber);
    case 'inactividad':
      return TipoNotificacionInfo(Icons.bedtime_outlined, AppColors.danger);
    case 'progreso':
      return TipoNotificacionInfo(Icons.trending_up, AppColors.accent);
    case 'motivacion':
      return const TipoNotificacionInfo(Icons.emoji_events_outlined, _NotificacionColors.gold);
    case 'aviso':
      return const TipoNotificacionInfo(Icons.campaign_outlined, _NotificacionColors.slate);
    case 'rutina':
      return TipoNotificacionInfo(Icons.fitness_center, AppColors.accent);
    case 'info':
    default:
      return TipoNotificacionInfo(Icons.info_outline, AppColors.textSecondary);
  }
}

/// Etiqueta legible en español para un `tipo` de notificación, usada en los
/// chips de filtro.
String etiquetaParaTipo(String? tipo) {
  switch (tipo) {
    case 'pago':
      return 'Pagos';
    case 'asistencia':
      return 'Asistencias';
    case 'membresia':
      return 'Membresía';
    case 'inactividad':
      return 'Inactividad';
    case 'progreso':
      return 'Progreso';
    case 'motivacion':
      return 'Motivación';
    case 'aviso':
      return 'Avisos';
    case 'rutina':
      return 'Rutina';
    case 'info':
    default:
      return 'Info';
  }
}
