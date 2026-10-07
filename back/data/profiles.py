from supabase import Client

from ..exception_handlers import execute_query


def username_exists(
    client: Client,
    username: str,
    exclude_user_id: str | None = None,
) -> bool:
    query = client.table("profiles").select("username").eq("username", username)
    if exclude_user_id:
        query = query.neq("id", exclude_user_id)
    result = execute_query(query.limit(1), "Database error")
    return bool(result.data)


def get_email_for_username(client: Client, username: str) -> str | None:
    result = execute_query(
        client.table("profiles")
        .select("email")
        .eq("username", username)
        .limit(1),
        "",
    )
    return result.data[0]["email"] if result.data else None


def create_profile(client: Client, profile: dict):
    return client.table("profiles").upsert(profile, on_conflict="id").execute()


def update_profile_username(client: Client, user_id: str, username: str) -> None:
    execute_query(
        client.table("profiles")
        .update({"username": username})
        .eq("id", user_id),
        "Failed to update username",
    )


def get_profile(client: Client, user_id: str):
    result = execute_query(
        client.table("profiles")
        .select("*")
        .eq("id", user_id)
        .limit(1),
        "Failed to load profile",
    )
    return result.data[0] if result.data else None


def delete_profile(client: Client, user_id: str) -> None:
    execute_query(
        client.table("profiles").delete().eq("id", user_id),
        "Failed to delete profile",
    )


def restore_profile(client: Client, profile: dict) -> None:
    execute_query(
        client.table("profiles").upsert(profile, on_conflict="id"),
        "Failed to restore profile",
    )
