import 'package:flutter/material.dart';

/// Paleta "claro corporativo" tomada del sistema web (frontend-gym), para que
/// la app móvil se sienta parte del mismo producto.
///
/// Los campos son `static Color` (mutables, no `const`) a propósito: así
/// [AppColors.aplicarModo] puede reasignarlos en tiempo de ejecución para
/// alternar entre la paleta clara y la oscura sin tener que tocar los ~140
/// sitios del código que ya usan `AppColors.xxx` directamente. Todo widget
/// `const` que use estos campos debe dejar de ser `const` (el compilador lo
/// señala como error en cuanto se quita `const` de aquí).
class AppColors {
  AppColors._();

  // Paleta clara (valores originales, no se deben modificar).
  static const Color _backgroundLight = Color(0xFFF8FAFC);
  static const Color _cardLight = Color(0xFFFFFFFF);
  static const Color _borderLight = Color(0xFFE2E8F0);
  static const Color _accentLight = Color(0xFF4F46E5);
  static const Color _accentHoverLight = Color(0xFF4338CA);
  static const Color _textPrimaryLight = Color(0xFF0F172A);
  static const Color _textSecondaryLight = Color(0xFF64748B);
  static const Color _successLight = Color(0xFF059669);
  static const Color _dangerLight = Color(0xFFDC2626);

  // Paleta oscura.
  static const Color _backgroundDark = Color(0xFF0F172A);
  static const Color _cardDark = Color(0xFF1E293B);
  static const Color _borderDark = Color(0xFF334155);
  static const Color _accentDark = Color(0xFF6366F1);
  static const Color _accentHoverDark = Color(0xFF818CF8);
  static const Color _textPrimaryDark = Color(0xFFF1F5F9);
  static const Color _textSecondaryDark = Color(0xFF94A3B8);
  static const Color _successDark = Color(0xFF10B981);
  static const Color _dangerDark = Color(0xFFF87171);

  static Color background = _backgroundLight;
  static Color card = _cardLight;
  static Color border = _borderLight;
  static Color accent = _accentLight;
  static Color accentHover = _accentHoverLight;
  static Color textPrimary = _textPrimaryLight;
  static Color textSecondary = _textSecondaryLight;
  static Color success = _successLight;
  static Color danger = _dangerLight;

  static bool modoOscuro = false;

  /// Reasigna todos los campos de color a la paleta oscura o clara.
  static void aplicarModo(bool oscuro) {
    modoOscuro = oscuro;
    if (oscuro) {
      background = _backgroundDark;
      card = _cardDark;
      border = _borderDark;
      accent = _accentDark;
      accentHover = _accentHoverDark;
      textPrimary = _textPrimaryDark;
      textSecondary = _textSecondaryDark;
      success = _successDark;
      danger = _dangerDark;
    } else {
      background = _backgroundLight;
      card = _cardLight;
      border = _borderLight;
      accent = _accentLight;
      accentHover = _accentHoverLight;
      textPrimary = _textPrimaryLight;
      textSecondary = _textSecondaryLight;
      success = _successLight;
      danger = _dangerLight;
    }
  }
}

class AppTheme {
  AppTheme._();

  static ThemeData get light {
    final base = ThemeData.light(useMaterial3: true);

    final colorScheme = base.colorScheme.copyWith(
      primary: AppColors.accent,
      secondary: AppColors.accent,
      surface: AppColors.card,
      error: AppColors.danger,
    );

    return base.copyWith(
      colorScheme: colorScheme,
      scaffoldBackgroundColor: AppColors.background,
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: AppColors.textPrimary,
          fontSize: 20,
          fontWeight: FontWeight.w700,
        ),
      ),
      textTheme: base.textTheme.apply(
        bodyColor: AppColors.textPrimary,
        displayColor: AppColors.textPrimary,
      ),
      cardTheme: CardThemeData(
        color: AppColors.card,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: AppColors.border),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.card,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AppColors.accent, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AppColors.danger),
        ),
        labelStyle: TextStyle(color: AppColors.textSecondary),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.accent.withValues(alpha: 0.5),
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ).copyWith(
          overlayColor: WidgetStateProperty.resolveWith(
            (states) => states.contains(WidgetState.pressed)
                ? AppColors.accentHover.withValues(alpha: 0.2)
                : null,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: AppColors.accent),
      ),
      dividerTheme: DividerThemeData(color: AppColors.border, thickness: 1),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.textPrimary,
        contentTextStyle: const TextStyle(color: Colors.white),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
