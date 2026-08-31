class Usuario {
  final int idUsuario;
  final String nombre;
  final String apellido;
  final String email;
  final String? fotoPerfil;
  final bool emailVerificado;
  final String? fechaNacimiento;
  final String? telefono;
  final String? fechaRegistro;
  final bool? activo;
  final String? ultimoAcceso;

  Usuario({
    required this.idUsuario,
    required this.nombre,
    required this.apellido,
    required this.email,
    this.fotoPerfil,
    this.emailVerificado = false,
    this.fechaNacimiento,
    this.telefono,
    this.fechaRegistro,
    this.activo,
    this.ultimoAcceso,
  });

  String get nombreCompleto => '$nombre $apellido';

  factory Usuario.fromJson(Map<String, dynamic> json) {
    return Usuario(
      idUsuario: json['id_usuario'] as int,
      nombre: json['nombre']?.toString() ?? '',
      apellido: json['apellido']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      fotoPerfil: json['foto_perfil'] as String?,
      emailVerificado: json['email_verificado'] as bool? ?? false,
      fechaNacimiento: json['fecha_nacimiento'] as String?,
      telefono: json['telefono'] as String?,
      fechaRegistro: json['fecha_registro'] as String?,
      activo: json['activo'] as bool?,
      ultimoAcceso: json['ultimo_acceso'] as String?,
    );
  }
}
