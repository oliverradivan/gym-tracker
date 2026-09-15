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
  weight: '',
  reps: '',
  date: getTodayKey(),
}

function LogWorkoutPage() {
  const [form, setForm] = useState(initialForm)
  const [exerciseOptions, setExerciseOptions] = useState([])
  const [message, setMessage] = useState('')
  const [selectOpen, setSelectOpen] = useState(false)
  const dateInputRef = useRef(null)
  const selectRef = useRef(null)
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

  // Close the custom dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setSelectOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const selectedExercise = exerciseOptions.find(opt => opt.id === form.exercise_id)
  const selectedCategory = selectedExercise ? getExerciseCategory(selectedExercise.name || '') : ''

  const handleSelectExercise = (event, exerciseId) => {
    // Fire on mousedown (not click) and stop it from reaching the
    // document-level outside-click listener. Relying on 'click' here meant
    // selection only registered if mouseup landed cleanly back on the same
    // <li> — any small cursor movement (trackpads especially) could drop the
    // click entirely, making the menu feel like it wouldn't close until a
    // second, cleaner click.
    event.preventDefault()
    event.stopPropagation()
    setForm(prev => ({ ...prev, exercise_id: exerciseId }))
    setSelectOpen(false)
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

    if (!form.exercise_id) {
      setMessage('Please choose an exercise before saving.')
      return
    }

    setMessage('Saving...')
    try {
      const response = await fetch(`${API_URL}/workout-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          exercise_id: form.exercise_id,
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
            <div className="custom-select" ref={selectRef}>
              <button
                type="button"
                className={`custom-select-trigger ${selectedCategory ? `select-${selectedCategory}` : ''}`}
                onClick={() => setSelectOpen(prev => !prev)}
              >
                <span>{selectedExercise ? selectedExercise.name : 'Select an exercise'}</span>
                <span className={`custom-select-arrow ${selectOpen ? 'open' : ''}`} aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </button>
              {selectOpen && (
                <ul className="custom-select-list">
                  {exerciseOptions.map(exercise => {
                    const category = getExerciseCategory(exercise.name || '')
                    return (
                      <li
                        key={exercise.id}
                        className={`custom-select-option option-${category}${exercise.id === form.exercise_id ? ' selected' : ''}`}
                        onMouseDown={(event) => handleSelectExercise(event, exercise.id)}
                      >
                        {exercise.name}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </label>

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