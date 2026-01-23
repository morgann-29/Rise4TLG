-- ============================================
-- Migration: Add status column to work_lead_master and work_lead
-- Date: 2026-01-23
-- ============================================

-- Add status enum type if not exists
DO $$ BEGIN
    CREATE TYPE work_lead_status AS ENUM ('TODO', 'WORKING', 'DANGER', 'OK');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add status column to work_lead_master
ALTER TABLE work_lead_master
ADD COLUMN IF NOT EXISTS status work_lead_status DEFAULT NULL;

-- Add status column to work_lead
ALTER TABLE work_lead
ADD COLUMN IF NOT EXISTS status work_lead_status DEFAULT NULL;

-- Create indexes for status filtering
CREATE INDEX IF NOT EXISTS idx_work_lead_master_status ON work_lead_master(status) WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_lead_status ON work_lead(status) WHERE status IS NOT NULL;

-- ============================================
-- Rollback (if needed):
-- ============================================
-- ALTER TABLE work_lead_master DROP COLUMN IF EXISTS status;
-- ALTER TABLE work_lead DROP COLUMN IF EXISTS status;
-- DROP TYPE IF EXISTS work_lead_status;
