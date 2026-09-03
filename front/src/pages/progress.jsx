import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import { getExerciseCategory } from '../utils/exerciseCategory'
import './progress.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'
const PREDICTION_SETTING_KEY = 'workout-tracker-predictions-enabled'
const GRAPH_SCROLL_SETTING_KEY = 'workout-tracker-graph-scroll-enabled'
const METRICS = {
  volume: { label: 'Volume', axisLabel: 'Volume' },
  weight: { label: 'Weight', axisLabel: 'Weight (kg)' },
  reps: { label: 'Reps', axisLabel: 'Reps' },
}

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
const millisecondsPerDay = 24 * 60 * 60 * 1000

function ProgressPage() {
  const { session } = useAuth()
  const [exercises, setExercises] = useState([])
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [progress, setProgress] = useState([])
  const [selectedMetric, setSelectedMetric] = useState('volume')
  const [loading, setLoading] = useState(true)
  const [predictions, setPredictions] = useState([])
  const [isPredicting, setIsPredicting] = useState(false)
  const [predictionError, setPredictionError] = useState('')
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
  const [predictionEnabled] = useState(() => {
    try {
      return localStorage.getItem(PREDICTION_SETTING_KEY) !== 'false'
    } catch {
      return true
    }
  })

  useEffect(() => {
    const loadExercises = async () => {
      if (!session?.access_token) return

      try {
        const response = await fetch(`${API_URL}/exercises`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        if (!response.ok) {
          throw new Error('Unable to load exercises.')
        }

        const result = await response.json()
        const items = result.exercises || []
        setExercises(items)

        if (items[0]) {
          setSelectedExerciseId(items[0].id)
        }
      } catch (error) {
        console.error(error)
      }
    }

    loadExercises()
  }, [session])

  useEffect(() => {
    const loadProgress = async () => {
      if (!session?.access_token || !selectedExerciseId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const response = await fetch(
          `${API_URL}/workout-logs/progress?exercise_id=${selectedExerciseId}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        )

        if (!response.ok) {
          throw new Error('Unable to load progress.')
        }

        const result = await response.json()
        setProgress(result.progress || [])
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    loadProgress()
  }, [selectedExerciseId, session])

  // Load predictions when progress data changes (not on isPredicting changes)
  useEffect(() => {
    let mounted = true

    const loadPredictions = async () => {
      if (!predictionEnabled || !selectedExerciseId || progress.length < 2) {
        if (mounted) {
          setPredictions([])
          setPredictionError('')
          setIsPredicting(false)
        }
        return
      }

      setIsPredicting(true)
      setPredictionError('')

      try {
        const response = await fetch(`${API_URL}/predictions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            exercise_id: selectedExerciseId,
            points: progress.map((point) => ({
              date: point.date,
              volume: point.volume,
            })),
            periods: 5,
            interval_days: 7,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.detail || 'Failed to generate predictions.')
        }

        const result = await response.json()
        if (mounted) {
          setPredictions(result.predictions || [])
        }
      } catch (error) {
        console.error(error)
        if (mounted) {
          setPredictionError(error.message || 'Failed to generate predictions.')
        }
      } finally {
        if (mounted) {
          setIsPredicting(false)
        }
      }
    }

    loadPredictions()
    return () => { mounted = false }
  }, [predictionEnabled, selectedExerciseId, progress, session])

  const metric = METRICS[selectedMetric]
  const showForecast = selectedMetric === 'volume' && predictionEnabled
  const chartDates = [
    ...progress.map((point) => point.date),
    ...(showForecast ? predictions.map((point) => point.date) : []),
  ].filter(Boolean)
  const chartStartTimestamp = chartTimestamp(chartDates[0])
  const chartEndTimestamp = chartTimestamp(chartDates[chartDates.length - 1])
  const chartSpanDays = Math.max(1, (chartEndTimestamp - chartStartTimestamp) / millisecondsPerDay)
  const chartWidth = graphScrollable ? Math.max(720, chartSpanDays * 10 + 60) : 720
  const chartPlotWidth = chartWidth - 60
  const chartXForDate = useCallback((date) => {
    const timestamp = chartTimestamp(date)
    const elapsedDays = (timestamp - chartStartTimestamp) / millisecondsPerDay
    return 30 + (elapsedDays / chartSpanDays) * chartPlotWidth
  }, [chartPlotWidth, chartSpanDays, chartStartTimestamp])

  const chartMaxValue = useMemo(
    () => Math.max(
      ...progress.map((point) => Number(point[selectedMetric] || 0)),
      ...(showForecast ? predictions.map((point) => Number(point.value || 0)) : []),
      1,
    ),
    [progress, predictions, selectedMetric, showForecast],
  )

  const chartPoints = useMemo(() => {
    if (!progress.length) return ''

    return progress
      .map((point) => {
        const x = chartXForDate(point.date)
        const normalized = Number(point[selectedMetric]) / chartMaxValue
        const y = 180 - normalized * 160
        return `${x},${y}`
      })
      .join(' ')
  }, [chartMaxValue, chartXForDate, progress, selectedMetric])

  // Compute chart points for predicted future values
  const predictedPoints = useMemo(() => {
    if (!showForecast || !predictions.length || !progress.length) return ''

    const lastActualX = chartXForDate(progress[progress.length - 1].date)
      const lastActualValue = Number(progress[progress.length - 1][selectedMetric] || 0)
    const lastActualY = 180 - (lastActualValue / chartMaxValue) * 160

    const forecastPoints = predictions
      .map((point) => {
        const x = chartXForDate(point.date)
        const normalized = Number(point.value) / chartMaxValue
        const y = 180 - normalized * 160
        return `${x},${y}`
      })
      .join(' ')

    return `${lastActualX},${lastActualY} ${forecastPoints}`
  }, [chartMaxValue, chartXForDate, predictions, progress, selectedMetric, showForecast])

  const selectedExercise = exercises.find((exercise) => exercise.id === selectedExerciseId)
  const category = useMemo(() => getExerciseCategory(selectedExercise?.name || ''), [selectedExercise])
  const chartStroke = category === 'push' ? '#b91c1c' : category === 'pull' ? '#1d4ed8' : category === 'leg' ? '#b7791f' : '#111111'
  const chartY = (value) => 180 - (Number(value || 0) / chartMaxValue) * 160
  const lastActualPoint = progress.length > 0
    ? { x: chartXForDate(progress[progress.length - 1].date), y: chartY(progress[progress.length - 1][selectedMetric]) }
    : null
  const firstPredictionPoint = predictions.length > 0
    ? { x: chartXForDate(predictions[0].date), y: chartY(predictions[0].value) }
    : null
  const chartDateLabels = [
    ...progress.map((point) => ({ date: point.date })),
    ...(showForecast ? predictions.map((point) => ({ date: point.date })) : []),
  ]

  return (
    <div className={`progress-page ${category}`}>
      <div className={`progress-card ${category}`}>
        <div className="progress-header">
          <div>
            <p className="eyebrow">Workout Tracker</p>
            <h1>Progress</h1>
          </div>
          <Link to="/dashboard" className="secondary-btn">Back to dashboard</Link>
        </div>

        <label className="exercise-select-label">
          Exercise
          <select value={selectedExerciseId} onChange={(event) => setSelectedExerciseId(event.target.value)}>
            {exercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>{exercise.name}</option>
            ))}
          </select>
        </label>

        {loading ? (
          <p className="status-message">Loading progress...</p>
        ) : !selectedExercise ? (
          <p className="status-message">No exercise selected.</p>
        ) : progress.length === 0 ? (
          <p className="status-message">No progress data yet for {selectedExercise.name}.</p>
        ) : (
          <>
            <div className="metric-toggle" role="group" aria-label="Chart metric">
              {Object.entries(METRICS).map(([value, details]) => (
                <button
                  key={value}
                  type="button"
                  className={selectedMetric === value ? 'active' : ''}
                  aria-pressed={selectedMetric === value}
                  onClick={() => setSelectedMetric(value)}
                >
                  {details.label}
                </button>
              ))}
            </div>
            <div className="chart-box">
              <div className={`chart-scroll ${graphScrollable ? 'is-scrollable' : 'is-compressed'}`}>
                <svg viewBox={`0 0 ${chartWidth} 220`} style={{ width: graphScrollable ? `${chartWidth}px` : '100%' }} className="volume-chart" role="img" aria-label={`${selectedExercise.name} ${metric.label.toLowerCase()} chart`}>
                <text x="10" y="100" textAnchor="middle" transform="rotate(-90 10 100)" className="chart-axis-title">
                  {metric.axisLabel}
                </text>
                {[0, 0.5, 1].map((ratio) => {
                  const y = 180 - ratio * 160
                  return (
                    <g key={ratio}>
                      <line x1="30" y1={y} x2={chartWidth - 30} y2={y} className="chart-grid-line" />
                      <text x="24" y={y + 4} textAnchor="end" className="chart-axis-label">
                        {formatChartValue(chartMaxValue * ratio)}
                      </text>
                    </g>
                  )
                })}
                <line x1="30" y1="180" x2={chartWidth - 30} y2="180" className="chart-axis" />
                <line x1="30" y1="20" x2="30" y2="180" className="chart-axis" />

                {chartDateLabels.map((label) => (
                  <text key={label.date} x={chartXForDate(label.date)} y="205" textAnchor="start" transform={`rotate(-45 ${chartXForDate(label.date)} 205)`} className="chart-axis-label">
                    {formatChartDate(label.date)}
                  </text>
                ))}

                <polyline fill="none" stroke={chartStroke} strokeWidth="3" points={chartPoints} />
                {progress.map((point) => (
                  <circle key={`actual-${point.date}`} cx={chartXForDate(point.date)} cy={chartY(point[selectedMetric])} r="4" fill={chartStroke} />
                ))}

                {/* Predicted future points - dashed line */}
                {showForecast && predictions.length > 0 && (
                  <>
                    {lastActualPoint && firstPredictionPoint && (
                      <line
                        x1={lastActualPoint.x}
                        y1={lastActualPoint.y}
                        x2={firstPredictionPoint.x}
                        y2={firstPredictionPoint.y}
                        className="forecast-connector"
                      />
                    )}
                    <polyline
                      fill="none"
                      stroke="#64748b"
                      strokeWidth="3"
                      strokeDasharray="8, 6"
                      points={predictedPoints}
                    />
                    {predictions.map((point) => (
                      <g key={`forecast-${point.date}`}>
                        <circle cx={chartXForDate(point.date)} cy={chartY(point.value)} r="4" fill="#64748b" />
                        <text
                          x={chartXForDate(point.date)}
                          y={chartY(point.value) - 10}
                          textAnchor="middle"
                          className="chart-label"
                        >
                          {formatChartValue(point.value)}
                        </text>
                      </g>
                    ))}
                  </>
                )}
                </svg>
              </div>
              <div className="chart-footer">
                <div className="chart-legend" aria-label="Chart legend">
                  <span className="legend-item">
                    <span className="legend-line actual-line" />
                    Actual {metric.label.toLowerCase()}
                  </span>
                  {showForecast && predictions.length > 0 && (
                    <span className="legend-item">
                      <span className="legend-line forecast-line" />
                      Forecast
                    </span>
                  )}
                </div>
                {isPredicting && <p className="status-message">Generating forecast...</p>}
                {!predictionEnabled && (
                  <p className="status-message"></p>
                )}
                {predictionError && <p className="status-message error-message">{predictionError}</p>}
              </div>
            </div>

            <table className="progress-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Weight</th>
                  <th>Reps</th>
                  <th>Volume</th>
                </tr>
              </thead>
              <tbody>
                {progress.map((point) => (
                  <tr key={point.date}>
                    <td>{formatDisplayDate(point.date)}</td>
                    <td>{Number(point.weight || 0).toFixed(1)}</td>
                    <td>{Number(point.reps) % 1 === 0 ? Number(point.reps) : Number(point.reps).toFixed(1)}</td>
                    <td>{Number(point.volume).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}

export default ProgressPage
