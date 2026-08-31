-- Add category field to exercises table for grouping

ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS category text DEFAULT 'Other';

-- Create an index on category for faster queries
CREATE INDEX IF NOT EXISTS exercises_category_idx ON public.exercises (category);
