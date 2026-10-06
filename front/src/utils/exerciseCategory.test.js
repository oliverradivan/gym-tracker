import { describe, expect, it } from 'vitest'
import {
  EXERCISE_CATEGORIES,
  getExerciseCategory,
  getExerciseCategoryColor,
} from './exerciseCategory'

describe('exercise category response helper', () => {
  it('uses allowed casing and defaults missing or unknown categories to Other', () => {
    expect(EXERCISE_CATEGORIES).toEqual({
      PUSH: 'Push',
      PULL: 'Pull',
      LEG: 'Leg',
      CARDIO: 'Cardio',
      OTHER: 'Other',
    })
    expect(getExerciseCategory({ exercise_category: 'cardio' }))
      .toBe(EXERCISE_CATEGORIES.CARDIO)
    expect(getExerciseCategory({ exercise_category: 'push' }))
      .toBe(EXERCISE_CATEGORIES.PUSH)
    expect(getExerciseCategory({ exercise_category: 'Unknown' }))
      .toBe(EXERCISE_CATEGORIES.OTHER)
    expect(getExerciseCategory({})).toBe(EXERCISE_CATEGORIES.OTHER)
  })

  it('maps backend categories to the corresponding chart colors', () => {
    expect(getExerciseCategoryColor(getExerciseCategory({ exercise_category: 'pull' })))
      .toBe('#1d4ed8')
    expect(getExerciseCategoryColor(EXERCISE_CATEGORIES.OTHER)).toBe('#64748b')
  })
})
