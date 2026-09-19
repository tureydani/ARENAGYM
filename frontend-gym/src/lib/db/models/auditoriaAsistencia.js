const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

// Historial inmutable de quién creó/editó/anuló/reactivó cada asistencia,
// con motivo y snapshot antes/después. Solo se escribe desde
// src/lib/db/asistenciaService.js; no existe ninguna ruta que permita
// editar o borrar estas filas desde la interfaz normal.
const AuditoriaAsistencia = sequelize.define('AuditoriaAsistencia', {
  id_auditoria: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  id_asistencia: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'asistencias',
      key: 'id_asistencia'
    }
  },
  id_admin: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'administrativos',
      key: 'id_admin'
    }
  },
  accion: {
    type: DataTypes.STRING(20),
    allowNull: false // CREACION | EDICION | ANULACION | REACTIVACION
  },
  fecha_accion: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  motivo: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  datos_anteriores: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  datos_nuevos: {
    type: DataTypes.JSONB,
    allowNull: true
  }
}, {
  tableName: 'auditoria_asistencias',
  timestamps: false,
});

module.exports = AuditoriaAsistencia;
