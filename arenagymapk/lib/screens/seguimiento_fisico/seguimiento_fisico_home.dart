import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../models/estado_seguimiento_fisico.dart';
import '../../models/progreso.dart';
import '../../services/api_exception.dart';
import '../../services/api_service.dart';
import '../../services/evaluacion_fisica_notification_service.dart';
import '../../services/evaluacion_fisica_schedule_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_card.dart';
import 'comparador_screen.dart';
import 'nueva_evaluacion_screen.dart';

/// Pantalla "Seguimiento físico": resumen de la última evaluación +
/// historial. Punto de entrada para crear una evaluación nueva o comparar
/// dos evaluaciones existentes.
class SeguimientoFisicoHome extends StatefulWidget {
  const SeguimientoFisicoHome({super.key});

  @override
  State<SeguimientoFisicoHome> createState() => _SeguimientoFisicoHomeState();
}

class _SeguimientoFisicoHomeState extends State<SeguimientoFisicoHome> {
  bool _loading = true;
  String? _errorMessage;
  List<Progreso> _evaluaciones = []; // más reciente primero

  @override
  void initState() {
    super.initState();
    _cargar();
    // Fire-and-forget: no bloquea esta pantalla si el usuario no concede el
    // permiso (sección 13 del pedido). Se pide acá (y no en main.dart) para
    // no interrumpir el arranque de la app con un diálogo de permisos antes
    // de que el usuario vea nada.
    EvaluacionFisicaNotificationService.instance.solicitarPermisos();
  }

  EstadoSeguimientoFisico get _estadoSeguimiento {
    final ultima = _evaluaciones.isEmpty ? null : DateTime.tryParse(_evaluaciones.first.fecha);
    return EvaluacionFisicaScheduleService.instance.calcularEstado(ultimaEvaluacion: ultima);
  }

  Future<void> _cargar() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
    });
    try {
      final progresos = await ApiService.instance.getProgresos();
      progresos.sort((a, b) => b.fecha.compareTo(a.fecha));
      if (!mounted) return;
      setState(() {
        _evaluaciones = progresos;
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

  Future<void> _nuevaEvaluacion() async {
    // Sección 16: la recomendación nunca bloquea, solo advierte. El
    // usuario decide si continúa igual.
    if (_estadoSeguimiento.estado == EstadoEvaluacion.muyReciente) {
      final continuar = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('¿Evaluar de todos modos?'),
          content: const Text(EvaluacionFisicaScheduleService.advertenciaEvaluacionTemprana),
          actions: [
            TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancelar')),
            TextButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Continuar de todos modos')),
          ],
        ),
      );
      if (continuar != true) return;
    }

    if (!mounted) return;
    final guardada = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const NuevaEvaluacionScreen()),
    );
    if (guardada == true) _cargar();
  }

  void _abrirComparador(Progreso evaluacion) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ComparadorScreen(idProgresoActual: evaluacion.idProgreso)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton(
        onPressed: _nuevaEvaluacion,
        backgroundColor: AppColors.accent,
        tooltip: 'Nueva evaluación física',
        child: const Icon(Icons.add_a_photo_outlined, color: Colors.white),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? _buildError()
              : RefreshIndicator(
                  onRefresh: _cargar,
                  child: _evaluaciones.isEmpty ? _buildVacio() : _buildLista(),
                ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.wifi_off, size: 48, color: AppColors.textSecondary),
            const SizedBox(height: 16),
            Text(_errorMessage!, textAlign: TextAlign.center, style: TextStyle(color: AppColors.textSecondary)),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _cargar, child: const Text('Reintentar')),
          ],
        ),
      ),
    );
  }

  Widget _buildVacio() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _RecomendacionCard(estado: _estadoSeguimiento, onEvaluar: _nuevaEvaluacion),
        const SizedBox(height: 16),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Seguimiento físico', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.textPrimary)),
              const SizedBox(height: 8),
              Text(
                'Registra tu primera evaluación física con fotografías para empezar a ver tu evolución. '
                'Toca el botón "+" para comenzar.',
                style: TextStyle(color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildLista() {
    final ultima = _evaluaciones.first;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 96),
      children: [
        const SizedBox(height: 16),
        _RecomendacionCard(estado: _estadoSeguimiento, onEvaluar: _nuevaEvaluacion),
        const SizedBox(height: 16),
        _ResumenCard(ultima: ultima, totalEvaluaciones: _evaluaciones.length, onComparar: () => _abrirComparador(ultima)),
        const SizedBox(height: 16),
        Text('Historial', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
        const SizedBox(height: 8),
        for (final evaluacion in _evaluaciones) ...[
          _EvaluacionTile(evaluacion: evaluacion, onTap: () => _abrirComparador(evaluacion)),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _ResumenCard extends StatelessWidget {
  final Progreso ultima;
  final int totalEvaluaciones;
  final VoidCallback onComparar;

  const _ResumenCard({required this.ultima, required this.totalEvaluaciones, required this.onComparar});

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.accessibility_new, color: AppColors.accent, size: 20),
              const SizedBox(width: 8),
              Text(
                totalEvaluaciones == 1 ? 'Tu evaluación inicial' : 'Tu evolución',
                style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary),
              ),
              const Spacer(),
              Text(ultima.fecha, style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 16),
          if (ultima.indiceEvolucion != null) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  ultima.indiceEvolucion!.toStringAsFixed(0),
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 36, color: AppColors.accent),
                ),
                Padding(
                  padding: const EdgeInsets.only(bottom: 6, left: 4),
                  child: Text('/ 100', style: TextStyle(color: AppColors.textSecondary)),
                ),
                const Spacer(),
              ],
            ),
            Text('Índice de evolución física', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
            Text(
              'Indicador interno de seguimiento. No representa una medición médica.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 10, fontStyle: FontStyle.italic),
            ),
            const SizedBox(height: 14),
            const Divider(height: 1),
            const SizedBox(height: 10),
          ],
          if (ultima.peso != null)
            _filaDato('Peso', '${ultima.peso!.toStringAsFixed(1)} kg'),
          if (ultima.cintura != null)
            _filaDato('Cintura', '${ultima.cintura!.toStringAsFixed(1)} cm'),
          if (ultima.objetivo != null && ultima.objetivo!.isNotEmpty)
            _filaDato('Objetivo', ultima.objetivo!),
          const SizedBox(height: 4),
          Text('$totalEvaluaciones evaluación(es) registrada(s)', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: onComparar,
            icon: const Icon(Icons.compare_arrows, size: 18),
            label: Text(totalEvaluaciones >= 2 ? 'Ver evolución' : 'Ver mi evaluación'),
          ),
        ],
      ),
    );
  }

  Widget _filaDato(String label, String valor) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: Text(label, style: TextStyle(color: AppColors.textSecondary, fontSize: 13))),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              valor,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }
}

