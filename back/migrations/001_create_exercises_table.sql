create extension if not exists pgcrypto;

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists exercises_name_unique
on public.exercises (lower(name));

alter table public.exercises enable row level security;

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
