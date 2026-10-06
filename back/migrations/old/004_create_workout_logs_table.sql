CREATE TABLE IF NOT EXISTS public.workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id),
  log_date date NOT NULL,
  weight numeric(10, 2) NOT NULL,
  reps integer NOT NULL,
  set_number integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workout_logs_user_date_idx
ON public.workout_logs (user_id, log_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS workout_logs_exercise_idx
ON public.workout_logs (exercise_id);
