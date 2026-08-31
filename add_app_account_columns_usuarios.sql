-- ==========================================================
-- Columnas de cuenta/app para la tabla usuarios (clientes)
-- ==========================================================
-- Prepara la tabla para que los clientes puedan autenticarse desde una
-- futura app móvil, sin afectar el sistema web actual: todas las columnas
-- son nuevas, nullable o con default, y ningún código existente las lee
-- ni las escribe todavía.

ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS foto_perfil TEXT,
ADD COLUMN IF NOT EXISTS ultimo_acceso TIMESTAMP,
ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN usuarios.password_hash IS 'Hash de contraseña para login desde la app móvil (bcrypt/argon2). NULL mientras el usuario no se haya registrado en la app.';
COMMENT ON COLUMN usuarios.foto_perfil IS 'URL o referencia a la foto de perfil del usuario en la app.';
COMMENT ON COLUMN usuarios.ultimo_acceso IS 'Fecha y hora del último login desde la app.';
COMMENT ON COLUMN usuarios.email_verificado IS 'TRUE si el usuario verificó su email en la app.';
