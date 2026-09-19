// Archivo para definir todas las relaciones entre modelos
const Usuario = require('./usuario');
const Administrativo = require('./administrativo');
const Membresia = require('./membresia');
const RegistroMembresia = require('./registroMembresia');
const Pago = require('./pago');
const Producto = require('./producto');
const Caja = require('./caja');
const Venta = require('./venta');
const DetalleVenta = require('./detalleVenta');
const MovimientoCaja = require('./movimientoCaja');
const Asistencia = require('./asistencia');
const AuditoriaAsistencia = require('./auditoriaAsistencia');
const Notificacion = require('./notificacion');
const Meta = require('./meta');
const Progreso = require('./progreso');

// Definir todas las relaciones

// Usuario - Administrativo
Usuario.belongsTo(Administrativo, {
  foreignKey: 'registrado_por',
  as: 'Administrativo'
});
Administrativo.hasMany(Usuario, {
  foreignKey: 'registrado_por'
});

// RegistroMembresia - Usuario
RegistroMembresia.belongsTo(Usuario, {
  foreignKey: 'id_usuario',
  as: 'Usuario'
});
Usuario.hasMany(RegistroMembresia, {
  foreignKey: 'id_usuario'
});

// RegistroMembresia - Membresia
RegistroMembresia.belongsTo(Membresia, {
  foreignKey: 'id_membresia',
  as: 'Membresia'
});
Membresia.hasMany(RegistroMembresia, {
  foreignKey: 'id_membresia'
});

// RegistroMembresia - Administrativo
RegistroMembresia.belongsTo(Administrativo, {
  foreignKey: 'id_admin',
  as: 'Administrativo'
});
Administrativo.hasMany(RegistroMembresia, {
  foreignKey: 'id_admin'
});

// Pago - RegistroMembresia
Pago.belongsTo(RegistroMembresia, {
  foreignKey: 'id_registro',
  as: 'RegistroMembresia'
});
RegistroMembresia.hasMany(Pago, {
  foreignKey: 'id_registro'
});

// Pago - Administrativo
Pago.belongsTo(Administrativo, {
  foreignKey: 'id_admin',
  as: 'Administrativo'
});
Administrativo.hasMany(Pago, {
  foreignKey: 'id_admin'
});

// Pago - Caja
Pago.belongsTo(Caja, {
  foreignKey: 'id_caja',
  as: 'Caja'
});
Caja.hasMany(Pago, {
  foreignKey: 'id_caja'
});

// Venta - Usuario
Venta.belongsTo(Usuario, {
  foreignKey: 'id_usuario',
  as: 'Usuario'
});
Usuario.hasMany(Venta, {
  foreignKey: 'id_usuario'
});

// Venta - Administrativo
Venta.belongsTo(Administrativo, {
  foreignKey: 'id_admin',
  as: 'Administrativo'
});
Administrativo.hasMany(Venta, {
  foreignKey: 'id_admin'
});

// Venta - Caja
Venta.belongsTo(Caja, {
  foreignKey: 'id_caja',
  as: 'Caja'
});
Caja.hasMany(Venta, {
  foreignKey: 'id_caja'
});

// DetalleVenta - Venta
DetalleVenta.belongsTo(Venta, {
  foreignKey: 'id_venta',
  as: 'Venta'
});
Venta.hasMany(DetalleVenta, {
  foreignKey: 'id_venta',
  as: 'Detalles'
});

// DetalleVenta - Producto
DetalleVenta.belongsTo(Producto, {
  foreignKey: 'id_producto',
  as: 'Producto'
});
Producto.hasMany(DetalleVenta, {
  foreignKey: 'id_producto'
});

// Caja - Administrativo (apertura / cierre)
Caja.belongsTo(Administrativo, {
  foreignKey: 'id_admin_apertura',
  as: 'AdminApertura'
});
Caja.belongsTo(Administrativo, {
  foreignKey: 'id_admin_cierre',
  as: 'AdminCierre'
});

// MovimientoCaja - Caja
MovimientoCaja.belongsTo(Caja, {
  foreignKey: 'id_caja',
  as: 'Caja'
});
Caja.hasMany(MovimientoCaja, {
  foreignKey: 'id_caja'
});

// MovimientoCaja - Administrativo
MovimientoCaja.belongsTo(Administrativo, {
  foreignKey: 'id_admin',
  as: 'Administrativo'
});
Administrativo.hasMany(MovimientoCaja, {
  foreignKey: 'id_admin'
});

// Asistencia - Usuario
Asistencia.belongsTo(Usuario, {
  foreignKey: 'id_usuario',
  as: 'Usuario'
});
Usuario.hasMany(Asistencia, {
  foreignKey: 'id_usuario'
});

// Asistencia - RegistroMembresia
Asistencia.belongsTo(RegistroMembresia, {
  foreignKey: 'id_registro',
  as: 'RegistroMembresia'
});
RegistroMembresia.hasMany(Asistencia, {
  foreignKey: 'id_registro'
});

// Asistencia - Administrativo (quién la registró/corrigió)
Asistencia.belongsTo(Administrativo, {
  foreignKey: 'id_admin',
  as: 'Administrativo'
});
Administrativo.hasMany(Asistencia, {
  foreignKey: 'id_admin'
});

// AuditoriaAsistencia - Asistencia
AuditoriaAsistencia.belongsTo(Asistencia, {
  foreignKey: 'id_asistencia',
  as: 'Asistencia'
});
Asistencia.hasMany(AuditoriaAsistencia, {
  foreignKey: 'id_asistencia',
  as: 'Auditorias'
});

// AuditoriaAsistencia - Administrativo
AuditoriaAsistencia.belongsTo(Administrativo, {
  foreignKey: 'id_admin',
  as: 'Administrativo'
});
Administrativo.hasMany(AuditoriaAsistencia, {
  foreignKey: 'id_admin'
});

// Notificacion - Usuario
Notificacion.belongsTo(Usuario, {
  foreignKey: 'id_usuario',
  as: 'Usuario'
});
Usuario.hasMany(Notificacion, {
  foreignKey: 'id_usuario'
});

// Meta - Usuario
Meta.belongsTo(Usuario, {
  foreignKey: 'id_usuario',
  as: 'Usuario'
});
Usuario.hasMany(Meta, {
  foreignKey: 'id_usuario'
});

// Progreso - Usuario
Progreso.belongsTo(Usuario, {
  foreignKey: 'id_usuario',
  as: 'Usuario'
});
Usuario.hasMany(Progreso, {
  foreignKey: 'id_usuario'
});

module.exports = {
  Usuario,
  Administrativo,
  Membresia,
  RegistroMembresia,
  Pago,
  Producto,
  Caja,
  Venta,
  DetalleVenta,
  MovimientoCaja,
  Asistencia,
  AuditoriaAsistencia,
  Notificacion,
  Meta,
  Progreso
};
