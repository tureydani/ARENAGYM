import 'dart:math' as math;

import 'package:google_mlkit_pose_detection/google_mlkit_pose_detection.dart';

import '../models/metricas_fisicas.dart';

/// Resultado de analizar UNA fotografía con [PoseAnalysisService]: los
/// landmarks crudos (para guardarlos todos, sección 8 del pedido) más el
/// resultado del control de calidad. Las métricas geométricas completas
/// ([MetricasFisicas]) solo se calculan para la foto FRONTAL -- ver
/// comentario en [PoseAnalysisService.calcularMetricas].
class ResultadoAnalisisFoto {
  final List<LandmarkCrudo> landmarks;
  final CalidadFoto calidad;
  final double confianzaMedia;
  final int landmarksValidos;
  final double porcentajeCuerpoDetectado;
  final int anchoPx;
  final int altoPx;
  final TipoEncuadre encuadre;
  final int qualityScore;
  final CalidadCaptura calidadCaptura;

  ResultadoAnalisisFoto({
    required this.landmarks,
    required this.calidad,
    required this.confianzaMedia,
    required this.landmarksValidos,
    required this.porcentajeCuerpoDetectado,
    required this.anchoPx,
    required this.altoPx,
    this.encuadre = TipoEncuadre.completo,
    this.qualityScore = 0,
    this.calidadCaptura = CalidadCaptura.insuficiente,
  });
}

/// Versión del algoritmo de cálculo de métricas/calidad. Se guarda junto a
/// cada evaluación (ver [PoseAnalysisService.calcularMetricas] y el campo
/// `algoritmo_version` en `metricas_fisicas`) para poder distinguir, si en
/// el futuro se ajustan las fórmulas, con qué versión fue calculada cada
/// evaluación histórica.
const String poseAlgorithmVersion = '1.1.0';

/// Categoría legible de [ResultadoAnalisisFoto.qualityScore] (0-100).
/// Umbrales documentados: 85+ excelente, 70-84 buena, 50-69 aceptable
/// (mínimo para aceptar la foto), <50 insuficiente.
enum CalidadCaptura { excelente, buena, aceptable, insuficiente }

String calidadCapturaLabel(CalidadCaptura c) {
  switch (c) {
    case CalidadCaptura.excelente:
      return 'Excelente';
    case CalidadCaptura.buena:
      return 'Buena';
    case CalidadCaptura.aceptable:
      return 'Aceptable';
    case CalidadCaptura.insuficiente:
      return 'Insuficiente';
  }
}

CalidadCaptura _categorizarCalidad(int qualityScore) {
  if (qualityScore >= 85) return CalidadCaptura.excelente;
  if (qualityScore >= 70) return CalidadCaptura.buena;
  if (qualityScore >= 50) return CalidadCaptura.aceptable;
  return CalidadCaptura.insuficiente;
}

/// Qué parte del cuerpo logró cubrir la foto aceptada. [medioCuerpo] se
/// acepta como alternativa cuando no se ven rodillas/tobillos (p.ej. poco
/// espacio para alejarse la cámara) -- las métricas que dependen de piernas
/// quedan null (ver [PoseAnalysisService.calcularMetricas], que ya es
/// null-safe por landmark), en vez de rechazar la foto completa.
enum TipoEncuadre { completo, medioCuerpo }

class LandmarkCrudo {
  final int index;
  final double x; // normalizado 0-1 (x_px / anchoImagen)
  final double y; // normalizado 0-1 (y_px / altoImagen)
  final double z;
  final double visibility;

  LandmarkCrudo({required this.index, required this.x, required this.y, required this.z, required this.visibility});

  Map<String, dynamic> toJson() => {'index': index, 'x': x, 'y': y, 'z': z, 'visibility': visibility};
}

enum CalidadFoto { aceptable, insuficiente }

/// Motivo de un rechazo de calidad, para mostrar un mensaje específico en
/// vez de un genérico "foto insuficiente" (sección 7 del pedido).
enum MotivoRechazoFoto { sinPersona, cuerpoIncompleto, posturaInclinada, confianzaBaja }

