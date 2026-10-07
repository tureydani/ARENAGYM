/// Características geométricas/proporcionales calculadas localmente por
/// [PoseAnalysisService] a partir de los landmarks de la foto frontal.
///
/// IMPORTANTE: son estimaciones geométricas, no mediciones clínicas. Nunca
/// se presentan como porcentaje de grasa, masa muscular ni medidas exactas
/// en centímetros -- eso solo existe si el cliente lo ingresa a mano
/// (medidas_manuales, ver NuevaEvaluacionScreen).
class MetricasFisicas {
  final double? anchoHombrosRelativo;
  final double? anchoCaderaRelativo;
  final double? relacionHombrosCadera;
  final double? torsoRelativo;
  final double? brazoRelativo;
  final double? piernaRelativa;
  final double? simetriaHombros;
  final double? simetriaCadera;
  final double? simetriaBrazos;
  final double? simetriaPiernas;
  final double? inclinacionHombros;
  final double? inclinacionCadera;
  final double? alineacionPostural;
  final double? anguloRodillas;
  final double? anguloCodos;
  final double? confianzaMedia;
  final int? landmarksValidos;
  final double? porcentajeCuerpoDetectado;
  final String? calidadAnalisis; // ALTA | MEDIA | BAJA
  /// Versión del algoritmo de cálculo (ver [poseAlgorithmVersion] en
  /// pose_analysis_service.dart) con la que se calculó esta evaluación.
  final String? algoritmoVersion;

  const MetricasFisicas({
    this.anchoHombrosRelativo,
    this.anchoCaderaRelativo,
    this.relacionHombrosCadera,
    this.torsoRelativo,
    this.brazoRelativo,
    this.piernaRelativa,
    this.simetriaHombros,
    this.simetriaCadera,
    this.simetriaBrazos,
    this.simetriaPiernas,
    this.inclinacionHombros,
    this.inclinacionCadera,
    this.alineacionPostural,
    this.anguloRodillas,
    this.anguloCodos,
    this.confianzaMedia,
    this.landmarksValidos,
    this.porcentajeCuerpoDetectado,
    this.calidadAnalisis,
    this.algoritmoVersion,
  });

  factory MetricasFisicas.fromJson(Map<String, dynamic> json) {
    double? d(String key) => double.tryParse(json[key]?.toString() ?? '');
    return MetricasFisicas(
      anchoHombrosRelativo: d('ancho_hombros_relativo'),
      anchoCaderaRelativo: d('ancho_cadera_relativo'),
      relacionHombrosCadera: d('relacion_hombros_cadera'),
      torsoRelativo: d('torso_relativo'),
      brazoRelativo: d('brazo_relativo'),
      piernaRelativa: d('pierna_relativa'),
      simetriaHombros: d('simetria_hombros'),
      simetriaCadera: d('simetria_cadera'),
      simetriaBrazos: d('simetria_brazos'),
      simetriaPiernas: d('simetria_piernas'),
      inclinacionHombros: d('inclinacion_hombros'),
      inclinacionCadera: d('inclinacion_cadera'),
      alineacionPostural: d('alineacion_postural'),
      anguloRodillas: d('angulo_rodillas'),
      anguloCodos: d('angulo_codos'),
      confianzaMedia: d('confianza_media'),
      landmarksValidos: json['landmarks_validos'] as int?,
      porcentajeCuerpoDetectado: d('porcentaje_cuerpo_detectado'),
      calidadAnalisis: json['calidad_analisis'] as String?,
      algoritmoVersion: json['algoritmo_version'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    if (anchoHombrosRelativo != null) 'ancho_hombros_relativo': anchoHombrosRelativo,
    if (anchoCaderaRelativo != null) 'ancho_cadera_relativo': anchoCaderaRelativo,
    if (relacionHombrosCadera != null) 'relacion_hombros_cadera': relacionHombrosCadera,
    if (torsoRelativo != null) 'torso_relativo': torsoRelativo,
    if (brazoRelativo != null) 'brazo_relativo': brazoRelativo,
    if (piernaRelativa != null) 'pierna_relativa': piernaRelativa,
    if (simetriaHombros != null) 'simetria_hombros': simetriaHombros,
    if (simetriaCadera != null) 'simetria_cadera': simetriaCadera,
    if (simetriaBrazos != null) 'simetria_brazos': simetriaBrazos,
    if (simetriaPiernas != null) 'simetria_piernas': simetriaPiernas,
    if (inclinacionHombros != null) 'inclinacion_hombros': inclinacionHombros,
    if (inclinacionCadera != null) 'inclinacion_cadera': inclinacionCadera,
    if (alineacionPostural != null) 'alineacion_postural': alineacionPostural,
    if (anguloRodillas != null) 'angulo_rodillas': anguloRodillas,
    if (anguloCodos != null) 'angulo_codos': anguloCodos,
    if (confianzaMedia != null) 'confianza_media': confianzaMedia,
    if (landmarksValidos != null) 'landmarks_validos': landmarksValidos,
    if (porcentajeCuerpoDetectado != null) 'porcentaje_cuerpo_detectado': porcentajeCuerpoDetectado,
    if (calidadAnalisis != null) 'calidad_analisis': calidadAnalisis,
    if (algoritmoVersion != null) 'algoritmo_version': algoritmoVersion,
  };
}
