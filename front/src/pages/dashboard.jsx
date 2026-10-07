import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/authContext'
import { useWorkouts } from '../context/WorkoutsContext'
import { toLocalDateKey } from '../lib/dashboardCalendar'
import { EXERCISE_CATEGORIES } from '../utils/exerciseCategory'
import { sortExercisesByCategory } from '../utils/exerciseSorting'
import { useDashboardCalendar } from '../hooks/useDashboardCalendar'
import { useDashboardWeekScroll } from '../hooks/useDashboardWeekScroll'
import DashboardCalendarSection from './components/DashboardCalendarSection'
import DashboardExerciseSection from './components/DashboardExerciseSection'
import DashboardHeaderSection from './components/DashboardHeaderSection'
import DashboardOverviewSection from './components/DashboardOverviewSection'
import LoadingSpinner from '@/components/LoadingSpinner'
import './dashboard.css'
import AuroraBackground from '../components/AuroraBackground'

const initialForm = {
  exercise_name: '',
  category: EXERCISE_CATEGORIES.OTHER,
}

function DashboardPage() {
  const [form, setForm] = useState(initialForm)
  const [daysBeforeWeek, setDaysBeforeWeek] = useState(28)
  const [calendarExpanded, setCalendarExpanded] = useState(false)
  const { user, session, authFetch } = useAuth()
  const authFetchRef = useRef(authFetch)

  useEffect(() => {
    authFetchRef.current = authFetch
  }, [authFetch])

  /*
   * Workout sessions live in the shared store, so logging or deleting a
   * workout elsewhere updates this page without a reload. Only the exercise
   * library is still fetched here.
   */
  const {
    sessions: allSessions,
    loading: sessionsLoading,
    notifyExerciseChange,
  } = useWorkouts()
  const [exercises, setExercises] = useState([])
  const [exercisesLoading, setExercisesLoading] = useState(true)

  const pageLoading = exercisesLoading || sessionsLoading

  const username =
    user?.user_metadata?.username ||
    user?.user_metadata?.full_name ||
    'Athlete'

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleCreateExercise = async (e) => {
    e.preventDefault()

    if (!form.exercise_name.trim() || !session?.access_token) return

    try {
      const response = await authFetchRef.current('/exercises', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: form.exercise_name.trim(),
          category: form.category,
        }),
      })

      if (response.ok) {
        const data = await response.json()

        setExercises((prev) => [
          ...prev,
          data.exercise || data,
        ])
        notifyExerciseChange()

        setForm(initialForm)
      }
    } catch (err) {
      console.error('Failed to create exercise:', err)
    }
  }

  const [deletingExerciseId, setDeletingExerciseId] = useState(null)

  const handleDeleteExercise = async (e, exercise) => {
    e.preventDefault()
    e.stopPropagation()

    if (!session?.access_token || deletingExerciseId) return

    const confirmed = window.confirm(
      `Remove "${exercise.name}"? Its workout logs will also be permanently deleted. This can't be undone.`
    )

    if (!confirmed) return

    setDeletingExerciseId(exercise.id)

    try {
      const response = await authFetch(
        `/exercises/${exercise.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      )

      if (response.ok) {
        setExercises((prev) =>
          prev.filter((item) => item.id !== exercise.id)
        )
        notifyExerciseChange()
      } else {
        const data = await response.json().catch(() => null)

        window.alert(
          data?.detail || 'Failed to remove exercise.'
        )
      }
    } catch (err) {
      console.error('Failed to delete exercise:', err)
      window.alert('Failed to remove exercise.')
    } finally {
      setDeletingExerciseId(null)
    }
  }

  useEffect(() => {
    const loadExercises = async () => {
      if (!session?.access_token) {
        setExercisesLoading(false)
        return
      }

      try {
        const response = await authFetch('/exercises', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        if (response.ok) {
          const result = await response.json()
          setExercises(result.exercises || [])
        }
      } catch {
        // Exercise load error handled silently
      } finally {
        setExercisesLoading(false)
      }
    }

    loadExercises()
  }, [session])

  /*
   * Today's session and the total number of training days, derived from the
   * shared sessions. They recompute whenever a workout is logged or deleted.
   */
  const todaySession = useMemo(() => {
    const todayKey = toLocalDateKey(new Date())

    return (
      allSessions.find((sessionItem) => sessionItem.date === todayKey) || null
    )
  }, [allSessions])

  const totalDaysExercised = useMemo(
    () => new Set(allSessions.map((sessionItem) => sessionItem.date)).size,
    [allSessions]
  )

  const sortedExercises = useMemo(
    () => sortExercisesByCategory(exercises),
    [exercises]
  )

  /*
   * This week's summary, derived from the sessions the page already loads
   * (no extra request). The week starts on Sunday.
   */
  const { weekStats, calendarDays, calendarTrained } = useDashboardCalendar(
    allSessions,
    daysBeforeWeek
  )
  const { weekScrollRef, loadEarlierDays } = useDashboardWeekScroll(
    weekStats,
    calendarExpanded,
    setDaysBeforeWeek
  )

  return (
   <AuroraBackground>
    <div className="dash-page">
      {pageLoading ? (
        <div className="dash-loading">
          <LoadingSpinner
            size={64}
            label="Loading your dashboard..."
            showLabel
          />
        </div>
      ) : (
        <main className="dash-shell">

          <DashboardHeaderSection username={username} />

          <DashboardOverviewSection
            todaySession={todaySession}
            totalDaysExercised={totalDaysExercised}
            exerciseCount={exercises.length}
          />


          <DashboardCalendarSection
            calendarDays={calendarDays}
            calendarExpanded={calendarExpanded}
            calendarTrained={calendarTrained}
            loadEarlierDays={loadEarlierDays}
            setCalendarExpanded={setCalendarExpanded}
            weekScrollRef={weekScrollRef}
            weekStats={weekStats}
          />


          <DashboardExerciseSection
            exercises={exercises}
            sortedExercises={sortedExercises}
            user={user}
            handleDeleteExercise={handleDeleteExercise}
            deletingExerciseId={deletingExerciseId}
            form={form}
            handleChange={handleChange}
            handleCreateExercise={handleCreateExercise}
          />

        </main>
      )}
    </div>
   </AuroraBackground>
  )
}

export default DashboardPage