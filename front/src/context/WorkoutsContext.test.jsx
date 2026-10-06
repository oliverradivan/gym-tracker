import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './authContext'
import { WorkoutsProvider, useWorkouts } from './WorkoutsContext'

const AUTH_STORAGE_KEY = 'workout-tracker-auth'
const user = { id: 'user-1', user_metadata: { username: 'tester' } }

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function wrapper({ children }) {
  return (
    <AuthProvider>
      <WorkoutsProvider>{children}</WorkoutsProvider>
    </AuthProvider>
  )
}

function useAppContexts() {
  return { auth: useAuth(), workouts: useWorkouts() }
}

function ExerciseListMutator({ updateLibrary }) {
  const { notifyExerciseChange } = useWorkouts()
  const update = (exercises) => {
    updateLibrary(exercises)
    notifyExerciseChange()
  }
  return (
    <>
      <button onClick={() => update([
        { id: 'custom-1', name: 'Custom exercise', category: 'Pull', exercise_category: 'Pull' },
      ])}>
        Add exercise
      </button>
      <button onClick={() => update([])}>Delete exercise</button>
    </>
  )
}

function ExerciseListSubscriber() {
  const { exerciseVersion } = useWorkouts()
  const [exercises, setExercises] = useState([])
  useEffect(() => {
    let current = true
    fetch('/api/exercises')
      .then((response) => response.json())
      .then((data) => {
        if (current) setExercises(data.exercises || [])
      })
    return () => { current = false }
  }, [exerciseVersion])
  return <ul>{exercises.map((exercise) => <li key={exercise.id}>{exercise.name}</li>)}</ul>
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('shared workout data', () => {
  it('loads History data on the first render after login', async () => {
    const session = {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    }
    const sessions = [{ date: '2026-10-06', total_volume: 400, entries: [] }]
    const fetchMock = vi.fn(async (url) => {
      const path = new URL(url, window.location.origin).pathname
      if (path === '/api/auth/login') return jsonResponse({ user, session })
      if (path === '/api/workout-sessions') return jsonResponse({ sessions })
      if (path === '/api/exercises') return jsonResponse({ exercises: [] })
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(useAppContexts, { wrapper })
    await act(async () => {
      await result.current.auth.handleAuth(
        { username: 'tester', password: 'password' },
        'login',
      )
    })

    expect(fetchMock.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
      '/api/auth/login',
      '/api/workout-sessions',
    ])
    await waitFor(() => expect(result.current.workouts.sessions).toEqual(sessions))
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(`Bearer ${session.access_token}`)
  })

  it('updates subscribed exercise lists after add and delete', async () => {
    const session = {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    }
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, session }))
    let library = []
    const fetchMock = vi.fn(async (url) => {
      const path = new URL(url, window.location.origin).pathname
      if (path === '/api/workout-sessions') return jsonResponse({ sessions: [] })
      if (path === '/api/exercises') return jsonResponse({ exercises: library })
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <AuthProvider>
        <WorkoutsProvider>
          <ExerciseListSubscriber />
          <ExerciseListMutator updateLibrary={(items) => { library = items }} />
        </WorkoutsProvider>
      </AuthProvider>,
    )

    await waitFor(() => expect(fetchMock.mock.calls.some(
      ([url]) => new URL(url, window.location.origin).pathname === '/api/exercises',
    )).toBe(true))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add exercise' })))
    expect(await screen.findByText('Custom exercise')).toBeTruthy()

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Delete exercise' })))
    await waitFor(() => expect(screen.queryByText('Custom exercise')).toBeNull())
  })
})
