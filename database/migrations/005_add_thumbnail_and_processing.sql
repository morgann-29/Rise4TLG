-- ============================================
-- Migration: Add Thumbnail and Processing Status
-- Date: 2026-01-28
-- Description: Add thumbnail_path and processing_status columns for media files
-- ============================================

-- Add new columns to files table
ALTER TABLE files ADD COLUMN IF NOT EXISTS thumbnail_path TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'ready'
    CHECK (processing_status IN ('ready', 'pending', 'processing', 'failed'));
ALTER TABLE files ADD COLUMN IF NOT EXISTS processing_error TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS original_file_size INTEGER;

-- Add index for processing status (useful for querying pending jobs)
CREATE INDEX IF NOT EXISTS idx_files_processing_status ON files(processing_status)
WHERE processing_status IN ('pending', 'processing');

-- Comments for documentation
COMMENT ON COLUMN files.thumbnail_path IS 'Path to the thumbnail in Supabase Storage (400x400 for images, frame from video)';
COMMENT ON COLUMN files.processing_status IS 'Media processing status: ready (done/no processing needed), pending (waiting), processing (in progress), failed';
COMMENT ON COLUMN files.processing_error IS 'Error message if processing failed';
COMMENT ON COLUMN files.original_file_size IS 'Original file size before compression (for videos)';

-- ============================================
-- ROLLBACK (run manually if needed):
-- ALTER TABLE files DROP COLUMN IF EXISTS thumbnail_path;
-- ALTER TABLE files DROP COLUMN IF EXISTS processing_status;
-- ALTER TABLE files DROP COLUMN IF EXISTS processing_error;
-- ALTER TABLE files DROP COLUMN IF EXISTS original_file_size;
-- DROP INDEX IF EXISTS idx_files_processing_status;
-- ============================================
