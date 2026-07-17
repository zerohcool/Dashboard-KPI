-- 1. Tabla: period_compliance
CREATE TABLE IF NOT EXISTS period_compliance (
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    kpi_id TEXT NOT NULL,
    real_value NUMERIC DEFAULT 0 NOT NULL,
    compliance_pct NUMERIC DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    PRIMARY KEY (start_date, end_date, kpi_id)
);

-- Desactivar RLS
ALTER TABLE period_compliance DISABLE ROW LEVEL SECURITY;

-- 2. Insertar KPIs de Seguridad en contract_kpis
-- La categoría completa pesa 10%.
-- Multiplicamos el peso interno (40%, 30%, 10%, 10%, 10%) por el 10% de la categoría para obtener el peso final en el contrato.
INSERT INTO contract_kpis (id, category, name, weight, unit, periodicity, min_val, expected_val, max_val) VALUES
('kpi-seg-trirf', 'seguridad', 'Incidentes que afectan al TRIRF', 4, 'incidentes', 'mensual', '2', '0', '0'),
('kpi-seg-notrirf', 'seguridad', 'Incidentes que no afectan al TRIRF', 3, 'incidentes', 'mensual', '3', '0', '0'),
('kpi-seg-legal', 'seguridad', 'Cumplimiento legal (fiscalizaciones estatales)', 1, 'incidentes', 'mensual', '3', '0', '0'),
('kpi-seg-auditorias', 'seguridad', 'Auditorias Internas', 1, 'audit_score', 'mensual', '25%', '90%', '100%'),
('kpi-seg-incumplimiento', 'seguridad', 'Incumplimiento de temas generales SSMA', 1, 'incidentes', 'mensual', '4', '0', '0')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    weight = EXCLUDED.weight,
    unit = EXCLUDED.unit,
    periodicity = EXCLUDED.periodicity,
    min_val = EXCLUDED.min_val,
    expected_val = EXCLUDED.expected_val,
    max_val = EXCLUDED.max_val;

-- 3. Limpiar y re-sembrar cargos con su turno explícito en el nombre
DELETE FROM contract_roles;
INSERT INTO contract_roles (role_name, required_count) VALUES
('Administrador (4x3)', 1),
('HSEC (4x3)', 1),
('Asistencia Tecnica (4x3)', 1),
('Ingeniero de tronadura (4x3)', 1),
('Jefe de Operaciones (7x7)', 2),
('Supervisor de tronadura (7x7)', 2),
('Capataz de tronadura (7x7)', 2),
('HSEC (7x7)', 2),
('Chofer Operador Camion fabrica (7x7)', 12),
('Chofer Operador Equipo Auxiliar (7x7)', 6),
('Cargador de Tiros (7x7)', 8),
('Encargado de Patio (7x7)', 2),
('Tecnico en Mantenimiento (7x7)', 4),
('Administrativo (7x7)', 2),
('Ingeniero de tronadura (7x7)', 2),
('Asistencia Tecnica (7x7)', 2);
