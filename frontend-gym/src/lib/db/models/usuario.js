const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

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
  },
  // Campos para autenticación desde la futura app móvil de clientes.
  // No los usa (todavía) ningún endpoint del sistema web actual.
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  foto_perfil: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  ultimo_acceso: {
    type: DataTypes.DATE,
    allowNull: true
  },
  email_verificado: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
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
