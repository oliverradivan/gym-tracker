import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import './progress.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'

function ProgressPage() {
  const { session } = useAuth()
  const [exercises, setExercises] = useState([])
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [progress, setProgress] = useState([])
  const [loading, setLoading] = useState(true)

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

  const selectedExercise = exercises.find((exercise) => exercise.id === selectedExerciseId)

  return (
    <div className="progress-page">
      <div className="progress-card">
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

                <polyline fill="none" stroke="#60a5fa" strokeWidth="3" points={chartPoints} />
              </svg>
            </div>

            <table className="progress-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Volume</th>
                  <th>Reps</th>
                </tr>
              </thead>
              <tbody>
                {progress.map((point) => (
                  <tr key={point.date}>
                    <td>{point.date}</td>
                    <td>{Number(point.volume).toFixed(1)}</td>
                    <td>{point.reps}</td>
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
