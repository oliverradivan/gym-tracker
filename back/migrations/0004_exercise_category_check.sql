-- 0004_exercise_category_check.sql
-- Restricts exercises.category to the five categories the app uses.
-- Before running on an existing database, confirm every row already fits:
--   select category, count(*) from public.exercises group by 1;
-- (only Push, Pull, Leg, Cardio, Other should appear; NULL is also allowed by this rule)
--
-- Rollback:
--   alter table public.exercises drop constraint exercises_category_check;

alter table public.exercises
  add constraint exercises_category_check
  check (category in ('Push', 'Pull', 'Leg', 'Cardio', 'Other'));