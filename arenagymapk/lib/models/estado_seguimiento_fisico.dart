/// Estado lógico de la recomendación de frecuencia de evaluación física.
/// Puramente informativo -- en ningún caso bloquea al usuario de crear una
/// evaluación (ver [EstadoSeguimientoFisico] y NuevaEvaluacionScreen).
enum EstadoEvaluacion {
  /// Todavía no existe ninguna evaluación guardada.
  primeraEvaluacion,

  /// Han pasado menos de [EvaluacionFisicaConfig.diasMinimos] días.
  muyReciente,

  /// Entre [EvaluacionFisicaConfig.diasMinimos] y
  /// [EvaluacionFisicaConfig.diasRecomendados] días: se puede evaluar, pero
  /// todavía no es el momento "ideal".
  disponible,

  /// [EvaluacionFisicaConfig.diasRecomendados] días o más: buen momento.
  recomendada,
}

/// Resultado de [EvaluacionFisicaScheduleService.calcularEstado]: todo lo
/// que la UI necesita para mostrar la tarjeta de recomendación, sin tener
/// que repetir ningún cálculo de fechas.
class EstadoSeguimientoFisico {
  final DateTime? ultimaEvaluacion;
  final DateTime? proximaEvaluacion;
  final int? diasDesdeUltima;
  final int? diasRestantes; // null si ya se alcanzó/superó la fecha recomendada
  final EstadoEvaluacion estado;

  const EstadoSeguimientoFisico({
    required this.ultimaEvaluacion,
    required this.proximaEvaluacion,
    required this.diasDesdeUltima,
    required this.diasRestantes,
    required this.estado,
  });
}
