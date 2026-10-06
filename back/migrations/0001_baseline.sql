-- 0001_baseline.sql
-- Matches the live Supabase schema (public): tables, constraints and indexes.
-- Safe to run on a fresh project. Uses IF NOT EXISTS so it won't touch existing tables.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email text not null unique,
  created_at timestamptz not null default now()
);

-- created_by is NULL for shared/seeded exercises, set for a user's custom exercises.
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  category text default 'Other',
  created_by uuid references auth.users(id) on delete set null
);

-- Appears unused by the app (workout_logs has no link to it). Verify before keeping or dropping.
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  workout_date date not null default current_date,
  duration_minutes integer,
  calories integer,
  notes text,
  created_at timestamptz not null default now()
);

-- Each row is either a strength set (weight + reps) or a cardio entry (duration only).
create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  log_date date not null,
  weight numeric check (weight >= 0),
  reps numeric check (reps > 0),
  set_number integer not null default 1 check (set_number >= 1),
  created_at timestamptz not null default now(),
  duration_seconds integer,
  constraint workout_logs_entry_type_check check (
    (weight is not null and reps is not null and duration_seconds is null)
    or (duration_seconds > 0 and weight is null and reps is null)
  )
);

-- Indexes (as they exist on the live database)
-- Exercise names are unique across ALL users, case-insensitive.
create unique index if not exists exercises_name_unique on public.exercises (lower(name));
create index if not exists exercises_category_idx on public.exercises (category);
create index if not exists workout_logs_user_date_idx on public.workout_logs (user_id, log_date desc);
create index if not exists workout_logs_user_exercise_date_idx on public.workout_logs (user_id, exercise_id, log_date desc);
create index if not exists workouts_user_id_idx on public.workouts (user_id);