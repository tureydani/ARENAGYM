import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'screens/auth_gate.dart';
import 'services/theme_controller.dart';
import 'theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('es');
  // Se aplica la preferencia de modo oscuro guardada antes de construir la
  // UI por primera vez, para evitar un parpadeo del tema claro al abrir.
  await ThemeController.cargarPreferencia();
  runApp(const ArenaGymApp());
}

class ArenaGymApp extends StatelessWidget {
  const ArenaGymApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: ThemeController.modoOscuro,
      builder: (context, oscuro, _) {
        return MaterialApp(
          // La Key distinta fuerza la reconstrucción completa del árbol de
          // widgets cada vez que cambia el modo, para que todos los widgets
          // que leen AppColors.xxx directamente vuelvan a pintarse con los
          // valores ya actualizados por AppColors.aplicarModo.
          key: ValueKey(oscuro),
          title: 'Arena Gym',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light,
          home: const AuthGate(),
        );
      },
    );
  }
}
