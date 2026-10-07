from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import UserContext, get_current_user_context
from ..exception_handlers import execute_query
from ..exercise_categories import normalize_exercise_category
from ..routers.exercises import validate_workout_log_payload
from ..schemas import WorkoutLogPayload

router = APIRouter(prefix="/api")


@router.post("/workout-logs")
def create_workout_log(
    payload: WorkoutLogPayload,
    user_context: UserContext = Depends(get_current_user_context),
):
    client, user = user_context

    existing_exercise = execute_query(
        client.table("exercises")
        .select("id, category")
        .eq("id", payload.exercise_id)
        .limit(1),
        "Exercise validation failed",
    )
    if not existing_exercise.data:
        raise HTTPException(status_code=404, detail="Exercise not found.")

    exercise_category = existing_exercise.data[0].get("category")
    try:
        validate_workout_log_payload(payload, exercise_category)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Next set number for this exercise on this day (instead of always 1).
    last_set = execute_query(
        client.table("workout_logs")
        .select("set_number")
        .eq("user_id", user.id)
        .eq("exercise_id", payload.exercise_id)
        .eq("log_date", payload.log_date)
        .order("set_number", desc=True)
        .limit(1),
        "Failed to save workout log",
    )
    next_set_number = (
        (last_set.data[0].get("set_number") or 0) + 1 if last_set.data else 1
    )

    created = execute_query(
        client.table("workout_logs").insert(
            {
                "user_id": user.id,
                "exercise_id": payload.exercise_id,
                "log_date": payload.log_date,
                "weight": payload.weight,
                "reps": payload.reps,
                "duration_seconds": payload.duration_seconds,
                "set_number": next_set_number,
            }
        ),
        "Failed to save workout log",
    )

    return {"message": "Workout logged successfully.", "log": created.data[0] if created.data else None}


@router.get("/workout-logs")
def get_workout_logs(
    exercise_id: str | None = None,
    user_context: UserContext = Depends(get_current_user_context),
):
    client, user = user_context

    query = client.table("workout_logs").select("*, exercises(name, category)").eq("user_id", user.id)
    if exercise_id:
        query = query.eq("exercise_id", exercise_id)

    result = execute_query(
        query.order("log_date", desc=True).order("created_at", desc=True),
        "Failed to load workout logs",
    )

    logs = []
    for log in result.data or []:
        exercise = log.get("exercises")
        category = exercise.get("category") if isinstance(exercise, dict) else None
        logs.append({
            **log,
            "exercise_category": normalize_exercise_category(category),
        })

    return {"logs": logs}


@router.delete("/workout-logs/{log_id}")
def delete_workout_log(
    log_id: str,
    user_context: UserContext = Depends(get_current_user_context),
):
    client, user = user_context

    deleted = execute_query(
        client.table("workout_logs")
        .delete()
        .eq("id", log_id)
        .eq("user_id", user.id),
        "Failed to delete workout",
    )

    if not deleted.data:
        raise HTTPException(status_code=404, detail="Workout not found.")

    return {"message": "Workout deleted successfully."}
