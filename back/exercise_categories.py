EXERCISE_CATEGORIES = ("Push", "Pull", "Leg", "Cardio", "Other")
PUSH_CATEGORY, PULL_CATEGORY, LEG_CATEGORY, CARDIO_CATEGORY, OTHER_CATEGORY = (
    EXERCISE_CATEGORIES
)


def normalize_exercise_category(category: str | None) -> str:
    normalized = (category or "").strip().casefold()
    return next(
        (
            allowed
            for allowed in EXERCISE_CATEGORIES
            if allowed.casefold() == normalized
        ),
        OTHER_CATEGORY,
    )
