# Supabase SQL migrations

These migrations are the single source of truth for database access rules. Do not add standalone policy files.

These SQL files are for a human to run manually in the Supabase SQL Editor.
Apply them only when creating a fresh, empty Supabase project, and run them
once, in this order:

1. `0001_baseline.sql`
2. `0002_rls.sql`
3. `0003_restrict_exercise_reads.sql`
4. `0004_exercise_category_check.sql` — restricts `exercises.category` to
   `Push`, `Pull`, `Leg`, `Cardio`, or `Other`.
5. `0005_profile_update_policy.sql` — allows users to update only their own
   profile.

Do not run these files, individually or as a set, on an existing database.
They are not an automatic migration runner and are not designed to upgrade a
database that already has application tables or policies.

After rebuilding a fresh project, verify the result against the live database:
compare every table's columns and types, foreign keys and other constraints,
indexes, and row-level security policies. Confirm that the result matches the
intended live schema before using the project.

`0003_restrict_exercise_reads.sql` replaces the open **"Anyone can view
exercises"** policy with a read policy that allows signed-in users to see
preset exercises and their own custom exercises. Presets have
`exercises.created_by IS NULL`; a non-NULL `created_by` identifies the owning
user. The backend uses the Supabase service key, which bypasses RLS.

The `old/` directory contains superseded, guessed migration files kept for
historical reference only. Do not apply them.
