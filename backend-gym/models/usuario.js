const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Usuario = sequelize.define('Usuario', {
  id_usuario: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre: { 
    type: DataTypes.STRING(100), 
    allowNull: false 
  },
  apellido: { 
    type: DataTypes.STRING(100), 
    allowNull: false 
  },
  fecha_nacimiento: { 
    type: DataTypes.DATEONLY, 
    allowNull: true 
  },
  telefono: { 
    type: DataTypes.STRING(20), 
    allowNull: true 
  },
  email: { 
    type: DataTypes.STRING(100), 
    unique: true, 
    allowNull: true 
  },
  fecha_registro: { 
    type: DataTypes.DATEONLY, 
    allowNull: false, 
    defaultValue: DataTypes.NOW 
  },
  registrado_por: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { 
      model: 'administrativos', 
      key: 'id_admin' 
    }
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'usuarios',
  timestamps: false,
  defaultScope: {
    where: {
      activo: true
    }
  },
  scopes: {
    withInactive: {
      where: {}
    },
    onlyInactive: {
      where: {
        activo: false
      }
    }
  }
});

module.exports = Usuario;