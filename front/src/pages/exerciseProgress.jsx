import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import { getExerciseCategory } from '../utils/exerciseCategory'
import './exerciseProgress.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'
const PREDICTION_SETTING_KEY = 'workout-tracker-predictions-enabled'
const GRAPH_SCROLL_SETTING_KEY = 'workout-tracker-graph-scroll-enabled'
const millisecondsPerDay = 24 * 60 * 60 * 1000

const formatDisplayDate = (date) => {
  const [year, month, day] = String(date || '').slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : String(date || '')
}
const formatChartDate = (date) => {
  const [year, month, day] = String(date || '').slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}` : String(date || '')
}
const formatChartValue = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })
const chartTimestamp = (date) => Date.parse(`${date}T00:00:00Z`)

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
  const [graphScrollable] = useState(() => {
    try {
      const savedPreference = localStorage.getItem(GRAPH_SCROLL_SETTING_KEY)
      return savedPreference === null
        ? window.matchMedia('(max-width: 640px)').matches
        : savedPreference === 'true'
    } catch {
      return false
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

  const chartDates = [
    ...progress.map((point) => point.date),
    ...(predictionEnabled ? predictions.map((point) => point.date) : []),
  ].filter(Boolean)
  const chartStartTimestamp = chartTimestamp(chartDates[0])
  const chartEndTimestamp = chartTimestamp(chartDates[chartDates.length - 1])
  const chartSpanDays = Math.max(1, (chartEndTimestamp - chartStartTimestamp) / millisecondsPerDay)
  const chartWidth = graphScrollable ? Math.max(720, chartSpanDays * 10 + 60) : 720
  const chartPlotWidth = chartWidth - 60
  const chartXForDate = useCallback(
    (date) => 30 + (((chartTimestamp(date) - chartStartTimestamp) / millisecondsPerDay) / chartSpanDays) * chartPlotWidth,
    [chartPlotWidth, chartSpanDays, chartStartTimestamp],
  )
  const chartMaxValue = Math.max(
    ...progress.map((point) => Number(point.volume || 0)),
    ...predictions.map((point) => Number(point.value || 0)),
    1,
  )
  const chartY = useCallback(
    (value) => 200 - (Number(value || 0) / chartMaxValue) * 160,
    [chartMaxValue],
  )

  const chartPoints = useMemo(() => {
    if (!progress.length) return ''

    return progress
      .map((point) => {
        return `${chartXForDate(point.date)},${chartY(point.volume)}`
      })
      .join(' ')
  }, [chartXForDate, chartY, progress])

  const predictedPoints = useMemo(() => {
    if (!predictionEnabled || !predictions.length || !progress.length) return ''
    const lastActual = progress[progress.length - 1]
    return `${chartXForDate(lastActual.date)},${chartY(lastActual.volume)} ${predictions.map((point) => `${chartXForDate(point.date)},${chartY(point.value)}`).join(' ')}`
  }, [chartXForDate, chartY, predictionEnabled, predictions, progress])
  const lastActual = progress[progress.length - 1]
  const firstPrediction = predictions[0]

  const chartDateLabels = [
    ...progress.map((point) => ({ date: point.date })),
    ...(predictionEnabled ? predictions.map((point) => ({ date: point.date })) : []),
  ]

  const chartStroke = category === 'push' ? '#b91c1c' : category === 'pull' ? '#1d4ed8' : category === 'leg' ? '#b7791f' : '#111111'

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
              <div className={`chart-scroll ${graphScrollable ? 'is-scrollable' : 'is-compressed'}`}>
                <svg viewBox={`0 0 ${chartWidth} 240`} style={{ width: graphScrollable ? `${chartWidth}px` : '100%' }} className="volume-chart" role="img" aria-label={`${exerciseName} volume chart`}>
                  {[0, 0.5, 1].map((ratio) => {
                    const y = 200 - ratio * 160
                    return (
                      <g key={ratio}>
                        <line x1="30" y1={y} x2={chartWidth - 30} y2={y} className="chart-grid-line" />
                        <text x="24" y={y + 4} textAnchor="end" className="chart-axis-label">
                          {formatChartValue(chartMaxValue * ratio)}
                        </text>
                      </g>
                    )
                  })}
                  <line x1="30" y1="200" x2={chartWidth - 30} y2="200" className="chart-axis" />
                  <line x1="30" y1="40" x2="30" y2="200" className="chart-axis" />

                  {chartDateLabels.map((label) => (
                    <g key={label.date}>
                      <line x1={chartXForDate(label.date)} y1="198" x2={chartXForDate(label.date)} y2="202" className="chart-tick" />
                      <text x={chartXForDate(label.date)} y="225" textAnchor="start" transform={`rotate(-45 ${chartXForDate(label.date)} 225)`} className="chart-axis-label">
                        {formatChartDate(label.date)}
                      </text>
                    </g>
                  ))}

                  {progress.length > 0 && <polyline fill="none" stroke={chartStroke} strokeWidth="3" points={chartPoints} />}
                  {progress.map((point) => (
                    <circle key={`actual-${point.date}`} cx={chartXForDate(point.date)} cy={chartY(point.volume)} r="4" fill={chartStroke} />
                  ))}
                  {predictionEnabled && predictions.length > 0 && (
                    <>
                      <line
                        x1={chartXForDate(lastActual.date)}
                        y1={chartY(lastActual.volume)}
                        x2={chartXForDate(firstPrediction.date)}
                        y2={chartY(firstPrediction.value)}
                        className="forecast-connector"
                      />
                      <polyline fill="none" stroke="#64748b" strokeWidth="3" strokeDasharray="8, 6" points={predictedPoints} />
                      {predictions.map((point) => (
                        <circle key={`forecast-${point.date}`} cx={chartXForDate(point.date)} cy={chartY(point.value)} r="4" fill="#64748b" />
                      ))}
                    </>
                  )}
                </svg>
              </div>
              <div className="chart-footer">
                <div className="chart-legend">
                  <span className="legend-item"><span className="legend-line actual-line" />Actual volume</span>
                  {predictionEnabled && predictions.length > 0 && <span className="legend-item"><span className="legend-line forecast-line" />Forecast</span>}
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
