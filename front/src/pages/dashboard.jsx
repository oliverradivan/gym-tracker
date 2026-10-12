import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { EXERCISE_CATEGORIES, getExerciseCategory, } from '../utils/exerciseCategory'
import { ExerciseCategoryIcon } from './components/ExerciseCategoryIcon'
import DashboardIcon from './components/DashboardIcon'

const categories = Object.values(EXERCISE_CATEGORIES)

const getCategoryClass = (category) =>
  String(category || 'Other').toLowerCase()

export default function DashboardExerciseSection({
  exercises,
  sortedExercises,
  user,
  handleDeleteExercise,
  deletingExerciseId,
  form,
  handleChange,
  handleCreateExercise,
}) {
  const [categoryOpen, setCategoryOpen] = useState(false)
  const categorySelectRef = useRef(null)
  const categoryTriggerRef = useRef(null)
  const categoryOptionRefs = useRef([])

  const selectedCategory = categories.includes(form.category)
    ? form.category
    : EXERCISE_CATEGORIES.OTHER

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (
        categorySelectRef.current &&
        !categorySelectRef.current.contains(event.target)
      ) {
        setCategoryOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setCategoryOpen(false)
        categoryTriggerRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const handleSelectCategory = (category) => {
    handleChange({
      target: {
        name: 'category',
        value: category,
      },
    })

    setCategoryOpen(false)
    categoryTriggerRef.current?.focus()
  }

  const handleCategoryKeyDown = (event, index) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()

      if (!categoryOpen) {
        setCategoryOpen(true)
        requestAnimationFrame(() => {
          categoryOptionRefs.current[0]?.focus()
        })
        return
      }

      categoryOptionRefs.current[
        (index + 1) % categories.length
      ]?.focus()
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()

      if (!categoryOpen) {
        setCategoryOpen(true)
        requestAnimationFrame(() => {
          categoryOptionRefs.current[categories.length - 1]?.focus()
        })
        return
      }

      categoryOptionRefs.current[
        (index - 1 + categories.length) % categories.length
      ]?.focus()
    }

    if (event.key === 'Home') {
      event.preventDefault()
      categoryOptionRefs.current[0]?.focus()
    }

    if (event.key === 'End') {
      event.preventDefault()
      categoryOptionRefs.current[categories.length - 1]?.focus()
    }
  }

  return (
    <>
      <div className="dash-section-head">
        <h2 id="dash-library-title" className="dash-section-title">
          Your exercises
        </h2>

        <span className="dash-count">{exercises.length}</span>
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
            Can't find what you're looking for? Add it to your exercise library.
          </p>
        </div>

        <form onSubmit={handleCreateExercise} className="dash-create-form">
          <div className="dash-field">
            <label htmlFor="exercise_name">Exercise name</label>

            <input
              id="exercise_name"
              type="text"
              name="exercise_name"
              value={form.exercise_name}
              onChange={handleChange}
              placeholder="e.g. Incline Bench Press"
              required
            />
          </div>

          <div className="dash-field dash-category-field">
            <label id="exercise_category_label">
              Category
            </label>

            <div
              className="dash-category-select"
              ref={categorySelectRef}
            >
              <button
                ref={categoryTriggerRef}
                id="exercise_category"
                type="button"
                className={`dash-category-trigger category-${getCategoryClass(
                  selectedCategory
                )}${categoryOpen ? ' is-open' : ''}`}
                aria-labelledby="exercise_category_label exercise_category_value"
                aria-haspopup="listbox"
                aria-expanded={categoryOpen}
                aria-controls="exercise-category-listbox"
                onClick={() => setCategoryOpen((previous) => !previous)}
                onKeyDown={(event) => handleCategoryKeyDown(event, -1)}
              >
                <span className="dash-category-trigger-content">
                  <span
                    className="dash-category-dot"
                    aria-hidden="true"
                  />

                  <span id="exercise_category_value">
                    {selectedCategory}
                  </span>
                </span>

                <span
                  className={`dash-category-arrow${categoryOpen ? ' open' : ''}`}
                  aria-hidden="true"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </button>

              {categoryOpen && (
                <ul
                  id="exercise-category-listbox"
                  className="dash-category-list"
                  role="listbox"
                  aria-labelledby="exercise_category_label"
                >
                  {categories.map((category, index) => {
                    const categoryClass = getCategoryClass(category)
                    const isSelected = category === selectedCategory

                    return (
                      <li
                        key={category}
                        className="dash-category-option-wrap"
                        role="presentation"
                      >
                        <button
                          ref={(element) => {
                            categoryOptionRefs.current[index] = element
                          }}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          tabIndex={isSelected ? 0 : -1}
                          className={`dash-category-option option-${categoryClass}${
                            isSelected ? ' selected' : ''
                          }`}
                          onClick={() => handleSelectCategory(category)}
                          onKeyDown={(event) =>
                            handleCategoryKeyDown(event, index)
                          }
                        >
                          <span
                            className="dash-category-option-dot"
                            aria-hidden="true"
                          />

                          <span>{category}</span>

                          {isSelected && (
                            <svg
                              className="dash-category-check"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              aria-hidden="true"
                            >
                              <path d="m5 12 4 4L19 6" />
                            </svg>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
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
        {sortedExercises.length ? (
          <div className="dash-rows dash-rows-grid">
            {sortedExercises.map((exercise) => (
              <div
                key={exercise.id}
                className={`dash-row dash-row-compact activity-row exercise-card ${
                  exercise.unit === 'km'
                    ? 'exercise-card--run'
                    : 'exercise-card--general'
                }`}
                data-category={getExerciseCategory(exercise)}
              >
                <span className="dash-row-tile" aria-hidden="true">
                  <ExerciseCategoryIcon
                    category={getExerciseCategory(exercise)}
                  />
                </span>

                <Link
                  to={`/progress/${exercise.id}`}
                  className="dash-row-title dash-row-link"
                >
                  {exercise.name}
                </Link>

                {exercise.created_by === user?.id && (
                  <button
                    type="button"
                    className="dash-remove-btn"
                    onClick={(event) =>
                      handleDeleteExercise(event, exercise)
                    }
                    disabled={deletingExerciseId === exercise.id}
                    aria-label={`Remove ${exercise.name}`}
                    title="Remove exercise"
                  >
                    <DashboardIcon>
                      <circle cx="12" cy="12" r="10" />
                      <path d="M14.5 9.5l-5 5M9.5 9.5l5 5" />
                    </DashboardIcon>
                  </button>
                )}
              </div>
            ))}
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