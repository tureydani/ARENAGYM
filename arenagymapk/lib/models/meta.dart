class Meta {
  final int idMeta;
  final int idUsuario;
  final String tipoMeta;
  final double? valorInicial;
  final double? valorObjetivo;
  final double? valorActual;
  final String fechaInicio;
  final String? fechaObjetivo;
  final String estado;
  final String? descripcion;

  Meta({
    required this.idMeta,
    required this.idUsuario,
    required this.tipoMeta,
    required this.valorInicial,
    required this.valorObjetivo,
    required this.valorActual,
    required this.fechaInicio,
    required this.fechaObjetivo,
    required this.estado,
    required this.descripcion,
  });

  /// Progreso de 0.0 a 1.0 entre [valorInicial] y [valorObjetivo], según
  /// dónde se ubica [valorActual]. Null si no hay suficientes datos.
  double? get progreso {
    if (valorInicial == null || valorObjetivo == null || valorActual == null) {
      return null;
    }
    final rango = valorObjetivo! - valorInicial!;
    if (rango == 0) return 1.0;
    final avance = (valorActual! - valorInicial!) / rango;
    return avance.clamp(0.0, 1.0);
  }

  factory Meta.fromJson(Map<String, dynamic> json) {
    return Meta(
      idMeta: json['id_meta'] as int,
      idUsuario: json['id_usuario'] as int? ?? 0,
      tipoMeta: json['tipo_meta']?.toString() ?? '',
      valorInicial: double.tryParse(json['valor_inicial']?.toString() ?? ''),
      valorObjetivo: double.tryParse(json['valor_objetivo']?.toString() ?? ''),
      valorActual: double.tryParse(json['valor_actual']?.toString() ?? ''),
      fechaInicio: json['fecha_inicio']?.toString() ?? '',
      fechaObjetivo: json['fecha_objetivo'] as String?,
      estado: json['estado']?.toString() ?? 'activa',
      descripcion: json['descripcion'] as String?,
    );
  }
}
