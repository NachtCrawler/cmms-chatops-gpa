-- Crear la base de datos (por si acaso)
CREATE DATABASE IF NOT EXISTS cmms_chatops;
USE cmms_chatops;

-- 1. Tabla de Equipos (Pantógrafos CNC)
CREATE TABLE equipos (
    id_equipo INT AUTO_INCREMENT PRIMARY KEY,
    modelo VARCHAR(100) NOT NULL, -- Ej: Hypertherm XPR300, Bochu BLT
    tipo_corte ENUM('Plasma', 'Laser') NOT NULL,
    numero_serie VARCHAR(50) UNIQUE NOT NULL,
    cliente VARCHAR(150) NOT NULL
);

-- 2. Tabla de Usuarios (Técnicos, Operadores, Supervisores - Para el Whitelist)
CREATE TABLE usuarios (
    id_usuario BIGINT PRIMARY KEY, -- ID de Telegram
    nombre VARCHAR(100) NOT NULL,
    rol ENUM('Tecnico', 'Supervisor', 'Operador') NOT NULL,
    activo BOOLEAN DEFAULT TRUE -- Esto controla la Whitelist
);

-- 3. Tabla de Catálogo Yokoten (Conocimiento Estandarizado)
CREATE TABLE catalogo_yokoten (
    id_falla INT AUTO_INCREMENT PRIMARY KEY,
    codigo_alarma VARCHAR(50) NOT NULL,
    descripcion VARCHAR(255) NOT NULL,
    solucion_poka_yoke TEXT NOT NULL, -- Guía de diagnóstico rápido
    id_equipo INT,
    FOREIGN KEY (id_equipo) REFERENCES equipos(id_equipo)
);

-- 4. Tabla de Tickets (Órdenes de Trabajo - Aquí se calcula el MTTR y FTFR)
CREATE TABLE tickets (
    id_ticket INT AUTO_INCREMENT PRIMARY KEY,
    id_equipo INT NOT NULL,
    id_usuario_reporta BIGINT NOT NULL,
    id_tecnico_asignado BIGINT,
    fecha_apertura DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre DATETIME DEFAULT NULL, -- Para calcular MTTR: (cierre - apertura)
    estatus ENUM('Abierto', 'En Proceso', 'Cerrado', 'Cancelado') DEFAULT 'Abierto',
    diagnostico_bot TEXT,
    resolucion_primera_visita BOOLEAN DEFAULT NULL, -- Para calcular FTFR
    FOREIGN KEY (id_equipo) REFERENCES equipos(id_equipo),
    FOREIGN KEY (id_usuario_reporta) REFERENCES usuarios(id_usuario),
    FOREIGN KEY (id_tecnico_asignado) REFERENCES usuarios(id_usuario)
);

-- Insertar datos de prueba (Para que el bot no arranque vacío)
INSERT INTO equipos (modelo, tipo_corte, numero_serie, cliente) VALUES 
('Hypertherm XPR300', 'Plasma', 'SN-12345', 'Metales del Bajío'),
('Bochu BLT', 'Laser', 'SN-98765', 'Autopartes León');

INSERT INTO usuarios (id_usuario, nombre, rol) VALUES 
(123456789, 'Ing. Luis Picina', 'Supervisor'),
(987654321, 'Tecnico Juan', 'Tecnico');