import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import { useWorkouts } from '../context/WorkoutsContext'
import { getExerciseCategory } from '../utils/exerciseCategory'
import LoadingSpinner from '@/components/LoadingSpinner'
import './dashboard.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const initialForm = {
  exercise_name: '',
}

/* -------------------------------------------------------
   Formatting and date helpers
------------------------------------------------------- */

const todayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const weekdayLongFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
})

const weekdayNarrowFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'narrow',
})

const decimalFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
})

const wholeFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})

/* One decimal for small numbers, whole numbers once it reaches 1,000. */
function formatVolume(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) return '0'

  return (number >= 1000 ? wholeFormatter : decimalFormatter).format(number)
}

/* Local "YYYY-MM-DD" key, matching the dates returned by the API. */
function toLocalDateKey(date) {
  const offset = date.getTimezoneOffset() * 60000

  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

/*
 * First day of the week, as a JS weekday
 * (0 = Sunday ... 6 = Saturday)
 */
function getFirstWeekday() {
  return 0
}

/* -------------------------------------------------------
   Icons
------------------------------------------------------- */

function Icon({ children, className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

/*
 * Exercise category artwork. Each icon was traced on its own canvas, so it
 * carries its own viewBox and stroke width. Everything uses currentColor,
 * so the icons follow the tile's text color like the rest of the dashboard.
 *
 *   push    -> chest (front torso)
 *   pull    -> back
 *   leg     -> legs, front view (leg day)
 *   cardio -> legs, side view (running / cardio)
 */
const CATEGORY_ARTWORK = {
  push: {
    viewBox: '0 0 1179 1137',
    strokeWidth: 28,
    strokes: [
      'M468,32 C470,80 440,110 400,125 C330,150 270,190 215,228 C120,250 60,320 45,420 C40,470 35,490 30,520 C20,600 20,700 20,790',
      'M710,32 C708,80 738,110 778,125 C848,150 908,190 963,228 C1058,250 1118,320 1133,420 C1138,470 1143,490 1148,520 C1158,600 1158,700 1158,790',
      'M330,245 C410,245 490,270 545,297',
      'M850,245 C770,245 690,270 633,297',
      'M203,455 C215,540 240,590 262,640 C300,720 315,800 312,900 C310,1000 305,1060 300,1115',
      'M243,615 C245,700 225,760 203,795',
      'M975,455 C963,540 938,590 916,640 C878,720 863,800 866,900 C868,1000 873,1060 878,1115',
      'M935,615 C933,700 953,760 975,795',
      'M300,620 C380,655 480,640 555,598',
      'M880,620 C800,655 700,640 625,598',
      'M555,750 C535,790 500,815 468,822',
      'M628,750 C648,790 680,810 710,822',
    ],
    fills: [
      { cx: 360, cy: 584, rx: 30, ry: 16 },
      { cx: 818, cy: 584, rx: 30, ry: 16 },
      { cx: 590, cy: 1058, rx: 32, ry: 14 },
    ],
  },

  pull: {
    viewBox: '0 0 1179 1240',
    strokeWidth: 26,
    strokes: [
      'M470,135 C468,180 455,215 435,240',
      'M708,135 C710,180 722,215 745,240',
      'M495,268 C460,245 420,235 380,242 C320,255 290,310 240,358',
      'M683,268 C718,245 758,235 798,242 C858,255 888,310 938,358',
      'M225,315 C170,320 120,345 95,385',
      'M953,315 C1008,320 1058,345 1083,385',
      'M524,428 C530,520 500,620 392,685',
      'M654,428 C648,520 678,620 790,685',
      'M588,570 L588,910',
      'M588,1000 L588,1055',
      'M170,620 C165,680 185,720 195,740 C240,790 330,850 360,895',
      'M185,745 C160,785 125,810 98,822',
      'M1008,620 C1013,680 993,720 983,740 C938,790 848,850 818,895',
      'M993,745 C1018,785 1053,810 1080,822',
      'M525,868 C505,890 480,910 455,922',
      'M653,868 C675,890 700,910 722,922',
      'M295,895 L295,1060 C295,1100 315,1118 345,1118 L840,1118 C870,1118 880,1100 880,1060 L880,895',
    ],
    fills: [],
  },

  leg: {
    viewBox: '0 0 470 500',
    strokeWidth: 14,
    strokes: [
      'M170,78 Q232,90 295,78',
      'M205,92 L232,124 L262,92',
      'M170,78 C145,110 132,160 140,215 C143,240 150,255 150,290 C150,320 158,350 160,372 C140,376 122,380 118,386 C118,394 140,394 170,392 C195,392 200,385 198,372 C195,340 190,305 192,285 C195,260 210,235 218,200 C225,170 228,145 232,124',
      'M290,78 C315,110 328,160 320,215 C317,240 310,255 310,290 C310,320 302,350 300,372 C320,376 338,380 342,386 C342,394 320,394 290,392 C265,392 260,385 262,372 C265,340 270,305 268,285 C265,260 250,235 242,200 C235,170 232,145 232,124',
      'M196,130 C198,160 190,185 178,205',
      'M266,130 C264,160 272,185 284,205',
      'M172,268 C168,285 170,300 175,315',
      'M288,268 C292,285 290,300 286,315',
    ],
    fills: [],
  },

  cardio: {
    viewBox: '0 40 550 560',
    strokeWidth: 12,
    strokes: [
      'M258,74 L355,102 L350,130',
      'M258,74 C235,90 215,130 225,180 C235,215 270,230 310,225',
      'M318,132 C400,140 470,190 495,245 C502,270 485,300 465,305',
      'M336,196 C370,215 405,230 437,247',
      'M300,238 C340,255 400,262 435,266',
      'M225,190 C215,230 205,280 198,325 C160,340 135,365 125,410 C100,450 75,470 65,490 C62,505 85,520 150,545 C162,555 158,566 140,566 C125,562 112,552 105,540',
      'M310,228 C305,260 295,300 270,345 C230,385 185,430 160,480 C150,500 148,520 150,545',
      'M198,325 C215,332 240,330 262,335',
      'M123,410 C140,415 165,405 190,375 C185,355 165,345 150,360',
      'M435,266 C400,272 375,295 365,330 C380,340 405,335 425,318 C440,305 440,285 435,266',
      'M465,305 C430,340 380,365 340,385 C310,398 290,395 275,403 C268,415 285,445 300,470 C315,495 325,512 342,510 C355,505 352,490 345,470 C335,450 325,440 318,430',
    ],
    fills: [],
  },
}

function ExerciseCategoryIcon({ category, className }) {
  const artwork = CATEGORY_ARTWORK[category] || CATEGORY_ARTWORK.cardio

  return (
    <svg
      className={className}
      viewBox={artwork.viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={artwork.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {artwork.strokes.map((d) => (
        <path key={d} d={d} />
      ))}

      {artwork.fills.map((shape) => (
        <ellipse
          key={`${shape.cx}-${shape.cy}`}
          {...shape}
          fill="currentColor"
          stroke="none"
        />
      ))}
    </svg>
  )
}

function DashboardPage() {
  const [form, setForm] = useState(initialForm)
  const { user, session } = useAuth()

  /*
   * Workout sessions live in the shared store, so logging or deleting a
   * workout elsewhere updates this page without a reload. Only the exercise
   * library is still fetched here.
   */
  const { sessions: allSessions, loading: sessionsLoading } = useWorkouts()

  const [exercises, setExercises] = useState([])
  const [exerciseListInView, setExerciseListInView] = useState(false)
  const [exercisesLoading, setExercisesLoading] = useState(true)
  const exerciseListRef = useRef(null)

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
      const response = await fetch(`${API_URL}/exercises`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: form.exercise_name.trim(),
        }),
      })

      if (response.ok) {
        const data = await response.json()

        setExercises((prev) => [
          ...prev,
          data.exercise || data,
        ])

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
      `Remove "${exercise.name}"? This can't be undone.`
    )

    if (!confirmed) return

    setDeletingExerciseId(exercise.id)

    try {
      const response = await fetch(
        `${API_URL}/exercises/${exercise.id}`,
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
        const response = await fetch(`${API_URL}/exercises`, {
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

  useEffect(() => {
    const node = exerciseListRef.current

    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setExerciseListInView(true)
          observer.unobserve(entry.target)
        }
      },
      {
        threshold: 0.15,
      }
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [pageLoading])

  const sortedExercises = useMemo(() => {
    return [...exercises].sort((a, b) => {
      const catA = getExerciseCategory(a.name || '')
      const catB = getExerciseCategory(b.name || '')

      if (catA !== catB) {
        return catA.localeCompare(catB)
      }

      return (a.name || '').localeCompare(
        b.name || ''
      )
    })
  }, [exercises])

  /*
   * This week's summary, derived from the sessions the page already loads
   * (no extra request). The week starts on the user's locale first day.
   */
  const weekStats = useMemo(() => {
    const now = new Date()
    const todayKey = toLocalDateKey(now)
    const offset = (now.getDay() - getFirstWeekday() + 7) % 7
    const sessionsByDate = new Map(
      allSessions.map((sessionItem) => [sessionItem.date, sessionItem])
    )

    let trained = 0

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - offset + index
      )
      const key = toLocalDateKey(date)
      const match = sessionsByDate.get(key)

      if (match) trained += 1

      const categoryCounts = (match?.entries || []).reduce((counts, entry) => {
        const category = getExerciseCategory(entry.exercise_name || '')
        counts[category] = (counts[category] || 0) + 1
        return counts
      }, {})
      const category = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'cardio'

      return {
        key,
        short: weekdayNarrowFormatter.format(date),
        long: weekdayLongFormatter.format(date),
        trained: Boolean(match),
        category,
        isToday: key === todayKey,
      }
    })

    return { days, trained }
  }, [allSessions])

  return (
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

          {/* -------------------------------------------------
              Header
          ------------------------------------------------- */}

          <header className="dash-header">
            <div className="dash-header-text">
              <h1 className="dash-greeting">Hi, {username}</h1>

              <p className="dash-date">
                Today · {todayFormatter.format(new Date())}
              </p>
            </div>

            <img
              className="dash-avatar"
              src="/logo_video.webp"
              alt="Workout tracker mascot"
            />
          </header>


          {/* -------------------------------------------------
              Stats
          ------------------------------------------------- */}

          <section className="dash-stats" aria-label="Overview">

            <article className="dash-stat" data-tone="orange">
              <span className="dash-stat-icon">
                <Icon>
                  <path d="M5 20V10M12 20V4M19 20v-7" />
                </Icon>
              </span>

              <span className="dash-stat-label">Today</span>

              <strong className="dash-stat-value">
                {todaySession
                  ? formatVolume(todaySession.total_volume)
                  : '0'}
              </strong>

              <span className="dash-stat-unit">kg lifted</span>
            </article>

            <article className="dash-stat" data-tone="teal">
              <span className="dash-stat-icon">
                <Icon>
                  <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
                  <path d="M3.5 10h17M8 3v4M16 3v4" />
                </Icon>
              </span>

              <span className="dash-stat-label">Trained</span>

              <strong className="dash-stat-value">
                {totalDaysExercised}
              </strong>

              <span className="dash-stat-unit">days logged</span>
            </article>

            <article className="dash-stat" data-tone="indigo">
              <span className="dash-stat-icon">
                <Icon>
                  <path d="M9 6h11M9 12h11M9 18h11" />
                  <circle cx="4.5" cy="6" r="1" />
                  <circle cx="4.5" cy="12" r="1" />
                  <circle cx="4.5" cy="18" r="1" />
                </Icon>
              </span>

              <span className="dash-stat-label">Library</span>

              <strong className="dash-stat-value">
                {exercises.length}
              </strong>

              <span className="dash-stat-unit">exercises</span>
            </article>

          </section>


          {/* -------------------------------------------------
              This week
          ------------------------------------------------- */}

          <section aria-labelledby="dash-week-title">
            <div className="dash-section-head">
              <h2 id="dash-week-title" className="dash-section-title">
                This week
              </h2>
            </div>

            <div className="dash-week-cards">
              <article className="dash-card">
                <span className="dash-card-label">Days trained</span>

                <strong className="dash-card-value">
                  {weekStats.trained}
                  <small>/ 7</small>
                </strong>

                <ol
                  className="dash-week"
                  aria-label="Days trained this week"
                >
                  {weekStats.days.map((day) => (
                    <li
                      key={day.key}
                      className="dash-week-day"
                      data-trained={day.trained}
                      data-category={day.category}
                      data-today={day.isToday}
                    >
                      <span className="dash-week-dot" aria-hidden="true" />

                      <span className="dash-week-label" aria-hidden="true">
                        {day.short}
                      </span>

                      <span className="dash-sr-only">
                        {day.long}: {day.trained ? `${day.category} workout` : 'no workout'}
                      </span>
                    </li>
                  ))}
                </ol>
              </article>


            </div>
          </section>


          {/* -------------------------------------------------
              Exercise library
          ------------------------------------------------- */}

          <section
            className={`dash-exercises${
              exerciseListInView ? ' in-view' : ''
            }`}
            ref={exerciseListRef}
            aria-labelledby="dash-library-title"
          >
            <div className="dash-section-head">
              <h2 id="dash-library-title" className="dash-section-title">
                Your exercises
              </h2>

              <span className="dash-count">{exercises.length}</span>
            </div>

            {sortedExercises.length ? (
              <div className="dash-rows dash-rows-grid">
                {sortedExercises.map((exercise, index) => (
                  <div
                    key={exercise.id}
                    className={`dash-row dash-row-compact activity-row exercise-card ${
                      exercise.unit === 'km'
                        ? 'exercise-card--run'
                        : 'exercise-card--general'
                    }`}
                    data-category={getExerciseCategory(
                      exercise.name || ''
                    )}
                    style={{
                      '--reveal-delay': `${Math.min(index, 10) * 0.04}s`,
                    }}
                  >
                    <span className="dash-row-tile" aria-hidden="true">
                      <ExerciseCategoryIcon category={getExerciseCategory(exercise.name || '')} />
                    </span>

                    <Link
                      to={`/progress/${exercise.id}`}
                      className="dash-row-title dash-row-link"
                    >
                      {exercise.name}
                    </Link>

                    {exercise.created_by === user?.id && (
                      <button
                        type="button"
                        className="dash-remove-btn"
                        onClick={(e) =>
                          handleDeleteExercise(e, exercise)
                        }
                        disabled={deletingExerciseId === exercise.id}
                        aria-label={`Remove ${exercise.name}`}
                        title="Remove exercise"
                      >
                        <Icon>
                          <circle cx="12" cy="12" r="10" />
                          <path d="M14.5 9.5l-5 5M9.5 9.5l5 5" />
                        </Icon>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="dash-empty-note">
                No exercises yet. Create one below.
              </p>
            )}
          </section>


          {/* -------------------------------------------------
              Create exercise
          ------------------------------------------------- */}

          <section
            className="dash-card dash-create"
            aria-labelledby="dash-create-title"
          >
            <div>
              <h2 id="dash-create-title" className="dash-section-title">
                Add an exercise
              </h2>

              <p className="dash-create-copy">
                Can't find what you're looking for? Add it to your
                exercise library.
              </p>
            </div>

            <form
              onSubmit={handleCreateExercise}
              className="dash-create-form"
            >
              <div className="dash-field">
                <label htmlFor="exercise_name">
                  Exercise name
                </label>

                <input
                  id="exercise_name"
                  type="text"
                  name="exercise_name"
                  value={form.exercise_name}
                  onChange={handleChange}
                  placeholder="e.g. Incline Bench Press"
                  required
                />
              </div>

              <button type="submit" className="dash-btn">
                Add Exercise
              </button>
            </form>
          </section>

        </main>
      )}
    </div>
  )
}

export default DashboardPage