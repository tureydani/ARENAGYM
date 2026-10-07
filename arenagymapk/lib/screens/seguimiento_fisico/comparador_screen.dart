import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../models/evaluacion_foto.dart';
import '../../models/progreso.dart';
import '../../services/api_exception.dart';
import '../../services/api_service.dart';
import '../../services/physical_progress_analysis_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_card.dart';

const _etiquetasCambios = <String, (String, String)>{
  'peso': ('Peso', 'kg'),
  'porcentaje_grasa': ('% Grasa (estimado)', '%'),
  'cintura': ('Cintura', 'cm'),
  'pecho': ('Pecho', 'cm'),
  'brazo': ('Brazo', 'cm'),
  'pierna': ('Pierna', 'cm'),
  'cadera': ('Cadera', 'cm'),
};

const _etiquetasMetricas = <String, String>{
  'relacion_hombros_cadera': 'Relación hombros/cadera',
  'ancho_hombros_relativo': 'Ancho de hombros (relativo)',
  'ancho_cadera_relativo': 'Ancho de cadera (relativo)',
  'torso_relativo': 'Torso (relativo)',
  'brazo_relativo': 'Brazo (relativo)',
  'pierna_relativa': 'Pierna (relativa)',
  'simetria_hombros': 'Simetría de hombros',
  'simetria_cadera': 'Simetría de cadera',
  'simetria_brazos': 'Simetría de brazos',
  'simetria_piernas': 'Simetría de piernas',
};

/// Compara la evaluación [idProgresoActual] contra la evaluación inicial o
/// la inmediatamente anterior (seleccionable), mostrando fotos, métricas,
/// cambios y un resumen narrativo generado por
/// [PhysicalProgressAnalysisService] (basado en reglas, sin IA todavía).
class ComparadorScreen extends StatefulWidget {
  final int idProgresoActual;

  const ComparadorScreen({super.key, required this.idProgresoActual});

  @override
  State<ComparadorScreen> createState() => _ComparadorScreenState();
}

