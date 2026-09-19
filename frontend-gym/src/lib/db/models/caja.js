const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

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
  },
  // Campos de apertura/cierre formal con arqueo. `estado` es la fuente de
  // verdad nueva; `abierta` se mantiene sincronizada por el código (no se
  // elimina para no romper lecturas existentes).
  fecha_cierre: {
    type: DataTypes.DATE,
    allowNull: true
  },
  saldo_esperado: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  saldo_contado: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  diferencia: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  id_admin_apertura: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  id_admin_cierre: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  estado: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'ABIERTA'
  }
}, {
  tableName: 'cajas',
  timestamps: false,
});

module.exports = Caja;
