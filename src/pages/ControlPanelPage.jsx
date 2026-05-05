import '../pages_css/ControlPanelPage.css';
import React from 'react'
import { API_URL, apiFetch, SkeletonRows } from '../lib/config'
import { DataTable } from '../components/DataTable'

/** 
 * Robust clipboard helper with fallback for non-secure contexts (HTTP)
 */
function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  } else {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
    return Promise.resolve();
  }
}


// Power helpers (mirrors server-side)
const POWER_MAP = { superadmin: 100, owner: 80, admin: 60 }
function computePower(systemRoles) {
  return Math.max(0, ...(systemRoles || []).map(r => POWER_MAP[r] || 0))
}

// Roles a caller can grant given their power
function grantableRoles(callerPower) {
  return Object.entries(POWER_MAP).filter(([, p]) => p < callerPower).map(([r]) => r)
}

/* ── System Roles Modal ── */
function ManageRolesModal({ staff, callerPower, onClose, onSaved }) {
  const available = grantableRoles(callerPower)
  const [selected, setSelected] = React.useState(new Set(staff.system_roles || []))
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  function toggle(role) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(role) ? next.delete(role) : next.add(role)
      return next
    })
  }

  async function save() {
    setSaving(true); setError('')
    try {
      const token = localStorage.getItem('th-token')
      const res = await fetch(`${API_URL}/credentials/${staff.credential_id}/system-roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roles: [...selected] }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Failed'); return }
      onSaved([...selected])
    } finally { setSaving(false) }
  }

  const ROLE_DESC = {
    owner: 'Full access — can manage admin accounts and see superadmin info',
    admin: 'Can manage staff credentials, pages, and roles below admin level',
  }

  return (
    <div className="cp-overlay" onClick={onClose}>
      <div className="cp-pages-modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="cp-pages-modal-hd">
          <div>
            <div className="cp-pages-modal-title">System Roles — {staff.full_name}</div>
            <div className="cp-pages-modal-sub">{staff.username}</div>
          </div>
          <button className="cp-pages-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ color:'var(--th-rose)', fontSize:'0.82rem', marginBottom:'0.75rem' }}>{error}</div>}
        {available.length === 0 ? (
          <div style={{ color:'var(--th-text-faint)', fontSize:'0.85rem' }}>You don't have permission to grant any roles.</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem', marginBottom:'1rem' }}>
            {available.map(role => (
              <label key={role} className="cp-page-check" style={{ padding:'0.65rem 0.75rem', border:'1px solid var(--th-border)', borderRadius:9, alignItems:'flex-start', gap:'0.65rem' }}>
                <input type="checkbox" checked={selected.has(role)} onChange={() => toggle(role)} style={{ marginTop:2 }} />
                <div>
                  <div style={{ fontWeight:600, fontSize:'0.88rem', color:'var(--th-text-primary)', textTransform:'capitalize' }}>{role}</div>
                  <div style={{ fontSize:'0.75rem', color:'var(--th-text-faint)', marginTop:'0.1rem' }}>{ROLE_DESC[role] || ''}</div>
                </div>
              </label>
            ))}
          </div>
        )}
        <div className="cp-pages-footer">
          <button className="cp-pages-cancel" onClick={onClose}>Cancel</button>
          <button className="cp-pages-save" onClick={save} disabled={saving || available.length === 0}>
            {saving ? 'Saving…' : 'Save Roles'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Superadmin Info Card ── */
function SuperadminCard() {
  const [info, setInfo] = React.useState(null)
  const [visible, setVisible] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [userCopied, setUserCopied] = React.useState(false)

  React.useEffect(() => {
    const token = localStorage.getItem('th-token')
    fetch(`${API_URL}/superadmin-info`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setInfo(d) })
      .catch(() => {})
  }, [])

  if (!info) return null

  return (
    <div style={{ background:'var(--th-bg-card)', border:'1px solid var(--th-orange)', borderRadius:12,
      padding:'1rem 1.25rem', marginBottom:'.5rem', display:'flex', alignItems:'center',
      gap:'1rem', flexWrap:'wrap' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--th-orange)" strokeWidth="2" style={{ flexShrink:0 }}>
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'0.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--th-orange)', marginBottom:'0.25rem' }}>
          Superadmin Account
        </div>
        <div style={{ display:'flex', flexDirection: 'column', gap:'0.4rem', alignItems:'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize:'0.72rem', color:'var(--th-text-faint)' }}>Username: </span>
            <code style={{ fontSize:'0.88rem', color:'var(--th-text-primary)' }}>{info.username}</code>
            <button 
              title="Copy Username"
              onClick={() => {
                copyToClipboard(info.username)
                setUserCopied(true)
                setTimeout(() => setUserCopied(false), 2000)
              }}
              style={{
                background: 'none', border: 'none', color: 'var(--th-text-faint)',
                cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center',
                transition: 'color 0.15s', lineHeight: 1
              }}
              onMouseOver={e => e.currentTarget.style.color = 'var(--th-sky)'}
              onMouseOut={e => e.currentTarget.style.color = 'var(--th-text-faint)'}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            {userCopied && <span style={{ fontSize: '0.6rem', color: 'var(--th-sky)', fontWeight: 700, animation: 'cpIn 0.2s' }}>COPIED!</span>}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
            <span style={{ fontSize:'0.72rem', color:'var(--th-text-faint)' }}>Password: </span>
            <code style={{ fontSize:'0.88rem', color:'var(--th-text-primary)', letterSpacing: visible ? 0 : '0.15em' }}>
              {visible ? info.password : '••••••••••'}
            </code>
            <button onClick={() => setVisible(v => !v)}
              style={{ background:'none', border:'none', cursor:'pointer', color:'var(--th-text-faint)', fontSize:'0.75rem', padding:'0 0.25rem' }}>
              {visible ? 'hide' : 'show'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <button 
                title="Copy Password"
                onClick={() => {
                  copyToClipboard(info.password)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                style={{
                  background: 'none', border: 'none', color: 'var(--th-text-faint)',
                  cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center',
                  transition: 'color 0.15s', lineHeight: 1
                }}
                onMouseOver={e => e.currentTarget.style.color = 'var(--th-orange)'}
                onMouseOut={e => e.currentTarget.style.color = 'var(--th-text-faint)'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
              {copied && <span style={{ fontSize: '0.65rem', color: 'var(--th-orange)', fontWeight: 700, animation: 'cpIn 0.2s' }}>COPIED!</span>}
            </div>
          </div>
        </div>
      </div>
      <div style={{ fontSize:'0.72rem', color:'var(--th-text-faint)', lineHeight:1.4 }}>
        Keep these confidential.<br/>Only visible to owners.
      </div>
    </div>
  )
}

const PAGE_SECTIONS = [
  { label: 'Main',           items: [{ id: 'dashboard', label: 'Dashboard' }, { id: 'pos', label: 'Point of Sale' }] },
  { label: 'Operations',     items: [{ id: 'orders', label: 'Orders' }, { id: 'inventory', label: 'Inventory' }, { id: 'products', label: 'Products' }, { id: 'purchases', label: 'Purchases' }, { id: 'recap', label: 'Recap Tires' }, { id: 'returns', label: 'Returns' }] },
  { label: 'Sales & Service',items: [{ id: 'sales', label: 'Sales History' }, { id: 'services', label: 'Services' }, { id: 'services-summary', label: 'Services Summary' }] },
  { label: 'People',         items: [{ id: 'customers', label: 'Customers' }, { id: 'suppliers', label: 'Suppliers' }, { id: 'staff', label: 'Staff' }, { id: 'attendance', label: 'Attendance' }, { id: 'payroll', label: 'Payroll' }] },
  { label: 'Finance',        items: [{ id: 'profits', label: 'Profit & Margins' }, { id: 'expenses', label: 'Expenses' }, { id: 'cashledger', label: 'Cash Ledger' }, { id: 'receivables', label: 'Receivables' }, { id: 'payables', label: 'Payables' }] },
  { label: 'Reports',        items: [{ id: 'reports', label: 'Reports' }] },
  // Admin (Control Panel) is owner/admin only — never grantable here
]

function ManagePagesModal({ staff, onClose, onSaved }) {
  const [selected, setSelected] = React.useState(new Set(staff.allowed_pages || []))
  const [saving, setSaving] = React.useState(false)
  const [loading, setLoading] = React.useState(true)

  // Always fetch fresh from server on open
  React.useEffect(() => {
    const token = localStorage.getItem('th-token')
    fetch(`${API_URL}/credentials/${staff.credential_id}/pages`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(pages => { setSelected(new Set(Array.isArray(pages) ? pages : [])); setLoading(false) })
      .catch(() => setLoading(false))
  }, [staff.credential_id])

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSection(items) {
    const ids = items.map(i => i.id)
    const allOn = ids.every(id => selected.has(id))
    setSelected(prev => {
      const next = new Set(prev)
      ids.forEach(id => allOn ? next.delete(id) : next.add(id))
      return next
    })
  }

  async function save() {
    setSaving(true)
    try {
      const token = localStorage.getItem('th-token')
      await fetch(`${API_URL}/credentials/${staff.credential_id}/pages`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pages: [...selected] }),
      })
      onSaved([...selected])
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cp-overlay" onClick={onClose}>
      <div className="cp-pages-modal" onClick={e => e.stopPropagation()}>
        <div className="cp-pages-modal-hd">
          <div>
            <div className="cp-pages-modal-title">Page Access — {staff.full_name}</div>
            <div className="cp-pages-modal-sub">{staff.username} · {staff.role}</div>
          </div>
          <button className="cp-pages-close" onClick={onClose}>✕</button>
        </div>

        <div className="cp-pages-body">
          {loading ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', padding:'1.5rem', color:'var(--th-text-faint)', fontSize:'0.85rem' }}><div className="th-spinner th-spinner-sm" />Loading…</div>
          ) : PAGE_SECTIONS.map(section => {
            const allOn = section.items.every(i => selected.has(i.id))
            return (
              <div className="cp-pages-section" key={section.label}>
                <div className="cp-pages-section-label" style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:'0.4rem', cursor:'pointer' }}>
                    <input type="checkbox" checked={allOn} onChange={() => toggleSection(section.items)} style={{ accentColor:'var(--th-orange)', width:13, height:13 }} />
                    {section.label}
                  </label>
                </div>
                <div className="cp-pages-grid">
                  {section.items.map(item => (
                    <label className="cp-page-check" key={item.id}>
                      <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="cp-pages-footer">
          <button className="cp-pages-cancel" onClick={onClose}>Cancel</button>
          <button className="cp-pages-save" onClick={save} disabled={saving || loading}>
            {saving ? 'Saving…' : 'Save Access'}
          </button>
        </div>
      </div>
    </div>
  )
}

function roleBadge(role) {
  const colors = {
    owner: '#f97316', admin: '#f97316', manager: '#a78bfa', sales: '#38bdf8',
    tireman: '#34d399', technician: '#34d399', mechanic: '#34d399',
    vulcanizer: '#fbbf24', helper: '#fbbf24',
  }
  const c = colors[(role || '').toLowerCase()] || '#8fa3b8'
  return (
    <span style={{ background: c + '22', color: c, padding: '0.15rem 0.45rem',
      borderRadius: 4, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {role || '—'}
    </span>
  )
}

/* ── Staff Access Tab ── */
function StaffAccessTab({ callerPower }) {
  const [staff, setStaff]     = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [revealed, setRevealed] = React.useState(null)
  const [copied, setCopied] = React.useState(false)
  const [userCopied, setUserCopied] = React.useState(false)
  const [busy, setBusy]       = React.useState({})
  const [managingPages, setManagingPages] = React.useState(null)
  const [managingRoles, setManagingRoles] = React.useState(null)
  const [pinResetConfirm, setPinResetConfirm] = React.useState(null) // { id, name }

  function load() {
    setLoading(true)
    apiFetch(`${API_URL}/credentials`).then(r => r.json())
      .then(d => { setStaff(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  React.useEffect(() => { load() }, [])

  async function createCredentials(staff_id) {
    setBusy(b => ({ ...b, [staff_id]: true }))
    const r = await apiFetch(`${API_URL}/credentials`, { method: 'POST', body: JSON.stringify({ staff_id }) })
    const d = await r.json()
    setBusy(b => ({ ...b, [staff_id]: false }))
    if (d.error) return alert(d.error)
    setRevealed({ username: d.username, pin: d.pin, isReset: false })
    load()
  }

  async function resetPin(s) {
    setPinResetConfirm({ id: s.credential_id, name: s.full_name })
  }

  async function handleConfirmResetPin() {
    if (!pinResetConfirm) return
    const credential_id = pinResetConfirm.id
    setPinResetConfirm(null)
    setBusy(b => ({ ...b, [credential_id]: true }))
    const r = await apiFetch(`${API_URL}/credentials/${credential_id}/reset`, { method: 'POST' })
    const d = await r.json()
    setBusy(b => ({ ...b, [credential_id]: false }))
    if (d.error) return alert(d.error)
    const row = staff.find(s => s.credential_id === credential_id)
    setRevealed({ username: row?.username, pin: d.pin, isReset: true })
    load()
  }

  async function toggleAccess(credential_id) {
    setBusy(b => ({ ...b, [credential_id]: true }))
    await apiFetch(`${API_URL}/credentials/${credential_id}/toggle`, { method: 'PUT' })
    setBusy(b => ({ ...b, [credential_id]: false }))
    load()
  }

  async function removeCredentials(credential_id, name) {
    if (!confirm(`Remove login access for ${name}?`)) return
    setBusy(b => ({ ...b, [credential_id]: true }))
    await apiFetch(`${API_URL}/credentials/${credential_id}`, { method: 'DELETE' })
    setBusy(b => ({ ...b, [credential_id]: false }))
    load()
  }

  const columns = React.useMemo(() => [
    { 
      key: 'staff', 
      label: 'Staff', 
      render: s => (
        <div>
          <div className="cp-name" style={{ fontSize: '0.85rem' }}>{s.full_name}</div>
          <div className="cp-code" style={{ fontSize: '0.72rem' }}>{s.staff_code}</div>
        </div>
      ) 
    },
    { 
      key: 'role', 
      label: 'Role', 
      render: s => roleBadge(s.role) 
    },
    { 
      key: 'username', 
      label: 'Username', 
      render: s => (
        s.credential_id
          ? <span className="cp-username" style={{ fontSize: '0.85rem' }}>{s.username}</span>
          : <span className="cp-no-access" style={{ fontSize: '0.78rem' }}>No access</span>
      ) 
    },
    { 
      key: 'roles', 
      label: 'System Roles', 
      render: s => (
        s.credential_id && (s.system_roles || []).length > 0
          ? <div style={{ display:'flex', gap:'0.3rem', flexWrap:'wrap' }}>
              {(s.system_roles || []).map(r => (
                <span key={r} style={{ background: r==='owner'?'rgba(249,115,22,0.15)':'rgba(139,92,246,0.15)',
                  color: r==='owner'?'var(--th-orange)':'var(--th-violet,#a78bfa)',
                  padding:'0.15rem 0.45rem', borderRadius:4, fontSize:'0.7rem', fontWeight:700, textTransform:'uppercase' }}>
                  {r}
                </span>
              ))}
            </div>
          : <span className="cp-no-access" style={{ fontSize: '0.78rem' }}>—</span>
      ) 
    },
    { 
      key: 'status', 
      label: 'Status', 
      render: s => {
        if (!s.credential_id) return <span className="cp-badge inactive" style={{ fontSize: '0.72rem' }}>No access</span>
        if (s.must_change_pin) return <span className="cp-badge pending" style={{ fontSize: '0.72rem' }}>PIN not changed</span>
        if (s.is_active) return <span className="cp-badge active" style={{ fontSize: '0.72rem' }}>Active</span>
        return <span className="cp-badge inactive" style={{ fontSize: '0.72rem' }}>Disabled</span>
      } 
    },
    { 
      key: 'actions', 
      label: 'Actions', 
      render: s => {
        const hasAccess = !!s.credential_id
        const isBusy = busy[s.credential_id || s.staff_id]
        
        if (!hasAccess) {
          return (
            <div className="cp-actions">
              <button className="cp-btn create" disabled={isBusy}
                onClick={() => createCredentials(s.staff_id)}>
                {isBusy ? '…' : '+ Create Access'}
              </button>
            </div>
          )
        }

        const targetPower = computePower(s.system_roles || [])
        const canManage = callerPower > targetPower || targetPower === 0
        const isOwnerLevel = targetPower >= 80
        const isSelf = s.staff_id === localStorage.getItem('th-staff-id')

        return (
          <div className="cp-actions">
            {!isSelf && canManage && grantableRoles(callerPower).length > 0 && (
              <button className="cp-btn roles" disabled={isBusy}
                onClick={() => setManagingRoles(s)}>
                Roles
              </button>
            )}
            {canManage && !isOwnerLevel && (
              <button className="cp-btn pages" disabled={isBusy}
                onClick={() => setManagingPages(s)}>
                Pages
              </button>
            )}
            <button className="cp-btn reset" disabled={isBusy}
              onClick={() => resetPin(s)}>
              {isBusy ? '…' : '↺ Reset PIN'}
            </button>
            <button className={`cp-btn ${s.is_active ? 'toggle-off' : 'toggle-on'}`}
              disabled={isBusy} onClick={() => toggleAccess(s.credential_id)}>
              {isBusy ? '…' : s.is_active ? 'Disable' : 'Enable'}
            </button>
            <button className="cp-btn remove" disabled={isBusy}
              onClick={() => removeCredentials(s.credential_id, s.full_name)}>
              Remove
            </button>
          </div>
        )
      } 
    }
  ], [busy, callerPower])

  return (
    <>
      <div className="cp-table-wrap">
        <DataTable 
          columns={columns}
          rows={staff}
          rowKey="staff_id"
          loading={loading}
          mobileLayout="scroll"
          minWidth={900}
          emptyTitle="No Staff Found"
          emptyMessage="No staff records are available in the system."
        />
      </div>

      {managingRoles && (
        <ManageRolesModal
          staff={managingRoles}
          callerPower={callerPower}
          onClose={() => setManagingRoles(null)}
          onSaved={(roles) => {
            setStaff(prev => prev.map(s => s.credential_id === managingRoles.credential_id ? { ...s, system_roles: roles } : s))
            setManagingRoles(null)
          }}
        />
      )}

      {managingPages && (
        <ManagePagesModal
          staff={managingPages}
          onClose={() => setManagingPages(null)}
          onSaved={(pages) => {
            setStaff(prev => prev.map(s => s.credential_id === managingPages.credential_id ? { ...s, allowed_pages: pages } : s))
            setManagingPages(null)
          }}
        />
      )}

      {revealed && (
        <div className="cp-overlay" onClick={() => setRevealed(null)}>
          <div className="cp-modal" onClick={e => e.stopPropagation()}>
            <div className="cp-modal-title">{revealed.isReset ? 'PIN Reset' : 'Access Created'}</div>
            <div className="cp-modal-sub">Share these credentials privately with the staff member.</div>
            <div className="cp-user-box" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <div className="cp-pin-label" style={{ marginBottom: 0 }}>Username</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {userCopied && <span style={{ fontSize: '0.65rem', color: 'var(--th-sky)', fontWeight: 700, animation: 'cpIn 0.2s' }}>COPIED!</span>}
                  <button 
                    title="Copy Username"
                    onClick={() => {
                      copyToClipboard(revealed.username)
                      setUserCopied(true)
                      setTimeout(() => setUserCopied(false), 2000)
                    }}
                    style={{
                      background: 'none', border: 'none', color: 'var(--th-text-faint)',
                      cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center',
                      transition: 'color 0.15s', lineHeight: 1
                    }}
                    onMouseOver={e => e.currentTarget.style.color = 'var(--th-sky)'}
                    onMouseOut={e => e.currentTarget.style.color = 'var(--th-text-faint)'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
              </div>
              <div className="cp-user-value">{revealed.username}</div>
            </div>
            <div className="cp-pin-box" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <div className="cp-pin-label" style={{ marginBottom: 0 }}>Temporary PIN</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {copied && <span style={{ fontSize: '0.65rem', color: 'var(--th-orange)', fontWeight: 700, animation: 'cpIn 0.2s' }}>COPIED!</span>}
                  <button 
                    title="Copy PIN"
                    onClick={() => {
                      copyToClipboard(revealed.pin)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                    style={{
                      background: 'none', border: 'none', color: 'var(--th-text-faint)',
                      cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center',
                      transition: 'color 0.15s', lineHeight: 1
                    }}
                    onMouseOver={e => e.currentTarget.style.color = 'var(--th-orange)'}
                    onMouseOut={e => e.currentTarget.style.color = 'var(--th-text-faint)'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
              </div>
              <div className="cp-pin-value">{revealed.pin}</div>
            </div>
            <div className="cp-modal-note">
              ⚠ Staff will be prompted to change this PIN on first login.
            </div>
            <button className="cp-modal-ok" onClick={() => setRevealed(null)}>Got it</button>
          </div>
        </div>
      )}
      {pinResetConfirm && (
        <div className="cp-overlay" onClick={() => setPinResetConfirm(null)}>
          <div className="cp-modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="cp-modal-title" style={{ color: 'var(--th-amber)' }}>
              Reset PIN?
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div className="cp-modal-sub" style={{ marginBottom: '1.5rem' }}>
              Are you sure you want to reset the login PIN for <b>{pinResetConfirm.name}</b>?
              <div style={{ marginTop: '0.5rem', color: 'var(--th-text-muted)', fontSize: '0.78rem' }}>
                A new temporary PIN will be generated.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="cp-pages-cancel" style={{ flex: 1 }} onClick={() => setPinResetConfirm(null)}>Cancel</button>
              <button className="cp-modal-ok" style={{ flex: 1, background: 'var(--th-amber)' }} onClick={handleConfirmResetPin}>
                Yes, Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ── Import / Export Tab ── */
function ImportExportTab() {
  const [exporting, setExporting]   = React.useState(false)
  const [importing, setImporting]   = React.useState(false)
  const [file, setFile]             = React.useState(null)
  const [results, setResults]       = React.useState(null)
  const [importError, setImportError] = React.useState('')
  const [over, setOver]             = React.useState(false)
  const fileRef = React.useRef()

  async function handleExport() {
    setExporting(true)
    try {
      const token = localStorage.getItem('th-token')
      const res = await fetch(`${API_URL}/backup/download`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `CoreTrack_${new Date().toISOString().slice(0,10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Export failed: ' + e.message)
    } finally {
      setExporting(false)
    }
  }

  async function handleImport() {
    if (!file) return
    setImporting(true)
    setResults(null)
    setImportError('')
    try {
      const token = localStorage.getItem('th-token')
      const form  = new FormData()
      form.append('file', file)
      const res = await fetch(`${API_URL}/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const d = await res.json()
      if (d.error) { setImportError(d.error); return }
      setResults(d.results)
      setFile(null)
    } catch (e) {
      setImportError(e.message)
    } finally {
      setImporting(false)
    }
  }

  function onDrop(e) {
    e.preventDefault(); setOver(false)
    const f = e.dataTransfer.files[0]
    if (f && f.name.endsWith('.xlsx')) { setFile(f); setResults(null); setImportError('') }
    else alert('Please drop an .xlsx file')
  }

  return (
    <div className="cp-io-grid">
      {/* Export */}
      <div className="cp-io-card">
        <div className="cp-io-card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export Database
        </div>
        <div className="cp-io-card-sub">
          Download the entire database as an Excel file. All tables are included with their current data.
        </div>
        <button className="cp-io-btn export" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Download .xlsx'}
        </button>
      </div>

      {/* Import */}
      <div className="cp-io-card">
        <div className="cp-io-card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Import Database
        </div>
        <div className="cp-io-card-sub">
          Upload an .xlsx file to replace database contents. <strong style={{ color: 'var(--th-rose)' }}>This will overwrite existing data.</strong>
        </div>

        <div
          className={`cp-file-drop${over ? ' over' : ''}`}
          onClick={() => fileRef.current.click()}
          onDragOver={e => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          {file
            ? <><div>✓ Ready to import</div><div className="cp-file-name">{file.name}</div></>
            : <div>Drop .xlsx here or click to browse</div>}
        </div>
        <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files[0]; if (f) { setFile(f); setResults(null); setImportError('') } }} />

        {importError && <div style={{ color: 'var(--th-rose)', fontSize: '0.82rem' }}>{importError}</div>}

        <button className="cp-io-btn import" onClick={handleImport} disabled={!file || importing}>
          {importing ? 'Importing…' : 'Import File'}
        </button>

        {results && (
          <div className="cp-import-results">
            {results.map(r => (
              <div key={r.table} className="cp-result-row">
                <span style={{ color: 'var(--th-text-muted)' }}>{r.table}</span>
                <span className={r.status === 'ok' ? 'cp-result-ok' : r.status === 'cleared' ? 'cp-result-clear' : 'cp-result-skip'}>
                  {r.status === 'ok' ? `✓ ${r.count} rows` : r.status === 'cleared' ? '— cleared' : '– skipped'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Bulk Import Tab ── */
function BulkImportTab({ shopId }) {
  // ─── Standard inventory import state ───
  const [file, setFile] = React.useState(null)
  const [status, setStatus] = React.useState('idle') // idle | preview | processing | success | partial | error
  const [msg, setMsg] = React.useState('')
  const [dragOver, setDragOver] = React.useState(false)
  const [results, setResults] = React.useState(null)
  const [previewRows, setPreviewRows] = React.useState([])
  const fileInputRef = React.useRef()

  // ─── Recap jobs import state ───
  const [recapFile, setRecapFile] = React.useState(null)
  const [recapStatus, setRecapStatus] = React.useState('idle')
  const [recapMsg, setRecapMsg] = React.useState('')
  const [recapDragOver, setRecapDragOver] = React.useState(false)
  const [recapResults, setRecapResults] = React.useState(null)
  const [recapPreviewRows, setRecapPreviewRows] = React.useState([])
  const recapFileInputRef = React.useRef()

  const REQUIRED_HEADERS = ['category', 'brand', 'design', 'size', 'dot_number', 'quantity', 'unit_cost', 'selling_price']
  const RECAP_REQUIRED_HEADERS = ['brand', 'size', 'ownership']

  function generateSKU(category, brand, design, size, dot) {
    const isTire = ['PCR','SUV','TBR','LT','MOTORCYCLE','TUBE','RECAP','TIRE'].includes((category || '').toUpperCase())
    const prefix = isTire ? 'TIRE' : 'ITEM'
    const b = (brand || '').toString().trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    const d = (design || '').toString().trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    const s = (size || '').toString().trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    let sku = prefix + '-' + [b, d, s].filter(Boolean).join('-')
    if (dot && dot.toString().trim()) {
      sku += '-DOT' + dot.toString().trim().toUpperCase()
    }
    return sku
  }

  function extractRimSize(size) {
    const m = (size || '').match(/R(\d+(?:\.\d+)?)/)
    return m ? parseFloat(m[1]) : null
  }

  function downloadTemplate() {
    const data = [
      { category: 'PCR',   brand: 'Sailun',   design: 'Atrezzo', size: '185/70R14', dot_number: '1224', quantity: 10, unit_cost: 1850, selling_price: 2500, reorder_point: 5, supplier_id: '' },
      { category: 'SUV',   brand: 'Goodyear', design: 'Wrangler',size: '265/70R17', dot_number: '0824', quantity: 4,  unit_cost: 4500, selling_price: 6800, reorder_point: 5, supplier_id: '' },
      { category: 'VALVE', brand: '',         design: '',         size: '',          dot_number: '',     quantity: 50, unit_cost: 12,   selling_price: 25,   reorder_point: 20,supplier_id: '' },
    ]
    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'InventoryBasis')
      XLSX.writeFile(wb, 'CoreTrack_Bulk_Inventory_Basis.xlsx')
    })
  }

  function downloadRecapJobsTemplate() {
    const data = [
      { Brand: 'Goodyear', Design: 'Topcap', Size: '700-15', Description: 'Goodyear Topcap 700-15', Ownership: 'SHOP_OWNED', Status: 'READY_FOR_CLAIM', Customer: '', Supplier: '', 'Recap Cost (₱)': 1600, 'Selling Price (₱)': 2100, 'Intake Date': '2026-01-15', DOT: '' },
      { Brand: 'Bridgestone', Design: 'Topcap', Size: '295/80R22.5', Description: 'Bridgestone Topcap 295/80R22.5', Ownership: 'CUSTOMER_OWNED', Status: 'READY_FOR_CLAIM', Customer: 'Juan dela Cruz', Supplier: '', 'Recap Cost (₱)': 3200, 'Selling Price (₱)': 4500, 'Intake Date': '2026-02-10', DOT: '1224' },
    ]
    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'RecapJobs')
      XLSX.writeFile(wb, 'CoreTrack_Recap_Jobs_Import.xlsx')
    })
  }

  async function handleBulkImport(rows) {
    if (!shopId) {
      setStatus('error')
      setMsg('No shop selected. Please select a shop from the sidebar first.')
      return
    }
    setStatus('processing')
    setResults(null)

    const token = localStorage.getItem('th-token')
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

    setMsg(`Preparing ${rows.length} items for bulk import...`)

    const payloadItems = rows.map((row, i) => {
      const isTire = ['PCR','SUV','TBR','LT','MOTORCYCLE','TUBE','RECAP','TIRE'].includes((row.category || '').toUpperCase())
      const cat       = (row.category || '').toUpperCase()
      const brand     = (row.brand    || '').toString().trim()
      const design    = (row.design   || '').toString().trim()
      const size      = (row.size     || '').toString().trim()
      const dot       = (row.dot_number || '').toString().trim()
      
      // Force DOT into SKU for tires if it's missing to prevent unique constraint failures
      let sku = row.sku || generateSKU(cat, brand, design, size, dot) || `ITEM-${Date.now()}-${i}`
      if (isTire && dot && !sku.includes(dot)) {
        sku = sku.split('-DOT')[0] + '-DOT' + dot.toUpperCase()
      }

      const item_name = row.item_name || [brand, design, size].filter(Boolean).join(' ') || sku
      const rim_size  = isTire ? (row.rim_size != null ? parseFloat(row.rim_size) : extractRimSize(size)) : null

      return {
        sku,
        item_name,
        category:      (row.category || '').toUpperCase(),
        brand:         brand || null,
        design:        design || null,
        size:          size || null,
        rim_size:      rim_size || null,
        dot_number:    (row.dot_number || '').toString().trim() || null,
        unit_cost:     parseFloat(row.unit_cost) || 0,
        selling_price: parseFloat(row.selling_price) || 0,
        reorder_point: parseInt(row.reorder_point) || 5,
        supplier_id:   row.supplier_id || null,
        quantity:      parseInt(row.quantity) || 0,
      }
    })

    setMsg(`Sending bulk request to server...`)

    try {
      const res = await fetch(`${API_URL}/items-bulk`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ shop_id: shopId, items: payloadItems })
      })
      const data = await res.json()

      if (data.error) throw new Error(data.error)

      const successCount = data.results ? data.results.length : 0;
      const errorCount = data.errors ? data.errors.length : 0;

      setResults({ success: successCount, failed: errorCount, errors: data.errors || [] })
      setStatus(errorCount === 0 ? 'success' : successCount > 0 ? 'partial' : 'error')
      setMsg(errorCount === 0
        ? `All ${successCount} items imported successfully.`
        : `${successCount} imported, ${errorCount} failed. Check errors.`)
      
      if (errorCount === 0) setFile(null)
    } catch (err) {
      setResults({ success: 0, failed: rows.length, errors: [{ sku: 'ALL', error: err.message }] })
      setStatus('error')
      setMsg(err.message || 'Network error during bulk import')
    }
  }

  function processRecapFile(f) {
    if (!f) return
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) {
      setRecapStatus('error'); setRecapMsg('Invalid file type. Please upload .xlsx, .xls, or .csv'); return
    }
    setRecapFile(f); setRecapStatus('processing'); setRecapMsg('Reading file…'); setRecapResults(null); setRecapPreviewRows([])
    const reader = new FileReader()
    reader.onload = (e) => {
      import('xlsx').then(XLSX => {
        try {
          const wb   = XLSX.read(e.target.result, { type: 'binary' })
          const ws   = wb.Sheets[wb.SheetNames[0]]
          const data = XLSX.utils.sheet_to_json(ws)
          if (data.length === 0) throw new Error('File is empty.')
          const fileHeaders = Object.keys(data[0]).map(h => h.toLowerCase().trim())
          const missing = RECAP_REQUIRED_HEADERS.filter(h => !fileHeaders.includes(h))
          if (missing.length > 0) throw new Error(`Missing required columns: ${missing.join(', ')}`)
          setRecapPreviewRows(data)
          setRecapStatus('preview')
          setRecapMsg('')
        } catch (err) { setRecapStatus('error'); setRecapMsg(err.message) }
      })
    }
    reader.readAsBinaryString(f)
  }

  async function handleRecapJobsImport(rows) {
    if (!shopId) { setRecapStatus('error'); setRecapMsg('No shop selected.'); return }
    setRecapStatus('processing'); setRecapResults(null)
    setRecapMsg(`Preparing ${rows.length} recap jobs…`)
    const token = localStorage.getItem('th-token')
    const mappedJobs = rows.map(r => ({
      brand: r['Brand'] || r['brand'],
      design: r['Design'] || r['design'] || 'TOPCAP',
      size: String(r['Size'] || r['size'] || ''),
      description: r['Description'] || r['description'],
      ownership: r['Ownership'] || r['ownership'] || 'SHOP_OWNED',
      status: r['Status'] || r['status'] || 'READY_FOR_CLAIM',
      customer: r['Customer'] || r['customer'],
      supplier: r['Supplier'] || r['supplier'],
      recap_cost: r['Recap Cost (₱)'] ?? r['recap_cost'],
      selling_price: r['Selling Price (₱)'] ?? r['selling_price'],
      intake_date: r['Intake Date'] || r['intake_date'],
      dot_number: r['DOT'] || r['dot_number'],
    }))
    try {
      const res = await fetch(`${API_URL}/recap-jobs-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ shop_id: shopId, jobs: mappedJobs })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const successCount = data.results?.length || 0
      const errorCount = data.errors?.length || 0
      setRecapResults({ success: successCount, failed: errorCount, errors: data.errors || [] })
      setRecapStatus(errorCount === 0 ? 'success' : successCount > 0 ? 'partial' : 'error')
      setRecapMsg(errorCount === 0
        ? `All ${successCount} recap jobs imported successfully.`
        : `${successCount} imported, ${errorCount} failed.`)
      if (errorCount === 0) setRecapFile(null)
    } catch (err) {
      setRecapResults({ success: 0, failed: rows.length, errors: [{ index: 0, error: err.message }] })
      setRecapStatus('error')
      setRecapMsg(err.message || 'Network error during recap import')
    }
  }

  function cancelRecapPreview() {
    setRecapStatus('idle'); setRecapPreviewRows([]); setRecapFile(null); setRecapResults(null); setRecapMsg('')
    if (recapFileInputRef.current) recapFileInputRef.current.value = ''
  }

  function processFile(f) {
    if (!f) return
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) {
      setStatus('error'); setMsg('Invalid file type. Please upload .xlsx, .xls, or .csv'); return
    }
    setFile(f); setStatus('processing'); setMsg('Reading file\u2026'); setResults(null); setPreviewRows([])
    const reader = new FileReader()
    reader.onload = (e) => {
      import('xlsx').then(XLSX => {
        try {
          const wb   = XLSX.read(e.target.result, { type: 'binary' })
          const ws   = wb.Sheets[wb.SheetNames[0]]
          const data = XLSX.utils.sheet_to_json(ws)
          if (data.length === 0) throw new Error('File is empty.')
          const fileHeaders = Object.keys(data[0]).map(h => h.toLowerCase().trim())
          const missing = REQUIRED_HEADERS.filter(h => !fileHeaders.includes(h))
          if (missing.length > 0) throw new Error(`Missing required columns: ${missing.join(', ')}`)
          const normalized = data.map(row => {
            const entry = {}
            Object.keys(row).forEach(k => { entry[k.toLowerCase().trim().replace(/ /g, '_')] = row[k] })
            return entry
          })
          // Show preview — do NOT import yet
          setPreviewRows(normalized)
          setStatus('preview')
          setMsg('')
        } catch (err) { setStatus('error'); setMsg(err.message) }
      })
    }
    reader.readAsBinaryString(f)
  }

  function cancelPreview() {
    setStatus('idle'); setPreviewRows([]); setFile(null); setResults(null); setMsg('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const statusColor = { success: 'var(--th-emerald)', partial: 'var(--th-amber)', error: 'var(--th-rose)' }
  const statusBg    = { success: 'var(--th-emerald-bg)', partial: 'var(--th-amber-bg)', error: 'var(--th-rose-bg)' }
  const rcStatusColor = statusColor
  const rcStatusBg    = statusBg

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="cp-io-card">
        <div className="cp-io-card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          Master Bulk Inventory Import
        </div>
        <div className="cp-io-card-sub">
          Populate your inventory by uploading a master list. The system will create each item and seed its initial stock.
          {!shopId && <div style={{ color: 'var(--th-rose)', fontWeight: 700, marginTop: '0.5rem' }}>&#x26A0; No shop selected — select a shop from the sidebar first.</div>}
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button onClick={downloadTemplate} style={{ background: 'var(--th-sky-bg)', color: 'var(--th-sky)', border: '1px solid var(--th-sky)', padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download Standard Template
          </button>
        </div>


        <div style={{ background: 'var(--th-bg-card)', border: '1px solid var(--th-border)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.75rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.4rem', color: 'var(--th-text-body)' }}>Required columns</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {REQUIRED_HEADERS.map(h => <span key={h} style={{ background: 'var(--th-rose-bg)', color: 'var(--th-rose)', padding: '2px 7px', borderRadius: 4, fontFamily: 'monospace' }}>{h}</span>)}
          </div>
          <div style={{ fontWeight: 700, marginBottom: '0.4rem', marginTop: '0.6rem', color: 'var(--th-text-body)' }}>Optional columns</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {['sku', 'item_name', 'rim_size', 'reorder_point', 'supplier_id'].map(h => <span key={h} style={{ background: 'var(--th-sky-bg)', color: 'var(--th-sky)', padding: '2px 7px', borderRadius: 4, fontFamily: 'monospace' }}>{h}</span>)}
          </div>
          <div style={{ color: 'var(--th-text-faint)', marginTop: '0.5rem', fontSize: '0.7rem' }}>
            <b>sku</b> and <b>item_name</b> auto-generated from brand+design+size if omitted. <b>dot_number</b> required for tire categories. <b>supplier_id</b> must be an existing Supplier ID.
          </div>
        </div>

        {/* ── Preview panel ── */}
        {status === 'preview' && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--th-text-body)' }}>
                Preview — <span style={{ color: 'var(--th-sky)' }}>{previewRows.length} rows</span> from <span style={{ color: 'var(--th-text-muted)' }}>{file?.name}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={cancelPreview} style={{ background: 'var(--th-bg-card)', color: 'var(--th-text-muted)', border: '1px solid var(--th-border)', padding: '0.4rem 0.9rem', borderRadius: 7, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button
                  onClick={() => handleBulkImport(previewRows)}
                  disabled={!shopId}
                  style={{ background: shopId ? 'var(--th-emerald)' : 'var(--th-bg-card)', color: shopId ? '#fff' : 'var(--th-text-faint)', border: 'none', padding: '0.4rem 1.1rem', borderRadius: 7, fontSize: '0.78rem', fontWeight: 700, cursor: shopId ? 'pointer' : 'not-allowed' }}
                >
                  Confirm &amp; Import
                </button>
              </div>
            </div>
            <div style={{ overflowX: 'auto', border: '1px solid var(--th-border)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.73rem' }}>
                <thead>
                  <tr style={{ background: 'var(--th-bg-subtle)', borderBottom: '1px solid var(--th-border)' }}>
                    {['#', 'Category', 'Brand', 'Design', 'Size', 'DOT', 'Qty', 'Unit Cost', 'Selling Price', 'Reorder Pt', 'Supplier ID'].map(h => (
                      <th key={h} style={{ padding: '0.45rem 0.6rem', textAlign: 'left', color: 'var(--th-text-muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => {
                    const missingFields = REQUIRED_HEADERS.filter(h => row[h] == null || row[h] === '')
                    const hasWarning = missingFields.length > 0
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--th-border)', background: hasWarning ? 'var(--th-rose-bg)' : i % 2 === 0 ? 'transparent' : 'var(--th-bg-subtle)' }}>
                        <td style={{ padding: '0.35rem 0.6rem', color: 'var(--th-text-faint)' }}>{i + 1}</td>
                        <td style={{ padding: '0.35rem 0.6rem', fontWeight: 700, color: 'var(--th-sky)' }}>{row.category || <span style={{ color: 'var(--th-rose)' }}>—</span>}</td>
                        <td style={{ padding: '0.35rem 0.6rem' }}>{row.brand || '—'}</td>
                        <td style={{ padding: '0.35rem 0.6rem' }}>{row.design || '—'}</td>
                        <td style={{ padding: '0.35rem 0.6rem' }}>{row.size || '—'}</td>
                        <td style={{ padding: '0.35rem 0.6rem', fontFamily: 'monospace' }}>{row.dot_number || '—'}</td>
                        <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', fontWeight: 700 }}>{row.quantity ?? '—'}</td>
                        <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', color: 'var(--th-amber)' }}>{row.unit_cost != null ? `\u20B1${Number(row.unit_cost).toLocaleString()}` : <span style={{ color: 'var(--th-rose)' }}>—</span>}</td>
                        <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', color: 'var(--th-emerald)' }}>{row.selling_price != null ? `\u20B1${Number(row.selling_price).toLocaleString()}` : <span style={{ color: 'var(--th-rose)' }}>—</span>}</td>
                        <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', color: 'var(--th-text-faint)' }}>{row.reorder_point ?? 5}</td>
                        <td style={{ padding: '0.35rem 0.6rem', color: 'var(--th-text-faint)', fontFamily: 'monospace', fontSize: '0.68rem' }}>{row.supplier_id || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {previewRows.some(row => REQUIRED_HEADERS.some(h => row[h] == null || row[h] === '')) && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.73rem', color: 'var(--th-rose)' }}>
                &#x26A0; Rows highlighted in red have missing required fields. They will be attempted but may fail.
              </div>
            )}
          </div>
        )}

        {/* ── Drop zone (hidden during preview/processing) ── */}
        {status !== 'preview' && (
        <div
          className={`cp-file-drop${dragOver ? ' over' : ''}${status === 'processing' ? ' disabled' : ''}`}
          onClick={() => status !== 'processing' && fileInputRef.current.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); if (status !== 'processing') processFile(e.dataTransfer.files[0]) }}
        >
          {status === 'processing' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <div className="th-spinner th-spinner-sm" />
              <div>{msg}</div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              {file ? <div>Selected: <strong className="cp-file-name">{file.name}</strong></div> : (
                <>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>&#x1F4C1;</div>
                  <div>Drop Master List here or click to browse</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--th-text-faint)', marginTop: '0.4rem' }}>Supports .XLSX, .XLS, .CSV</div>
                </>
              )}
            </div>
          )}
        </div>
        )}
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => processFile(e.target.files[0])} />

        {status !== 'idle' && status !== 'processing' && status !== 'preview' && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: 8, background: statusBg[status] || statusBg.error, color: statusColor[status] || statusColor.error, fontSize: '0.82rem', fontWeight: 600 }}>
            {msg}
            {results?.errors?.length > 0 && (
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1.2rem', fontWeight: 400 }}>
                {results.errors.slice(0, 10).map((e, i) => <li key={i}><code>{e.sku}</code>: {e.error}</li>)}
                {results.errors.length > 10 && <li>&#x2026;and {results.errors.length - 10} more</li>}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* ── Recap Jobs Import Card ── */}
      <div className="cp-io-card">
        <div className="cp-io-card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
          </svg>
          Bulk Import Recap Jobs
        </div>
        <div className="cp-io-card-sub">
          Import existing recap jobs &mdash; both Customer Owned and Shop Owned. Shop-owned tires marked as IN_INVENTORY or READY_FOR_CLAIM will be automatically pushed to your POS catalog.
          {!shopId && <div style={{ color: 'var(--th-rose)', fontWeight: 700, marginTop: '0.5rem' }}>&#x26A0; No shop selected &mdash; select a shop from the sidebar first.</div>}
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button onClick={downloadRecapJobsTemplate} style={{ background: 'var(--th-orange-bg)', color: 'var(--th-orange)', border: '1px solid var(--th-orange)', padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download Recap Jobs Template
          </button>
        </div>

        <div style={{ background: 'var(--th-bg-card)', border: '1px solid var(--th-border)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.75rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.4rem', color: 'var(--th-text-body)' }}>Required columns</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {['Brand', 'Size', 'Ownership'].map(h => <span key={h} style={{ background: 'var(--th-rose-bg)', color: 'var(--th-rose)', padding: '2px 7px', borderRadius: 4, fontFamily: 'monospace' }}>{h}</span>)}
          </div>
          <div style={{ fontWeight: 700, marginBottom: '0.4rem', marginTop: '0.6rem', color: 'var(--th-text-body)' }}>Optional columns</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {['Design', 'Description', 'Status', 'Customer', 'Supplier', 'Recap Cost (₱)', 'Selling Price (₱)', 'Intake Date', 'DOT'].map(h => <span key={h} style={{ background: 'var(--th-sky-bg)', color: 'var(--th-sky)', padding: '2px 7px', borderRadius: 4, fontFamily: 'monospace' }}>{h}</span>)}
          </div>
          <div style={{ color: 'var(--th-text-faint)', marginTop: '0.5rem', fontSize: '0.7rem' }}>
            <b>Ownership</b> must be <code>SHOP_OWNED</code> or <code>CUSTOMER_OWNED</code>. <b>Customer</b> required for Customer Owned &mdash; auto-created if not found. <b>Status</b> defaults to <code>READY_FOR_CLAIM</code> if omitted.
          </div>
        </div>

        {recapStatus === 'preview' && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--th-text-body)' }}>
                Preview &mdash; <span style={{ color: 'var(--th-orange)' }}>{recapPreviewRows.length} recap jobs</span> from <span style={{ color: 'var(--th-text-muted)' }}>{recapFile?.name}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={cancelRecapPreview} style={{ background: 'var(--th-bg-card)', color: 'var(--th-text-muted)', border: '1px solid var(--th-border)', padding: '0.4rem 0.9rem', borderRadius: 7, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => handleRecapJobsImport(recapPreviewRows)} disabled={!shopId} style={{ background: shopId ? 'var(--th-orange)' : 'var(--th-bg-card)', color: shopId ? '#fff' : 'var(--th-text-faint)', border: 'none', padding: '0.4rem 1.1rem', borderRadius: 7, fontSize: '0.78rem', fontWeight: 700, cursor: shopId ? 'pointer' : 'not-allowed' }}>
                  Confirm &amp; Import
                </button>
              </div>
            </div>
            <div style={{ overflowX: 'auto', border: '1px solid var(--th-border)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.73rem' }}>
                <thead>
                  <tr style={{ background: 'var(--th-bg-subtle)', borderBottom: '1px solid var(--th-border)' }}>
                    {['#', 'Brand', 'Design', 'Size', 'Ownership', 'Status', 'Customer', 'Recap Cost', 'Selling Price'].map(h => (
                      <th key={h} style={{ padding: '0.45rem 0.6rem', textAlign: 'left', color: 'var(--th-text-muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recapPreviewRows.map((row, i) => {
                    const own = (row['Ownership'] || row['ownership'] || '').toString().toUpperCase()
                    const isShop = own === 'SHOP_OWNED'
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--th-border)', background: i % 2 === 0 ? 'transparent' : 'var(--th-bg-subtle)' }}>
                        <td style={{ padding: '0.35rem 0.6rem', color: 'var(--th-text-faint)' }}>{i + 1}</td>
                        <td style={{ padding: '0.35rem 0.6rem', fontWeight: 700 }}>{row['Brand'] || row['brand'] || '—'}</td>
                        <td style={{ padding: '0.35rem 0.6rem' }}>{row['Design'] || row['design'] || '—'}</td>
                        <td style={{ padding: '0.35rem 0.6rem', fontFamily: 'monospace' }}>{row['Size'] || row['size'] || '—'}</td>
                        <td style={{ padding: '0.35rem 0.6rem' }}>
                          <span style={{ background: isShop ? 'var(--th-emerald-bg)' : 'var(--th-sky-bg)', color: isShop ? 'var(--th-emerald)' : 'var(--th-sky)', padding: '1px 6px', borderRadius: 4, fontWeight: 700, fontSize: '0.7rem' }}>
                            {isShop ? '🏬 Shop' : '👤 Customer'}
                          </span>
                        </td>
                        <td style={{ padding: '0.35rem 0.6rem', color: 'var(--th-text-muted)' }}>{row['Status'] || row['status'] || 'READY_FOR_CLAIM'}</td>
                        <td style={{ padding: '0.35rem 0.6rem' }}>{row['Customer'] || row['customer'] || '—'}</td>
                        <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', color: 'var(--th-amber)' }}>{row['Recap Cost (₱)'] != null ? `₱${Number(row['Recap Cost (₱)']).toLocaleString()}` : '—'}</td>
                        <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', color: 'var(--th-emerald)' }}>{row['Selling Price (₱)'] != null ? `₱${Number(row['Selling Price (₱)']).toLocaleString()}` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {recapStatus !== 'preview' && (
          <div
            className={`cp-file-drop${recapDragOver ? ' over' : ''}${recapStatus === 'processing' ? ' disabled' : ''}`}
            onClick={() => recapStatus !== 'processing' && recapFileInputRef.current.click()}
            onDragOver={e => { e.preventDefault(); setRecapDragOver(true) }}
            onDragLeave={() => setRecapDragOver(false)}
            onDrop={e => { e.preventDefault(); setRecapDragOver(false); if (recapStatus !== 'processing') processRecapFile(e.dataTransfer.files[0]) }}
          >
            {recapStatus === 'processing' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <div className="th-spinner th-spinner-sm" />
                <div>{recapMsg}</div>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                {recapFile ? <div>Selected: <strong className="cp-file-name">{recapFile.name}</strong></div> : (
                  <>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>&#x267B;&#xFE0F;</div>
                    <div>Drop Recap Jobs file here or click to browse</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--th-text-faint)', marginTop: '0.4rem' }}>Supports .XLSX, .XLS, .CSV</div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        <input ref={recapFileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => processRecapFile(e.target.files[0])} />

        {recapStatus !== 'idle' && recapStatus !== 'processing' && recapStatus !== 'preview' && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: 8, background: rcStatusBg[recapStatus] || rcStatusBg.error, color: rcStatusColor[recapStatus] || rcStatusColor.error, fontSize: '0.82rem', fontWeight: 600 }}>
            {recapMsg}
            {recapResults?.errors?.length > 0 && (
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1.2rem', fontWeight: 400 }}>
                {recapResults.errors.slice(0, 10).map((e, i) => <li key={i}><code>Row {e.index + 1}</code>: {e.error}</li>)}
                {recapResults.errors.length > 10 && <li>&#x2026;and {recapResults.errors.length - 10} more</li>}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
/* ── Brand Logos Tab ── */
function BrandLogosTab({ shopId }) {
  const [brands, setBrands] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState({});
  const [removing, setRemoving]   = React.useState({});
  const [errors, setErrors]       = React.useState({});

  function load() {
    setLoading(true)
    apiFetch(`${API_URL}/brands${shopId ? `?shop_id=${shopId}` : ''}`)
      .then(r => r.json())
      .then(data => { setBrands(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  React.useEffect(() => { load() }, [shopId])

  async function handleLogoUpload(brandName, file) {
    if (!file) return
    setUploading(p => ({ ...p, [brandName]: true }))
    setErrors(p => ({ ...p, [brandName]: null }))

    const formData = new FormData()
    formData.append('brand', brandName)
    if (shopId) formData.append('shop_id', shopId)
    formData.append('logo', file)

    try {
      const token = localStorage.getItem('th-token')
      const res = await fetch(`${API_URL}/brands/upload-logo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setBrands(prev => prev.map(b =>
        b.brandName === brandName ? { ...b, logoUrl: data.logoUrl } : b
      ))
    } catch (err) {
      setErrors(p => ({ ...p, [brandName]: err.message }))
    } finally {
      setUploading(p => ({ ...p, [brandName]: false }))
    }
  }

  async function handleRemoveLogo(brandName) {
    if (!confirm(`Remove logo for ${brandName}?`)) return
    setRemoving(p => ({ ...p, [brandName]: true }))
    try {
      const token = localStorage.getItem('th-token')
      await fetch(`${API_URL}/brands/logo?brand=${encodeURIComponent(brandName)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setBrands(prev => prev.map(b =>
        b.brandName === brandName ? { ...b, logoUrl: null } : b
      ))
    } catch (_) {}
    finally { setRemoving(p => ({ ...p, [brandName]: false })) }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '3rem', color: 'var(--th-text-faint)', fontSize: '0.85rem' }}>
      <div className="th-spinner th-spinner-sm" />Loading brands…
    </div>
  )

  if (brands.length === 0) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--th-text-faint)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🏷️</div>
      <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.4rem' }}>No brands found</div>
      <div style={{ fontSize: '0.78rem' }}>Add inventory items with a brand name to manage logos here.</div>
    </div>
  )

  const withLogo    = brands.filter(b => b.logoUrl)
  const withoutLogo = brands.filter(b => !b.logoUrl)

  function renderBrandCard(brand) {
    const { brandName, logoUrl } = brand
    const isUploading = !!uploading[brandName]
    const isRemoving  = !!removing[brandName]
    const err         = errors[brandName]
    const inputId     = `logo-upload-${brandName.replace(/\s+/g, '-')}`

    return (
      <div key={brandName} className="cp-brand-card">
        {/* Logo preview */}
        <div className="cp-brand-preview">
          {logoUrl ? (
            <img
              src={logoUrl.startsWith('http') ? logoUrl : logoUrl}
              alt={brandName}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ fontSize: '1.75rem', opacity: 0.3 }}>🏷️</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--th-text-faint)' }}>No logo</span>
            </div>
          )}
        </div>

        {/* Brand name */}
        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--th-text-primary)', textAlign: 'center', wordBreak: 'break-word' }}>
          {brandName}
        </div>

        {/* Error */}
        {err && <div style={{ fontSize: '0.7rem', color: 'var(--th-rose)', textAlign: 'center' }}>{err}</div>}

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <input
            type="file"
            accept="image/*"
            id={inputId}
            style={{ display: 'none' }}
            onChange={e => handleLogoUpload(brandName, e.target.files[0])}
            disabled={isUploading}
          />
          <label
            htmlFor={inputId}
            style={{
              display: 'block', textAlign: 'center', cursor: isUploading ? 'not-allowed' : 'pointer',
              padding: '0.4rem 0.75rem', borderRadius: 7, fontSize: '0.78rem', fontWeight: 700,
              border: '1px solid var(--th-orange)', color: isUploading ? 'var(--th-text-faint)' : 'var(--th-orange)',
              background: isUploading ? 'var(--th-bg-subtle)' : 'var(--th-orange-bg)',
              transition: 'all 0.15s',
            }}
          >
            {isUploading ? 'Uploading…' : logoUrl ? '🔄 Update Logo' : '⬆ Upload Logo'}
          </label>

          {logoUrl && (
            <button
              onClick={() => handleRemoveLogo(brandName)}
              disabled={isRemoving}
              style={{
                padding: '0.35rem 0.75rem', borderRadius: 7, fontSize: '0.75rem', fontWeight: 600,
                border: '1px solid var(--th-border)', color: 'var(--th-text-faint)',
                background: 'none', cursor: isRemoving ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
              }}
              onMouseOver={e => { e.currentTarget.style.color = 'var(--th-rose)'; e.currentTarget.style.borderColor = 'var(--th-rose)' }}
              onMouseOut={e => { e.currentTarget.style.color = 'var(--th-text-faint)'; e.currentTarget.style.borderColor = 'var(--th-border)' }}
            >
              {isRemoving ? 'Removing…' : '🗑 Remove'}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '0.25rem 0' }}>
      {/* Info banner */}
      <div style={{
        background: 'var(--th-sky-bg)', border: '1px solid var(--th-sky)', borderRadius: 10,
        padding: '0.75rem 1rem', marginBottom: '1.5rem', fontSize: '0.8rem', color: 'var(--th-sky)',
        display: 'flex', alignItems: 'flex-start', gap: '0.6rem'
      }}>
        <span style={{ fontSize: '1rem', flexShrink: 0 }}>💡</span>
        <div>
          <strong>Brand Backdrops:</strong> Uploaded logos appear as a faint watermark behind product cards on the POS page, making it easier for cashiers to identify products at a glance. Recommended format: PNG with transparent background.
        </div>
      </div>

      {/* Brands WITH logos */}
      {withLogo.length > 0 && (
        <>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--th-text-faint)', marginBottom: '0.75rem' }}>
            ✓ Brands with logos ({withLogo.length})
          </div>
          <div className="cp-brands-grid" style={{ marginBottom: '2rem' }}>
            {withLogo.map(renderBrandCard)}
          </div>
        </>
      )}

      {/* Brands WITHOUT logos */}
      {withoutLogo.length > 0 && (
        <>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--th-text-faint)', marginBottom: '0.75rem' }}>
            Brands without logos ({withoutLogo.length})
          </div>
          <div className="cp-brands-grid">
            {withoutLogo.map(renderBrandCard)}
          </div>
        </>
      )}
    </div>
  )
}

/* ── Main Page ── */
export default function ControlPanelPage({ callerPower = 0, callerSystemRoles = [], shopId }) {
  const [tab, setTab] = React.useState('access')
  // Effective power: take max of prop and localStorage (for page refreshes)
  const effectivePower = Math.max(callerPower, Number(localStorage.getItem('th-power') || '0'))

  return (
    <div className="cp-page">
      <div className="cp-header">
        <div className="cp-title">Control <span>Panel</span></div>
      </div>

      <div className="cp-tabs">
        <button className={`cp-tab${tab === 'access' ? ' active' : ''}`} onClick={() => setTab('access')}>
          Staff Access
        </button>
        <button className={`cp-tab${tab === 'io' ? ' active' : ''}`} onClick={() => setTab('io')}>
          Database Master I/O
        </button>
        <button className={`cp-tab${tab === 'bulk' ? ' active' : ''}`} onClick={() => setTab('bulk')}>
          Bulk Inventory
        </button>
        <button className={`cp-tab${tab === 'brands' ? ' active' : ''}`} onClick={() => setTab('brands')}>
          Brand Logos
        </button>
      </div>

      {tab === 'access' && (
        <>
          {effectivePower >= 80 && <SuperadminCard />}
          <StaffAccessTab callerPower={effectivePower} />
        </>
      )}
      {tab === 'io'     && <ImportExportTab />}
      {tab === 'bulk'   && <BulkImportTab shopId={shopId} />}
      {tab === 'brands' && <BrandLogosTab shopId={shopId} />}
    </div>
  )
}
