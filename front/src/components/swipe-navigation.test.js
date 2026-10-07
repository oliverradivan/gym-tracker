import { describe, expect, it, vi } from 'vitest'
import { navigateForSwipe } from './swipe-navigation'

describe('navigateForSwipe', () => {
  it('uses the same distance threshold and direction to change pages', () => {
    const goToIndex = vi.fn()

    expect(
      navigateForSwipe({
        deltaX: -401,
        containerWidth: 1000,
        currentIndex: 2,
        goToIndex,
        velocity: 0.1,
      })
    ).toBe(true)
    expect(goToIndex).toHaveBeenCalledWith(3)

    navigateForSwipe({
      deltaX: 401,
      containerWidth: 1000,
      currentIndex: 2,
      goToIndex,
      velocity: 0.1,
    })
    expect(goToIndex).toHaveBeenLastCalledWith(1)
  })

  it('requires both distance and velocity for touch flicks', () => {
    const goToIndex = vi.fn()

    expect(
      navigateForSwipe({
        deltaX: -200,
        containerWidth: 1000,
        currentIndex: 1,
        goToIndex,
        velocity: 0.5,
      })
    ).toBe(false)
    expect(goToIndex).not.toHaveBeenCalled()

    expect(
      navigateForSwipe({
        deltaX: -200,
        containerWidth: 1000,
        currentIndex: 1,
        goToIndex,
        velocity: 0.6,
      })
    ).toBe(true)
    expect(goToIndex).toHaveBeenCalledWith(2)
  })

  it('uses the shorter distance-only flick for trackpad navigation', () => {
    const goToIndex = vi.fn()

    expect(
      navigateForSwipe({
        deltaX: -151,
        containerWidth: 1000,
        currentIndex: 1,
        goToIndex,
      })
    ).toBe(true)
    expect(goToIndex).toHaveBeenCalledWith(2)
  })
})
