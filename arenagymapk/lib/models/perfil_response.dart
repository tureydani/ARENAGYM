import 'membresia_activa.dart';
import 'usuario.dart';

class PerfilResponse {
  final Usuario usuario;
  final MembresiaActiva? membresiaActiva;

  PerfilResponse({required this.usuario, required this.membresiaActiva});

  factory PerfilResponse.fromJson(Map<String, dynamic> json) {
    final membresiaJson = json['membresiaActiva'];
    return PerfilResponse(
      usuario: Usuario.fromJson(json['usuario'] as Map<String, dynamic>),
      membresiaActiva: membresiaJson == null
          ? null
          : MembresiaActiva.fromJson(membresiaJson as Map<String, dynamic>),
    );
  }
}