/// Referencias anatómicas (distancias en el espacio normalizado 0-1 de los
/// landmarks) a partir de las cuales [PoseAnalysisService.calcularMetricas]
/// deriva TODAS las proporciones. Cada una puede ser `null` si faltan los
/// landmarks que la componen -- nunca se asume un valor por defecto.
class EscalasCorporales {
  final double? alturaCorporal; // nariz -> punto medio tobillos (solo cuerpo completo)
  final double? anchoHombros;
  final double? anchoCadera;
  final double? longitudTorso; // centro hombros -> centro cadera
  final double? longitudBrazoIzq;
  final double? longitudBrazoDer;
  final double? longitudBrazoPromedio;
  final double? longitudPiernaIzq;
  final double? longitudPiernaDer;
  final double? longitudPiernaPromedio;

  EscalasCorporales({
    this.alturaCorporal,
    this.anchoHombros,
    this.anchoCadera,
    this.longitudTorso,
    this.longitudBrazoIzq,
    this.longitudBrazoDer,
    this.longitudBrazoPromedio,
    this.longitudPiernaIzq,
    this.longitudPiernaDer,
    this.longitudPiernaPromedio,
  });
}

class AnalisisConMotivo {
  final ResultadoAnalisisFoto resultado;
  final MotivoRechazoFoto? motivoRechazo;
  AnalisisConMotivo(this.resultado, this.motivoRechazo);
}

/// Umbral de confianza mínima por landmark para considerarlo "válido".
const double _umbralVisibilidad = 0.5;

/// Landmarks que deben estar visibles para aceptar la fotografía como
/// cuerpo COMPLETO: hombros, caderas, rodillas, tobillos y nariz (sección 6
/// del pedido).
const _landmarksCore = [
  PoseLandmarkType.nose,
  PoseLandmarkType.leftShoulder,
  PoseLandmarkType.rightShoulder,
  PoseLandmarkType.leftHip,
  PoseLandmarkType.rightHip,
  PoseLandmarkType.leftKnee,
  PoseLandmarkType.rightKnee,
  PoseLandmarkType.leftAnkle,
  PoseLandmarkType.rightAnkle,
];

/// Alternativa de [_landmarksCore] para aceptar una foto de MEDIO CUERPO
/// (torso hacia arriba): sin rodillas/tobillos, las métricas de piernas
/// simplemente quedan null en vez de rechazar la foto entera.
const _landmarksCoreMedioCuerpo = [
  PoseLandmarkType.nose,
  PoseLandmarkType.leftShoulder,
  PoseLandmarkType.rightShoulder,
  PoseLandmarkType.leftHip,
  PoseLandmarkType.rightHip,
];

/// Envuelve `google_mlkit_pose_detection` (ver pubspec.yaml para la
/// justificación de por qué se eligió sobre un wrapper literal de
/// MediaPipe Tasks). Corre 100% en el dispositivo, sin conexión.
///
/// LIMITACIÓN CONOCIDA (documentada, no inventada): no se implementa un
/// detector de desenfoque (blur) dedicado -- hacerlo bien requiere un
/// algoritmo de varianza de bordes (Laplaciano) que no está disponible de
/// forma confiable sin agregar otra dependencia de procesamiento de
/// imágenes de bajo nivel. El control de calidad de esta fase se basa en:
/// persona detectada, cobertura de landmarks núcleo, confianza media y
/// postura no excesivamente inclinada -- que en la práctica descarta la
/// mayoría de fotos inválidas (sin persona, recortadas, en ángulo extremo)
/// aunque no detecta una foto borrosa de un cuerpo bien encuadrado.
class PoseAnalysisService {
  PoseAnalysisService._();
  static final PoseAnalysisService instance = PoseAnalysisService._();

  PoseDetector? _detector;

  PoseDetector _obtenerDetector() {
    return _detector ??= PoseDetector(
      options: PoseDetectorOptions(mode: PoseDetectionMode.single),
    );
  }

  Future<void> dispose() async {
    await _detector?.close();
    _detector = null;
  }

