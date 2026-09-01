import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import './logworkout.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const initialForm = {
  exercise_id: '',
  exercise_name: '',
  weight: '',
  reps: '',
  date: '',
}

function LogWorkoutPage() {
  const [form, setForm] = useState(initialForm)
  const [exerciseOptions, setExerciseOptions] = useState([])
  const [message, setMessage] = useState('')
  const navigate = useNavigate()
  const { session, setMessage: setGlobalMessage } = useAuth()

  useEffect(() => {
    const loadExercises = async () => {
      if (!session?.access_token) return

      try {
        const response = await fetch(`${API_URL}/exercises`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        if (!response.ok) return

        const result = await response.json()
        setExerciseOptions(result.exercises || [])
      } catch (error) {
        console.error('Failed to load exercises', error)
      }
    }

    loadExercises()
  }, [session])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!session?.access_token) {
      setGlobalMessage('Please log in again before saving workouts.')
      navigate('/login')
      return
    }

    try {
      let exerciseId = form.exercise_id

      if (!exerciseId && form.exercise_name.trim()) {
        const exerciseResponse = await fetch(`${API_URL}/exercises`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ name: form.exercise_name }),
        })

        const exerciseResult = await exerciseResponse.json()

        if (!exerciseResponse.ok) {
          throw new Error(exerciseResult.detail || 'Could not create exercise.')
        }

        exerciseId = exerciseResult.exercise?.id
      }

      if (!exerciseId) {
        throw new Error('Please choose or create an exercise before saving.')
      }

      const response = await fetch(`${API_URL}/workout-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          exercise_id: exerciseId,
          weight: Number(form.weight),
          reps: Number(form.reps),
          log_date: form.date,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.detail || 'Failed to save workout.')
      }

      setMessage('Workout saved successfully.')
      setGlobalMessage('Workout saved successfully.')
      setTimeout(() => {
        navigate('/dashboard')
      }, 500)
    } catch (error) {
      setMessage(error.message || 'Something went wrong while saving your workout.')
    }
  }

  return (
    <div className="logworkout-page">
      <div className="logworkout-card">
        <div className="logworkout-header">
          <p className="eyebrow">Workout Tracker</p>
          <h1>Log new workout</h1>
        </div>

        <form onSubmit={handleSubmit} className="logworkout-form">
          <label>
            Exercise
            <select
              name="exercise_id"
              value={form.exercise_id}
              onChange={handleChange}
            >
              <option value="">Select an exercise</option>
              {exerciseOptions.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Or create new exercise
            <input
              type="text"
              name="exercise_name"
              value={form.exercise_name}
              onChange={handleChange}
              placeholder="Exercise"
            />
          </label>

          <label>
            Weight
            <input
              type="number"
              name="weight"
              value={form.weight}
              onChange={handleChange}
              placeholder=""
              min="1"
              step="0.05"
              required
            />
          </label>

          <label>
            Reps
            <input
              type="number"
              name="reps"
              value={form.reps}
              onChange={handleChange}
              placeholder=""
              min="0.5"
              step="0.5"
              required
            />
          </label>

          <label>
            Date
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              required
            />
          </label>

          <div className="logworkout-actions">
            <button type="submit" className="primary-btn">Save workout</button>
            <Link to="/dashboard" className="secondary-btn">Cancel</Link>
          </div>
        </form>

        {message && <p className="status-message">{message}</p>}
      </div>
    </div>
  )
}

export default LogWorkoutPage
