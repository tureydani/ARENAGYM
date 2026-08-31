-- ==========================================================
-- TABLAS NUEVAS PARA LA FUNCIONALIDAD DE LA APP MÓVIL DE CLIENTES
-- ==========================================================
-- No modifica ninguna tabla existente del sistema web (solo agrega
-- tablas nuevas, todas con FK hacia usuarios/administrativos ya
-- existentes). Ningún controller/endpoint actual las usa todavía.

-- =============================
-- TABLA: Asistencias
-- =============================
CREATE TABLE IF NOT EXISTS asistencias (
    id_asistencia SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    fecha_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_asistencia_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
);
CREATE INDEX IF NOT EXISTS idx_asistencias_usuario ON asistencias(id_usuario);
CREATE INDEX IF NOT EXISTS idx_asistencias_fecha ON asistencias(fecha_hora);

-- =============================
-- TABLA: Progresos (historial de mediciones físicas)
-- =============================
CREATE TABLE IF NOT EXISTS progresos (
    id_progreso SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    peso DECIMAL(5,2),
    porcentaje_grasa DECIMAL(5,2),
    pecho DECIMAL(5,2),
    cintura DECIMAL(5,2),
    brazo DECIMAL(5,2),
    pierna DECIMAL(5,2),
    cadera DECIMAL(5,2),
    observaciones TEXT,
    CONSTRAINT fk_progreso_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
);
CREATE INDEX IF NOT EXISTS idx_progresos_usuario ON progresos(id_usuario);
CREATE INDEX IF NOT EXISTS idx_progresos_fecha ON progresos(fecha);

-- =============================
-- TABLA: Fotos de progreso
-- =============================
-- Solo se guarda la URL; el archivo real vive en Supabase Storage.
CREATE TABLE IF NOT EXISTS fotos_progreso (
    id_foto SERIAL PRIMARY KEY,
    id_progreso INT NOT NULL,
    url_foto TEXT NOT NULL,
    tipo VARCHAR(20) CHECK (tipo IN ('frente', 'espalda', 'lateral')),
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_foto_progreso
        FOREIGN KEY (id_progreso)
        REFERENCES progresos(id_progreso)
        ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fotos_progreso_progreso ON fotos_progreso(id_progreso);

-- =============================
-- TABLA: Notificaciones
-- =============================
CREATE TABLE IF NOT EXISTS notificaciones (
    id_notificacion SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    mensaje TEXT NOT NULL,
    tipo VARCHAR(50),
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notificacion_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(id_usuario);
CREATE INDEX IF NOT EXISTS idx_notificaciones_leida ON notificaciones(leida);

-- =============================
-- TABLA: Metas
-- =============================
CREATE TABLE IF NOT EXISTS metas (
    id_meta SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    tipo_meta VARCHAR(50) NOT NULL,
    valor_inicial DECIMAL(10,2),
    valor_objetivo DECIMAL(10,2),
    valor_actual DECIMAL(10,2),
    fecha_inicio DATE DEFAULT CURRENT_DATE,
    fecha_objetivo DATE,
    estado VARCHAR(20) NOT NULL DEFAULT 'activa'
        CHECK (estado IN ('activa', 'cumplida', 'cancelada')),
    descripcion TEXT,
    CONSTRAINT fk_meta_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
);
CREATE INDEX IF NOT EXISTS idx_metas_usuario ON metas(id_usuario);
CREATE INDEX IF NOT EXISTS idx_metas_estado ON metas(estado);

-- =============================
-- TABLAS: Rutinas de entrenamiento
-- =============================

-- Catálogo de ejercicios, reutilizable entre rutinas
CREATE TABLE IF NOT EXISTS ejercicios (
    id_ejercicio SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    grupo_muscular VARCHAR(50),
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_ejercicios_activo ON ejercicios(activo);

-- Rutina asignada a un cliente
CREATE TABLE IF NOT EXISTS rutinas (
    id_rutina SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_admin INT,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    fecha_creacion DATE NOT NULL DEFAULT CURRENT_DATE,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_rutina_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario),
    CONSTRAINT fk_rutina_admin
        FOREIGN KEY (id_admin)
        REFERENCES administrativos(id_admin)
);
CREATE INDEX IF NOT EXISTS idx_rutinas_usuario ON rutinas(id_usuario);
CREATE INDEX IF NOT EXISTS idx_rutinas_activa ON rutinas(activa);

-- Ejercicios que componen cada rutina, organizados por día de la semana
CREATE TABLE IF NOT EXISTS rutina_ejercicios (
    id_rutina_ejercicio SERIAL PRIMARY KEY,
    id_rutina INT NOT NULL,
    id_ejercicio INT NOT NULL,
    dia_semana VARCHAR(15) NOT NULL
        CHECK (dia_semana IN ('Lunes','Martes','Miercoles','Jueves','Viernes','Sabado','Domingo')),
    series INT NOT NULL,
    repeticiones VARCHAR(20) NOT NULL, -- ej. "10" o "8-12"
    orden INT NOT NULL DEFAULT 1,
    CONSTRAINT fk_rutina_ejercicio_rutina
        FOREIGN KEY (id_rutina)
        REFERENCES rutinas(id_rutina)
        ON DELETE CASCADE,
    CONSTRAINT fk_rutina_ejercicio_ejercicio
        FOREIGN KEY (id_ejercicio)
        REFERENCES ejercicios(id_ejercicio)
);
CREATE INDEX IF NOT EXISTS idx_rutina_ejercicios_rutina ON rutina_ejercicios(id_rutina);
CREATE INDEX IF NOT EXISTS idx_rutina_ejercicios_dia ON rutina_ejercicios(dia_semana);
