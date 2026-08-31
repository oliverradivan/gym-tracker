-- Comprehensive cleanup: Fix the exercises table structure and remove ALL duplicates

-- First, disable RLS temporarily to allow changes
ALTER TABLE public.exercises DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Anyone can view exercises" ON public.exercises;
DROP POLICY IF EXISTS "Only service role can insert exercises" ON public.exercises;
DROP POLICY IF EXISTS "Only service role can update exercises" ON public.exercises;
DROP POLICY IF EXISTS "Only service role can delete exercises" ON public.exercises;

-- Drop any old indexes
DROP INDEX IF EXISTS exercises_name_unique;
DROP INDEX IF EXISTS exercises_user_name_unique;
DROP INDEX IF EXISTS exercises_user_id_idx;

-- Check if user_id column still exists and remove it if it does
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'exercises' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.exercises 
    DROP CONSTRAINT IF EXISTS exercises_user_id_fkey,
    DROP COLUMN user_id;
  END IF;
END $$;

-- Remove the deleted_at column if it exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'exercises' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.exercises DROP COLUMN deleted_at;
  END IF;
END $$;

-- Delete ALL exercises and start fresh
TRUNCATE TABLE public.exercises;

-- Re-create unique index on name (case-insensitive)
CREATE UNIQUE INDEX exercises_name_unique ON public.exercises (LOWER(name));

-- Re-enable RLS
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

-- Create new RLS policies for global exercises
CREATE POLICY "Anyone can view exercises"
ON public.exercises FOR SELECT
USING (true);

CREATE POLICY "Only service role can insert exercises"
ON public.exercises FOR INSERT
WITH CHECK (false);

CREATE POLICY "Only service role can update exercises"
ON public.exercises FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "Only service role can delete exercises"
ON public.exercises FOR DELETE
USING (false);

-- Verify the table is clean
SELECT COUNT(*) as total_exercises FROM public.exercises;
