const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Progreso = sequelize.define('Progreso', {
  id_progreso: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  id_usuario: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'usuarios',
      key: 'id_usuario'
    }
  },
  fecha: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  peso: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true
  },
  porcentaje_grasa: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true
  },
  pecho: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true
  },
  cintura: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true
  },
  brazo: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true
  },
  pierna: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true
  },
  cadera: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true
  },
  observaciones: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'progresos',
  timestamps: false,
});

module.exports = Progreso;
