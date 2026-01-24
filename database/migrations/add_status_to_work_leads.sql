-- ============================================
-- Migration: Ajustement status sur tables pivots work_lead
-- ============================================
-- - Suppression colonne status de work_lead et work_lead_master
-- - Ajout status enum (TODO, WORKING, DANGER, OK) sur tables pivots
--   Note: le statut NEW est derive (pas d'entree pivot = NEW)
-- - Ajout profile_id sur tables pivots pour audit
-- ============================================

-- ============================================
-- 1. Supprimer status de work_lead_master
-- ============================================
ALTER TABLE work_lead_master DROP COLUMN IF EXISTS status;
DROP INDEX IF EXISTS idx_work_lead_master_status;

-- ============================================
-- 2. Supprimer status de work_lead
-- ============================================
ALTER TABLE work_lead DROP COLUMN IF EXISTS status;
DROP INDEX IF EXISTS idx_work_lead_status;

-- ============================================
-- 3. Modifier session_work_lead
-- ============================================
-- Supprimer l'ancienne colonne status si elle existe avec l'ancien format
ALTER TABLE session_work_lead DROP COLUMN IF EXISTS status;

-- Ajouter la nouvelle colonne status (NOT NULL, pas de DEFAULT car on cree une entree = on doit specifier un status)
ALTER TABLE session_work_lead
    ADD COLUMN status TEXT NOT NULL
    CHECK (status IN ('TODO', 'WORKING', 'DANGER', 'OK'));

-- Ajouter profile_id pour audit (qui a cree/modifie)
ALTER TABLE session_work_lead
    ADD COLUMN profile_id UUID REFERENCES profile(id) ON DELETE SET NULL;

-- Index sur status
CREATE INDEX IF NOT EXISTS idx_session_work_lead_status ON session_work_lead(status);

-- Index sur profile_id
CREATE INDEX IF NOT EXISTS idx_session_work_lead_profile_id ON session_work_lead(profile_id);

-- ============================================
-- 4. Modifier session_master_work_lead_master
-- ============================================
-- Supprimer l'ancienne colonne status si elle existe avec l'ancien format
ALTER TABLE session_master_work_lead_master DROP COLUMN IF EXISTS status;

-- Ajouter la nouvelle colonne status (NOT NULL, pas de DEFAULT car on cree une entree = on doit specifier un status)
ALTER TABLE session_master_work_lead_master
    ADD COLUMN status TEXT NOT NULL
    CHECK (status IN ('TODO', 'WORKING', 'DANGER', 'OK'));

-- Ajouter profile_id pour audit (qui a cree/modifie)
ALTER TABLE session_master_work_lead_master
    ADD COLUMN profile_id UUID REFERENCES profile(id) ON DELETE SET NULL;

-- Index sur status
CREATE INDEX IF NOT EXISTS idx_session_master_work_lead_master_status ON session_master_work_lead_master(status);

-- Index sur profile_id
CREATE INDEX IF NOT EXISTS idx_session_master_work_lead_master_profile_id ON session_master_work_lead_master(profile_id);

-- ============================================
-- FIN DE LA MIGRATION
-- ============================================
