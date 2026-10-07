import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../models/evaluacion_foto.dart';
import '../../models/metricas_fisicas.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_card.dart';

/// true si [metricas] tiene al menos un dato de postura/simetría disponible.
/// Pura (sin widgets) para poder probarla directamente -- la UI solo decide
/// si mostrar la tarjeta completa en base a esto, nunca inventa un valor.
bool tienePosturaDisponible(MetricasFisicas? metricas) {
  if (metricas == null) return false;
  return metricas.inclinacionHombros != null ||
      metricas.inclinacionCadera != null ||
      metricas.simetriaHombros != null ||
      metricas.simetriaCadera != null ||
      metricas.simetriaBrazos != null ||
      metricas.simetriaPiernas != null ||
      metricas.alineacionPostural != null;
}

/// true si [metricas] tiene al menos una proporción corporal disponible.
bool tieneProporcionesDisponibles(MetricasFisicas? metricas) {
  if (metricas == null) return false;
  return metricas.anchoHombrosRelativo != null ||
      metricas.anchoCaderaRelativo != null ||
      metricas.relacionHombrosCadera != null ||
      metricas.torsoRelativo != null ||
      metricas.brazoRelativo != null ||
      metricas.piernaRelativa != null;
}

/// true si [metricas] tiene al menos un ángulo articular disponible.
bool tieneAngulosDisponibles(MetricasFisicas? metricas) {
  if (metricas == null) return false;
  return metricas.anguloCodos != null || metricas.anguloRodillas != null;
}

/// Etiqueta legible de la categoría de calidad de captura almacenada en
/// fotos_progreso.calidad_captura ('EXCELENTE'|'BUENA'|'ACEPTABLE'|
/// 'INSUFICIENTE'). Si llega algo que no reconoce, se devuelve tal cual en
/// vez de ocultarlo -- mejor mostrar el dato crudo que inventar uno.
String etiquetaCalidadCaptura(String valor) {
  switch (valor) {
    case 'EXCELENTE':
      return 'Excelente';
    case 'BUENA':
      return 'Buena';
    case 'ACEPTABLE':
      return 'Aceptable';
    case 'INSUFICIENTE':
      return 'Insuficiente';
    default:
      return valor;
  }
}

/// Muestra las métricas de UNA evaluación por sí misma -- sección "Tus
/// métricas actuales" del módulo de Seguimiento físico. Es independiente de
/// que exista o no una evaluación de referencia para comparar (eso lo
/// maneja el llamador, ver ComparadorScreen): esta vista nunca necesita una
/// segunda evaluación para tener algo útil que mostrar.
///
/// Todas las secciones son opcionales -- si [metricas] no trae ningún dato
/// de una sección, esa tarjeta completa se omite (nunca se muestra "null",
/// "N/A" ni un 0 inventado).
class MetricasIndividualesView extends StatelessWidget {
  final String fecha;
  final MetricasFisicas? metricas;
  final List<EvaluacionFoto> fotos;

  /// true cuando esta evaluación se presenta como "punto de partida" (sin
  /// evaluación anterior para comparar): agrega la tarjeta de línea base y
  /// el mensaje motivacional. Lo decide el llamador según si pudo armar una
  /// comparación, no esta vista.
  final bool esLineaBase;
  final DateTime? proximaEvaluacionRecomendada;

  const MetricasIndividualesView({
    super.key,
    required this.fecha,
    required this.metricas,
    required this.fotos,
    required this.esLineaBase,
    this.proximaEvaluacionRecomendada,
  });

  EvaluacionFoto? get _fotoFrontal {
    final frontales = fotos.where((f) => f.tipo == 'frente');
    return frontales.isEmpty ? null : frontales.first;
  }

