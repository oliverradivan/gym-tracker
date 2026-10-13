import { useMemo } from 'react'
import { formatDuration } from '../../utils/duration'
import { EXERCISE_CATEGORIES } from '../../utils/exerciseCategory'

export default function ProgressSummary({ progress, category }) {
  const isCardio = category === EXERCISE_CATEGORIES.CARDIO

  const stats = useMemo(() => {
    const key = isCardio ? 'duration_seconds' : 'volume'
    const sorted = [...progress].sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    )
    const values = sorted.map((p) => Number(p[key]) || 0).filter((v) => v > 0)
    if (values.length === 0) return null

    const first = values[0]
    const last = values[values.length - 1]
    const best = isCardio ? Math.min(...values) : Math.max(...values)
    const change = ((last - first) / first) * 100
    // For cardio a lower time is better.
    const improved = isCardio ? change < 0 : change > 0
    const worse = isCardio ? change > 0 : change < 0

    return { best, change, improved, worse, sessions: sorted.length }
  }, [progress, isCardio])

  if (!stats) return null

  const rounded = Math.round(stats.change)
  const changeClass = rounded === 0
    ? ''
    : stats.improved
      ? 'delta--up'
      : stats.worse
        ? 'delta--down'
        : ''

  return (
    <dl className="progress-summary">
      <div>
        <dt>Personal best</dt>
        <dd>{isCardio ? formatDuration(stats.best) : stats.best.toFixed(1)}</dd>
      </div>
      <div>
        <dt>Since first session</dt>
        <dd className={changeClass}>
          {rounded === 0 ? '–' : `${rounded > 0 ? '▲ +' : '▼ '}${rounded}%`}
        </dd>
      </div>
      <div>
        <dt>Sessions</dt>
        <dd>{stats.sessions}</dd>
      </div>
    </dl>
  )
}