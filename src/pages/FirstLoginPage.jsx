import React from 'react'
import { API_URL } from '../lib/config'



function FirstLoginPage({ loginData, onDone }) {
  // loginData: { token, username, full_name, must_change_pin, ... }
  const [newUsername, setNewUsername] = React.useState(loginData.username || '')
  const [currentPin, setCurrentPin] = React.useState('')
  const [newPin, setNewPin] = React.useState('')
  const [confirmPin, setConfirmPin] = React.useState('')
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!currentPin) {
      setError('Enter your current temporary PIN')
      return
    }
    if (!newPin) {
      setError('Enter a new PIN')
      return
    }
    if (newPin !== confirmPin) {
      setError('PINs do not match')
      return
    }
    if (!/^\d{4,8}$/.test(newPin)) {
      setError('PIN must be 4–8 digits (numbers only)')
      return
    }
    if (!newUsername.trim()) {
      setError('Username cannot be empty')
      return
    }
    if (!/^[a-z0-9._]{3,30}$/.test(newUsername)) {
      setError('Username: 3–30 chars, lowercase letters, numbers, dots, or underscores only')
      return
    }

    setLoading(true)
    try {
      const body = {
        username: loginData.username,
        current_pin: currentPin,
        new_username: newUsername !== loginData.username ? newUsername : undefined,
        new_pin: newPin,
      }

      const res = await fetch(`${API_URL}/auth/change-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginData.token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to update credentials')
        return
      }

      const finalUsername = data.username || newUsername
      localStorage.setItem('th-user', finalUsername)
      onDone({ ...loginData, username: finalUsername })
    } catch {
      setError('Cannot connect to server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fl-wrap">
      <div className="fl-card">
        <div className="fl-logo">Tire<span>Hub</span></div>
        <div className="fl-title">Set Up Your Account</div>
        <div className="fl-sub">
          Welcome, {loginData.full_name || loginData.username}
        </div>

        <div className="fl-notice">
          Your account was just created. Update your username and set a personal PIN before continuing.
        </div>

        {error && <div className="fl-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="fl-field">
            <label className="fl-label">Username</label>
            <input
              className="fl-input"
              type="text"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value.toLowerCase())}
              autoFocus
              autoComplete="off"
            />
            <div className="fl-hint">Auto-generated from your name — you can customize it.</div>
          </div>

          <hr className="fl-divider" />

          <div className="fl-field">
            <label className="fl-label">Current Temporary PIN</label>
            <input
              className="fl-input"
              type="password"
              inputMode="numeric"
              value={currentPin}
              onChange={e => setCurrentPin(e.target.value)}
              placeholder="Given by admin"
              autoComplete="current-password"
            />
          </div>

          <div className="fl-field">
            <label className="fl-label">New PIN</label>
            <input
              className="fl-input"
              type="password"
              inputMode="numeric"
              value={newPin}
              onChange={e => setNewPin(e.target.value)}
              placeholder="4–8 digits"
              autoComplete="new-password"
            />
          </div>

          <div className="fl-field">
            <label className="fl-label">Confirm New PIN</label>
            <input
              className={`fl-input${newPin && confirmPin && newPin !== confirmPin ? ' error' : ''}`}
              type="password"
              inputMode="numeric"
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value)}
              placeholder="Re-enter new PIN"
              autoComplete="new-password"
            />
          </div>

          <button className="fl-btn" type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Save & Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default FirstLoginPage
