-- Add created_by for per-user ownership; NULL denotes a global exercise.
ALTER TABLE exercises
ADD COLUMN created_by UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Existing exercises remain global (created_by IS NULL).