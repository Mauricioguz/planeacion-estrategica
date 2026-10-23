-- ====================================================================
-- ESQUEMA DE BASE DE DATOS: FINCA LA LEONORA - PLANEACIÓN ESTRATÉGICA
-- Compatible con PostgreSQL 15+ en Neon Serverless
-- ====================================================================

-- 1. TABLA DE CONFIGURACIÓN GENERAL DE LA FINCA
CREATE TABLE IF NOT EXISTS pe_configuracion (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'config-default',
    farm_name VARCHAR(100) NOT NULL DEFAULT 'Finca La Leonora',
    tagline VARCHAR(200) DEFAULT 'Especialidad, Valor Agregado & Sostenibilidad',
    location VARCHAR(200) DEFAULT 'Cordillera Central, Colombia - 1.750 msnm',
    currency VARCHAR(10) DEFAULT 'COP',
    currency_symbol VARCHAR(5) DEFAULT '$',
    currency_unit_label VARCHAR(50) DEFAULT 'Millones COP',
    plan_period VARCHAR(50) DEFAULT '2026 - 2027',
    projection_months INTEGER DEFAULT 24,
    current_month_index INTEGER DEFAULT 9,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLA DE PILARES ESTRATÉGICOS
CREATE TABLE IF NOT EXISTS pe_pilares (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#f59e0b',
    icon VARCHAR(50) DEFAULT 'fa-bullseye',
    weight NUMERIC(5,2) DEFAULT 25.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA DE RESPONSABLES / EQUIPO DIRECTIVO Y OPERATIVO
CREATE TABLE IF NOT EXISTS pe_responsables (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    role VARCHAR(150) NOT NULL,
    avatar VARCHAR(10) DEFAULT 'NA',
    email VARCHAR(120),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABLA DE OBJETIVOS ESTRATÉGICOS & KPIS
CREATE TABLE IF NOT EXISTS pe_objetivos (
    id VARCHAR(50) PRIMARY KEY,
    pillar_id VARCHAR(50) REFERENCES pe_pilares(id) ON DELETE CASCADE,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(250) NOT NULL,
    kpi_name VARCHAR(150) NOT NULL,
    target_value NUMERIC(14,2) NOT NULL DEFAULT 0,
    current_value NUMERIC(14,2) NOT NULL DEFAULT 0,
    unit VARCHAR(30) DEFAULT '%',
    responsible_id VARCHAR(50) REFERENCES pe_responsables(id) ON DELETE SET NULL,
    deadline VARCHAR(50) DEFAULT 'Dic 2026',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABLA DE CRONOGRAMA & ACTIVIDADES ESTRATÉGICAS
CREATE TABLE IF NOT EXISTS pe_actividades (
    id VARCHAR(50) PRIMARY KEY,
    objective_id VARCHAR(50) REFERENCES pe_objetivos(id) ON DELETE CASCADE,
    code VARCHAR(30) NOT NULL UNIQUE,
    title VARCHAR(250) NOT NULL,
    description TEXT,
    deliverable TEXT,
    responsible_id VARCHAR(50) REFERENCES pe_responsables(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    budget NUMERIC(14,2) DEFAULT 0,
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    status VARCHAR(30) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'at_risk', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABLA MAESTRA DE RUBROS / LÍNEAS FINANCIERAS
CREATE TABLE IF NOT EXISTS pe_lineas_financieras (
    id VARCHAR(50) PRIMARY KEY,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('revenue', 'cogs', 'opex_admin', 'opex_sales', 'capex')),
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    is_ecommerce BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. TABLA DE PROYECCIONES FINANCIERAS MENSUALES (24 MESES)
CREATE TABLE IF NOT EXISTS pe_proyecciones_mensuales (
    id SERIAL PRIMARY KEY,
    linea_id VARCHAR(50) REFERENCES pe_lineas_financieras(id) ON DELETE CASCADE,
    mes_index INTEGER NOT NULL CHECK (mes_index >= 0 AND mes_index <= 35),
    mes_label VARCHAR(30) NOT NULL,
    valor_proyectado NUMERIC(14,2) DEFAULT 0,
    UNIQUE(linea_id, mes_index)
);

-- 8. TABLA DE DATOS REALES REGISTRADOS MENSUALMENTE
CREATE TABLE IF NOT EXISTS pe_reales_mensuales (
    id SERIAL PRIMARY KEY,
    linea_id VARCHAR(50) REFERENCES pe_lineas_financieras(id) ON DELETE CASCADE,
    mes_index INTEGER NOT NULL CHECK (mes_index >= 0 AND mes_index <= 35),
    valor_real NUMERIC(14,2),
    comentario TEXT,
    origen VARCHAR(50) DEFAULT 'manual', -- 'manual', 'sync_app_ventas', 'sync_app_pg'
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(linea_id, mes_index)
);

-- ====================================================================
-- VISTAS DE INTEGRACIÓN CON TUS OTRAS DOS APLICACIONES EN NEON
-- ====================================================================

-- Vista para consolidar Proyección vs. Real con cálculo automático de variaciones
CREATE OR REPLACE VIEW vw_pe_cruce_variaciones AS
SELECT 
    p.mes_index,
    p.mes_label,
    l.id AS linea_id,
    l.tipo,
    l.name AS rubro_nombre,
    l.category,
    l.is_ecommerce,
    COALESCE(p.valor_proyectado, 0) AS proyectado,
    r.valor_real AS real,
    (COALESCE(r.valor_real, p.valor_proyectado) - COALESCE(p.valor_proyectado, 0)) AS variacion_absoluta,
    CASE 
        WHEN COALESCE(p.valor_proyectado, 0) <> 0 
        THEN ROUND(((COALESCE(r.valor_real, p.valor_proyectado) - p.valor_proyectado) / p.valor_proyectado) * 100, 2)
        ELSE 0 
    END AS variacion_porcentual,
    r.comentario,
    r.origen
FROM pe_proyecciones_mensuales p
JOIN pe_lineas_financieras l ON p.linea_id = l.id
LEFT JOIN pe_reales_mensuales r ON p.linea_id = r.linea_id AND p.mes_index = r.mes_index
ORDER BY l.tipo, l.sort_order, p.mes_index;

-- Plantilla de procedimiento para sincronizar desde las tablas de ventas de café y P&G
-- (Puedes personalizar los nombres exactos de tus tablas de ventas o lotes existentes):
CREATE OR REPLACE PROCEDURE sp_pe_sincronizar_desde_apps_externas(p_mes_index INTEGER)
LANGUAGE plpgsql
AS $$
BEGIN
    -- 1. Sincronizar Ventas de Café Tostado por Lotes / Comercial si existe tabla de ventas
    -- Ejemplo:
    -- INSERT INTO pe_reales_mensuales (linea_id, mes_index, valor_real, origen, updated_at)
    -- SELECT 'rev-1', p_mes_index, SUM(total_venta)/1000000.0, 'sync_app_ventas', NOW()
    -- FROM ventas_cafe WHERE mes = p_mes_index
    -- ON CONFLICT (linea_id, mes_index) 
    -- DO UPDATE SET valor_real = EXCLUDED.valor_real, origen = 'sync_app_ventas', updated_at = NOW();

    RAISE NOTICE 'Sincronización completada para mes index %', p_mes_index;
END;
$$;

-- 8. TABLA DE USUARIOS Y CONTROL DE ACCESO
CREATE TABLE IF NOT EXISTS pe_usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt VARCHAR(64) NOT NULL,
    nombre_completo VARCHAR(120) NOT NULL,
    rol VARCHAR(30) DEFAULT 'admin',
    email VARCHAR(120),
    activo BOOLEAN DEFAULT TRUE,
    ultimo_ingreso TIMESTAMP WITH TIME ZONE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

