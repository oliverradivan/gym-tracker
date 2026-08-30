import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import './exerciseProgress.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'

function ExerciseProgressPage() {
  const { exerciseId } = useParams()
  const { session } = useAuth()
  const [logs, setLogs] = useState([])
  const [progress, setProgress] = useState([])
  const [exerciseName, setExerciseName] = useState('Exercise')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.access_token || !exerciseId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')

        const [progressResponse, logsResponse, exercisesResponse] = await Promise.all([
          fetch(`${API_URL}/workout-logs/progress?exercise_id=${exerciseId}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetch(`${API_URL}/workout-logs?exercise_id=${exerciseId}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetch(`${API_URL}/exercises`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        ])

        const progressResult = await progressResponse.json()
        const logsResult = await logsResponse.json()
        const exercisesResult = await exercisesResponse.json()

        if (!progressResponse.ok || !logsResponse.ok || !exercisesResponse.ok) {
          throw new Error(progressResult.detail || logsResult.detail || exercisesResult.detail || 'Failed to load exercise progress.')
        }

        setProgress(progressResult.progress || [])
        setLogs(logsResult.logs || [])

        const currentExercise = (exercisesResult.exercises || []).find((entry) => entry.id === exerciseId)
        setExerciseName(currentExercise?.name || 'Exercise')
      } catch (loadError) {
        setError(loadError.message || 'Unable to load exercise progress.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [exerciseId, session])

  const chartPoints = useMemo(() => {
    if (!progress.length) return ''

    const width = 560
    const height = 220
    const maxValue = Math.max(...progress.map((point) => Number(point.volume || 0)), 1)
    const minValue = 0

    return progress
      .map((point, index) => {
        const x = (index / Math.max(progress.length - 1, 1)) * (width - 30) + 15
        const normalized = (Number(point.volume) - minValue) / Math.max(maxValue - minValue, 1)
        const y = height - 20 - normalized * (height - 40)
        return `${x},${y}`
      })
      .join(' ')
  }, [progress])

  return (
    <div className="exercise-progress-page">
      <div className="exercise-progress-card">
        <div className="exercise-progress-header">
          <div>
            <p className="eyebrow">Workout Tracker</p>
            <h1>{exerciseName}</h1>
          </div>
          <Link to="/logworkout" className="primary-btn">Log another set</Link>
        </div>

        {loading ? (
          <p className="status-message">Loading progress...</p>
        ) : error ? (
          <p className="status-message error-message">{error}</p>
        ) : (
          <>
            <div className="chart-box">
              <svg viewBox="0 0 560 220" className="volume-chart" role="img" aria-label={`${exerciseName} volume chart`}>
                <line x1="15" y1="180" x2="545" y2="180" className="chart-axis" />
                <line x1="15" y1="20" x2="15" y2="180" className="chart-axis" />
                {progress.length > 0 && (
                  <polyline fill="none" stroke="#60a5fa" strokeWidth="3" points={chartPoints} />
                )}
              </svg>
            </div>

            <div className="history-table-wrap">
              <h2>Recent entries</h2>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Weight</th>
                    <th>Reps</th>
                    <th>Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length ? (
                    logs.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.log_date}</td>
                        <td>{Number(entry.weight).toFixed(1)}</td>
                        <td>{entry.reps}</td>
                        <td>{(Number(entry.weight) * Number(entry.reps)).toFixed(1)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4">No logs yet for this exercise.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ExerciseProgressPage
