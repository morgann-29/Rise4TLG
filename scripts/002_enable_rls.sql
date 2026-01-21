-- ============================================
-- SECURISATION RLS - TOUTES LES TABLES
-- Applique "deny all" sauf service_role (backend)
-- ============================================

-- ============================================
-- 1. TYPE_PROFIL
-- ============================================
DROP POLICY IF EXISTS "Deny all direct access" ON type_profil;

ALTER TABLE type_profil ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all direct access"
    ON type_profil FOR ALL
    TO authenticated, anon
    USING (false)
    WITH CHECK (false);

-- ============================================
-- 2. PROFILE
-- ============================================
DROP POLICY IF EXISTS "Deny all direct access" ON profile;

ALTER TABLE profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all direct access"
    ON profile FOR ALL
    TO authenticated, anon
    USING (false)
    WITH CHECK (false);

-- ============================================
-- VERIFICATION
-- ============================================
-- Pour verifier que toutes les tables ont RLS active :
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
--
-- Pour voir les policies :
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';

-- ============================================
-- NOTES
-- ============================================
-- Ces policies bloquent tous les acces directs depuis le client.
-- Seul le backend (utilisant service_role key) peut acceder aux donnees.
-- C'est la strategie recommandee pour une API-first architecture.
