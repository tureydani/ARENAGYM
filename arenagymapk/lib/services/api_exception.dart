/// Excepción lanzada por [ApiService] cuando la API responde con un error
/// (4xx/5xx) o cuando falla la comunicación de red.
class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, {this.statusCode});

  /// True cuando el servidor respondió 401 (token ausente/inválido/expirado).
  bool get isUnauthorized => statusCode == 401;

  @override
  String toString() => message;
}
