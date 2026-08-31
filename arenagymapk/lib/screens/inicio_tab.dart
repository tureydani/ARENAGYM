import 'package:flutter/material.dart';

import '../models/membresia_activa.dart';
import '../models/perfil_response.dart';
import '../models/resumen_asistencias.dart';
import '../services/api_exception.dart';
import '../services/api_service.dart';
import '../services/auth_storage.dart';
import '../theme/app_theme.dart';
import '../utils/date_utils.dart';
import '../widgets/app_card.dart';
import 'login_screen.dart';
import 'mi_qr_screen.dart';

/// Pestaña "Inicio": saludo, membresía activa y resumen de asistencias.
class InicioTab extends StatefulWidget {
  const InicioTab({super.key});

  @override
  State<InicioTab> createState() => _InicioTabState();
}

class _InicioTabState extends State<InicioTab> {
  bool _loading = true;
  String? _errorMessage;

  PerfilResponse? _perfil;
  ResumenAsistencias? _asistencias;

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

      if (!mounted) return;
      setState(() {
        _perfil = perfil;
        _asistencias = asistencias;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (e.isUnauthorized) {
        await _sesionExpirada();
        return;
      }
      if (!mounted) return;
      setState(() {
        _errorMessage = e.message;
        _loading = false;
      });
    }
  }

  Future<void> _sesionExpirada() async {
    await AuthStorage.instance.clearToken();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Tu sesión expiró. Inicia sesión de nuevo.')),
    );
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
                  padding: const EdgeInsets.all(16),
                  children: [
                    _buildSaludo(),
                    const SizedBox(height: 12),
                    _buildBotonQr(),
                    const SizedBox(height: 16),
                    _buildMembresiaCard(),
                    const SizedBox(height: 16),
                    _buildActividadCard(),
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

  Widget _buildBotonQr() {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const MiQrScreen()),
        ),
        icon: const Icon(Icons.qr_code_2),
        label: const Text('Mostrar mi código de acceso'),
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
    final porVencer = !vencida && dias <= 5;
    final estadoColor = vencida
        ? AppColors.danger
        : porVencer
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
                child: Text(
                  membresia.membresia.tipo,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          // Días restantes como elemento principal de la tarjeta.
          Center(
            child: Column(
              children: [
                Text(
                  vencida ? '0' : '$dias',
                  style: TextStyle(
                    fontSize: 56,
                    fontWeight: FontWeight.w800,
                    height: 1,
                    color: estadoColor,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  vencida
                      ? 'Membresía vencida'
                      : dias == 1
                          ? 'día restante'
                          : 'días restantes',
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: membresia.progresoTranscurrido.clamp(0.0, 1.0),
              minHeight: 8,
              backgroundColor: AppColors.border,
              color: estadoColor,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Inicio',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                    ),
                    Text(
                      formatearFechaLegible(membresia.fechaInicio),
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text(
                      'Vence',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                    ),
                    Text(
                      formatearFechaLegible(membresia.fechaFin),
                      textAlign: TextAlign.end,
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (vencida || porVencer) ...[
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: estadoColor.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: estadoColor.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline, color: estadoColor, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      vencida
                          ? 'Tu membresía venció. Renuévala en recepción para seguir entrenando.'
                          : 'Tu membresía vence pronto. Renuévala para no perder continuidad.',
                      style: TextStyle(color: estadoColor, fontWeight: FontWeight.w600, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
          ],
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
}
