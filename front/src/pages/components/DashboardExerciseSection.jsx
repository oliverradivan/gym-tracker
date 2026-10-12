import { Link } from 'react-router-dom'
import {
  EXERCISE_CATEGORIES,
  getExerciseCategory,
} from '../../utils/exerciseCategory'
import { ExerciseCategoryIcon } from './ExerciseCategoryIcon'
import DashboardIcon from './DashboardIcon'

const categories = Object.values(EXERCISE_CATEGORIES || {}).filter(
  (category) => typeof category === 'string' && category.length > 0
)

export default function DashboardExerciseSection({
  exercises = [],
  sortedExercises = [],
  user,
  handleDeleteExercise,
  deletingExerciseId,
  form = {},
  handleChange,
  handleCreateExercise,
}) {
  const exerciseList = Array.isArray(exercises) ? exercises : []
  const sortedExerciseList = Array.isArray(sortedExercises)
    ? sortedExercises.filter(
        (exercise) => exercise && typeof exercise === 'object'
      )
    : []

  // Provide safe defaults for the form.
  const formName = form?.exercise_name ?? ''
  const selectedCategory = categories.includes(form?.category)
    ? form.category
    : categories[0] ?? 'Other'

  // Safely resolve each exercise's category.
  const getSafeCategory = (exercise) => {
    if (!exercise || typeof exercise !== 'object') {
      return 'Other'
    }

    try {
      return getExerciseCategory(exercise) || 'Other'
    } catch {
      return exercise.category || 'Other'
    }
  }

  return (
    <>
      <div className="dash-section-head">
        <h2 id="dash-library-title" className="dash-section-title">
          Your exercises
        </h2>

        <span className="dash-count">{exerciseList.length}</span>
      </div>

      <section
        className="dash-card dash-create"
        aria-labelledby="dash-create-title"
      >
        <div>
          <h2 id="dash-create-title" className="dash-section-title">
            Add an exercise
          </h2>

          <p className="dash-create-copy">
            Can't find what you're looking for? Add it to your exercise
            library.
          </p>
        </div>

        <form onSubmit={handleCreateExercise} className="dash-create-form">
          <div className="dash-field">
            <label htmlFor="exercise_name">Exercise name</label>

            <input
              id="exercise_name"
              type="text"
              name="exercise_name"
              value={formName}
              onChange={handleChange}
              placeholder="e.g. Incline Bench Press"
              required
            />
          </div>

          <div className="dash-field">
            <label htmlFor="exercise_category">Category</label>

            <select
              id="exercise_category"
              name="category"
              value={selectedCategory}
              onChange={handleChange}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}

              {categories.length === 0 && (
                <option value="Other">Other</option>
              )}
            </select>
          </div>

          <button type="submit" className="dash-btn">
            Add Exercise
          </button>
        </form>
      </section>

      <section
        className="dash-exercises"
        aria-labelledby="dash-library-title"
      >
        {sortedExerciseList.length > 0 ? (
          <div className="dash-rows dash-rows-grid">
            {sortedExerciseList.map((exercise) => {
              const category = getSafeCategory(exercise)

              return (
                <div
                  key={exercise.id ?? exercise.name}
                  className={`dash-row dash-row-compact activity-row exercise-card ${
                    exercise.unit === 'km'
                      ? 'exercise-card--run'
                      : 'exercise-card--general'
                  }`}
                  data-category={category}
                >
                  <span className="dash-row-tile" aria-hidden="true">
                    <ExerciseCategoryIcon category={category} />
                  </span>

                  <Link
                    to={`/progress/${exercise.id}`}
                    className="dash-row-title dash-row-link"
                  >
                    {exercise.name ?? 'Unnamed exercise'}
                  </Link>

                  {exercise.created_by &&
                    user?.id &&
                    exercise.created_by === user.id && (
                      <button
                        type="button"
                        className="dash-remove-btn"
                        onClick={(event) =>
                          handleDeleteExercise?.(event, exercise)
                        }
                        disabled={deletingExerciseId === exercise.id}
                        aria-label={`Remove ${
                          exercise.name ?? 'exercise'
                        }`}
                        title="Remove exercise"
                      >
                        <DashboardIcon>
                          <circle cx="12" cy="12" r="10" />
                          <path d="M14.5 9.5l-5 5M9.5 9.5l5 5" />
                        </DashboardIcon>
                      </button>
                    )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="dash-empty-note">
            No exercises yet. Create one above.
          </p>
        )}
      </section>
    </>
  )
}