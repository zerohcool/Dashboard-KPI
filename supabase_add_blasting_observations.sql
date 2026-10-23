-- Script para agregar la columna de observaciones a la tabla blasting_times en Supabase
-- Ejecutar en el SQL Editor del dashboard de Supabase si se desea persistencia en la nube

ALTER TABLE blasting_times 
ADD COLUMN IF NOT EXISTS observations TEXT;

COMMENT ON COLUMN blasting_times.observations IS 'Observaciones sobre el horario de tronadura (cumplimiento, retrasos o alteraciones)';
