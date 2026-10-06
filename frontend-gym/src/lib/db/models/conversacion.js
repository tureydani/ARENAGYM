const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Conversacion = sequelize.define('Conversacion', {
  id_conversacion: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  canal: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'telegram'
  },
  chat_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  id_usuario: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'usuarios',
      key: 'id_usuario'
    }
  },
  estado: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'activa',
    validate: {
      isIn: [['activa', 'esperando_humano', 'cerrada']]
    }
  },
  fecha_inicio: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  fecha_ultimo_mensaje: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'conversaciones',
  timestamps: false
});

module.exports = Conversacion;
