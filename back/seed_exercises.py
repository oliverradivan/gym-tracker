import os

from postgrest.exceptions import APIError
from supabase import create_client

from .exercise_categories import LEG_CATEGORY, PULL_CATEGORY, PUSH_CATEGORY

EXERCISES = [
    # Push exercises
    {"name": "Bench Press", "category": PUSH_CATEGORY},
    {"name": "Smith Bench Press", "category": PUSH_CATEGORY},
    {"name": "Machine Bench Press", "category": PUSH_CATEGORY},
    {"name": "Machine Push Press", "category": PUSH_CATEGORY},
    {"name": "Dumbbell Bench Press", "category": PUSH_CATEGORY},
    {"name": "Dumbbell Shoulder Press", "category": PUSH_CATEGORY},
    {"name": "Machine Shoulder Press", "category": PUSH_CATEGORY},
    {"name": "Cable Machine Shoulder Press", "category": PUSH_CATEGORY},
    {"name": "Cable Tricep Pulldowns", "category": PUSH_CATEGORY},
    {"name": "Delt Cable Flys", "category": PUSH_CATEGORY},
    {"name": "Delt Machine Flys", "category": PUSH_CATEGORY},
    
    # Pull exercises
    {"name": "Pull Ups", "category": PULL_CATEGORY},
    {"name": "Assisted Pull Ups", "category": PULL_CATEGORY},
    {"name": "Lat Pull Down (Wide)", "category": PULL_CATEGORY},
    {"name": "Lat Pull Down (Narrow)", "category": PULL_CATEGORY},
    {"name": "Cable Row (Narrow)", "category": PULL_CATEGORY},
    {"name": "Cable Row (Wide)", "category": PULL_CATEGORY},
    {"name": "Machine Row", "category": PULL_CATEGORY},
    {"name": "Bicep Curls", "category": PULL_CATEGORY},
    {"name": "Machine Bicep Curls", "category": PULL_CATEGORY},
    {"name": "Rear Delts", "category": PULL_CATEGORY},
    {"name": "Shrugs", "category": PULL_CATEGORY},
    
    # Leg exercises
    {"name": "Leg Extensions", "category": LEG_CATEGORY},
    {"name": "Leg Press", "category": LEG_CATEGORY},
    {"name": "Reverse Leg Press", "category": LEG_CATEGORY},
    {"name": "Bed Hamstring Curl", "category": LEG_CATEGORY},
    {"name": "Manchester Hamstring Curl", "category": LEG_CATEGORY},
    {"name": "Inside Leg", "category": LEG_CATEGORY},
    {"name": "Outside Leg", "category": LEG_CATEGORY},
    {"name": "Sitting Calf Raises", "category": LEG_CATEGORY},
    {"name": "Crunch Machine", "category": LEG_CATEGORY},
    {"name": "Crunches", "category": LEG_CATEGORY},
]


def seed_exercises_for_all_users():
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

    supabase = create_client(supabase_url, supabase_key)

    try:
        existing = supabase.table("exercises").select("name").execute()
    except Exception:
        raise RuntimeError("Failed to check existing exercises before seeding.") from None

    existing_names = {
        (row.get("name") or "").strip().lower()
        for row in (existing.data or [])
    }

    seeded_count = 0
    for exercise in EXERCISES:
        exercise_name = exercise.get("name") if isinstance(exercise, dict) else exercise
        normalized = exercise_name.strip().lower()
        if normalized in existing_names:
            continue

        try:
            insert_data = {"name": exercise_name, "created_by": None}
            if isinstance(exercise, dict) and "category" in exercise:
                insert_data["category"] = exercise["category"]
            
            supabase.table("exercises").insert(insert_data).execute()
            seeded_count += 1
        except APIError as exc:
            if getattr(exc, "code", None) == "23505":
                # Another run may have inserted the same lower(name) concurrently.
                continue
            raise RuntimeError("Failed to insert a preset exercise.") from None
        except Exception:
            raise RuntimeError("Failed to insert a preset exercise.") from None

    print(f"Processed {len(EXERCISES)} preset exercises (created_by = NULL).")
    print(f"New exercises inserted: {seeded_count}")


if __name__ == "__main__":
    seed_exercises_for_all_users()