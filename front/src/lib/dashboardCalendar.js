import {
  EXERCISE_CATEGORIES,
  getExerciseCategory,
} from '../utils/exerciseCategory'

const weekdayLongFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
})
const weekdayShortFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
})

export function toLocalDateKey(date) {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

export function dateFromKey(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null

  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return toLocalDateKey(date) === key ? date : null
}

export function addDays(date, count) {
  const result = new Date(date)
  result.setDate(result.getDate() + count)
  return result
}

function daysBetween(start, end) {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.round((endUtc - startUtc) / 86400000)
}

function categoryForSession(session) {
  const counts = (session?.entries || []).reduce((result, entry) => {
    const category = getExerciseCategory(entry)
    result[category] = (result[category] || 0) + 1
    return result
  }, {})
  return (
    Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] ||
    EXERCISE_CATEGORIES.OTHER
  )
}

export function buildWeekStats(sessions = [], now = new Date(), daysBeforeWeek = 28) {
  const sessionRows = sessions || []
  const todayKey = toLocalDateKey(now)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = addDays(today, -today.getDay())
  const weekEnd = addDays(weekStart, 6)
  const earliestSession = sessionRows
    .map((session) => session.date)
    .filter((key) => dateFromKey(key) && key <= todayKey)
    .sort()[0]
  const earliestDate = earliestSession ? dateFromKey(earliestSession) : null
  const startDate = addDays(weekStart, -daysBeforeWeek)

  if (earliestDate && startDate > earliestDate) {
    startDate.setTime(earliestDate.getTime())
  }

  const sessionsByDate = new Map(sessionRows.map((session) => [session.date, session]))
  const weekStartKey = toLocalDateKey(weekStart)
  const days = Array.from(
    { length: daysBetween(startDate, weekEnd) + 1 },
    (_, index) => {
      const date = addDays(startDate, index)
      const key = toLocalDateKey(date)
      const session = sessionsByDate.get(key)
      return {
        key,
        short: weekdayShortFormatter.format(date),
        dayNumber: date.getDate(),
        long: weekdayLongFormatter.format(date),
        trained: Boolean(session),
        clickable: Boolean(session) && key <= todayKey,
        category: categoryForSession(session),
        isToday: key === todayKey,
      }
    }
  )

  return {
    days,
    trained: days.filter(
      (day) =>
        day.trained &&
        day.key >= weekStartKey &&
        day.key <= todayKey
    ).length,
    todayKey,
    earliestKey: earliestSession || null,
  }
}

export function buildCalendarDays(sessions = [], todayKey) {
  const today = dateFromKey(todayKey)
  if (!today) return []

  const sessionRows = sessions || []
  const firstDay = addDays(today, -29)
  const leadingDays = firstDay.getDay()
  const cellCount = Math.ceil((leadingDays + 30) / 7) * 7
  const sessionsByDate = new Map(sessionRows.map((session) => [session.date, session]))

  return Array.from({ length: cellCount }, (_, index) => {
    if (index < leadingDays || index >= leadingDays + 30) return null

    const date = addDays(firstDay, index - leadingDays)
    const key = toLocalDateKey(date)
    const session = sessionsByDate.get(key)
    const categoryCounts = (session?.entries || []).reduce((counts, entry) => {
      const category = getExerciseCategory(entry)
      counts[category] = (counts[category] || 0) + 1
      return counts
    }, {})

    return {
      key,
      dayNumber: date.getDate(),
      short: weekdayShortFormatter.format(date),
      trained: Boolean(session),
      clickable: Boolean(session) && key <= todayKey,
      category: categoryForSession(session),
      isToday: key === todayKey,
      isOutsideMonth: date.getMonth() !== today.getMonth(),
      workouts: session?.entries || [],
      activities: Object.keys(categoryCounts).slice(0, 3),
    }
  })
}
