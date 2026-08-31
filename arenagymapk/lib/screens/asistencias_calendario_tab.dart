import 'package:flutter/material.dart';

import '../models/resumen_asistencias.dart';
import '../services/api_exception.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../utils/date_utils.dart';
import '../widgets/app_card.dart';
import '../widgets/calendario_mensual.dart';

/// Sub-tab "Asistencias" dentro de Progreso: calendario mensual con los días
/// en que el cliente asistió al gimnasio, más su total histórico, racha y
/// última visita.
class AsistenciasCalendarioTab extends StatefulWidget {
  const AsistenciasCalendarioTab({super.key});

  @override
  State<AsistenciasCalendarioTab> createState() => _AsistenciasCalendarioTabState();
}

class _AsistenciasCalendarioTabState extends State<AsistenciasCalendarioTab> {
  bool _loading = true;
  String? _errorMessage;
  ResumenAsistencias? _resumen;
  DateTime _mesSeleccionado = DateTime(DateTime.now().year, DateTime.now().month);

  @override
  void initState() {
    super.initState();
    _cargarDatos();
  }

  String get _mesFormateado =>
      '${_mesSeleccionado.year.toString().padLeft(4, '0')}-'
      '${_mesSeleccionado.month.toString().padLeft(2, '0')}';

  Future<void> _cargarDatos() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
    });
    try {
      final resumen = await ApiService.instance.obtenerAsistencias(mes: _mesFormateado);
      if (!mounted) return;
      setState(() {
        _resumen = resumen;
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

  void _cambiarMes(int delta) {
    setState(() {
      _mesSeleccionado = DateTime(_mesSeleccionado.year, _mesSeleccionado.month + delta);
    });
    _cargarDatos();
  }

  @override
  Widget build(BuildContext context) {
    return _loading
        ? const Center(child: CircularProgressIndicator())
        : _errorMessage != null
            ? _buildError()
            : RefreshIndicator(
                onRefresh: _cargarDatos,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                  children: [
                    _buildTotalHistoricoCard(),
                    const SizedBox(height: 16),
                    _buildCalendarioCard(),
                    const SizedBox(height: 16),
                    _buildDetalleCard(),
                  ],
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
            Text(
              _errorMessage!,
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _cargarDatos, child: const Text('Reintentar')),
          ],
        ),
      ),
    );
  }

  Widget _buildTotalHistoricoCard() {
    final total = _resumen?.totalHistorico ?? 0;
    return AppCard(
      child: Column(
        children: [
          Text(
            'Asistencias totales',
            style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 12),
          Text(
            '$total',
            style: TextStyle(
              fontSize: 56,
              fontWeight: FontWeight.w800,
              height: 1,
              color: AppColors.accent,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            total == 1 ? 'visita registrada' : 'visitas registradas',
            style: TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }

  Widget _buildCalendarioCard() {
    final dias = _resumen?.diasDelMes.toSet() ?? <String>{};
    return AppCard(
      child: CalendarioMensual(
        mes: _mesSeleccionado,
        diasMarcados: dias,
        onMesAnterior: () => _cambiarMes(-1),
        onMesSiguiente: () => _cambiarMes(1),
      ),
    );
  }

  Widget _buildDetalleCard() {
    final resumen = _resumen;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _buildEstadistica(
                icon: Icons.calendar_month,
                label: 'Este mes',
                value: '${resumen?.totalMes ?? 0}',
              ),
              const SizedBox(width: 12),
              _buildEstadistica(
                icon: Icons.local_fire_department,
                label: 'Racha',
                value: '${resumen?.racha ?? 0} día${(resumen?.racha ?? 0) == 1 ? '' : 's'}',
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Última visita',
                style: TextStyle(color: AppColors.textSecondary),
              ),
              Text(
                formatearFechaRelativa(resumen?.ultimaVisita),
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildEstadistica({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          children: [
            Icon(icon, color: AppColors.accent, size: 22),
            const SizedBox(height: 6),
            Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
            Text(
              label,
              style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}
