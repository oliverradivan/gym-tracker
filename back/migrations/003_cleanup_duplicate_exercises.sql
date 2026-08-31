-- Clean up duplicate exercises and ensure global uniqueness
-- This removes all but the oldest instance of each exercise (by name)

DELETE FROM public.exercises e1
WHERE e1.id NOT IN (
  SELECT MIN(e2.id)
  FROM public.exercises e2
  GROUP BY LOWER(e2.name)
);

-- Verify the cleanup
SELECT COUNT(*) as total_exercises, COUNT(DISTINCT LOWER(name)) as unique_exercise_names
FROM public.exercises;

-- Show all exercises after cleanup
SELECT id, name, created_at
FROM public.exercises
ORDER BY name;
