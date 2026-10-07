from supabase import Client

from ..exception_handlers import execute_query


def _user_logs_query(client: Client, user_id: str, columns: str):
    return client.table("workout_logs").select(columns).eq("user_id", user_id)


def get_next_set_number(
    client: Client,
    user_id: str,
    exercise_id: str,
    log_date: str,
) -> int:
    result = execute_query(
        _user_logs_query(client, user_id, "set_number")
        .eq("exercise_id", exercise_id)
        .eq("log_date", log_date)
        .order("set_number", desc=True)
        .limit(1),
        "Failed to save workout log",
    )
    return (result.data[0].get("set_number") or 0) + 1 if result.data else 1


def create_workout_log(client: Client, values: dict):
    return execute_query(
        client.table("workout_logs").insert(values),
        "Failed to save workout log",
    )


def list_user_workout_logs(
    client: Client,
    user_id: str,
    exercise_id: str | None = None,
):
    query = _user_logs_query(client, user_id, "*, exercises(name, category)")
    if exercise_id:
        query = query.eq("exercise_id", exercise_id)
    return execute_query(
        query.order("log_date", desc=True).order("created_at", desc=True),
        "Failed to load workout logs",
    )


def delete_user_workout_log(client: Client, user_id: str, log_id: str):
    return execute_query(
        client.table("workout_logs")
        .delete()
        .eq("id", log_id)
        .eq("user_id", user_id),
        "Failed to delete workout",
    )


def list_user_session_logs(client: Client, user_id: str):
    return execute_query(
        _user_logs_query(
            client,
            user_id,
            "id, exercise_id, log_date, weight, reps, duration_seconds, exercises(name, category)",
        ).order("log_date", desc=True),
        "Failed to load workout sessions",
    )


def list_user_exercise_progress(
    client: Client,
    user_id: str,
    exercise_id: str,
):
    return execute_query(
        _user_logs_query(
            client,
            user_id,
            "log_date, weight, reps, duration_seconds, created_at",
        )
        .eq("exercise_id", exercise_id)
        .order("log_date", desc=False)
        .order("created_at", desc=False),
        "Failed to load workout progress",
    )
