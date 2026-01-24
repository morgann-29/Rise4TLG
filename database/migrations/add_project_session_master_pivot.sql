-- ============================================
-- Migration: Ajout table pivot project_session_master
-- ============================================
-- Permet d'associer des projets à des session_master
-- ============================================

-- ============================================
-- 1. Créer la table pivot
-- ============================================
CREATE TABLE IF NOT EXISTS project_session_master (
    project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    session_master_id UUID NOT NULL REFERENCES session_master(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (project_id, session_master_id)
);

-- Index pour recherche par session_master_id
CREATE INDEX IF NOT EXISTS idx_project_session_master_session_master_id
    ON project_session_master(session_master_id);

-- ============================================
-- 2. Activer RLS
-- ============================================
ALTER TABLE project_session_master ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. Policies RLS
-- ============================================

-- Admin: accès total
CREATE POLICY "Admin full access project_session_master" ON project_session_master
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profile p
            WHERE p.user_uid = auth.uid() AND p.type_profile_id = 1
        )
    );

-- Super Coach: lecture totale
CREATE POLICY "Super Coach read all project_session_master" ON project_session_master
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profile p
            WHERE p.user_uid = auth.uid() AND p.type_profile_id = 2
        )
    );

-- Coach: accès aux associations de ses groupes
CREATE POLICY "Coach access group project_session_master" ON project_session_master
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profile p
            JOIN group_profile gp ON gp.profile_id = p.id
            JOIN group_project gpj ON gpj.group_id = gp.group_id
            WHERE p.user_uid = auth.uid()
            AND p.type_profile_id = 3
            AND gpj.project_id = project_session_master.project_id
        )
    );

-- Navigant: lecture pour son propre projet
CREATE POLICY "Navigant read own project_session_master" ON project_session_master
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profile p
            JOIN project proj ON proj.profile_id = p.id
            WHERE p.user_uid = auth.uid()
            AND p.type_profile_id = 4
            AND proj.id = project_session_master.project_id
        )
    );

-- ============================================
-- FIN DE LA MIGRATION
-- ============================================
