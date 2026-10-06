/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAuth } from './authContext'

const WorkoutsContext = createContext(null)

export function WorkoutsProvider({ children }) {
  const { user, authFetch } = useAuth()

  const [sessions, setSessions] = useState([])
  const [sessionsLoadedFor, setSessionsLoadedFor] = useState(null)
  const [sessionsError, setSessionsError] = useState('')
  // Bumps whenever a workout is logged or deleted, so pages that keep
  // their own fetches (like Progress) know when to refetch.
  const [version, setVersion] = useState(0)
  const [exerciseVersion, setExerciseVersion] = useState(0)

  // authFetch gets a new identity whenever the session refreshes. Keeping
  // it in a ref means a token refresh doesn't trigger a pointless refetch.
  const authFetchRef = useRef(authFetch)
  const currentUserIdRef = useRef(user?.id)
  useEffect(() => {
    authFetchRef.current = authFetch
  }, [authFetch])

  const refresh = useCallback(async () => {
    const requestUserId = currentUserIdRef.current
    if (!requestUserId) return
    try {
      const res = await authFetchRef.current('/workout-sessions')
      if (!res.ok) throw new Error('Failed to load workout sessions.')
      const data = await res.json()
      if (currentUserIdRef.current !== requestUserId) return
      setSessionsError('')
      setSessions(data.sessions || [])
      setSessionsLoadedFor(requestUserId)
    } catch (err) {
      console.error(err)
      if (currentUserIdRef.current === requestUserId) {
        setSessionsError('Unable to load workout history.')
        setSessionsLoadedFor(requestUserId)
      }
    }
  }, [])

  const notifyExerciseChange = useCallback(() => {
    setExerciseVersion((current) => current + 1)
  }, [])

  // Load for each signed-in user and prevent late responses from crossing accounts.
  const userId = user?.id
  useEffect(() => {
    currentUserIdRef.current = userId
    if (userId) {
      refresh()
    } else {
      setSessionsLoadedFor(null)
    }
  }, [userId, refresh])

  const loading = Boolean(userId && sessionsLoadedFor !== userId)

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
    () => ({
      sessions: sessionsLoadedFor === userId ? sessions : [],
      loading,
      sessionsError,
      version,
      exerciseVersion,
      refresh,
      addLog,
      deleteLog,
      notifyExerciseChange,
    }),
    [
      sessions, sessionsLoadedFor, userId, loading, sessionsError, version, exerciseVersion, refresh,
      addLog, deleteLog, notifyExerciseChange,
    ],
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