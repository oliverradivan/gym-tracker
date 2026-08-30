import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import './login.css'

const initialForm = {
  username: '',
  password: '',
}

function LoginPage() {
  const [form, setForm] = useState(initialForm)
  const navigate = useNavigate()
  const { handleAuth, loading, message, setMessage } = useAuth()

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('')

    const result = await handleAuth(form)
    if (result?.success) {
      navigate('/dashboard')
    }
  }

  return (
    <div className="auth-shell login-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="brand-badge" aria-label="Workout Tracker">
            <svg viewBox="0 0 20 24" aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
              <path d="M7 9.5v5M10.5 7v10M14 9.5v5M17.5 7v10M4.5 10.5h15M4.5 13.5h15" />
            </svg>
          </div>
          <h1>Welcome back</h1>
          <p>Use your username and password to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Username
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="A Funky Username"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="At least 6 characters"
              required
            />
          </label>

          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Please wait...' : 'Login'}
          </button>
        </form>

        <p className="auth-switch">
          Need an account? <Link to="/register">Create one</Link>
        </p>

        {message && <p className="status-message">{message}</p>}
      </div>
    </div>
  )
}

export default LoginPage
