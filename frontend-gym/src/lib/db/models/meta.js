const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Meta = sequelize.define('Meta', {
  id_meta: {
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
  tipo_meta: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  valor_inicial: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  valor_objetivo: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  valor_actual: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  fecha_inicio: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW
  },
  fecha_objetivo: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  estado: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'activa',
    validate: {
      isIn: [['activa', 'cumplida', 'cancelada']]
    }
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'metas',
  timestamps: false,
});

module.exports = Meta;
