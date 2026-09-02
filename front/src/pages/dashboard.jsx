import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import { getExerciseCategory } from '../utils/exerciseCategory'
import './dashboard.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'

function DashboardPage() {
  const { user, handleLogout, session } = useAuth()
  const [exercises, setExercises] = useState([])
  const [todaySession, setTodaySession] = useState(null)
  const [exerciseListInView, setExerciseListInView] = useState(false)
  const exerciseListRef = useRef(null)
  const username = user?.user_metadata?.username || user?.user_metadata?.full_name || 'Athlete'
  const toLocalDateKey = (date) => {
    const offset = date.getTimezoneOffset() * 60000
    return new Date(date.getTime() - offset).toISOString().slice(0, 10)
  }
  const todayKey = toLocalDateKey(new Date())
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!session?.access_token) return

      try {
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
          const matchingTodaySession = sessions.find((sessionItem) => sessionItem.date === todayKey)
          setTodaySession(matchingTodaySession || null)
        }
      } catch (error) {
        console.error('Failed to load dashboard data', error)
      }
    }

    loadDashboardData()
  }, [session])

  useEffect(() => {
    const node = exerciseListRef.current
    if (!node) return

    // Reveal the list once it scrolls into view, then stop watching.
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
  }, [])

  return (
    <div className="dashboard-page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Olivers Workout Tracker</span>
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
          <Link to="/login" className="ghost-btn" onClick={handleLogout}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M9 7.5V6.8A2.8 2.8 0 0 1 11.8 4h4.4A2.8 2.8 0 0 1 19 6.8v10.4A2.8 2.8 0 0 1 16.2 20h-4.4A2.8 2.8 0 0 1 9 17.2v-.7M15 12H4m0 0 3-3m-3 3 3 3" />
              </svg>
            </span>
            Log out
          </Link>
        </div>
      </header>

      <main className="dashboard-grid">
        <section className="welcome-card">
          <p className="eyebrow">Welcome</p>
          <h1>{username}</h1>
          <p>
            Let's get those reps in. No Pain, No Gain! Log your workouts and track your progress over time.
          </p>
        </section>

        <section className="stats-grid">
          <article className="stat-card">
            <span>You've moved this much volume today:</span>
            <strong>{todaySession ? Number(todaySession.total_volume).toFixed(1) : '0'}</strong>
            {todaySession && todaySession.entries && todaySession.entries.length > 0 ? (
              <ul className="today-session-list">
                {todaySession.entries.map((entry, index) => (
                  <li key={`${entry.exercise_name}-${index}`} className={`today-session-item ${getExerciseCategory(entry.exercise_name)}`}>
                    {entry.exercise_id ? (
                      <Link to={`/exercise/${entry.exercise_id}`} className="today-session-link">
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
              <p className="today-session-empty">No workouts logged today yet.</p>
            )}
          </article>
          <article className="stat-card">
            <span>Today</span>
            <strong>{today}</strong>
          </article>
          <article className="stat-card">
            <span>Exercises in our system</span>
            <strong>{exercises.length}</strong>
          </article>
        </section>

        <section
          className={`exercise-list-card${exerciseListInView ? ' in-view' : ''}`}
          ref={exerciseListRef}
        >
          <h3>Exercises:</h3>
          <div className="exercise-list">
            {exercises.length ? (
              exercises.map((exercise, index) => (
                <Link
                  key={exercise.id}
                  to={`/exercise/${exercise.id}`}
                  className={`exercise-item ${getExerciseCategory(exercise.name)}`}
                  style={{ '--reveal-delay': `${index * 0.06}s` }}
                >
                  <span className="exercise-item-icon" aria-hidden="true" />
                  {exercise.name}
                </Link>
              ))
            ) : (
              <p>No exercises yet. Create one from the workout logger.</p>
            )}
          </div>
        </section>
      </main>
      <h3>your reward</h3>
      <img src="../public/G&O_1589.jpg" alt="us" className="dashboard-image" />
    </div>
  )
}

export default DashboardPage