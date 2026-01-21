-- ============================================
-- CREATION DU PREMIER ADMIN
-- ============================================
-- ATTENTION: Ce script est un exemple.
-- En production, utilisez l'API Supabase Admin ou l'interface dashboard.

-- Option 1: Via Supabase Dashboard
-- 1. Allez dans Authentication > Users
-- 2. Cliquez "Add user" / "Invite user"
-- 3. Entrez l'email de l'admin
-- 4. Puis executez le SQL ci-dessous pour lui assigner le profil admin

-- Option 2: Via SQL (apres creation de l'utilisateur)
-- Remplacez 'USER_UUID_HERE' par l'UUID de l'utilisateur cree

/*
INSERT INTO profile (id_user, id_type_profil)
VALUES (
    'USER_UUID_HERE',  -- UUID de l'utilisateur (auth.users.id)
    1                   -- 1 = admin (type_profil)
);
*/

-- ============================================
-- VERIFICATION
-- ============================================
-- Lister les admins:
-- SELECT p.id, p.id_user, tp.nom_profil
-- FROM profile p
-- JOIN type_profil tp ON p.id_type_profil = tp.id
-- WHERE tp.nom_profil = 'admin';
