const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Asistencia = sequelize.define('Asistencia', {
  id_asistencia: {
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
  fecha_hora: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  id_registro: {
    type: DataTypes.INTEGER,
    allowNull: true, // la membresía vigente del usuario al momento de asistir; permite contar asistencias por membresía (para límites tipo "15 accesos")
    references: {
      model: 'registro_membresias',
      key: 'id_registro'
    }
  }
}, {
  tableName: 'asistencias',
  timestamps: false,
});

module.exports = Asistencia;
