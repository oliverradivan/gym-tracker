-- Make exercises global (not tied to individual users)

-- Drop existing RLS policies
drop policy if exists "Users can view their own exercises" on public.exercises;
drop policy if exists "Users can insert their own exercises" on public.exercises;
drop policy if exists "Users can update their own exercises" on public.exercises;
drop policy if exists "Users can delete their own exercises" on public.exercises;

-- Drop the user_id constraint and unique index
drop index if exists exercises_user_name_unique;
drop index if exists exercises_user_id_idx;

-- Remove user_id column and create new unique constraint on name only
alter table public.exercises
drop constraint if exists exercises_user_id_fkey,
drop column if exists user_id;

create unique index if not exists exercises_name_unique
on public.exercises (lower(name));

-- Create new RLS policies for global exercises
create policy "Anyone can view exercises"
on public.exercises for select
using (true);

create policy "Only service role can insert exercises"
on public.exercises for insert
with check (false);

create policy "Only service role can update exercises"
on public.exercises for update
using (false)
with check (false);

create policy "Only service role can delete exercises"
on public.exercises for delete
using (false);
