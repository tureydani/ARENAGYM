const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

// Landmark crudo de pose (x,y,z,visibility) de ML Kit Pose Detection para
// una fotografía. Se guardan los 33 puntos tal cual los entrega el
// análisis local en el dispositivo, para poder recalcular métricas en el
// futuro sin repetir la captura.
const PoseLandmark = sequelize.define('PoseLandmark', {
  id_landmark: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  id_foto: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'fotos_progreso',
      key: 'id_foto'
    }
  },
  landmark_index: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  x: {
    type: DataTypes.DECIMAL(7, 5),
    allowNull: false,
  },
  y: {
    type: DataTypes.DECIMAL(7, 5),
    allowNull: false,
  },
  z: {
    type: DataTypes.DECIMAL(7, 5),
    allowNull: true,
  },
  visibility: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'pose_landmarks',
  timestamps: false,
});

module.exports = PoseLandmark;
