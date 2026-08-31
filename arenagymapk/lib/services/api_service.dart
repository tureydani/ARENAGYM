import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import '../models/notificacion.dart';
import '../models/perfil_response.dart';
import '../models/resumen_asistencias.dart';
import '../models/usuario.dart';
import 'api_exception.dart';
import 'auth_storage.dart';

/// Centraliza todas las llamadas HTTP a la API de clientes de Arena Gym.
///
/// Para las rutas protegidas, adjunta automáticamente el header
/// `Authorization: Bearer <token>` leyendo el token guardado en
/// [AuthStorage].
class ApiService {
  ApiService._();
  static final ApiService instance = ApiService._();

  final String _baseUrl = ApiConfig.baseUrl;

  Uri _uri(String path) => Uri.parse('$_baseUrl$path');

  Map<String, String> get _jsonHeaders => const {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  Future<Map<String, String>> _authHeaders() async {
    final token = await AuthStorage.instance.readToken();
    return {
      ..._jsonHeaders,
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  /// Decodifica el cuerpo de la respuesta como JSON, lanzando [ApiException]
  /// con un mensaje legible si la petición falló o la respuesta no es JSON
  /// válido (por ejemplo, un error de servidor o de red devuelve HTML).
  Map<String, dynamic> _decodeOrThrow(http.Response response) {
    Map<String, dynamic>? body;
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) body = decoded;
    } catch (_) {
      // Cuerpo no era JSON (por ejemplo, HTML de error 404/500).
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body ?? const {};
    }

    final message = body?['error']?.toString() ??
        'Error del servidor (${response.statusCode})';
    throw ApiException(message, statusCode: response.statusCode);
  }

  Future<T> _guarded<T>(Future<T> Function() request) async {
    try {
      return await request();
    } on ApiException {
      rethrow;
    } on SocketException {
      throw ApiException(
        'No se pudo conectar con el servidor. Verifica tu conexión a internet.',
      );
    } on HttpException {
      throw ApiException('Error de comunicación con el servidor.');
    } on FormatException {
      throw ApiException('Respuesta inesperada del servidor.');
    } catch (e) {
      throw ApiException('Ocurrió un error inesperado: $e');
    }
  }

  /// POST /login -> { token, usuario }
  Future<({String token, Usuario usuario})> login({
    required String email,
    required String password,
  }) {
    return _guarded(() async {
      final response = await http.post(
        _uri('/login'),
        headers: _jsonHeaders,
        body: jsonEncode({'email': email, 'password': password}),
      );
      final json = _decodeOrThrow(response);
      final token = json['token'] as String;
      final usuario = Usuario.fromJson(json['usuario'] as Map<String, dynamic>);
      return (token: token, usuario: usuario);
    });
  }

  /// POST /activar-cuenta -> { message }
  Future<String> activarCuenta({
    required String email,
    required String password,
  }) {
    return _guarded(() async {
      final response = await http.post(
        _uri('/activar-cuenta'),
        headers: _jsonHeaders,
        body: jsonEncode({'email': email, 'password': password}),
      );
      final json = _decodeOrThrow(response);
      return json['message']?.toString() ?? 'Cuenta activada correctamente.';
    });
  }

  /// GET /perfil -> { usuario, membresiaActiva }
  Future<PerfilResponse> obtenerPerfil() {
    return _guarded(() async {
      final response = await http.get(_uri('/perfil'), headers: await _authHeaders());
      final json = _decodeOrThrow(response);
      return PerfilResponse.fromJson(json);
    });
  }

  /// GET /asistencias -> { totalMes, racha, ultimaVisita, diasDelMes }
  Future<ResumenAsistencias> obtenerAsistencias() {
    return _guarded(() async {
      final response =
          await http.get(_uri('/asistencias'), headers: await _authHeaders());
      final json = _decodeOrThrow(response);
      return ResumenAsistencias.fromJson(json);
    });
  }

  /// GET /notificaciones -> [ {...}, ... ]
  Future<List<Notificacion>> obtenerNotificaciones() {
    return _guarded(() async {
      final response = await http.get(
        _uri('/notificaciones'),
        headers: await _authHeaders(),
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final decoded = jsonDecode(response.body);
        if (decoded is List) {
          return decoded
              .map((e) => Notificacion.fromJson(e as Map<String, dynamic>))
              .toList();
        }
        return <Notificacion>[];
      }

      // Reutiliza el manejo de errores estándar (lanza ApiException).
      _decodeOrThrow(response);
      return <Notificacion>[];
    });
  }
}
