import { toSeconds } from '../utils/duration'

export function getValidCardioDuration(form) {
  const values = ['hours', 'minutes', 'seconds'].map((key) => {
    const rawValue = form[key] ?? 0
    const value = Number(rawValue)
    return { key, value, valid: Number.isInteger(value) && value >= 0 }
  })
  const minuteOrSecondInvalid = values.some(
    ({ key, value }) =>
      (key === 'minutes' || key === 'seconds') && value > 59
  )
  if (values.some((item) => !item.valid) || minuteOrSecondInvalid) return null

  const durationSeconds = toSeconds(form)
  return durationSeconds > 0 ? durationSeconds : null
}
