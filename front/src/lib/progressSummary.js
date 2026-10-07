export function getBestTimePoint(progress, isCardio) {
  if (!isCardio) return null

  return (progress || []).reduce((best, point, index) => {
    const duration = Number(point.duration_seconds)
    if (!Number.isFinite(duration) || duration <= 0) return best
    if (!best || duration < best.duration) return { duration, index }
    return best
  }, null)
}
