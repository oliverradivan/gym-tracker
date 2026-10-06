-- 0002_rls.sql
-- Row-level security exactly as it exists on the live database.
-- The backend uses the Supabase service key, which bypasses RLS, so these policies
-- only matter for requests made with the public/anon or a user's own key.
-- Run 0001_baseline.sql first.

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_logs enable row level security;

-- exercises (writes are denied to everyone except the service key)
create policy "Anyone can view exercises" on public.exercises
  for select using (true);

create policy "Only service role can insert exercises" on public.exercises
  for insert with check (false);

create policy "Only service role can update exercises" on public.exercises
  for update using (false) with check (false);

create policy "Only service role can delete exercises" on public.exercises
  for delete using (false);

-- profiles
create policy "Users can view their own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);

-- workout_logs
create policy "Users can view their own workout logs" on public.workout_logs
  for select using (auth.uid() = user_id);

create policy "Users can insert their own workout logs" on public.workout_logs
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own workout logs" on public.workout_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete their own workout logs" on public.workout_logs
  for delete using (auth.uid() = user_id);

-- workouts
create policy "Users can view their own workouts" on public.workouts
  for select to authenticated using (auth.uid() = user_id);

create policy "Users can insert their own workouts" on public.workouts
  for insert to authenticated with check (auth.uid() = user_id);

create policy "Users can update their own workouts" on public.workouts
  for update to authenticated using (auth.uid() = user_id);

create policy "Users can delete their own workouts" on public.workouts
  for delete to authenticated using (auth.uid() = user_id);