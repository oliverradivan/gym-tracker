import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const authFetch = vi.fn(async (path) => {
  if (path === '/exercises') {
    return {
      ok: true,
      json: async () => ({
        exercises: [{ id: 'bench', name: 'Bench Press', category: 'Push' }],
      }),
    }
  }
  if (path.startsWith('/workout-logs/progress')) {
    return {
      ok: true,
      json: async () => ({
        progress: [{ date: '2025-01-01', volume: 100, weight: 100, reps: 5 }],
      }),
    }
  }
  throw new Error(`Unexpected request: ${path}`)
})
const session = { access_token: 'test-token' }

vi.mock('../context/authContext', () => ({
  useAuth: () => ({
    user: { user_metadata: { username: 'tester' } },
    session,
    authFetch,
    setUser: vi.fn(),
    handleLogout: vi.fn(),
  }),
}))

vi.mock('../context/WorkoutsContext', () => ({
  useWorkouts: () => ({
    sessions: [],
    loading: false,
    version: 0,
    exerciseVersion: 0,
  }),
}))

vi.mock('../context/themeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}))

vi.mock('./components/ProgressChartPanel', () => ({
  default: ({ graphScrollable }) => (
    <div
      data-testid="progress-chart-panel"
      data-scrollable={String(graphScrollable)}
    />
  ),
}))

vi.mock('./components/ProgressHistoryTable', () => ({
  default: () => null,
}))

import ProgressPage from './progress'
import SettingsPage from './settings'

afterEach(() => {
  cleanup()
  localStorage.clear()
  authFetch.mockClear()
})

describe('progress and settings preference synchronization', () => {
  it('updates the progress graph when the setting changes in Settings', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation((media) => ({
        matches: false,
        media,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })

    render(
      <MemoryRouter initialEntries={['/progress/bench']}>
        <Routes>
          <Route path="/progress/:exerciseId" element={<ProgressPage />} />
        </Routes>
        <SettingsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(
        screen.getByTestId('progress-chart-panel').getAttribute('data-scrollable')
      ).toBe('false')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Forecasting' }))
    fireEvent.click(screen.getByRole('button', { name: 'Toggle scrollable graph' }))

    await waitFor(() => {
      expect(
        screen.getByTestId('progress-chart-panel').getAttribute('data-scrollable')
      ).toBe('true')
    })
  })
})