  /// Analiza una fotografía: corre el detector de pose y evalúa calidad.
  /// [rutaImagen] debe ser un archivo ya orientado/comprimido (ver
  /// CapturaFotoController).
  Future<AnalisisConMotivo> analizarFoto(String rutaImagen, {required int anchoPx, required int altoPx}) async {
    final inputImage = InputImage.fromFilePath(rutaImagen);
    final poses = await _obtenerDetector().processImage(inputImage);

    if (poses.isEmpty) {
      final vacio = ResultadoAnalisisFoto(
        landmarks: const [],
        calidad: CalidadFoto.insuficiente,
        confianzaMedia: 0,
        landmarksValidos: 0,
        porcentajeCuerpoDetectado: 0,
        anchoPx: anchoPx,
        altoPx: altoPx,
      );
      return AnalisisConMotivo(vacio, MotivoRechazoFoto.sinPersona);
    }

    final pose = poses.first;
    final landmarksCrudos = pose.landmarks.values.map((lm) {
      return LandmarkCrudo(
        index: lm.type.index,
        x: anchoPx > 0 ? (lm.x / anchoPx).clamp(0.0, 1.0) : 0,
        y: altoPx > 0 ? (lm.y / altoPx).clamp(0.0, 1.0) : 0,
        // ML Kit entrega z en la misma escala en píxeles que x/y ANTES de
        // normalizar (puede valer varios cientos) -- si se guarda tal cual,
        // desborda la columna pose_landmarks.z (DECIMAL(7,5), máx ~100) y
        // Postgres rechaza el INSERT completo con un error 500. Se
        // normaliza con la misma referencia que x (ancho de imagen) y se
        // acota a un rango razonable para la columna.
        z: anchoPx > 0 ? (lm.z / anchoPx).clamp(-10.0, 10.0) : 0,
        visibility: lm.likelihood,
      );
    }).toList();

    final confianzaMedia = landmarksCrudos.isEmpty
        ? 0.0
        : landmarksCrudos.map((l) => l.visibility).reduce((a, b) => a + b) / landmarksCrudos.length;
    final landmarksValidos = landmarksCrudos.where((l) => l.visibility >= _umbralVisibilidad).length;
    final porcentajeCuerpoDetectado = (landmarksValidos / 33) * 100;

    bool coreSatisfecho(List<PoseLandmarkType> core) {
      final visibles = core.where((tipo) {
        final lm = pose.landmarks[tipo];
        return lm != null && lm.likelihood >= _umbralVisibilidad;
      }).length;
      return visibles >= (core.length * 0.8).ceil();
    }

    final esCuerpoCompleto = coreSatisfecho(_landmarksCore);
    final esMedioCuerpo = !esCuerpoCompleto && coreSatisfecho(_landmarksCoreMedioCuerpo);
    final coreCompleto = esCuerpoCompleto || esMedioCuerpo;
    final encuadre = esCuerpoCompleto ? TipoEncuadre.completo : TipoEncuadre.medioCuerpo;

    double? inclinacionHombros;
    final hombroIzq = pose.landmarks[PoseLandmarkType.leftShoulder];
    final hombroDer = pose.landmarks[PoseLandmarkType.rightShoulder];
    if (hombroIzq != null && hombroDer != null) {
      inclinacionHombros = _anguloGrados(hombroDer.x - hombroIzq.x, hombroDer.y - hombroIzq.y);
    }

    MotivoRechazoFoto? motivo;
    if (!coreCompleto) {
      motivo = MotivoRechazoFoto.cuerpoIncompleto;
    } else if (confianzaMedia < _umbralVisibilidad) {
      motivo = MotivoRechazoFoto.confianzaBaja;
    } else if (inclinacionHombros != null && inclinacionHombros.abs() > 30) {
      motivo = MotivoRechazoFoto.posturaInclinada;
    }

    // qualityScore (0-100): combina señales ya disponibles con ML Kit para
    // diferenciar calidad DENTRO de las fotos aceptadas -- no sustituye un
    // detector de desenfoque real (ver limitación documentada en la clase).
    // Pesos: 40% confianza media de landmarks, 30% cobertura del conjunto
    // núcleo aplicable (completo o medio cuerpo), 20% alineación de hombros,
    // 10% cobertura general de los 33 landmarks.
    final coreAplicable = esCuerpoCompleto ? _landmarksCore : _landmarksCoreMedioCuerpo;
    final coberturaCoreAplicable = coreAplicable.where((tipo) {
          final lm = pose.landmarks[tipo];
          return lm != null && lm.likelihood >= _umbralVisibilidad;
        }).length /
        coreAplicable.length *
        100;
    final puntajeInclinacion = inclinacionHombros == null
        ? 50.0
        : (100 - (inclinacionHombros.abs() / 30 * 100)).clamp(0.0, 100.0);
    final qualityScore = (confianzaMedia * 100 * 0.4 +
            coberturaCoreAplicable * 0.3 +
            puntajeInclinacion * 0.2 +
            porcentajeCuerpoDetectado * 0.1)
        .clamp(0, 100)
        .round();

    final resultado = ResultadoAnalisisFoto(
      landmarks: landmarksCrudos,
      calidad: motivo == null ? CalidadFoto.aceptable : CalidadFoto.insuficiente,
      confianzaMedia: confianzaMedia,
      landmarksValidos: landmarksValidos,
      porcentajeCuerpoDetectado: porcentajeCuerpoDetectado,
      anchoPx: anchoPx,
      altoPx: altoPx,
      encuadre: encuadre,
      qualityScore: qualityScore,
      calidadCaptura: _categorizarCalidad(qualityScore),
    );
    return AnalisisConMotivo(resultado, motivo);
  }

