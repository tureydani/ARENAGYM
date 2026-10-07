// Migración incremental v2 del módulo de Seguimiento físico: agrega el
// encuadre (completo/medioCuerpo) y el puntaje de calidad por fotografía, y
// la versión del algoritmo de métricas por evaluación. No reemplaza
// columnas existentes (calidad/confianza de fotos_progreso se mantienen
// igual, por compatibilidad con evaluaciones ya guardadas) -- ver
// scripts/migrate-seguimiento-fisico.js para la migración v1.
//
// Uso: node scripts/migrate-seguimiento-fisico-v2.js

const fs = require('fs');
const path = require('path');

function cargarEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const contenido = fs.readFileSync(envPath, 'utf-8');
  for (const linea of contenido.split('\n')) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const idx = limpia.indexOf('=');
    if (idx === -1) continue;
    const clave = limpia.slice(0, idx).trim();
    const valor = limpia.slice(idx + 1).trim();
    if (!(clave in process.env)) process.env[clave] = valor;
  }
}
cargarEnvLocal();

const sequelize = require('../src/lib/db/sequelize');

const SQL = `
-- Qué parte del cuerpo logró cubrir la fotografía: 'completo' o
-- 'medioCuerpo' (ver TipoEncuadre en pose_analysis_service.dart). Null para
-- fotos subidas antes de esta migración (no se puede reconstruir).
ALTER TABLE fotos_progreso
ADD COLUMN IF NOT EXISTS encuadre VARCHAR(20),
ADD COLUMN IF NOT EXISTS quality_score INT,
ADD COLUMN IF NOT EXISTS calidad_captura VARCHAR(20);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fotos_progreso_encuadre') THEN
    ALTER TABLE fotos_progreso ADD CONSTRAINT chk_fotos_progreso_encuadre
      CHECK (encuadre IS NULL OR encuadre IN ('completo', 'medioCuerpo'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fotos_progreso_quality_score') THEN
    ALTER TABLE fotos_progreso ADD CONSTRAINT chk_fotos_progreso_quality_score
      CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100));
  END IF;
END $$;

COMMENT ON COLUMN fotos_progreso.encuadre IS 'completo | medioCuerpo -- qué parte del cuerpo detectó la pose en esta foto.';
COMMENT ON COLUMN fotos_progreso.quality_score IS 'Puntaje de calidad de captura (0-100), combina confianza/cobertura/alineación. Ver PoseAnalysisService.analizarFoto.';
COMMENT ON COLUMN fotos_progreso.calidad_captura IS 'EXCELENTE | BUENA | ACEPTABLE | INSUFICIENTE, categoría legible de quality_score.';

-- Versión del algoritmo de cálculo de métricas con la que se generó esta
-- fila, para poder distinguir evaluaciones calculadas con una fórmula
-- distinta si en el futuro se ajustan las métricas.
ALTER TABLE metricas_fisicas
ADD COLUMN IF NOT EXISTS algoritmo_version VARCHAR(20);

COMMENT ON COLUMN metricas_fisicas.algoritmo_version IS 'Versión de PoseAnalysisService.poseAlgorithmVersion con la que se calcularon estas métricas.';
`;

async function main() {
  console.log('Conectando a la base de datos...');

  await sequelize.query(SQL);

  console.log('✓ fotos_progreso: columnas encuadre/quality_score/calidad_captura agregadas (o ya existían).');
  console.log('✓ metricas_fisicas: columna algoritmo_version agregada (o ya existía).');

  await sequelize.close();
  console.log('\nListo.');
}

main().catch((error) => {
  console.error('Error al migrar seguimiento físico v2:', error);
  process.exit(1);
});
