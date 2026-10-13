import { useMemo } from 'react'
import { formatDuration } from '../../utils/duration'
import { EXERCISE_CATEGORIES } from '../../utils/exerciseCategory'

export default function ProgressHistoryTable({
  category,
  formatDisplayDate,
  progress,
}) {
  const isCardio = category === EXERCISE_CATEGORIES.CARDIO

  // Newest first. Each row knows its change vs the previous session and
  // whether it is the personal best (highest volume, or fastest time).
  const rows = useMemo(() => {
    const key = isCardio ? 'duration_seconds' : 'volume'
    const ascending = [...progress].sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    )
    const values = ascending.map((p) => Number(p[key]) || 0)
    const positives = values.filter((v) => v > 0)
    const best = positives.length
      ? isCardio
        ? Math.min(...positives)
        : Math.max(...positives)
      : null

    return ascending
      .map((point, i) => {
        const delta = i === 0 ? null : values[i] - values[i - 1]
        const improved =
          delta === null || delta === 0 ? null : isCardio ? delta < 0 : delta > 0
        return {
          point,
          delta,
          improved,
          isBest: best !== null && values[i] === best,
        }
      })
      .reverse()
  }, [progress, isCardio])

  const renderDelta = (delta, improved) => {
    if (delta === null || delta === 0) {
      return <span className="delta delta--flat">–</span>
    }
    const text = isCardio
      ? formatDuration(Math.abs(delta))
      : Math.abs(delta).toFixed(1)
    return (
      <span className={`delta ${improved ? 'delta--up' : 'delta--down'}`}>
        <span className="delta-arrow" aria-hidden="true">
          {delta > 0 ? '▲' : '▼'}
        </span>
        {text}
        <span className="progress-sr-only">
          {improved ? ' improvement' : ' decline'} vs previous session
        </span>
      </span>
    )
  }

  return (
    <table className="progress-table">
      <caption className="progress-sr-only">Workout history, newest first</caption>
      <thead>
        {isCardio ? (
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Time</th>
            <th scope="col">vs last</th>
          </tr>
        ) : (
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Weight</th>
            <th scope="col">Reps</th>
            <th scope="col">Volume</th>
            <th scope="col">vs last</th>
          </tr>
        )}
      </thead>
      <tbody>
        {rows.map(({ point, delta, improved, isBest }, index) => {
          const reps = Number(point.reps) || 0
          return (
            <tr
              key={`${point.date}-${index}`}
              className={isBest ? 'is-best' : undefined}
            >
              <td>
                {formatDisplayDate(point.date)}
                {isBest && <span className="pr-badge">PR</span>}
              </td>
              {isCardio ? (
                <td>{formatDuration(point.duration_seconds)}</td>
              ) : (
                <>
                  <td>{Number(point.weight || 0).toFixed(1)}</td>
                  <td>{reps % 1 === 0 ? reps : reps.toFixed(1)}</td>
                  <td>{Number(point.volume || 0).toFixed(1)}</td>
                </>
              )}
              <td>{renderDelta(delta, improved)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}