import 'package:flutter_test/flutter_test.dart';
import 'package:google_mlkit_pose_detection/google_mlkit_pose_detection.dart';
import 'package:arenagymapk/services/pose_analysis_service.dart';

/// Construye un landmark de prueba en el espacio normalizado 0-1 que usa
/// [LandmarkCrudo] (igual al que produce PoseAnalysisService.analizarFoto).
LandmarkCrudo _lm(PoseLandmarkType tipo, double x, double y, {double visibility = 0.95}) {
  return LandmarkCrudo(index: tipo.index, x: x, y: y, z: 0, visibility: visibility);
}

/// Pose de referencia de CUERPO COMPLETO, de pie, de frente, erguida.
/// Coordenadas pensadas solo para que las distancias relativas sean
/// coherentes (hombros más anchos que cadera, piernas más largas que
/// brazos, etc.), no para representar proporciones humanas exactas.
List<LandmarkCrudo> _poseCompleta() => [
      _lm(PoseLandmarkType.nose, 0.50, 0.10),
      _lm(PoseLandmarkType.leftShoulder, 0.62, 0.25),
      _lm(PoseLandmarkType.rightShoulder, 0.38, 0.25),
      _lm(PoseLandmarkType.leftElbow, 0.68, 0.40),
      _lm(PoseLandmarkType.rightElbow, 0.32, 0.40),
      _lm(PoseLandmarkType.leftWrist, 0.70, 0.55),
      _lm(PoseLandmarkType.rightWrist, 0.30, 0.55),
      _lm(PoseLandmarkType.leftHip, 0.58, 0.55),
      _lm(PoseLandmarkType.rightHip, 0.42, 0.55),
      _lm(PoseLandmarkType.leftKnee, 0.58, 0.75),
      _lm(PoseLandmarkType.rightKnee, 0.42, 0.75),
      _lm(PoseLandmarkType.leftAnkle, 0.58, 0.95),
      _lm(PoseLandmarkType.rightAnkle, 0.42, 0.95),
    ];

/// La misma pose, pero SIN rodillas/tobillos (encuadre de medio cuerpo).
List<LandmarkCrudo> _poseMedioCuerpo() =>
    _poseCompleta().where((l) => ![
          PoseLandmarkType.leftKnee.index,
          PoseLandmarkType.rightKnee.index,
          PoseLandmarkType.leftAnkle.index,
          PoseLandmarkType.rightAnkle.index,
        ].contains(l.index)).toList();

void main() {
  final service = PoseAnalysisService.instance;

  group('calcularMetricas - cuerpo completo', () {
    final metricas = service.calcularMetricas(_poseCompleta());

    test('calcula todas las proporciones superiores', () {
      expect(metricas.anchoHombrosRelativo, isNotNull);
      expect(metricas.anchoCaderaRelativo, isNotNull);
      expect(metricas.relacionHombrosCadera, isNotNull);
      expect(metricas.torsoRelativo, isNotNull);
      expect(metricas.brazoRelativo, isNotNull);
    });

    test('calcula las métricas de piernas (sección 26 del pedido)', () {
      expect(metricas.piernaRelativa, isNotNull);
      expect(metricas.simetriaPiernas, isNotNull);
      expect(metricas.anguloRodillas, isNotNull);
    });

    test('relación hombros/cadera > 1 cuando los hombros son más anchos', () {
      expect(metricas.relacionHombrosCadera! > 1, isTrue);
    });

    test('nunca convierte un dato inexistente en 0 (sección 29)', () {
      // No hay forma de que "value == 0" sea válido por error: los
      // ángulos/relaciones calculados con esta pose son todos > 0.
      expect(metricas.anguloRodillas, isNot(0));
      expect(metricas.piernaRelativa, isNot(0));
    });
  });

  group('calcularMetricas - medio cuerpo (sección 25 del pedido)', () {
    final metricas = service.calcularMetricas(_poseMedioCuerpo());

    test('sigue calculando las proporciones de tren superior', () {
      expect(metricas.relacionHombrosCadera, isNotNull);
      expect(metricas.torsoRelativo, isNotNull, reason: 'torso/hombros no depende de la altura corporal');
      expect(metricas.brazoRelativo, isNotNull, reason: 'brazo/hombros no depende de la altura corporal');
      expect(metricas.anchoHombrosRelativo, isNotNull, reason: 'debe usar el torso como referencia alternativa');
    });

    test('las métricas de piernas quedan null, no 0 ni un valor inventado', () {
      expect(metricas.piernaRelativa, isNull);
      expect(metricas.simetriaPiernas, isNull);
      expect(metricas.anguloRodillas, isNull);
    });

    test('simetría/inclinación de hombros y cadera siguen disponibles', () {
      expect(metricas.simetriaHombros, isNotNull);
      expect(metricas.simetriaCadera, isNotNull);
      expect(metricas.inclinacionHombros, isNotNull);
      expect(metricas.inclinacionCadera, isNotNull);
    });

    test('guarda la versión del algoritmo', () {
      expect(metricas.algoritmoVersion, poseAlgorithmVersion);
    });
  });

  group('calcularMetricas - casos extremos (null-safety)', () {
    test('lista vacía no crashea y devuelve todo null', () {
      final metricas = service.calcularMetricas([]);
      expect(metricas.relacionHombrosCadera, isNull);
      expect(metricas.anchoHombrosRelativo, isNull);
      expect(metricas.piernaRelativa, isNull);
      expect(metricas.confianzaMedia, isNull);
    });

    test('solo un hombro visible no crashea (sin pareja no hay ancho)', () {
      final metricas = service.calcularMetricas([
        _lm(PoseLandmarkType.leftShoulder, 0.5, 0.3),
      ]);
      expect(metricas.anchoHombrosRelativo, isNull);
      expect(metricas.relacionHombrosCadera, isNull);
    });

    test('hombros en el mismo punto (ancho 0) no produce una proporción falsa', () {
      final metricas = service.calcularMetricas([
        _lm(PoseLandmarkType.leftShoulder, 0.5, 0.3),
        _lm(PoseLandmarkType.rightShoulder, 0.5, 0.3),
        _lm(PoseLandmarkType.leftHip, 0.5, 0.6),
        _lm(PoseLandmarkType.rightHip, 0.5, 0.6),
      ]);
      // anchoHombros = 0 -> _normalizar(valor, 0) debe ser null, no
      // infinito ni una excepción de división por cero.
      expect(metricas.torsoRelativo, isNull);
      expect(metricas.brazoRelativo, isNull);
    });
  });

  group('calcularEscalas', () {
    test('alturaCorporal solo existe con nariz + ambos tobillos', () {
      final completa = service.calcularEscalas(_poseCompleta());
      final medioCuerpo = service.calcularEscalas(_poseMedioCuerpo());
      expect(completa.alturaCorporal, isNotNull);
      expect(medioCuerpo.alturaCorporal, isNull);
    });

    test('ancho de hombros y cadera no dependen de las piernas', () {
      final medioCuerpo = service.calcularEscalas(_poseMedioCuerpo());
      expect(medioCuerpo.anchoHombros, isNotNull);
      expect(medioCuerpo.anchoCadera, isNotNull);
    });
  });
}
