import '../config/evaluacion_fisica_config.dart';
import '../models/estado_seguimiento_fisico.dart';

/// Calcula el estado de "frecuencia recomendada" de evaluaciones físicas:
/// cuánto pasó desde la última, cuándo se recomienda la próxima, y en qué
/// estado está eso ([EstadoEvaluacion]). Es pura lógica de fechas, sin
/// dependencias de Flutter/plataforma, para poder probarla directamente
/// (ver test/evaluacion_fisica_schedule_service_test.dart).
///
/// Esta recomendación es SOLO informativa: en ningún punto de la app se usa
/// para impedir crear una evaluación (ver NuevaEvaluacionScreen, que solo
/// muestra una advertencia si el estado es [EstadoEvaluacion.muyReciente] y
/// deja continuar si el usuario lo confirma).
class EvaluacionFisicaScheduleService {
  EvaluacionFisicaScheduleService._();
  static final EvaluacionFisicaScheduleService instance = EvaluacionFisicaScheduleService._();

  /// Fecha (sin hora, en horario local) en la que se recomienda la próxima
  /// evaluación: [EvaluacionFisicaConfig.diasRecomendados] días después de
  /// [ultimaEvaluacion]. Se trabaja en horario LOCAL (nunca UTC) para que la
  /// fecha de calendario mostrada al usuario no se corra un día (sección 15
  /// del pedido).
  DateTime calcularProximaFecha(DateTime ultimaEvaluacion) {
    final soloFecha = DateTime(ultimaEvaluacion.year, ultimaEvaluacion.month, ultimaEvaluacion.day);
    return soloFecha.add(const Duration(days: EvaluacionFisicaConfig.diasRecomendados));
  }

  /// Calcula el estado completo a partir de la fecha de la evaluación más
  /// reciente (o `null` si el usuario nunca evaluó). [ahora] es inyectable
  /// para que las pruebas no dependan de la fecha real del sistema.
  EstadoSeguimientoFisico calcularEstado({required DateTime? ultimaEvaluacion, DateTime? ahora}) {
    final hoy = _soloFecha(ahora ?? DateTime.now());

    if (ultimaEvaluacion == null) {
      return const EstadoSeguimientoFisico(
        ultimaEvaluacion: null,
        proximaEvaluacion: null,
        diasDesdeUltima: null,
        diasRestantes: null,
        estado: EstadoEvaluacion.primeraEvaluacion,
      );
    }

    final ultima = _soloFecha(ultimaEvaluacion);
    final proxima = calcularProximaFecha(ultima);
    final diasDesdeUltima = hoy.difference(ultima).inDays;
    final diasRestantes = proxima.difference(hoy).inDays;

    final EstadoEvaluacion estado;
    if (diasDesdeUltima < EvaluacionFisicaConfig.diasMinimos) {
      estado = EstadoEvaluacion.muyReciente;
    } else if (diasDesdeUltima < EvaluacionFisicaConfig.diasRecomendados) {
      estado = EstadoEvaluacion.disponible;
    } else {
      estado = EstadoEvaluacion.recomendada;
    }

    return EstadoSeguimientoFisico(
      ultimaEvaluacion: ultima,
      proximaEvaluacion: proxima,
      diasDesdeUltima: diasDesdeUltima,
      diasRestantes: diasRestantes > 0 ? diasRestantes : 0,
      estado: estado,
    );
  }

  /// Texto principal de la tarjeta de recomendación (sección 25: lenguaje
  /// simple y natural, nunca clínico/técnico).
  String mensajePrincipal(EstadoSeguimientoFisico estado) {
    switch (estado.estado) {
      case EstadoEvaluacion.primeraEvaluacion:
        return 'Realiza tu primera evaluación física para comenzar a registrar tu progreso.';
      case EstadoEvaluacion.muyReciente:
        final dias = estado.diasDesdeUltima ?? 0;
        final restantes = estado.diasRestantes ?? 0;
        return 'Han pasado $dias día${dias == 1 ? '' : 's'} desde tu última evaluación. '
            'Te recomendamos esperar aproximadamente $restantes día${restantes == 1 ? '' : 's'} más '
            'para obtener una comparación más significativa.';
      case EstadoEvaluacion.disponible:
        return 'Ya puedes realizar una nueva evaluación, aunque para observar cambios más significativos '
            'recomendamos esperar hasta completar aproximadamente ${EvaluacionFisicaConfig.diasRecomendados} días.';
      case EstadoEvaluacion.recomendada:
        return '¡Es un buen momento para evaluar tu progreso!';
    }
  }

  /// Advertencia mostrada SOLO si el usuario decide evaluar antes de tiempo
  /// (sección 16) -- nunca bloquea, solo informa.
  static const String advertenciaEvaluacionTemprana =
      'Tu última evaluación fue hace pocos días. Es posible que los cambios observados sean pequeños '
      'y estén influenciados por factores como postura, iluminación o posición de la cámara.';

  DateTime _soloFecha(DateTime d) => DateTime(d.year, d.month, d.day);
}
