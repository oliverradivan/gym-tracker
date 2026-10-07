import DashboardIcon from './DashboardIcon'

const decimalFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
})
const wholeFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})

function formatVolume(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'
  return (number >= 1000 ? wholeFormatter : decimalFormatter).format(number)
}

export default function DashboardOverviewSection({
  todaySession,
  totalDaysExercised,
  exerciseCount,
}) {
  return (
    <section className="dash-stats" aria-label="Overview">
      <article className="dash-stat" data-tone="orange">
        <span className="dash-stat-icon">
          <DashboardIcon>
            <path d="M5 20V10M12 20V4M19 20v-7" />
          </DashboardIcon>
        </span>
        <span className="dash-stat-label">Today</span>
        <strong className="dash-stat-value">
          {todaySession ? formatVolume(todaySession.total_volume) : '0'}
        </strong>
        <span className="dash-stat-unit">kg lifted</span>
      </article>

      <article className="dash-stat" data-tone="teal">
        <span className="dash-stat-icon">
          <DashboardIcon>
            <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
            <path d="M3.5 10h17M8 3v4M16 3v4" />
          </DashboardIcon>
        </span>
        <span className="dash-stat-label">Trained</span>
        <strong className="dash-stat-value">{totalDaysExercised}</strong>
        <span className="dash-stat-unit">days logged</span>
      </article>

      <article className="dash-stat" data-tone="indigo">
        <span className="dash-stat-icon">
          <DashboardIcon>
            <path d="M9 6h11M9 12h11M9 18h11" />
            <circle cx="4.5" cy="6" r="1" />
            <circle cx="4.5" cy="12" r="1" />
            <circle cx="4.5" cy="18" r="1" />
          </DashboardIcon>
        </span>
        <span className="dash-stat-label">Library</span>
        <strong className="dash-stat-value">{exerciseCount}</strong>
        <span className="dash-stat-unit">exercises</span>
      </article>
    </section>
  )
}
