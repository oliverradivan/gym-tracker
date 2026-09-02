import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import { getExerciseCategory } from '../utils/exerciseCategory'
import './history.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'

function HistoryPage() {
  const { session } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const loadSessions = async () => {
    if (!session?.access_token) return

    try {
      const response = await fetch(`${API_URL}/workout-sessions`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!response.ok) {
        throw new Error('Unable to load workout history.')
      }

      const result = await response.json()
      setSessions(result.sessions || [])
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    const fetchSessions = async () => {
      if (!session?.access_token) {
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`${API_URL}/workout-sessions`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        if (!response.ok) {
          throw new Error('Unable to load workout history.')
        }

        const result = await response.json()
        if (active) setSessions(result.sessions || [])
      } catch (error) {
        console.error(error)
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchSessions()
    return () => { active = false }
  }, [session])

  const handleDeleteWorkout = async (logId) => {
    if (!logId || !session?.access_token) return

    try {
      const response = await fetch(`${API_URL}/workout-logs/${logId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.detail || 'Unable to delete workout.')
      }

      await loadSessions()
    } catch (error) {
      console.error(error)
      window.alert(error.message || 'Failed to delete workout.')
    }
  }

  return (
    <div className="history-page">
      <div className="history-card">
        <div className="history-header">
          <div>
            <p className="eyebrow">Workout Tracker</p>
            <h1>Workout history</h1>
          </div>
          <Link to="/dashboard" className="secondary-btn">Back to dashboard</Link>
        </div>

        {loading ? (
          <p className="status-message">Loading workouts...</p>
        ) : sessions.length === 0 ? (
          <p className="status-message">No workouts logged yet.</p>
        ) : (
          <div className="sessions-list">
            {sessions.map((sessionItem) => (
              <section key={sessionItem.date} className="session-block">
                <div className="session-header-row">
                  <h2>{sessionItem.date}</h2>
                  <span>Total volume: {Number(sessionItem.total_volume).toFixed(1)}</span>
                </div>

                <ul className="session-entries">
                  {sessionItem.entries.map((entry, index) => (
                    <li key={`${sessionItem.date}-${entry.log_id || index}`} className={`history-entry ${getExerciseCategory(entry.exercise_name)}`}>
                      <Link to={`/exercise/${entry.exercise_id}`} className="exercise-link">{entry.exercise_name}</Link>
                      <span>{entry.weight} kg × {entry.reps} reps</span>
                      <div className="entry-actions">
                        <strong>{Number(entry.volume).toFixed(1)}</strong>
                        <button
                          type="button"
                          className="delete-workout-btn"
                          onClick={() => handleDeleteWorkout(entry.log_id)}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default HistoryPage
