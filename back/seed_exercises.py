import os

from supabase import create_client

EXERCISES = [
    # Push exercises (chest, shoulders, triceps)
    {"name": "Bench Press", "category": "Push"},
    {"name": "Smith Bench Press", "category": "Push"},
    {"name": "Machine Bench Press", "category": "Push"},
    {"name": "Machine Push Press", "category": "Push"},
    {"name": "Dumbbell Bench Press", "category": "Push"},
    {"name": "Dumbbell Shoulder Press", "category": "Push"},
    {"name": "Machine Shoulder Press", "category": "Push"},
    {"name": "Cable Machine Shoulder Press", "category": "Push"},
    {"name": "Cable Tricep Pulldowns", "category": "Push"},
    {"name": "Delt Cable Flys", "category": "Push"},
    {"name": "Delt Machine Flys", "category": "Push"},
    
    # Pull exercises (back, biceps)
    {"name": "Pull Ups", "category": "Pull"},
    {"name": "Assisted Pull Ups", "category": "Pull"},
    {"name": "Lat Pull Down (Wide)", "category": "Pull"},
    {"name": "Lat Pull Down (Narrow)", "category": "Pull"},
    {"name": "Cable Row (Narrow)", "category": "Pull"},
    {"name": "Cable Row (Wide)", "category": "Pull"},
    {"name": "Machine Row", "category": "Pull"},
    {"name": "Bicep Curls", "category": "Pull"},
    {"name": "Machine Bicep Curls", "category": "Pull"},
    {"name": "Rear Delts", "category": "Pull"},
    {"name": "Shrugs", "category": "Pull"},
    
    # Leg exercises (quads, hamstrings, calves, core)
    {"name": "Leg Extensions", "category": "Leg"},
    {"name": "Leg Press", "category": "Leg"},
    {"name": "Reverse Leg Press", "category": "Leg"},
    {"name": "Bed Hamstring Curl", "category": "Leg"},
    {"name": "Manchester Hamstring Curl", "category": "Leg"},
    {"name": "Inside Leg", "category": "Leg"},
    {"name": "Outside Leg", "category": "Leg"},
    {"name": "Sitting Calf Raises", "category": "Leg"},
    {"name": "Crunch Machine", "category": "Leg"},
    {"name": "Crunches", "category": "Leg"},
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
    for exercise in EXERCISES:
        exercise_name = exercise.get("name") if isinstance(exercise, dict) else exercise
        normalized = exercise_name.strip().lower()
        if normalized in existing_names:
            continue

        try:
            insert_data = {"name": exercise_name}
            if isinstance(exercise, dict) and "category" in exercise:
                insert_data["category"] = exercise["category"]
            
            supabase.table("exercises").insert(insert_data).execute()
            seeded_count += 1
        except Exception as exc:
            print(f"Skipping {exercise_name}: {exc}")

    print(f"Seeded {len(EXERCISES)} exercises globally.")
    print(f"New exercises inserted: {seeded_count}")


if __name__ == "__main__":
    seed_exercises_for_all_users()
