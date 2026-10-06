import { formatDuration } from '../../utils/duration'
import { EXERCISE_CATEGORIES } from '../../utils/exerciseCategory'

export default function ProgressHistoryTable({
  category,
  formatDisplayDate,
  progress,
}) {
  return (
    <table className="progress-table">
      <thead>
        {category === EXERCISE_CATEGORIES.CARDIO ? (
          <tr><th>Date</th><th>Time</th></tr>
        ) : (
          <tr>
            <th>Date</th>
            <th>Weight</th>
            <th>Reps</th>
            <th>Volume</th>
          </tr>
        )}
      </thead>
      <tbody>
        {[...progress]
          .sort((a, b) => String(b.date).localeCompare(String(a.date)))
          .map((point, index) => (
            <tr key={`${point.date}-${index}`}>
              <td>{formatDisplayDate(point.date)}</td>
              {category === EXERCISE_CATEGORIES.CARDIO ? (
                <td>{formatDuration(point.duration_seconds)}</td>
              ) : (
                <>
                  <td>{Number(point.weight || 0).toFixed(1)}</td>
                  <td>{(Number(point.reps) || 0) % 1 === 0 ? Number(point.reps) || 0 : (Number(point.reps) || 0).toFixed(1)}</td>
                  <td>{Number(point.volume || 0).toFixed(1)}</td>
                </>
              )}
            </tr>
          ))}
      </tbody>
    </table>
  )
}
