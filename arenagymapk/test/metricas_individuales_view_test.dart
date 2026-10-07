import 'package:flutter_test/flutter_test.dart';
import 'package:arenagymapk/models/metricas_fisicas.dart';
import 'package:arenagymapk/screens/seguimiento_fisico/metricas_individuales_view.dart';

void main() {
  group('tienePosturaDisponible', () {
    test('null -> false', () {
      expect(tienePosturaDisponible(null), isFalse);
    });

    test('todo null -> false (caso 5 del pedido: no inventar datos)', () {
      expect(tienePosturaDisponible(const MetricasFisicas()), isFalse);
    });

    test('con un solo dato de postura ya alcanza para mostrar la sección', () {
      expect(tienePosturaDisponible(const MetricasFisicas(inclinacionHombros: 2.4)), isTrue);
      expect(tienePosturaDisponible(const MetricasFisicas(simetriaPiernas: 0.9)), isTrue);
    });
  });

  group('tieneProporcionesDisponibles', () {
    test('null -> false', () {
      expect(tieneProporcionesDisponibles(null), isFalse);
    });

    test('medio cuerpo: sin piernas pero con hombros/torso -> true', () {
      // Caso 4 del pedido: primera evaluación de medio cuerpo debe seguir
      // mostrando las proporciones disponibles (sin piernas).
      const metricas = MetricasFisicas(
        relacionHombrosCadera: 1.21,
        torsoRelativo: 0.53,
        brazoRelativo: 0.31,
        piernaRelativa: null,
      );
      expect(tieneProporcionesDisponibles(metricas), isTrue);
    });

    test('ninguna proporción disponible -> false', () {
      expect(tieneProporcionesDisponibles(const MetricasFisicas()), isFalse);
    });
  });

  group('tieneAngulosDisponibles', () {
    test('null -> false', () {
      expect(tieneAngulosDisponibles(null), isFalse);
    });

    test('solo ángulo de codos disponible (medio cuerpo, sin rodillas) -> true', () {
      expect(tieneAngulosDisponibles(const MetricasFisicas(anguloCodos: 172)), isTrue);
    });

    test('sin ángulos disponibles -> false', () {
      expect(tieneAngulosDisponibles(const MetricasFisicas()), isFalse);
    });
  });

  group('etiquetaCalidadCaptura', () {
    test('mapea las cuatro categorías conocidas', () {
      expect(etiquetaCalidadCaptura('EXCELENTE'), 'Excelente');
      expect(etiquetaCalidadCaptura('BUENA'), 'Buena');
      expect(etiquetaCalidadCaptura('ACEPTABLE'), 'Aceptable');
      expect(etiquetaCalidadCaptura('INSUFICIENTE'), 'Insuficiente');
    });

    test('valor desconocido se devuelve tal cual (no se inventa ni se oculta)', () {
      expect(etiquetaCalidadCaptura('OTRA_COSA'), 'OTRA_COSA');
    });
  });
}
