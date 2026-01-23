-- ============================================
-- Rise4TLG Database Schema
-- ============================================
-- Generated: 2026-01-22
-- PostgreSQL / Supabase compatible
-- ============================================

-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- HELPER: Trigger function for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MIGRATION: profile vers UUID (si existante en INT)
-- À exécuter AVANT le reste si profile existe déjà
-- ============================================
/*
-- 1. Ajouter nouvelle colonne UUID
ALTER TABLE profile ADD COLUMN new_id UUID DEFAULT uuid_generate_v4();

-- 2. Mettre à jour les références (aucune autre table pour l'instant)

-- 3. Supprimer l'ancienne PK et renommer
ALTER TABLE profile DROP CONSTRAINT profile_pkey;
ALTER TABLE profile DROP COLUMN id;
ALTER TABLE profile RENAME COLUMN new_id TO id;
ALTER TABLE profile ADD PRIMARY KEY (id);
*/

-- ============================================
-- TABLES DE RÉFÉRENCE (INTEGER IDs)
-- ============================================

-- Type de profil
CREATE TABLE IF NOT EXISTS type_profile (
    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_type_profile_updated_at
    BEFORE UPDATE ON type_profile
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Données initiales type_profile
INSERT INTO type_profile (name) VALUES
    ('Admin'),
    ('Super Coach'),
    ('Coach'),
    ('Navigant')
ON CONFLICT (name) DO NOTHING;

-- Type de support (ex: voile légère, habitable, etc.)
CREATE TABLE IF NOT EXISTS type_support (
    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_type_support_updated_at
    BEFORE UPDATE ON type_support
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Type de séance (ex: entrainement, régate, convoyage, etc.)
CREATE TABLE IF NOT EXISTS type_seance (
    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name TEXT NOT NULL UNIQUE,
    is_sailing BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_type_seance_updated_at
    BEFORE UPDATE ON type_seance
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PROFIL UTILISATEUR (UUID)
-- ============================================

CREATE TABLE IF NOT EXISTS profile (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_uid UUID NOT NULL,  -- référence vers auth.users (un user peut avoir plusieurs profils)
    type_profile_id INTEGER NOT NULL REFERENCES type_profile(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_uid, type_profile_id)  -- un user ne peut pas avoir 2x le même type de profil
);

CREATE INDEX idx_profile_user_uid ON profile(user_uid);
CREATE INDEX idx_profile_type_profile_id ON profile(type_profile_id);

CREATE TRIGGER update_profile_updated_at
    BEFORE UPDATE ON profile
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STRUCTURE & ORGANISATION
-- ============================================

-- Projet (appartient à un Coach)
CREATE TABLE IF NOT EXISTS project (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    profile_id UUID NOT NULL REFERENCES profile(id) ON DELETE RESTRICT,
    type_support_id INTEGER NOT NULL REFERENCES type_support(id) ON DELETE RESTRICT,
    location JSONB,  -- {lat, lng, address}
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_project_profile_id ON project(profile_id);
CREATE INDEX idx_project_type_support_id ON project(type_support_id);
CREATE INDEX idx_project_is_deleted ON project(is_deleted) WHERE is_deleted = FALSE;

CREATE TRIGGER update_project_updated_at
    BEFORE UPDATE ON project
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Vérifier que profile_id est un Navigant (type_profile_id = 4)
CREATE OR REPLACE FUNCTION check_project_owner_is_navigant()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM profile p
        WHERE p.id = NEW.profile_id AND p.type_profile_id = 4  -- Navigant
    ) THEN
        RAISE EXCEPTION 'Le propriétaire du projet doit être un Navigant (type_profile_id = 4)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_project_owner_is_navigant
    BEFORE INSERT OR UPDATE OF profile_id ON project
    FOR EACH ROW
    EXECUTE FUNCTION check_project_owner_is_navigant();

-- Groupe
CREATE TABLE IF NOT EXISTS "group" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type_support_id INTEGER REFERENCES type_support(id) ON DELETE SET NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_group_type_support_id ON "group"(type_support_id);
CREATE INDEX idx_group_is_deleted ON "group"(is_deleted) WHERE is_deleted = FALSE;

CREATE TRIGGER update_group_updated_at
    BEFORE UPDATE ON "group"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Pivot: Groupe <-> Profile (Super Coach affectés au groupe)
CREATE TABLE IF NOT EXISTS group_profile (
    group_id UUID NOT NULL REFERENCES "group"(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (group_id, profile_id)
);

CREATE INDEX idx_group_profile_profile_id ON group_profile(profile_id);

-- Pivot: Groupe <-> Projet
CREATE TABLE IF NOT EXISTS group_project (
    group_id UUID NOT NULL REFERENCES "group"(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (group_id, project_id)
);

CREATE INDEX idx_group_project_project_id ON group_project(project_id);

-- ============================================
-- SESSIONS
-- ============================================

-- Session Master (session de groupe, créée par un Coach/Super Coach)
-- profile_id = NULL et group_id = NULL pour les modèles/templates
CREATE TABLE IF NOT EXISTS session_master (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    profile_id UUID REFERENCES profile(id) ON DELETE RESTRICT,  -- créateur (nullable pour templates)
    group_id UUID REFERENCES "group"(id) ON DELETE RESTRICT,  -- nullable pour sessions hors groupe ou templates
    type_seance_id INTEGER NOT NULL REFERENCES type_seance(id) ON DELETE RESTRICT,
    coach_id UUID REFERENCES profile(id) ON DELETE SET NULL,  -- coach présent (peut être différent du créateur)
    date_start TIMESTAMP WITH TIME ZONE,  -- nullable pour séances "template"
    date_end TIMESTAMP WITH TIME ZONE,
    location JSONB,
    content TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_session_master_profile_id ON session_master(profile_id);
CREATE INDEX idx_session_master_group_id ON session_master(group_id);
CREATE INDEX idx_session_master_type_seance_id ON session_master(type_seance_id);
CREATE INDEX idx_session_master_coach_id ON session_master(coach_id);
CREATE INDEX idx_session_master_date_start ON session_master(date_start);
CREATE INDEX idx_session_master_is_deleted ON session_master(is_deleted) WHERE is_deleted = FALSE;

CREATE TRIGGER update_session_master_updated_at
    BEFORE UPDATE ON session_master
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Vérifier que coach_id est un Coach (type_profile_id = 3)
CREATE OR REPLACE FUNCTION check_session_master_coach_is_coach()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.coach_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM profile p
        WHERE p.id = NEW.coach_id AND p.type_profile_id = 3  -- Coach
    ) THEN
        RAISE EXCEPTION 'Le coach de la session doit être un Coach (type_profile_id = 3)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_session_master_coach
    BEFORE INSERT OR UPDATE OF coach_id ON session_master
    FOR EACH ROW
    EXECUTE FUNCTION check_session_master_coach_is_coach();

-- Session (session individuelle, liée à un projet)
CREATE TABLE IF NOT EXISTS session (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    session_master_id UUID REFERENCES session_master(id) ON DELETE SET NULL,
    type_seance_id INTEGER NOT NULL REFERENCES type_seance(id) ON DELETE RESTRICT,
    date_start TIMESTAMP WITH TIME ZONE,  -- nullable pour séances "template"
    date_end TIMESTAMP WITH TIME ZONE,
    location JSONB,
    content TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_session_project_id ON session(project_id);
CREATE INDEX idx_session_session_master_id ON session(session_master_id);
CREATE INDEX idx_session_type_seance_id ON session(type_seance_id);
CREATE INDEX idx_session_date_start ON session(date_start);
CREATE INDEX idx_session_is_deleted ON session(is_deleted) WHERE is_deleted = FALSE;

CREATE TRIGGER update_session_updated_at
    BEFORE UPDATE ON session
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Pivot: Session Master <-> Profile (équipage au niveau master)
CREATE TABLE IF NOT EXISTS session_master_profile (
    session_master_id UUID NOT NULL REFERENCES session_master(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (session_master_id, profile_id)
);

CREATE INDEX idx_session_master_profile_profile_id ON session_master_profile(profile_id);

-- Pivot: Session <-> Profile (équipage à bord)
CREATE TABLE IF NOT EXISTS session_profile (
    session_id UUID NOT NULL REFERENCES session(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (session_id, profile_id)
);

CREATE INDEX idx_session_profile_profile_id ON session_profile(profile_id);

-- ============================================
-- WORK LEADS (Axes de travail)
-- ============================================

-- Type d'axe de travail
CREATE TABLE IF NOT EXISTS work_lead_type (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    project_id UUID REFERENCES project(id) ON DELETE CASCADE,  -- nullable = type global
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_work_lead_type_project_id ON work_lead_type(project_id);
CREATE INDEX idx_work_lead_type_is_deleted ON work_lead_type(is_deleted) WHERE is_deleted = FALSE;

CREATE TRIGGER update_work_lead_type_updated_at
    BEFORE UPDATE ON work_lead_type
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Work Lead Master (axe de travail au niveau groupe, ou template si group_id NULL)
CREATE TABLE IF NOT EXISTS work_lead_master (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES "group"(id) ON DELETE CASCADE,  -- nullable = template/base
    work_lead_type_id UUID NOT NULL REFERENCES work_lead_type(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    content TEXT,
    status TEXT CHECK (status IN ('TODO', 'WORKING', 'DANGER', 'OK')),  -- nullable enum
    is_archived BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_work_lead_master_group_id ON work_lead_master(group_id);
CREATE INDEX idx_work_lead_master_work_lead_type_id ON work_lead_master(work_lead_type_id);
CREATE INDEX idx_work_lead_master_is_deleted ON work_lead_master(is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX idx_work_lead_master_status ON work_lead_master(status) WHERE status IS NOT NULL;

CREATE TRIGGER update_work_lead_master_updated_at
    BEFORE UPDATE ON work_lead_master
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Work Lead (axe de travail au niveau projet)
CREATE TABLE IF NOT EXISTS work_lead (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    work_lead_master_id UUID REFERENCES work_lead_master(id) ON DELETE SET NULL,
    work_lead_type_id UUID NOT NULL REFERENCES work_lead_type(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    content TEXT,
    status TEXT CHECK (status IN ('TODO', 'WORKING', 'DANGER', 'OK')),  -- nullable enum
    is_archived BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_work_lead_project_id ON work_lead(project_id);
CREATE INDEX idx_work_lead_work_lead_master_id ON work_lead(work_lead_master_id);
CREATE INDEX idx_work_lead_work_lead_type_id ON work_lead(work_lead_type_id);
CREATE INDEX idx_work_lead_is_deleted ON work_lead(is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX idx_work_lead_status ON work_lead(status) WHERE status IS NOT NULL;

CREATE TRIGGER update_work_lead_updated_at
    BEFORE UPDATE ON work_lead
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Pivot: Session <-> Work Lead
CREATE TABLE IF NOT EXISTS session_work_lead (
    session_id UUID NOT NULL REFERENCES session(id) ON DELETE CASCADE,
    work_lead_id UUID NOT NULL REFERENCES work_lead(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('todo', 'working', 'danger', 'validated')) DEFAULT 'todo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (session_id, work_lead_id)
);

CREATE INDEX idx_session_work_lead_work_lead_id ON session_work_lead(work_lead_id);
CREATE INDEX idx_session_work_lead_status ON session_work_lead(status);

CREATE TRIGGER update_session_work_lead_updated_at
    BEFORE UPDATE ON session_work_lead
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Pivot: Session Master <-> Work Lead Master
CREATE TABLE IF NOT EXISTS session_master_work_lead_master (
    session_master_id UUID NOT NULL REFERENCES session_master(id) ON DELETE CASCADE,
    work_lead_master_id UUID NOT NULL REFERENCES work_lead_master(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('todo', 'working', 'danger', 'validated')) DEFAULT 'todo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (session_master_id, work_lead_master_id)
);

CREATE INDEX idx_session_master_work_lead_master_work_lead_master_id ON session_master_work_lead_master(work_lead_master_id);
CREATE INDEX idx_session_master_work_lead_master_status ON session_master_work_lead_master(status);

CREATE TRIGGER update_session_master_work_lead_master_updated_at
    BEFORE UPDATE ON session_master_work_lead_master
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FICHIERS
-- ============================================

-- Table files (fichiers uploadés)
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    origin_entity_type TEXT NOT NULL CHECK (origin_entity_type IN (
        'project', 'group', 'session', 'session_master', 'work_lead', 'work_lead_master', 'profile'
    )),
    origin_entity_id UUID NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN (
        'image', 'document', 'video', 'audio', 'gps_track', 'weather_data', 'other'
    )),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,  -- en bytes
    mime_type TEXT,
    uploaded_by UUID NOT NULL REFERENCES profile(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_files_origin ON files(origin_entity_type, origin_entity_id);
CREATE INDEX idx_files_uploaded_by ON files(uploaded_by);
CREATE INDEX idx_files_file_type ON files(file_type);

-- Table files_reference (références secondaires vers un fichier)
CREATE TABLE IF NOT EXISTS files_reference (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    files_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN (
        'project', 'group', 'session', 'session_master', 'work_lead', 'work_lead_master', 'profile'
    )),
    entity_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_files_reference_files_id ON files_reference(files_id);
CREATE INDEX idx_files_reference_entity ON files_reference(entity_type, entity_id);

-- ============================================
-- MÉTÉO
-- ============================================

-- Données météo (polymorphique: session ou session_master)
CREATE TABLE IF NOT EXISTS weather_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('session_master', 'session')),
    entity_id UUID NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    wind_speed_knots DECIMAL(5,2),
    wind_direction_degrees INTEGER CHECK (wind_direction_degrees >= 0 AND wind_direction_degrees < 360),
    wind_gusts_speed_knots DECIMAL(5,2),
    pressure_hpa INTEGER,
    temperature_celsius DECIMAL(4,1),
    source TEXT NOT NULL CHECK (source IN ('api_openmeteo', 'file', 'manual')),
    is_adjusted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_weather_data_entity ON weather_data(entity_type, entity_id);
CREATE INDEX idx_weather_data_recorded_at ON weather_data(recorded_at);
CREATE INDEX idx_weather_data_entity_recorded ON weather_data(entity_type, entity_id, recorded_at);

-- ============================================
-- ROW LEVEL SECURITY (RLS) - À activer
-- ============================================

-- Activer RLS sur toutes les tables
ALTER TABLE type_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE type_support ENABLE ROW LEVEL SECURITY;
ALTER TABLE type_seance ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE project ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group" ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_project ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE session ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_master_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_lead_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_lead_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_lead ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_work_lead ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_master_work_lead_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE files_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_data ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICIES RLS
-- ============================================

-- --------------------------------------------
-- Tables de référence: lecture pour tous les authentifiés
-- --------------------------------------------
CREATE POLICY "Authenticated read type_profile" ON type_profile
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Authenticated read type_support" ON type_support
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Authenticated read type_seance" ON type_seance
    FOR SELECT TO authenticated
    USING (is_deleted = FALSE);

-- --------------------------------------------
-- Profile: chacun voit le sien, admin voit tout
-- --------------------------------------------
CREATE POLICY "Users read own profile" ON profile
    FOR SELECT TO authenticated
    USING (user_uid = auth.uid());

CREATE POLICY "Admin full access profile" ON profile
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profile p
            WHERE p.user_uid = auth.uid() AND p.type_profile_id = 1
        )
    );

-- --------------------------------------------
-- Project
-- --------------------------------------------

-- Admin: accès total
CREATE POLICY "Admin full access project" ON project
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profile p
            WHERE p.user_uid = auth.uid() AND p.type_profile_id = 1
        )
    );

-- Super Coach: lecture totale
CREATE POLICY "Super Coach read all projects" ON project
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profile p
            WHERE p.user_uid = auth.uid() AND p.type_profile_id = 2
        )
        AND is_deleted = FALSE
    );

-- Coach: accès aux projets de ses groupes
CREATE POLICY "Coach access group projects" ON project
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profile p
            JOIN group_profile gp ON gp.profile_id = p.id
            JOIN group_project gpj ON gpj.group_id = gp.group_id
            WHERE p.user_uid = auth.uid()
            AND p.type_profile_id = 3
            AND gpj.project_id = project.id
        )
        AND is_deleted = FALSE
    );

-- Navigant: accès à son propre projet
CREATE POLICY "Navigant access own project" ON project
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profile p
            WHERE p.user_uid = auth.uid()
            AND p.type_profile_id = 4
            AND project.profile_id = p.id
        )
        AND is_deleted = FALSE
    );

-- --------------------------------------------
-- Group
-- --------------------------------------------

CREATE POLICY "Admin full access group" ON "group"
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profile p
            WHERE p.user_uid = auth.uid() AND p.type_profile_id = 1
        )
    );

CREATE POLICY "Super Coach read all groups" ON "group"
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profile p
            WHERE p.user_uid = auth.uid() AND p.type_profile_id = 2
        )
        AND is_deleted = FALSE
    );

