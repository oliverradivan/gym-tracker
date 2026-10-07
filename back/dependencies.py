from fastapi import Header
from supabase import Client
from supabase_auth.types import User

from .data_access import get_user_context

UserContext = tuple[Client, User]


def get_current_user_context(
    authorization: str | None = Header(default=None),
) -> UserContext:
    return get_user_context(authorization)
