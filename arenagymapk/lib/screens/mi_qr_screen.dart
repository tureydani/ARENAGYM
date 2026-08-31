import 'dart:async';

import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../services/api_exception.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

/// Pantalla de check-in: muestra un código QR que el personal del gimnasio
/// escanea para registrar la asistencia del cliente. El token que codifica
/// dura solo 2 minutos, así que esta pantalla lo renueva sola antes de que
/// expire mientras siga abierta.
class MiQrScreen extends StatefulWidget {
  const MiQrScreen({super.key});

  @override
  State<MiQrScreen> createState() => _MiQrScreenState();
}

class _MiQrScreenState extends State<MiQrScreen> {
  String? _token;
  int _segundosRestantes = 0;
  bool _loading = true;
  String? _errorMessage;

  Timer? _cuentaRegresiva;

  @override
  void initState() {
    super.initState();
    _obtenerToken();
  }

  @override
  void dispose() {
    _cuentaRegresiva?.cancel();
    super.dispose();
  }

  Future<void> _obtenerToken() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
    });

    try {
      final resultado = await ApiService.instance.obtenerTokenAsistenciaQr();
      if (!mounted) return;
      setState(() {
        _token = resultado.token;
        _segundosRestantes = resultado.expiraEnSegundos;
        _loading = false;
      });
      _iniciarCuentaRegresiva();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.message;
        _loading = false;
      });
    }
  }

  void _iniciarCuentaRegresiva() {
    _cuentaRegresiva?.cancel();
    _cuentaRegresiva = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() => _segundosRestantes--);

      // Renovar el token un poco antes de que expire, para que nunca se
      // muestre un QR ya vencido mientras la pantalla sigue abierta.
      if (_segundosRestantes <= 10) {
        timer.cancel();
        _obtenerToken();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mi código de acceso')),
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: _loading
                ? const CircularProgressIndicator()
                : _errorMessage != null
                    ? _buildError()
                    : _buildQr(),
          ),
        ),
      ),
    );
  }

  Widget _buildError() {
    return Column(
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
        ElevatedButton(onPressed: _obtenerToken, child: const Text('Reintentar')),
      ],
    );
  }

  Widget _buildQr() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text(
          'Muestra este código en recepción para registrar tu asistencia',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.textSecondary),
        ),
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.border),
          ),
          child: QrImageView(
            data: _token ?? '',
            version: QrVersions.auto,
            size: 240,
            backgroundColor: Colors.white,
          ),
        ),
        const SizedBox(height: 20),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.timer_outlined, size: 18, color: AppColors.textSecondary),
            const SizedBox(width: 6),
            Text(
              'Se renueva en $_segundosRestantes s',
              style: const TextStyle(color: AppColors.textSecondary),
            ),
          ],
        ),
      ],
    );
  }
}
