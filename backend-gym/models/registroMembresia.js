const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RegistroMembresia = sequelize.define('RegistroMembresia', {
  id_registro: {
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
  id_membresia: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'membresias',
      key: 'id_membresia'
    }
  },
  id_admin: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    references: {
      model: 'administrativos',
      key: 'id_admin'
    }
  },
  fecha_inicio: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  fecha_fin: {
    type: DataTypes.DATEONLY,
    allowNull: true // Se calculará automáticamente por trigger
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'registro_membresias',
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

module.exports = RegistroMembresia;