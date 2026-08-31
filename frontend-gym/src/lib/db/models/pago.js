const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Pago = sequelize.define('Pago', {
  id_pago: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  id_registro: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'registro_membresias',
      key: 'id_registro'
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
  fecha_pago: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  monto_pagado: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  estado_pago: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      isIn: [['Completo', 'Parcial', 'Pendiente']]
    }
  },
  id_caja: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    references: {
      model: 'cajas',
      key: 'id_caja'
    }
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'pagos',
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

module.exports = Pago;