  @override
  Widget build(BuildContext context) {
    final foto = _fotoFrontal;
    final tieneCalidad = foto?.qualityScore != null || foto?.calidadCaptura != null || foto?.encuadre != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.insights_outlined, size: 18, color: AppColors.accent),
            const SizedBox(width: 8),
            Text(
              esLineaBase ? 'Tu evaluación inicial' : 'Tus métricas actuales',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.textPrimary),
            ),
          ],
        ),
        if (esLineaBase) ...[
          const SizedBox(height: 4),
          Text(
            'Estos datos representan tu estado registrado en esta evaluación y servirán como punto de '
            'referencia para futuras comparaciones.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
          ),
        ],
        const SizedBox(height: 12),
        if (tieneCalidad) ...[_calidadCard(foto!), const SizedBox(height: 12)],
        if (tienePosturaDisponible(metricas)) ...[_posturaCard(metricas!), const SizedBox(height: 12)],
        if (tieneProporcionesDisponibles(metricas)) ...[_proporcionesCard(metricas!), const SizedBox(height: 12)],
        if (tieneAngulosDisponibles(metricas)) ...[_angulosCard(metricas!), const SizedBox(height: 12)],
        if (esLineaBase) ...[_lineaBaseCard(), const SizedBox(height: 12), _ctaCard()],
      ],
    );
  }

  Widget _seccion({required IconData icono, required String titulo, String? nota, required List<Widget> filas}) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icono, size: 16, color: AppColors.accent),
              const SizedBox(width: 8),
              Text(titulo, style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
            ],
          ),
          if (nota != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(nota, style: TextStyle(color: AppColors.textSecondary, fontSize: 10, fontStyle: FontStyle.italic)),
            ),
          const SizedBox(height: 10),
          ...filas,
        ],
      ),
    );
  }

  Widget _fila(String etiqueta, String valor) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: Text(etiqueta, style: TextStyle(color: AppColors.textSecondary, fontSize: 13))),
          const SizedBox(width: 8),
          Flexible(
            child: Text(valor, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13), textAlign: TextAlign.right),
          ),
        ],
      ),
    );
  }

  Widget _calidadCard(EvaluacionFoto foto) {
    final filas = <Widget>[];
    if (foto.qualityScore != null && foto.calidadCaptura != null) {
      filas.add(_fila('Calidad de captura', '${foto.qualityScore}/100 · ${etiquetaCalidadCaptura(foto.calidadCaptura!)}'));
    } else if (foto.qualityScore != null) {
      filas.add(_fila('Calidad de captura', '${foto.qualityScore}/100'));
    } else if (foto.calidadCaptura != null) {
      filas.add(_fila('Calidad de captura', etiquetaCalidadCaptura(foto.calidadCaptura!)));
    }
    if (foto.encuadre != null) {
      filas.add(_fila('Encuadre', foto.encuadre == 'medioCuerpo' ? 'Medio cuerpo' : 'Cuerpo completo'));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _seccion(icono: Icons.camera_alt_outlined, titulo: 'Calidad de captura', filas: filas),
        if (foto.encuadre == 'medioCuerpo') ...[
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.info_outline, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Las métricas de piernas no están disponibles en esta evaluación porque el encuadre corresponde a medio cuerpo.',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 11, fontStyle: FontStyle.italic),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _posturaCard(MetricasFisicas m) {
    final filas = <Widget>[];
    if (m.inclinacionHombros != null) filas.add(_fila('Inclinación de hombros', '${m.inclinacionHombros!.toStringAsFixed(1)}°'));
    if (m.inclinacionCadera != null) filas.add(_fila('Inclinación de cadera', '${m.inclinacionCadera!.toStringAsFixed(1)}°'));
    if (m.simetriaHombros != null) filas.add(_fila('Simetría de hombros', '${(m.simetriaHombros! * 100).toStringAsFixed(0)}%'));
    if (m.simetriaCadera != null) filas.add(_fila('Simetría de cadera', '${(m.simetriaCadera! * 100).toStringAsFixed(0)}%'));
    if (m.simetriaBrazos != null) filas.add(_fila('Simetría de brazos', '${(m.simetriaBrazos! * 100).toStringAsFixed(0)}%'));
    if (m.simetriaPiernas != null) filas.add(_fila('Simetría de piernas', '${(m.simetriaPiernas! * 100).toStringAsFixed(0)}%'));
    if (m.alineacionPostural != null) filas.add(_fila('Alineación corporal', '${(m.alineacionPostural! * 100).toStringAsFixed(0)}%'));
    return _seccion(icono: Icons.accessibility_new, titulo: 'Postura y simetría', filas: filas);
  }

  Widget _proporcionesCard(MetricasFisicas m) {
    final filas = <Widget>[];
    if (m.relacionHombrosCadera != null) filas.add(_fila('Relación hombros/cadera', m.relacionHombrosCadera!.toStringAsFixed(2)));
    if (m.anchoHombrosRelativo != null) filas.add(_fila('Ancho de hombros (relativo)', m.anchoHombrosRelativo!.toStringAsFixed(2)));
    if (m.anchoCaderaRelativo != null) filas.add(_fila('Ancho de cadera (relativo)', m.anchoCaderaRelativo!.toStringAsFixed(2)));
    if (m.torsoRelativo != null) filas.add(_fila('Proporción del torso', m.torsoRelativo!.toStringAsFixed(2)));
    if (m.brazoRelativo != null) filas.add(_fila('Proporción del brazo', m.brazoRelativo!.toStringAsFixed(2)));
    if (m.piernaRelativa != null) filas.add(_fila('Proporción de pierna', m.piernaRelativa!.toStringAsFixed(2)));
    return _seccion(
      icono: Icons.straighten_outlined,
      titulo: 'Proporciones',
      nota: 'Índices/proporciones derivados de la pose -- no son medidas en centímetros ni mediciones antropométricas absolutas.',
      filas: filas,
    );
  }

  Widget _angulosCard(MetricasFisicas m) {
    final filas = <Widget>[];
    if (m.anguloCodos != null) filas.add(_fila('Ángulo de codos (promedio)', '${m.anguloCodos!.toStringAsFixed(0)}°'));
    if (m.anguloRodillas != null) filas.add(_fila('Ángulo de rodillas (promedio)', '${m.anguloRodillas!.toStringAsFixed(0)}°'));
    return _seccion(icono: Icons.architecture_outlined, titulo: 'Ángulos', filas: filas);
  }

  Widget _lineaBaseCard() {
    final formato = DateFormat("d 'de' MMMM 'de' y", 'es');
    final fechaDt = DateTime.tryParse(fecha);
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.flag_outlined, size: 16, color: AppColors.accent),
              const SizedBox(width: 8),
              Text('Tu punto de partida', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Esta evaluación será utilizada como referencia para analizar tu evolución en futuras evaluaciones.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
          ),
          const SizedBox(height: 10),
          _fila('Primera evaluación', fechaDt != null ? formato.format(fechaDt) : fecha),
          if (proximaEvaluacionRecomendada != null)
            _fila('Próxima evaluación recomendada', formato.format(proximaEvaluacionRecomendada!)),
        ],
      ),
    );
  }

  Widget _ctaCard() {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('¿Quieres ver tu evolución?', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
          const SizedBox(height: 6),
          Text(
            'Realiza una nueva evaluación cuando llegue la fecha recomendada y podrás comparar tus resultados con este punto de partida.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
