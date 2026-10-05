import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useWorkouts } from '../context/WorkoutsContext'
import { getExerciseCategory } from '../utils/exerciseCategory'
import { formatDuration } from '../utils/duration'
import LoadingSpinner from '@/components/LoadingSpinner'
import './history.css'

/* Display names for the exercise categories returned by getExerciseCategory. */
const CATEGORY_LABELS = {
  push: 'Push',
  pull: 'Pull',
  leg: 'Legs',
  cardio: 'Cardio',
}

const kgFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
const monthYearFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
})

function formatKg(value) {
  const number = Number(value)
  return kgFormatter.format(Number.isFinite(number) ? number : 0)
}

/*
 * Session dates arrive as "YYYY-MM-DD". Build the Date from its parts so the
 * result is local time (new Date("2026-10-02") would be parsed as UTC and can
 * show the previous day). Returns null for anything unparseable so the page
 * can fall back to the original DD/MM/YYYY text.
 */
function getDateParts(isoDate) {
  const [year, month, day] = String(isoDate).split('-').map(Number)
  const date = new Date(year, month - 1, day)

  if (
    !year ||
    !month ||
    !day ||
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return {
    weekday: weekdayFormatter.format(date),
    day,
    monthYear: monthYearFormatter.format(date),
  }
}

function HistoryPage() {
  /*
   * Sessions come from the shared workouts store, so a workout logged on the
   * Log Workout page shows up here immediately. Refreshing after a delete
   * doesn't toggle `loading`, so the list stays mounted and keeps its
   * scroll position.
   */
  const { sessions, loading, deleteLog } = useWorkouts()
  const location = useLocation()
  const historyShellRef = useRef(null)
  const lastScrolledLocationRef = useRef(null)
  const [message, setMessage] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  useLayoutEffect(() => {
    if (loading || location.pathname !== '/history') return
    if (lastScrolledLocationRef.current === location.key) return

    const date = new URLSearchParams(location.search).get('date')
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return

    const sessionExists = sessions.some((sessionItem) => sessionItem.date === date)
    const target = historyShellRef.current?.querySelector(
      `[data-session-date="${date}"]`
    )
    const scrollContainer = historyShellRef.current?.closest('.swipe-deck-page')

    if (!sessionExists || !target || !scrollContainer) return

    lastScrolledLocationRef.current = location.key
    const targetTop =
      target.getBoundingClientRect().top -
      scrollContainer.getBoundingClientRect().top +
      scrollContainer.scrollTop

    scrollContainer.scrollTo({
      top: targetTop,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    })
  }, [loading, location.key, location.pathname, location.search, sessions])

  // The message is shown as a toast, so it clears itself after a few seconds.
  useEffect(() => {
    if (!message) return undefined

    const timer = setTimeout(() => setMessage(''), 4000)
    return () => clearTimeout(timer)
  }, [message])

  const handleDeleteWorkout = async (logId) => {
    if (!logId) {
      setMessage('Unable to delete — missing workout ID.')
      return
    }

    setDeletingId(logId)
    setMessage('')

    try {
      await deleteLog(logId)
      setMessage('Workout deleted successfully.')
    } catch (error) {
      setMessage(error.message || 'Failed to delete workout.')
    } finally {
      setDeletingId(null)
    }
  }

  const hasSessions = !loading && sessions.length > 0
  const isSuccessMessage = message.toLowerCase().includes('successfully')

  return (
    <div className="history-page">
      <main className="history-shell" ref={historyShellRef}>
        <header className="history-header">
          <div>
            <h1 className="history-title">Workout history</h1>

            {hasSessions && (
              <p className="history-count">
                {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
              </p>
            )}
          </div>

          {hasSessions && (
            <ul className="history-legend" aria-label="Exercise categories">
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <li key={key} data-category={key}>
                  {label}
                </li>
              ))}
            </ul>
          )}
        </header>

        {loading ? (
          <div className="history-loading">
            <LoadingSpinner label="Loading workouts..." showLabel />
          </div>
        ) : sessions.length === 0 ? (
          <div className="history-empty">
            <div className="empty-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>

            <div className="history-empty-copy">
              <h2 className="history-empty-title">No workouts yet</h2>
              <p>
                Your completed workouts will appear here once you start
                logging your training.
              </p>
            </div>

            <Link to="/logworkout" className="history-cta">
              Log a workout
            </Link>
          </div>
        ) : (
          <div className="sessions-list">
            {sessions.map((sessionItem) => {
              const dateParts = getDateParts(sessionItem.date)
              const legacyDate = sessionItem.date.split('-').reverse().join('/')

              return (
                <section
                  key={sessionItem.date}
                  id={`history-date-${sessionItem.date}`}
                  data-session-date={sessionItem.date}
                  className="session"
                >
                  <div className="session-meta">
                    <h2 className="session-date">
                      <time dateTime={sessionItem.date}>
                        {dateParts ? (
                          <>
                            <span className="session-weekday">
                              {dateParts.weekday}
                            </span>{' '}
                            <span className="session-day">{dateParts.day}</span>{' '}
                            <span className="session-month">
                              {dateParts.monthYear}
                            </span>
                          </>
                        ) : (
                          <span className="session-day">{legacyDate}</span>
                        )}
                      </time>
                    </h2>

                    <div className="session-total">
                      <span className="session-total-label">Total volume</span>
                      <strong className="session-total-value">
                        {formatKg(sessionItem.total_volume)}
                        <small>kg</small>
                      </strong>
                    </div>
                  </div>

                  <ul className="session-entries">
                    {sessionItem.entries.map((entry, index) => {
                      const isDeleting = deletingId === entry.log_id
                      const category = getExerciseCategory(entry.exercise_name)

                      return (
                        <li
                          key={
                            entry.log_id ??
                            entry.exercise_id ??
                            `${sessionItem.date}-${index}`
                          }
                          className={`history-entry${isDeleting ? ' is-deleting' : ''}`}
                          data-category={category}
                        >
                          <div className="entry-main">
                            <Link
                              to={`/progress/${entry.exercise_id}`}
                              className="exercise-link"
                            >
                              {entry.exercise_name}
                            </Link>

                            <span className="entry-meta">
                              {CATEGORY_LABELS[category] && (
                                <span className="entry-category">
                                  {CATEGORY_LABELS[category]}
                                </span>
                              )}

                              <span>
                                {category === 'cardio'
                                  ? entry.duration_seconds == null
                                    ? 'Time not recorded'
                                    : formatDuration(entry.duration_seconds)
                                  : (
                                    <>
                                      {entry.weight} kg
                                      <span aria-hidden="true"> × </span>
                                      {entry.reps} reps
                                    </>
                                  )}
                              </span>
                            </span>
                          </div>

                          {category !== 'cardio' && (
                            <div className="entry-volume">
                              <span className="history-sr-only">Volume </span>
                              <strong>{formatKg(entry.volume)}</strong>
                              <small>kg</small>
                            </div>
                          )}

                          <div
                            className={`delete-action${
                              isDeleting ? ' is-deleting' : ''
                            }`}
                          >
                            <button
                              type="button"
                              className="delete-workout-btn"
                              disabled={deletingId !== null}
                              aria-label={`Delete ${entry.exercise_name} workout`}
                              aria-hidden={isDeleting}
                              tabIndex={isDeleting ? -1 : undefined}
                              onClick={() => handleDeleteWorkout(entry.log_id)}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                width="18"
                                height="18"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.75"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                                focusable="false"
                              >
                                <path d="M4 7h16" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
                                <path d="M9 7V4h6v3" />
                              </svg>
                            </button>

                            <div
                              className="delete-spinner"
                              aria-hidden={!isDeleting}
                            >
                              <LoadingSpinner size={20} />
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>
        )}

        {/*
          Rendered after the content and pinned with position: sticky, so it
          never shifts the list and stays visible wherever the page is scrolled.
        */}
        {message && (
          <div
            className={`history-status ${
              isSuccessMessage ? 'is-success' : 'is-error'
            }`}
            role="status"
          >
            <span className="history-status-dot" aria-hidden="true" />
            {message}
          </div>
        )}
      </main>
    </div>
  )
}

export default HistoryPage