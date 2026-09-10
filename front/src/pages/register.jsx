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
    <div className="auth-shell register-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="brand-badge" aria-label="Workout Tracker">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <g stroke="#ffffff" stroke-width="2.2" transform="rotate(45 12 12)">
              <line x1="6" y1="12" x2="18" y2="12"/>
              <line x1="6" y1="9" x2="6" y2="15"/>
              <line x1="18" y1="9" x2="18" y2="15"/>
              <line x1="4" y1="10.5" x2="4" y2="13.5"/>
              <line x1="20" y1="10.5" x2="20" y2="13.5"/>
              </g>
            </svg>
          </div>
          <h1>Create your account</h1>
          <p>Choose a unique username and add your email.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Username
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="A funky username"
              required
            />
          </label>

          <label>
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="alex@example.com"
              required
            />
          </label>

          <label>
            Password
            <div>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="At least 6 characters"
              required
            />
            <div className="password-toggle" onClick={() => setShowPassword((prev) => !prev)} style={{ cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </div>
            </div>
          </label>

          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Please wait...' : 'Register'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>

        {message && <p className="status-message">{message}</p>}
      </div>
    </div>
  )
}

export default RegisterPage