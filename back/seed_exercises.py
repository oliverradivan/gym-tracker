import os

from supabase import create_client

EXERCISES = [
    "Bench Press",
    "Smith Bench Press",
    "Machine Bench Press",
    "Machine Push Press",
    "Dumbbell Bench Press",
    "Dumbbell Shoulder Press",
    "Machine Shoulder Press",
    "Cable Machine Shoulder Press",
    "Cable Tricep Pulldowns",
    "Delt Cable Flys",
    "Delt Machine Flys",
    "Leg Extensions",
    "Leg Press",
    "Reverse Leg Press",
    "Bed Hamstring Curl",
    "Manchester Hamstring Curl",
    "Inside Leg",
    "Outside Leg",
    "Sitting Calf Raises",
    "Crunch Machine",
    "Crunches",
    "Pull Ups",
    "Assisted Pull Ups",
    "Lat Pull Down (Wide)",
    "Lat Pull Down (Narrow)",
    "Cable Row (Narrow)",
    "Cable Row (Wide)",
    "Machine Row",
    "Bicep Curls",
    "Machine Bicep Curls",
    "Rear Delts",
    "Shrugs",
]


def seed_exercises_for_all_users():
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

    supabase = create_client(supabase_url, supabase_key)

    try:
        existing = (
            supabase.table("exercises")
            .select("name")
            .execute()
        )
        existing_names = {
            (row.get("name") or "").strip().lower()
            for row in (existing.data or [])
        }
    except Exception as exc:
        print(f"Failed to fetch existing exercises: {exc}")
        existing_names = set()

    seeded_count = 0
    for exercise_name in EXERCISES:
        normalized = exercise_name.strip().lower()
        if normalized in existing_names:
            continue

        try:
            supabase.table("exercises").insert({
                "name": exercise_name,
            }).execute()
            seeded_count += 1
        except Exception as exc:
            print(f"Skipping {exercise_name}: {exc}")

    print(f"Seeded {len(EXERCISES)} exercises globally.")
    print(f"New exercises inserted: {seeded_count}")


if __name__ == "__main__":
    seed_exercises_for_all_users()
