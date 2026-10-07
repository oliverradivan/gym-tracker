import { useMemo } from 'react'
import {
  buildCalendarDays,
  buildWeekStats,
} from '../lib/dashboardCalendar'

export function useDashboardCalendar(sessions, daysBeforeWeek) {
  const weekStats = useMemo(
    () => buildWeekStats(sessions, new Date(), daysBeforeWeek),
    [sessions, daysBeforeWeek]
  )
  const calendarDays = useMemo(
    () => buildCalendarDays(sessions, weekStats.todayKey),
    [sessions, weekStats.todayKey]
  )
  const calendarTrained = calendarDays.filter(
    (day) => day?.trained && day.key <= weekStats.todayKey
  ).length

  return { weekStats, calendarDays, calendarTrained }
}
