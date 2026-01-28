-- ============================================
-- Migration: Add first_name and last_name to profile table
-- ============================================
-- Purpose: Store user names directly in profile to avoid N+1 API calls to Supabase Auth
-- This is a controlled denormalization for performance optimization
-- ============================================

-- 1. Add columns to profile table
ALTER TABLE profile ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS last_name TEXT;

-- 2. Create index for searching by name (optional, useful for user search)
CREATE INDEX IF NOT EXISTS idx_profile_last_name ON profile(last_name);

-- 3. Populate existing profiles from auth.users metadata
-- Note: This requires service_role access to auth.users
UPDATE profile p
SET
    first_name = u.raw_user_meta_data->>'first_name',
    last_name = u.raw_user_meta_data->>'last_name'
FROM auth.users u
WHERE p.user_uid = u.id
  AND (p.first_name IS NULL OR p.last_name IS NULL);

-- 4. Create a function to sync profile name from auth.users (can be called manually or via trigger)
CREATE OR REPLACE FUNCTION sync_profile_name_from_auth()
RETURNS TRIGGER AS $$
BEGIN
    -- Update all profiles for this user when their metadata changes
    UPDATE profile
    SET
        first_name = NEW.raw_user_meta_data->>'first_name',
        last_name = NEW.raw_user_meta_data->>'last_name',
        updated_at = NOW()
    WHERE user_uid = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create trigger on auth.users to auto-sync (optional - requires permissions)
-- Note: This trigger may need to be created via Supabase dashboard if permissions are restricted
-- DROP TRIGGER IF EXISTS sync_profile_name_trigger ON auth.users;
-- CREATE TRIGGER sync_profile_name_trigger
--     AFTER UPDATE OF raw_user_meta_data ON auth.users
--     FOR EACH ROW
--     EXECUTE FUNCTION sync_profile_name_from_auth();

-- ============================================
-- Verification query (run after migration)
-- ============================================
-- SELECT p.id, p.user_uid, p.first_name, p.last_name, tp.name as profile_type
-- FROM profile p
-- JOIN type_profile tp ON p.type_profile_id = tp.id
-- ORDER BY p.created_at DESC;
