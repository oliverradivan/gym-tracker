import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import { getExerciseCategory } from '../utils/exerciseCategory'
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

  const category = useMemo(() => getExerciseCategory(exerciseName), [exerciseName])

  const chartPoints = useMemo(() => {
    if (!progress.length) return ''

    const width = 560
    const height = 220
    const maxVolume = Math.max(...progress.map((point) => Number(point.volume || 0)), 1)
    const minVolume = 0

    // Calculate date range for x-axis
    const dates = progress.map((p) => new Date(p.date).getTime())
    const minDate = Math.min(...dates)
    const maxDate = Math.max(...dates)
    const dateRange = maxDate - minDate || 1

    return progress
      .map((point) => {
        // X position based on date
        const pointDate = new Date(point.date).getTime()
        const xNormalized = (pointDate - minDate) / dateRange
        const x = xNormalized * (width - 30) + 15

        // Y position based on volume
        const normalized = (Number(point.volume) - minVolume) / Math.max(maxVolume - minVolume, 1)
        const y = height - 20 - normalized * (height - 40)
        return `${x},${y}`
      })
      .join(' ')
  }, [progress])

  // Generate date labels for x-axis
  const dateLabels = useMemo(() => {
    if (!progress.length) return []

    const width = 560
    const dates = progress.map((p) => new Date(p.date).getTime())
    const minDate = Math.min(...dates)
    const maxDate = Math.max(...dates)
    const dateRange = maxDate - minDate || 1

    // Show up to 3 date labels
    const labelPositions = []
    const step = Math.ceil(progress.length / 3)

    for (let i = 0; i < progress.length; i += step) {
      const point = progress[i]
      const pointDate = new Date(point.date).getTime()
      const xNormalized = (pointDate - minDate) / dateRange
      const x = xNormalized * (width - 30) + 15
      labelPositions.push({ x, date: point.date })
    }

    // Always add the last date
    if (progress.length > 0) {
      const lastPoint = progress[progress.length - 1]
      const pointDate = new Date(lastPoint.date).getTime()
      const xNormalized = (pointDate - minDate) / dateRange
      const x = xNormalized * (width - 30) + 15
      if (!labelPositions.some((l) => Math.abs(l.x - x) < 30)) {
        labelPositions.push({ x, date: lastPoint.date })
      }
    }

    return labelPositions
  }, [progress])

  const chartStroke = category === 'push' ? '#b91c1c' : category === 'pull' ? '#1d4ed8' : category === 'leg' ? '#b7791f' : '#111111'

  return (
    <div className={`exercise-progress-page ${category}`}>
      <div className={`exercise-progress-card ${category}`}>
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
              <svg viewBox="0 0 560 240" className="volume-chart" role="img" aria-label={`${exerciseName} volume chart`}>
                {/* Y-axis */}
                <line x1="15" y1="20" x2="15" y2="200" className="chart-axis" />
                {/* X-axis */}
                <line x1="15" y1="200" x2="545" y2="200" className="chart-axis" />
                
                {/* Y-axis label */}
                <text x="5" y="15" fontSize="12" textAnchor="end" className="chart-label">Volume</text>
                
                {/* X-axis labels (dates) */}
                {dateLabels.map((label, idx) => (
                  <g key={idx}>
                    <line x1={label.x} y1="198" x2={label.x} y2="202" className="chart-tick" />
                    <text x={label.x} y="220" fontSize="11" textAnchor="middle" className="chart-label">
                      {new Date(label.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </text>
                  </g>
                ))}
                
                {/* Chart line */}
                {progress.length > 0 && (
                  <polyline fill="none" stroke={chartStroke} strokeWidth="3" points={chartPoints} />
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
                        <td>{Number(entry.reps) % 1 === 0 ? Math.floor(entry.reps) : Number(entry.reps).toFixed(1)}</td>
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
