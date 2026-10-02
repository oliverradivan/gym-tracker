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

/* -------------------------------------------------------
   Formatting and date helpers
------------------------------------------------------- */

const todayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const weekdayLongFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
})

const weekdayNarrowFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'narrow',
})

const decimalFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
})

const wholeFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})

/* One decimal for small numbers, whole numbers once it reaches 1,000. */
function formatVolume(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) return '0'

  return (number >= 1000 ? wholeFormatter : decimalFormatter).format(number)
}

/* Local "YYYY-MM-DD" key, matching the dates returned by the API. */
function toLocalDateKey(date) {
  const offset = date.getTimezoneOffset() * 60000

  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

/*
 * First day of the week for the user's locale, as a JS weekday
 * (0 = Sunday ... 6 = Saturday). Falls back to Monday.
 */
function getFirstWeekday() {
  try {
    const locale = new Intl.Locale(navigator.language)
    const info = locale.getWeekInfo ? locale.getWeekInfo() : locale.weekInfo

    return (info?.firstDay ?? 1) % 7
  } catch {
    return 1
  }
}

/* -------------------------------------------------------
   Icons
------------------------------------------------------- */

function Icon({ children, className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

const DumbbellIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
  </Icon>
)

function DashboardPage() {
  const [form, setForm] = useState(initialForm)
  const { user, session } = useAuth()

  const [exercises, setExercises] = useState([])
  const [todaySession, setTodaySession] = useState(null)
  const [allSessions, setAllSessions] = useState([])
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

          setAllSessions(sessions)

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

          setTodaySession(matchingTodaySession || null)

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

  /*
   * This week's summary, derived from the sessions the page already loads
   * (no extra request). The week starts on the user's locale first day.
   */
  const weekStats = useMemo(() => {
    const now = new Date()
    const todayKey = toLocalDateKey(now)
    const offset = (now.getDay() - getFirstWeekday() + 7) % 7
    const sessionsByDate = new Map(
      allSessions.map((sessionItem) => [sessionItem.date, sessionItem])
    )

    let trained = 0

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - offset + index
      )
      const key = toLocalDateKey(date)
      const match = sessionsByDate.get(key)

      if (match) trained += 1

      const categoryCounts = (match?.entries || []).reduce((counts, entry) => {
        const category = getExerciseCategory(entry.exercise_name || '')
        counts[category] = (counts[category] || 0) + 1
        return counts
      }, {})
      const category = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'general'

      return {
        key,
        short: weekdayNarrowFormatter.format(date),
        long: weekdayLongFormatter.format(date),
        trained: Boolean(match),
        category,
        isToday: key === todayKey,
      }
    })

    return { days, trained }
  }, [allSessions])

  return (
    <div className="dash-page">
      {pageLoading ? (
        <div className="dash-loading">
          <LoadingSpinner
            size={64}
            label="Loading your dashboard..."
            showLabel
          />
        </div>
      ) : (
        <main className="dash-shell">

          {/* -------------------------------------------------
              Header
          ------------------------------------------------- */}

          <header className="dash-header">
            <div className="dash-header-text">
              <h1 className="dash-greeting">Hi, {username}</h1>

              <p className="dash-date">
                Today · {todayFormatter.format(new Date())}
              </p>
            </div>

            <img
              className="dash-avatar"
              src="/logo_video.webp"
              alt="Workout tracker mascot"
            />
          </header>


          {/* -------------------------------------------------
              Stats
          ------------------------------------------------- */}

          <section className="dash-stats" aria-label="Overview">

            <article className="dash-stat" data-tone="orange">
              <span className="dash-stat-icon">
                <Icon>
                  <path d="M5 20V10M12 20V4M19 20v-7" />
                </Icon>
              </span>

              <span className="dash-stat-label">Today</span>

              <strong className="dash-stat-value">
                {todaySession
                  ? formatVolume(todaySession.total_volume)
                  : '0'}
              </strong>

              <span className="dash-stat-unit">kg lifted</span>
            </article>

            <article className="dash-stat" data-tone="teal">
              <span className="dash-stat-icon">
                <Icon>
                  <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
                  <path d="M3.5 10h17M8 3v4M16 3v4" />
                </Icon>
              </span>

              <span className="dash-stat-label">Trained</span>

              <strong className="dash-stat-value">
                {totalDaysExercised}
              </strong>

              <span className="dash-stat-unit">days</span>
            </article>

            <article className="dash-stat" data-tone="indigo">
              <span className="dash-stat-icon">
                <Icon>
                  <path d="M9 6h11M9 12h11M9 18h11" />
                  <circle cx="4.5" cy="6" r="1" />
                  <circle cx="4.5" cy="12" r="1" />
                  <circle cx="4.5" cy="18" r="1" />
                </Icon>
              </span>

              <span className="dash-stat-label">Library</span>

              <strong className="dash-stat-value">
                {exercises.length}
              </strong>

              <span className="dash-stat-unit">exercises</span>
            </article>

          </section>


          {/* -------------------------------------------------
              This week
          ------------------------------------------------- */}

          <section aria-labelledby="dash-week-title">
            <div className="dash-section-head">
              <h2 id="dash-week-title" className="dash-section-title">
                This week
              </h2>
            </div>

            <div className="dash-week-cards">
              <article className="dash-card">
                <span className="dash-card-label">Days trained</span>

                <strong className="dash-card-value">
                  {weekStats.trained}
                  <small>/ 7</small>
                </strong>

                <ol
                  className="dash-week"
                  aria-label="Days trained this week"
                >
                  {weekStats.days.map((day) => (
                    <li
                      key={day.key}
                      className="dash-week-day"
                      data-trained={day.trained}
                      data-category={day.category}
                      data-today={day.isToday}
                    >
                      <span className="dash-week-dot" aria-hidden="true" />

                      <span className="dash-week-label" aria-hidden="true">
                        {day.short}
                      </span>

                      <span className="dash-sr-only">
                        {day.long}: {day.trained ? `${day.category} workout` : 'no workout'}
                      </span>
                    </li>
                  ))}
                </ol>
              </article>


            </div>
          </section>


          {/* -------------------------------------------------
              Exercise library
          ------------------------------------------------- */}

          <section
            className={`dash-exercises${
              exerciseListInView ? ' in-view' : ''
            }`}
            ref={exerciseListRef}
            aria-labelledby="dash-library-title"
          >
            <div className="dash-section-head">
              <h2 id="dash-library-title" className="dash-section-title">
                Your exercises
              </h2>

              <span className="dash-count">{exercises.length}</span>
            </div>

            {sortedExercises.length ? (
              <div className="dash-rows dash-rows-grid">
                {sortedExercises.map((exercise, index) => (
                  <div
                    key={exercise.id}
                    className="dash-row dash-row-compact"
                    data-category={getExerciseCategory(
                      exercise.name || ''
                    )}
                    style={{
                      '--reveal-delay': `${Math.min(index, 10) * 0.04}s`,
                    }}
                  >
                    <span className="dash-row-tile" aria-hidden="true">
                      <DumbbellIcon />
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
                        onClick={(e) =>
                          handleDeleteExercise(e, exercise)
                        }
                        disabled={deletingExerciseId === exercise.id}
                        aria-label={`Remove ${exercise.name}`}
                        title="Remove exercise"
                      >
                        <Icon>
                          <circle cx="12" cy="12" r="10" />
                          <path d="M14.5 9.5l-5 5M9.5 9.5l5 5" />
                        </Icon>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="dash-empty-note">
                No exercises yet. Create one below.
              </p>
            )}
          </section>


          {/* -------------------------------------------------
              Create exercise
          ------------------------------------------------- */}

          <section
            className="dash-card dash-create"
            aria-labelledby="dash-create-title"
          >
            <div>
              <h2 id="dash-create-title" className="dash-section-title">
                Add an exercise
              </h2>

              <p className="dash-create-copy">
                Can't find what you're looking for? Add it to your
                exercise library.
              </p>
            </div>

            <form
              onSubmit={handleCreateExercise}
              className="dash-create-form"
            >
              <div className="dash-field">
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

              <button type="submit" className="dash-btn">
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