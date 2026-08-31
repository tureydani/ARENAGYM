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

  /// Backend local (Next.js) corriendo en esta PC. Desde el emulador Android
  /// oficial, 10.0.2.2 apunta al localhost del host.
  static const String _localBaseUrl = 'http://10.0.2.2:3001/api/cliente';

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
