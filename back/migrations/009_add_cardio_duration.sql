ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS duration_seconds integer;

ALTER TABLE public.workout_logs
  ALTER COLUMN weight DROP NOT NULL,
  ALTER COLUMN reps DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workout_logs_duration_seconds_positive'
      AND conrelid = 'public.workout_logs'::regclass
  ) THEN
    ALTER TABLE public.workout_logs
      ADD CONSTRAINT workout_logs_duration_seconds_positive
      CHECK (duration_seconds IS NULL OR duration_seconds > 0);
  END IF;
END
$$;