CREATE POLICY "Coach access own groups" ON "group"
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profile p
            JOIN group_profile gp ON gp.profile_id = p.id
            WHERE p.user_uid = auth.uid()
            AND p.type_profile_id = 3
            AND gp.group_id = "group".id
        )
        AND is_deleted = FALSE
    );

-- --------------------------------------------
-- Session Master
-- --------------------------------------------

CREATE POLICY "Admin full access session_master" ON session_master
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profile p
            WHERE p.user_uid = auth.uid() AND p.type_profile_id = 1
        )
    );

CREATE POLICY "Super Coach read all session_master" ON session_master
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profile p
            WHERE p.user_uid = auth.uid() AND p.type_profile_id = 2
        )
        AND is_deleted = FALSE
    );

CREATE POLICY "Coach access group session_master" ON session_master
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profile p
            JOIN group_profile gp ON gp.profile_id = p.id
            WHERE p.user_uid = auth.uid()
            AND p.type_profile_id = 3
            AND gp.group_id = session_master.group_id
        )
        AND is_deleted = FALSE
    );

-- Navigant: lecture des session_master liées à ses sessions
CREATE POLICY "Navigant read linked session_master" ON session_master
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profile p
            JOIN project proj ON proj.profile_id = p.id
            JOIN session s ON s.project_id = proj.id
            WHERE p.user_uid = auth.uid()
            AND p.type_profile_id = 4
            AND s.session_master_id = session_master.id
        )
        AND is_deleted = FALSE
    );

