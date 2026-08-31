import 'package:flutter/material.dart';

import '../models/notificacion.dart';
import '../services/api_exception.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../utils/date_utils.dart';
import '../widgets/app_card.dart';

/// Pestaña "Notificaciones": bandeja completa con filtros por tipo, marcar
/// leída/todas, eliminar (deslizando) y navegación contextual según el tipo
/// de la notificación tocada.
class NotificacionesTab extends StatefulWidget {
  /// Se invoca cada vez que cambia el estado local de las notificaciones
  /// (se marca una o todas como leídas, o se elimina una), para que
  /// [HomeShell] pueda refrescar el contador del badge sin esperar al
  /// siguiente ciclo periódico.
  final VoidCallback? onNotificacionesActualizadas;

  /// Se invoca al tocar una notificación cuyo tipo implica navegar a otra
  /// pestaña del [HomeShell] (ej. pago -> Inicio, asistencia -> Progreso).
  final ValueChanged<int>? onNavegarAPestana;

  const NotificacionesTab({
    super.key,
    this.onNotificacionesActualizadas,
    this.onNavegarAPestana,
  });

  @override
  State<NotificacionesTab> createState() => _NotificacionesTabState();
}

class _NotificacionesTabState extends State<NotificacionesTab> {
  bool _loading = true;
  String? _errorMessage;
  List<Notificacion> _notificaciones = [];
  String? _filtroTipo; // null = "Todas"

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
        // Si el filtro activo ya no existe entre los datos nuevos, vuelve a "Todas".
        if (_filtroTipo != null &&
            !_notificaciones.any((n) => (n.tipo ?? 'info') == _filtroTipo)) {
          _filtroTipo = null;
        }
      });
      widget.onNotificacionesActualizadas?.call();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.message;
        _loading = false;
      });
    }
  }

  List<String> get _tiposDisponibles {
    final tipos = _notificaciones.map((n) => n.tipo ?? 'info').toSet().toList();
    tipos.sort();
    return tipos;
  }

  List<Notificacion> get _notificacionesFiltradas {
    if (_filtroTipo == null) return _notificaciones;
    return _notificaciones.where((n) => (n.tipo ?? 'info') == _filtroTipo).toList();
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
      widget.onNotificacionesActualizadas?.call();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _marcarTodasLeidas() async {
    try {
      await ApiService.instance.marcarTodasLasNotificacionesLeidas();
      if (!mounted) return;
      final ahora = DateTime.now().toIso8601String();
      setState(() {
        _notificaciones = _notificaciones
            .map((n) => n.leida ? n : n.copyWith(leida: true, fechaLectura: ahora))
            .toList();
      });
      widget.onNotificacionesActualizadas?.call();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<bool> _eliminarNotificacion(Notificacion notificacion) async {
    try {
      await ApiService.instance.eliminarNotificacion(notificacion.idNotificacion);
      if (!mounted) return true;
      setState(() {
        _notificaciones.removeWhere(
          (n) => n.idNotificacion == notificacion.idNotificacion,
        );
      });
      widget.onNotificacionesActualizadas?.call();
      return true;
    } on ApiException catch (e) {
      if (!mounted) return false;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      return false;
    }
  }

  void _onTapNotificacion(Notificacion notificacion) {
    _marcarLeida(notificacion);

    switch (notificacion.tipo) {
      case 'pago':
      case 'membresia':
      case 'motivacion':
        widget.onNavegarAPestana?.call(0); // Inicio
        break;
      case 'asistencia':
      case 'progreso':
        widget.onNavegarAPestana?.call(1); // Progreso
        break;
      default:
        // aviso, rutina, info o desconocido: solo informativa, no navega.
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final hayNoLeidas = _notificaciones.any((n) => !n.leida);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'Notificaciones',
                  style: Theme.of(context).appBarTheme.titleTextStyle,
                ),
              ),
              if (hayNoLeidas)
                TextButton(
                  onPressed: _marcarTodasLeidas,
                  child: const Text('Marcar todas como leídas'),
                ),
            ],
          ),
        ),
        if (!_loading && _errorMessage == null && _tiposDisponibles.isNotEmpty)
          _buildFiltros(),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _errorMessage != null
                  ? _buildError()
                  : RefreshIndicator(
                      onRefresh: _cargarDatos,
                      child: _notificaciones.isEmpty
                          ? _buildVacio()
                          : _notificacionesFiltradas.isEmpty
                              ? ListView(
                                  padding: const EdgeInsets.all(16),
                                  children: [
                                    AppCard(
                                      child: Text(
                                        'No hay notificaciones de este tipo.',
                                        style: TextStyle(color: AppColors.textSecondary),
                                      ),
                                    ),
                                  ],
                                )
                              : ListView.separated(
                                  padding: const EdgeInsets.all(16),
                                  itemCount: _notificacionesFiltradas.length,
                                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                                  itemBuilder: (context, index) =>
                                      _buildNotificacionTile(_notificacionesFiltradas[index]),
                                ),
                    ),
        ),
      ],
    );
  }

  Widget _buildFiltros() {
    final tipos = _tiposDisponibles;
    return SizedBox(
      height: 44,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        children: [
          _buildChip(label: 'Todas', seleccionado: _filtroTipo == null, tipo: null),
          for (final tipo in tipos)
            Padding(
              padding: const EdgeInsets.only(left: 8),
              child: _buildChip(
                label: etiquetaParaTipo(tipo),
                seleccionado: _filtroTipo == tipo,
                tipo: tipo,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildChip({required String label, required bool seleccionado, required String? tipo}) {
    return ChoiceChip(
      label: Text(label),
      selected: seleccionado,
      onSelected: (_) => setState(() => _filtroTipo = tipo),
      selectedColor: AppColors.accent,
      backgroundColor: AppColors.card,
      side: BorderSide(color: seleccionado ? AppColors.accent : AppColors.border),
      labelStyle: TextStyle(
        color: seleccionado ? Colors.white : AppColors.textSecondary,
        fontWeight: FontWeight.w600,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    );
  }

  Widget _buildVacio() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 48),
          child: Column(
            children: [
              Icon(
                Icons.notifications_none,
                size: 56,
                color: AppColors.textSecondary,
              ),
              const SizedBox(height: 16),
              Text(
                'No tienes notificaciones por ahora',
                style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 6),
              Text(
                'Aquí verás avisos sobre tus pagos, asistencias, membresía y progreso.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
              ),
            ],
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
            Icon(Icons.wifi_off, size: 48, color: AppColors.textSecondary),
            const SizedBox(height: 16),
            Text(
              _errorMessage!,
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary),
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
    final info = infoParaTipo(notificacion.tipo);

    return Dismissible(
      key: ValueKey(notificacion.idNotificacion),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.symmetric(horizontal: 24),
        decoration: BoxDecoration(
          color: AppColors.danger,
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Icon(Icons.delete_outline, color: Colors.white),
      ),
      confirmDismiss: (_) => _eliminarNotificacion(notificacion),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _onTapNotificacion(notificacion),
        child: AppCard(
          padding: const EdgeInsets.all(16),
          child: Container(
            decoration: BoxDecoration(
              color: notificacion.leida
                  ? Colors.transparent
                  : AppColors.accent.withValues(alpha: 0.03),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: info.color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(info.icono, color: info.color, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              notificacion.titulo,
                              style: TextStyle(
                                fontWeight:
                                    notificacion.leida ? FontWeight.w600 : FontWeight.w800,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ),
                          if (!notificacion.leida) ...[
                            const SizedBox(width: 6),
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: AppColors.accent,
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        notificacion.mensaje,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        formatearFechaRelativa(notificacion.fechaCreacion),
                        style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
