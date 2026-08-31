import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../theme/app_theme.dart';

/// Controla el modo oscuro/claro de toda la app.
///
/// [modoOscuro] es un [ValueNotifier] global: el widget raíz de la app
/// escucha sus cambios con un `ValueListenableBuilder` y se reconstruye por
/// completo (con una `Key` distinta) cada vez que cambia, para que todos los
/// widgets que leen `AppColors.xxx` directamente (sin `Theme.of(context)`)
/// vuelvan a pintarse con los nuevos valores ya asignados por
/// [AppColors.aplicarModo].
///
/// La preferencia se persiste en [FlutterSecureStorage] (ya usado en el
/// proyecto para el token de sesión) bajo una key propia, no relacionada con
/// la de autenticación.
class ThemeController {
  ThemeController._();

  static final ValueNotifier<bool> modoOscuro = ValueNotifier<bool>(false);

  static const _key = 'arenagym_modo_oscuro';

  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  /// Lee la preferencia guardada y la aplica. Debe llamarse antes de
  /// `runApp` para evitar el parpadeo del tema claro al abrir la app.
  static Future<void> cargarPreferencia() async {
    final valor = await _storage.read(key: _key);
    final oscuro = valor == 'true';
    modoOscuro.value = oscuro;
    AppColors.aplicarModo(oscuro);
  }

  /// Cambia el modo actual, actualiza [AppColors] y guarda la preferencia.
  static Future<void> cambiarModo(bool oscuro) async {
    modoOscuro.value = oscuro;
    AppColors.aplicarModo(oscuro);
    await _storage.write(key: _key, value: oscuro.toString());
  }
}
