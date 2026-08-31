class Membresia {
  final int idMembresia;
  final String tipo;
  final int duracionDias;
  final String precio;

  Membresia({
    required this.idMembresia,
    required this.tipo,
    required this.duracionDias,
    required this.precio,
  });

  factory Membresia.fromJson(Map<String, dynamic> json) {
    return Membresia(
      idMembresia: json['id_membresia'] as int,
      tipo: json['tipo']?.toString() ?? '',
      duracionDias: json['duracion_dias'] as int? ?? 0,
      precio: json['precio']?.toString() ?? '0',
    );
  }
}

class MembresiaActiva {
  final int idRegistro;
  final String fechaInicio;
  final String fechaFin;
  final bool activo;
  final Membresia membresia;

  MembresiaActiva({
    required this.idRegistro,
    required this.fechaInicio,
    required this.fechaFin,
    required this.activo,
    required this.membresia,
  });

  /// Días restantes hasta la fecha de vencimiento (puede ser negativo si ya venció).
  int get diasRestantes {
    final fin = DateTime.tryParse(fechaFin);
    if (fin == null) return 0;
    final hoy = DateTime.now();
    final hoySinHora = DateTime(hoy.year, hoy.month, hoy.day);
    final finSinHora = DateTime(fin.year, fin.month, fin.day);
    return finSinHora.difference(hoySinHora).inDays;
  }

  factory MembresiaActiva.fromJson(Map<String, dynamic> json) {
    return MembresiaActiva(
      idRegistro: json['id_registro'] as int,
      fechaInicio: json['fecha_inicio']?.toString() ?? '',
      fechaFin: json['fecha_fin']?.toString() ?? '',
      activo: json['activo'] as bool? ?? false,
      membresia: Membresia.fromJson(
        json['Membresia'] as Map<String, dynamic>? ?? const {},
      ),
    );
  }
}
