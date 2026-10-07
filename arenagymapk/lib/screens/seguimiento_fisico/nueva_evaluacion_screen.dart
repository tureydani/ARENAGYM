import 'dart:async';

import 'package:flutter/material.dart';

import '../../services/api_exception.dart';
import '../../services/api_service.dart';
import '../../services/evaluacion_fisica_notification_service.dart';
import '../../services/pose_analysis_service.dart';
import '../../theme/app_theme.dart';
import 'captura_foto_card.dart';
import 'comparador_screen.dart';

/// Flujo "Nueva evaluación física": datos básicos -> fotografías guiadas ->
/// guardado (crea el Progreso, sube las fotos ya analizadas localmente y
/// guarda las métricas calculadas a partir de la foto frontal).
class NuevaEvaluacionScreen extends StatefulWidget {
  const NuevaEvaluacionScreen({super.key});

  @override
  State<NuevaEvaluacionScreen> createState() => _NuevaEvaluacionScreenState();
}

class _NuevaEvaluacionScreenState extends State<NuevaEvaluacionScreen> {
  int _paso = 0;

  // Paso 1: datos básicos
  final _formKey = GlobalKey<FormState>();
  final _pesoCtrl = TextEditingController();
  final _alturaCtrl = TextEditingController();
  final _objetivoCtrl = TextEditingController();
  final _observacionesCtrl = TextEditingController();

  // Medidas manuales opcionales
  bool _mostrarMedidasManuales = false;
  final _cinturaCtrl = TextEditingController();
  final _pechoCtrl = TextEditingController();
  final _brazoCtrl = TextEditingController();
  final _piernaCtrl = TextEditingController();
  final _caderaCtrl = TextEditingController();
  final _grasaCtrl = TextEditingController();

  // Paso 2: fotos
  final Map<String, FotoCapturada?> _fotos = {
    'frente': null,
    'lateral': null,
    'espalda': null,
    'lateral_derecha': null,
  };

  bool _guardando = false;
  String? _estadoGuardado;
  String? _errorGuardado;

  @override
  void dispose() {
    _pesoCtrl.dispose();
    _alturaCtrl.dispose();
    _objetivoCtrl.dispose();
    _observacionesCtrl.dispose();
    _cinturaCtrl.dispose();
    _pechoCtrl.dispose();
    _brazoCtrl.dispose();
    _piernaCtrl.dispose();
    _caderaCtrl.dispose();
    _grasaCtrl.dispose();
    PoseAnalysisService.instance.dispose();
    super.dispose();
  }

  bool get _fotosRequeridasListas => _fotos['frente'] != null && _fotos['lateral'] != null && _fotos['espalda'] != null;

  double? _num(TextEditingController c) => c.text.trim().isEmpty ? null : double.tryParse(c.text.trim());

