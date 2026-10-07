import { describe, expect, it } from 'vitest'
import { getValidCardioDuration } from './cardioDuration'

describe('getValidCardioDuration', () => {
  it('converts a positive valid duration to seconds', () => {
    expect(
      getValidCardioDuration({ hours: '1', minutes: '2', seconds: '3' })
    ).toBe(3723)
  })

  it.each([
    [{ hours: '', minutes: '', seconds: '' }],
    [{ hours: '0', minutes: '0', seconds: '0' }],
    [{ hours: '-1', minutes: '0', seconds: '0' }],
    [{ hours: '0', minutes: '60', seconds: '0' }],
    [{ hours: '0', minutes: '0', seconds: '60' }],
    [{ hours: '0', minutes: 'abc', seconds: '5' }],
    [{ hours: '0.5', minutes: '0', seconds: '0' }],
  ])('rejects zero or invalid components: %j', (form) => {
    expect(getValidCardioDuration(form)).toBeNull()
  })
})
