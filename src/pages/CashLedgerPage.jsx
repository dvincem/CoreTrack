import React from 'react'
import { API_URL, currency, compactCurrency, apiFetch } from '../lib/config'
import KpiCard from '../components/KpiCard'
import { DataTable } from '../components/DataTable'
import Modal from '../components/Modal'
import FilterHeader from '../components/FilterHeader'
import '../pages_css/CashLedgerPage.css'

/* ── Payment method meta ── */
const METHOD_META = {
  CASH: { icon: '💵', label: 'Cash', color: 'emerald' },
  GCASH: { icon: '📲', label: 'GCash', color: 'sky' },
  CARD: { icon: '💳', label: 'Card', color: 'violet' },
  BANK: { icon: '🏦', label: 'Bank', color: 'amber' },
  CREDIT: { icon: '📋', label: 'Credit', color: 'orange' },
}

const SOURCE_META = {
  ALL: { icon: '📊', label: 'All' },
  SALE: { icon: '🛒', label: 'Sales' },
  EXPENSE: { icon: '💸', label: 'Expenses' },
  PAYABLE: { icon: '🏭', label: 'Supplier Payments' },
  RECEIVABLE: { icon: '💰', label: 'Collections' },
  MANUAL: { icon: '✍️', label: 'Manual' },
}

/* ── Entry types for manual form ── */
const ENTRY_TYPES = {
  CASH_IN: { icon: '💵', label: 'Cash In', short: 'Cash In', method: 'CASH', dir: 'IN' },
  CASH_OUT: { icon: '💸', label: 'Cash Out', short: 'Cash Out', method: 'CASH', dir: 'OUT' },
  GCASH_IN: { icon: '📲', label: 'GCash In', short: 'GCash In', method: 'GCASH', dir: 'IN' },
  GCASH_OUT: { icon: '📤', label: 'GCash Out', short: 'GCash Out', method: 'GCASH', dir: 'OUT' },
  CARD_IN: { icon: '💳', label: 'Card In', short: 'Card In', method: 'CARD', dir: 'IN' },
  CARD_OUT: { icon: '💳', label: 'Card Out', short: 'Card Out', method: 'CARD', dir: 'OUT' },
  BANK_IN: { icon: '🏦', label: 'Bank In', short: 'Bank In', method: 'BANK', dir: 'IN' },
  BANK_OUT: { icon: '🏦', label: 'Bank Out', short: 'Bank Out', method: 'BANK', dir: 'OUT' },
}

const PAGE_SIZE = 20

