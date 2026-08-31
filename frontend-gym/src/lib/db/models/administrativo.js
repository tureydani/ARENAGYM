const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Administrativo = sequelize.define('Administrativo', {
  id_admin: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  apellido: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  usuario: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false
  },
  contraseña: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  fecha_contratacion: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'administrativos',
  timestamps: false,
  // "contraseña" (el hash bcrypt) nunca debe salir en una respuesta de la
  // API salvo para el propio login, que consulta con .unscoped() a
  // propósito para poder compararla. Excluirla acá cubre de una sola vez
  // todos los endpoints que devuelven Administrativo directamente o vía
  // include (usuarios, pagos, ventas, registros de membresía, etc.).
  defaultScope: {
    where: {
      activo: true
    },
    attributes: { exclude: ['contraseña'] }
  },
  scopes: {
    withInactive: {
      attributes: { exclude: ['contraseña'] }
    },
    onlyInactive: {
      where: {
        activo: false
      },
      attributes: { exclude: ['contraseña'] }
    }
  }
});

module.exports = Administrativo;