  /// Calcula las referencias anatómicas (distancias en el mismo espacio
  /// normalizado 0-1 que [LandmarkCrudo]) a partir de las cuales se derivan
  /// TODAS las métricas de [calcularMetricas]. Separarlas en su propia
  /// estructura evita el problema que tenía la versión anterior: usar una
  /// única referencia (altura corporal completa) para normalizar todo, lo
  /// que volvía null prácticamente cualquier proporción en una foto de
  /// medio cuerpo (sin tobillos no hay altura, sin altura no hay nada).
  /// Cada métrica en [calcularMetricas] elige la referencia anatómica que
  /// de verdad necesita (ver sección 7 de los requisitos del módulo).
  EscalasCorporales calcularEscalas(List<LandmarkCrudo> landmarks) {
    final porIndice = {for (final l in landmarks) l.index: l};
    LandmarkCrudo? get(PoseLandmarkType t) => porIndice[t.index];

    final hombroIzq = get(PoseLandmarkType.leftShoulder);
    final hombroDer = get(PoseLandmarkType.rightShoulder);
    final caderaIzq = get(PoseLandmarkType.leftHip);
    final caderaDer = get(PoseLandmarkType.rightHip);
    final codoIzq = get(PoseLandmarkType.leftElbow);
    final codoDer = get(PoseLandmarkType.rightElbow);
    final munecaIzq = get(PoseLandmarkType.leftWrist);
    final munecaDer = get(PoseLandmarkType.rightWrist);
    final rodillaIzq = get(PoseLandmarkType.leftKnee);
    final rodillaDer = get(PoseLandmarkType.rightKnee);
    final tobilloIzq = get(PoseLandmarkType.leftAnkle);
    final tobilloDer = get(PoseLandmarkType.rightAnkle);
    final nariz = get(PoseLandmarkType.nose);

    // Solo existe cuando hay nariz + ambos tobillos (cuerpo completo).
    double? alturaCorporal;
    if (nariz != null && tobilloIzq != null && tobilloDer != null) {
      final tobilloMedioY = (tobilloIzq.y + tobilloDer.y) / 2;
      final tobilloMedioX = (tobilloIzq.x + tobilloDer.x) / 2;
      alturaCorporal = _distancia(nariz.x, nariz.y, tobilloMedioX, tobilloMedioY);
    }

    final anchoHombros = (hombroIzq != null && hombroDer != null)
        ? _distancia(hombroIzq.x, hombroIzq.y, hombroDer.x, hombroDer.y)
        : null;
    final anchoCadera = (caderaIzq != null && caderaDer != null)
        ? _distancia(caderaIzq.x, caderaIzq.y, caderaDer.x, caderaDer.y)
        : null;

    final longitudTorso = (hombroIzq != null && hombroDer != null && caderaIzq != null && caderaDer != null)
        ? _distancia(
            (hombroIzq.x + hombroDer.x) / 2,
            (hombroIzq.y + hombroDer.y) / 2,
            (caderaIzq.x + caderaDer.x) / 2,
            (caderaIzq.y + caderaDer.y) / 2,
          )
        : null;

    double? longitudBrazo(LandmarkCrudo? hombro, LandmarkCrudo? codo, LandmarkCrudo? muneca) {
      if (hombro == null || codo == null || muneca == null) return null;
      return _distancia(hombro.x, hombro.y, codo.x, codo.y) + _distancia(codo.x, codo.y, muneca.x, muneca.y);
    }

    double? longitudPierna(LandmarkCrudo? cadera, LandmarkCrudo? rodilla, LandmarkCrudo? tobillo) {
      if (cadera == null || rodilla == null || tobillo == null) return null;
      return _distancia(cadera.x, cadera.y, rodilla.x, rodilla.y) + _distancia(rodilla.x, rodilla.y, tobillo.x, tobillo.y);
    }

    final brazoIzqLen = longitudBrazo(hombroIzq, codoIzq, munecaIzq);
    final brazoDerLen = longitudBrazo(hombroDer, codoDer, munecaDer);
    final piernaIzqLen = longitudPierna(caderaIzq, rodillaIzq, tobilloIzq);
    final piernaDerLen = longitudPierna(caderaDer, rodillaDer, tobilloDer);

    double? promedio(double? a, double? b) {
      if (a == null && b == null) return null;
      if (a == null) return b;
      if (b == null) return a;
      return (a + b) / 2;
    }

    return EscalasCorporales(
      alturaCorporal: alturaCorporal,
      anchoHombros: anchoHombros,
      anchoCadera: anchoCadera,
      longitudTorso: longitudTorso,
      longitudBrazoIzq: brazoIzqLen,
      longitudBrazoDer: brazoDerLen,
      longitudBrazoPromedio: promedio(brazoIzqLen, brazoDerLen),
      longitudPiernaIzq: piernaIzqLen,
      longitudPiernaDer: piernaDerLen,
      longitudPiernaPromedio: promedio(piernaIzqLen, piernaDerLen),
    );
  }