  Future<void> _guardarEvaluacion() async {
    setState(() {
      _guardando = true;
      _errorGuardado = null;
      _estadoGuardado = 'Guardando datos de la evaluación...';
    });

    try {
      final progreso = await ApiService.instance.crearProgreso(
        peso: _num(_pesoCtrl),
        altura: _num(_alturaCtrl),
        objetivo: _objetivoCtrl.text.trim().isEmpty ? null : _objetivoCtrl.text.trim(),
        observaciones: _observacionesCtrl.text.trim().isEmpty ? null : _observacionesCtrl.text.trim(),
        cintura: _num(_cinturaCtrl),
        pecho: _num(_pechoCtrl),
        brazo: _num(_brazoCtrl),
        pierna: _num(_piernaCtrl),
        cadera: _num(_caderaCtrl),
        porcentajeGrasa: _num(_grasaCtrl),
      );

      for (final entry in _fotos.entries) {
        final foto = entry.value;
        if (foto == null) continue;
        setState(() => _estadoGuardado = 'Subiendo fotografía ${tiposFotoLabel[entry.key]}...');
        await ApiService.instance.subirFotoEvaluacion(
          idProgreso: progreso.idProgreso,
          tipo: entry.key,
          bytesImagen: foto.bytes,
          mimeType: 'image/jpeg',
          anchoPx: foto.anchoPx,
          altoPx: foto.altoPx,
          calidad: foto.analisis.calidad == CalidadFoto.aceptable ? 'ACEPTABLE' : 'INSUFICIENTE',
          confianza: foto.analisis.confianzaMedia,
          landmarks: foto.analisis.landmarks.map((l) => l.toJson()).toList(),
          encuadre: foto.analisis.encuadre == TipoEncuadre.completo ? 'completo' : 'medioCuerpo',
          calidadCaptura: calidadCapturaLabel(foto.analisis.calidadCaptura).toUpperCase(),
          qualityScore: foto.analisis.qualityScore,
        );
      }

      final fotoFrontal = _fotos['frente'];
      if (fotoFrontal != null) {
        setState(() => _estadoGuardado = 'Calculando características...');
        final metricas = PoseAnalysisService.instance.calcularMetricas(fotoFrontal.analisis.landmarks);
        await ApiService.instance.guardarMetricasEvaluacion(progreso.idProgreso, metricas);
      }

      // No debe impedir ni demorar visiblemente el guardado si falla (ver
      // comentario en EvaluacionFisicaNotificationService): es un
      // recordatorio, no parte del flujo crítico de la evaluación.
      unawaited(EvaluacionFisicaNotificationService.instance.programarRecordatorio(
        idProgreso: progreso.idProgreso,
        fechaEvaluacion: DateTime.now(),
      ));

      if (!mounted) return;
      setState(() => _estadoGuardado = 'Evaluación guardada.');
      await Future.delayed(const Duration(milliseconds: 400));
      if (!mounted) return;

      // Llevar directo al resultado: una evaluación debe ser útil por sí
      // misma apenas se guarda, sin esperar a que exista una segunda (ver
      // ComparadorScreen, que ya no depende de tener una referencia para
      // mostrar las métricas de ESTA evaluación). Se empuja encima de esta
      // pantalla (en vez de reemplazarla) para que, al volver con "atrás",
      // el pop restante cierre también este formulario y quede en el
      // historial -- no en un formulario ya guardado.
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => ComparadorScreen(idProgresoActual: progreso.idProgreso)),
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _guardando = false;
        _errorGuardado = e.message;
        _estadoGuardado = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _guardando = false;
        _errorGuardado = 'Ocurrió un error inesperado: $e';
        _estadoGuardado = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nueva evaluación física')),
      body: _guardando ? _buildGuardando() : _paso == 0 ? _buildPasoDatos() : _buildPasoFotos(),
    );
  }

  Widget _buildGuardando() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_errorGuardado == null) const CircularProgressIndicator(),
            const SizedBox(height: 20),
            Text(
              _errorGuardado ?? _estadoGuardado ?? '',
              textAlign: TextAlign.center,
              style: TextStyle(color: _errorGuardado != null ? AppColors.danger : AppColors.textSecondary),
            ),
            if (_errorGuardado != null) ...[
              const SizedBox(height: 16),
              ElevatedButton(onPressed: _guardarEvaluacion, child: const Text('Reintentar')),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildPasoDatos() {
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          Text('Datos básicos', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.textPrimary)),
          const SizedBox(height: 4),
          Text(
            'Estos valores se registran como medidas manuales reales, nunca se calculan desde las fotos.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _pesoCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Peso (kg)'),
                  validator: _validarPositivoOpcional,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextFormField(
                  controller: _alturaCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Altura (cm)'),
                  validator: _validarPositivoOpcional,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _objetivoCtrl,
            decoration: const InputDecoration(labelText: 'Objetivo (ej. Bajar de peso)'),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _observacionesCtrl,
            decoration: const InputDecoration(labelText: 'Observaciones (opcional)'),
            maxLines: 2,
          ),
          const SizedBox(height: 16),
          InkWell(
            onTap: () => setState(() => _mostrarMedidasManuales = !_mostrarMedidasManuales),
            child: Row(
              children: [
                Icon(_mostrarMedidasManuales ? Icons.expand_less : Icons.expand_more, color: AppColors.accent),
                const SizedBox(width: 6),
                Text(
                  'Medidas registradas manualmente (opcional)',
                  style: TextStyle(color: AppColors.accent, fontWeight: FontWeight.w700, fontSize: 13),
                ),
              ],
            ),
          ),
          if (_mostrarMedidasManuales) ...[
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: TextFormField(controller: _cinturaCtrl, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Cintura (cm)'), validator: _validarPositivoOpcional)),
              const SizedBox(width: 12),
              Expanded(child: TextFormField(controller: _pechoCtrl, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Pecho (cm)'), validator: _validarPositivoOpcional)),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextFormField(controller: _brazoCtrl, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Brazo (cm)'), validator: _validarPositivoOpcional)),
              const SizedBox(width: 12),
              Expanded(child: TextFormField(controller: _piernaCtrl, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Pierna (cm)'), validator: _validarPositivoOpcional)),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextFormField(controller: _caderaCtrl, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Cadera (cm)'), validator: _validarPositivoOpcional)),
              const SizedBox(width: 12),
              Expanded(child: TextFormField(controller: _grasaCtrl, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: '% Grasa'), validator: _validarPositivoOpcional)),
            ]),
          ],
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () {
              if (_formKey.currentState!.validate()) setState(() => _paso = 1);
            },
            child: const Text('Continuar a fotografías'),
          ),
        ],
      ),
    );
  }

  String? _validarPositivoOpcional(String? v) {
    if (v == null || v.trim().isEmpty) return null;
    final n = double.tryParse(v.trim());
    if (n == null) return 'Valor inválido';
    if (n <= 0) return 'Debe ser positivo';
    return null;
  }

  Widget _buildPasoFotos() {
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            children: [
              Text('Fotografías corporales', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.textPrimary)),
              const SizedBox(height: 4),
              Text(
                'Mantén una postura erguida, cuerpo completo visible, buena iluminación y la cámara a tu altura. '
                'Usa una distancia similar en cada evaluación para que las comparaciones futuras sean consistentes.',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
              ),
              const SizedBox(height: 16),
              CapturaFotoCard(
                tipo: 'frente',
                titulo: 'Fotografía frontal',
                guia: 'De frente, brazos ligeramente separados del cuerpo, pies visibles.',
                onCambio: (f) => setState(() => _fotos['frente'] = f),
              ),
              const SizedBox(height: 12),
              CapturaFotoCard(
                tipo: 'lateral',
                titulo: 'Fotografía lateral',
                guia: 'De perfil (lado izquierdo), cuerpo completo visible.',
                onCambio: (f) => setState(() => _fotos['lateral'] = f),
              ),
              const SizedBox(height: 12),
              CapturaFotoCard(
                tipo: 'espalda',
                titulo: 'Fotografía posterior',
                guia: 'De espaldas a la cámara, cuerpo completo visible.',
                onCambio: (f) => setState(() => _fotos['espalda'] = f),
              ),
              const SizedBox(height: 12),
              CapturaFotoCard(
                tipo: 'lateral_derecha',
                titulo: 'Fotografía lateral derecha',
                guia: 'De perfil (lado derecho). Opcional, útil para comparar ambos lados.',
                opcional: true,
                onCambio: (f) => setState(() => _fotos['lateral_derecha'] = f),
              ),
            ],
          ),
        ),
        SafeArea(
          minimum: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => setState(() => _paso = 0),
                  child: const Text('Atrás'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: ElevatedButton(
                  onPressed: _fotosRequeridasListas ? _guardarEvaluacion : null,
                  child: const Text('Guardar evaluación'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

const tiposFotoLabel = <String, String>{
  'frente': 'frontal',
  'lateral': 'lateral',
  'espalda': 'posterior',
  'lateral_derecha': 'lateral derecha',
};
