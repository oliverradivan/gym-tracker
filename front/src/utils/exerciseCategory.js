export const EXERCISE_CATEGORIES = Object.freeze({
  PUSH: 'Push',
  PULL: 'Pull',
  LEG: 'Leg',
  CARDIO: 'Cardio',
  OTHER: 'Other',
})

export const CATEGORY_COLORS = {
  [EXERCISE_CATEGORIES.LEG]: '#b7791f',
  [EXERCISE_CATEGORIES.PUSH]: '#b91c1c',
  [EXERCISE_CATEGORIES.PULL]: '#1d4ed8',
  [EXERCISE_CATEGORIES.CARDIO]: '#39904d',
  [EXERCISE_CATEGORIES.OTHER]: '#64748b',
}

export function getExerciseCategory(exercise) {
  const category = exercise?.exercise_category
  const normalized =
    typeof category === 'string' ? category.trim().toLowerCase() : ''
  return Object.values(EXERCISE_CATEGORIES).find(
    (allowed) => allowed.toLowerCase() === normalized
  ) || EXERCISE_CATEGORIES.OTHER
}

export function getExerciseCategoryColor(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS[EXERCISE_CATEGORIES.OTHER]
}
