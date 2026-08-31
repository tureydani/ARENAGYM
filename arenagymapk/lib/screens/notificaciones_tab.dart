import 'package:flutter/material.dart';

import '../models/notificacion.dart';
import '../services/api_exception.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../utils/date_utils.dart';
import '../widgets/app_card.dart';

/// Pestaña "Notificaciones": lista de notificaciones del cliente. Las no
/// leídas se destacan y al tocarlas se marcan como leídas.
class NotificacionesTab extends StatefulWidget {
  const NotificacionesTab({super.key});

  @override
  State<NotificacionesTab> createState() => _NotificacionesTabState();
}

class _NotificacionesTabState extends State<NotificacionesTab> {
  bool _loading = true;
  String? _errorMessage;
  List<Notificacion> _notificaciones = [];

  @override
  void initState() {
    super.initState();
    _cargarDatos();
  }

  Future<void> _cargarDatos() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
    });

    try {
      final notificaciones = await ApiService.instance.obtenerNotificaciones();
      if (!mounted) return;
      setState(() {
        _notificaciones = notificaciones;
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

  Future<void> _marcarLeida(Notificacion notificacion) async {
    if (notificacion.leida) return;
    try {
      final actualizada = await ApiService.instance.marcarNotificacionLeida(
        notificacion.idNotificacion,
      );
      if (!mounted) return;
      setState(() {
        final index = _notificaciones.indexWhere(
          (n) => n.idNotificacion == notificacion.idNotificacion,
        );
        if (index != -1) _notificaciones[index] = actualizada;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Notificaciones',
              style: Theme.of(context).appBarTheme.titleTextStyle,
            ),
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _errorMessage != null
                  ? _buildError()
                  : RefreshIndicator(
                      onRefresh: _cargarDatos,
                      child: _notificaciones.isEmpty
                          ? ListView(
                              padding: const EdgeInsets.all(16),
                              children: const [
                                AppCard(
                                  child: Text(
                                    'No tienes notificaciones por ahora.',
                                    style: TextStyle(color: AppColors.textSecondary),
                                  ),
                                ),
                              ],
                            )
                          : ListView.separated(
                              padding: const EdgeInsets.all(16),
                              itemCount: _notificaciones.length,
                              separatorBuilder: (_, _) => const SizedBox(height: 10),
                              itemBuilder: (context, index) =>
                                  _buildNotificacionTile(_notificaciones[index]),
                            ),
                    ),
        ),
      ],
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.wifi_off, size: 48, color: AppColors.textSecondary),
            const SizedBox(height: 16),
            Text(
              _errorMessage!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _cargarDatos,
              child: const Text('Reintentar'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNotificacionTile(Notificacion notificacion) {
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () => _marcarLeida(notificacion),
      child: AppCard(
        padding: const EdgeInsets.all(16).copyWith(
          left: notificacion.leida ? 16 : 12,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              margin: const EdgeInsets.only(top: 4),
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: notificacion.leida ? Colors.transparent : AppColors.accent,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    notificacion.titulo,
                    style: TextStyle(
                      fontWeight: notificacion.leida ? FontWeight.w600 : FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    notificacion.mensaje,
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    formatearFechaRelativa(notificacion.fechaCreacion),
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
