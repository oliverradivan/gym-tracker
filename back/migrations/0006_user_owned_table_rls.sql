-- Restrict owner-managed tables to the authenticated user for every operation.

drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can delete their own profile" on public.profiles;

create policy "Users can view their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
create policy "Users can delete their own profile"
  on public.profiles for delete to authenticated
  using (id = (select auth.uid()));

drop policy if exists "Users can view their own workouts" on public.workouts;
drop policy if exists "Users can insert their own workouts" on public.workouts;
drop policy if exists "Users can update their own workouts" on public.workouts;
drop policy if exists "Users can delete their own workouts" on public.workouts;

create policy "Users can view their own workouts"
  on public.workouts for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users can insert their own workouts"
  on public.workouts for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Users can update their own workouts"
  on public.workouts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Users can delete their own workouts"
  on public.workouts for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can view their own workout logs" on public.workout_logs;
drop policy if exists "Users can insert their own workout logs" on public.workout_logs;
drop policy if exists "Users can update their own workout logs" on public.workout_logs;
drop policy if exists "Users can delete their own workout logs" on public.workout_logs;
drop policy if exists "Users can create their own workout logs" on public.workout_logs;

create policy "Users can view their own workout logs"
  on public.workout_logs for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users can insert their own workout logs"
  on public.workout_logs for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Users can update their own workout logs"
  on public.workout_logs for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Users can delete their own workout logs"
  on public.workout_logs for delete to authenticated
  using (user_id = (select auth.uid()));
