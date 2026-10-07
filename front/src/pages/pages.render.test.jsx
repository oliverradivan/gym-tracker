import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../context/authContext', () => ({
  useAuth: (() => {
    const auth = {
    user: { user_metadata: { username: 'tester' } },
    session: null,
    authFetch: vi.fn(),
    setUser: vi.fn(),
    setMessage: vi.fn(),
    handleAuth: vi.fn(),
    handleLogout: vi.fn(),
    loading: false,
    message: '',
    }
    return () => auth
  })(),
}))

vi.mock('../context/WorkoutsContext', () => ({
  useWorkouts: (() => {
    const workouts = {
    sessions: [],
    loading: false,
    sessionsError: '',
    version: 0,
    exerciseVersion: 0,
    notifyExerciseChange: vi.fn(),
    deleteLog: vi.fn(),
    addLog: vi.fn(),
    }
    return () => workouts
  })(),
}))

vi.mock('../context/themeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}))

vi.mock('./components/ProgressChartPanel', () => ({
  default: () => <div data-testid="progress-chart-panel" />,
}))
vi.mock('./components/ProgressHistoryTable', () => ({
  default: () => <div data-testid="progress-history-table" />,
}))

import NotFoundPage from './404'
import DashboardPage from './dashboard'
import HistoryPage from './history'
import LoginPage from './login'
import LogWorkoutPage from './logworkout'
import ProgressPage from './progress'
import RegisterPage from './register'
import SettingsPage from './settings'
import DashboardCalendarSection from './components/DashboardCalendarSection'
import ProgressHistoryTable from './components/ProgressHistoryTable'

afterEach(() => {
  cleanup()
})

function renderPage(page) {
  return render(<MemoryRouter>{page}</MemoryRouter>)
}

const cases = [
  ['not-found page', () => <NotFoundPage />],
  ['dashboard page', () => <DashboardPage />],
  ['history page', () => <HistoryPage />],
  ['login page', () => <LoginPage />],
  ['log workout page', () => <LogWorkoutPage />],
  ['progress page', () => <ProgressPage />],
  ['register page', () => <RegisterPage />],
  ['settings page', () => <SettingsPage />],
  [
    'dashboard calendar section',
    () => (
      <DashboardCalendarSection
        calendarDays={[]}
        calendarExpanded={false}
        calendarTrained={0}
        loadEarlierDays={vi.fn()}
        setCalendarExpanded={vi.fn()}
        weekScrollRef={{ current: null }}
        weekStats={{ days: [], todayKey: '2025-01-01', trained: 0 }}
      />
    ),
  ],
  [
    'progress history table',
    () => (
      <ProgressHistoryTable
        category="Push"
        formatDisplayDate={(value) => value}
        progress={[]}
      />
    ),
  ],
]

describe('page render smoke tests', () => {
  it.each(cases)('renders the %s', (_name, createPage) => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation((media) => ({
        matches: false,
        media,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    const { container } = renderPage(createPage())

    expect(container.firstChild).not.toBeNull()
  })
})
