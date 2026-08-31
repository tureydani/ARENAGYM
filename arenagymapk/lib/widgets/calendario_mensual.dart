import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../theme/app_theme.dart';

/// Calendario mensual simple, construido sin dependencias externas
/// (solo `Table`/`Container`s), que marca con el color de acento los días
/// en los que el cliente asistió al gimnasio.
///
/// [mes] es el primer día del mes que se muestra (el día exacto no importa,
/// solo año y mes). [diasMarcados] contiene fechas en formato "YYYY-MM-DD".
/// [onMesAnterior]/[onMesSiguiente] disparan la navegación entre meses.
class CalendarioMensual extends StatelessWidget {
  final DateTime mes;
  final Set<String> diasMarcados;
  final VoidCallback? onMesAnterior;
  final VoidCallback? onMesSiguiente;

  const CalendarioMensual({
    super.key,
    required this.mes,
    required this.diasMarcados,
    this.onMesAnterior,
    this.onMesSiguiente,
  });

  static const _diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  String _clave(DateTime fecha) {
    return '${fecha.year.toString().padLeft(4, '0')}-'
        '${fecha.month.toString().padLeft(2, '0')}-'
        '${fecha.day.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final primerDia = DateTime(mes.year, mes.month, 1);
    final diasEnMes = DateTime(mes.year, mes.month + 1, 0).day;
    // weekday: lunes=1 ... domingo=7. Celdas vacías antes del día 1.
    final espaciosVacios = primerDia.weekday - 1;
    final totalCeldas = espaciosVacios + diasEnMes;
    final filas = (totalCeldas / 7).ceil();

    final hoy = DateTime.now();
    final esMesActual = hoy.year == mes.year && hoy.month == mes.month;

    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            IconButton(
              onPressed: onMesAnterior,
              icon: const Icon(Icons.chevron_left, color: AppColors.textPrimary),
              tooltip: 'Mes anterior',
            ),
            Text(
              _capitalizar(DateFormat('MMMM y', 'es').format(mes)),
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 16,
                color: AppColors.textPrimary,
              ),
            ),
            IconButton(
              onPressed: onMesSiguiente,
              icon: const Icon(Icons.chevron_right, color: AppColors.textPrimary),
              tooltip: 'Mes siguiente',
            ),
          ],
        ),
        const SizedBox(height: 4),
        Row(
          children: [
            for (final dia in _diasSemana)
              Expanded(
                child: Center(
                  child: Text(
                    dia,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 4),
        for (var fila = 0; fila < filas; fila++)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Row(
              children: [
                for (var col = 0; col < 7; col++)
                  Expanded(
                    child: _buildCelda(
                      fila * 7 + col,
                      espaciosVacios,
                      diasEnMes,
                      esMesActual,
                      hoy,
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildCelda(
    int indiceCelda,
    int espaciosVacios,
    int diasEnMes,
    bool esMesActual,
    DateTime hoy,
  ) {
    final numeroDia = indiceCelda - espaciosVacios + 1;
    if (numeroDia < 1 || numeroDia > diasEnMes) {
      return const SizedBox(height: 36);
    }

    final fecha = DateTime(mes.year, mes.month, numeroDia);
    final marcado = diasMarcados.contains(_clave(fecha));
    final esHoy = esMesActual && hoy.day == numeroDia;

    return Padding(
      padding: const EdgeInsets.all(2),
      child: AspectRatio(
        aspectRatio: 1,
        child: Container(
          decoration: BoxDecoration(
            color: marcado ? AppColors.accent : Colors.transparent,
            shape: BoxShape.circle,
            border: esHoy && !marcado
                ? Border.all(color: AppColors.accent, width: 1.5)
                : null,
          ),
          alignment: Alignment.center,
          child: Text(
            '$numeroDia',
            style: TextStyle(
              color: marcado
                  ? Colors.white
                  : esHoy
                      ? AppColors.accent
                      : AppColors.textPrimary,
              fontWeight: marcado || esHoy ? FontWeight.w700 : FontWeight.w400,
              fontSize: 13,
            ),
          ),
        ),
      ),
    );
  }

  String _capitalizar(String texto) {
    if (texto.isEmpty) return texto;
    return texto[0].toUpperCase() + texto.substring(1);
  }
}
