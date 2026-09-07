import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { curveLinear } from '@visx/curve'
import { useAuth } from '../context/authContext'
import { getExerciseCategory } from '../utils/exerciseCategory'
import { LineChart, Line } from '@/components/charts/line-chart'
import { Grid } from '@/components/charts/grid'
import { XAxis } from '@/components/charts/x-axis'
import YAxis from '@/components/charts/y-axis'
import { ChartTooltip } from '@/components/charts/tooltip/chart-tooltip'
import './progress.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'
const PREDICTION_SETTING_KEY = 'workout-tracker-predictions-enabled'
const METRICS = {
  volume: { label: 'Volume' },
  weight: { label: 'Weight' },
  reps: { label: 'Reps' },
}

const formatDisplayDate = (date) => {
  const [year, month, day] = String(date || '').slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : String(date || '')
}

function ProgressPage() {
  const { session } = useAuth()
  const { exerciseId } = useParams()
  const [exercises, setExercises] = useState([])
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [progress, setProgress] = useState([])
  const [selectedMetric, setSelectedMetric] = useState('volume')
  const [loading, setLoading] = useState(true)
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

        const urlExercise = items.find((item) => String(item.id) === exerciseId)
        if (urlExercise) {
          setSelectedExerciseId(urlExercise.id)
        } else if (items[0]) {
          setSelectedExerciseId(items[0].id)
        }
      } catch (error) {
        console.error(error)
      }
    }

    loadExercises()
  }, [exerciseId, session])

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

  const selectedExercise = exercises.find((exercise) => exercise.id === selectedExerciseId)
  const category = useMemo(() => getExerciseCategory(selectedExercise?.name || ''), [selectedExercise])
  const chartStroke = category === 'push' ? '#b91c1c' : category === 'pull' ? '#1d4ed8' : category === 'leg' ? '#b7791f' : '#111111'

  const showForecast = selectedMetric === 'volume' && predictionEnabled && predictions.length > 0

  const chartData = useMemo(() => {
    const actual = progress.map((point) => ({
      date: new Date(`${point.date}T00:00:00Z`),
      actualValue: Number(point[selectedMetric] || 0),
    }))
    if (!showForecast) return actual

    const lastActual = actual.at(-1)
    const actualWithConnection = lastActual
      ? [...actual.slice(0, -1), { ...lastActual, forecastValue: lastActual.actualValue }]
      : actual
    const forecast = predictions.map((point) => ({
      date: new Date(`${point.date}T00:00:00Z`),
      forecastValue: Number(point.value || 0),
    }))
    return [...actualWithConnection, ...forecast]
  }, [progress, predictions, selectedMetric, showForecast])

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
              <LineChart data={chartData} xDataKey="date">
                <Grid horizontal />
                <Line dataKey="actualValue" stroke={chartStroke} curve={curveLinear} showMarkers />
                {showForecast && (
                  <Line
                    dataKey="forecastValue"
                    stroke={chartStroke}
                    curve={curveLinear}
                    dashFromIndex={0}
                  />
                )}
                <YAxis />
                <XAxis />
                <ChartTooltip />
              </LineChart>
              <div className="chart-footer">
                <div className="chart-legend" aria-label="Chart legend">
                  <span className="legend-item">
                    <span className="legend-line actual-line" />
                    Actual {METRICS[selectedMetric].label.toLowerCase()}
                  </span>
                  {showForecast && (
                    <span className="legend-item">
                      <span className="legend-line forecast-line" />
                      Forecast
                    </span>
                  )}
                </div>
                {isPredicting && <p className="status-message">Generating forecast...</p>}
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