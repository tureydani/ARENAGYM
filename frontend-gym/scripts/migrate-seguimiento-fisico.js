// Migración única e idempotente: agrega el módulo de Seguimiento físico con
// visión artificial (landmarks de pose + métricas geométricas + índice de
// evolución) sobre las tablas ya existentes `progresos`/`fotos_progreso`
// (creadas en add_app_tables.sql, hasta ahora sin usar). No se duplican
// entidades: `progresos` sigue siendo la "evaluación física" y
// `fotos_progreso` sigue siendo la foto asociada; solo se les agregan
// columnas nuevas, más dos tablas nuevas (pose_landmarks, metricas_fisicas)
// para los datos que antes no existían. Documentado en DB__Gimnasio.txt
// bajo la sección "MÓDULO SEGUIMIENTO FÍSICO CON VISIÓN ARTIFICIAL".
//
// Uso: node scripts/migrate-seguimiento-fisico.js

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
-- "progresos" pasa a representar la evaluación física completa: datos
-- antropométricos manuales (ya existían) + altura/objetivo (necesarios
-- para normalizar proporciones y para el flujo de "Nueva evaluación") +
-- el índice de evolución calculado a partir de las métricas de esta fila.
ALTER TABLE progresos
ADD COLUMN IF NOT EXISTS altura DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS objetivo VARCHAR(100),
ADD COLUMN IF NOT EXISTS indice_evolucion DECIMAL(5,2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_progresos_altura_positiva') THEN
    ALTER TABLE progresos ADD CONSTRAINT chk_progresos_altura_positiva CHECK (altura IS NULL OR altura > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_progresos_indice_rango') THEN
    ALTER TABLE progresos ADD CONSTRAINT chk_progresos_indice_rango CHECK (indice_evolucion IS NULL OR (indice_evolucion >= 0 AND indice_evolucion <= 100));
  END IF;
END $$;

-- "fotos_progreso" ya guardaba url_foto/tipo; se amplía con metadata de
-- calidad y análisis. url_foto se sigue usando, pero ahora contiene una
-- RUTA RELATIVA privada dentro del storage del servidor (no una URL
-- pública de Supabase, que nunca se llegó a usar) -- el comentario
-- original de la tabla ("el archivo real vive en Supabase Storage") ya no
-- aplica y queda reemplazado por este.
ALTER TABLE fotos_progreso
ADD COLUMN IF NOT EXISTS calidad VARCHAR(20),
ADD COLUMN IF NOT EXISTS confianza DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS ancho_px INT,
ADD COLUMN IF NOT EXISTS alto_px INT;

COMMENT ON COLUMN fotos_progreso.url_foto IS 'Ruta relativa privada del archivo dentro del storage local del servidor (ver src/lib/storage/seguimientoFisicoStorage.js). Nunca es una URL pública; las fotos se sirven solo mediante GET /api/cliente/progresos/:id/fotos/:fotoId con autenticación.';
COMMENT ON COLUMN fotos_progreso.calidad IS 'Resultado del control de calidad en el momento de la captura: ACEPTABLE o INSUFICIENTE. Informativo -- no bloquea el guardado.';
COMMENT ON COLUMN fotos_progreso.confianza IS 'Confianza media (0-1) de los landmarks detectados por ML Kit Pose Detection para esta fotografia.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fotos_progreso_tipo_check') THEN
    ALTER TABLE fotos_progreso DROP CONSTRAINT fotos_progreso_tipo_check;
  END IF;
  ALTER TABLE fotos_progreso ADD CONSTRAINT fotos_progreso_tipo_check CHECK (tipo IN ('frente', 'espalda', 'lateral', 'lateral_derecha'));
END $$;

-- Landmarks crudos de pose por fotografía. Se guardan TODOS (no solo la
-- métrica final) para poder recalcular características en el futuro sin
-- tener que repetir la captura ni el análisis de visión artificial.
CREATE TABLE IF NOT EXISTS pose_landmarks (
    id_landmark SERIAL PRIMARY KEY,
    id_foto INT NOT NULL REFERENCES fotos_progreso(id_foto) ON DELETE CASCADE,
    landmark_index INT NOT NULL,
    x DECIMAL(7,5) NOT NULL,
    y DECIMAL(7,5) NOT NULL,
    z DECIMAL(7,5),
    visibility DECIMAL(5,4),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pose_landmarks_foto ON pose_landmarks(id_foto);

COMMENT ON TABLE pose_landmarks IS 'Landmarks de pose (x,y,z,visibility) detectados localmente en el dispositivo por ML Kit Pose Detection para una fotografia de fotos_progreso. x/y normalizados 0-1 relativos al tamaño de imagen enviado por la app.';

-- Métricas geométricas/proporcionales calculadas a partir de los landmarks
-- de las fotos de UNA evaluación (progresos). Son estimaciones, nunca
-- mediciones clínicas -- ver indiceEvolucion.js para cómo se combinan con
-- medidas_manuales para el índice de evolución.
CREATE TABLE IF NOT EXISTS metricas_fisicas (
    id_metrica SERIAL PRIMARY KEY,
    id_progreso INT NOT NULL UNIQUE REFERENCES progresos(id_progreso) ON DELETE CASCADE,
    ancho_hombros_relativo DECIMAL(6,4),
    ancho_cadera_relativo DECIMAL(6,4),
    relacion_hombros_cadera DECIMAL(6,4),
    torso_relativo DECIMAL(6,4),
    brazo_relativo DECIMAL(6,4),
    pierna_relativa DECIMAL(6,4),
    simetria_hombros DECIMAL(6,4),
    simetria_cadera DECIMAL(6,4),
    simetria_brazos DECIMAL(6,4),
    simetria_piernas DECIMAL(6,4),
    inclinacion_hombros DECIMAL(6,3),
    inclinacion_cadera DECIMAL(6,3),
    alineacion_postural DECIMAL(6,4),
    angulo_rodillas DECIMAL(6,3),
    angulo_codos DECIMAL(6,3),
    confianza_media DECIMAL(5,4),
    landmarks_validos INT,
    porcentaje_cuerpo_detectado DECIMAL(5,2),
    calidad_analisis VARCHAR(20),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_metricas_fisicas_progreso ON metricas_fisicas(id_progreso);

COMMENT ON TABLE metricas_fisicas IS 'Características geométricas/proporcionales (estimaciones, no clínicas) calculadas a partir de pose_landmarks para una evaluación (progresos). Una fila por evaluación, combinando las fotos disponibles de esa evaluación.';
`;

async function main() {
  console.log('Conectando a la base de datos...');

  await sequelize.query(SQL);

  console.log('✓ progresos: columnas altura/objetivo/indice_evolucion agregadas (o ya existían).');
  console.log('✓ fotos_progreso: columnas calidad/confianza/ancho_px/alto_px agregadas; tipo admite lateral_derecha.');
  console.log('✓ Tabla pose_landmarks creada (o ya existía).');
  console.log('✓ Tabla metricas_fisicas creada (o ya existía).');

  await sequelize.close();
  console.log('\nListo.');
}

main().catch((error) => {
  console.error('Error al migrar seguimiento físico:', error);
  process.exit(1);
});
