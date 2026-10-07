/// Fuente única de verdad para los umbrales de frecuencia recomendada de
/// evaluaciones físicas. Nunca repetir estos números sueltos en pantallas o
/// servicios -- todo el cálculo pasa por [EvaluacionFisicaScheduleService].
class EvaluacionFisicaConfig {
  /// Por debajo de esta cantidad de días, la evaluación se considera
  /// "muy reciente" (los cambios todavía no son significativos).
  static const int diasMinimos = 14;

  /// A partir de esta cantidad de días desde la última evaluación, se
  /// considera un buen momento para evaluar de nuevo. También es el
  /// desplazamiento usado para calcular la próxima fecha recomendada y la
  /// notificación local.
  static const int diasRecomendados = 30;
}
