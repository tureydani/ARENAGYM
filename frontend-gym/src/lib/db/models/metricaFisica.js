const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

// Características geométricas/proporcionales (estimaciones, no clínicas)
// calculadas a partir de pose_landmarks para UNA evaluación (Progreso).
// Una fila por evaluación: combina las fotos disponibles de esa evaluación.
const MetricaFisica = sequelize.define('MetricaFisica', {
  id_metrica: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  id_progreso: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: 'progresos',
      key: 'id_progreso'
    }
  },
  ancho_hombros_relativo: DataTypes.DECIMAL(6, 4),
  ancho_cadera_relativo: DataTypes.DECIMAL(6, 4),
  relacion_hombros_cadera: DataTypes.DECIMAL(6, 4),
  torso_relativo: DataTypes.DECIMAL(6, 4),
  brazo_relativo: DataTypes.DECIMAL(6, 4),
  pierna_relativa: DataTypes.DECIMAL(6, 4),
  simetria_hombros: DataTypes.DECIMAL(6, 4),
  simetria_cadera: DataTypes.DECIMAL(6, 4),
  simetria_brazos: DataTypes.DECIMAL(6, 4),
  simetria_piernas: DataTypes.DECIMAL(6, 4),
  inclinacion_hombros: DataTypes.DECIMAL(6, 3),
  inclinacion_cadera: DataTypes.DECIMAL(6, 3),
  alineacion_postural: DataTypes.DECIMAL(6, 4),
  angulo_rodillas: DataTypes.DECIMAL(6, 3),
  angulo_codos: DataTypes.DECIMAL(6, 3),
  confianza_media: DataTypes.DECIMAL(5, 4),
  landmarks_validos: DataTypes.INTEGER,
  porcentaje_cuerpo_detectado: DataTypes.DECIMAL(5, 2),
  // 'ALTA' | 'MEDIA' | 'BAJA', derivada de confianza_media + landmarks_validos.
  calidad_analisis: DataTypes.STRING(20),
  // Versión de PoseAnalysisService.poseAlgorithmVersion con la que se calculó.
  algoritmo_version: DataTypes.STRING(20),
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'metricas_fisicas',
  timestamps: false,
});

module.exports = MetricaFisica;
