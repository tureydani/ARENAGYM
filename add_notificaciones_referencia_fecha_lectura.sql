-- ==========================================================
-- Columnas de preparación para el sistema completo de notificaciones
-- ==========================================================
-- referencia_id: para vincular una notificación con la fila que la originó
-- (una asistencia, un pago, un registro de membresía, un progreso, etc.),
-- según lo que indique la columna "tipo". No lleva FK propia porque puede
-- apuntar a distintas tablas según el tipo.
-- fecha_lectura: cuándo se marcó como leída (además del booleano "leida"),
-- útil para métricas de qué tan rápido el cliente ve sus notificaciones.

ALTER TABLE notificaciones
ADD COLUMN IF NOT EXISTS referencia_id INT,
ADD COLUMN IF NOT EXISTS fecha_lectura TIMESTAMP;

COMMENT ON COLUMN notificaciones.referencia_id IS 'ID de la fila que originó la notificación (asistencia, pago, registro_membresia, progreso, etc. segun "tipo"). Sin FK fija porque la tabla referenciada varía.';
COMMENT ON COLUMN notificaciones.fecha_lectura IS 'Fecha y hora en que el cliente marcó la notificación como leída.';
