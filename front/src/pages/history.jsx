import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import { getExerciseCategory } from '../utils/exerciseCategory'
import LoadingSpinner from '@/components/LoadingSpinner'
import './history.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'

function HistoryPage() {
  const { session } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  /*
   * Single source of truth for loading workout history.
   *
   * This used to be duplicated between useEffect and loadSessions().
   * Keeping it here means the initial page load and post-delete refresh
   * always use exactly the same request and state handling.
   */
  const loadSessions = useCallback(async () => {
    if (!session?.access_token) {
      setSessions([])
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/workout-sessions`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Unable to load workout history.')
      }

      const result = await response.json()
      setSessions(result.sessions || [])
    } catch {
      // History load error handled silently.
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const handleDeleteWorkout = async (logId) => {
    if (!logId || !session?.access_token) {
      setMessage('Unable to delete — missing workout ID or session.')
      return
    }

    setDeletingId(logId)
    setMessage('')

    try {
      const response = await fetch(`${API_URL}/workout-logs/${logId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.detail || 'Unable to delete workout.')
      }

      await loadSessions()
      setMessage('Workout deleted successfully.')
    } catch (error) {
      setMessage(error.message || 'Failed to delete workout.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="history-page">
      <main className="history-shell">
        <header className="history-header">
          <div className="history-heading">
            <p className="eyebrow">Workout Tracker</p>

            <h1>Workout history</h1>

            <p className="history-subtitle">
              A record of your training sessions and progress.
            </p>
          </div>

          {!loading && sessions.length > 0 && (
            <div className="history-summary" aria-label="Workout summary">
              <span className="history-summary-label">Sessions</span>
              <strong>{sessions.length}</strong>
            </div>
          )}
        </header>

        {message && (
          <div
            className={`status-message ${
              message.toLowerCase().includes('successfully')
                ? 'status-success'
                : 'status-error'
            }`}
            role="status"
          >
            <span className="status-dot" aria-hidden="true" />
            {message}
          </div>
        )}

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

            <div>
              <h2>No workouts yet</h2>
              <p>
                Your completed workouts will appear here once you start
                logging your training.
              </p>
            </div>

            <Link to="/logworkout" className="secondary-btn">
              Log a workout
            </Link>
          </div>
        ) : (
          <div className="sessions-list">
            {sessions.map((sessionItem) => {
              const formattedDate = sessionItem.date
                .split('-')
                .reverse()
                .join('/')

              const totalVolume = Number(sessionItem.total_volume)

              return (
                <section
                  key={sessionItem.date}
                  className="session-block"
                >
                  <div className="session-header-row">
                    <div className="session-date-group">
                      <span className="session-date-mark" aria-hidden="true" />

                      <div>
                        <p className="session-label">Training session</p>
                        <h2>{formattedDate}</h2>
                      </div>
                    </div>

                    <div className="session-volume">
                      <span>Total volume</span>
                      <strong>
                        {Number.isFinite(totalVolume)
                          ? totalVolume.toFixed(1)
                          : '0.0'}
                        <small> kg</small>
                      </strong>
                    </div>
                  </div>

                  <div className="session-divider" />

                  <ul className="session-entries">
                    {sessionItem.entries.map((entry, index) => {
                      const isDeleting = deletingId === entry.log_id
                      const category = getExerciseCategory(
                        entry.exercise_name
                      )

                      const volume = Number(entry.volume)

                      return (
                        <li
                          key={
                            entry.log_id ??
                            entry.exercise_id ??
                            `${sessionItem.date}-${index}`
                          }
                          className={`history-entry ${category}`}
                        >
                          <div className="entry-category-mark" aria-hidden="true" />

                          <div className="entry-main">
                            <Link
                              to={`/progress/${entry.exercise_id}`}
                              className="exercise-link"
                            >
                              {entry.exercise_name}
                            </Link>

                            <span className="entry-prescription">
                              {entry.weight} kg
                              <span aria-hidden="true"> × </span>
                              {entry.reps} reps
                            </span>
                          </div>

                          <div className="entry-actions">
                            <div className="entry-volume">
                              <span>Volume</span>
                              <strong>
                                {Number.isFinite(volume)
                                  ? volume.toFixed(1)
                                  : '0.0'}
                              </strong>
                            </div>

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
                                onClick={() =>
                                  handleDeleteWorkout(entry.log_id)
                                }
                              >
                                Delete
                              </button>

                              <div
                                className="delete-spinner"
                                aria-hidden={!isDeleting}
                              >
                                <LoadingSpinner size={20} />
                              </div>
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
      </main>
    </div>
  )
}

export default HistoryPage