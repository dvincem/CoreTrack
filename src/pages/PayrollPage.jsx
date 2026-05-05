import '../pages_css/PayrollPage.css';
import React from 'react'
import { API_URL, currency, apiFetch, SkeletonRows } from '../lib/config'
import KpiCard from '../components/KpiCard'
import SearchInput from '../components/SearchInput'
import { DataTable } from '../components/DataTable'
import FilterHeader from '../components/FilterHeader'

const fmt = (n) => `₱${Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`

function PayrollPage({ shopId, setPageContext }) {
  const [date, setDate] = React.useState(new Date().toISOString().split('T')[0])
  const [search, setSearch] = React.useState('')
  const [staffFilter, setStaffFilter] = React.useState('all')
  const [logs, setLogs] = React.useState([])
  const [summary, setSummary] = React.useState([])
  const [staffList, setStaffList] = React.useState([])
  const [services, setServices] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [genSaving, setGenSaving] = React.useState(false)

  // Form state
  const [fStaff, setFStaff] = React.useState('')
  const [fService, setFService] = React.useState('')
  const [fQty, setFQty] = React.useState('1')
  const [fPrice, setFPrice] = React.useState('')
  const [fCommission, setFCommission] = React.useState('0')
  const [fError, setFError] = React.useState('')
  const [fAdding, setFAdding] = React.useState(false)

  // Table state
  const [logType, setLogType] = React.useState('all') // 'all' | 'service' | 'commission'
  const [logPage, setLogPage] = React.useState(1)
  const LOG_PAGE_SIZE = 10

  const [pendingLog, setPendingLog] = React.useState(null)

  // Direct commission modal
  const [commModal, setCommModal] = React.useState(false)
  const [commStaff, setCommStaff] = React.useState('')
  const [commAmount, setCommAmount] = React.useState('')
  const [commNote, setCommNote] = React.useState('')
  const [commError, setCommError] = React.useState('')
  const [commSaving, setCommSaving] = React.useState(false)
  const [commPending, setCommPending] = React.useState(null)

  // Search suggestions
  const [suggestions, setSuggestions] = React.useState([])

  // Bale deductions
  const [bales, setBales] = React.useState([]) // active bales keyed by staff_id
  const [baleDeduct, setBaleDeduct] = React.useState({}) // staff_id → { open: bool, amount: string, saving: bool }


  React.useEffect(() => {
    apiFetch(`${API_URL}/staff/${shopId}`).then(r => r.json()).then(d => setStaffList(Array.isArray(d) ? d : []))
    apiFetch(`${API_URL}/services`).then(r => r.json()).then(d => setServices(Array.isArray(d) ? d : []))
    loadBales()
  }, [shopId])

  function loadBales() {
    apiFetch(`${API_URL}/bale/${shopId}?status=ACTIVE`)
      .then(r => r.json())
      .then(d => setBales(Array.isArray(d) ? d : []))
      .catch(() => setBales([]))
  }

  async function submitBaleDeduct(staffId) {
    const state = baleDeduct[staffId] || {}
    const amt = parseFloat(state.amount)
    if (!amt || amt <= 0) return
    const activeBale = bales.find(b => b.staff_id === staffId)
    if (!activeBale) return
    setBaleDeduct(prev => ({ ...prev, [staffId]: { ...state, saving: true } }))
    try {
      const res = await apiFetch(`${API_URL}/bale/${activeBale.bale_id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: shopId, amount: amt, payment_date: date, payment_method: 'CASH', notes: 'Payroll deduction', recorded_by: 'PAYROLL' })
      })
      const data = await res.json()
      if (!data.error) {
        setBaleDeduct(prev => ({ ...prev, [staffId]: { open: false, amount: '100', saving: false } }))
        loadBales()
      } else {
        setBaleDeduct(prev => ({ ...prev, [staffId]: { ...state, saving: false } }))
      }
    } catch {
      setBaleDeduct(prev => ({ ...prev, [staffId]: { ...state, saving: false } }))
    }
  }

  React.useEffect(() => { fetchAll() }, [date, shopId])

  async function fetchAll() {
    setLoading(true)
    try {
      const [logsRes, sumRes] = await Promise.all([
        apiFetch(`${API_URL}/labor-log/${shopId}?date=${date}`),
        apiFetch(`${API_URL}/labor-summary/${shopId}?date=${date}`)
      ])
      const logsData = await logsRes.json()
      const sumData = await sumRes.json()
      setLogs(Array.isArray(logsData) ? logsData : [])
      setSummary(Array.isArray(sumData) ? sumData : [])
    } catch { setLogs([]); setSummary([]); }
    finally { setLoading(false) }
  }

  // When service changes, auto-fill price
  function handleServiceChange(svcId) {
    setFService(svcId)
    const svc = services.find(s => s.service_id === svcId)
    if (svc) {
      setFPrice(String(svc.base_price || ''))
      // commission: rate * price * qty
      const rate = svc.commission_rate || 0
      const qty = parseFloat(fQty) || 1
      setFCommission(String(((svc.base_price || 0) * qty * rate / 100).toFixed(2)))
    }
  }

  function recalcCommission(qty, price) {
    const svc = services.find(s => s.service_id === fService)
    if (!svc) return
    const rate = svc.commission_rate || 0
    setFCommission(String(((parseFloat(price)||0) * (parseFloat(qty)||1) * rate / 100).toFixed(2)))
  }

  function handleAddLog(e) {
    e.preventDefault()
    setFError('')
    if (!fStaff) { setFError('Select a tireman.'); return }
    if (!fService) { setFError('Select a service.'); return }
    if (!fPrice || isNaN(parseFloat(fPrice))) { setFError('Enter a valid price.'); return }
    const svc = services.find(s => s.service_id === fService)
    const staffMember = staffList.find(s => s.staff_id === fStaff)
    setPendingLog({
      staff_id: fStaff,
      staffName: staffMember?.full_name || fStaff,
      service_id: fService,
      service_name: svc?.service_name || fService,
      quantity: parseFloat(fQty) || 1,
      unit_price: parseFloat(fPrice),
      commission_amount: parseFloat(fCommission) || 0,
      business_date: date,
    })
  }

  async function confirmAddLog() {
    setFAdding(true)
    try {
      const res = await apiFetch(`${API_URL}/labor-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pendingLog, shop_id: shopId, encoded_by: 'ADMIN' })
      })
      const data = await res.json()
      if (!data.error) {
        setPendingLog(null); setFService(''); setFPrice(''); setFQty('1'); setFCommission('0');
        fetchAll()
      } else { setFError(data.error) }
    } catch { setFError('Failed to add log.') }
    finally { setFAdding(false) }
  }

  function handleCommSubmit(e) {
    e.preventDefault()
    setCommError('')
    if (!commStaff || !commAmount) return
    const s = staffList.find(x => x.staff_id === commStaff)
    setCommPending({ staff_id: commStaff, staffName: s?.full_name || commStaff, amount: parseFloat(commAmount), note: commNote, date })
  }

  async function confirmCommission() {
    setCommSaving(true)
    try {
      const res = await apiFetch(`${API_URL}/commission-direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...commPending, shop_id: shopId, commission_amount: commPending.amount, business_date: date, notes: commPending.note, encoded_by: 'ADMIN' })
      })
      const data = await res.json()
      if (!data.error) { setCommModal(false); setCommPending(null); fetchAll() }
      else { setCommError(data.error) }
    } catch { setCommError('Failed to save commission.') }
    finally { setCommSaving(false) }
  }

  const exportExcel = async () => {
    const XLSX = await import('xlsx')
    const rows = logs.map(l => ({
      Time: new Date(l.log_datetime).toLocaleTimeString('en-PH'),
      Tireman: l.full_name,
      Service: l.service_name,
      Qty: l.quantity,
      Price: l.unit_price,
      Total: l.total_amount,
      Commission: l.commission_amount,
      Status: l.is_void ? 'VOIDED' : 'ACTIVE',
      Reason: l.void_reason || ''
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Labor Logs')
    XLSX.writeFile(wb, `payroll-${date}.xlsx`)
  }

  // Suggestions
  React.useEffect(() => {
    const q = search.trim().toLowerCase()
    if (!q) { setSuggestions([]); return }
    const seen = new Set()
    const sugs = []
    for (const r of summary) {
      if (sugs.length >= 10) break
      if (r.full_name?.toLowerCase().includes(q)) {
        if (!seen.has(r.full_name)) { seen.add(r.full_name); sugs.push({ text: r.full_name, type: 'Staff', icon: '👤' }) }
      }
      if (r.staff_code?.toLowerCase().includes(q)) {
        if (!seen.has(r.staff_code)) { seen.add(r.staff_code); sugs.push({ text: r.staff_code, type: 'ID', icon: '🆔' }) }
      }
    }
    setSuggestions(sugs)
  }, [search, summary])

  const filteredSummary = React.useMemo(() => {
    return summary.filter(s => s.full_name.toLowerCase().includes(search.toLowerCase()))
  }, [summary, search])

  const filteredLogs = React.useMemo(() => {
    let list = [...logs]
    if (staffFilter !== 'all') list = list.filter(l => l.staff_id === staffFilter)
    if (logType === 'service') list = list.filter(l => l.commission_amount === 0)
    if (logType === 'commission') list = list.filter(l => l.commission_amount > 0)
    return list
  }, [logs, staffFilter, logType])

  const totalServiceRevenue = summary.reduce((s, r) => s + (r.service_total || 0), 0)
  const totalCommission = summary.reduce((s, r) => s + (r.commission_total || 0), 0)
  const totalBaleDeducted = summary.reduce((s, r) => s + (r.bale_deducted || 0), 0)
  const totalServicePayout = totalServiceRevenue / 2
  const netServiceMargin = totalServiceRevenue / 2

  const summaryColumns = React.useMemo(() => [
    { key: 'full_name', label: 'Tireman', render: (r) => (
      <div className="pr-name-wrap">
        <div className="pr-name">{r.full_name}</div>
        <div className="pr-code">{r.staff_code}</div>
      </div>
    )},
    { key: 'service_count', label: 'Services', align: 'center' },
    {
      key: 'service_total',
      label: 'Service Total',
      align: 'right',
      render: (r) => <div className="pr-money sky">{fmt(r.service_total)}</div>,
    },
    {
      key: 'service_pay',
      label: 'Service Pay (÷2)',
      align: 'right',
      render: (r) => <div className="pr-money amber">{fmt(r.service_total / 2)}</div>,
    },
    {
      key: 'commission_total',
      label: '+ Commission',
      align: 'right',
      render: (r) => <div className="pr-money violet">{fmt(r.commission_total)}</div>,
    },
    {
      key: 'total_payout',
      label: '= Total Payout',
      align: 'right',
      render: (r) => {
        const staffBaleDeducted = r.bale_deducted || 0
        return <div className="pr-money emerald">{fmt(r.service_total / 2 + r.commission_total - staffBaleDeducted)}</div>
      },
    },
    {
      key: 'bale',
      label: 'Bale',
      render: (r) => {
        const activeBale = bales.find(b => b.staff_id === r.staff_id)
        const bds = baleDeduct[r.staff_id] || { open: false, amount: '100', saving: false }
        if (!activeBale) return <span style={{fontSize:'0.75rem',color:'var(--th-text-faint)'}}>—</span>
        return (
          <div>
            <button className="pr-bale-badge" onClick={() => setBaleDeduct(prev => ({ ...prev, [r.staff_id]: { ...bds, open: !bds.open, amount: bds.amount || '100' } }))}>
              📒 Bale {fmt(activeBale.balance_amount)}
            </button>
            {bds.open && (
              <div className="pr-bale-deduct-row">
                <input className="pr-bale-input" type="number" min="1" step="1" value={bds.amount}
                  onChange={e => setBaleDeduct(prev => ({ ...prev, [r.staff_id]: { ...bds, amount: e.target.value } }))} />
                <button className="pr-bale-confirm" disabled={bds.saving} onClick={() => submitBaleDeduct(r.staff_id)}>
                  {bds.saving ? '…' : '✓ Deduct'}
                </button>
                <button className="pr-bale-cancel" onClick={() => setBaleDeduct(prev => ({ ...prev, [r.staff_id]: { ...bds, open: false } }))}>✕</button>
              </div>
            )}
          </div>
        )
      },
    },
  ], [bales, baleDeduct])

  const logColumns = React.useMemo(() => [
    {
      key: 'log_datetime',
      label: 'Time',
      render: (l) => <span style={{fontSize:'0.78rem',color:'var(--th-text-faint)',whiteSpace:'nowrap'}}>{new Date(l.log_datetime).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'})}</span>,
    },
    {
      key: 'full_name',
      label: 'Tireman',
      render: (l) => <div className="pr-name" style={{fontSize:'0.85rem'}}>{l.full_name}</div>,
    },
    { key: 'service_name', label: 'Service', render: (l) => <span style={{fontSize:'0.85rem'}}>{l.service_name}</span> },
    { key: 'quantity', label: 'Qty', align: 'right', render: (l) => <span style={{fontSize:'0.85rem'}}>{l.quantity}</span> },
    {
      key: 'unit_price',
      label: 'Unit Price',
      align: 'right',
      render: (l) => <div className="pr-money" style={{fontSize:'0.88rem',color:'var(--th-text-body)'}}>{l.commission_amount > 0 ? '—' : fmt(l.unit_price)}</div>,
    },
    {
      key: 'total_amount',
      label: 'Total',
      align: 'right',
      render: (l) => <div className="pr-money sky" style={{fontSize:'0.88rem'}}>{l.commission_amount > 0 ? '—' : fmt(l.total_amount)}</div>,
    },
    {
      key: 'commission_amount',
      label: 'Commission',
      align: 'right',
      render: (l) => <div className="pr-money violet" style={{fontSize:'0.88rem'}}>{l.commission_amount > 0 ? fmt(l.commission_amount) : '—'}</div>,
    },
    {
      key: 'status',
      label: 'Status',
      align: 'right',
      render: (l) => l.is_void ? <span className="pr-void-badge">Voided</span> : <span style={{color:'var(--th-emerald)',fontSize:'0.7rem',fontWeight:700}}>ACTIVE</span>
    }
  ], [])

  return (
    <div className="pr-root">
      <div className="pr-header-row">
        <div className="th-title-format">Labor <span style={{ color: 'var(--th-amber)' }}>Payroll</span></div>
        <div className="pr-header-btns pr-header-btns-desktop">
          <button className="pr-comm-btn" onClick={() => { setCommModal(true); setCommError(''); setCommStaff(''); setCommAmount(''); setCommNote('') }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            Give Commission
          </button>
          
          <button className="pr-export-btn" onClick={exportExcel}>⬇ Export Excel</button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="th-kpi-row">
        <KpiCard label="Service Revenue"       value={fmt(totalServiceRevenue)} accent="sky"    loading={loading} sub={`${summary.reduce((s,r)=>s+r.service_count,0)} services for ${date}`} />
        <KpiCard label="Total Payout"          value={fmt(totalServicePayout + totalCommission - totalBaleDeducted)} accent="amber"  loading={loading} sub={`÷2 + commission${totalBaleDeducted > 0 ? ' − bale' : ''}`} />
        <KpiCard label="Net Service Margin"    value={fmt(netServiceMargin)}   accent="emerald" loading={loading} sub="Shop keeps 50%" />
        <KpiCard label="Commission Paid Out"   value={fmt(totalCommission)}    accent="violet"  loading={loading} sub="Separate cost center" />
      </div>

      {/* Filter Header 1: Main Search + Date */}
      <div style={{ marginTop: '0', marginBottom: '0' }}>
        <FilterHeader
          searchProps={{
            value: search,
            onChange: setSearch,
            placeholder: "Search tireman…",
            suggestions: suggestions,
            onSuggestionSelect: s => setSearch(s.text),
            resultCount: search.trim() ? filteredSummary.length : undefined,
            totalCount: summary.length,
            resultLabel: "staff",
          }}
          leftComponent={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'nowrap', width: '100%', height: '100%' }}>
              <span style={{ fontSize: 'inherit', fontWeight: 600, color: 'var(--th-text-muted)', whiteSpace: 'nowrap' }}>Date</span>
              <input className="fh-date" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ flex: 1, minWidth: '120px' }} />
            </div>
          }
          accentColor="var(--th-orange)"
        />
      </div>

      {/* Action buttons — mobile only (desktop shows in header row) */}
      <div className="pr-action-row pr-action-row-mobile" style={{ gap: '0.5rem' }}>
        <button className="pr-comm-btn" style={{ flex: 1 }} onClick={() => { setCommModal(true); setCommError(''); setCommStaff(''); setCommAmount(''); setCommNote('') }}>
          Give Commission
        </button>
        <button className="pr-export-btn" style={{ flex: 1 }} onClick={exportExcel}>Export</button>
      </div>

      {/* Tireman summary */}
      <div className="pr-section-title">Daily Earnings by Tireman</div>
      <DataTable
        columns={summaryColumns}
        rows={filteredSummary}
        rowKey="staff_id"
        loading={loading}
        skeletonRows={5}
        skeletonWidths={['w60','w20','w30','w30','w30','w30','w20']}
        minWidth={720}
        emptyTitle="No Entries"
        emptyMessage={`No labor entries for ${date}.`}
        emptyIcon={<svg className="th-tbl-empty-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>}
      />
      {/* Service log table */}
      <div className="pr-section-title">Service Log</div>
      
      {/* Filter Header 2: Service Log Filters */}
      <div style={{ marginTop: '0', marginBottom: '0' }}>
        <FilterHeader
          leftComponent={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', flexWrap: 'nowrap', width: '100%', height: '100%' }}>
              <select className="fh-select" style={{ minWidth: '150px' }}
                value={staffFilter} onChange={e => setStaffFilter(e.target.value)}>
                <option value="all">All Tiremen</option>
                {staffList.filter(s => ['tireman','technician'].includes((s.role||'').toLowerCase())).map(s => <option key={s.staff_id} value={s.staff_id}>{s.full_name}</option>)}
              </select>
            </div>
          }
          filters={[
            { label: 'All', value: 'all', active: logType === 'all' },
            { label: 'Service ÷2', value: 'service', active: logType === 'service' },
            { label: 'Commission', value: 'commission', active: logType === 'commission' },
          ]}
          onFilterChange={setLogType}
          accentColor="var(--th-orange)"
        />
      </div>
      <DataTable
        columns={logColumns}
        rows={filteredLogs.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE)}
        rowKey="log_id"
        loading={loading}
        skeletonRows={8}
        skeletonWidths={['w20','w40','w40','w20','w30','w30','w30','w20']}
        minWidth={700}
        getRowStyle={(l) => l.is_void ? {opacity:0.45} : undefined}
        emptyTitle="No Log Entries"
        emptyMessage="No entries."
        emptyIcon={<svg className="th-tbl-empty-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>}
        currentPage={logPage}
        totalPages={Math.ceil(filteredLogs.length / LOG_PAGE_SIZE) || 1}
        onPageChange={setLogPage}
      />

      {/* Confirm Add Log */}
      {pendingLog && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <div className="confirm-title">Confirm Add Labor Log</div>
            <div className="confirm-details">
              <div className="confirm-detail-row"><span className="confirm-detail-label">Tireman</span><span className="confirm-detail-val">{pendingLog.staffName}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Service</span><span className="confirm-detail-val">{pendingLog.service_name}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Qty</span><span className="confirm-detail-val">{pendingLog.quantity}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Unit Price</span><span className="confirm-detail-val">{fmt(pendingLog.unit_price)}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Total</span><span className="confirm-detail-val">{fmt(pendingLog.unit_price * pendingLog.quantity)}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Commission</span><span className="confirm-detail-val">{fmt(pendingLog.commission_amount)}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Date</span><span className="confirm-detail-val">{pendingLog.business_date}</span></div>
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => setPendingLog(null)}>Cancel</button>
              <button className="confirm-btn-ok" onClick={confirmAddLog}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Give Commission Modal ── */}
      {commModal && (
        <div className="confirm-overlay" onClick={e => { if (e.target === e.currentTarget) setCommModal(false) }}>
          <div className="confirm-box" style={{ minWidth: 360 }}>
            <div className="confirm-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--th-violet)" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              Give Direct Commission
            </div>

            <form onSubmit={handleCommSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="pr-field">
                <div className="pr-label">Staff Member <span style={{ color: 'var(--th-rose)' }}>*</span></div>
                <select className="pr-select" value={commStaff} onChange={e => setCommStaff(e.target.value)} required>
                  <option value="">— Select staff —</option>
                  {staffList
                    .filter(s => s.is_active && !['owner','manager'].includes((s.role||'').toLowerCase()))
                    .map(s => <option key={s.staff_id} value={s.staff_id}>{s.full_name} {s.role ? `(${s.role})` : ''}</option>)
                  }
                </select>
              </div>

              <div className="pr-field">
                <div className="pr-label">Commission Amount (₱) <span style={{ color: 'var(--th-rose)' }}>*</span></div>
                <input
                  className="pr-input"
                  type="number" min="1" step="0.01"
                  placeholder="e.g. 500"
                  value={commAmount}
                  onChange={e => setCommAmount(e.target.value)}
                  required
                />
              </div>

              <div className="pr-field">
                <div className="pr-label">Note / Reason <span style={{ fontSize: '0.68rem', color: 'var(--th-text-faint)' }}>(optional)</span></div>
                <input
                  className="pr-input"
                  type="text"
                  placeholder="e.g. Bonus for tire upsell, referral reward…"
                  value={commNote}
                  onChange={e => setCommNote(e.target.value)}
                />
              </div>

              {commError && <div style={{ fontSize: '0.78rem', color: 'var(--th-rose)', background: 'var(--th-rose-bg)', padding: '0.45rem 0.75rem', borderRadius: 7 }}>{commError}</div>}

              <div className="confirm-actions">
                <button type="button" className="confirm-btn-cancel" onClick={() => setCommModal(false)}>Cancel</button>
                <button type="submit" className="confirm-btn-ok" style={{ background: 'var(--th-violet)', borderColor: 'var(--th-violet)' }} disabled={commSaving}>
                  {commSaving ? 'Saving…' : 'Review & Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Commission confirm */}
      {commPending && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <div className="confirm-title">Confirm Commission</div>
            <div className="confirm-details">
              <div className="confirm-detail-row"><span className="confirm-detail-label">Staff</span><span className="confirm-detail-val">{commPending.staffName}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Amount</span><span className="confirm-detail-val" style={{ color: 'var(--th-violet)', fontWeight: 700 }}>{fmt(commPending.amount)}</span></div>
              {commPending.note && <div className="confirm-detail-row"><span className="confirm-detail-label">Note</span><span className="confirm-detail-val">{commPending.note}</span></div>}
              <div className="confirm-detail-row"><span className="confirm-detail-label">Date</span><span className="confirm-detail-val">{commPending.date}</span></div>
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => setCommPending(null)}>Back</button>
              <button className="confirm-btn-ok" style={{ background: 'var(--th-violet)', borderColor: 'var(--th-violet)' }} onClick={confirmCommission} disabled={commSaving}>
                {commSaving ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PayrollPage
