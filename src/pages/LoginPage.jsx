import '../pages_css/LoginPage.css';
import React from 'react'
import { API_URL } from '../lib/config'

function LoginPage({ onLogin }) {
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPw, setShowPw]     = React.useState(false)
  const [error, setError]       = React.useState('')
  const [loading, setLoading]   = React.useState(false)
  const [shake, setShake]       = React.useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Invalid credentials')
        setShake(true)
        setTimeout(() => setShake(false), 600)
      } else {
        localStorage.setItem('th-token', data.token)
        localStorage.setItem('th-user', data.username)
        onLogin(data)
      }
    } catch {
      setError('Cannot connect to server')
      setShake(true)
      setTimeout(() => setShake(false), 600)
    } finally {
      setLoading(false)
    }
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

        {/* Decorative ring */}
        <div className="lp-ring" aria-hidden="true" />

        <div className="lp-brand-content">
          {/* Logo */}
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
            Your shop.<br />
            <span className="lp-headline-accent">Under control.</span>
          </div>
          <p className="lp-brand-sub">
            All-in-one management for inventory, staff, sales, and finances — built for tire shops.
          </p>

          {/* Feature pills */}
          <div className="lp-pills">
            <span className="lp-pill lp-pill-emerald">
              <svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="4"/></svg>
              Sales &amp; Inventory
            </span>
            <span className="lp-pill lp-pill-sky">
              <svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="4"/></svg>
              Staff &amp; Payroll
            </span>
            <span className="lp-pill lp-pill-violet">
              <svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="4"/></svg>
              Financial Health
            </span>
            <span className="lp-pill lp-pill-amber">
              <svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="4"/></svg>
              Receivables
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="lp-stats">
          <div className="lp-stat">
            <span className="lp-stat-num">12+</span>
            <span className="lp-stat-label">Modules</span>
          </div>
          <div className="lp-stat-divider" />
          <div className="lp-stat">
            <span className="lp-stat-num">100%</span>
            <span className="lp-stat-label">Local data</span>
          </div>
          <div className="lp-stat-divider" />
          <div className="lp-stat">
            <span className="lp-stat-num">24/7</span>
            <span className="lp-stat-label">Access</span>
          </div>
        </div>

        {/* Bottom badge */}
        <div className="lp-brand-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Secure &amp; encrypted
        </div>
      </div>

      {/* ── Right: form panel ── */}
      <div className="lp-right">
        <div className="lp-right-top">
          <span className="lp-right-logo">Core<em>Track</em></span>
        </div>

        <div className={`lp-form-wrap${shake ? ' lp-shake' : ''}`}>
          <div className="lp-form-header">
            <div className="lp-form-eyebrow">Welcome back</div>
            <h1 className="lp-form-title">Sign in to your<br/>workspace</h1>
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
              <label className="lp-label" htmlFor="lp-username">Username</label>
              <div className="lp-input-wrap">
                <svg className="lp-input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
                <input
                  id="lp-username"
                  className="lp-input"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="your.username"
                  autoFocus
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="lp-field">
              <label className="lp-label" htmlFor="lp-password">Password</label>
              <div className="lp-input-wrap">
                <svg className="lp-input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  id="lp-password"
                  className="lp-input"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button type="button" className="lp-pw-toggle" onClick={() => setShowPw(v => !v)} tabIndex={-1} aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw
                    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            <button className="lp-btn" type="submit" disabled={loading || !username || !password}>
              <span className="lp-btn-bg" aria-hidden="true" />
              {loading
                ? <><span className="lp-btn-spinner" aria-hidden="true" />Signing in…</>
                : <>Sign In <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>
              }
            </button>
          </form>
        </div>

        <div className="lp-right-footer">
          <span>&copy; {new Date().getFullYear()} CoreTrack. All rights reserved.</span>
          <span style={{ opacity: 0.6 }}>v2.0</span>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
