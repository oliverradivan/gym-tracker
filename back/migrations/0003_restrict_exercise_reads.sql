-- 0003_restrict_exercise_reads.sql
-- Fix: "Anyone can view exercises" let every user (even logged-out ones holding the
-- public key) read ALL exercises, including other users' custom ones.
-- After this, signed-in users can read shared exercises (created_by IS NULL) and their own.
-- Writes stay denied for everyone but the service key, as before.
--
-- Rollback (restores the old behavior):
--   drop policy if exists "exercises: read shared and own" on public.exercises;
--   create policy "Anyone can view exercises" on public.exercises for select using (true);

drop policy if exists "Anyone can view exercises" on public.exercises;

create policy "exercises: read shared and own" on public.exercises
  for select to authenticated
  using (created_by is null or created_by = (select auth.uid()));