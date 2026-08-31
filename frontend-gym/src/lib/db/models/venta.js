const { DataTypes, Op } = require('sequelize');
const sequelize = require('../sequelize');

const Venta = sequelize.define('Venta', {
  id_venta: {
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
  id_admin: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'administrativos',
      key: 'id_admin'
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
  fecha_venta: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW
  },
  total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  estado: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'Completada',
    validate: {
      isIn: [['Completada', 'Pendiente', 'Cancelada', 'Eliminada']]
    }
  }
}, {
  tableName: 'ventas',
  timestamps: false,
  defaultScope: {
    where: {
      estado: {
        [Op.ne]: 'Eliminada'
      }
    }
  },
  scopes: {
    withInactive: {},
    onlyInactive: {
      where: {
        estado: 'Eliminada'
      }
    }
  }
});

module.exports = Venta;
