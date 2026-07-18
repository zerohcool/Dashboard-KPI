-- Alter table contract_roles to add affects_kpi column (Phase 19)
ALTER TABLE contract_roles ADD COLUMN IF NOT EXISTS affects_kpi BOOLEAN DEFAULT true;