-- --------------------------------------------
-- Session
-- --------------------------------------------

CREATE POLICY "Admin full access session" ON session
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profile p
            WHERE p.user_uid = auth.uid() AND p.type_profile_id = 1
        )
    );

CREATE POLICY "Super Coach read all sessions" ON session
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profile p
            WHERE p.user_uid = auth.uid() AND p.type_profile_id = 2
        )
        AND is_deleted = FALSE
    );

CREATE POLICY "Coach access group sessions" ON session
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profile p
            JOIN group_profile gp ON gp.profile_id = p.id
            JOIN group_project gpj ON gpj.group_id = gp.group_id
            WHERE p.user_uid = auth.uid()
            AND p.type_profile_id = 3
            AND gpj.project_id = session.project_id
        )
        AND is_deleted = FALSE
    );

CREATE POLICY "Navigant access own sessions" ON session
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profile p
            JOIN project proj ON proj.profile_id = p.id
            WHERE p.user_uid = auth.uid()
            AND p.type_profile_id = 4
            AND proj.id = session.project_id
        )
        AND is_deleted = FALSE
    );

-- --------------------------------------------
-- Weather Data
-- --------------------------------------------

CREATE POLICY "Admin full access weather_data" ON weather_data
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profile p
            WHERE p.user_uid = auth.uid() AND p.type_profile_id = 1
        )
    );

