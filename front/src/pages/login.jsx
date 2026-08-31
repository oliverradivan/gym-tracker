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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <rect width="24" height="24" rx="6" fill="#fdf6f0"/>
              <g stroke="#000000" stroke-width="2.2" stroke-linecap="round" transform="rotate(45 12 12)">
              <line x1="6" y1="12" x2="18" y2="12"/>
              <line x1="6" y1="9" x2="6" y2="15"/>
              <line x1="18" y1="9" x2="18" y2="15"/>
              <line x1="4" y1="10.5" x2="4" y2="13.5"/>
              <line x1="20" y1="10.5" x2="20" y2="13.5"/>
              </g>
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
