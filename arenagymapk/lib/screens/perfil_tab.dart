import 'package:flutter/material.dart';

import '../models/usuario.dart';
import '../services/api_exception.dart';
import '../services/api_service.dart';
import '../services/auth_storage.dart';
import '../services/theme_controller.dart';
import '../theme/app_theme.dart';
import '../utils/date_utils.dart';
import '../widgets/app_card.dart';
import 'auth_gate.dart';
import 'login_screen.dart';

/// Pestaña "Perfil": datos del cliente, edición de teléfono y cierre de
/// sesión.
class PerfilTab extends StatefulWidget {
  const PerfilTab({super.key});

  @override
  State<PerfilTab> createState() => _PerfilTabState();
}

class _PerfilTabState extends State<PerfilTab> {
  bool _loading = true;
  bool _guardando = false;
  String? _errorMessage;
  Usuario? _usuario;

  final _telefonoController = TextEditingController();
  final _emailController = TextEditingController();
  bool _editandoTelefono = false;
  bool _editandoEmail = false;

  @override
  void initState() {
    super.initState();
    _cargarDatos();
  }

  @override
  void dispose() {
    _telefonoController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _cargarDatos() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
    });

    try {
      final perfil = await ApiService.instance.obtenerPerfil();
      if (!mounted) return;
      setState(() {
        _usuario = perfil.usuario;
        _telefonoController.text = perfil.usuario.telefono ?? '';
        _emailController.text = perfil.usuario.email;
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

  Future<void> _guardarEmail() async {
    setState(() => _guardando = true);
    try {
      final actualizado = await ApiService.instance.actualizarPerfil(
        email: _emailController.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        _usuario = actualizado;
        _editandoEmail = false;
        _guardando = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Correo actualizado correctamente.')),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _guardando = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _guardarTelefono() async {
    setState(() => _guardando = true);
    try {
      final actualizado = await ApiService.instance.actualizarPerfil(
        telefono: _telefonoController.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        _usuario = actualizado;
        _editandoTelefono = false;
        _guardando = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Teléfono actualizado correctamente.')),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _guardando = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _cerrarSesion() async {
    await AuthStorage.instance.clearToken();
    AuthGate.resetValidacion();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
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
                    _buildEncabezado(),
                    const SizedBox(height: 16),
                    _buildDatosCard(),
                    const SizedBox(height: 16),
                    _buildPreferenciasCard(),
                    const SizedBox(height: 16),
                    _buildCerrarSesionButton(),
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
            ElevatedButton(
              onPressed: _cargarDatos,
              child: const Text('Reintentar'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEncabezado() {
    final usuario = _usuario;
    return Column(
      children: [
        CircleAvatar(
          radius: 44,
          backgroundColor: AppColors.accent.withValues(alpha: 0.1),
          backgroundImage: (usuario?.fotoPerfil != null && usuario!.fotoPerfil!.isNotEmpty)
              ? NetworkImage(usuario.fotoPerfil!)
              : null,
          child: (usuario?.fotoPerfil == null || usuario!.fotoPerfil!.isEmpty)
              ? Icon(Icons.person, size: 44, color: AppColors.accent)
              : null,
        ),
        const SizedBox(height: 12),
        Text(
          usuario?.nombreCompleto ?? '',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
        ),
        Text(
          usuario?.email ?? '',
          style: TextStyle(color: AppColors.textSecondary),
        ),
      ],
    );
  }

  Widget _buildDatosCard() {
    final usuario = _usuario;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Datos personales',
            style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 16),
          _buildDatoFila(
            icon: Icons.badge_outlined,
            label: 'Nombre',
            value: usuario?.nombreCompleto ?? '-',
          ),
          const Divider(height: 24),
          _buildEmailFila(),
          const Divider(height: 24),
          _buildTelefonoFila(),
          const Divider(height: 24),
          _buildDatoFila(
            icon: Icons.calendar_today_outlined,
            label: 'Registrado desde',
            value: formatearFechaLegible(usuario?.fechaRegistro),
          ),
        ],
      ),
    );
  }

  Widget _buildDatoFila({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppColors.textSecondary),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
              const SizedBox(height: 2),
              Text(
                value,
                style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildEmailFila() {
    if (!_editandoEmail) {
      return Row(
        children: [
          Icon(Icons.email_outlined, size: 20, color: AppColors.textSecondary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Email',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
                const SizedBox(height: 2),
                Text(
                  (_usuario?.email.isEmpty ?? true) ? 'No registrado' : _usuario!.email,
                  style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Editar correo',
            icon: Icon(Icons.edit_outlined, size: 20, color: AppColors.accent),
            onPressed: () => setState(() => _editandoEmail = true),
          ),
        ],
      );
    }

    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Email'),
          ),
        ),
        const SizedBox(width: 8),
        _guardando
            ? const Padding(
                padding: EdgeInsets.all(8),
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2.5),
                ),
              )
            : IconButton(
                tooltip: 'Guardar',
                icon: Icon(Icons.check, color: AppColors.success),
                onPressed: _guardarEmail,
              ),
        if (!_guardando)
          IconButton(
            tooltip: 'Cancelar',
            icon: Icon(Icons.close, color: AppColors.danger),
            onPressed: () {
              setState(() {
                _editandoEmail = false;
                _emailController.text = _usuario?.email ?? '';
              });
            },
          ),
      ],
    );
  }

  Widget _buildTelefonoFila() {
    if (!_editandoTelefono) {
      return Row(
        children: [
          Icon(Icons.phone_outlined, size: 20, color: AppColors.textSecondary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Teléfono',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
                const SizedBox(height: 2),
                Text(
                  (_usuario?.telefono == null || _usuario!.telefono!.isEmpty)
                      ? 'No registrado'
                      : _usuario!.telefono!,
                  style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Editar teléfono',
            icon: Icon(Icons.edit_outlined, size: 20, color: AppColors.accent),
            onPressed: () => setState(() => _editandoTelefono = true),
          ),
        ],
      );
    }

    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: _telefonoController,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(labelText: 'Teléfono'),
          ),
        ),
        const SizedBox(width: 8),
        _guardando
            ? const Padding(
                padding: EdgeInsets.all(8),
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2.5),
                ),
              )
            : IconButton(
                tooltip: 'Guardar',
                icon: Icon(Icons.check, color: AppColors.success),
                onPressed: _guardarTelefono,
              ),
        if (!_guardando)
          IconButton(
            tooltip: 'Cancelar',
            icon: Icon(Icons.close, color: AppColors.danger),
            onPressed: () {
              setState(() {
                _editandoTelefono = false;
                _telefonoController.text = _usuario?.telefono ?? '';
              });
            },
          ),
      ],
    );
  }

  Widget _buildPreferenciasCard() {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Preferencias',
            style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 8),
          ValueListenableBuilder<bool>(
            valueListenable: ThemeController.modoOscuro,
            builder: (context, oscuro, _) {
              return SwitchListTile(
                contentPadding: EdgeInsets.zero,
                secondary: Icon(
                  oscuro ? Icons.dark_mode_outlined : Icons.light_mode_outlined,
                  color: AppColors.textSecondary,
                ),
                title: Text(
                  'Modo oscuro',
                  style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                ),
                value: oscuro,
                activeThumbColor: AppColors.accent,
                onChanged: (valor) => ThemeController.cambiarModo(valor),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildCerrarSesionButton() {
    return OutlinedButton.icon(
      onPressed: _cerrarSesion,
      icon: Icon(Icons.logout, color: AppColors.danger),
      label: Text('Cerrar sesión', style: TextStyle(color: AppColors.danger)),
      style: OutlinedButton.styleFrom(
        side: BorderSide(color: AppColors.danger),
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}
