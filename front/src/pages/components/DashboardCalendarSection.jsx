import { Link } from 'react-router-dom'
import { EXERCISE_CATEGORIES } from '../../utils/exerciseCategory'

export default function DashboardCalendarSection({
  calendarDays,
  calendarExpanded,
  calendarTrained,
  loadEarlierDays,
  setCalendarExpanded,
  weekScrollRef,
  weekStats,
}) {
  return (
    <section aria-labelledby="dash-week-title">
      <div className="dash-section-head">
        <h2 id="dash-week-title" className="dash-section-title">
          This week
        </h2>
        <button
          type="button"
          className="dash-calendar-toggle"
          aria-expanded={calendarExpanded}
          aria-controls="dash-week-view"
          onClick={() => setCalendarExpanded((expanded) => !expanded)}
        >
          {calendarExpanded ? 'Collapse calendar' : 'Expand calendar'}
          <svg
            viewBox="0 0 20 20"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d={calendarExpanded ? 'm5 12 5-5 5 5' : 'm5 8 5 5 5-5'} />
          </svg>
        </button>
      </div>

      <div className="dash-week-cards">
        <article className="dash-card">
          <span className="dash-card-label">
            {calendarExpanded ? 'Days trained in the past 30 days' : 'Days trained'}
          </span>

          <strong className="dash-card-value dash-week-value">
            {calendarExpanded ? calendarTrained : weekStats.trained}
            <small className="dash-week-count">/{calendarExpanded ? 30 : 7}</small>
          </strong>

          <div id="dash-week-view">
            {calendarExpanded ? (
              <div
                className="dash-calendar-scroll"
                data-swipe-ignore
                role="region"
                tabIndex={0}
                aria-label="Past 30 days of workouts"
              >
                <div className="dash-calendar">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                    (weekday) => (
                      <span className="dash-calendar-weekday" key={weekday}>
                        <span className="dash-calendar-weekday-full" aria-hidden="true">
                          {weekday}
                        </span>
                        <span className="dash-calendar-weekday-short" aria-hidden="true">
                          {weekday.slice(0, 1)}
                        </span>
                        <span className="dash-sr-only">{weekday}</span>
                      </span>
                    )
                  )}
                  {calendarDays.map((day, index) => (
                    <div className="dash-calendar-cell" key={day?.key || `blank-${index}`}>
                      {day &&
                        (day.clickable ? (
                          <Link
                            to={`/history?date=${day.key}`}
                            className="dash-calendar-day"
                            data-swipe-ignore
                            data-trained={day.trained}
                            data-category={day.category}
                            data-today={day.isToday}
                            data-outside-month={day.isOutsideMonth}
                            data-future={day.key > weekStats.todayKey}
                            aria-label={`${day.short} ${day.dayNumber}: workout`}
                          >
                            <span className="dash-calendar-date">
                              {day.key.slice(8, 10)}/{day.key.slice(5, 7)}
                            </span>
                            <span className="dash-calendar-dots" aria-hidden="true">
                              <span className="dash-calendar-dot" data-category={day.category} />
                            </span>
                          </Link>
                        ) : (
                          <span
                            className="dash-calendar-day"
                            data-disabled="true"
                            data-trained={day.trained}
                            data-category={day.category}
                            data-today={day.isToday}
                            data-outside-month={day.isOutsideMonth}
                            data-future={day.key > weekStats.todayKey}
                            aria-disabled="true"
                            aria-label={`${day.short} ${day.dayNumber}: no workout`}
                          >
                            <span className="dash-calendar-date">
                              {day.key.slice(8, 10)}/{day.key.slice(5, 7)}
                            </span>
                            <span className="dash-calendar-dots" aria-hidden="true">
                              <span className="dash-calendar-dot" data-category={day.category} />
                            </span>
                          </span>
                        ))}
                    </div>
                  ))}
                </div>
                <ul className="dash-calendar-legend" aria-label="Workout category legend">
                  {[
                    [EXERCISE_CATEGORIES.PUSH, 'Push'],
                    [EXERCISE_CATEGORIES.PULL, 'Pull'],
                    [EXERCISE_CATEGORIES.LEG, 'Legs'],
                    [EXERCISE_CATEGORIES.CARDIO, 'Cardio'],
                    [EXERCISE_CATEGORIES.OTHER, 'Other'],
                  ].map(([category, label]) => (
                    <li key={category}>
                      <span
                        className="dash-calendar-legend-dot"
                        data-category={category}
                        aria-hidden="true"
                      />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div
                className="dash-week-scroll"
                ref={weekScrollRef}
                data-swipe-ignore
                role="region"
                onScroll={() => {
                  if (weekScrollRef.current?.scrollLeft < 70) {
                    loadEarlierDays()
                  }
                }}
                aria-label="Workout days"
              >
                <ol className="dash-week" aria-label="Workout days">
                  {weekStats.days.map((day) => (
                    <li key={day.key}>
                      {day.clickable ? (
                        <Link
                          to={`/history?date=${day.key}`}
                          className="dash-week-day"
                          data-trained={day.trained}
                          data-category={day.category}
                          data-today={day.isToday}
                          data-future={day.key > weekStats.todayKey}
                          aria-label={`${day.short} ${day.dayNumber}: workout`}
                        >
                          <span className="dash-week-date dash-week-date-full" aria-hidden="true">
                            {day.short} {day.dayNumber}
                          </span>
                          <span className="dash-week-date dash-week-date-compact" aria-hidden="true">
                            {day.short.slice(0, 1)} {day.dayNumber}
                          </span>
                          <span className="dash-week-dot" aria-hidden="true" />
                        </Link>
                      ) : (
                        <span
                          className="dash-week-day"
                          data-disabled="true"
                          data-trained={day.trained}
                          data-category={day.category}
                          data-today={day.isToday}
                          data-future={day.key > weekStats.todayKey}
                          aria-disabled="true"
                        >
                          <span className="dash-week-date dash-week-date-full" aria-hidden="true">
                            {day.short} {day.dayNumber}
                          </span>
                          <span className="dash-week-date dash-week-date-compact" aria-hidden="true">
                            {day.short.slice(0, 1)} {day.dayNumber}
                          </span>
                          <span className="dash-week-dot" aria-hidden="true" />
                          <span className="dash-sr-only">
                            {day.long}: {day.trained ? `${day.category} workout` : 'no workout'}
                          </span>
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  )
}
