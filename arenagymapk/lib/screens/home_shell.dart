import 'package:flutter/material.dart';

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
  int _index = 0;

  static const _tabs = [
    InicioTab(),
    ProgresoTab(),
    NotificacionesTab(),
    PerfilTab(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: IndexedStack(index: _index, children: _tabs),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        backgroundColor: AppColors.card,
        indicatorColor: AppColors.accent.withValues(alpha: 0.12),
        destinations: const [
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
            icon: Icon(Icons.notifications_outlined),
            selectedIcon: Icon(Icons.notifications, color: AppColors.accent),
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
