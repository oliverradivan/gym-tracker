-- Add user_id column to exercises for per-user ownership
ALTER TABLE exercises
ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Existing rows will have NULL user_id (treated as global/template exercises)
-- No need to backfill; they remain accessible to all users via OR user_id IS NULL.