const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

// Una fotografía corporal asociada a una evaluación (Progreso). url_foto
// guarda una ruta relativa dentro del storage privado del servidor (ver
// src/lib/storage/seguimientoFisicoStorage.js), nunca una URL pública.
const FotoProgreso = sequelize.define('FotoProgreso', {
  id_foto: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  id_progreso: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'progresos',
      key: 'id_progreso'
    }
  },
  url_foto: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  tipo: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      isIn: [['frente', 'espalda', 'lateral', 'lateral_derecha']]
    }
  },
  fecha_subida: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  // 'ACEPTABLE' | 'INSUFICIENTE'. Informativo: el control de calidad no
  // bloquea el guardado, solo advierte al cliente antes de subir.
  calidad: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  confianza: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: true,
  },
  ancho_px: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  alto_px: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  // 'completo' | 'medioCuerpo' -- qué parte del cuerpo detectó la pose.
  encuadre: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  // 0-100, combina confianza/cobertura/alineación (ver PoseAnalysisService).
  quality_score: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  // 'EXCELENTE' | 'BUENA' | 'ACEPTABLE' | 'INSUFICIENTE'.
  calidad_captura: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
}, {
  tableName: 'fotos_progreso',
  timestamps: false,
});

module.exports = FotoProgreso;
