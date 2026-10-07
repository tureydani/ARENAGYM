import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:timezone/data/latest.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

import '../config/evaluacion_fisica_config.dart';

const String _canalId = 'seguimiento_fisico_recordatorio';
const String _canalNombre = 'Recordatorio de evaluación física';
const String _canalDescripcion =
    'Avisa cuando se cumple el tiempo recomendado desde tu última evaluación física.';

/// Programa/cancela el recordatorio local de "próxima evaluación
/// recomendada". Capa delgada sobre `flutter_local_notifications`: toda la
/// lógica de fechas/estado vive en [EvaluacionFisicaScheduleService], que
/// no depende de la plataforma y sí se puede probar con `flutter test`.
///
/// Identificador estable (sección 11 del pedido): se usa directamente
/// `id_progreso` como id de la notificación. Es suficiente porque
/// `id_progreso` es la clave primaria autoincremental de `progresos` en
/// PostgreSQL -- única globalmente, no solo por usuario -- así que programar
/// dos veces para la misma evaluación siempre apunta al mismo id y el
/// plugin reemplaza la notificación anterior en vez de duplicarla.
class EvaluacionFisicaNotificationService {
  EvaluacionFisicaNotificationService._();
  static final EvaluacionFisicaNotificationService instance = EvaluacionFisicaNotificationService._();

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  bool _inicializado = false;

  /// Inicializa el plugin y la zona horaria local. Debe llamarse una vez al
  /// arrancar la app (ver main.dart). Es seguro llamarla más de una vez.
  Future<void> inicializar() async {
    if (_inicializado) return;
    try {
      tz_data.initializeTimeZones();
      final nombreZona = await FlutterTimezone.getLocalTimezone();
      tz.setLocalLocation(tz.getLocation(nombreZona));

      const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
      const iosInit = DarwinInitializationSettings();
      await _plugin.initialize(
        const InitializationSettings(android: androidInit, iOS: iosInit),
      );

      const canal = AndroidNotificationChannel(
        _canalId,
        _canalNombre,
        description: _canalDescripcion,
        importance: Importance.defaultImportance,
      );
      await _plugin
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(canal);

      _inicializado = true;
    } catch (e) {
      // Nunca debe romper el arranque de la app por un problema de
      // notificaciones (sección 13: la app sigue funcionando normalmente
      // aunque éstas fallen o el permiso no exista).
      if (kDebugMode) debugPrint('EvaluacionFisicaNotificationService.inicializar: $e');
    }
  }

  /// Pide el permiso de notificaciones (Android 13+ / iOS). Es seguro
  /// llamarla varias veces: en Android no vuelve a mostrar el diálogo si ya
  /// se respondió antes; en iOS respeta la elección previa del usuario.
  Future<void> solicitarPermisos() async {
    try {
      await _plugin
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.requestNotificationsPermission();
      await _plugin
          .resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()
          ?.requestPermissions(alert: true, badge: true, sound: true);
    } catch (e) {
      if (kDebugMode) debugPrint('EvaluacionFisicaNotificationService.solicitarPermisos: $e');
    }
  }

  /// Programa el recordatorio para [fechaEvaluacion] +
  /// [EvaluacionFisicaConfig.diasRecomendados] días, a las 10:00 hora
  /// local. Si ya existía un recordatorio para esta evaluación, lo
  /// reemplaza (mismo id) en vez de duplicarlo.
  Future<void> programarRecordatorio({required int idProgreso, required DateTime fechaEvaluacion}) async {
    if (!_inicializado) await inicializar();
    if (!_inicializado) return; // la inicialización falló; no hay nada que programar.

    try {
      final fechaBase = DateTime(fechaEvaluacion.year, fechaEvaluacion.month, fechaEvaluacion.day)
          .add(const Duration(days: EvaluacionFisicaConfig.diasRecomendados));
      final momento = tz.TZDateTime(tz.local, fechaBase.year, fechaBase.month, fechaBase.day, 10);

      // Si la fecha calculada ya pasó (poco probable, pero posible si se
      // reprograma mucho después), no se programa una notificación en el
      // pasado -- el plugin la mostraría de inmediato, que no es la
      // intención de un recordatorio de "dentro de 30 días".
      if (momento.isBefore(tz.TZDateTime.now(tz.local))) return;

      await _plugin.zonedSchedule(
        idProgreso,
        '📊 Es momento de revisar tu progreso',
        'Han pasado aproximadamente ${EvaluacionFisicaConfig.diasRecomendados} días desde tu última '
            'evaluación física. Realiza una nueva evaluación para comparar tu progreso.',
        momento,
        const NotificationDetails(
          android: AndroidNotificationDetails(_canalId, _canalNombre, channelDescription: _canalDescripcion),
          iOS: DarwinNotificationDetails(),
        ),
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.absoluteTime,
      );
    } catch (e) {
      if (kDebugMode) debugPrint('EvaluacionFisicaNotificationService.programarRecordatorio: $e');
    }
  }

  /// Cancela el recordatorio de una evaluación (p.ej. si se elimina).
  Future<void> cancelarRecordatorio(int idProgreso) async {
    try {
      await _plugin.cancel(idProgreso);
    } catch (e) {
      if (kDebugMode) debugPrint('EvaluacionFisicaNotificationService.cancelarRecordatorio: $e');
    }
  }
}
