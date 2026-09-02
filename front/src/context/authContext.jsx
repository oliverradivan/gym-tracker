import { createContext, useContext, useMemo, useState } from 'react'

const AuthContext = createContext(null)
const API_URL = import.meta.env.VITE_API_URL || '/api'

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)

  const handleAuth = async (form) => {
    setLoading(true)
    setMessage('')

    try {
      const payload = {
        username: form.username.trim(),
        email: form.email?.trim(),
        password: form.password,
      }

      const endpoint = form.email ? 'register' : 'login'
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

      if (form.email) {
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
    setMessage('')
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
