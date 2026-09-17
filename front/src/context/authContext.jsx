/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState, useEffect, useRef } from 'react'

const AuthContext = createContext(null)
const API_URL = import.meta.env.VITE_API_URL || '/api'
const AUTH_STORAGE_KEY = 'workout-tracker-auth'
// Refresh a bit before actual expiry so an in-flight request never lands
// on a token that expires mid-request.
const REFRESH_BUFFER_MS = 60 * 1000

// Supabase sessions carry `expires_at` (unix seconds) once issued; fall
// back to `expires_in` (seconds from now) just in case a caller only has that.
function getSessionExpiryMs(session) {
  if (!session) return 0
  if (session.expires_at) return session.expires_at * 1000
  if (session.expires_in) return Date.now() + session.expires_in * 1000
  return 0
}

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY)
      return saved ? JSON.parse(saved).user || null : null
    } catch {
      return null
    }
  })
  const [session, setSession] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY)
      return saved ? JSON.parse(saved).session || null : null
    } catch {
      return null
    }
  })

  // Mirrors state into a ref so async helpers (authFetch, refreshSession)
  // always read the latest session without needing to be re-created on
  // every login/refresh.
  const sessionRef = useRef(session)
  useEffect(() => {
    sessionRef.current = session
  }, [session])

  // Coalesces concurrent refresh attempts (e.g. two components fetching
  // at once right as the token expires) into a single network call.
  const refreshInFlightRef = useRef(null)

  useEffect(() => {
    if (user || session) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, session }))
      return
    }

    localStorage.removeItem(AUTH_STORAGE_KEY)
  }, [user, session])

  const handleAuth = async (form, mode) => {
    setLoading(true)
    setMessage('')

    try {
      const endpoint = mode || (form.email ? 'register' : 'login')
      const payload = {
        username: form.username?.trim(),
        email: form.email?.trim(),
        password: form.password,
      }

      const response = await fetch(`${API_URL}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const rawText = await response.text()
      let result = {}

      if (rawText) {
        try {
          result = JSON.parse(rawText)
        } catch {
          result = { detail: rawText }
        }
      }

      if (!response.ok) {
        throw new Error(result.detail || result.message || 'Authentication failed.')
      }

      if (endpoint === 'register') {
        setMessage(`Account created for @${result.username}. You can now log in.`)
        return { success: true }
      }

      setUser(result.user)
      setSession(result.session)
      setMessage('Logged in successfully.')
      return { success: true }
    } catch (error) {
      setMessage(error.message || 'Something went wrong. Please try again.')
      return { success: false }
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    setUser(null)
    setSession(null)
    localStorage.removeItem(AUTH_STORAGE_KEY)
    setMessage('')
  }

  // Exchanges the refresh_token for a new session via the backend.
  // Concurrent callers share one in-flight request instead of firing
  // several refreshes at once.
  const refreshSession = () => {
    const currentSession = sessionRef.current

    if (!currentSession?.refresh_token) {
      handleLogout()
      return Promise.resolve(null)
    }

    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current
    }

    const doRefresh = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: currentSession.refresh_token }),
        })

        if (!response.ok) {
          throw new Error('Session refresh failed.')
        }

        const result = await response.json()
        setUser(result.user)
        setSession(result.session)
        sessionRef.current = result.session
        return result.session
      } catch (error) {
        console.error(error)
        handleLogout()
        return null
      } finally {
        refreshInFlightRef.current = null
      }
    }

    refreshInFlightRef.current = doRefresh()
    return refreshInFlightRef.current
  }

  // Returns a definitely-valid access token, refreshing first if the
  // current one is at or past REFRESH_BUFFER_MS from expiring.
  const getAccessToken = async () => {
    const currentSession = sessionRef.current
    if (!currentSession) return null

    const expiresAtMs = getSessionExpiryMs(currentSession)
    const isExpiringSoon = expiresAtMs > 0 && expiresAtMs - Date.now() <= REFRESH_BUFFER_MS

    if (!isExpiringSoon) {
      return currentSession.access_token
    }

    const refreshed = await refreshSession()
    return refreshed?.access_token ?? null
  }

  // Authenticated fetch: attaches a valid token, and if the backend still
  // returns 401 (e.g. token revoked, clock drift), refreshes once and
  // retries before giving up.
  const authFetch = async (path, options = {}) => {
    const token = await getAccessToken()
    if (!token) {
      throw new Error('Not authenticated.')
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    })

    if (response.status !== 401) {
      return response
    }

    const refreshed = await refreshSession()
    if (!refreshed) {
      throw new Error('Session expired. Please log in again.')
    }

    return fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${refreshed.access_token}`,
      },
    })
  }

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      message,
      setMessage,
      setUser,
      setSession,
      handleAuth,
      handleLogout,
      authFetch,
      getAccessToken,
      refreshSession,
    }),
    [user, session, loading, message],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}