import '../pages_css/LoginPage.css'; // Reusing LoginPage styles!
import React from 'react'
import { API_URL } from '../lib/config'

function FirstLoginPage({ loginData, onDone }) {
  const [newUsername, setNewUsername] = React.useState(loginData.username || '')
  const [currentPin, setCurrentPin] = React.useState('')
  const [newPin, setNewPin] = React.useState('')
  const [confirmPin, setConfirmPin] = React.useState('')
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [shake, setShake] = React.useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!currentPin) {
      triggerError('Enter your current temporary PIN')
      return
    }
    if (!newPin) {
      triggerError('Enter a new PIN')
      return
    }
    if (newPin !== confirmPin) {
      triggerError('PINs do not match')
      return
    }
    if (!/^\d{4,8}$/.test(newPin)) {
      triggerError('PIN must be 4–8 digits (numbers only)')
      return
    }
    if (!newUsername.trim()) {
      triggerError('Username cannot be empty')
      return
    }
    if (!/^[a-z0-9._]{3,30}$/.test(newUsername)) {
      triggerError('Username: 3–30 chars, lowercase letters, numbers, dots, or underscores only')
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
        triggerError(data.error || 'Failed to update credentials')
        return
      }

      const finalUsername = data.username || newUsername
      localStorage.setItem('th-user', finalUsername)
      onDone({ ...loginData, username: finalUsername })
    } catch {
      triggerError('Cannot connect to server')
    } finally {
      setLoading(false)
    }
  }

  function triggerError(msg) {
    setError(msg)
    setShake(true)
    setTimeout(() => setShake(false), 600)
    setLoading(false)
  }

  return (
    <div className="lp-wrap">
      {/* ── Left: brand panel ── */}
      <div className="lp-brand">
        <div className="lp-mesh" aria-hidden="true" />
        <div className="lp-noise" aria-hidden="true" />
        <div className="lp-orb lp-orb1" aria-hidden="true" />
        <div className="lp-orb lp-orb2" aria-hidden="true" />
        <div className="lp-orb lp-orb3" aria-hidden="true" />

        <div className="lp-ring" aria-hidden="true" />

        <div className="lp-brand-content">
          <div className="lp-logo">
            <div className="lp-logo-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="4"/>
                <line x1="12" y1="2" x2="12" y2="8"/>
                <line x1="12" y1="16" x2="12" y2="22"/>
                <line x1="2" y1="12" x2="8" y2="12"/>
                <line x1="16" y1="12" x2="22" y2="12"/>
              </svg>
            </div>
            <span className="lp-logo-text">Core<em>Track</em></span>
          </div>

          <div className="lp-brand-headline">
            Welcome to<br />
            <span className="lp-headline-accent">CoreTrack.</span>
          </div>
          <p className="lp-brand-sub">
            Let's get your account set up securely. You'll need to change your temporary PIN to proceed.
          </p>
        </div>
      </div>

      {/* ── Right: form panel ── */}
      <div className="lp-right">
        <div className="lp-right-top">
          <span className="lp-right-logo">Core<em>Track</em></span>
        </div>

        <div className={`lp-form-wrap${shake ? ' lp-shake' : ''}`}>
          <div className="lp-form-header">
            <div className="lp-form-eyebrow">First Login</div>
            <h1 className="lp-form-title">Set up your<br/>account</h1>
            <p className="lp-form-sub" style={{ marginTop: '0.5rem' }}>
              Welcome, {loginData.full_name || loginData.username}. Please update your credentials.
            </p>
          </div>

          {error && (
            <div className="lp-error" role="alert">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="lp-form" noValidate>
            <div className="lp-field">
              <label className="lp-label">Username</label>
              <div className="lp-input-wrap">
                <svg className="lp-input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
                <input
                  className="lp-input"
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value.toLowerCase())}
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="lp-field">
              <label className="lp-label">Current Temp PIN</label>
              <div className="lp-input-wrap">
                <svg className="lp-input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  className="lp-input"
                  type="password"
                  inputMode="numeric"
                  value={currentPin}
                  onChange={e => setCurrentPin(e.target.value)}
                  placeholder="Given by admin"
                />
              </div>
            </div>

            <div className="lp-field">
              <label className="lp-label">New PIN</label>
              <div className="lp-input-wrap">
                <svg className="lp-input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  className="lp-input"
                  type="password"
                  inputMode="numeric"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value)}
                  placeholder="4–8 digits"
                />
              </div>
            </div>

            <div className="lp-field">
              <label className="lp-label">Confirm New PIN</label>
              <div className="lp-input-wrap">
                <svg className="lp-input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  className="lp-input"
                  type="password"
                  inputMode="numeric"
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value)}
                  placeholder="Re-enter new PIN"
                />
              </div>
            </div>

            <button className="lp-btn" type="submit" disabled={loading}>
              <span className="lp-btn-bg" aria-hidden="true" />
              {loading ? (
                <><span className="lp-btn-spinner" aria-hidden="true" />Saving…</>
              ) : (
                <>Save & Continue <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default FirstLoginPage
