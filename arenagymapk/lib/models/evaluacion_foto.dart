/// Metadata de una fotografía corporal (los bytes nunca viajan en este
/// modelo: se piden aparte a GET /progresos/{id}/fotos/{fotoId}, que es la
/// única vía autenticada para leerlos).
class EvaluacionFoto {
  final int idFoto;
  final int idProgreso;
  final String tipo; // frente | espalda | lateral | lateral_derecha
  final String? calidad; // ACEPTABLE | INSUFICIENTE
  final double? confianza;
  final int? anchoPx;
  final int? altoPx;
  final String fechaSubida;
  final String? encuadre; // completo | medioCuerpo
  final int? qualityScore; // 0-100
  final String? calidadCaptura; // EXCELENTE | BUENA | ACEPTABLE | INSUFICIENTE

  EvaluacionFoto({
    required this.idFoto,
    required this.idProgreso,
    required this.tipo,
    required this.calidad,
    required this.confianza,
    required this.anchoPx,
    required this.altoPx,
    required this.fechaSubida,
    this.encuadre,
    this.qualityScore,
    this.calidadCaptura,
  });

  factory EvaluacionFoto.fromJson(Map<String, dynamic> json) {
    return EvaluacionFoto(
      idFoto: json['id_foto'] as int,
      idProgreso: json['id_progreso'] as int,
      tipo: json['tipo']?.toString() ?? '',
      calidad: json['calidad'] as String?,
      confianza: double.tryParse(json['confianza']?.toString() ?? ''),
      anchoPx: json['ancho_px'] as int?,
      altoPx: json['alto_px'] as int?,
      fechaSubida: json['fecha_subida']?.toString() ?? '',
      encuadre: json['encuadre'] as String?,
      qualityScore: json['quality_score'] as int?,
      calidadCaptura: json['calidad_captura'] as String?,
    );
  }
}

const tiposFotoEvaluacion = <String, String>{
  'frente': 'Frontal',
  'espalda': 'Posterior',
  'lateral': 'Lateral',
  'lateral_derecha': 'Lateral derecha',
};
