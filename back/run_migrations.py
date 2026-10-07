import os
import re
import sys
from pathlib import Path

import psycopg

MIGRATIONS_DIR = Path(__file__).parent / "migrations"
MIGRATION_NAME = re.compile(r"^(\d{4})_.+\.sql$")


class MigrationError(RuntimeError):
    pass


def validate_migration_history(
    migrations: list[tuple[int, str]],
    applied: list[tuple[int, str]],
) -> None:
    expected_versions = list(range(1, len(migrations) + 1))
    actual_versions = [version for version, _ in migrations]
    if actual_versions != expected_versions:
        raise MigrationError(
            f"Migration files must be contiguous and start at 0001; found {actual_versions}."
        )

    if applied != migrations[: len(applied)]:
        raise MigrationError(
            "Applied migration history is skipped or out of order; "
            "reconcile schema_migrations before continuing."
        )


def get_migrations(directory: Path = MIGRATIONS_DIR) -> list[tuple[int, Path]]:
    migrations = []
    for path in sorted(directory.glob("*.sql")):
        match = MIGRATION_NAME.fullmatch(path.name)
        if match is None:
            raise MigrationError(f"Invalid migration filename: {path.name}")
        migrations.append((int(match.group(1)), path))

    versions = [version for version, _ in migrations]
    if versions != list(range(1, len(migrations) + 1)):
        raise MigrationError(
            f"Migration files must be contiguous and start at 0001; found {versions}."
        )
    return migrations


def run_migrations(database_url: str, directory: Path = MIGRATIONS_DIR) -> list[str]:
    migration_files = get_migrations(directory)
    migration_names = [(version, path.name) for version, path in migration_files]
    applied_names = []

    with psycopg.connect(database_url) as connection:
        with connection.transaction():
            connection.execute(
                "select pg_advisory_xact_lock(hashtextextended('workout-tracker-migrations', 0))"
            )
            connection.execute(
                """
                create table if not exists public.schema_migrations (
                  applied_order bigint generated always as identity unique,
                  version integer primary key,
                  filename text not null unique,
                  applied_at timestamptz not null default now()
                )
                """
            )
            applied = connection.execute(
                """
                select version, filename
                from public.schema_migrations
                order by applied_order
                """
            ).fetchall()
            validate_migration_history(migration_names, applied)

            for version, path in migration_files[len(applied) :]:
                connection.execute(path.read_text(encoding="utf-8"), prepare=False)
                connection.execute(
                    """
                    insert into public.schema_migrations (version, filename)
                    values (%s, %s)
                    """,
                    (version, path.name),
                )
                applied_names.append(path.name)

    return applied_names


def main() -> int:
    database_url = os.getenv("SUPABASE_DB_URL")
    if not database_url:
        print("SUPABASE_DB_URL must be set.", file=sys.stderr)
        return 2

    for migration in run_migrations(database_url):
        print(f"Applied {migration}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
