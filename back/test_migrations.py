from pathlib import Path

import pytest

from back.run_migrations import MigrationError, get_migrations, validate_migration_history


def test_migration_files_are_contiguous_and_ordered():
    migrations = get_migrations(Path(__file__).parent / "migrations")

    assert [version for version, _ in migrations] == list(
        range(1, len(migrations) + 1)
    )


@pytest.mark.parametrize(
    "applied",
    [
        [(1, "0001_baseline.sql"), (3, "0003_rls.sql")],
        [(1, "0001_baseline.sql"), (3, "0003_rls.sql"), (2, "0002_rls.sql")],
    ],
)
def test_migration_history_rejects_skipped_or_out_of_order_files(applied):
    migrations = [
        (1, "0001_baseline.sql"),
        (2, "0002_rls.sql"),
        (3, "0003_restrict_exercise_reads.sql"),
    ]

    with pytest.raises(MigrationError, match="skipped or out of order"):
        validate_migration_history(migrations, applied)


def test_migration_history_rejects_a_numbering_gap():
    migrations = [(1, "0001_baseline.sql"), (3, "0003_rls.sql")]

    with pytest.raises(MigrationError, match="contiguous"):
        validate_migration_history(migrations, [])
