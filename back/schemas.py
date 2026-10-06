from pydantic import BaseModel, Field, field_validator

from .exercise_categories import EXERCISE_CATEGORIES, OTHER_CATEGORY


class PredictionsPayload(BaseModel):
    points: list[dict[str, str | float | int]]
    periods: int = 7
    interval_days: int = 1
    exercise_id: str | None = None
    category: str | None = None


class RegisterPayload(BaseModel):
    username: str
    email: str
    password: str


class LoginPayload(BaseModel):
    username: str | None = None
    email: str | None = None
    password: str


class RefreshPayload(BaseModel):
    refresh_token: str


class WorkoutPayload(BaseModel):
    workout_name: str
    duration_minutes: int
    workout_date: str
    notes: str | None = None


class UpdateUsernamePayload(BaseModel):
    username: str


class UpdatePasswordPayload(BaseModel):
    current_password: str
    new_password: str


class DeleteAccountPayload(BaseModel):
    password: str


class ExercisePayload(BaseModel):
    name: str
    category: str = OTHER_CATEGORY

    @field_validator("category")
    @classmethod
    def validate_category(cls, category: str) -> str:
        if category not in EXERCISE_CATEGORIES:
            allowed = ", ".join(EXERCISE_CATEGORIES)
            raise ValueError(f"Category must be one of: {allowed}.")
        return category


class ExerciseUpdatePayload(BaseModel):
    name: str


class WorkoutLogPayload(BaseModel):
    exercise_id: str
    log_date: str
    weight: float | None = None
    reps: float | None = None
    duration_seconds: int | None = Field(default=None, strict=True)
