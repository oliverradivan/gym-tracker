# Supabase SQL migrations

These migrations are the single source of truth for database access rules. Do not add standalone policy files.

Set `SUPABASE_DB_URL` and run `uv run --project back --group dev python -m back.run_migrations` from the repository root.

The runner applies top-level numbered migrations in order and records each
filename in `public.schema_migrations` in the same transaction as the SQL.
It rejects numbering gaps, missing applied versions, and out-of-order history.
Apply this initial baseline only to a fresh, empty Supabase project; an
existing database must first have its schema reconciled and migration history
baselined manually.

The numbered sequence is:

1. `0001_baseline.sql`
2. `0002_rls.sql`
3. `0003_restrict_exercise_reads.sql`
4. `0004_exercise_category_check.sql` — restricts `exercises.category` to
   `Push`, `Pull`, `Leg`, `Cardio`, or `Other`.
5. `0005_profile_update_policy.sql` — allows users to update only their own
   profile.
6. `0006_user_owned_table_rls.sql` — enforces owner-only CRUD on profiles,
   workouts, and workout logs.
7. `0007_persistent_auth_rate_limits.sql` — stores authentication rate-limit
   windows atomically in Supabase.

After rebuilding a fresh project, verify the result against the live database:
compare every table's columns and types, foreign keys and other constraints,
indexes, and row-level security policies. Confirm that the result matches the
intended live schema before using the project.

`0003_restrict_exercise_reads.sql` replaces the open **"Anyone can view
exercises"** policy with a read policy that allows signed-in users to see
preset exercises and their own custom exercises. Presets have
`exercises.created_by IS NULL`; a non-NULL `created_by` identifies the owning
user. User-facing backend requests use the caller's JWT so these policies are
enforced; administrative account operations and exercise writes use the service
role client.

The `old/` directory contains superseded, guessed migration files kept for
historical reference only. Do not apply them.
