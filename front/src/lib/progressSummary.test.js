import { describe, expect, it } from 'vitest'
import { getBestTimePoint } from './progressSummary'

describe('getBestTimePoint', () => {
  it('returns no best point for non-cardio or empty history', () => {
    expect(getBestTimePoint([{ duration_seconds: 30 }], false)).toBeNull()
    expect(getBestTimePoint([], true)).toBeNull()
  })

  it('ignores zero and invalid durations and selects the shortest positive time', () => {
    expect(
      getBestTimePoint(
        [
          { duration_seconds: 0 },
          { duration_seconds: 'invalid' },
          { duration_seconds: 42 },
          { duration_seconds: 30 },
        ],
        true
      )
    ).toEqual({ duration: 30, index: 3 })
  })
})
