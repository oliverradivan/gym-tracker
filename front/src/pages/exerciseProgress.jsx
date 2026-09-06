import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import { getExerciseCategory } from '../utils/exerciseCategory'
import { LineChart, Line } from '@/components/charts/line-chart'
import { Grid } from '@/components/charts/grid'
import { XAxis } from '@/components/charts/x-axis'
import { ChartTooltip } from '@/components/charts/tooltip/chart-tooltip'
import './exerciseProgress.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'
const PREDICTION_SETTING_KEY = 'workout-tracker-predictions-enabled'

const formatDisplayDate = (date) => {
  const [year, month, day] = String(date || '').slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : String(date || '')
}

function ExerciseProgressPage() {
  const { exerciseId } = useParams()
  const { session } = useAuth()
  const [logs, setLogs] = useState([])
  const [progress, setProgress] = useState([])
  const [exerciseName, setExerciseName] = useState('Exercise')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [predictions, setPredictions] = useState([])
  const [isPredicting, setIsPredicting] = useState(false)
  const [predictionError, setPredictionError] = useState('')
  const [predictionEnabled] = useState(() => {
    try {
      return localStorage.getItem(PREDICTION_SETTING_KEY) !== 'false'
    } catch {
      return true
    }
  })

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

  useEffect(() => {
    let mounted = true

    const loadPredictions = async () => {
      if (!predictionEnabled || progress.length < 2 || !session?.access_token) {
        setPredictions([])
        setPredictionError('')
        return
      }

      setIsPredicting(true)
      setPredictionError('')
      try {
        const response = await fetch(`${API_URL}/predictions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            exercise_id: exerciseId,
            points: progress.map((point) => ({ date: point.date, volume: point.volume })),
            periods: 5,
            interval_days: 7,
          }),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.detail || 'Failed to generate predictions.')
        if (mounted) setPredictions(result.predictions || [])
      } catch (predictionLoadError) {
        if (mounted) setPredictionError(predictionLoadError.message || 'Failed to generate predictions.')
      } finally {
        if (mounted) setIsPredicting(false)
      }
    }

    loadPredictions()
    return () => { mounted = false }
  }, [predictionEnabled, progress, session, exerciseId])

  const category = useMemo(() => getExerciseCategory(exerciseName), [exerciseName])
  const chartStroke = category === 'push' ? '#b91c1c' : category === 'pull' ? '#1d4ed8' : category === 'leg' ? '#b7791f' : '#111111'

  const showForecast = predictionEnabled && predictions.length > 0

  const chartData = useMemo(() => {
    const actual = progress.map((point) => ({
      date: new Date(`${point.date}T00:00:00Z`),
      volume: Number(point.volume || 0),
    }))
    if (!showForecast) return actual
    const forecast = predictions.map((point) => ({
      date: new Date(`${point.date}T00:00:00Z`),
      volume: Number(point.value || 0),
    }))
    return [...actual, ...forecast]
  }, [progress, predictions, showForecast])

  // Solid through the last real data point, dashed through the forecast tail.
  const dashFromIndex = showForecast && progress.length > 0 ? progress.length - 1 : undefined

  return (
    <div className={`exercise-progress-page ${category}`}>
      <div className={`exercise-progress-card ${category}`}>
        <div className="exercise-progress-header">
          <div>
            <p className="eyebrow">Workout Tracker</p>
            <h1>{exerciseName}</h1>
          </div>
          <Link to="/dashboard" className="primary-btn">Back to dashboard</Link>
        </div>

        {loading ? (
          <p className="status-message">Loading progress...</p>
        ) : error ? (
          <p className="status-message error-message">{error}</p>
        ) : (
          <>
            <div className="chart-box">
              <LineChart data={chartData} xDataKey="date">
                <Grid horizontal />
                <Line dataKey="volume" stroke={chartStroke} dashFromIndex={dashFromIndex} />
                <XAxis />
                <ChartTooltip />
              </LineChart>
              <div className="chart-footer">
                <div className="chart-legend">
                  <span className="legend-item"><span className="legend-line actual-line" />Actual volume</span>
                  {showForecast && <span className="legend-item"><span className="legend-line forecast-line" />Forecast</span>}
                </div>
                {isPredicting && <p className="status-message">Generating forecast...</p>}
                {predictionError && <p className="status-message error-message">{predictionError}</p>}
              </div>
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
                        <td>{formatDisplayDate(entry.log_date)}</td>
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