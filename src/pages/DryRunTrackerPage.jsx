import React, { useState, useEffect, useMemo } from 'react'

/* ============================================================
   TIREHUB — DRY RUN TRACKER PAGE
   A dedicated page for logging bugs, feature requests, and
   optimizations during the 30-day system testing phase.
   ============================================================ */

export default function DryRunTrackerPage() {
  const [logs, setLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('th-dryrun-logs')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [form, setForm] = useState({
    title: '',
    category: 'Bug',
    description: ''
  })

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('th-dryrun-logs', JSON.stringify(logs))
  }, [logs])

  // Statistics calculation
  const stats = useMemo(() => {
    const counts = {
      total: logs.length,
      bug: logs.filter(l => l.category === 'Bug').length,
      feature: logs.filter(l => l.category === 'New Feature').length,
      modify: logs.filter(l => l.category === 'Modify/Tweak').length,
      opt: logs.filter(l => l.category === 'Optimization').length
    }
    return counts
  }, [logs])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.description.trim()) return

    const newLog = {
      id: Date.now(),
      title: form.title,
      category: form.category,
      description: form.description,
      date: new Date().toISOString(),
      resolved: false
    }

    setLogs([newLog, ...logs])
    setForm({ title: '', category: 'Bug', description: '' })
  }

  const handleResolve = (id) => {
    setLogs(logs.filter(log => log.id !== id))
  }

  const getCategoryConfig = (cat) => {
    switch (cat) {
      case 'Bug': 
        return { 
          badge: 'th-badge-rose', 
          icon: <path d="M12 9v4m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 18c-.77 1.333.192 3 1.732 3z" />,
          color: 'var(--th-rose)'
        }
      case 'New Feature': 
        return { 
          badge: 'th-badge-emerald', 
          icon: <path d="M12 4v16m8-8H4" />,
          color: 'var(--th-emerald)'
        }
      case 'Modify/Tweak': 
        return { 
          badge: 'th-badge-sky', 
          icon: <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />,
          color: 'var(--th-sky)'
        }
      case 'Optimization': 
        return { 
          badge: 'th-badge-violet', 
          icon: <path d="M13 10V3L4 14h7v7l9-11h-7z" />,
          color: 'var(--th-violet)'
        }
      default: 
        return { 
          badge: 'th-badge-neutral', 
          icon: <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
          color: 'var(--th-text-faint)'
        }
    }
  }

  return (
    <div className="th-page animate-slide-in-right">
      <style>{`
        .th-kpi-grid {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 0.5rem !important;
        }

        .th-page {
            font-family: var(--font-body);
            line-height: 1.5;
            color: var(--th-text-body);
            display: flex;
            flex-direction: column;
            gap: .5rem;
        }

        .dr-log-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--th-shadow-card);
          border-color: var(--th-border-strong);
        }

        .dr-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 0;
          border-bottom: 1px solid var(--th-border);
          padding-bottom: 0.5rem;
          gap: 1rem;
        }

        .dr-sub {
          opacity: 0.7;
          max-width: 400px;
          text-align: right;
        }

        @media (max-width: 960px) {
          .dr-layout { grid-template-columns: 1fr !important; }
          .th-panel { position: static !important; }
        }
        @media (max-width: 768px) {
          .dr-header {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
          .dr-sub {
            text-align: center;
          }
        }
        @media (max-width: 640px) {
          .th-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      {/* Header Row */}
      <div className="att-header-row dr-header">
        <div className="th-page-title">
          Dry Run <span style={{ color: 'var(--th-orange)' }}>Tracker</span>
        </div>
        <div className="th-text-xs dr-sub">
          Log system feedback, bugs, and feature requests during the 30-day testing phase. 
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="th-kpi-row th-kpi-grid">
        <div className="th-kpi amber">
          <div className="kpi-lbl th-kpi-label">Active Logs</div>
          <div className="kpi-val th-kpi-value">{stats.total}</div>
          <div className="kpi-sub th-kpi-sub">Feedback items</div>
        </div>
        <div className="th-kpi rose">
          <div className="kpi-lbl th-kpi-label">Bugs</div>
          <div className="kpi-val th-kpi-value">{stats.bug}</div>
          <div className="kpi-sub th-kpi-sub">Issues to fix</div>
        </div>
        <div className="th-kpi emerald">
          <div className="kpi-lbl th-kpi-label">Features</div>
          <div className="kpi-val th-kpi-value">{stats.feature}</div>
          <div className="kpi-sub th-kpi-sub">Requested additions</div>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '.5rem', alignItems: 'flex-start' }} className="dr-layout">
        
        {/* Left Column: Form */}
        <div className="th-panel" style={{ position: 'sticky', top: '1rem' }}>
          <div className="th-panel-header">
            <div className="th-section-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 4v16m8-8H4" />
              </svg>
              Log New Entry
            </div>
          </div>
          <div className="th-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="th-label">Title</label>
                <input 
                  className="th-input" 
                  placeholder="Brief summary..." 
                  value={form.title}
                  onChange={e => setForm({...form, title: e.target.value})}
                  required
                />
              </div>

              <div>
                <label className="th-label">Category</label>
                <select 
                  className="th-select"
                  value={form.category}
                  onChange={e => setForm({...form, category: e.target.value})}
                >
                  <option>Bug</option>
                  <option>New Feature</option>
                  <option>Modify/Tweak</option>
                  <option>Optimization</option>
                </select>
              </div>

              <div>
                <label className="th-label">Description</label>
                <textarea 
                  className="th-textarea" 
                  rows="5" 
                  placeholder="Provide details..."
                  style={{ resize: 'none' }}
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  required
                />
              </div>

              <button type="submit" className="th-btn th-btn-emerald th-btn-full" style={{ marginTop: '0.5rem' }}>
                Submit Feedback
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className="th-section-label" style={{ marginTop: 0 }}>Active Feedbacks</div>
          
          {logs.length === 0 ? (
            <div className="th-panel" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
              <div style={{ background: 'var(--th-bg-card-alt)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', border: '1px solid var(--th-border)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--th-emerald)" strokeWidth="1.5" style={{ margin: 'auto' }}>
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="th-modal-title" style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>All Caught Up!</div>
              <div className="th-text-dim" style={{ fontSize: '0.9rem' }}>No feedback items logged yet. The system is running smooth.</div>
            </div>
          ) : (
            logs.map(log => {
              const config = getCategoryConfig(log.category)
              return (
                <div key={log.id} className="th-panel dr-log-card" style={{ transition: 'transform 0.2s, box-shadow 0.2s' }}>
                  <div className="th-panel-body" style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', gap: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.75rem', flex: 1 }}>
                        <div style={{ 
                          width: '36px', height: '36px', borderRadius: '8px', 
                          background: config.color + '15', color: config.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, marginTop: '2px'
                        }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            {config.icon}
                          </svg>
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--th-text-primary)', marginBottom: '0.15rem' }}>{log.title}</div>
                          <div className="th-text-xs">
                            Logged on {new Date(log.date).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                      <span className={`th-badge ${config.badge}`}>
                        {log.category}
                      </span>
                    </div>
                    
                    <div className="th-text-body" style={{ 
                      fontSize: '0.88rem', 
                      lineHeight: 1.6,
                      background: 'var(--th-bg-card-alt)',
                      padding: '0.85rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid var(--th-border)',
                      marginBottom: '0.85rem',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {log.description}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--th-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                      <button 
                        onClick={() => handleResolve(log.id)}
                        className="th-btn th-btn-ghost"
                        style={{ height: '32px', padding: '0 0.75rem', fontSize: '0.75rem', color: 'var(--th-rose)', borderColor: 'var(--th-rose-bg)' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '4px' }}>
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                        Resolve / Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
