-- Esquema de Base de Datos - Finca La Leonora

-- Tabla de Lotes
CREATE TABLE IF NOT EXISTS lotes (
  id VARCHAR(50) PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  cultivo VARCHAR(100) NOT NULL,
  cultivo2 VARCHAR(100),
  area NUMERIC(5,2) NOT NULL,
  etapa VARCHAR(50) NOT NULL,
  fecha_siembra VARCHAR(20),
  fecha_siembra2 VARCHAR(20)
);

-- Tabla de Actividades
CREATE TABLE IF NOT EXISTS actividades (
  id VARCHAR(50) PRIMARY KEY,
  lote_id VARCHAR(50) REFERENCES lotes(id) ON DELETE CASCADE,
  cultivo_objetivo VARCHAR(100) NOT NULL,
  tipo VARCHAR(100) NOT NULL,
  producto_nombre VARCHAR(150),
  cantidad NUMERIC(10,2) DEFAULT 0,
  unidad VARCHAR(30),
  fecha VARCHAR(20) NOT NULL,
  personal VARCHAR(100) NOT NULL,
  etapa VARCHAR(50) NOT NULL,
  dosificacion VARCHAR(100),
  metodo VARCHAR(100),
  cumplida BOOLEAN DEFAULT FALSE,
  notas TEXT
);

-- Tabla de Estudios de Suelos
CREATE TABLE IF NOT EXISTS estudios_suelo (
  id VARCHAR(50) PRIMARY KEY,
  lote_id VARCHAR(50) REFERENCES lotes(id) ON DELETE CASCADE,
  titulo VARCHAR(150) NOT NULL,
  fecha VARCHAR(20) NOT NULL,
  notas TEXT,
  imagen_base64 TEXT NOT NULL
);

-- Tabla de Dosificaciones Históricas (Presets)
CREATE TABLE IF NOT EXISTS dosificaciones_historicas (
  producto VARCHAR(150) PRIMARY KEY,
  dosificacion VARCHAR(100) NOT NULL,
  metodo VARCHAR(100) NOT NULL
);

-- Tabla de Operarios / Personal
CREATE TABLE IF NOT EXISTS personal (
  nombre VARCHAR(100) PRIMARY KEY
);

-- Tabla de Clima
CREATE TABLE IF NOT EXISTS clima (
  id INT PRIMARY KEY DEFAULT 1,
  temporada VARCHAR(20) NOT NULL DEFAULT 'sequia',
  temperatura_promedio INT NOT NULL DEFAULT 28,
  humedad_promedio INT NOT NULL DEFAULT 60,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Inserción del estado de clima por defecto
INSERT INTO clima (id, temporada, temperatura_promedio, humedad_promedio) 
VALUES (1, 'sequia', 28, 60) 
ON CONFLICT (id) DO NOTHING;

-- Inserciones de personal inicial por defecto
INSERT INTO personal (nombre) VALUES ('Operario Principal') ON CONFLICT (nombre) DO NOTHING;
INSERT INTO personal (nombre) VALUES ('Agrónomo') ON CONFLICT (nombre) DO NOTHING;
