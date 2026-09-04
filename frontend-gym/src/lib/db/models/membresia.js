const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Membresia = sequelize.define('Membresia', {
  id_membresia: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  tipo: { type: DataTypes.STRING(50), allowNull: false },
  duracion_dias: { type: DataTypes.INTEGER, allowNull: false },
  precio: { type: DataTypes.DECIMAL(10,2), allowNull: false },
  limite_asistencias: {
    type: DataTypes.INTEGER,
    allowNull: true // NULL = asistencias ilimitadas durante la duración de la membresía
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'membresias',
  timestamps: false,
  defaultScope: {
    where: {
      activo: true
    }
  },
  scopes: {
    withInactive: {},
    onlyInactive: {
      where: {
        activo: false
      }
    }
  }
});

module.exports = Membresia;