  /// Divide [valor] entre [referencia] de forma null-safe: si cualquiera de
  /// los dos no existe, o la referencia es 0 o negativa, el resultado es
  /// `null` -- nunca 0 (sección 29 de los requisitos: un dato no disponible
  /// nunca debe convertirse en un valor que parezca un dato real).
  double? _normalizar(double? valor, double? referencia) {
    if (valor == null || referencia == null || referencia <= 0) return null;
    return valor / referencia;
  }

  /// Calcula las métricas geométricas/proporcionales de la evaluación a
  /// partir de los landmarks de la foto FRONTAL.
  ///
  /// Por qué solo la frontal en esta fase: hombros/cadera/brazos/piernas se
  /// ven completos y sin oclusión desde el frente; usar también la lateral
  /// u otras fotos requeriría fusionar landmarks de distintas tomas (misma
  /// persona, distinto ángulo, sin garantía de misma distancia/escala), lo
  /// que agregaría una fuente de error que no está validada todavía. Queda
  /// documentado como un próximo paso (ver entregable final, sección
  /// "Próximos pasos").
  MetricasFisicas calcularMetricas(List<LandmarkCrudo> landmarksFrontal) {
    final escalas = calcularEscalas(landmarksFrontal);
    final porIndice = {for (final l in landmarksFrontal) l.index: l};
    LandmarkCrudo? get(PoseLandmarkType t) => porIndice[t.index];

    final hombroIzq = get(PoseLandmarkType.leftShoulder);
    final hombroDer = get(PoseLandmarkType.rightShoulder);
    final caderaIzq = get(PoseLandmarkType.leftHip);
    final caderaDer = get(PoseLandmarkType.rightHip);
    final codoIzq = get(PoseLandmarkType.leftElbow);
    final codoDer = get(PoseLandmarkType.rightElbow);
    final munecaIzq = get(PoseLandmarkType.leftWrist);
    final munecaDer = get(PoseLandmarkType.rightWrist);
    final rodillaIzq = get(PoseLandmarkType.leftKnee);
    final rodillaDer = get(PoseLandmarkType.rightKnee);
    final tobilloIzq = get(PoseLandmarkType.leftAnkle);
    final tobilloDer = get(PoseLandmarkType.rightAnkle);

    final brazoIzqLen = escalas.longitudBrazoIzq;
    final brazoDerLen = escalas.longitudBrazoDer;
    final piernaIzqLen = escalas.longitudPiernaIzq;
    final piernaDerLen = escalas.longitudPiernaDer;
    final anchoHombros = escalas.anchoHombros;
    final anchoCadera = escalas.anchoCadera;

    double? simetria(double? a, double? b) {
      if (a == null || b == null) return null;
      final maximo = math.max(a, b);
      if (maximo == 0) return null;
      return (1 - (a - b).abs() / maximo).clamp(0.0, 1.0);
    }

    final inclinacionHombros = (hombroIzq != null && hombroDer != null)
        ? _anguloGrados(hombroDer.x - hombroIzq.x, hombroDer.y - hombroIzq.y)
        : null;
    final inclinacionCadera = (caderaIzq != null && caderaDer != null)
        ? _anguloGrados(caderaDer.x - caderaIzq.x, caderaDer.y - caderaIzq.y)
        : null;

    double? anguloArticulacion(LandmarkCrudo? a, LandmarkCrudo? vertice, LandmarkCrudo? c) {
      if (a == null || vertice == null || c == null) return null;
      final v1x = a.x - vertice.x, v1y = a.y - vertice.y;
      final v2x = c.x - vertice.x, v2y = c.y - vertice.y;
      final producto = v1x * v2x + v1y * v2y;
      final mag1 = math.sqrt(v1x * v1x + v1y * v1y);
      final mag2 = math.sqrt(v2x * v2x + v2y * v2y);
      if (mag1 == 0 || mag2 == 0) return null;
      final coseno = (producto / (mag1 * mag2)).clamp(-1.0, 1.0);
      return math.acos(coseno) * 180 / math.pi;
    }

    final anguloRodillaIzq = anguloArticulacion(caderaIzq, rodillaIzq, tobilloIzq);
    final anguloRodillaDer = anguloArticulacion(caderaDer, rodillaDer, tobilloDer);
    final anguloCodoIzq = anguloArticulacion(hombroIzq, codoIzq, munecaIzq);
    final anguloCodoDer = anguloArticulacion(hombroDer, codoDer, munecaDer);

    double? promedio(double? a, double? b) {
      if (a == null && b == null) return null;
      if (a == null) return b;
      if (b == null) return a;
      return (a + b) / 2;
    }

    // Alineación postural: qué tan alineados verticalmente están
    // hombros/cadera respecto al eje central del cuerpo (0 = perfecto).
    double? alineacionPostural;
    if (hombroIzq != null && hombroDer != null && caderaIzq != null && caderaDer != null) {
      final centroHombros = (hombroIzq.x + hombroDer.x) / 2;
      final centroCadera = (caderaIzq.x + caderaDer.x) / 2;
      final anchoRef = anchoHombros ?? 1;
      final desvio = anchoRef > 0 ? (centroHombros - centroCadera).abs() / anchoRef : 1.0;
      alineacionPostural = (1 - desvio.clamp(0.0, 1.0));
    }

    final confianzas = [hombroIzq, hombroDer, caderaIzq, caderaDer, rodillaIzq, rodillaDer, tobilloIzq, tobilloDer]
        .whereType<LandmarkCrudo>()
        .map((l) => l.visibility);
    final confianzaMedia = confianzas.isEmpty ? null : confianzas.reduce((a, b) => a + b) / confianzas.length;

    return MetricasFisicas(
      // Ancho de hombros/cadera relativo a la altura corporal cuando existe
      // (cuerpo completo); si no (medio cuerpo, sin tobillos), se usa el
      // torso como referencia alternativa -- sigue siendo un indicador de
      // proporción relativa, documentado como tal, en vez de quedar null.
      anchoHombrosRelativo: _normalizar(anchoHombros, escalas.alturaCorporal ?? escalas.longitudTorso),
      anchoCaderaRelativo: _normalizar(anchoCadera, escalas.alturaCorporal ?? escalas.longitudTorso),
      relacionHombrosCadera: _normalizar(anchoHombros, anchoCadera),
      // Torso y brazo usan el ancho de hombros como unidad de referencia:
      // está disponible tanto en cuerpo completo como en medio cuerpo, a
      // diferencia de la altura corporal (que necesita los tobillos).
      torsoRelativo: _normalizar(escalas.longitudTorso, anchoHombros),
      brazoRelativo: _normalizar(escalas.longitudBrazoPromedio, anchoHombros),
      // Piernas: solo tiene sentido relativo a la altura corporal completa.
      piernaRelativa: _normalizar(escalas.longitudPiernaPromedio, escalas.alturaCorporal),
      // "Simetría" de hombros/cadera = qué tan nivelados están (1 = sin
      // inclinación). No se reutiliza la fórmula de simetria() de arriba
      // (pensada para comparar LONGITUDES izquierda/derecha) porque acá se
      // compara una inclinación en grados, no dos magnitudes homogéneas.
      simetriaHombros: inclinacionHombros == null ? null : (1 - (inclinacionHombros.abs() / 45).clamp(0.0, 1.0)),
      simetriaCadera: inclinacionCadera == null ? null : (1 - (inclinacionCadera.abs() / 45).clamp(0.0, 1.0)),
      simetriaBrazos: simetria(brazoIzqLen, brazoDerLen),
      simetriaPiernas: simetria(piernaIzqLen, piernaDerLen),
      inclinacionHombros: inclinacionHombros,
      inclinacionCadera: inclinacionCadera,
      alineacionPostural: alineacionPostural,
      anguloRodillas: promedio(anguloRodillaIzq, anguloRodillaDer),
      anguloCodos: promedio(anguloCodoIzq, anguloCodoDer),
      confianzaMedia: confianzaMedia,
      landmarksValidos: landmarksFrontal.where((l) => l.visibility >= _umbralVisibilidad).length,
      porcentajeCuerpoDetectado: (landmarksFrontal.where((l) => l.visibility >= _umbralVisibilidad).length / 33) * 100,
      calidadAnalisis: confianzaMedia == null
          ? null
          : confianzaMedia >= 0.75
              ? 'ALTA'
              : confianzaMedia >= 0.5
                  ? 'MEDIA'
                  : 'BAJA',
      algoritmoVersion: poseAlgorithmVersion,
    );
  }

  double _distancia(double x1, double y1, double x2, double y2) => math.sqrt(math.pow(x2 - x1, 2) + math.pow(y2 - y1, 2));

  /// Inclinación de una línea (hombros/cadera) respecto a la horizontal, en
  /// grados, dentro de -90..90. Se usa SIEMPRE con un par izquierda/derecha
  /// (p.ej. hombroDer - hombroIzq), y en una foto de frente el hombro
  /// izquierdo anatómico cae a la derecha de la imagen (la foto es un
  /// "espejo" de la persona) -- por lo que ese vector casi siempre apunta
  /// hacia la izquierda (dx negativo) incluso con hombros perfectamente
  /// nivelados. atan2 crudo da entonces ~180° en vez de ~0° para la misma
  /// inclinación real. Como la línea no tiene una dirección que importe
  /// (hombro A -> hombro B es igual de "nivelada" que B -> A), se dobla el
  /// resultado al rango -90..90 para medir la inclinación real de la línea.
  double _anguloGrados(double dx, double dy) {
    var angulo = math.atan2(dy, dx) * 180 / math.pi;
    if (angulo > 90) angulo -= 180;
    if (angulo < -90) angulo += 180;
    return angulo;
  }
}
