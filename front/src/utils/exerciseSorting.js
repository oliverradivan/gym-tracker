import { getExerciseCategory } from './exerciseCategory'

export function sortExercisesByCategory(exercises) {
  return [...exercises].sort((a, b) => {
    const categoryOrder = getExerciseCategory(a).localeCompare(
      getExerciseCategory(b)
    )
    return categoryOrder || (a.name || '').localeCompare(b.name || '')
  })
}
