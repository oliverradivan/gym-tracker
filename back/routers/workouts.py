from fastapi import APIRouter, Depends, HTTPException

from ..data import exercises as exercise_data
from ..data import workout_logs
from ..dependencies import UserContext, get_current_user_context
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

    existing_exercise = exercise_data.get_exercise(
        client, payload.exercise_id, "id, category", "Exercise validation failed"
    )
    if not existing_exercise.data:
        raise HTTPException(status_code=404, detail="Exercise not found.")

    exercise_category = existing_exercise.data[0].get("category")
    try:
        validate_workout_log_payload(payload, exercise_category)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Next set number for this exercise on this day (instead of always 1).
    next_set_number = workout_logs.get_next_set_number(
        client, user.id, payload.exercise_id, payload.log_date
    )

    created = workout_logs.create_workout_log(
        client,
        {
            "user_id": user.id,
            "exercise_id": payload.exercise_id,
            "log_date": payload.log_date,
            "weight": payload.weight,
            "reps": payload.reps,
            "duration_seconds": payload.duration_seconds,
            "set_number": next_set_number,
        },
    )

    return {"message": "Workout logged successfully.", "log": created.data[0] if created.data else None}


@router.get("/workout-logs")
def get_workout_logs(
    exercise_id: str | None = None,
    user_context: UserContext = Depends(get_current_user_context),
):
    client, user = user_context

    result = workout_logs.list_user_workout_logs(client, user.id, exercise_id)

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

    deleted = workout_logs.delete_user_workout_log(client, user.id, log_id)

    if not deleted.data:
        raise HTTPException(status_code=404, detail="Workout not found.")

    return {"message": "Workout deleted successfully."}
