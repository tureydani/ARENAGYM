class ResumenAsistencias {
  final int totalMes;
  final int racha;
  final String? ultimaVisita;
  final List<String> diasDelMes;

  ResumenAsistencias({
    required this.totalMes,
    required this.racha,
    required this.ultimaVisita,
    required this.diasDelMes,
  });

  factory ResumenAsistencias.fromJson(Map<String, dynamic> json) {
    return ResumenAsistencias(
      totalMes: json['totalMes'] as int? ?? 0,
      racha: json['racha'] as int? ?? 0,
      ultimaVisita: json['ultimaVisita'] as String?,
      diasDelMes: (json['diasDelMes'] as List<dynamic>? ?? const [])
          .map((e) => e.toString())
          .toList(),
    );
  }
}
