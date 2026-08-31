import 'package:flutter/material.dart';

import '../models/membresia_activa.dart';
import '../models/notificacion.dart';
import '../models/perfil_response.dart';
import '../models/resumen_asistencias.dart';
import '../services/api_exception.dart';
import '../services/api_service.dart';
import '../services/auth_storage.dart';
import '../theme/app_theme.dart';
import '../utils/date_utils.dart';
import '../widgets/app_card.dart';
import 'login_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _loading = true;
  String? _errorMessage;

  PerfilResponse? _perfil;
  ResumenAsistencias? _asistencias;
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
      final perfil = await ApiService.instance.obtenerPerfil();
      final asistencias = await ApiService.instance.obtenerAsistencias();
      final notificaciones = await ApiService.instance.obtenerNotificaciones();

      if (!mounted) return;
      setState(() {
        _perfil = perfil;
        _asistencias = asistencias;
        _notificaciones = notificaciones;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (e.isUnauthorized) {
        await _cerrarSesion(expirado: true);
        return;
      }
      if (!mounted) return;
      setState(() {
        _errorMessage = e.message;
        _loading = false;
      });
    }
  }

  Future<void> _cerrarSesion({bool expirado = false}) async {
    await AuthStorage.instance.clearToken();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
    if (expirado) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Tu sesión expiró. Inicia sesión de nuevo.'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mi Arena Gym'),
        actions: [
          IconButton(
            tooltip: 'Cerrar sesión',
            icon: const Icon(Icons.logout),
            onPressed: () => _cerrarSesion(),
          ),
        ],
      ),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _errorMessage != null
                ? _buildError()
                : RefreshIndicator(
                    onRefresh: _cargarDatos,
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        _buildSaludo(),
                        const SizedBox(height: 16),
                        _buildMembresiaCard(),
                        const SizedBox(height: 16),
                        _buildActividadCard(),
                        const SizedBox(height: 16),
                        _buildNotificacionesSection(),
                      ],
                    ),
                  ),
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

  Widget _buildSaludo() {
    final usuario = _perfil?.usuario;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Text(
        'Hola, ${usuario?.nombre ?? ''} ${usuario?.apellido ?? ''} 👋',
        style: const TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.w800,
          color: AppColors.textPrimary,
        ),
      ),
    );
  }

  Widget _buildMembresiaCard() {
    final MembresiaActiva? membresia = _perfil?.membresiaActiva;

    if (membresia == null) {
      return AppCard(
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.card_membership, color: AppColors.danger),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Sin membresía activa',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'No tienes una membresía activa en este momento.',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    final dias = membresia.diasRestantes;
    final vencida = dias < 0;
    final estadoColor = vencida
        ? AppColors.danger
        : dias <= 5
            ? const Color(0xFFD97706)
            : AppColors.success;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.accent.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.card_membership, color: AppColors.accent),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      membresia.membresia.tipo,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    Text(
                      'Vence el ${formatearFechaLegible(membresia.fechaFin)}',
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Días restantes',
                style: TextStyle(color: AppColors.textSecondary),
              ),
              Text(
                vencida ? 'Vencida' : '$dias día${dias == 1 ? '' : 's'}',
                style: TextStyle(fontWeight: FontWeight.w700, color: estadoColor),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActividadCard() {
    final resumen = _asistencias;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Actividad',
            style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 16),
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
              const Text(
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
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNotificacionesSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(bottom: 8, left: 4),
          child: Text(
            'Notificaciones',
            style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary),
          ),
        ),
        if (_notificaciones.isEmpty)
          const AppCard(
            child: Text(
              'No tienes notificaciones por ahora.',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          )
        else
          Column(
            children: [
              for (final notificacion in _notificaciones) ...[
                _buildNotificacionTile(notificacion),
                const SizedBox(height: 10),
              ],
            ],
          ),
      ],
    );
  }

  Widget _buildNotificacionTile(Notificacion notificacion) {
    return AppCard(
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
    );
  }
}
