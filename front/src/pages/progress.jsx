import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import { useWorkouts } from '../context/WorkoutsContext'
import { getBestTimePoint } from '../lib/progressSummary'
import {
  EXERCISE_CATEGORIES,
  getExerciseCategory,
  getExerciseCategoryColor,
} from '../utils/exerciseCategory'
import { sortExercisesByCategory } from '../utils/exerciseSorting'
import { useClickOutside } from '../hooks/useClickOutside'
import LoadingSpinner from '@/components/LoadingSpinner'
import ProgressChartPanel from './components/ProgressChartPanel'
import ProgressHistoryTable from './components/ProgressHistoryTable'

import './progress.css'

const PREDICTION_SETTING_KEY = 'workout-tracker-predictions-enabled'
const GRAPH_SCROLL_SETTING_KEY = 'workout-tracker-graph-scroll-enabled'
const FLIP_CARDIO_Y_AXIS = false

const METRICS = { volume: { label: 'Volume' }, weight: { label: 'Weight' }, reps: { label: 'Reps' } }

const formatDisplayDate = (date) => {
  const [year, month, day] = String(date || '').slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : String(date || '')
}

function ProgressPage() {
  const { session, authFetch } = useAuth()
  // `version` bumps whenever a workout is logged or deleted anywhere in the app.
  const { version, exerciseVersion } = useWorkouts()
  const { exerciseId } = useParams()
  const { pathname } = useLocation()

  const [exercises, setExercises] = useState([])
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [progress, setProgress] = useState([])
  const [selectedMetric, setSelectedMetric] = useState('volume')
  const [loading, setLoading] = useState(true)
  const [predictions, setPredictions] = useState([])
  const [isPredicting, setIsPredicting] = useState(false)
  const [predictionError, setPredictionError] = useState('')
  const [isMobile, setIsMobile] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia('(max-width: 640px)').matches))
  const [selectOpen, setSelectOpen] = useState(false)
  const selectRef = useRef(null)
  const chartScrollRef = useRef(null)
  // Remembers which exercise's progress is on screen, so a background refetch
  // (after logging a workout) updates the chart without a spinner flash.
  const loadedExerciseRef = useRef('')
  const [chartScrollPosition, setChartScrollPosition] = useState(0)
  const [chartScrollMax, setChartScrollMax] = useState(0)

  useClickOutside(selectRef, () => setSelectOpen(false))

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 640px)')
    const handler = (event) => setIsMobile(event.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  const [predictionEnabled, setPredictionEnabled] = useState(() => {
    try { return localStorage.getItem(PREDICTION_SETTING_KEY) !== 'false' } catch { return true }
  })

  const [graphScrollable, setGraphScrollable] = useState(() => {
    try {
      const savedPreference = localStorage.getItem(GRAPH_SCROLL_SETTING_KEY)
      return savedPreference === null ? true : savedPreference === 'true'
    } catch { return true }
  })

  // Re-read settings whenever this page is shown.
  useEffect(() => {
    const syncSettings = () => {
      try {
        setPredictionEnabled(localStorage.getItem(PREDICTION_SETTING_KEY) !== 'false')
        const savedScroll = localStorage.getItem(GRAPH_SCROLL_SETTING_KEY)
        setGraphScrollable(savedScroll === null ? true : savedScroll === 'true')
      } catch {
        // Storage can be unavailable in restricted browser contexts.
      }
    }
    syncSettings()
    window.addEventListener('storage', syncSettings)
    return () => window.removeEventListener('storage', syncSettings)
  }, [pathname])

  // Load exercises.
  useEffect(() => {
    let cancelled = false
    const loadExercises = async () => {
      if (!session) return
      try {
        setLoading(true)
        const response = await authFetch('/exercises')
        if (!response.ok) throw new Error('Unable to load exercises.')
        const result = await response.json()
        const items = result.exercises || []
        if (cancelled) return
        setExercises(items)
        const urlExercise = items.find((item) => String(item.id) === exerciseId)
        if (urlExercise) {
          setSelectedExerciseId(urlExercise.id)
        } else {
          setSelectedExerciseId('')
          setProgress([])
          setPredictions([])
        }
      } catch (error) {
        console.error(error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadExercises()
    return () => { cancelled = true }
  }, [exerciseId, session, authFetch, exerciseVersion])

  // Load progress for the selected exercise.
  useEffect(() => {
    let cancelled = false
    const loadProgress = async () => {
      if (!session || !selectedExerciseId) {
        loadedExerciseRef.current = ''
        setProgress([])
        setLoading(false)
        return
      }
      try {
        // Only show the spinner when switching to a different exercise.
        if (loadedExerciseRef.current !== selectedExerciseId) setLoading(true)
        const response = await authFetch(`/workout-logs/progress?exercise_id=${selectedExerciseId}`)
        if (!response.ok) throw new Error('Unable to load progress.')
        const result = await response.json()
        if (!cancelled) {
          loadedExerciseRef.current = selectedExerciseId
          setProgress(result.progress || [])
        }
      } catch (error) {
        console.error(error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadProgress()
    return () => { cancelled = true }
  }, [selectedExerciseId, session, authFetch, version])

  const selectedExercise = exercises.find((exercise) => exercise.id === selectedExerciseId)
  const category = getExerciseCategory(selectedExercise)
  const chartStroke = getExerciseCategoryColor(category)

  // Load predictions.
  useEffect(() => {
    let mounted = true
    const loadPredictions = async () => {
      if (category === EXERCISE_CATEGORIES.CARDIO || !predictionEnabled || !selectedExerciseId || progress.length < 2) {
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
        const response = await authFetch('/predictions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exercise_id: selectedExerciseId,
            points: progress.map((point) => ({ date: point.date, volume: point.volume })),
            periods: 5,
            interval_days: 7,
          }),
        })
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.detail || 'Failed to generate predictions.')
        }
        const result = await response.json()
        if (mounted) setPredictions(result.predictions || [])
      } catch (error) {
        console.error(error)
        if (mounted) setPredictionError(error.message || 'Failed to generate predictions.')
      } finally {
        if (mounted) setIsPredicting(false)
      }
    }
    loadPredictions()
    return () => { mounted = false }
  }, [category, predictionEnabled, selectedExerciseId, progress, session, authFetch])

  // Sort dropdown options by category.
  const sortedExercises = useMemo(
    () => sortExercisesByCategory(exercises),
    [exercises]
  )

  const handleSelectExercise = (event, exerciseId) => {
    event.preventDefault()
    event.stopPropagation()
    setSelectedExerciseId(exerciseId)
    setSelectOpen(false)
  }

  const chartMetric = category === EXERCISE_CATEGORIES.CARDIO ? 'duration_seconds' : selectedMetric
  const metricLabel = category === EXERCISE_CATEGORIES.CARDIO ? 'Time' : METRICS[chartMetric]?.label || 'Unknown'
  const showForecast = category !== EXERCISE_CATEGORIES.CARDIO && chartMetric === 'volume' && predictionEnabled && predictions.length > 0

  const bestTimePoint = useMemo(
    () => getBestTimePoint(progress, category === EXERCISE_CATEGORIES.CARDIO),
    [category, progress]
  )

  const chartData = useMemo(() => {
    return progress.map((point) => {
      const rawValue = category === EXERCISE_CATEGORIES.CARDIO
        ? Number(point.duration_seconds || 0)
        : Number(point[chartMetric] || 0)
      return {
        date: point.date ? new Date(`${point.date}T00:00:00Z`) : null,
        actualValue: category === EXERCISE_CATEGORIES.CARDIO && FLIP_CARDIO_Y_AXIS ? -rawValue : rawValue,
      }
    })
  }, [progress, chartMetric, category])

  const bestTimeChartPoint = bestTimePoint ? chartData[bestTimePoint.index] : null

  const forecastData = useMemo(() => {
    if (!showForecast || predictions.length === 0) return []
    const lastActual = chartData.at(-1)
    if (!lastActual) return []
    return [
      { date: lastActual.date, value: lastActual.actualValue },
      ...predictions.map((point) => ({
        date: point.date ? new Date(`${point.date}T00:00:00Z`) : null,
        value: Number(point.value || 0),
      })),
    ]
  }, [showForecast, predictions, chartData])

  useEffect(() => {
    const node = chartScrollRef.current
    if (!node || !isMobile || !graphScrollable) {
      setChartScrollPosition(0)
      setChartScrollMax(0)
      return
    }
    const syncScrollState = () => {
      const maxScroll = Math.max(0, node.scrollWidth - node.clientWidth)
      setChartScrollMax(maxScroll)
      setChartScrollPosition(Math.min(node.scrollLeft, maxScroll))
    }
    const handleScroll = () => setChartScrollPosition(node.scrollLeft)
    node.addEventListener('scroll', handleScroll, { passive: true })
    let resizeObserver = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(syncScrollState)
      resizeObserver.observe(node)
      if (node.firstElementChild) resizeObserver.observe(node.firstElementChild)
    }
    syncScrollState()
    const frame = requestAnimationFrame(syncScrollState)
    return () => {
      node.removeEventListener('scroll', handleScroll)
      if (resizeObserver) resizeObserver.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [isMobile, graphScrollable, progress.length, chartMetric, predictions.length, showForecast])

  const handleChartSliderChange = (event) => {
    const value = Number(event.target.value)
    if (chartScrollRef.current) chartScrollRef.current.scrollLeft = value
    setChartScrollPosition(value)
  }

  return (
      <div className={`progress-page ${category.toLowerCase()}`}>
      <div className={`progress-card ${category.toLowerCase()}`}>
        <div className="progress-header">
          <div>
            <p className="eyebrow">Workout Tracker</p>
            <h1>{selectedExercise ? 'Progress' : 'Pick a workout'}</h1>
          </div>
        </div>

        <label className="exercise-select-label">
          Exercise
          <div className="custom-select" ref={selectRef}>
            <button
              type="button"
              className={`custom-select-trigger ${category ? `select-${category.toLowerCase()}` : ''}`}
              onClick={() => setSelectOpen((prev) => !prev)}
            >
              <span>{selectedExercise ? selectedExercise.name : 'Pick a workout'}</span>
              <span className={`custom-select-arrow ${selectOpen ? 'open' : ''}`} aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>
            {selectOpen && (
              <ul className="custom-select-list">
                {sortedExercises.map((exercise) => {
                  const optionCategory = getExerciseCategory(exercise)
                  return (
                    <li
                      key={exercise.id}
                      className={`custom-select-option option-${optionCategory.toLowerCase()}${exercise.id === selectedExerciseId ? ' selected' : ''}`}
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

        {loading ? (
          <LoadingSpinner label="Loading workouts..." showLabel />
        ) : !selectedExercise ? (
          <p className="status-message">Choose a workout above to view your progress.</p>
        ) : progress.length === 0 ? (
          <p className="status-message">No progress data yet for {selectedExercise.name}.</p>
        ) : (
          <>
            {category !== EXERCISE_CATEGORIES.CARDIO && (
              <div className="metric-toggle" role="group" aria-label="Chart metric">
                {Object.entries(METRICS).map(([value, details]) => (
                  <button
                    key={value}
                    type="button"
                    className={selectedMetric === value ? 'active' : ''}
                    aria-pressed={selectedMetric === value}
                    aria-label={selectedMetric === value ? `Selected: ${details.label} metric` : `Select ${details.label} metric`}
                    onClick={() => setSelectedMetric(value)}
                  >
                    {details.label}
                  </button>
                ))}
              </div>
            )}

            <ProgressChartPanel
              bestTimeChartPoint={bestTimeChartPoint}
              bestTimePoint={bestTimePoint}
              category={category}
              chartData={chartData}
              chartMetric={chartMetric}
              chartScrollMax={chartScrollMax}
              chartScrollPosition={chartScrollPosition}
              chartScrollRef={chartScrollRef}
              chartStroke={chartStroke}
              forecastData={forecastData}
              graphScrollable={graphScrollable}
              handleChartSliderChange={handleChartSliderChange}
              isMobile={isMobile}
              isPredicting={isPredicting}
              metricLabel={metricLabel}
              predictionError={predictionError}
              predictions={predictions}
              progressLength={progress.length}
              showForecast={showForecast}
            />

            <ProgressHistoryTable
              category={category}
              formatDisplayDate={formatDisplayDate}
              progress={progress}
            />
          </>
        )}
      </div>
    </div>
  )
}

export default ProgressPage