import 'package:intl/intl.dart';

/// Formatea una fecha ISO (o similar) a una forma legible en español,
/// ej. "31 de agosto de 2026".
String formatearFechaLegible(String? isoDate) {
  if (isoDate == null || isoDate.isEmpty) return 'Sin registro';
  final fecha = DateTime.tryParse(isoDate);
  if (fecha == null) return isoDate;
  return DateFormat("d 'de' MMMM 'de' y", 'es').format(fecha);
}

/// Convierte una fecha ISO a una descripción relativa tipo "hace 2 días",
/// "hoy", "ayer".
String formatearFechaRelativa(String? isoDate) {
  if (isoDate == null || isoDate.isEmpty) return 'Sin registro';
  final fecha = DateTime.tryParse(isoDate);
  if (fecha == null) return isoDate;

  final ahora = DateTime.now();
  final hoy = DateTime(ahora.year, ahora.month, ahora.day);
  final diaFecha = DateTime(fecha.year, fecha.month, fecha.day);
  final diff = hoy.difference(diaFecha).inDays;

  if (diff == 0) return 'Hoy';
  if (diff == 1) return 'Ayer';
  if (diff > 1 && diff < 7) return 'Hace $diff días';
  if (diff >= 7 && diff < 30) {
    final semanas = (diff / 7).floor();
    return semanas == 1 ? 'Hace 1 semana' : 'Hace $semanas semanas';
  }
  if (diff >= 30 && diff < 365) {
    final meses = (diff / 30).floor();
    return meses == 1 ? 'Hace 1 mes' : 'Hace $meses meses';
  }
  if (diff < 0) return formatearFechaLegible(isoDate);

  final anios = (diff / 365).floor();
  return anios == 1 ? 'Hace 1 año' : 'Hace $anios años';
}
