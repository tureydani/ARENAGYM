// Smoke test: verifica que la pantalla de login se construye correctamente
// y muestra sus elementos principales.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:arenagymapk/screens/login_screen.dart';
import 'package:arenagymapk/theme/app_theme.dart';

void main() {
  testWidgets('La pantalla de login muestra el formulario de acceso',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(theme: AppTheme.light, home: const LoginScreen()),
    );

    expect(find.text('Arena Gym'), findsOneWidget);
    expect(find.text('Iniciar sesión'), findsOneWidget);
    expect(find.text('¿Primera vez? Activa tu cuenta'), findsOneWidget);
  });
}
