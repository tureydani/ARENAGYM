class ResumenAsistencias {
  final String? mes;
  final int totalMes;
  final int totalHistorico;
  final int racha;
  final String? ultimaVisita;
  final List<String> diasDelMes;

  ResumenAsistencias({
    this.mes,
    required this.totalMes,
    required this.totalHistorico,
    required this.racha,
    required this.ultimaVisita,
    required this.diasDelMes,
  });

  factory ResumenAsistencias.fromJson(Map<String, dynamic> json) {
    return ResumenAsistencias(
      mes: json['mes'] as String?,
      // El backend expone tanto "totalMes" como "totalDelMes" para el
      // conteo del mes consultado; se acepta cualquiera de los dos.
      totalMes: json['totalMes'] as int? ?? json['totalDelMes'] as int? ?? 0,
      totalHistorico: json['totalHistorico'] as int? ?? 0,
      racha: json['racha'] as int? ?? 0,
      ultimaVisita: json['ultimaVisita'] as String?,
      diasDelMes: (json['diasDelMes'] as List<dynamic>? ?? const [])
          .map((e) => e.toString())
          .toList(),
    );
  }
}
