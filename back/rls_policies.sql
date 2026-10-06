-- Review and adapt these policies against the live Supabase schema before use.
-- The backend uses the Supabase service-role key, which bypasses RLS; these
-- policies are a backstop for direct access using user JWTs.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Anyone can view exercises" ON public.exercises;
DROP POLICY IF EXISTS "Only service role can insert exercises" ON public.exercises;
DROP POLICY IF EXISTS "Only service role can update exercises" ON public.exercises;
DROP POLICY IF EXISTS "Only service role can delete exercises" ON public.exercises;
DROP POLICY IF EXISTS "Users can view global and owned exercises" ON public.exercises;
DROP POLICY IF EXISTS "Users can create owned exercises" ON public.exercises;
DROP POLICY IF EXISTS "Users can update owned exercises" ON public.exercises;
DROP POLICY IF EXISTS "Users can delete owned exercises" ON public.exercises;
CREATE POLICY "Users can view global and owned exercises"
ON public.exercises FOR SELECT TO authenticated
USING (created_by IS NULL OR created_by = auth.uid());
CREATE POLICY "Users can create owned exercises"
ON public.exercises FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users can update owned exercises"
ON public.exercises FOR UPDATE TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users can delete owned exercises"
ON public.exercises FOR DELETE TO authenticated
USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can view their own workout logs" ON public.workout_logs;
DROP POLICY IF EXISTS "Users can create their own workout logs" ON public.workout_logs;
DROP POLICY IF EXISTS "Users can update their own workout logs" ON public.workout_logs;
DROP POLICY IF EXISTS "Users can delete their own workout logs" ON public.workout_logs;
CREATE POLICY "Users can view their own workout logs"
ON public.workout_logs FOR SELECT TO authenticated
USING (user_id = auth.uid());
CREATE POLICY "Users can create their own workout logs"
ON public.workout_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own workout logs"
ON public.workout_logs FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete their own workout logs"
ON public.workout_logs FOR DELETE TO authenticated
USING (user_id = auth.uid());