export default function CashLedgerPage({ shopId, isShopClosed, businessDate }) {
  const today = businessDate || new Date().toISOString().split('T')[0]

  const getTodayStr = () => today

  const BLANK = {
    entry_type: 'CASH_IN',
    amount: '',
    description: '',
    entry_date: today,
    entry_time: new Date().toTimeString().slice(0, 5),
    notes: '',
  }

  /* ── Date range state ── */
  const [startDate, setStartDate] = React.useState(today)
  const [endDate, setEndDate] = React.useState(today)
  const [activePreset, setActivePreset] = React.useState('today')

  function applyPreset(key) {
    const todayStr = getTodayStr()
    if (key === 'today') {
      setStartDate(todayStr); setEndDate(todayStr)
    } else if (key === 'yesterday') {
      const t = new Date(todayStr)
      t.setDate(t.getDate() - 1)
      const y = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
      setStartDate(y); setEndDate(y)
    } else if (key === '3mo') {
      const d = new Date(todayStr)
      d.setMonth(d.getMonth() - 3)
      const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setStartDate(start); setEndDate(todayStr)
    } else if (key === '6mo') {
      const d = new Date(todayStr)
      d.setMonth(d.getMonth() - 6)
      const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setStartDate(start); setEndDate(todayStr)
    } else if (key === 'yr') {
      const t = new Date(todayStr)
      setStartDate(`${t.getFullYear()}-01-01`); setEndDate(todayStr)
    }
    setActivePreset(key)
    setPage(1)
  }

  /* ── Unified data ── */
  const [rows, setRows] = React.useState([])
  const [loading, setLoading] = React.useState(false)

  /* ── Filters ── */
  const [sourceFilter, setSourceFilter] = React.useState('ALL')
  const [methodFilter, setMethodFilter] = React.useState('ALL')
  const [page, setPage] = React.useState(1)

  /* ── Manual entry form ── */
  const [form, setForm] = React.useState(BLANK)
  const [editingId, setEditingId] = React.useState(null)
  const [formError, setFormError] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [showEntryForm, setShowEntryForm] = React.useState(false)

  /* ── Selected entry for detail modal ── */
  const [selectedEntry, setSelectedEntry] = React.useState(null)

  /* ── Confirm / void / toast ── */
  const [pendingEntry, setPendingEntry] = React.useState(null)
  const [voidTarget, setVoidTarget] = React.useState(null)
  const [voidReason, setVoidReason] = React.useState('')
  const [toast, setToast] = React.useState(null)

  /* ── Fetch unified cash flow ── */
  React.useEffect(() => { fetchFlow() }, [shopId, startDate, endDate])

  async function fetchFlow() {
    setLoading(true)
    try {
      const r = await apiFetch(`${API_URL}/cash-flow/${shopId}?startDate=${startDate}&endDate=${endDate}`)
      setRows((await r.json()) || [])
    } catch { setRows([]) }
    setLoading(false)
  }

  /* ── Toast ── */
  function showToast(msg, icon = '✓') {
    setToast({ msg, icon })
    setTimeout(() => setToast(null), 2500)
  }

  /* ── Manual entry CRUD ── */
  function saveEntry(e) {
    e.preventDefault()
    setFormError('')
    if (!form.description.trim()) return setFormError('Description is required')
    if (!form.amount || parseFloat(form.amount) <= 0) return setFormError('Enter a valid amount')
    setPendingEntry({ ...form, amount: parseFloat(form.amount), isEdit: !!editingId })
  }

  async function confirmSaveEntry() {
    const { isEdit, ...payload } = pendingEntry
    setPendingEntry(null)
    setSaving(true)
    try {
      const fullPayload = { ...payload, shop_id: shopId, recorded_by: localStorage.getItem('th-user') || 'USER' }
      let r
      if (isEdit) {
        r = await apiFetch(`${API_URL}/cash-ledger/${editingId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullPayload),
        })
      } else {
        r = await apiFetch(`${API_URL}/cash-ledger`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullPayload),
        })
      }
      const d = await r.json()
      if (!r.ok) { setSaving(false); return setFormError(d.error || 'Failed to save') }
      setForm({ ...BLANK, entry_date: today, entry_time: new Date().toTimeString().slice(0, 5) })
      setEditingId(null)
      setShowEntryForm(false)
      fetchFlow()
      showToast(isEdit ? 'Entry updated' : 'Entry recorded')
    } catch (ex) { setFormError(ex.message) }
    setSaving(false)
  }

  function startEdit(entry) {
    // If entry comes from DataTable click, it might be the flat row
    const target = entry.original || entry
    setEditingId(target.entry_id || target.reference_id)
    setForm({
      entry_type: target.entry_type || 'CASH_IN',
      amount: target.amount,
      description: target.description,
      entry_date: target.date || target.entry_date,
      entry_time: target.time || target.entry_time || '',
      notes: target.notes || '',
    })
    setFormError('')
    setShowEntryForm(true)
  }

  function cancelEdit() {
    setEditingId(null)
    setForm({ ...BLANK, entry_date: today, entry_time: new Date().toTimeString().slice(0, 5) })
    setFormError('')
    setShowEntryForm(false)
  }

  async function confirmVoid() {
    if (!voidTarget) return
    try {
      const r = await apiFetch(`${API_URL}/cash-ledger/${voidTarget.reference_id}/void`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ void_reason: voidReason }),
      })
      if (!r.ok) return
      setVoidTarget(null); setVoidReason('')
      fetchFlow()
      showToast('Entry voided', '🗑')
    } catch (err) {
      console.error('confirmVoid failed:', err)
      showToast('Failed to void entry', '✗')
    }
  }

  function exportExcel() {
    if (!filtered.length) return
    import('xlsx').then(XLSX => {
      const data = filtered.map(r => ({
        Date: r.date, Time: r.time,
        Source: r.source_label, Description: r.description,
        'Payment Method': METHOD_META[r.payment_method]?.label || r.payment_method,
        Direction: r.direction,
        Amount: r.direction === 'IN' ? r.amount : -r.amount,
        Notes: r.notes || '',
        'Recorded By': r.recorded_by || '',
      }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Cash Flow')
      XLSX.writeFile(wb, `cash-flow-${startDate}-to-${endDate}.xlsx`)
    })
  }

  /* ── Filtered rows ── */
  const filtered = React.useMemo(() => {
    let f = rows
    if (sourceFilter !== 'ALL') f = f.filter(r => r.source === sourceFilter)
    if (methodFilter !== 'ALL') f = f.filter(r => r.payment_method === methodFilter)
    return f
  }, [rows, sourceFilter, methodFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  /* ── Derived / KPIs (Calculated from FILTERED data) ── */
  const totalIn = filtered.filter(r => r.direction === 'IN').reduce((s, r) => s + r.amount, 0)
  const totalOut = filtered.filter(r => r.direction === 'OUT').reduce((s, r) => s + r.amount, 0)
  const netFlow = totalIn - totalOut

  function methodBalance(m) {
    const inn = filtered.filter(r => r.payment_method === m && r.direction === 'IN').reduce((s, r) => s + r.amount, 0)
    const out = filtered.filter(r => r.payment_method === m && r.direction === 'OUT').reduce((s, r) => s + r.amount, 0)
    return inn - out
  }
  const cashBal = methodBalance('CASH')
  const gcashBal = methodBalance('GCASH')
  const cardBal = methodBalance('CARD')
  const bankBal = methodBalance('BANK')

  function methodCount(m) { return filtered.filter(r => r.payment_method === m).length }

  /* ── Date range label ── */
  const rangeLabel = startDate === endDate
    ? (startDate === today ? 'Today' : startDate)
    : `${startDate} → ${endDate}`

  /* ── Table columns ── */
  const columns = React.useMemo(() => [
    {
      key: 'date', label: 'Date', width: '100px',
      render: r => <span className="th-text-bold">{r.date}</span>
    },
    { key: 'time', label: 'Time', width: '70px', render: r => r.time || '—' },
    {
      key: 'source', label: 'Source', width: '140px',
      render: r => (
        <span className={`cl-source-badge cl-src-${r.source.toLowerCase()}`}>
          {SOURCE_META[r.source]?.icon || '📝'} {r.source_label}
        </span>
      )
    },
    {
      key: 'description', label: 'Description',
      render: r => (
        <div>
          <div className="th-text-bold">{r.description}</div>
          {(r.notes || r.recorded_by) && (
            <div className="th-text-faint th-text-xs">
              {r.notes ? r.notes + (r.recorded_by ? ' · ' : '') : ''}{r.recorded_by ? `by ${r.recorded_by}` : ''}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'payment_method', label: 'Method', width: '100px',
      render: r => {
        const m = METHOD_META[r.payment_method] || { icon: '💵', label: r.payment_method }
        return <span className="cl-method-chip">{m.icon} {m.label}</span>
      }
    },
    {
      key: 'amount', label: 'Amount', align: 'right', width: '120px',
      render: r => {
        const isIn = r.direction === 'IN'
        return (
          <span className={isIn ? 'cl-net-positive' : 'cl-net-negative'}>
            {isIn ? '+' : '−'}{currency(r.amount)}
          </span>
        )
      }
    },
  ], [])

  return (
    <div className="cl-root animate-slide-in-right">
      {/* ── Confirm Save Modal ── */}
      {pendingEntry && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <div className="confirm-title">{pendingEntry.isEdit ? 'Confirm Update Entry' : 'Confirm Record Entry'}</div>
            <div className="confirm-details">
              <div className="confirm-detail-row"><span className="confirm-detail-label">Type</span><span className="confirm-detail-val">{ENTRY_TYPES[pendingEntry.entry_type]?.label || pendingEntry.entry_type}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Description</span><span className="confirm-detail-val">{pendingEntry.description}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Amount</span><span className="confirm-detail-val">{currency(pendingEntry.amount)}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Date</span><span className="confirm-detail-val">{pendingEntry.entry_date}</span></div>
              {pendingEntry.entry_time && <div className="confirm-detail-row"><span className="confirm-detail-label">Time</span><span className="confirm-detail-val">{pendingEntry.entry_time}</span></div>}
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => setPendingEntry(null)}>Cancel</button>
              <button className="confirm-btn-ok" onClick={confirmSaveEntry}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Void Modal ── */}
      {voidTarget && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <div className="confirm-title">Void Entry?</div>
            <div className="confirm-details">
              <div className="confirm-detail-row"><span className="confirm-detail-label">Description</span><span className="confirm-detail-val">{voidTarget.description}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Amount</span><span className="confirm-detail-val">{currency(voidTarget.amount)}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Action</span><span className="confirm-detail-val th-text-rose">Cannot be undone</span></div>
            </div>
            <div className="cl-field" style={{ marginBottom: '1rem' }}>
              <label className="cl-label">Reason (optional)</label>
              <input className="cl-input" placeholder="Why are you voiding this?" value={voidReason} onChange={e => setVoidReason(e.target.value)} />
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => { setVoidTarget(null); setVoidReason('') }}>Cancel</button>
              <button className="confirm-btn-ok danger" onClick={confirmVoid}>Void</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="cl-toast"><span>{toast.icon}</span> {toast.msg}</div>}

      {/* ── Header ── */}
      <div className="cl-header-row">
        <div className="cl-header-title-group">
          <div className="cl-title">Cash <span>Ledger</span></div>
          {isShopClosed && (
            <div className="pos-closed-badge">
              <span className="pulse"></span>
              NEXT DAY MODE
            </div>
          )}
        </div>
        <div className="cl-header-btns-desktop">
          <button className="cl-btn cl-btn-ghost" onClick={exportExcel} disabled={!filtered.length}>⬇ Export</button>
          <button className="cl-btn cl-btn-emerald" onClick={() => { cancelEdit(); setShowEntryForm(true) }}>+ Manual Entry</button>
        </div>
      </div>

      {/* ── KPI Row 1: Totals ── */}
      <div className="cl-top-stack">
        <div className="cl-kpi-block-1">
          <div className="th-section-label">Cash Flow Summary</div>
          <div className="th-kpi-row">
            <KpiCard label="Total Inflow" value={compactCurrency(totalIn)} accent="emerald"
              sub={`${rows.filter(r => r.direction === 'IN').length} transactions`} loading={loading} />
            <KpiCard label="Total Outflow" value={compactCurrency(totalOut)} accent="rose"
              sub={`${rows.filter(r => r.direction === 'OUT').length} transactions`} loading={loading} />
            <KpiCard label="Net Cash Flow" value={compactCurrency(Math.abs(netFlow))} accent={netFlow >= 0 ? 'sky' : 'amber'}
              sub={`${netFlow >= 0 ? '↑ Positive' : '↓ Negative'} · ${rangeLabel}`} loading={loading} />
          </div>
        </div>

        {/* ── KPI Row 2: By payment method ── */}
        <div className="cl-kpi-block-2">
          <div className="th-section-label">By Payment Method</div>
          <div className="th-kpi-row cl-method-kpis">
            <KpiCard label="💵 Cash" value={compactCurrency(cashBal)} accent="emerald"
              sub={`${methodCount('CASH')} txns`} loading={loading} />
            <KpiCard label="📲 GCash" value={compactCurrency(gcashBal)} accent="sky"
              sub={`${methodCount('GCASH')} txns`} loading={loading} />
            <KpiCard label="💳 Card" value={compactCurrency(cardBal)} accent="violet"
              sub={`${methodCount('CARD')} txns`} loading={loading} />
            <KpiCard label="🏦 Bank" value={compactCurrency(bankBal)} accent="amber"
              sub={`${methodCount('BANK')} txns`} loading={loading} />
          </div>
        </div>
      </div>

      {/* Filter Header Toolbar */}
      <FilterHeader
        leftComponent={
          <div className="fh-left">
            <select className="cl-select" style={{ minWidth: '250px' }}
              value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setPage(1) }}>
              <option value="ALL">All Sources</option>
              {Object.entries(SOURCE_META).filter(([k]) => k !== 'ALL').map(([k, m]) => (
                <option key={k} value={k}>{m.label}</option>
              ))}
            </select>
            <div className="fh-left" style={{ gap: '0.4rem', display: 'flex', flexDirection: 'row' }}>
              <span className="cl-label" style={{ margin: 0, maxWidth: "50px" }}>From</span>
              <input className="cl-input fh-date" type="date" value={startDate} max={today} onChange={e => { setStartDate(e.target.value); setActivePreset(''); setPage(1) }} />
              <span className="cl-label" style={{ margin: 0, maxWidth: "30px" }}>To</span>
              <input className="cl-input fh-date" type="date" value={endDate} max={today} onChange={e => { setEndDate(e.target.value); setActivePreset(''); setPage(1) }} />
            </div>
          </div>
        }
        filters={[
          { value: 'today', label: 'Today', active: activePreset === 'today' },
          { value: 'yesterday', label: 'Yesterday', active: activePreset === 'yesterday' },
          { value: '3mo', label: '3 Months', active: activePreset === '3mo' },
          { value: '6mo', label: '6 Months', active: activePreset === '6mo' },
          { value: 'yr', label: 'This Yr', active: activePreset === 'yr' },
        ]}
        onFilterChange={applyPreset}
        accentColor="var(--th-emerald)"
      />

      {/* ── Mobile action strip ── */}
      <div className="cl-mobile-actions">
        <button className="cl-btn cl-btn-ghost" onClick={exportExcel} disabled={!filtered.length}>⬇ Export</button>
        <button className="cl-btn cl-btn-emerald" onClick={() => { cancelEdit(); setShowEntryForm(true) }}>+ Manual Entry</button>
      </div>

      {/* ── Payment method filter chips ── */}
      <div className="cl-method-filters">
        <button className={`cl-method-chip-btn${methodFilter === 'ALL' ? ' active' : ''}`}
          onClick={() => { setMethodFilter('ALL'); setPage(1) }}>All Methods</button>
        {Object.entries(METHOD_META).map(([key, meta]) => {
          const count = rows.filter(r => r.payment_method === key).length
          if (count === 0) return null
          return (
            <button key={key}
              className={`cl-method-chip-btn${methodFilter === key ? ' active' : ''}`}
              onClick={() => { setMethodFilter(key); setPage(1) }}>
              {meta.icon} {meta.label} <span className="cl-filter-count">{count}</span>
            </button>
          )
        })}
      </div>

      {/* ── Cash Position Banner ── */}
      <div className="cl-coh-banner">
        <div className="cl-coh-left">
          <div className="cl-coh-label">Net Cash Position</div>
          <div className={`cl-coh-amount ${netFlow >= 0 ? 'cl-net-positive' : 'cl-net-negative'}`}>
            {netFlow >= 0 ? '+' : '−'}{currency(Math.abs(netFlow))}
          </div>
          <div className="cl-coh-sub">{rangeLabel} · {rows.length} transactions from all sources</div>
        </div>
        <div className="cl-coh-split">
          <div className="cl-coh-item">
            <div className="cl-coh-item-label">💵 Cash</div>
            <div className={`cl-coh-item-val ${cashBal >= 0 ? 'cl-net-positive' : 'cl-net-negative'}`}>{cashBal >= 0 ? '+' : '−'}{currency(Math.abs(cashBal))}</div>
          </div>
          <div className="cl-coh-item">
            <div className="cl-coh-item-label">📲 GCash</div>
            <div className={`cl-coh-item-val ${gcashBal >= 0 ? 'cl-net-positive' : 'cl-net-negative'}`}>{gcashBal >= 0 ? '+' : '−'}{currency(Math.abs(gcashBal))}</div>
          </div>
          <div className="cl-coh-item">
            <div className="cl-coh-item-label">💳 Card</div>
            <div className={`cl-coh-item-val ${cardBal >= 0 ? 'cl-net-positive' : 'cl-net-negative'}`}>{cardBal >= 0 ? '+' : '−'}{currency(Math.abs(cardBal))}</div>
          </div>
          <div className="cl-coh-item">
            <div className="cl-coh-item-label">🏦 Bank</div>
            <div className={`cl-coh-item-val ${bankBal >= 0 ? 'cl-net-positive' : 'cl-net-negative'}`}>{bankBal >= 0 ? '+' : '−'}{currency(Math.abs(bankBal))}</div>
          </div>
        </div>
      </div>

      {/* ── Entry Form Modal ── */}
      {showEntryForm && (
        <div className="cl-form-overlay" onClick={e => { if (e.target === e.currentTarget) cancelEdit() }}>
          <div className="cl-form-modal">
            <div className="cl-form-modal-header">
              <div className="cl-form-modal-title">{editingId ? '✏ Edit Entry' : '+ Manual Entry'}</div>
              <button className="cl-form-modal-close" onClick={cancelEdit}>✕</button>
            </div>
            <form onSubmit={saveEntry} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div>
                <label className="cl-label">Type *</label>
                <div className="cl-type-grid">
                  {Object.entries(ENTRY_TYPES).map(([type, meta]) => (
                    <button key={type} type="button"
                      className={`cl-type-btn ${form.entry_type === type ? `active ${type}` : ''}`}
                      onClick={() => setForm(f => ({ ...f, entry_type: type }))}>
                      <span className="cl-type-btn-icon">{meta.icon}</span>
                      {meta.short}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="cl-label">Description *</label>
                <input className="cl-input"
                  placeholder="e.g. Customer payment, Change fund…"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="cl-form-row">
                <div>
                  <label className="cl-label">Amount (₱) *</label>
                  <input type="number" step="0.01" min="0" className="cl-input" placeholder="0.00"
                    value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div>
                  <label className="cl-label">Time</label>
                  <input type="time" className="cl-input"
                    value={form.entry_time} onChange={e => setForm(f => ({ ...f, entry_time: e.target.value }))} />
                </div>
              </div>
              <div className="cl-form-row">
                <div>
                  <label className="cl-label">Date</label>
                  <input type="date" className="cl-input" value={form.entry_date} max={today}
                    onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="cl-label">Notes (optional)</label>
                <textarea className="cl-textarea" placeholder="Additional details…"
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              {formError && <div className="cl-form-error">{formError}</div>}
              <div className="cl-form-actions">
                <button type="button" className="cl-btn cl-btn-ghost" onClick={cancelEdit}>Cancel</button>
                <button type="submit" className={`cl-btn ${form.entry_type.endsWith('_IN') ? 'cl-btn-emerald' : 'cl-btn-rose'}`} disabled={saving}>
                  {saving ? 'Saving…' : editingId ? '✓ Update' : `+ Record ${ENTRY_TYPES[form.entry_type]?.label || 'Entry'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Transaction Table ── */}
      <div className="th-section-label">Cash History</div>
      <div className="cl-feed">
        <DataTable
          columns={columns}
          rows={paged}
          rowKey="id"
          onRowClick={(row) => setSelectedEntry(row)}
          mobileLayout="scroll"
          minWidth={750}
          loading={loading}
          emptyTitle="No Transactions"
          emptyMessage={`No cash flow transactions for ${rangeLabel}. Transactions from sales, expenses, purchases, and manual entries will appear here.`}
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>

      {selectedEntry && (
        <Modal
          isOpen={!!selectedEntry}
          onClose={() => setSelectedEntry(null)}
          title="Entry Detail"
          maxWidth="500px"
          footer={selectedEntry.editable && (
            <div className="cl-modal-footer-actions">
              <button className="cl-btn cl-btn-ghost" onClick={() => { setSelectedEntry(null); startEdit(selectedEntry) }}>✏ Edit</button>
              <button className="cl-btn cl-btn-rose" onClick={() => { setSelectedEntry(null); setVoidTarget(selectedEntry); setVoidReason('') }}>🗑 Void</button>
            </div>
          )}
        >
          <div className="inv-hist-body" style={{ border: 'none' }}>
            <div className="inv-hist-item-card">
              <div className="inv-hist-item-name">{selectedEntry.description}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span className={`cl-source-badge cl-src-${selectedEntry.source.toLowerCase()}`} style={{ margin: 0 }}>
                  {SOURCE_META[selectedEntry.source]?.icon || '📝'} {selectedEntry.source_label}
                </span>
                <span className="cl-method-chip" style={{ margin: 0 }}>
                  {METHOD_META[selectedEntry.payment_method]?.icon || '💵'} {METHOD_META[selectedEntry.payment_method]?.label || selectedEntry.payment_method}
                </span>
              </div>
              <div className="inv-hist-stats">
                <div className="inv-hist-stat">
                  <div className="inv-hist-stat-label">Amount</div>
                  <div className={`inv-hist-stat-val ${selectedEntry.direction === 'IN' ? 'cl-net-positive' : 'cl-net-negative'}`} style={{ fontSize: '1.25rem', fontWeight: 900 }}>
                    {selectedEntry.direction === 'IN' ? '+' : '−'}{currency(selectedEntry.amount)}
                  </div>
                </div>
                <div className="inv-hist-stat">
                  <div className="inv-hist-stat-label">Date & Time</div>
                  <div className="inv-hist-stat-val" style={{ fontSize: '0.9rem' }}>{selectedEntry.date} {selectedEntry.time}</div>
                </div>
              </div>
            </div>
            {(selectedEntry.notes || selectedEntry.recorded_by) && (
              <div style={{ padding: '0.85rem 1.2rem' }}>
                {selectedEntry.notes && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--th-text-faint)', fontWeight: 700, marginBottom: '0.3rem' }}>Notes</div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--th-text-body)' }}>{selectedEntry.notes}</div>
                  </div>
                )}
                {selectedEntry.recorded_by && (
                  <div>
                    <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--th-text-faint)', fontWeight: 700, marginBottom: '0.3rem' }}>Recorded By</div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--th-text-body)' }}>{selectedEntry.recorded_by}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
