import re

from fastapi import APIRouter, Header, HTTPException
from postgrest.exceptions import APIError

from ..data_access import get_admin_client, get_user_context
from ..exercise_categories import (
    CARDIO_CATEGORY,
    normalize_exercise_category,
)
from ..schemas import ExercisePayload, ExerciseUpdatePayload, WorkoutLogPayload

router = APIRouter(prefix="/api")

def serialize_exercise(exercise: dict) -> dict:
    return {
        **exercise,
        "exercise_category": normalize_exercise_category(exercise.get("category")),
    }


get_exercise_category = normalize_exercise_category


def validate_workout_log_payload(
    payload: WorkoutLogPayload, exercise_category: str | None
) -> None:
    category = normalize_exercise_category(exercise_category)
    if category == CARDIO_CATEGORY:
        if payload.duration_seconds is None or payload.duration_seconds <= 0:
            raise ValueError("Duration must be greater than zero for cardio exercises.")
        if payload.weight is not None or payload.reps is not None:
            raise ValueError("Weight and reps are not accepted for cardio exercises.")
        return

    if payload.duration_seconds is not None:
        raise ValueError("Duration is only accepted for cardio exercises.")
    if payload.weight is None:
        raise ValueError("Weight is required for non-cardio exercises.")
    if payload.reps is None:
        raise ValueError("Reps are required for non-cardio exercises.")
    if payload.weight < 0:
        raise ValueError("Weight must be zero or greater.")
    if payload.reps <= 0:
        raise ValueError("Reps must be greater than zero.")


def normalize_exercise_name(raw_name: str) -> str:
    cleaned = (raw_name or "").strip()
    cleaned = re.sub(r"[_-]+", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = cleaned.strip()

    if not cleaned:
        raise ValueError("Exercise name is required.")
    if len(cleaned) > 80:
        raise ValueError("Exercise name must be 80 characters or fewer.")

    return cleaned


@router.get("/exercises")
def list_exercises(authorization: str | None = Header(default=None)):
    client, user = get_user_context(authorization)

    try:
        result = (
            client.table("exercises")
            .select("*")
            # Global exercises (created_by is null) plus this user's own custom ones.
            .or_(f"created_by.is.null,created_by.eq.{user.id}")
            .order("category")
            .order("name")
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to load exercises: {exc.message}") from exc

    return {"exercises": [serialize_exercise(exercise) for exercise in (result.data or [])]}


@router.post("/exercises")
def create_exercise(
    payload: ExercisePayload,
    authorization: str | None = Header(default=None),
):
    client, user = get_user_context(authorization)

    try:
        name = normalize_exercise_name(payload.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        visible = (
            get_admin_client().table("exercises")
            .select("name")
            .execute()
        )
        # Compare in Python instead of using ilike: ilike treats % and _ as
        # wildcards, so a name like "b%" would match "Bench Press". Names are
        # unique globally, including exercises owned by other users.
        wanted = name.casefold()
        match = next(
            (
                row
                for row in (visible.data or [])
                if (row.get("name") or "").strip().casefold() == wanted
            ),
            None,
        )
        if match:
            raise HTTPException(
                status_code=409,
                detail="An exercise with this name already exists.",
            )
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to check exercise name: {exc.message}") from exc

    try:
        created = (
            get_admin_client().table("exercises")
            # created_by makes this exercise private to the user who added it -
            # it will not show up in anyone else's exercise list.
            .insert(
                {
                    "name": name,
                    "category": payload.category,
                    "created_by": user.id,
                }
            )
            .execute()
        )
    except APIError as exc:
        if getattr(exc, "code", None) == "23505":
            raise HTTPException(
                status_code=409,
                detail="An exercise with this name already exists.",
            ) from exc
        raise HTTPException(status_code=400, detail=f"Failed to create exercise: {exc.message}") from exc

    return {"exercise": serialize_exercise(created.data[0]), "created": True}


@router.patch("/exercises/{exercise_id}")
def update_exercise(
    exercise_id: str,
    payload: ExerciseUpdatePayload,
    authorization: str | None = Header(default=None),
):
    get_user_context(authorization)

    raise HTTPException(status_code=403, detail="Exercise updates are not allowed. Exercises are managed globally.")


@router.delete("/exercises/{exercise_id}")
def delete_exercise(
    exercise_id: str,
    authorization: str | None = Header(default=None),
):
    client, user = get_user_context(authorization)

    try:
        existing = (
            client.table("exercises")
            .select("id, created_by")
            .eq("id", exercise_id)
            .limit(1)
            .execute()
        )
    except APIError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to look up exercise: {exc.message}") from exc

    if not existing.data:
        raise HTTPException(status_code=404, detail="Exercise not found.")

    exercise_row = existing.data[0]
    if exercise_row.get("created_by") != user.id:
        # Global exercises (created_by is null) and other users' custom
        # exercises can't be removed - only the exercise's own creator can.
        raise HTTPException(
            status_code=403,
            detail="You can only delete exercises you created yourself.",
        )

    try:
        get_admin_client().table("exercises").delete().eq("id", exercise_id).eq(
            "created_by", user.id
        ).execute()
    except APIError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to delete exercise: {exc.message}",
        ) from exc

    return {"message": "Exercise deleted successfully."}
