import 'package:flutter/material.dart';

import '../services/api_exception.dart';
import '../services/api_service.dart';
import '../services/auth_storage.dart';
import '../theme/app_theme.dart';
import 'home_shell.dart';
import 'login_screen.dart';

/// Pantalla inicial: si hay un token guardado, lo valida contra GET /perfil.
/// Si es válido, va directo al dashboard; si no (401 o sin token), va a login.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  @override
  void initState() {
    super.initState();
    _verificarSesion();
  }

  Future<void> _verificarSesion() async {
    final token = await AuthStorage.instance.readToken();

    if (token == null || token.isEmpty) {
      _irALogin();
      return;
    }

    try {
      // Si el token es válido, esta llamada tendrá éxito.
      await ApiService.instance.obtenerPerfil();
      _irAHome();
    } on ApiException catch (e) {
      if (e.isUnauthorized) {
        await AuthStorage.instance.clearToken();
      }
      // Ante cualquier error (401 o de red) mandamos a login; si fue un
      // problema de red transitorio, el usuario puede reintentar allí.
      _irALogin();
    }
  }

  void _irALogin() {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
  }

  void _irAHome() {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const HomeShell()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: AppColors.background,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.fitness_center, size: 48, color: AppColors.accent),
            SizedBox(height: 16),
            CircularProgressIndicator(),
          ],
        ),
      ),
    );
  }
}
