import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import { getExerciseCategory } from '../utils/exerciseCategory'
import LoadingSpinner from '@/components/LoadingSpinner'
import './dashboard.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const initialForm = {
  exercise_name: '',
}

function DashboardPage() {
  const [form, setForm] = useState(initialForm)
  const { user, session } = useAuth()

  const [exercises, setExercises] = useState([])
  const [todaySession, setTodaySession] = useState(null)
  const [totalDaysExercised, setTotalDaysExercised] = useState(0)
  const [exerciseListInView, setExerciseListInView] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const exerciseListRef = useRef(null)

  const username =
    user?.user_metadata?.username ||
    user?.user_metadata?.full_name ||
    'Athlete'

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleCreateExercise = async (e) => {
    e.preventDefault()

    if (!form.exercise_name.trim() || !session?.access_token) return

    try {
      const response = await fetch(`${API_URL}/exercises`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: form.exercise_name.trim(),
        }),
      })

      if (response.ok) {
        const data = await response.json()

        setExercises((prev) => [
          ...prev,
          data.exercise || data,
        ])

        setForm(initialForm)
      }
    } catch (err) {
      console.error('Failed to create exercise:', err)
    }
  }

  const [deletingExerciseId, setDeletingExerciseId] = useState(null)

  const handleDeleteExercise = async (e, exercise) => {
    e.preventDefault()
    e.stopPropagation()

    if (!session?.access_token || deletingExerciseId) return

    const confirmed = window.confirm(
      `Remove "${exercise.name}"? This can't be undone.`
    )

    if (!confirmed) return

    setDeletingExerciseId(exercise.id)

    try {
      const response = await fetch(
        `${API_URL}/exercises/${exercise.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      )

      if (response.ok) {
        setExercises((prev) =>
          prev.filter((item) => item.id !== exercise.id)
        )
      } else {
        const data = await response.json().catch(() => null)

        window.alert(
          data?.detail || 'Failed to remove exercise.'
        )
      }
    } catch (err) {
      console.error('Failed to delete exercise:', err)
      window.alert('Failed to remove exercise.')
    } finally {
      setDeletingExerciseId(null)
    }
  }

  const toLocalDateKey = (date) => {
    const offset = date.getTimezoneOffset() * 60000

    return new Date(
      date.getTime() - offset
    )
      .toISOString()
      .slice(0, 10)
  }

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!session?.access_token) {
        setPageLoading(false)
        return
      }

      setPageLoading(true)

      try {
        const todayKey = toLocalDateKey(new Date())

        const [
          exercisesResponse,
          sessionsResponse,
        ] = await Promise.all([
          fetch(`${API_URL}/exercises`, {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }),

          fetch(`${API_URL}/workout-sessions`, {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }),
        ])

        if (exercisesResponse.ok) {
          const exercisesResult =
            await exercisesResponse.json()

          setExercises(
            exercisesResult.exercises || []
          )
        }

        if (sessionsResponse.ok) {
          const sessionsResult =
            await sessionsResponse.json()

          const sessions =
            sessionsResult.sessions || []

          const uniqueDays = new Set(
            sessions.map(
              (sessionItem) => sessionItem.date
            )
          )

          setTotalDaysExercised(uniqueDays.size)

          const matchingTodaySession =
            sessions.find(
              (sessionItem) =>
                sessionItem.date === todayKey
            )

          setTodaySession(
            matchingTodaySession || null
          )
        }
      } catch {
        // Dashboard data load error handled silently
      } finally {
        setPageLoading(false)
      }
    }

    loadDashboardData()
  }, [session])

  useEffect(() => {
    const node = exerciseListRef.current

    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setExerciseListInView(true)
          observer.unobserve(entry.target)
        }
      },
      {
        threshold: 0.15,
      }
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [pageLoading])

  const sortedExercises = useMemo(() => {
    return [...exercises].sort((a, b) => {
      const catA = getExerciseCategory(a.name || '')
      const catB = getExerciseCategory(b.name || '')

      if (catA !== catB) {
        return catA.localeCompare(catB)
      }

      return (a.name || '').localeCompare(
        b.name || ''
      )
    })
  }, [exercises])

  return (
    <div className="dashboard-page">
      {pageLoading ? (
        <div className="dashboard-loading">
          <LoadingSpinner
            size={64}
            label="Loading your dashboard..."
            showLabel
          />
        </div>
      ) : (
        <main className="dashboard-grid">

          {/* -------------------------------------------------
              Welcome
          ------------------------------------------------- */}

          <section className="welcome-card">
            <div className="welcome-content">
              <p className="welcome-eyebrow">
                Welcome back
              </p>

              <h1>{username}</h1>

              <p className="welcome-message">
                Ready when you are. Let's make today's
                session count.
              </p>
            </div>

            <div className="welcome-logo-wrap">
              <img
                className="logo"
                src="/logo_video.webp"
                alt="Workout tracker mascot"
              />
            </div>
          </section>


          {/* -------------------------------------------------
              Stats
          ------------------------------------------------- */}

          <section className="stats-grid">

            <article className="stat-card stat-card-primary">
              <div className="stat-heading">
                <span className="stat-label">
                  Today's volume
                </span>

                <span className="stat-kicker">
                  KG
                </span>
              </div>

              <strong>
                {todaySession
                  ? Number(
                      todaySession.total_volume
                    ).toFixed(1)
                  : '0'}
              </strong>

              {todaySession?.entries?.length > 0 ? (
                <ul className="today-session-list">
                  {todaySession.entries.map(
                    (entry, index) => (
                      <li
                        key={`${entry.exercise_name}-${index}`}
                        className={`today-session-item ${getExerciseCategory(
                          entry.exercise_name || ''
                        )}`}
                      >
                        {entry.exercise_id ? (
                          <Link
                            to={`/progress/${entry.exercise_id}`}
                            className="today-session-link"
                          >
                            <span>
                              {entry.exercise_name}
                            </span>
                          </Link>
                        ) : (
                          <span>
                            {entry.exercise_name}
                          </span>
                        )}

                        <span className="session-detail">
                          {entry.weight} kg × {entry.reps}
                        </span>
                      </li>
                    )
                  )}
                </ul>
              ) : (
                <p className="today-session-empty">
                  No workouts logged today.
                </p>
              )}
            </article>


            <article className="stat-card">
              <div className="stat-heading">
                <span className="stat-label">
                  Training days
                </span>

                <svg
                  className="stat-icon"
                  width="16"
                  height="16"
                  viewBox="230 30 220 220"
                  aria-hidden="true"
                >
                  <rect
                    x="240"
                    y="60"
                    width="200"
                    height="180"
                    rx="8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="7"
                  />

                  <rect
                    x="240"
                    y="60"
                    width="200"
                    height="40"
                    rx="8"
                    fill="currentColor"
                  />

                  <rect
                    x="240"
                    y="88"
                    width="200"
                    height="12"
                    fill="currentColor"
                  />

                  <rect
                    x="275"
                    y="40"
                    width="10"
                    height="35"
                    rx="4"
                    fill="currentColor"
                  />

                  <rect
                    x="395"
                    y="40"
                    width="10"
                    height="35"
                    rx="4"
                    fill="currentColor"
                  />

                  <line
                    x1="240"
                    y1="140"
                    x2="440"
                    y2="140"
                    stroke="currentColor"
                    strokeWidth="4"
                  />

                  <line
                    x1="240"
                    y1="180"
                    x2="440"
                    y2="180"
                    stroke="currentColor"
                    strokeWidth="4"
                  />

                  <line
                    x1="280"
                    y1="100"
                    x2="280"
                    y2="240"
                    stroke="currentColor"
                    strokeWidth="4"
                  />

                  <line
                    x1="320"
                    y1="100"
                    x2="320"
                    y2="240"
                    stroke="currentColor"
                    strokeWidth="4"
                  />

                  <line
                    x1="360"
                    y1="100"
                    x2="360"
                    y2="240"
                    stroke="currentColor"
                    strokeWidth="4"
                  />

                  <line
                    x1="400"
                    y1="100"
                    x2="400"
                    y2="240"
                    stroke="currentColor"
                    strokeWidth="4"
                  />

                  <circle
                    cx="300"
                    cy="160"
                    r="6"
                    fill="currentColor"
                  />
                </svg>
              </div>

              <strong>
                {totalDaysExercised}
              </strong>

              <p className="stat-support">
                Days you've trained
              </p>
            </article>


            <article className="stat-card">
              <div className="stat-heading">
                <span className="stat-label">
                  Exercise library
                </span>
              </div>

              <strong>
                {exercises.length}
              </strong>

              <p className="stat-support">
                Exercises available
              </p>
            </article>

          </section>


          {/* -------------------------------------------------
              Exercise Library
          ------------------------------------------------- */}

          <section
            className={`exercise-list-card${
              exerciseListInView ? ' in-view' : ''
            }`}
            ref={exerciseListRef}
          >
            <div className="section-heading">
              <div>
                <p className="section-eyebrow">
                  Your library
                </p>

                <h3>
                  Your Exercises
                </h3>
              </div>

              <span className="exercise-count">
                {exercises.length}
              </span>
            </div>

            <div className="exercise-list">
              {sortedExercises.length ? (
                sortedExercises.map(
                  (exercise, index) => (
                    <div
                      key={exercise.id}
                      className={`exercise-item-wrapper ${getExerciseCategory(
                        exercise.name || ''
                      )}`}
                      style={{
                        '--reveal-delay': `${
                          index * 0.045
                        }s`,
                      }}
                    >
                      <Link
                        to={`/progress/${exercise.id}`}
                        className="exercise-item"
                      >
                        <span className="exercise-item-name">
                          {exercise.name}
                        </span>
                      </Link>

                      {exercise.created_by ===
                        user?.id && (
                        <button
                          type="button"
                          className="exercise-remove-btn"
                          onClick={(e) =>
                            handleDeleteExercise(
                              e,
                              exercise
                            )
                          }
                          disabled={
                            deletingExerciseId ===
                            exercise.id
                          }
                          aria-label={`Remove ${exercise.name}`}
                          title="Remove exercise"
                        >
                          <svg viewBox="0 0 24 24">
                            <circle
                              cx="12"
                              cy="12"
                              r="10"
                            />

                            <path d="M14.5 9.5l-5 5M9.5 9.5l5 5" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )
                )
              ) : (
                <p className="empty-exercises">
                  No exercises yet. Create one below.
                </p>
              )}
            </div>
          </section>


          {/* -------------------------------------------------
              Create Exercise
          ------------------------------------------------- */}

          <section className="create-exercise-card">
            <div className="create-exercise-copy">
              <p className="section-eyebrow">
                Expand your library
              </p>

              <h3>
                Add an exercise
              </h3>

              <p>
                Can't find what you're looking for?
                Add it to your exercise library.
              </p>
            </div>

            <form
              onSubmit={handleCreateExercise}
              className="create-exercise-form"
            >
              <div className="input-group">
                <label htmlFor="exercise_name">
                  Exercise name
                </label>

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

              <button
                type="submit"
                className="primary-btn"
              >
                Add Exercise
              </button>
            </form>
          </section>

        </main>
      )}
    </div>
  )
}

export default DashboardPage