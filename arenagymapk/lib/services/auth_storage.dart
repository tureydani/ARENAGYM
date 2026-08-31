import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Envoltura sencilla sobre [FlutterSecureStorage] para guardar/leer/borrar
/// el token JWT de sesión del cliente.
class AuthStorage {
  AuthStorage._();
  static final AuthStorage instance = AuthStorage._();

  static const _tokenKey = 'arenagym_token';

  final _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  Future<void> saveToken(String token) => _storage.write(key: _tokenKey, value: token);

  Future<String?> readToken() => _storage.read(key: _tokenKey);

  Future<void> clearToken() => _storage.delete(key: _tokenKey);
}
