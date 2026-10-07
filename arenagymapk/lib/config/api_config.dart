/// Configuración central de la URL base de la API de Arena Gym.
///
/// Cambia [ApiConfig.environment] a [ApiEnvironment.local] para apuntar al
/// backend corriendo en esta misma PC (accesible desde el emulador Android
/// como 10.0.2.2). Por defecto se usa producción (Vercel).
library;

enum ApiEnvironment { local, production }

class ApiConfig {
  /// Cambia este valor para alternar entre desarrollo local y producción.
  static const ApiEnvironment environment = ApiEnvironment.production;

  /// Backend local (Next.js) corriendo en esta PC.
  /// - Emulador Android oficial: 10.0.2.2 apunta al localhost del host.
  /// - Dispositivo físico (como al probar con `flutter run` por USB): hace
  ///   falta la IP de la PC en la red WiFi (`ipconfig` -> adaptador Wi-Fi/
  ///   Ethernet, no el adaptador de Radmin VPN), y el teléfono debe estar
  ///   en la MISMA red WiFi que la PC.
  static const String _localBaseUrl = 'http://192.168.2.120:3001/api/cliente';

  /// Backend desplegado en producción (Vercel).
  static const String _productionBaseUrl =
      'https://arenagym-k9tj.vercel.app/api/cliente';

  static String get baseUrl {
    switch (environment) {
      case ApiEnvironment.local:
        return _localBaseUrl;
      case ApiEnvironment.production:
        return _productionBaseUrl;
    }
  }
}
