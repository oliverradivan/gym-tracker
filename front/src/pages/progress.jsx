import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import { getExerciseCategory } from '../utils/exerciseCategory'
import './progress.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'

function ProgressPage() {
  const { session } = useAuth()
  const [exercises, setExercises] = useState([])
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [progress, setProgress] = useState([])
  const [loading, setLoading] = useState(true)
  const [predictions, setPredictions] = useState([])
  const [isPredicting, setIsPredicting] = useState(false)
  const [predictionError, setPredictionError] = useState('')

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
      if (!selectedExerciseId || progress.length < 2) {
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
          const errorData = await response.json()
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
  }, [selectedExerciseId, progress, session])

  const chartPoints = useMemo(() => {
    if (!progress.length) return ''

    const width = 560
    const height = 220
    const maxValue = Math.max(...progress.map((point) => Number(point.volume || 0)), 1)

    return progress
      .map((point, index) => {
        const x = (index / Math.max(progress.length - 1, 1)) * (width - 30) + 15
        const normalized = Number(point.volume) / maxValue
        const y = height - 20 - normalized * (height - 40)
        return `${x},${y}`
      })
      .join(' ')
  }, [progress])

  const maxValue = useMemo(
    () => Math.max(
      ...progress.map((point) => Number(point.volume || 0)),
      ...predictions.map((point) => Number(point.value || 0)),
      1,
    ),
    [progress, predictions],
  )

  // Compute chart points for predicted future values
  const predictedPoints = useMemo(() => {
    if (!predictions.length || !progress.length) return ''

    const width = 560
    const height = 220

    // Start x position after the last actual data point
    const lastActualIndex = progress.length - 1
    const startX =
      (lastActualIndex / Math.max(progress.length - 1, 1)) * (width - 30) + 15
    const endX = width - 15 // margin on the right

    // Spread predicted points evenly from end of actual data to right edge
    return predictions
      .map((point, index) => {
        const x =
          startX +
          (index / Math.max(predictions.length - 1, 1)) * (endX - startX)
        const normalized = Number(point.value) / maxValue
        const y = height - 20 - normalized * (height - 40)
        return `${x},${y}`
      })
      .join(' ')
  }, [maxValue, predictions, progress])

  const selectedExercise = exercises.find((exercise) => exercise.id === selectedExerciseId)
  const category = useMemo(() => getExerciseCategory(selectedExercise?.name || ''), [selectedExercise])
  const chartStroke = category === 'push' ? '#b91c1c' : category === 'pull' ? '#1d4ed8' : category === 'leg' ? '#b7791f' : '#111111'

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
              <svg viewBox="0 0 560 220" className="volume-chart" role="img" aria-label={`${selectedExercise.name} volume chart`}>
                <line x1="15" y1="180" x2="545" y2="180" className="chart-axis" />
                <line x1="15" y1="20" x2="15" y2="180" className="chart-axis" />

                <polyline fill="none" stroke={chartStroke} strokeWidth="3" points={chartPoints} />

                {/* Predicted future points - dashed line */}
                {predictions.length > 0 && (
                  <polyline
                    fill="none"
                    stroke="#64748b"
                    strokeWidth="2"
                    strokeDasharray="5, 3"
                    points={predictedPoints}
                  />
                )}

                {/* Predict toggle button */}
                {predictions.length === 0 && !isPredicting && (
                  <button
                    onClick={() => setIsPredicting(true)}
                    className="predict-toggle"
                    disabled={progress.length < 2}
                    title="Generate AI forecast for this exercise">
                    Predict
                  </button>
                )}

                {predictionError && (
                  <p className="status-message error-message">
                    {predictionError}
                  </p>
                )}
              </svg>
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
