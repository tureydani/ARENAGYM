class Progreso {
  final int idProgreso;
  final int idUsuario;
  final String fecha;
  final double? peso;
  final double? porcentajeGrasa;
  final double? pecho;
  final double? cintura;
  final double? brazo;
  final double? pierna;
  final double? cadera;
  final String? observaciones;

  Progreso({
    required this.idProgreso,
    required this.idUsuario,
    required this.fecha,
    required this.peso,
    required this.porcentajeGrasa,
    required this.pecho,
    required this.cintura,
    required this.brazo,
    required this.pierna,
    required this.cadera,
    required this.observaciones,
  });

  factory Progreso.fromJson(Map<String, dynamic> json) {
    return Progreso(
      idProgreso: json['id_progreso'] as int,
      idUsuario: json['id_usuario'] as int? ?? 0,
      fecha: json['fecha']?.toString() ?? '',
      peso: double.tryParse(json['peso']?.toString() ?? ''),
      porcentajeGrasa: double.tryParse(json['porcentaje_grasa']?.toString() ?? ''),
      pecho: double.tryParse(json['pecho']?.toString() ?? ''),
      cintura: double.tryParse(json['cintura']?.toString() ?? ''),
      brazo: double.tryParse(json['brazo']?.toString() ?? ''),
      pierna: double.tryParse(json['pierna']?.toString() ?? ''),
      cadera: double.tryParse(json['cadera']?.toString() ?? ''),
      observaciones: json['observaciones'] as String?,
    );
  }
}