class _ComparadorScreenState extends State<ComparadorScreen> {
  bool _loading = true;
  String? _errorMessage;
  String _contra = 'anterior';
  Map<String, dynamic>? _comparacion;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
    });
    try {
      final data = await ApiService.instance.obtenerComparacionEvaluacion(widget.idProgresoActual, contra: _contra);
      if (!mounted) return;
      setState(() {
        _comparacion = data;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.message;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Comparar evolución')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? _buildError()
              : _buildContenido(),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_errorMessage!, textAlign: TextAlign.center, style: TextStyle(color: AppColors.textSecondary)),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _cargar, child: const Text('Reintentar')),
          ],
        ),
      ),
    );
  }

  Widget _buildContenido() {
    final datos = _comparacion!;
    final referencia = datos['referencia'] as Map<String, dynamic>;
    final actual = datos['actual'] as Map<String, dynamic>;
    final cambiosManuales = datos['cambios_medidas_manuales'] as Map<String, dynamic>;
    final cambiosMetricas = datos['cambios_metricas'] as Map<String, dynamic>;
    final cambioIndice = datos['cambio_indice_evolucion'];
    final advertencias = (datos['advertencias'] as List? ?? []).cast<String>();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        if (advertencias.isNotEmpty) ...[
          AppCard(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.warning_amber_outlined, size: 18, color: AppColors.danger),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    advertencias.join(' '),
                    style: TextStyle(color: AppColors.textPrimary, fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
        Row(
          children: [
            Expanded(
              child: ChoiceChip(
                label: const Text('Vs. inicial'),
                selected: _contra == 'inicial',
                onSelected: (_) {
                  setState(() => _contra = 'inicial');
                  _cargar();
                },
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: ChoiceChip(
                label: const Text('Vs. anterior'),
                selected: _contra == 'anterior',
                onSelected: (_) {
                  setState(() => _contra = 'anterior');
                  _cargar();
                },
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        _buildFotosLadoALado(referencia, actual),
        const SizedBox(height: 16),
        if (cambioIndice != null) _buildIndiceCard(referencia, actual, cambioIndice),
        const SizedBox(height: 12),
        if (cambiosManuales.isNotEmpty) _buildCambiosCard('Medidas manuales', cambiosManuales, _etiquetasCambios.map((k, v) => MapEntry(k, v.$1))),
        const SizedBox(height: 12),
        if (cambiosMetricas.isNotEmpty) _buildCambiosCard('Proporciones y postura (estimaciones)', cambiosMetricas, _etiquetasMetricas, esEstimacion: true),
        const SizedBox(height: 12),
        _buildResumenNarrativo(referencia, actual, cambiosManuales, cambiosMetricas),
      ],
    );
  }

  Widget _buildFotosLadoALado(Map<String, dynamic> referencia, Map<String, dynamic> actual) {
    final fotosRef = (referencia['fotos'] as List? ?? []).map((f) => EvaluacionFoto.fromJson(f)).toList();
    final fotosActual = (actual['fotos'] as List? ?? []).map((f) => EvaluacionFoto.fromJson(f)).toList();
    final fotoRefFrente = fotosRef.where((f) => f.tipo == 'frente').toList();
    final fotoActualFrente = fotosActual.where((f) => f.tipo == 'frente').toList();

    if (fotoRefFrente.isEmpty && fotoActualFrente.isEmpty) return const SizedBox.shrink();

    String? subtitulo(dynamic encuadre) =>
        encuadre == 'medioCuerpo' ? 'Medio cuerpo' : encuadre == 'completo' ? 'Cuerpo completo' : null;

    return Row(
      children: [
        Expanded(
          child: _FotoComparacion(
            titulo: referencia['fecha']?.toString() ?? '',
            subtitulo: subtitulo(referencia['encuadre']),
            idProgreso: referencia['id_progreso'] as int,
            foto: fotoRefFrente.isNotEmpty ? fotoRefFrente.first : null,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _FotoComparacion(
            titulo: actual['fecha']?.toString() ?? '',
            subtitulo: subtitulo(actual['encuadre']),
            idProgreso: actual['id_progreso'] as int,
            foto: fotoActualFrente.isNotEmpty ? fotoActualFrente.first : null,
          ),
        ),
      ],
    );
  }

  Widget _buildIndiceCard(Map<String, dynamic> referencia, Map<String, dynamic> actual, dynamic cambioIndice) {
    final cambio = (cambioIndice as num).toDouble();
    final color = cambio > 0.5 ? AppColors.success : cambio < -0.5 ? AppColors.danger : AppColors.textSecondary;
    return AppCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Índice de evolución', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                Text(
                  '${referencia['indice_evolucion'] ?? '-'} → ${actual['indice_evolucion'] ?? '-'}',
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
            child: Text(
              '${cambio >= 0 ? '+' : ''}${cambio.toStringAsFixed(1)}',
              style: TextStyle(color: color, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCambiosCard(String titulo, Map<String, dynamic> cambios, Map<String, String> etiquetas, {bool esEstimacion = false}) {
    final filas = <Widget>[];
    for (final entry in cambios.entries) {
      final etiqueta = etiquetas[entry.key];
      if (etiqueta == null) continue;
      final valores = entry.value as Map<String, dynamic>;
      final anterior = (valores['anterior'] as num).toDouble();
      final actualV = (valores['actual'] as num).toDouble();
      final cambioRel = valores['cambio_relativo_porcentual'];
      final unidad = _etiquetasCambios[entry.key]?.$2 ?? '';

      filas.add(Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(
          children: [
            Expanded(child: Text(etiqueta, style: TextStyle(color: AppColors.textSecondary, fontSize: 12))),
            Text('${anterior.toStringAsFixed(2)}$unidad', style: const TextStyle(fontSize: 12)),
            const SizedBox(width: 6),
            Icon(Icons.arrow_forward, size: 12, color: AppColors.textSecondary),
            const SizedBox(width: 6),
            Text('${actualV.toStringAsFixed(2)}$unidad', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
            if (cambioRel != null) ...[
              const SizedBox(width: 8),
              Text(
                '(${(cambioRel as num) >= 0 ? '+' : ''}${cambioRel.toStringAsFixed(1)}%)',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
              ),
            ],
          ],
        ),
      ));
    }

    if (filas.isEmpty) return const SizedBox.shrink();

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(titulo, style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
          if (esEstimacion)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                'Cambio en la proporción corporal observado; no es una medición de masa muscular o grasa.',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 10, fontStyle: FontStyle.italic),
              ),
            ),
          const SizedBox(height: 8),
          ...filas,
        ],
      ),
    );
  }

  Widget _buildResumenNarrativo(
    Map<String, dynamic> referencia,
    Map<String, dynamic> actual,
    Map<String, dynamic> cambiosManuales,
    Map<String, dynamic> cambiosMetricas,
  ) {
    final anterior = Progreso(
      idProgreso: referencia['id_progreso'] as int,
      idUsuario: 0,
      fecha: referencia['fecha']?.toString() ?? '',
      peso: null, porcentajeGrasa: null, pecho: null, cintura: null, brazo: null, pierna: null, cadera: null, observaciones: null,
      indiceEvolucion: double.tryParse(referencia['indice_evolucion']?.toString() ?? ''),
    );
    final actualModel = Progreso(
      idProgreso: actual['id_progreso'] as int,
      idUsuario: 0,
      fecha: actual['fecha']?.toString() ?? '',
      peso: null, porcentajeGrasa: null, pecho: null, cintura: null, brazo: null, pierna: null, cadera: null, observaciones: null,
      indiceEvolucion: double.tryParse(actual['indice_evolucion']?.toString() ?? ''),
    );

    final resumen = PhysicalProgressAnalysisService.instance.generarResumen(
      anterior: anterior,
      actual: actualModel,
      cambiosMedidasManuales: cambiosManuales,
      cambiosMetricas: cambiosMetricas,
    );

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.auto_awesome_outlined, size: 18, color: AppColors.accent),
            const SizedBox(width: 8),
            Text('Resumen', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
          ]),
          const SizedBox(height: 8),
          Text(resumen, style: TextStyle(color: AppColors.textPrimary, fontSize: 13, height: 1.4)),
        ],
      ),
    );
  }
}

