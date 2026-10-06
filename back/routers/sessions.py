from fastapi import APIRouter, Header, HTTPException
from postgrest.exceptions import APIError

from ..data_access import get_authenticated_user, get_supabase
from ..exercise_categories import CARDIO_CATEGORY, normalize_exercise_category

router = APIRouter(prefix="/api")


def build_progress_series(rows, is_cardio: bool = False):
    if is_cardio:
        result = []
        for row in rows or []:
            date_value = row.get("log_date")
            duration = row.get("duration_seconds")
            if not date_value or duration is None or int(duration) <= 0:
                continue
            result.append({
                "date": date_value,
                "duration_seconds": int(duration),
            })
        return result

    grouped = {}

    for row in rows or []:
        date_value = row.get("log_date")
        if not date_value:
            continue

        weight = float(row.get("weight") or 0)
        reps = float(row.get("reps") or 0)
        volume = weight * reps

        if date_value not in grouped:
            grouped[date_value] = {"date": date_value, "volume": 0.0, "reps": 0.0, "weight": 0.0}

        grouped[date_value]["volume"] += volume
        grouped[date_value]["reps"] += reps
        grouped[date_value]["weight"] += weight

    result = []
    for date_value in sorted(grouped):
        entry = grouped[date_value]
        volume_value = entry["volume"]
        if float(volume_value).is_integer():
            volume_value = int(volume_value)

        reps_value = entry["reps"]
        if float(reps_value).is_integer():
            reps_value = int(reps_value)

        weight_value = entry["weight"]
        if float(weight_value).is_integer():
            weight_value = int(weight_value)

        result.append({
            "date": entry["date"],
            "volume": volume_value,
            "reps": reps_value,
            "weight": weight_value,
        })

    return result


def build_session_summary(rows):
    grouped = {}

    for row in rows or []:
        date_value = row.get("log_date")
        if not date_value:
            continue

        exercise = row.get("exercises")
        exercise_name = exercise.get("name") if isinstance(exercise, dict) else None
        if not exercise_name:
            exercise_name = "Unknown Exercise"
        exercise_category = normalize_exercise_category(
            exercise.get("category") if isinstance(exercise, dict) else None
        )

        is_cardio = exercise_category == CARDIO_CATEGORY
        weight_val = float(row.get("weight") or 0) if not is_cardio else 0
        reps_val = float(row.get("reps") or 0) if not is_cardio else 0
        weight = int(weight_val) if weight_val.is_integer() else weight_val
        reps = int(reps_val) if reps_val.is_integer() else reps_val
        duration = row.get("duration_seconds") if is_cardio else None
        duration = int(duration) if duration is not None else None
        volume = weight_val * reps_val
        if float(volume).is_integer():
            volume = int(volume)
        log_id = row.get("id")
        exercise_id = row.get("exercise_id")

        if date_value not in grouped:
            grouped[date_value] = {"date": date_value, "total_volume": 0.0, "entries": []}

        grouped[date_value]["total_volume"] += volume
        grouped[date_value]["entries"].append(
            {
                "log_id": log_id,
                "exercise_id": exercise_id,
                "exercise_name": exercise_name,
                "exercise_category": exercise_category,
                "weight": None if is_cardio else weight,
                "reps": None if is_cardio else reps,
                "volume": volume,
                "duration_seconds": duration,
            }
        )

    result = []
    for date_value in sorted(grouped, reverse=True):
        session = grouped[date_value]
        volume_value = session["total_volume"]
        if float(volume_value).is_integer():
            volume_value = int(volume_value)
        result.append({
            "date": session["date"],
            "total_volume": volume_value,
            "entries": session["entries"],
        })

    return result


@router.get("/workout-sessions")
def get_workout_sessions(authorization: str | None = Header(default=None)):
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    user = get_authenticated_user(authorization)

    try:
        result = (
            client.table("workout_logs")
            .select("id, exercise_id, log_date, weight, reps, duration_seconds, exercises(name, category)")
            .eq("user_id", user.id)
            .order("log_date", desc=True)
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to load workout sessions: {exc.message}") from exc

    return {"sessions": build_session_summary(result.data or [])}


@router.get("/workout-logs/progress")
def get_workout_progress(
    exercise_id: str,
    authorization: str | None = Header(default=None),
):
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=500, detail="Supabase is not configured.")

    user = get_authenticated_user(authorization)

    try:
        exercise_result = (
            client.table("exercises")
            .select("category")
            .eq("id", exercise_id)
            .limit(1)
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to load exercise: {exc.message}") from exc

    if not exercise_result.data:
        raise HTTPException(status_code=404, detail="Exercise not found.")
    exercise_category = normalize_exercise_category(
        exercise_result.data[0].get("category")
    )
    is_cardio = exercise_category == CARDIO_CATEGORY

    try:
        result = (
            client.table("workout_logs")
            .select("log_date, weight, reps, duration_seconds, created_at")
            .eq("user_id", user.id)
            .eq("exercise_id", exercise_id)
            .order("log_date", desc=False)
            .order("created_at", desc=False)
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to load workout progress: {exc.message}") from exc

    return {
        "progress": build_progress_series(result.data or [], is_cardio=is_cardio),
        "exercise_category": exercise_category,
    }
