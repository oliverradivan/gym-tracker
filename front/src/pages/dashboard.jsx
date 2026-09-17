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
  const { user, handleLogout, session } = useAuth()

  const [exercises, setExercises] = useState([])
  const [todaySession, setTodaySession] = useState(null)
  const [totalDaysExercised, setTotalDaysExercised] = useState(0)
  const [exerciseListInView, setExerciseListInView] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const exerciseListRef = useRef(null)

  const username = user?.user_metadata?.username || user?.user_metadata?.full_name || 'Athlete'

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
        body: JSON.stringify({ name: form.exercise_name.trim() }),
      })

      if (response.ok) {
        const data = await response.json()
        setExercises((prev) => [...prev, data.exercise || data])
        setForm(initialForm)
      }
    } catch (err) {
      console.error('Failed to create exercise:', err)
    }
  }

  const [deletingExerciseId, setDeletingExerciseId] = useState(null)

  const handleDeleteExercise = async (e, exercise) => {
    // Stop the click from bubbling up to the surrounding <Link>, which would
    // otherwise navigate to /progress/:id instead of deleting.
    e.preventDefault()
    e.stopPropagation()

    if (!session?.access_token || deletingExerciseId) return

    const confirmed = window.confirm(`Remove "${exercise.name}"? This can't be undone.`)
    if (!confirmed) return

    setDeletingExerciseId(exercise.id)
    try {
      const response = await fetch(`${API_URL}/exercises/${exercise.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (response.ok) {
        setExercises((prev) => prev.filter((item) => item.id !== exercise.id))
      } else {
        const data = await response.json().catch(() => null)
        window.alert(data?.detail || 'Failed to remove exercise.')
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
    return new Date(date.getTime() - offset).toISOString().slice(0, 10)
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
        const [exercisesResponse, sessionsResponse] = await Promise.all([
          fetch(`${API_URL}/exercises`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetch(`${API_URL}/workout-sessions`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        ])

        if (exercisesResponse.ok) {
          const exercisesResult = await exercisesResponse.json()
          setExercises(exercisesResult.exercises || [])
        }

        if (sessionsResponse.ok) {
          const sessionsResult = await sessionsResponse.json()
          const sessions = sessionsResult.sessions || []

          // Collect unique session dates to calculate total days exercised
          const uniqueDays = new Set(sessions.map((sessionItem) => sessionItem.date))
          setTotalDaysExercised(uniqueDays.size)

          const matchingTodaySession = sessions.find((sessionItem) => sessionItem.date === todayKey)
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
    // exerciseListRef only attaches once <main> renders, which happens after
    // pageLoading flips to false — so this effect must depend on pageLoading
    // to re-run once the ref is actually populated. With an empty dependency
    // array it fires once on mount while the ref is still null (since <main>
    // is hidden behind the loading state), and the observer never gets set up.
    const node = exerciseListRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setExerciseListInView(true)
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.15 }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [pageLoading])

  // Sort exercises by category (push/pull/leg/etc.) so newly created
  // exercises always land next to others in the same color group,
  // regardless of what order the API returns them in.
  const sortedExercises = useMemo(() => {
    return [...exercises].sort((a, b) => {
      const catA = getExerciseCategory(a.name || '')
      const catB = getExerciseCategory(b.name || '')
      if (catA !== catB) return catA.localeCompare(catB)
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [exercises])

  return (
    <div className="dashboard-page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Oliver's Workout Tracker</span>
          <h2>Dashboard</h2>
        </div>
        <div className="topbar-actions">
          <Link to="/logworkout" className="primary-btn dashboard-primary-btn">
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 9v6M6.5 6v12M17.5 6v12M20 9v6M6.5 12h11" />
              </svg>
            </span>
            Log Workout
          </Link>
          <Link to="/history" className="ghost-btn">
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
                <path d="M3 3v5h5" />
                <path d="M12 7v5l4 2" />
              </svg>
            </span>
            History
          </Link>
          <Link to="/progress" className="ghost-btn">
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 16.5 9 11l4 4 6.5-7.5" />
                <path d="M14.5 7h5v5" />
              </svg>
            </span>
            Progress
          </Link>
          <Link to="/settings" className="ghost-btn">
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="1" />
                <path d="M12 1v6m0 10v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m10 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24" />
              </svg>
            </span>
            Settings
          </Link>
          <Link to="/login" className="logout-btn" onClick={handleLogout}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M9 7.5V6.8A2.8 2.8 0 0 1 11.8 4h4.4A2.8 2.8 0 0 1 19 6.8v10.4A2.8 2.8 0 0 1 16.2 20h-4.4A2.8 2.8 0 0 1 9 17.2v-.7M15 12H4m0 0 3-3m-3 3 3 3" />
              </svg>
            </span>
            Log out
          </Link>
        </div>
      </header>

      {pageLoading ? (
        <div className="dashboard-loading">
          <LoadingSpinner size={64} label="Loading your dashboard..." showLabel />
        </div>
      ) : (
        <main className="dashboard-grid">
          <section className="welcome-card">
            <div className="welcome-content">
              <p className="welcome-eyebrow">Welcome</p>
              <h1>{username}</h1>
              <p className="welcome-message">
                Hamster says: "Let's get those reps in. No Pain, No Gain! Log your workouts and track your progress over time."
              </p>
              </div>
              <img className="logo" src="/logo_video.webp" alt="Logo" />
            </section>

          <section className="stats-grid">
            <article className="stat-card">
              <span>You've moved this much volume today:</span>
              <strong>{todaySession ? Number(todaySession.total_volume).toFixed(1) : '0'}</strong>
              {todaySession && todaySession.entries && todaySession.entries.length > 0 ? (
                <ul className="today-session-list">
                  {todaySession.entries.map((entry, index) => (
                    <li key={`${entry.exercise_name}-${index}`} className={`today-session-item ${getExerciseCategory(entry.exercise_name || '')}`}>
                      {entry.exercise_id ? (
                        <Link to={`/progress/${entry.exercise_id}`} className="today-session-link">
                          <span>{entry.exercise_name}</span>
                        </Link>
                      ) : (
                        <span>{entry.exercise_name}</span>
                      )}
                      <span>{entry.weight} kg × {entry.reps}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="today-session-empty">No workouts logged today.</p>
              )}
            </article>
            <article className="stat-card">
              <span>Days logged:</span>
              <strong>
                {totalDaysExercised}{' '}
                <svg width="18" height="18" viewBox="0 0 680 300" style={{ verticalAlign: 'middle' }}>
                  <rect x="240" y="60" width="200" height="180" rx="8" fill="none" stroke="currentColor" strokeWidth="4" />
                  <rect x="240" y="60" width="200" height="40" rx="8" fill="currentColor" />
                  <rect x="240" y="88" width="200" height="12" fill="currentColor" />
                  <rect x="275" y="40" width="10" height="35" rx="4" fill="currentColor" />
                  <rect x="395" y="40" width="10" height="35" rx="4" fill="currentColor" />
                  <line x1="240" y1="140" x2="440" y2="140" stroke="currentColor" strokeWidth="2" />
                  <line x1="240" y1="180" x2="440" y2="180" stroke="currentColor" strokeWidth="2" />
                  <line x1="280" y1="100" x2="280" y2="240" stroke="currentColor" strokeWidth="2" />
                  <line x1="320" y1="100" x2="320" y2="240" stroke="currentColor" strokeWidth="2" />
                  <line x1="360" y1="100" x2="360" y2="240" stroke="currentColor" strokeWidth="2" />
                  <line x1="400" y1="100" x2="400" y2="240" stroke="currentColor" strokeWidth="2" />
                  <circle cx="300" cy="160" r="6" fill="currentColor" />
                </svg>
              </strong>
            </article>
            <article className="stat-card">
              <span>Exercises in the system</span>
              <strong>{exercises.length}</strong>
            </article>
          </section>

          <section
            className={`exercise-list-card${exerciseListInView ? ' in-view' : ''}`}
            ref={exerciseListRef}
          >
            <h3>Exercises:</h3>
            <div className="exercise-list">
              {sortedExercises.length ? (
                sortedExercises.map((exercise, index) => (
                  <div
                    key={exercise.id}
                    className={`exercise-item-wrapper ${getExerciseCategory(exercise.name || '')}`}
                    style={{ '--reveal-delay': `${index * 0.06}s` }}
                  >
                    <Link to={`/progress/${exercise.id}`} className="exercise-item">
                      <span className="exercise-item-icon" aria-hidden="true" />
                      <span className="exercise-item-name">{exercise.name}</span>
                    </Link>
                    {exercise.created_by === user?.id && (
                      <button
                        type="button"
                        className="exercise-remove-btn"
                        onClick={(e) => handleDeleteExercise(e, exercise)}
                        disabled={deletingExerciseId === exercise.id}
                        aria-label={`Remove ${exercise.name}`}
                        title="Remove exercise"
                      >
                        <svg viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M14.5 9.5l-5 5M9.5 9.5l5 5" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p>No exercises yet. Create one from the workout logger.</p>
              )}
            </div>
          </section>

          <section className="create-exercise-card">
            <h3>Create New Exercise</h3>
            <form onSubmit={handleCreateExercise} className="create-exercise-form">
              <div className="input-group">
                <label htmlFor="exercise_name">Exercise Name</label>
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
              <button type="submit" className="primary-btn">
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