import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import { useWorkouts } from '../context/WorkoutsContext'
import {
  EXERCISE_CATEGORIES,
  getExerciseCategory,
} from '../utils/exerciseCategory'
import { getValidCardioDuration } from '../lib/cardioDuration'
import { sortExercisesByCategory } from '../utils/exerciseSorting'
import { useClickOutside } from '../hooks/useClickOutside'
import LoadingSpinner from '@/components/LoadingSpinner'
import './logworkout.css'

// Minimum time the spinner stays visible, so a very fast save doesn't just flash.
const MIN_SPINNER_MS = 450

const getTodayKey = () => {
  const date = new Date()
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

const buildInitialForm = () => ({
  exercise_id: '',
  weight: '',
  reps: '',
  hours: '',
  minutes: '',
  seconds: '',
  date: getTodayKey(),
})

function LogWorkoutPage() {
  const [form, setForm] = useState(buildInitialForm)
  const [exerciseOptions, setExerciseOptions] = useState([])
  const [message, setMessage] = useState('')
  const [selectOpen, setSelectOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const dateInputRef = useRef(null)
  const selectRef = useRef(null)
  const navigate = useNavigate()
  const { session, authFetch, setMessage: setGlobalMessage } = useAuth()
  const { addLog, exerciseVersion } = useWorkouts()
  const authFetchRef = useRef(authFetch)

  useEffect(() => {
    authFetchRef.current = authFetch
  }, [authFetch])

  useClickOutside(selectRef, () => setSelectOpen(false))

  useEffect(() => {
    const loadExercises = async () => {
      if (!session?.access_token) return

      try {
        const response = await authFetchRef.current('/exercises', {
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
  }, [session, exerciseVersion])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const selectedExercise = exerciseOptions.find(opt => opt.id === form.exercise_id)
  const selectedCategory = getExerciseCategory(selectedExercise)

  const sortedExerciseOptions = useMemo(
    () => sortExercisesByCategory(exerciseOptions),
    [exerciseOptions]
  )

  const handleSelectExercise = (event, exerciseId) => {
    event.preventDefault()
    event.stopPropagation()
    setForm(prev => ({
      ...prev,
      exercise_id: exerciseId,
      ...(prev.exercise_id === exerciseId
        ? {}
        : {
          weight: '',
          reps: '',
          hours: '',
          minutes: '',
          seconds: '',
        }),
    }))
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

    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker()
      } catch {
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

    const durationSeconds = getValidCardioDuration(form)
    if (selectedCategory === EXERCISE_CATEGORIES.CARDIO && durationSeconds === null) {
      setMessage('Enter a duration greater than zero.')
      return
    }

    setMessage('')
    setIsSaving(true)
    const startedAt = Date.now()

    try {
      // Saves the workout and refreshes the shared store, so Dashboard,
      // History and Progress update straight away.
      const logPayload = {
        exercise_id: form.exercise_id,
        log_date: form.date,
      }
      if (selectedCategory === EXERCISE_CATEGORIES.CARDIO) {
        logPayload.duration_seconds = durationSeconds
      } else {
        logPayload.weight = Number(form.weight)
        logPayload.reps = Number(form.reps)
      }
      await addLog(logPayload)

      // Keep the spinner up for a minimum stretch so the swap back to the
      // button doesn't feel like a flicker on fast connections.
      const elapsed = Date.now() - startedAt
      const remaining = Math.max(MIN_SPINNER_MS - elapsed, 0)
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining))
      }

      setForm(buildInitialForm())
      setGlobalMessage('Workout saved successfully.')
      setMessage('Workout saved!')
      setIsSaving(false)
      setTimeout(() => setMessage(''), 2000)
    } catch (error) {
      setMessage(error.message || 'Something went wrong while saving your workout.')
      setIsSaving(false)
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
          <fieldset disabled={isSaving} className="logworkout-fieldset">
            <label>
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
                    {sortedExerciseOptions.map(exercise => {
                      const category = getExerciseCategory(exercise)
                      return (
                        <li
                          key={exercise.id}
                          className={`custom-select-option option-${category.toLowerCase()}${exercise.id === form.exercise_id ? ' selected' : ''}`}
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

            {selectedCategory === EXERCISE_CATEGORIES.CARDIO ? (
              <div className="duration-inputs">
                {[
                  { name: 'hours', label: 'Hours', min: 0 },
                  { name: 'minutes', label: 'Minutes', min: 0, max: 59 },
                  { name: 'seconds', label: 'Seconds', min: 0, max: 59 },
                ].map(({ name, label, min, max }) => (
                  <label key={name}>
                    <input
                      type="number"
                      name={name}
                      value={form[name]}
                      onChange={handleChange}
                      min={min}
                      max={max}
                      step="1"
                      inputMode="numeric"
                      placeholder="{label}"
                    />
                  </label>
                ))}
              </div>
            ) : (
              <>
                <label>
                  <input
                    type="number"
                    name="weight"
                    value={form.weight}
                    onChange={handleChange}
                    placeholder="Weight (kg/notches)"
                    min="0"
                    step="any"
                    required
                  />
                </label>

                <label>
                  <input
                    type="number"
                    name="reps"
                    value={form.reps}
                    onChange={handleChange}
                    placeholder="Reps"
                    min="0.5"
                    step="any"
                    required
                  />
                </label>
              </>
            )}

            <label>
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
              {/* Fixed-size wrapper so the button and spinner occupy the same
                  footprint and cross-fade in place instead of jumping the layout. */}
              <div className={`save-action${isSaving ? ' is-saving' : ''}`}>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={isSaving}
                  aria-hidden={isSaving}
                  tabIndex={isSaving ? -1 : undefined}
                >
                  Save workout
                </button>
                <div className="save-spinner" aria-hidden={!isSaving}>
                  <LoadingSpinner size={32} />
                </div>
              </div>
            </div>
          </fieldset>
        </form>
        {message && <p className="status-message">{message} <img className="proud" src="/proud.png" alt="proud" /></p>}
      </div>
    </div>
  )
}

export default LogWorkoutPage