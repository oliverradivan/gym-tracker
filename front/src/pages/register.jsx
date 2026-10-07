import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import './register.css'
import { Eye, EyeOff } from 'lucide-react'

const initialForm = {
  username: '',
  email: '',
  password: '',
}

function RegisterPage() {
  const [form, setForm] = useState(initialForm)
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const { handleAuth, loading, message, setMessage } = useAuth()

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('')

    const result = await handleAuth(form, 'register')

    if (result?.success) {
      navigate('/login')
    }
  }

  return (
    <main className="register-container">
      <div className="register-shell">
        <div className="register-card">
          <div className="register-header">
            <div
              className="register-brand-badge"
              aria-label="Workout Tracker"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                focusable="false"
                aria-hidden="true"
              >
                <g transform="rotate(45 12 12)">
                  <line x1="6" y1="12" x2="18" y2="12" />
                  <line x1="6" y1="9" x2="6" y2="15" />
                  <line x1="18" y1="9" x2="18" y2="15" />
                  <line x1="4" y1="10.5" x2="4" y2="13.5" />
                  <line x1="20" y1="10.5" x2="20" y2="13.5" />
                </g>
              </svg>
            </div>

            <h1>Create your account</h1>
          </div>

          <form onSubmit={handleSubmit} className="register-form">
            <input
              type="text"
              name="username"
              placeholder="Username"
              value={form.username}
              onChange={handleChange}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />

            <input
              type="email"
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              required
            />

            <div className="register-password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Password (at least 10 characters)"
                autoComplete="new-password"
                minLength={10}
                required
              />

              <button
                type="button"
                className="register-password-toggle"
                onClick={() =>
                  setShowPassword((prev) => !prev)
                }
                aria-label={
                  showPassword
                    ? 'Hide password'
                    : 'Show password'
                }
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>

            <button
              type="submit"
              className="register-primary-btn"
              disabled={loading}
            >
              {loading ? 'Please wait...' : 'Register'}
            </button>
          </form>

          <p className="register-auth-switch">
            Already have an account?{' '}
            <Link to="/login">Login</Link>
          </p>

          {message && (
            <p className="register-status-message" role="alert">
              {message}
            </p>
          )}
        </div>
      </div>
    </main>
  )
}

export default RegisterPage