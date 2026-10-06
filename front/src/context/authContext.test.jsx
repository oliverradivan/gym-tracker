import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './authContext'

const AUTH_STORAGE_KEY = 'workout-tracker-auth'
const user = { id: 'user-1', user_metadata: { username: 'tester' } }

function seedSession() {
  const session = {
    access_token: 'expired-access-token',
    refresh_token: 'refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, session }))
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('authFetch session recovery', () => {
  it('refreshes and retries a request once after an expired-token response', async () => {
    seedSession()
    const refreshedSession = {
      access_token: 'fresh-access-token',
      refresh_token: 'new-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ user, session: refreshedSession }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    let response
    await act(async () => {
      response = await result.current.authFetch('/private')
    })

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer expired-access-token')
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer fresh-access-token')
  })

  it('logs the user out when the refresh attempt fails', async () => {
    seedSession()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    await act(async () => {
      await expect(result.current.authFetch('/private')).rejects.toThrow(
        'Session expired. Please log in again.'
      )
    })

    await waitFor(() => {
      expect(result.current.user).toBeNull()
      expect(result.current.session).toBeNull()
    })
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
