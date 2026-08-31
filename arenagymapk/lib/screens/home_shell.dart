import 'dart:async';

import 'package:flutter/material.dart';

import '../services/api_service.dart';
import '../theme/app_theme.dart';
import 'inicio_tab.dart';
import 'notificaciones_tab.dart';
import 'perfil_tab.dart';
import 'progreso_tab.dart';

/// Contenedor post-login con navegación inferior de 4 pestañas: Inicio,
/// Progreso, Notificaciones y Perfil.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  // Estático: sobrevive a que HomeShell se remonte por completo dentro del
  // mismo proceso (ej. al cambiar el modo oscuro, que fuerza un remontaje
  // desde la raíz de la app) para que el cliente no "regrese" a Inicio cada
  // vez que cambia el tema, sino que se quede en la pestaña donde estaba.
  static int _ultimoIndice = 0;

  int _index = _ultimoIndice;
  int _noLeidas = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _actualizarContadorNoLeidas();
    // Refresco periódico para que el badge no quede desactualizado mientras
    // la app está abierta y el cliente no visita la pestaña de notificaciones.
    _timer = Timer.periodic(
      const Duration(seconds: 60),
      (_) => _actualizarContadorNoLeidas(),
    );
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _actualizarContadorNoLeidas() async {
    try {
      final notificaciones = await ApiService.instance.obtenerNotificaciones();
      if (!mounted) return;
      setState(() {
        _noLeidas = notificaciones.where((n) => !n.leida).length;
      });
    } catch (_) {
      // Silencioso: el badge simplemente no se actualiza en este ciclo.
    }
  }

  void _cambiarIndice(int value) {
    setState(() => _index = value);
    _ultimoIndice = value;
  }

  void _onDestinationSelected(int value) {
    final veniaDeNotificaciones = _index == 2;
    _cambiarIndice(value);
    // Si el cliente sale de la pestaña de notificaciones, refresca el
    // contador por si marcó/eliminó algo mientras estaba ahí.
    if (veniaDeNotificaciones && value != 2) {
      _actualizarContadorNoLeidas();
    }
  }

  @override
  Widget build(BuildContext context) {
    final tabs = [
      const InicioTab(),
      const ProgresoTab(),
      NotificacionesTab(
        onNotificacionesActualizadas: _actualizarContadorNoLeidas,
        onNavegarAPestana: _cambiarIndice,
      ),
      const PerfilTab(),
    ];

    return Scaffold(
      body: SafeArea(
        child: IndexedStack(index: _index, children: tabs),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: _onDestinationSelected,
        backgroundColor: AppColors.card,
        indicatorColor: AppColors.accent.withValues(alpha: 0.12),
        destinations: [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home, color: AppColors.accent),
            label: 'Inicio',
          ),
          NavigationDestination(
            icon: Icon(Icons.trending_up_outlined),
            selectedIcon: Icon(Icons.trending_up, color: AppColors.accent),
            label: 'Progreso',
          ),
          NavigationDestination(
            icon: Badge(
              label: Text('$_noLeidas'),
              isLabelVisible: _noLeidas > 0,
              child: const Icon(Icons.notifications_outlined),
            ),
            selectedIcon: Badge(
              label: Text('$_noLeidas'),
              isLabelVisible: _noLeidas > 0,
              child: Icon(Icons.notifications, color: AppColors.accent),
            ),
            label: 'Notificaciones',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person, color: AppColors.accent),
            label: 'Perfil',
          ),
        ],
      ),
    );
  }
}
