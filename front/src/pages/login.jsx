import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/authContext'
import './login.css'
import AuroraBackground from "../components/AuroraBackground";

const initialForm = {
  username: '',
  password: '',
}

function LoginPage() {
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

    const result = await handleAuth(form, 'login')
    if (result?.success) {
      navigate('/dashboard')
    }
  }

  return (
   <AuroraBackground>
    <main className="login-container">
      <div className="auth-shell login-page">
        <div className="auth-card login-card">
          <div className="auth-header">
            <div className="brand-badge" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" focusable="false">
                <g transform="rotate(45 12 12)">
                  <line x1="6" y1="12" x2="18" y2="12" />
                  <line x1="6" y1="9" x2="6" y2="15" />
                  <line x1="18" y1="9" x2="18" y2="15" />
                  <line x1="4" y1="10.5" x2="4" y2="13.5" />
                  <line x1="20" y1="10.5" x2="20" y2="13.5" />
                </g>
              </svg>
            </div>
            <h1>Welcome back</h1>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="field">
              <input
                id="login-username"
                type="text"
                name="username"
                placeholder="Username"
                value={form.username}
                onChange={handleChange}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="login-password"></label>
              <div className="password-field">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  enterKeyHint="go"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label="Show password"
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeOff size={20} aria-hidden="true" />
                  ) : (
                    <Eye size={20} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {message && (
              <p className="status-message" role="alert">
                {message}
              </p>
            )}

            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'Logging in…' : 'Log in'}
            </button>
          </form>

          <p className="auth-switch">
            New here? <Link to="/register">Create an account</Link>
          </p>
        </div>
      </div>
    </main>
   </AuroraBackground>
  )
}

export default LoginPage