class _EvaluacionTile extends StatelessWidget {
  final Progreso evaluacion;
  final VoidCallback onTap;

  const _EvaluacionTile({required this.evaluacion, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: AppCard(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(evaluacion.fecha, style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                  if (evaluacion.peso != null)
                    Text('Peso: ${evaluacion.peso!.toStringAsFixed(1)} kg', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                ],
              ),
            ),
            if (evaluacion.indiceEvolucion != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: AppColors.accent.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
                child: Text(
                  evaluacion.indiceEvolucion!.toStringAsFixed(0),
                  style: TextStyle(color: AppColors.accent, fontWeight: FontWeight.w800),
                ),
              ),
            const SizedBox(width: 8),
            Icon(Icons.chevron_right, color: AppColors.textSecondary),
          ],
        ),
      ),
    );
  }
}

/// Tarjeta de "frecuencia recomendada de evaluación" (ver
/// EvaluacionFisicaScheduleService): última evaluación, próxima fecha
/// recomendada y un botón para evaluar ahora. Puramente informativa --
/// nunca deshabilita el botón, solo cambia el texto/color según el estado.
class _RecomendacionCard extends StatelessWidget {
  final EstadoSeguimientoFisico estado;
  final VoidCallback onEvaluar;

  const _RecomendacionCard({required this.estado, required this.onEvaluar});

  (Color, IconData) _estiloEstado() {
    switch (estado.estado) {
      case EstadoEvaluacion.primeraEvaluacion:
        return (AppColors.accent, Icons.flag_outlined);
      case EstadoEvaluacion.muyReciente:
        return (AppColors.textSecondary, Icons.hourglass_empty);
      case EstadoEvaluacion.disponible:
        return (AppColors.accent, Icons.event_available_outlined);
      case EstadoEvaluacion.recomendada:
        return (AppColors.success, Icons.check_circle_outline);
    }
  }

  @override
  Widget build(BuildContext context) {
    final (color, icono) = _estiloEstado();
    final formatoFecha = DateFormat("d 'de' MMMM 'de' y", 'es');
    final mensaje = EvaluacionFisicaScheduleService.instance.mensajePrincipal(estado);

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.insights_outlined, size: 18, color: AppColors.accent),
              const SizedBox(width: 8),
              Text('Seguimiento físico', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
            ],
          ),
          if (estado.ultimaEvaluacion != null) ...[
            const SizedBox(height: 12),
            _filaFecha('Última evaluación', formatoFecha.format(estado.ultimaEvaluacion!)),
            if (estado.proximaEvaluacion != null)
              _filaFecha('Próxima evaluación recomendada', formatoFecha.format(estado.proximaEvaluacion!)),
          ],
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icono, size: 18, color: color),
              const SizedBox(width: 8),
              Expanded(child: Text(mensaje, style: TextStyle(color: AppColors.textPrimary, fontSize: 13))),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(onPressed: onEvaluar, child: const Text('Realizar evaluación')),
          ),
        ],
      ),
    );
  }

  Widget _filaFecha(String etiqueta, String valor) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: Text(etiqueta, style: TextStyle(color: AppColors.textSecondary, fontSize: 12))),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              valor,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }
}
