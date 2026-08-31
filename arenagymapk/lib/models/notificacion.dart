class Notificacion {
  final int idNotificacion;
  final String titulo;
  final String mensaje;
  final String? tipo;
  final bool leida;
  final String fechaCreacion;

  Notificacion({
    required this.idNotificacion,
    required this.titulo,
    required this.mensaje,
    required this.tipo,
    required this.leida,
    required this.fechaCreacion,
  });

  factory Notificacion.fromJson(Map<String, dynamic> json) {
    return Notificacion(
      idNotificacion: json['id_notificacion'] as int,
      titulo: json['titulo']?.toString() ?? '',
      mensaje: json['mensaje']?.toString() ?? '',
      tipo: json['tipo'] as String?,
      leida: json['leida'] as bool? ?? false,
      fechaCreacion: json['fecha_creacion']?.toString() ?? '',
    );
  }
}
