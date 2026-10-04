/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAuth } from './authContext'

const WorkoutsContext = createContext(null)

export function WorkoutsProvider({ children }) {
  const { user, authFetch } = useAuth()

  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  // Bumps whenever a workout is logged or deleted, so pages that keep
  // their own fetches (like Progress) know when to refetch.
  const [version, setVersion] = useState(0)

  // authFetch gets a new identity whenever the session refreshes. Keeping
  // it in a ref means a token refresh doesn't trigger a pointless refetch.
  const authFetchRef = useRef(authFetch)
  useEffect(() => {
    authFetchRef.current = authFetch
  }, [authFetch])

  const refresh = useCallback(async () => {
    try {
      const res = await authFetchRef.current('/workout-sessions')
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load when a user logs in; clear everything when they log out
  const userId = user?.id
  useEffect(() => {
    if (userId) {
      setLoading(true)
      refresh()
    } else {
      setSessions([])
      setLoading(false)
    }
  }, [userId, refresh])

  // Save a workout, then refetch so Dashboard, History and Progress all update
  const addLog = useCallback(
    async ({ exercise_id, log_date, weight, reps, duration_seconds }) => {
      const res = await authFetchRef.current('/workout-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercise_id, log_date, weight, reps, duration_seconds }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Failed to save workout.')
      }
      await refresh()
      setVersion((v) => v + 1)
    },
    [refresh],
  )

  const deleteLog = useCallback(
    async (logId) => {
      const res = await authFetchRef.current(`/workout-logs/${logId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Failed to delete workout.')
      }
      await refresh()
      setVersion((v) => v + 1)
    },
    [refresh],
  )

  const value = useMemo(
    () => ({ sessions, loading, version, refresh, addLog, deleteLog }),
    [sessions, loading, version, refresh, addLog, deleteLog],
  )

  return <WorkoutsContext.Provider value={value}>{children}</WorkoutsContext.Provider>
}

export function useWorkouts() {
  const context = useContext(WorkoutsContext)
  if (!context) {
    throw new Error('useWorkouts must be used inside WorkoutsProvider')
  }
  return context
}