CREATE POLICY "Super Coach read all weather_data" ON weather_data
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profile p
            WHERE p.user_uid = auth.uid() AND p.type_profile_id = 2
        )
    );

-- Coach: accès météo de ses groupes (session_master) et projets liés (session)
CREATE POLICY "Coach access weather_data" ON weather_data
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profile p
            JOIN group_profile gp ON gp.profile_id = p.id
            WHERE p.user_uid = auth.uid()
            AND p.type_profile_id = 3
            AND (
                -- Session master de son groupe
                (weather_data.entity_type = 'session_master' AND EXISTS (
                    SELECT 1 FROM session_master sm
                    WHERE sm.id = weather_data.entity_id
                    AND sm.group_id = gp.group_id
                ))
                OR
                -- Session d'un projet de son groupe
                (weather_data.entity_type = 'session' AND EXISTS (
                    SELECT 1 FROM session s
                    JOIN group_project gpj ON gpj.project_id = s.project_id
                    WHERE s.id = weather_data.entity_id
                    AND gpj.group_id = gp.group_id
                ))
            )
        )
    );

-- Navigant: accès météo de ses sessions + session_master liées
CREATE POLICY "Navigant access weather_data" ON weather_data
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profile p
            JOIN project proj ON proj.profile_id = p.id
            WHERE p.user_uid = auth.uid()
            AND p.type_profile_id = 4
            AND (
                -- Sa propre session
                (weather_data.entity_type = 'session' AND EXISTS (
                    SELECT 1 FROM session s
                    WHERE s.id = weather_data.entity_id
                    AND s.project_id = proj.id
                ))
                OR
                -- Session master liée à une de ses sessions
                (weather_data.entity_type = 'session_master' AND EXISTS (
                    SELECT 1 FROM session s
                    WHERE s.session_master_id = weather_data.entity_id
                    AND s.project_id = proj.id
                ))
            )
        )
    );

-- ============================================
-- FIN DU SCHEMA
-- ============================================
