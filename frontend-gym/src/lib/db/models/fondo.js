const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Fondo = sequelize.define('Fondo', {
  id_fondo: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  tipo_fondo: {
    type: DataTypes.STRING(30),
    allowNull: false,
    references: { model: 'tipos_fondo', key: 'codigo' }
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Mantenido incrementalmente por movimientos_financieros (igual que
  // cajas.saldo_actual): nunca se escribe directo desde un PUT del
  // frontend.
  saldo_actual: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  fecha_creacion: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  id_admin_creacion: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'fondos',
  timestamps: false,
  defaultScope: { where: { activo: true } },
  scopes: {
    withInactive: {},
    onlyInactive: { where: { activo: false } }
  }
});

module.exports = Fondo;