class _FotoComparacion extends StatelessWidget {
  final String titulo;
  final String? subtitulo;
  final int idProgreso;
  final EvaluacionFoto? foto;

  const _FotoComparacion({required this.titulo, this.subtitulo, required this.idProgreso, required this.foto});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(titulo, style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
        if (subtitulo != null)
          Text(subtitulo!, style: TextStyle(color: AppColors.textSecondary, fontSize: 10, fontStyle: FontStyle.italic)),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: AspectRatio(
            aspectRatio: 3 / 4,
            child: foto == null
                ? Container(
                    color: AppColors.card,
                    alignment: Alignment.center,
                    child: Icon(Icons.image_not_supported_outlined, color: AppColors.textSecondary),
                  )
                : FutureBuilder<Uint8List>(
                    future: ApiService.instance.obtenerBytesFoto(idProgreso, foto!.idFoto),
                    builder: (context, snapshot) {
                      if (snapshot.connectionState != ConnectionState.done) {
                        return Container(color: AppColors.card, child: const Center(child: CircularProgressIndicator(strokeWidth: 2)));
                      }
                      if (!snapshot.hasData || snapshot.data!.isEmpty) {
                        return Container(color: AppColors.card, child: Icon(Icons.broken_image_outlined, color: AppColors.textSecondary));
                      }
                      return Image.memory(
                        snapshot.data!,
                        fit: BoxFit.cover,
                        width: double.infinity,
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }
}
