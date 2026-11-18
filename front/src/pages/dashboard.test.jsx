import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  notifyExerciseChange: vi.fn(),
}))

vi.mock('../context/authContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', user_metadata: { username: 'tester' } },
    session: { access_token: 'test-token' },
    authFetch: mocks.authFetch,
  }),
}))

vi.mock('../context/WorkoutsContext', () => ({
  useWorkouts: () => ({
    sessions: [],
    loading: false,
    notifyExerciseChange: mocks.notifyExerciseChange,
  }),
}))

import DashboardPage from './dashboard'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  mocks.authFetch.mockReset()
  mocks.notifyExerciseChange.mockReset()
})

describe('dashboard exercise creation', () => {
  it('keeps the category selector neutral until a category is picked', async () => {
    mocks.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ exercises: [] }),
    })

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    const categoryButton = await screen.findByRole('button', { name: 'Category' })
    expect(categoryButton.className).toBe('custom-select-trigger')

    fireEvent.click(categoryButton)
    fireEvent.mouseDown(screen.getByText('Pull'))

    expect(categoryButton.className).toBe('custom-select-trigger select-pull')
  })

  it('alerts when the exercise already exists', async () => {
    mocks.authFetch.mockImplementation(async (_path, options) => {
      if (options?.method === 'POST') {
        return {
          ok: false,
          status: 409,
          json: async () => ({
            detail: 'An exercise with this name already exists.',
          }),
        }
      }

      return {
        ok: true,
        json: async () => ({ exercises: [] }),
      }
    })
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    const nameInput = await screen.findByPlaceholderText('Exercise name')
    fireEvent.change(nameInput, { target: { value: 'Bench Press' } })
    fireEvent.submit(nameInput.closest('form'))

    await waitFor(() => {
      expect(alert).toHaveBeenCalledWith('exercise already exists')
    })
    expect(mocks.notifyExerciseChange).not.toHaveBeenCalled()
  })
})
