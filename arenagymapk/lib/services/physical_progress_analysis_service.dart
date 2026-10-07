import '../models/progreso.dart';

/// Capa independiente que recibe datos ESTRUCTURADOS de dos evaluaciones
/// (anterior y actual) y devuelve una narrativa en español.
///
/// Fase actual: genera el texto con reglas fijas (sin red, sin IA). Está
/// deliberadamente aislada del resto de la UI para que, en una fase
/// posterior, el método [generarResumen] pueda reemplazarse por una
/// llamada a un modelo generativo (el backend ya usa `@google/generative-ai`
/// para el bot de Telegram, así que lo natural sería exponer un endpoint
/// equivalente en `/api/cliente/progresos/:id/comparacion/resumen-ia` que
/// reciba exactamente esta misma estructura) sin tocar las pantallas que
/// consumen este servicio.
///
/// Reglas que esta capa NUNCA debe violar (sección 18 del pedido):
/// no diagnostica enfermedades, no determina composición corporal con
/// certeza, no afirma ganancia/pérdida de masa muscular solo por fotos, y
/// no da recomendaciones médicas.
class PhysicalProgressAnalysisService {
  PhysicalProgressAnalysisService._();
  static final PhysicalProgressAnalysisService instance = PhysicalProgressAnalysisService._();

  String generarResumen({
    required Progreso anterior,
    required Progreso actual,
    required Map<String, dynamic> cambiosMedidasManuales,
    required Map<String, dynamic> cambiosMetricas,
  }) {
    final frases = <String>[];

    final cambioIndice = (actual.indiceEvolucion != null && anterior.indiceEvolucion != null)
        ? actual.indiceEvolucion! - anterior.indiceEvolucion!
        : null;
    if (cambioIndice != null) {
      if (cambioIndice > 1) {
        frases.add('Se observa una evolución favorable respecto a la evaluación anterior.');
      } else if (cambioIndice < -1) {
        frases.add('El índice de evolución bajó respecto a la evaluación anterior; conviene revisar la constancia de las últimas semanas.');
      } else {
        frases.add('El índice de evolución se mantiene estable respecto a la evaluación anterior.');
      }
    }

    const etiquetas = {
      'peso': ('peso', 'kg'),
      'cintura': ('cintura', 'cm'),
      'pecho': ('pecho', 'cm'),
      'brazo': ('perímetro del brazo', 'cm'),
      'pierna': ('perímetro de la pierna', 'cm'),
      'cadera': ('cadera', 'cm'),
      'porcentaje_grasa': ('porcentaje de grasa estimado', '%'),
    };

    for (final entry in cambiosMedidasManuales.entries) {
      final etiqueta = etiquetas[entry.key];
      if (etiqueta == null) continue;
      final cambio = entry.value as Map;
      final delta = (cambio['cambio_absoluto'] as num?)?.toDouble();
      if (delta == null || delta.abs() < 0.1) continue;

      final (nombre, unidad) = etiqueta;
      final direccion = delta < 0 ? 'una reducción' : 'un incremento';
      frases.add('La ${nombre[0].toUpperCase()}${nombre.substring(1)} presenta $direccion de ${delta.abs().toStringAsFixed(1)} $unidad.');
    }

    final simetriaHombros = (cambiosMetricas['simetria_hombros'] as Map?)?['actual'] as num?;
    if (simetriaHombros != null && simetriaHombros >= 0.9) {
      frases.add('También se observa una buena alineación postural en la fotografía más reciente.');
    }

    if (frases.length <= 1) {
      frases.add('Todavía no hay suficientes mediciones comparables entre ambas evaluaciones para describir la variación en detalle.');
    }

    frases.add(
      'Estas observaciones son estimaciones geométricas/proporcionales e indicadores internos de seguimiento, '
      'no un diagnóstico médico ni una medición exacta de composición corporal.',
    );

    return frases.join(' ');
  }
}
