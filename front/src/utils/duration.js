export function splitDuration(totalSeconds) {
  const secondsValue = Number(totalSeconds)
  const safeSeconds = Number.isFinite(secondsValue)
    ? Math.max(0, Math.floor(secondsValue))
    : 0

  return {
    hours: Math.floor(safeSeconds / 3600),
    minutes: Math.floor((safeSeconds % 3600) / 60),
    seconds: safeSeconds % 60,
  }
}

export function toSeconds({ hours = 0, minutes = 0, seconds = 0 }) {
  const numberOrZero = (value) => {
    const number = Number(value)
    return Number.isFinite(number) ? number : 0
  }

  return (
    numberOrZero(hours) * 3600 +
    numberOrZero(minutes) * 60 +
    numberOrZero(seconds)
  )
}

export function formatDuration(totalSeconds) {
  const { hours, minutes, seconds } = splitDuration(totalSeconds)
  const pad = (value) => String(value).padStart(2, '0')

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`
}
