from fastapi import APIRouter, Header, HTTPException
from postgrest.exceptions import APIError

from ..data_access import get_authenticated_user, get_supabase
from ..routers.exercises import validate_workout_log_payload
from ..schemas import WorkoutLogPayload

router = APIRouter(prefix="/api")


@router.post("/workout-logs")
def create_workout_log(
    payload: WorkoutLogPayload,
    authorization: str | None = Header(default=None),
):
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    user = get_authenticated_user(authorization)

    try:
        existing_exercise = (
            client.table("exercises")
            .select("id, category")
            .eq("id", payload.exercise_id)
            .limit(1)
            .execute()
        )
        if not existing_exercise.data:
            raise HTTPException(status_code=404, detail="Exercise not found.")
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Exercise validation failed: {exc.message}") from exc

    exercise_category = existing_exercise.data[0].get("category")
    try:
        validate_workout_log_payload(payload, exercise_category)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        # Next set number for this exercise on this day (instead of always 1).
        last_set = (
            client.table("workout_logs")
            .select("set_number")
            .eq("user_id", user.id)
            .eq("exercise_id", payload.exercise_id)
            .eq("log_date", payload.log_date)
            .order("set_number", desc=True)
            .limit(1)
            .execute()
        )
        next_set_number = (
            (last_set.data[0].get("set_number") or 0) + 1 if last_set.data else 1
        )

        created = (
            client.table("workout_logs")
            .insert(
                {
                    "user_id": user.id,
                    "exercise_id": payload.exercise_id,
                    "log_date": payload.log_date,
                    "weight": payload.weight,
                    "reps": payload.reps,
                    "duration_seconds": payload.duration_seconds,
                    "set_number": next_set_number,
                }
            )
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to save workout log: {exc.message}") from exc

    return {"message": "Workout logged successfully.", "log": created.data[0] if created.data else None}


@router.get("/workout-logs")
def get_workout_logs(
    exercise_id: str | None = None,
    authorization: str | None = Header(default=None),
):
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    user = get_authenticated_user(authorization)

    query = client.table("workout_logs").select("*, exercises(name)").eq("user_id", user.id)
    if exercise_id:
        query = query.eq("exercise_id", exercise_id)

    try:
        result = query.order("log_date", desc=True).order("created_at", desc=True).execute()
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to load workout logs: {exc.message}") from exc

    return {"logs": result.data}


@router.delete("/workout-logs/{log_id}")
def delete_workout_log(
    log_id: str,
    authorization: str | None = Header(default=None),
):
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    user = get_authenticated_user(authorization)

    try:
        deleted = (
            client.table("workout_logs")
            .delete()
            .eq("id", log_id)
            .eq("user_id", user.id)
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to delete workout: {exc.message}") from exc

    if not deleted.data:
        raise HTTPException(status_code=404, detail="Workout not found.")

    return {"message": "Workout deleted successfully."}
