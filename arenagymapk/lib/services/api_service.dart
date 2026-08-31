import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import '../models/meta.dart';
import '../models/notificacion.dart';
import '../models/perfil_response.dart';
import '../models/progreso.dart';
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
  /// [identificador] puede ser el teléfono o el correo del cliente,
  /// lo que tenga registrado (el panel web todavía no siempre captura
  /// el correo al dar de alta a un cliente).
  Future<({String token, Usuario usuario})> login({
    required String identificador,
    required String password,
  }) {
    return _guarded(() async {
      final response = await http.post(
        _uri('/login'),
        headers: _jsonHeaders,
        body: jsonEncode({'identificador': identificador, 'password': password}),
      );
      final json = _decodeOrThrow(response);
      final token = json['token'] as String;
      final usuario = Usuario.fromJson(json['usuario'] as Map<String, dynamic>);
      return (token: token, usuario: usuario);
    });
  }

  /// POST /activar-cuenta -> { message }
  /// [identificador]: teléfono o correo ya registrado por el gimnasio.
  /// [email]: opcional, para agregar el correo de una vez si el cliente
  /// se está activando solo con su teléfono y todavía no tiene uno.
  Future<String> activarCuenta({
    required String identificador,
    required String password,
    String? email,
  }) {
    return _guarded(() async {
      final response = await http.post(
        _uri('/activar-cuenta'),
        headers: _jsonHeaders,
        body: jsonEncode({
          'identificador': identificador,
          'password': password,
          if (email != null && email.isNotEmpty) 'email': email,
        }),
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

  /// GET /asistencia-qr -> { token, expiraEnSegundos }
  /// Token de vida muy corta (2 min) para mostrar como QR en el
  /// control de acceso del gimnasio. Se debe volver a pedir antes de
  /// que expire (la pantalla que lo muestra ya se encarga de eso).
  Future<({String token, int expiraEnSegundos})> obtenerTokenAsistenciaQr() {
    return _guarded(() async {
      final response = await http.get(
        _uri('/asistencia-qr'),
        headers: await _authHeaders(),
      );
      final json = _decodeOrThrow(response);
      return (
        token: json['token'] as String,
        expiraEnSegundos: json['expiraEnSegundos'] as int? ?? 120,
      );
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

  /// PATCH /notificaciones/{id} -> notificación actualizada
  Future<Notificacion> marcarNotificacionLeida(int idNotificacion, {bool leida = true}) {
    return _guarded(() async {
      final response = await http.patch(
        _uri('/notificaciones/$idNotificacion'),
        headers: await _authHeaders(),
        body: jsonEncode({'leida': leida}),
      );
      final json = _decodeOrThrow(response);
      return Notificacion.fromJson(json);
    });
  }

  /// PATCH /perfil -> { usuario }
  Future<Usuario> actualizarPerfil({String? telefono, String? fotoPerfil, String? email}) {
    return _guarded(() async {
      final response = await http.patch(
        _uri('/perfil'),
        headers: await _authHeaders(),
        body: jsonEncode({
          if (telefono != null) 'telefono': telefono,
          if (fotoPerfil != null) 'foto_perfil': fotoPerfil,
          if (email != null) 'email': email,
        }),
      );
      final json = _decodeOrThrow(response);
      return Usuario.fromJson(json['usuario'] as Map<String, dynamic>);
    });
  }

  /// GET /metas -> [ {...}, ... ]
  Future<List<Meta>> getMetas() {
    return _guarded(() async {
      final response = await http.get(_uri('/metas'), headers: await _authHeaders());

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final decoded = jsonDecode(response.body);
        if (decoded is List) {
          return decoded.map((e) => Meta.fromJson(e as Map<String, dynamic>)).toList();
        }
        return <Meta>[];
      }

      _decodeOrThrow(response);
      return <Meta>[];
    });
  }

  /// POST /metas -> meta creada (201)
  Future<Meta> crearMeta({
    required String tipoMeta,
    double? valorInicial,
    double? valorObjetivo,
    double? valorActual,
    String? fechaObjetivo,
    String? descripcion,
  }) {
    return _guarded(() async {
      final response = await http.post(
        _uri('/metas'),
        headers: await _authHeaders(),
        body: jsonEncode({
          'tipo_meta': tipoMeta,
          if (valorInicial != null) 'valor_inicial': valorInicial,
          if (valorObjetivo != null) 'valor_objetivo': valorObjetivo,
          if (valorActual != null) 'valor_actual': valorActual,
          if (fechaObjetivo != null) 'fecha_objetivo': fechaObjetivo,
          if (descripcion != null) 'descripcion': descripcion,
        }),
      );
      final json = _decodeOrThrow(response);
      return Meta.fromJson(json);
    });
  }

  /// PATCH /metas/{id} -> meta actualizada
  Future<Meta> actualizarMeta(
    int idMeta, {
    double? valorActual,
    double? valorObjetivo,
    String? estado,
    String? descripcion,
    String? fechaObjetivo,
  }) {
    return _guarded(() async {
      final response = await http.patch(
        _uri('/metas/$idMeta'),
        headers: await _authHeaders(),
        body: jsonEncode({
          if (valorActual != null) 'valor_actual': valorActual,
          if (valorObjetivo != null) 'valor_objetivo': valorObjetivo,
          if (estado != null) 'estado': estado,
          if (descripcion != null) 'descripcion': descripcion,
          if (fechaObjetivo != null) 'fecha_objetivo': fechaObjetivo,
        }),
      );
      final json = _decodeOrThrow(response);
      return Meta.fromJson(json);
    });
  }

  /// GET /progresos -> [ {...}, ... ]
  Future<List<Progreso>> getProgresos() {
    return _guarded(() async {
      final response = await http.get(_uri('/progresos'), headers: await _authHeaders());

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final decoded = jsonDecode(response.body);
        if (decoded is List) {
          return decoded.map((e) => Progreso.fromJson(e as Map<String, dynamic>)).toList();
        }
        return <Progreso>[];
      }

      _decodeOrThrow(response);
      return <Progreso>[];
    });
  }

  /// POST /progresos -> progreso creado (201)
  Future<Progreso> crearProgreso({
    double? peso,
    double? porcentajeGrasa,
    double? pecho,
    double? cintura,
    double? brazo,
    double? pierna,
    double? cadera,
    String? observaciones,
  }) {
    return _guarded(() async {
      final response = await http.post(
        _uri('/progresos'),
        headers: await _authHeaders(),
        body: jsonEncode({
          if (peso != null) 'peso': peso,
          if (porcentajeGrasa != null) 'porcentaje_grasa': porcentajeGrasa,
          if (pecho != null) 'pecho': pecho,
          if (cintura != null) 'cintura': cintura,
          if (brazo != null) 'brazo': brazo,
          if (pierna != null) 'pierna': pierna,
          if (cadera != null) 'cadera': cadera,
          if (observaciones != null) 'observaciones': observaciones,
        }),
      );
      final json = _decodeOrThrow(response);
      return Progreso.fromJson(json);
    });
  }
}
