const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MovimientoCaja = sequelize.define('MovimientoCaja', {
  id_movimiento: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  id_caja: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'cajas',
      key: 'id_caja'
    }
  },
  id_admin: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'administrativos',
      key: 'id_admin'
    }
  },
  tipo_movimiento: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      isIn: [['Ingreso', 'Egreso']]
    }
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  monto: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  fecha_movimiento: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW
  },
  origen: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      isIn: [['Pago', 'Venta', 'Desembolso', 'Reembolso', 'Otro']]
    }
  },
  id_referencia: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'movimientos_caja',
  timestamps: false,
});

module.exports = MovimientoCaja;