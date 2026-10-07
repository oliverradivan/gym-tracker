const PASS_RATIO = 0.4
const FLICK_MIN_VELOCITY = 0.55
const FLICK_MIN_DISTANCE_RATIO = 0.15

export function navigateForSwipe({
  deltaX,
  containerWidth,
  currentIndex,
  goToIndex,
  velocity,
}) {
  const passedThreshold = Math.abs(deltaX) > containerWidth * PASS_RATIO
  const passedFlickThreshold =
    Math.abs(deltaX) > containerWidth * FLICK_MIN_DISTANCE_RATIO &&
    (velocity == null || velocity > FLICK_MIN_VELOCITY)

  if (!passedThreshold && !passedFlickThreshold) {
    return false
  }

  if (deltaX < 0) {
    goToIndex(currentIndex + 1)
  } else if (deltaX > 0) {
    goToIndex(currentIndex - 1)
  } else {
    return false
  }

  return true
}
