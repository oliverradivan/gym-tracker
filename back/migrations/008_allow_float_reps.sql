-- Allow reps to be floats instead of integers

ALTER TABLE public.workout_logs 
ALTER COLUMN reps SET DATA TYPE numeric(10, 2);
