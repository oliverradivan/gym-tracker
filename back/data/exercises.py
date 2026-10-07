from fastapi import HTTPException
from postgrest.exceptions import APIError
from supabase import Client

from ..exception_handlers import DatabaseOperationError, execute_query


def list_visible_exercises(client: Client, user_id: str):
    return execute_query(
        client.table("exercises")
        .select("*")
        .or_(f"created_by.is.null,created_by.eq.{user_id}")
        .order("category")
        .order("name"),
        "Failed to load exercises",
    )


def ensure_exercise_name_available(admin_client: Client, name: str) -> None:
    visible = execute_query(
        admin_client.table("exercises").select("name"),
        "Failed to check exercise name",
    )
    wanted = name.casefold()
    if any(
        (row.get("name") or "").strip().casefold() == wanted
        for row in (visible.data or [])
    ):
        raise HTTPException(
            status_code=409,
            detail="An exercise with this name already exists.",
        )


def create_custom_exercise(
    admin_client: Client,
    name: str,
    category: str,
    user_id: str,
):
    try:
        return admin_client.table("exercises").insert(
            {
                "name": name,
                "category": category,
                "created_by": user_id,
            }
        ).execute()
    except APIError as exc:
        if getattr(exc, "code", None) == "23505":
            raise HTTPException(
                status_code=409,
                detail="An exercise with this name already exists.",
            ) from exc
        raise DatabaseOperationError("Failed to create exercise", exc.message) from exc


def get_exercise(client: Client, exercise_id: str, columns: str, operation: str):
    return execute_query(
        client.table("exercises")
        .select(columns)
        .eq("id", exercise_id)
        .limit(1),
        operation,
    )


def delete_custom_exercise(
    admin_client: Client,
    exercise_id: str,
    user_id: str,
) -> None:
    execute_query(
        admin_client.table("exercises")
        .delete()
        .eq("id", exercise_id)
        .eq("created_by", user_id),
        "Failed to delete exercise",
    )
