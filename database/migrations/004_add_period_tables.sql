-- ============================================
-- Migration: Add Period Tables
-- Date: 2026-01-28
-- Description: Add period_master and period tables for training periods
-- ============================================

-- ============================================
-- PERIOD MASTER (periode de groupe)
-- ============================================
CREATE TABLE IF NOT EXISTS period_master (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    profile_id UUID NOT NULL REFERENCES profile(id) ON DELETE RESTRICT,
    -- coach createur
    group_id UUID NOT NULL REFERENCES "group"(id) ON DELETE CASCADE,
    date_start TIMESTAMP WITH TIME ZONE NOT NULL,
    date_end TIMESTAMP WITH TIME ZONE NOT NULL,
    content TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_period_master_profile_id ON period_master(profile_id);
CREATE INDEX idx_period_master_group_id ON period_master(group_id);
CREATE INDEX idx_period_master_date_start ON period_master(date_start);
CREATE INDEX idx_period_master_date_end ON period_master(date_end);
CREATE INDEX idx_period_master_is_deleted ON period_master(is_deleted)
WHERE is_deleted = FALSE;

CREATE TRIGGER update_period_master_updated_at BEFORE
UPDATE ON period_master FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PERIOD (periode individuelle, liee a un projet)
-- ============================================
CREATE TABLE IF NOT EXISTS period (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    period_master_id UUID REFERENCES period_master(id) ON DELETE SET NULL,
    date_start TIMESTAMP WITH TIME ZONE NOT NULL,
    date_end TIMESTAMP WITH TIME ZONE NOT NULL,
    content TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_period_project_id ON period(project_id);
CREATE INDEX idx_period_period_master_id ON period(period_master_id);
CREATE INDEX idx_period_date_start ON period(date_start);
CREATE INDEX idx_period_date_end ON period(date_end);
CREATE INDEX idx_period_is_deleted ON period(is_deleted)
WHERE is_deleted = FALSE;

CREATE TRIGGER update_period_updated_at BEFORE
UPDATE ON period FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- UPDATE FILES CHECK CONSTRAINT
-- ============================================
-- Drop existing constraint and recreate with new entity types
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_origin_entity_type_check;
ALTER TABLE files ADD CONSTRAINT files_origin_entity_type_check CHECK (
    origin_entity_type IN (
        'project',
        'group',
        'session',
        'session_master',
        'work_lead',
        'work_lead_master',
        'profile',
        'period',
        'period_master'
    )
);

ALTER TABLE files_reference DROP CONSTRAINT IF EXISTS files_reference_entity_type_check;
ALTER TABLE files_reference ADD CONSTRAINT files_reference_entity_type_check CHECK (
    entity_type IN (
        'project',
        'group',
        'session',
        'session_master',
        'work_lead',
        'work_lead_master',
        'profile',
        'period',
        'period_master'
    )
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE period_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE period ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES - PERIOD MASTER
-- ============================================
-- Admin: acces total
CREATE POLICY "Admin full access period_master" ON period_master FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM profile p
        WHERE p.user_uid = auth.uid()
            AND p.type_profile_id = 1
    )
);

-- Super Coach: lecture totale
CREATE POLICY "Super Coach read all period_master" ON period_master FOR
SELECT TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM profile p
        WHERE p.user_uid = auth.uid()
            AND p.type_profile_id = 2
    )
    AND is_deleted = FALSE
);

-- Coach: acces aux period_master de ses groupes
CREATE POLICY "Coach access group period_master" ON period_master FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM profile p
            JOIN group_profile gp ON gp.profile_id = p.id
        WHERE p.user_uid = auth.uid()
            AND p.type_profile_id = 3
            AND gp.group_id = period_master.group_id
    )
    AND is_deleted = FALSE
);

-- Navigant: lecture des period_master liees a ses periods
CREATE POLICY "Navigant read linked period_master" ON period_master FOR
SELECT TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM profile p
            JOIN project proj ON proj.profile_id = p.id
            JOIN period per ON per.project_id = proj.id
        WHERE p.user_uid = auth.uid()
            AND p.type_profile_id = 4
            AND per.period_master_id = period_master.id
    )
    AND is_deleted = FALSE
);

-- ============================================
-- RLS POLICIES - PERIOD
-- ============================================
-- Admin: acces total
CREATE POLICY "Admin full access period" ON period FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM profile p
        WHERE p.user_uid = auth.uid()
            AND p.type_profile_id = 1
    )
);

-- Super Coach: lecture totale
CREATE POLICY "Super Coach read all periods" ON period FOR
SELECT TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM profile p
        WHERE p.user_uid = auth.uid()
            AND p.type_profile_id = 2
    )
    AND is_deleted = FALSE
);

-- Coach: acces aux periods des projets de ses groupes
CREATE POLICY "Coach access group periods" ON period FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM profile p
            JOIN group_profile gp ON gp.profile_id = p.id
            JOIN group_project gpj ON gpj.group_id = gp.group_id
        WHERE p.user_uid = auth.uid()
            AND p.type_profile_id = 3
            AND gpj.project_id = period.project_id
    )
    AND is_deleted = FALSE
);

-- Navigant: acces a ses propres periods
CREATE POLICY "Navigant access own periods" ON period FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM profile p
            JOIN project proj ON proj.profile_id = p.id
        WHERE p.user_uid = auth.uid()
            AND p.type_profile_id = 4
            AND proj.id = period.project_id
    )
    AND is_deleted = FALSE
);

-- ============================================
-- END OF MIGRATION
-- ============================================
