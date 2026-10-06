-- ==========================================================
-- SOPORTE PARA EL AGENTE DE ATENCIÓN AL CLIENTE (CANAL TELEGRAM)
-- ==========================================================
-- No modifica columnas ni tablas existentes salvo agregar
-- usuarios.telegram_user_id (nullable). El resto son tablas nuevas
-- para vincular clientes con su chat de Telegram y guardar el
-- historial de conversación con el agente IA.

-- =============================
-- usuarios.telegram_user_id
-- =============================
-- Permite relacionar el chat_id/user_id que entrega la Telegram Bot
-- API con el cliente ya registrado en Arena Gym (vinculación por
-- teléfono durante el onboarding del bot).
ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_usuarios_telegram_user_id
    ON usuarios(telegram_user_id);

-- =============================
-- TABLA: Conversaciones
-- =============================
-- Una conversación agrupa el intercambio con un chat de Telegram.
-- id_usuario es NULL mientras el chat no se vincula a ningún
-- cliente (ej. alguien solo pregunta horarios sin identificarse).
CREATE TABLE IF NOT EXISTS conversaciones (
    id_conversacion SERIAL PRIMARY KEY,
    canal VARCHAR(20) NOT NULL DEFAULT 'telegram',
    chat_id BIGINT NOT NULL,
    id_usuario INT,
    estado VARCHAR(20) NOT NULL DEFAULT 'activa'
        CHECK (estado IN ('activa', 'esperando_humano', 'cerrada')),
    fecha_inicio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_ultimo_mensaje TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_conversacion_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
);
CREATE INDEX IF NOT EXISTS idx_conversaciones_chat ON conversaciones(canal, chat_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_estado ON conversaciones(estado);
CREATE INDEX IF NOT EXISTS idx_conversaciones_usuario ON conversaciones(id_usuario);

-- =============================
-- TABLA: Mensajes
-- =============================
-- Historial crudo de la conversación (usuario, agente y, si aplica,
-- el administrativo que atendió manualmente). Sirve de memoria para
-- el agente y como registro para análisis posterior (FAQs, derivaciones).
CREATE TABLE IF NOT EXISTS mensajes (
    id_mensaje SERIAL PRIMARY KEY,
    id_conversacion INT NOT NULL,
    emisor VARCHAR(10) NOT NULL CHECK (emisor IN ('cliente', 'agente', 'humano')),
    contenido TEXT NOT NULL,
    fecha_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mensaje_conversacion
        FOREIGN KEY (id_conversacion)
        REFERENCES conversaciones(id_conversacion)
        ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mensajes_conversacion ON mensajes(id_conversacion);
CREATE INDEX IF NOT EXISTS idx_mensajes_fecha ON mensajes(fecha_hora);
