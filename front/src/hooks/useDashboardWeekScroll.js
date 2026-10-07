import { useLayoutEffect, useRef } from 'react'

export function useDashboardWeekScroll(
  weekStats,
  calendarExpanded,
  setDaysBeforeWeek
) {
  const weekScrollRef = useRef(null)
  const positionedWeekRef = useRef(false)
  const loadingEarlierRef = useRef(false)
  const pendingScrollWidthRef = useRef(null)

  useLayoutEffect(() => {
    if (calendarExpanded) {
      positionedWeekRef.current = false
      return
    }

    const container = weekScrollRef.current
    if (!container) return

    if (pendingScrollWidthRef.current !== null) {
      container.scrollLeft +=
        container.scrollWidth - pendingScrollWidthRef.current
      pendingScrollWidthRef.current = null
      loadingEarlierRef.current = false
      return
    }

    if (!positionedWeekRef.current) {
      container.scrollLeft = container.scrollWidth
      positionedWeekRef.current = true
    }
  }, [calendarExpanded, weekStats.days])

  const loadEarlierDays = () => {
    const container = weekScrollRef.current
    if (
      !container ||
      loadingEarlierRef.current ||
      (weekStats.earliestKey &&
        weekStats.days[0]?.key <= weekStats.earliestKey)
    ) {
      return
    }

    loadingEarlierRef.current = true
    pendingScrollWidthRef.current = container.scrollWidth
    setDaysBeforeWeek((days) => days + 28)
  }

  return { weekScrollRef, loadEarlierDays }
}
