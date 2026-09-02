import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import { getExerciseCategory } from '../utils/exerciseCategory'
import './progress.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'
const PREDICTION_SETTING_KEY = 'workout-tracker-predictions-enabled'

const formatChartDate = (date) => String(date || '').slice(5)
const formatChartValue = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })

function ProgressPage() {
  const { session } = useAuth()
  const [exercises, setExercises] = useState([])
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [progress, setProgress] = useState([])
  const [loading, setLoading] = useState(true)
  const [predictions, setPredictions] = useState([])
  const [isPredicting, setIsPredicting] = useState(false)
  const [predictionError, setPredictionError] = useState('')
  const [chartWidth, setChartWidth] = useState(720)
  const [predictionEnabled, setPredictionEnabled] = useState(() => {
    try {
      return localStorage.getItem(PREDICTION_SETTING_KEY) !== 'false'
    } catch {
      return true
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(PREDICTION_SETTING_KEY, String(predictionEnabled))
    } catch {
      // Ignore storage issues in restricted environments.
    }
  }, [predictionEnabled])

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
            points: progress.map((point) => ({
              date: point.date,
              volume: point.volume,
            })),
            periods: 7,
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

  const chartPointCount = progress.length + (predictionEnabled ? predictions.length : 0)
  const maxChartWidth = Math.max(720, chartPointCount * 70)

  useEffect(() => {
    setChartWidth(maxChartWidth)
  }, [maxChartWidth])

  const chartMaxValue = useMemo(
    () => Math.max(
      ...progress.map((point) => Number(point.volume || 0)),
      ...predictions.map((point) => Number(point.value || 0)),
      1,
    ),
    [progress, predictions],
  )

  const chartPoints = useMemo(() => {
    if (!progress.length) return ''

    const height = 220
    const leftPad = 30
    const rightPad = 30
    const plotWidth = chartWidth - leftPad - rightPad
    const totalPoints = Math.max(progress.length + (predictionEnabled ? predictions.length : 0), 2)

    return progress
      .map((point, index) => {
        const x = leftPad + (index / Math.max(totalPoints - 1, 1)) * plotWidth
        const normalized = Number(point.volume) / chartMaxValue
        const y = height - 20 - normalized * (height - 40)
        return `${x},${y}`
      })
      .join(' ')
  }, [chartMaxValue, chartWidth, predictionEnabled, predictions, progress])

  // Compute chart points for predicted future values
  const predictedPoints = useMemo(() => {
    if (!predictionEnabled || !predictions.length || !progress.length) return ''

    const height = 220
    const leftPad = 30
    const rightPad = 30
    const plotWidth = chartWidth - leftPad - rightPad
    const totalPoints = Math.max(progress.length + predictions.length, 2)
    const lastActualIndex = progress.length - 1
    const lastActualX = leftPad + (lastActualIndex / Math.max(totalPoints - 1, 1)) * plotWidth
    const lastActualValue = Number(progress[lastActualIndex].volume || 0)
    const lastActualY = height - 20 - (lastActualValue / chartMaxValue) * (height - 40)

    const forecastPoints = predictions
      .map((point, index) => {
        const x = leftPad + ((progress.length + index) / Math.max(totalPoints - 1, 1)) * plotWidth
        const normalized = Number(point.value) / chartMaxValue
        const y = height - 20 - normalized * (height - 40)
        return `${x},${y}`
      })
      .join(' ')

    return `${lastActualX},${lastActualY} ${forecastPoints}`
  }, [chartMaxValue, chartWidth, predictionEnabled, predictions, progress])

  const selectedExercise = exercises.find((exercise) => exercise.id === selectedExerciseId)
  const category = useMemo(() => getExerciseCategory(selectedExercise?.name || ''), [selectedExercise])
  const chartStroke = category === 'push' ? '#b91c1c' : category === 'pull' ? '#1d4ed8' : category === 'leg' ? '#b7791f' : '#111111'
  const totalChartPoints = Math.max(chartPointCount, 2)
  const chartPlotWidth = chartWidth - 60
  const chartX = (index) => 30 + (index / Math.max(totalChartPoints - 1, 1)) * chartPlotWidth
  const chartDateLabels = [
    { index: 0, date: progress[0]?.date },
    ...(progress.length > 1 ? [{ index: progress.length - 1, date: progress[progress.length - 1]?.date }] : []),
    ...(predictions.length > 0 ? [{ index: progress.length + predictions.length - 1, date: predictions[predictions.length - 1]?.date }] : []),
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
            <div className="chart-box">
              <div className="chart-scroll">
                <svg viewBox={`0 0 ${chartWidth} 220`} style={{ width: `${chartWidth}px` }} className="volume-chart" role="img" aria-label={`${selectedExercise.name} volume chart`}>
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
                  <text key={`${label.index}-${label.date}`} x={chartX(label.index)} y="205" textAnchor="middle" className="chart-axis-label">
                    {formatChartDate(label.date)}
                  </text>
                ))}

                <polyline fill="none" stroke={chartStroke} strokeWidth="3" points={chartPoints} />

                {/* Predicted future points - dashed line */}
                {predictionEnabled && predictions.length > 0 && (
                  <polyline
                    fill="none"
                    stroke="#64748b"
                    strokeWidth="3"
                    strokeDasharray="8, 6"
                    points={predictedPoints}
                  />
                )}
                </svg>
              </div>
              {maxChartWidth > 720 && (
                <label className="chart-width-control">
                  <span>Chart width</span>
                  <input
                    type="range"
                    min="720"
                    max={maxChartWidth}
                    step="10"
                    value={chartWidth}
                    onChange={(event) => setChartWidth(Number(event.target.value))}
                    aria-label="Adjust chart width"
                  />
                  <span>{chartWidth >= maxChartWidth ? 'Expanded' : 'Compressed'}</span>
                </label>
              )}
              <div className="chart-footer">
                <div className="chart-legend" aria-label="Chart legend">
                  <span className="legend-item">
                    <span className="legend-line actual-line" />
                    Actual volume
                  </span>
                  {predictionEnabled && predictions.length > 0 && (
                    <span className="legend-item">
                      <span className="legend-line forecast-line" />
                      Forecast
                    </span>
                  )}
                </div>
                {isPredicting && <p className="status-message">Generating forecast...</p>}
                {!predictionEnabled && (
                  <p className="status-message">Predictions are disabled in settings.</p>
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
                    <td>{point.date}</td>
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
