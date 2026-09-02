import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import { useTheme } from '../context/themeContext'
import { Palette, User, Lock, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react'
import './settings.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const TABS = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'account', label: 'Account', icon: User },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'danger', label: 'Danger Zone', icon: ShieldAlert, danger: true },
]

function SettingsPage() {
  const navigate = useNavigate()
  const { user, session, handleLogout } = useAuth()
  const { theme, toggleTheme } = useTheme()

  // State for forms
  const [activeTab, setActiveTab] = useState('appearance')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Username form
  const [newUsername, setNewUsername] = useState('')
  const [usernameLoading, setUsernameLoading] = useState(false)

  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  // Delete account
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const currentUsername = user?.user_metadata?.username || 'User'

  // Switching tabs clears any leftover success/error banner from the
  // previous tab so it can't show up somewhere it no longer applies.
  const selectTab = (tabId) => {
    setActiveTab(tabId)
    setMessage('')
    setError('')
  }

  const resetDeleteForm = () => {
    setShowDeleteConfirm(false)
    setDeletePassword('')
    setDeleteConfirm('')
  }

  const handleUpdateUsername = async (e) => {
    e.preventDefault()
    if (!newUsername.trim()) {
      setError('Username cannot be empty')
      return
    }

    if (!session?.access_token) {
      setError('Your session has expired. Please log in again.')
      return
    }

    setUsernameLoading(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch(`${API_URL}/profile/username`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ username: newUsername }),
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
        throw new Error(result.detail || result.message || 'Failed to update username')
      }

      setMessage('Username updated successfully')
      setNewUsername('')
      // In a real app, you'd update the auth context here
    } catch (err) {
      setError(err.message)
    } finally {
      setUsernameLoading(false)
    }
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!session?.access_token) {
      setError('Your session has expired. Please log in again.')
      return
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters')
      return
    }

    setPasswordLoading(true)

    try {
      const response = await fetch(`${API_URL}/profile/password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
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
        throw new Error(result.detail || result.message || 'Failed to update password')
      }

      setMessage('Password updated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err.message)
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleDeleteAccount = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!session?.access_token) {
      setError('Your session has expired. Please log in again.')
      return
    }

    if (deleteConfirm !== 'DELETE') {
      setError('Please type "DELETE" to confirm')
      return
    }

    setDeleteLoading(true)

    try {
      const response = await fetch(`${API_URL}/profile`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ password: deletePassword }),
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
        throw new Error(result.detail || result.message || 'Failed to delete account')
      }

      setMessage('Account deleted. Logging out...')
      setTimeout(() => {
        handleLogout()
        navigate('/login')
      }, 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="settings-page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Settings</span>
          <h2>Account Settings</h2>
        </div>
        <button className="ghost-btn" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </button>
      </header>

      <div className="settings-container">
        <nav className="settings-sidebar">
          {TABS.map(({ id, label, icon: Icon, danger }) => (
            <button
              key={id}
              className={`settings-tab ${danger ? 'danger' : ''} ${activeTab === id ? 'active' : ''}`}
              onClick={() => selectTab(id)}
              aria-current={activeTab === id ? 'page' : undefined}
            >
              <Icon className="tab-icon" size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {message && (
            <div className="success-message" role="status">
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>{message}</span>
            </div>
          )}
          {error && (
            <div className="error-message" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <section className="settings-section">
              <h3>Appearance</h3>
              <div className="setting-item">
                <div className="setting-label">
                  <label>Dark Mode</label>
                  <p className="setting-description">Toggle between light and dark theme</p>
                </div>
                <button
                  className={`theme-toggle ${theme === 'dark' ? 'dark' : ''}`}
                  onClick={toggleTheme}
                  aria-label="Toggle dark mode"
                >
                  <span className="toggle-track" />
                  <span className="toggle-thumb" />
                </button>
              </div>
              <div className="setting-item">
                <div className="setting-label">
                  <label>Current Theme</label>
                </div>
                <p className="current-value">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</p>
              </div>
            </section>
          )}

          {/* Account Tab */}
          {activeTab === 'account' && (
            <section className="settings-section">
              <h3>Account Information</h3>
              <div className="setting-item">
                <div className="setting-label">
                  <label>Current Username</label>
                </div>
                <p className="current-value">@{currentUsername}</p>
              </div>

              <form onSubmit={handleUpdateUsername} className="settings-form">
                <h4>Change Username</h4>
                <div className="form-group">
                  <label htmlFor="new-username">New Username</label>
                  <input
                    id="new-username"
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Enter new username"
                    disabled={usernameLoading}
                  />
                  <small>Username must be 3-24 characters, alphanumeric only</small>
                </div>
                <button type="submit" className="primary-btn" disabled={usernameLoading}>
                  {usernameLoading ? 'Updating...' : 'Update Username'}
                </button>
              </form>
            </section>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <section className="settings-section">
              <form onSubmit={handleUpdatePassword} className="settings-form">
                <h3>Change Password</h3>
                <div className="form-group">
                  <label htmlFor="current-password">Current Password</label>
                  <input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    disabled={passwordLoading}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="new-password">New Password</label>
                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    disabled={passwordLoading}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="confirm-password">Confirm New Password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    disabled={passwordLoading}
                  />
                </div>
                <button type="submit" className="primary-btn" disabled={passwordLoading}>
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </section>
          )}

          {/* Danger Zone Tab */}
          {activeTab === 'danger' && (
            <section className="settings-section danger-zone">
              <h3>
                <ShieldAlert size={18} aria-hidden="true" style={{ verticalAlign: 'text-bottom', marginRight: 8 }} />
                Danger Zone
              </h3>
              <div className="danger-item">
                <div>
                  <h4>Delete Account</h4>
                  <p>
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                </div>
                <button
                  className="danger-btn"
                  onClick={() => (showDeleteConfirm ? resetDeleteForm() : setShowDeleteConfirm(true))}
                  disabled={deleteLoading}
                >
                  {showDeleteConfirm ? 'Cancel' : 'Delete Account'}
                </button>
              </div>

              {showDeleteConfirm && (
                <form onSubmit={handleDeleteAccount} className="delete-confirmation">
                  <div className="warning-box">
                    <AlertCircle size={16} aria-hidden="true" />
                    <span>
                      This will permanently delete your account and all your workout data. This
                      cannot be undone.
                    </span>
                  </div>
                  <div className="form-group">
                    <label htmlFor="delete-password">Confirm with your password</label>
                    <input
                      id="delete-password"
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="Enter your password"
                      disabled={deleteLoading}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="delete-confirm">
                      Type <strong>DELETE</strong> to confirm
                    </label>
                    <input
                      id="delete-confirm"
                      type="text"
                      value={deleteConfirm}
                      onChange={(e) => setDeleteConfirm(e.target.value.toUpperCase())}
                      placeholder="DELETE"
                      disabled={deleteLoading}
                    />
                  </div>
                  <div className="button-group">
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={resetDeleteForm}
                      disabled={deleteLoading}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="danger-btn" disabled={deleteLoading}>
                      {deleteLoading ? 'Deleting...' : 'Permanently Delete Account'}
                    </button>
                  </div>
                </form>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsPage