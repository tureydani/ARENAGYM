import 'package:flutter_test/flutter_test.dart';
import 'package:arenagymapk/models/estado_seguimiento_fisico.dart';
import 'package:arenagymapk/services/evaluacion_fisica_schedule_service.dart';

void main() {
  final service = EvaluacionFisicaScheduleService.instance;

  group('calcularEstado', () {
    test('primera evaluación: ultimaEvaluacion null -> primeraEvaluacion', () {
      final estado = service.calcularEstado(ultimaEvaluacion: null);
      expect(estado.estado, EstadoEvaluacion.primeraEvaluacion);
      expect(estado.ultimaEvaluacion, isNull);
      expect(estado.proximaEvaluacion, isNull);
      expect(estado.diasDesdeUltima, isNull);
    });

    test('5 días -> muyReciente', () {
      final ahora = DateTime(2026, 10, 20);
      final estado = service.calcularEstado(ultimaEvaluacion: DateTime(2026, 10, 15), ahora: ahora);
      expect(estado.estado, EstadoEvaluacion.muyReciente);
      expect(estado.diasDesdeUltima, 5);
    });

    test('14 días (límite exacto) -> disponible', () {
      final ahora = DateTime(2026, 10, 20);
      final estado = service.calcularEstado(ultimaEvaluacion: DateTime(2026, 10, 6), ahora: ahora);
      expect(estado.estado, EstadoEvaluacion.disponible);
      expect(estado.diasDesdeUltima, 14);
    });

    test('20 días -> disponible', () {
      final ahora = DateTime(2026, 10, 20);
      final estado = service.calcularEstado(ultimaEvaluacion: DateTime(2026, 9, 30), ahora: ahora);
      expect(estado.estado, EstadoEvaluacion.disponible);
      expect(estado.diasDesdeUltima, 20);
    });

    test('30 días (límite exacto) -> recomendada', () {
      final ahora = DateTime(2026, 11, 5);
      final estado = service.calcularEstado(ultimaEvaluacion: DateTime(2026, 10, 6), ahora: ahora);
      expect(estado.estado, EstadoEvaluacion.recomendada);
      expect(estado.diasDesdeUltima, 30);
    });

    test('45 días -> recomendada', () {
      final ahora = DateTime(2026, 11, 20);
      final estado = service.calcularEstado(ultimaEvaluacion: DateTime(2026, 10, 6), ahora: ahora);
      expect(estado.estado, EstadoEvaluacion.recomendada);
      expect(estado.diasDesdeUltima, 45);
    });

    test('13 días (justo antes del límite) sigue siendo muyReciente', () {
      final ahora = DateTime(2026, 10, 19);
      final estado = service.calcularEstado(ultimaEvaluacion: DateTime(2026, 10, 6), ahora: ahora);
      expect(estado.estado, EstadoEvaluacion.muyReciente);
      expect(estado.diasDesdeUltima, 13);
    });

    test('29 días (justo antes del límite) sigue siendo disponible', () {
      final ahora = DateTime(2026, 11, 4);
      final estado = service.calcularEstado(ultimaEvaluacion: DateTime(2026, 10, 6), ahora: ahora);
      expect(estado.estado, EstadoEvaluacion.disponible);
      expect(estado.diasDesdeUltima, 29);
    });

    test('siempre se calcula respecto de la evaluación más reciente (sección 20)', () {
      // 01/10, 05/10, 10/10 -> debe usarse 10/10, no 01/10.
      final ahora = DateTime(2026, 10, 15);
      final estado = service.calcularEstado(ultimaEvaluacion: DateTime(2026, 10, 10), ahora: ahora);
      expect(estado.diasDesdeUltima, 5);
      expect(estado.proximaEvaluacion, DateTime(2026, 11, 9));
    });
  });

  group('calcularProximaFecha', () {
    test('06/10 + 30 días = 05/11', () {
      final proxima = service.calcularProximaFecha(DateTime(2026, 10, 6));
      expect(proxima, DateTime(2026, 11, 5));
    });

    test('mes de 31 días (enero -> febrero)', () {
      final proxima = service.calcularProximaFecha(DateTime(2026, 1, 15));
      expect(proxima, DateTime(2026, 2, 14));
    });

    test('mes de 30 días (abril -> mayo)', () {
      final proxima = service.calcularProximaFecha(DateTime(2026, 4, 10));
      expect(proxima, DateTime(2026, 5, 10));
    });

    test('febrero no bisiesto (2026)', () {
      final proxima = service.calcularProximaFecha(DateTime(2026, 2, 1));
      expect(proxima, DateTime(2026, 3, 3));
    });

    test('cambio de año (diciembre -> enero)', () {
      final proxima = service.calcularProximaFecha(DateTime(2026, 12, 15));
      expect(proxima, DateTime(2027, 1, 14));
    });
  });

  group('mensajePrincipal', () {
    test('primera evaluación', () {
      final estado = service.calcularEstado(ultimaEvaluacion: null);
      expect(service.mensajePrincipal(estado), contains('primera evaluación'));
    });

    test('muy reciente menciona días transcurridos y restantes', () {
      final ahora = DateTime(2026, 10, 20);
      final estado = service.calcularEstado(ultimaEvaluacion: DateTime(2026, 10, 15), ahora: ahora);
      final mensaje = service.mensajePrincipal(estado);
      expect(mensaje, contains('5 días'));
      expect(mensaje, contains('25 días'));
    });

    test('recomendada no incluye lenguaje técnico/médico', () {
      final ahora = DateTime(2026, 11, 20);
      final estado = service.calcularEstado(ultimaEvaluacion: DateTime(2026, 10, 6), ahora: ahora);
      expect(service.mensajePrincipal(estado), '¡Es un buen momento para evaluar tu progreso!');
    });
  });
}
