-- 1. Tabla: daily_raw_materials
CREATE TABLE IF NOT EXISTS daily_raw_materials (
    date DATE PRIMARY KEY,
    nitrato_stock NUMERIC DEFAULT 0 NOT NULL,
    matriz_stock NUMERIC DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. Tabla: contract_kpis
CREATE TABLE IF NOT EXISTS contract_kpis (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    weight NUMERIC DEFAULT 0 NOT NULL,
    unit TEXT NOT NULL,
    periodicity TEXT NOT NULL,
    min_val TEXT NOT NULL,
    expected_val TEXT NOT NULL,
    max_val TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. Tabla: daily_quality_compliance
CREATE TABLE IF NOT EXISTS daily_quality_compliance (
    date DATE NOT NULL,
    kpi_id TEXT REFERENCES contract_kpis(id) ON DELETE CASCADE NOT NULL,
    compliance_pct NUMERIC DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    PRIMARY KEY (date, kpi_id)
);

-- 4. Tabla: contract_roles
CREATE TABLE IF NOT EXISTS contract_roles (
    role_name TEXT PRIMARY KEY,
    required_count INTEGER DEFAULT 1 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 5. Tabla: weekly_attendance
CREATE TABLE IF NOT EXISTS weekly_attendance (
    week_start_date DATE PRIMARY KEY, -- Miércoles
    attendance_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 6. Desactivar RLS (Row Level Security) para simplificar acceso público anónimo directo
ALTER TABLE daily_raw_materials DISABLE ROW LEVEL SECURITY;
ALTER TABLE contract_kpis DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_quality_compliance DISABLE ROW LEVEL SECURITY;
ALTER TABLE contract_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_attendance DISABLE ROW LEVEL SECURITY;

-- 7. Pre-sembrar KPIs de Contrato por Defecto
INSERT INTO contract_kpis (id, category, name, weight, unit, periodicity, min_val, expected_val, max_val) VALUES
-- Disponibilidad e Insumos
('kpi-camiones', 'disponibilidad', 'Disponibilidad de Camiones Fabrica', 10, '%', 'diario', '85%', '90%', '95%'),
('kpi-cargadores', 'disponibilidad', 'Disponibilidad de Cargador frontales (Tapapozos)', 8, '%', 'diario', '85%', '90%', '95%'),
('kpi-polvorines', 'disponibilidad', 'Disponibilidad de Polvorines Móviles', 8, '%', 'diario', '85%', '90%', '95%'),
('kpi-insumos', 'disponibilidad', 'Disponibilidad de Insumos', 5, 'ton', 'diario', '170', '200', '200'),
-- Calidad de Servicio
('kpi-innovacion', 'calidad', 'Eficiencia: Índice de innovación y pruebas', 5, 'informe', 'mensual', '85%', '90%', '95%'),
('kpi-costos', 'calidad', 'Eficiencia: Control de costos USD/ton-tron', 10, 'informe', 'semanal', '85%', '90%', '95%'),
('kpi-horario-tronadura', 'calidad', 'cumplimiento del horario de tronadura', 5, 'minutos', 'Diaria', '15 minutos de perdida', '0 minutos de perdida', 'Estar preparado antes de la hora'),
('kpi-programa-tronadura', 'calidad', 'cumplimiento de programa de tronadura', 3, '%', 'semanal', '<90%', '90%', '100%'),
('kpi-p80', 'calidad', 'cumplir con los parámetros de P80 según tipo de material', 3, 'pulgadas', 'mensual', '6', '5.5', '5'),
('kpi-criterios-danio', 'calidad', 'Cumplimiento de criterios de daño', 8, '%', 'mensual', '<80%', '80%', '90%'),
('kpi-tiros-quedados', 'calidad', 'Tiros quedados (TQ)', 3, 'unidad', 'mensual', '>0', '0', '0'),
('kpi-ptq', 'calidad', 'medir la cantidad de PTQ en base a benchmark de las minas de Chile', 3, 'unidad', 'mensual', '>4', '4', '3'),
('kpi-flyrock', 'calidad', 'impactos en equipos por flyrock', 3, 'unidad', 'mensual', '>0', '0', '0'),
('kpi-vod', 'calidad', 'Medición y cumplimiento de VOD en los productos', 3, 'unidad', 'mensual', '4', '6', '8'),
('kpi-gases', 'calidad', 'Control de gases nitrosos', 3, 'evento', 'mensual', '>1', '1', '1'),
-- Dotación
('kpi-dotacion-comprometida', 'dotacion', 'Asegurar la dotación comprometida para la operación normal de la flota', 10, '%', 'Semanal', '90% de la dotación', '95% de la dotación', '100% de la dotación')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    weight = EXCLUDED.weight,
    unit = EXCLUDED.unit,
    periodicity = EXCLUDED.periodicity,
    min_val = EXCLUDED.min_val,
    expected_val = EXCLUDED.expected_val,
    max_val = EXCLUDED.max_val;

-- 8. Pre-sembrar Cargos por Defecto
INSERT INTO contract_roles (role_name, required_count) VALUES
('Administrador', 1),
('Jefe de Operaciones', 1),
('Supervisor de tronadora', 1),
('Capataz de tronadura', 1),
('HSEC', 1),
('Chofer Operador Camion fabrica', 6),
('Chofer Operador Equipo Auxiliar', 3),
('Cargador de Tiros', 4),
('Encargado de Patio', 1),
('Tecnico en Mantenimiento', 2),
('Administrativo', 1),
('Ingeniero de tronadura', 1),
('Asistencia Tecnica', 1)
ON CONFLICT (role_name) DO NOTHING;
