const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Caja = sequelize.define('Caja', {
  id_caja: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  descripcion: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  fecha_apertura: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  saldo_inicial: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  saldo_actual: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  abierta: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'cajas',
  timestamps: false,
});

module.exports = Caja;