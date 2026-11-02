import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../context/WorkoutsContext', () => ({
  useWorkouts: () => ({
    sessions: [],
    loading: true,
    sessionsError: '',
    deleteLog: vi.fn(),
  }),
}))

import HistoryPage from './history'

afterEach(() => {
  cleanup()
})

describe('history loading skeleton', () => {
  it('renders session-shaped placeholders while history loads', () => {
    const { container } = render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>
    )

    expect(
      screen.getByRole('status', { name: 'Loading your history' })
    ).toBeTruthy()
    expect(container.querySelectorAll('.history-skeleton-session')).toHaveLength(3)
    expect(container.querySelectorAll('.history-skeleton-entry-main')).toHaveLength(7)
  })
})
