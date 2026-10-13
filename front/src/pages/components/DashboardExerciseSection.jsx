import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { EXERCISE_CATEGORIES, getExerciseCategory, } from '../../utils/exerciseCategory'
import { useClickOutside } from '../../hooks/useClickOutside'
import { ExerciseCategoryIcon } from './ExerciseCategoryIcon'
import DashboardIcon from './DashboardIcon'

const categories = Object.values(EXERCISE_CATEGORIES || {}).filter(
  (category) => typeof category === 'string' && category.length > 0
)

const CATEGORY_LABELS = { Leg: 'Legs' }
const SEARCH_THRESHOLD = 12

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

  // Custom dropdown state for category selection.
  const [categorySelectOpen, setCategorySelectOpen] = useState(false)
  const categorySelectRef = useRef(null)
  const [focusedOptionIndex, setFocusedOptionIndex] = useState(-1)

  // Library search and inline delete confirmation.
  const [query, setQuery] = useState('')
  const [confirmingId, setConfirmingId] = useState(null)
  const removeButtonRefs = useRef(new Map())

  const closeConfirm = (id) => {
    setConfirmingId(null)
    requestAnimationFrame(() => removeButtonRefs.current.get(id)?.focus())
  }

  useClickOutside(categorySelectRef, () => setCategorySelectOpen(false))

  // Keyboard navigation for category dropdown.
  useEffect(() => {
    const keydownHandler = (event) => {
      if (!categorySelectOpen) return

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setFocusedOptionIndex((i) =>
            i >= categories.length - 1 ? 0 : i + 1
          )
          break
        case 'ArrowUp':
          event.preventDefault()
          setFocusedOptionIndex((i) => (i <= 0 ? categories.length - 1 : i - 1))
          break
        case 'Enter':
          event.preventDefault()
          if (focusedOptionIndex >= 0 && categories.length > 0) {
            const category = categories[focusedOptionIndex]
            setCategorySelectOpen(false)
            handleChange({
              target: {
                name: 'category',
                value: category,
              },
            })
          }
          break
        case 'Escape':
          event.preventDefault()
          setCategorySelectOpen(false)
          setFocusedOptionIndex(-1)
          break
        default:
          break
      }
    }

    document.addEventListener('keydown', keydownHandler)
    return () => {
      document.removeEventListener('keydown', keydownHandler)
    }
  }, [categorySelectOpen, categories, focusedOptionIndex, handleChange])

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

  // Group the (already category-sorted) list, keeping the sort order.
  const normalizedQuery = query.trim().toLowerCase()
  const exerciseGroups = []
  sortedExerciseList
    .filter(
      (exercise) =>
        !normalizedQuery ||
        String(exercise.name ?? '').toLowerCase().includes(normalizedQuery)
    )
    .forEach((exercise) => {
      const category = getSafeCategory(exercise)
      let group = exerciseGroups.find((item) => item.category === category)
      if (!group) {
        group = { category, items: [] }
        exerciseGroups.push(group)
      }
      group.items.push(exercise)
    })

  return (
    <>
      <div className="dash-section-head">
        <h2 id="dash-library-title" className="dash-section-title">
          Your exercises
        </h2>

        <span className="dash-count">{exerciseList.length}</span>
      </div>

      <section
        className="dash-exercises"
        aria-labelledby="dash-library-title"
      >
        {exerciseList.length > SEARCH_THRESHOLD && (
          <div className="dash-field dash-search">
            <label htmlFor="exercise_search" className="dash-sr-only">
              Search exercises
            </label>
            <input
              id="exercise_search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search your exercises"
              autoComplete="off"
            />
          </div>
        )}

        {exerciseGroups.length > 0 ? (
          exerciseGroups.map(({ category, items }) => (
            <div
              key={category}
              className="dash-group"
              role="group"
              aria-labelledby={`dash-group-${category}`}
            >
              <h3 id={`dash-group-${category}`} className="dash-group-title">
                <span
                  className="dash-calendar-legend-dot"
                  data-category={category}
                  aria-hidden="true"
                />
                {CATEGORY_LABELS[category] ?? category}
                <span className="dash-group-count">{items.length}</span>
              </h3>

              <div className="dash-rows dash-rows-grid">
                {items.map((exercise) => {
                  const name = exercise.name ?? 'Unnamed exercise'
                  const isConfirming = confirmingId === exercise.id
                  const canRemove =
                    exercise.created_by &&
                    user?.id &&
                    exercise.created_by === user.id

                  return (
                    <div
                      key={exercise.id ?? exercise.name}
                      className={`dash-row dash-row-compact activity-row exercise-card ${
                        exercise.unit === 'km'
                          ? 'exercise-card--run'
                          : 'exercise-card--general'
                      }${isConfirming ? ' is-confirming' : ''}`}
                      data-category={category}
                    >
                      <span className="dash-row-tile" aria-hidden="true">
                        <ExerciseCategoryIcon category={category} />
                      </span>

                      {isConfirming ? (
                        <div
                          className="dash-row-confirm"
                          role="group"
                          aria-label={`Confirm removing ${name}`}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                              event.stopPropagation()
                              closeConfirm(exercise.id)
                            }
                          }}
                        >
                          <p className="dash-row-confirm-text">
                            Delete “{name}” and all its logs? This can’t be
                            undone.
                          </p>
                          <div className="dash-row-confirm-actions">
                            {/* Safe default: focus lands on Keep, not Delete. */}
                            <button
                              type="button"
                              className="dash-btn dash-btn--sm dash-btn--ghost"
                              autoFocus
                              onClick={() => closeConfirm(exercise.id)}
                            >
                              Keep
                            </button>
                            <button
                              type="button"
                              className="dash-btn dash-btn--sm dash-btn--danger"
                              disabled={deletingExerciseId === exercise.id}
                              onClick={(event) => {
                                setConfirmingId(null)
                                handleDeleteExercise?.(event, exercise)
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <Link
                            to={`/progress/${exercise.id}`}
                            className="dash-row-title dash-row-link"
                          >
                            {name}
                          </Link>

                          {canRemove && (
                            <button
                              type="button"
                              className="dash-remove-btn"
                              ref={(node) => {
                                if (node) removeButtonRefs.current.set(exercise.id, node)
                                else removeButtonRefs.current.delete(exercise.id)
                              }}
                              onClick={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                setConfirmingId(exercise.id)
                              }}
                              disabled={deletingExerciseId === exercise.id}
                              aria-label={`Remove ${name}`}
                              title="Remove exercise"
                            >
                              <DashboardIcon>
                                <circle cx="12" cy="12" r="10" />
                                <path d="M14.5 9.5l-5 5M9.5 9.5l5 5" />
                              </DashboardIcon>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        ) : (
          <p className="dash-empty-note">
            {exerciseList.length === 0
              ? 'No exercises yet. Add one below.'
              : `No exercises match “${query.trim()}”.`}
          </p>
        )}
      </section>

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

            <div
              className="custom-select"
              ref={categorySelectRef}
              onClick={() => setCategorySelectOpen((prev) => !prev)}
            >
              <button
                type="button"
                className={`custom-select-trigger select-${selectedCategory.toLowerCase()}`}
                onClick={(event) => {
                  event.stopPropagation()
                  setCategorySelectOpen((prev) => !prev)
                }}
              >
                <span>{selectedCategory}</span>
                <span
                  className={`custom-select-arrow ${categorySelectOpen ? 'open' : ''}`}
                  aria-hidden="true"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </button>
              {categorySelectOpen && (
                <ul className="custom-select-list">
                  {categories.map((category, index) => (
                    <li
                      key={category}
                      className={
                        `custom-select-option option-${category.toLowerCase()}${selectedCategory === category ? ' selected' : ''}${focusedOptionIndex === index ? ' focused' : ''}`
                      }
                      onMouseDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        setCategorySelectOpen(false)
                        handleChange({
                          target: {
                            name: 'category',
                            value: category,
                          },
                        })
                      }}
                      onMouseOver={() => setFocusedOptionIndex(index)}
                    >
                      {category}
                    </li>
                  ))}
                  {categories.length === 0 && (
                    <li>
                      <span>Other</span>
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>

          <button type="submit" className="dash-btn">
            Add Exercise
          </button>
        </form>
      </section>
    </>
  )
}