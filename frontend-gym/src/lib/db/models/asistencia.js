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
  },
  metodo: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'Manual' // 'QR' | 'Manual'
  },
  id_admin: {
    type: DataTypes.INTEGER,
    allowNull: true, // NULL en histórico previo a la auditoría; el panel siempre lo envía en registros nuevos
    references: {
      model: 'administrativos',
      key: 'id_admin'
    }
  },
  observacion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true // FALSE = anulada (soft delete); no cuenta para límites, estadísticas ni reportes
  },
  fecha_actualizacion: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'asistencias',
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

module.exports = Asistencia;
