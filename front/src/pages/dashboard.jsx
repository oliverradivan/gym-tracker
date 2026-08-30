import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import { getExerciseCategory } from '../utils/exerciseCategory'
import './dashboard.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'

function DashboardPage() {
  const { user, handleLogout, session } = useAuth()
  const [exercises, setExercises] = useState([])
  const [todaySession, setTodaySession] = useState(null)
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
                <path d="M5 12h14M12 5v14M7 7.5v9M17 7.5v9" />
              </svg>
            </span>
            Log Workout
          </Link>
          <Link to="/history" className="ghost-btn">
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M7 4.5v4h4M7 8.5a7 7 0 1 0 7.5-7.2" />
              </svg>
            </span>
            History
          </Link>
          <Link to="/progress" className="ghost-btn">
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M5 18.5V9.5M11 18.5V5.5M17 18.5v-8" />
              </svg>
            </span>
            Progress
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
            You are signed in as <strong>@{username}</strong> and ready to track your workouts.
          </p>
        </section>

        <section className="stats-grid">
          <article className="stat-card">
            <span>Today's session volume</span>
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
            <span>Exercises</span>
            <strong>{exercises.length}</strong>
          </article>
        </section>

        <section className="exercise-list-card">
          <h3>Exercises</h3>
          <div className="exercise-list">
            {exercises.length ? (
              exercises.map((exercise) => (
                <Link
                  key={exercise.id}
                  to={`/exercise/${exercise.id}`}
                  className={`exercise-item ${getExerciseCategory(exercise.name)}`}
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
    </div>
  )
}

export default DashboardPage
