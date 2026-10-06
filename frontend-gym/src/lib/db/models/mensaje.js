const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Mensaje = sequelize.define('Mensaje', {
  id_mensaje: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  id_conversacion: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'conversaciones',
      key: 'id_conversacion'
    }
  },
  emisor: {
    type: DataTypes.STRING(10),
    allowNull: false,
    validate: {
      isIn: [['cliente', 'agente', 'humano']]
    }
  },
  contenido: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  fecha_hora: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'mensajes',
  timestamps: false
});

module.exports = Mensaje;
