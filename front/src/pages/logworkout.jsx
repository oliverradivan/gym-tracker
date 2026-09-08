import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import { getExerciseCategory } from '../utils/exerciseCategory'
import './logworkout.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const getTodayKey = () => {
  const date = new Date()
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

const initialForm = {
  exercise_id: '',
  exercise_name: '',
  weight: '',
  reps: '',
  date: getTodayKey(),
}

function LogWorkoutPage() {
  const [form, setForm] = useState(initialForm)
  const [exerciseOptions, setExerciseOptions] = useState([])
  const [message, setMessage] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
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

  // Close the custom dropdown when clicking outside of it.
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => {
      const updated = { ...prev, [name]: value }
      if (name === 'exercise_name' && value) {
        updated.exercise_id = ''
      }
      return updated
    })
  }

  const handleSelectExercise = (event, exercise) => {
    event.stopPropagation()
    setForm((prev) => ({ ...prev, exercise_id: exercise.id, exercise_name: '' }))
    setDropdownOpen(false)
  }

  const selectedExercise = exerciseOptions.find((exercise) => exercise.id === form.exercise_id)

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
          <span>
            Exercise
            <div className="custom-select" ref={dropdownRef}>
              <button
                type="button"
                className={`custom-select-trigger ${selectedExercise ? `select-${getExerciseCategory(selectedExercise.name)}` : ''}`}
                onClick={() => setDropdownOpen((prev) => !prev)}
              >
                <span>{selectedExercise ? selectedExercise.name : 'Select an exercise'}</span>
                <span className={`custom-select-arrow ${dropdownOpen ? 'open' : ''}`} aria-hidden="true">
                  ▾
                </span>
              </button>

              {dropdownOpen && (
                <ul className="custom-select-list" role="listbox">
                  {exerciseOptions.map((exercise) => (
                    <li
                      key={exercise.id}
                      role="option"
                      aria-selected={exercise.id === form.exercise_id}
                      className={`custom-select-option option-${getExerciseCategory(exercise.name)} ${exercise.id === form.exercise_id ? 'selected' : ''}`}
                      onClick={(event) => handleSelectExercise(event, exercise)}
                    >
                      {exercise.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </span>

          <label>
            Weight (kg/notches)
            <input
              type="number"
              name="weight"
              value={form.weight}
              onChange={handleChange}
              placeholder=""
              min="0"
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