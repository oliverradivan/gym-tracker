import { describe, expect, it } from 'vitest'
import { buildCalendarDays, buildWeekStats } from './dashboardCalendar'

describe('buildWeekStats', () => {
  it('uses Sunday week boundaries across a year change', () => {
    const stats = buildWeekStats(
      [
        { date: '2024-12-29', entries: [{ exercise_category: 'Pull' }] },
        { date: '2025-01-04', entries: [{ exercise_category: 'Push' }] },
        { date: '2025-01-05', entries: [{ exercise_category: 'Leg' }] },
      ],
      new Date(2024, 11, 31, 12),
      0
    )

    expect(stats.days.map((day) => day.key)).toEqual([
      '2024-12-29',
      '2024-12-30',
      '2024-12-31',
      '2025-01-01',
      '2025-01-02',
      '2025-01-03',
      '2025-01-04',
    ])
    expect(stats.trained).toBe(1)
    expect(stats.days[0].category).toBe('Pull')
    expect(stats.days[6].clickable).toBe(false)
  })

  it('returns a full empty week when there is no session data', () => {
    const stats = buildWeekStats([], new Date(2024, 0, 3, 12), 0)

    expect(stats.days).toHaveLength(7)
    expect(stats.trained).toBe(0)
    expect(stats.earliestKey).toBeNull()
  })
})

describe('buildCalendarDays', () => {
  it('covers 30 days across a month and year rollover', () => {
    const days = buildCalendarDays([], '2025-01-05')
    const populated = days.filter(Boolean)

    expect(populated).toHaveLength(30)
    expect(populated[0].key).toBe('2024-12-07')
    expect(populated.at(-1).key).toBe('2025-01-05')
    expect(populated[0].isOutsideMonth).toBe(true)
    expect(populated.at(-1).isToday).toBe(true)
  })

  it('handles empty sessions and rejects an invalid date key', () => {
    expect(buildCalendarDays([], 'not-a-date')).toEqual([])
    expect(buildCalendarDays([], '2024-02-29').filter(Boolean)).toHaveLength(30)
  })
})
