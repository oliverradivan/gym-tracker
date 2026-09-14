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
  const dateInputRef = useRef(null)
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
        setMessage('Failed to load exercises. Please try again.')
        console.error('Failed to load exercises', error)
      }
    }

    loadExercises()
  }, [session])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm(prev => {
      const updated = { ...prev, [name]: value }
      if (name === 'exercise_id' && value) {
        updated.exercise_name = ''
      }
      if (name === 'exercise_name' && value) {
        updated.exercise_id = ''
      }
      return updated
    })
  }

  const formatDisplayDate = (isoDate) => {
    if (!isoDate) return ''
    const [year, month, day] = isoDate.split('-')
    return `${day}/${month}/${year}`
  }

  const handleDateClick = () => {
    const input = dateInputRef.current
    if (!input) return

    // A plain focus() only opens the native calendar on mobile browsers.
    // Desktop browsers (Chrome in particular) only auto-open it if the click
    // lands on the input's own tiny calendar-icon hitbox, which is invisible
    // here since the input is stretched/hidden over the whole field.
    // showPicker() opens it programmatically from any click on the field.
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker()
      } catch (error) {
        input.focus()
      }
    } else {
      input.focus()
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!session?.access_token) {
      setGlobalMessage('Please log in again before saving workouts.')
      navigate('/login')
      return
    }

    setMessage('Saving...')
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
            <select
              value={form.exercise_id}
              onChange={e => {
                setForm(prev => ({
                  ...prev,
                  exercise_id: e.target.value,
                  exercise_name: ''
                }))
              }}
              className={`select-${form.exercise_id ? getExerciseCategory(exerciseOptions.find(opt => opt.id === form.exercise_id)?.name || '') : ''}`}
            >
              <option value="">Select an exercise</option>
              {exerciseOptions.map(exercise => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
            </select>
          </span>
          <span>
            Or create new exercise
            <input
              type="text"
              name="exercise_name"
              value={form.exercise_name}
              onChange={handleChange}
              placeholder="New exercise name"
            />
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
              step="any"
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
              step="any"
              required
            />
          </label>

          <label>
            Date
            <div className="date-picker-field" onClick={handleDateClick}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <input
                type="text"
                value={formatDisplayDate(form.date)}
                readOnly
                placeholder="Select a date"
                className="date-display-input"
                tabIndex={-1}
                aria-hidden="true"
                onClick={handleDateClick}
              />
              {/* Real native date input, stretched invisibly over the whole
                  field so the tap/click lands on it directly. Mobile browsers
                  (iOS Safari in particular) only open the native picker UI for
                  a genuine user gesture on the input itself — a JS-triggered
                  .click()/.focus()/showPicker() on a hidden input is ignored
                  on iOS and unreliable elsewhere. */}
              <input
                ref={dateInputRef}
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                onClick={handleDateClick}
                required
                className="date-native-input"
              />
            </div>
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