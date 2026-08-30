import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import { getExerciseCategory } from '../utils/exerciseCategory'
import './dashboard.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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
          <span className="eyebrow">Workout Tracker</span>
          <h2>Dashboard</h2>
        </div>
        <div className="topbar-actions">
          <Link to="/logworkout" className="primary-btn dashboard-primary-btn">
            Log Workout
          </Link>
          <Link to="/history" className="ghost-btn">
            History
          </Link>
          <Link to="/progress" className="ghost-btn">
            Progress
          </Link>
          <Link to="/login" className="ghost-btn" onClick={handleLogout}>
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
