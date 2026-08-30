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
    users_response = supabase.auth.admin.list_users()

    if isinstance(users_response, list):
        users = users_response
    elif hasattr(users_response, "users"):
        users = users_response.users
    elif hasattr(users_response, "user"):
        users = users_response.user
    else:
        users = []

    if not users:
        print("No users found. Nothing to seed.")
        return

    seeded_count = 0
    for user in users:
        user_id = getattr(user, "id", None) or user.get("id")
        if not user_id:
            continue

        try:
            existing = (
                supabase.table("exercises")
                .select("name")
                .eq("user_id", user_id)
                .execute()
            )
            existing_names = {
                (row.get("name") or "").strip().lower()
                for row in (existing.data or [])
            }
        except Exception as exc:
            print(f"Failed to fetch existing exercises for user {user_id}: {exc}")
            existing_names = set()

        for exercise_name in EXERCISES:
            normalized = exercise_name.strip().lower()
            if normalized in existing_names:
                continue

            try:
                supabase.table("exercises").insert({
                    "user_id": user_id,
                    "name": exercise_name,
                }).execute()
                seeded_count += 1
            except Exception as exc:
                print(f"Skipping {exercise_name} for user {user_id}: {exc}")

    print(f"Seeded {len(EXERCISES)} exercises for {len(users)} user(s).")
    print(f"New rows inserted: {seeded_count}")


if __name__ == "__main__":
    seed_exercises_for_all_users()
