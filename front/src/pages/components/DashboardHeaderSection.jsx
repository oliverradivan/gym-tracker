const todayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export default function DashboardHeaderSection({ username }) {
  return (
    <header className="dash-header">
      <div className="dash-header-text">
        <h1 className="dash-greeting">Hi, {username}</h1>
        <p className="dash-date">Today · {todayFormatter.format(new Date())}</p>
      </div>
      <img
        className="dash-avatar"
        src="/logo_video.webp"
        alt="Workout tracker mascot"
      />
    </header>
  )
}
