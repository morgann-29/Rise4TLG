-- ============================================
-- STARTER TEMPLATE - TABLES DE BASE
-- Tables pour authentification multi-profil
-- ============================================

-- ============================================
-- TYPE_PROFIL (types de profils disponibles)
-- ============================================
CREATE TABLE IF NOT EXISTS type_profil (
    id SERIAL PRIMARY KEY,
    nom_profil VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_type_profil_updated_at
    BEFORE UPDATE ON type_profil
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PROFILE (profils utilisateur)
-- Un utilisateur (auth.users) peut avoir plusieurs profils
-- ============================================
CREATE TABLE IF NOT EXISTS profile (
    id SERIAL PRIMARY KEY,
    id_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    id_type_profil INTEGER REFERENCES type_profil(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_user ON profile(id_user);
CREATE INDEX IF NOT EXISTS idx_profile_type ON profile(id_type_profil);

CREATE TRIGGER update_profile_updated_at
    BEFORE UPDATE ON profile
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DONNEES INITIALES
-- ============================================
-- Types de profil par defaut
INSERT INTO type_profil (nom_profil) VALUES
    ('admin'),
    ('operator')
ON CONFLICT (nom_profil) DO NOTHING;

-- ============================================
-- NOTES
-- ============================================
-- 1. Les utilisateurs sont stockes dans auth.users (Supabase Auth)
-- 2. Chaque utilisateur peut avoir plusieurs profils
-- 3. Le profil actif est stocke dans auth.users.user_metadata.active_profile_id
-- 4. type_profil id=1 (admin) a des privileges speciaux dans le backend
