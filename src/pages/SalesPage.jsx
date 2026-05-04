import '../pages_css/SalesPage.css';
import React from 'react'
import { API_URL, apiFetch } from '../lib/config'
import DataTable from '../components/DataTable'
import KpiCard from '../components/KpiCard'
import SearchInput from '../components/SearchInput'
import FilterHeader from '../components/FilterHeader'
import usePaginatedResource from '../hooks/usePaginatedResource'



const fmt = n => `₱${Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`

const fmtCompact = (n) => {
  if (n >= 1_000_000) return '₱' + (n / 1_000_000).toLocaleString('en-PH', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + 'M';
  if (n >= 1_000) return '₱' + (n / 1_000).toLocaleString('en-PH', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + 'K';
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function SalesPage({ shopId, isShopClosed }) {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]

  const SL_PAGE_SIZE = 20
  const [staffMap, setStaffMap] = React.useState({})
  const [startDate, setStartDate] = React.useState(weekAgo)
  const [endDate, setEndDate] = React.useState(today)
  const [suggestions, setSuggestions] = React.useState([])
  const [kpi, setKpi] = React.useState(null)

  const { data: sales, page: slPage, setPage: setSlPage, totalPages: slTotalPages,
    total: slTotal, search, setSearch, loading, refetch: fetchSales } =
    usePaginatedResource({
      url: `${API_URL}/sales/${shopId}`,
      perPage: SL_PAGE_SIZE,
      extraParams: { startDate, endDate },
      enabled: !!shopId,
      deps: [shopId, startDate, endDate],
    })

  // Modal state
  const [modal, setModal] = React.useState(null) // { sale, details }
  const [loadingDetails, setLoadingDetails] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [editInvoice, setEditInvoice] = React.useState('')
  const [editNotes, setEditNotes] = React.useState('')
  const [editCustomerId, setEditCustomerId] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [pendingSaveEdit, setPendingSaveEdit] = React.useState(null)
  const [voidTarget, setVoidTarget] = React.useState(null)
  const [voidReason, setVoidReason] = React.useState('')
  const [customers, setCustomers] = React.useState([])


  React.useEffect(() => {
    apiFetch(`${API_URL}/staff/${shopId}`)
      .then(r => r.json())
      .then(d => {
        const map = {}
        if (Array.isArray(d)) d.forEach(s => { map[s.staff_id] = s.full_name })
        setStaffMap(map)
      }).catch(() => {})

    apiFetch(`${API_URL}/customers/${shopId}`)
      .then(r => r.json())
      .then(d => {
        setCustomers(Array.isArray(d) ? d : [])
      }).catch(() => {})
  }, [shopId])

  React.useEffect(() => {
    if (!shopId) return
    const params = new URLSearchParams({ startDate, endDate })
    apiFetch(`${API_URL}/sales-kpi/${shopId}?${params}`)
      .then(r => r.json())
      .then(d => setKpi(d))
      .catch(() => {})
  }, [shopId, startDate, endDate])

  async function openModal(sale) {
    setEditing(false)
    setModal({ sale, details: [] })
    setLoadingDetails(true)
    try {
      const r = await apiFetch(`${API_URL}/sales/${sale.sale_id}/details`)
      const d = await r.json()
      setModal({ sale, details: Array.isArray(d) ? d : [] })
    } catch { setModal({ sale, details: [] }) }
    finally { setLoadingDetails(false) }
  }

  function closeModal() { setModal(null); setEditing(false) }

  function startEdit() {
    setEditInvoice(modal.sale.invoice_number || '')
    setEditNotes(modal.sale.sale_notes || '')
    setEditCustomerId(modal.sale.customer_id || '')
    setEditing(true)
  }

  function saveEdit() {
    setPendingSaveEdit({ 
      saleId: modal.sale.sale_id, 
      invoice: editInvoice, 
      notes: editNotes, 
      customerId: editCustomerId 
    })
  }

  async function confirmSaveEdit() {
    const { saleId, invoice, notes, customerId } = pendingSaveEdit
    setPendingSaveEdit(null)
    setSaving(true)
    try {
      const r = await apiFetch(`${API_URL}/sales/${saleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          invoice_number: invoice, 
          sale_notes: notes, 
          customer_id: customerId 
        }),
      })
      if (r.ok) {
        const selectedCustomer = customers.find(c => String(c.customer_id) === String(customerId))
        const updated = { 
          ...modal.sale, 
          invoice_number: invoice, 
          sale_notes: notes, 
          customer_id: customerId || null, 
          customer_name: selectedCustomer ? selectedCustomer.customer_name : 'Walk-in'
        }
        setModal(m => ({ ...m, sale: updated }))
        fetchSales()
        setEditing(false)
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function handleVoid() {
    if (!voidTarget) return
    setSaving(true)
    try {
      const r = await apiFetch(`${API_URL}/sales/${voidTarget.sale_id}/void`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ void_reason: voidReason }),
      })
      if (r.ok) {
        setVoidTarget(null)
        setVoidReason('')
        fetchSales()
        closeModal()
      } else {
        const d = await r.json()
        alert(d.error || 'Failed to void sale')
      }
    } catch { alert('Connection error') }
    finally { setSaving(false) }
  }

  const salesWithTiremen = React.useMemo(() => sales.map(s => {
    let ids = s.tireman_ids
    if (typeof ids === 'string') { try { ids = JSON.parse(ids) } catch { ids = [] } }
    const tiremanNames = (Array.isArray(ids) ? ids : []).map(id => staffMap[id]).filter(Boolean).join(', ')
    return { ...s, tiremanNames }
  }), [sales, staffMap])

  React.useEffect(() => {
    const q = search.trim().toLowerCase()
    if (!q) { setSuggestions([]); return }
    const seen = new Set()
    const results = []
    const add = (text, type, icon) => {
      if (!text || seen.has(text.trim())) return
      seen.add(text.trim())
      results.push({ text: text.trim(), type, icon })
    }
    for (const s of salesWithTiremen) {
      if (results.length >= 12) break
      if (s.invoice_number?.toLowerCase().includes(q)) add(s.invoice_number, 'INVOICE', '📋')
      if (s.customer_name?.toLowerCase().includes(q)) add(s.customer_name, 'CUSTOMER', '👤')
      if (s.staff_name?.toLowerCase().includes(q)) add(s.staff_name, 'HANDLED BY', '👷')
      if (s.sale_notes?.toLowerCase().includes(q)) add(s.sale_notes, 'NOTES', '📝')
      if (s.tiremanNames?.toLowerCase().includes(q)) {
        s.tiremanNames.split(', ').forEach(n => { if (n.toLowerCase().includes(q)) add(n, 'TIREMAN', '🔧') })
      }
      if (s.item_names) {
        s.item_names.split(',').forEach(name => { if (name.trim().toLowerCase().includes(q)) add(name.trim(), 'ITEM', '📦') })
      }
      if (s.brand?.toLowerCase().includes(q)) add(s.brand, 'BRAND', '🏷️')
      if (s.design?.toLowerCase().includes(q)) add(s.design, 'DESIGN', '🔖')
      if (s.tire_size?.toLowerCase().includes(q)) add(s.tire_size, 'SIZE', '📏')
      if (s.sale_id?.toLowerCase().includes(q)) add(s.sale_id, 'SALE ID', '🧾')
    }
    setSuggestions(results.slice(0, 12))
  }, [search, salesWithTiremen])


  const slColumns = React.useMemo(() => ([
    {
      key: 'sale_id_col',
      label: 'Date / Sale ID',
      render: (r) => (
        <div>
          <div className="sl-sale-id">{r.sale_id}</div>
          <div className="sl-datetime">{new Date(r.sale_datetime).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'})}</div>
        </div>
      )
    },
    {
      key: 'invoice',
      label: 'Invoice #',
      render: (r) => r.invoice_number ? <div className="sl-invoice">{r.invoice_number}</div> : <div className="sl-invoice-none">—</div>
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (r) => r.customer_name ? <div className="sl-customer">{r.customer_name}</div> : <div className="sl-walkin">Walk-in</div>
    },
    {
      key: 'payment',
      label: 'Payment',
      render: (r) => (
        r.payment_method
          ? <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: 4,
              background: r.payment_method === 'CREDIT' ? 'var(--th-rose-bg)' : 'var(--th-bg-card-alt)',
              color: r.payment_method === 'CREDIT' ? 'var(--th-rose)' : 'var(--th-sky)',
              border: `1px solid ${r.payment_method === 'CREDIT' ? 'var(--th-rose)' : 'var(--th-border-strong)'}`,
              whiteSpace: 'nowrap', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '0.03em' }}>
              {r.payment_method === 'CREDIT' ? '📒 CREDIT' : r.payment_method.replace('BANK_', '').replace('_', ' ')}
            </span>
          : <span style={{ color: 'var(--th-text-faint)', fontSize: '0.75rem' }}>—</span>
      )
    },
    {
      key: 'tireman',
      label: 'Tireman',
      render: (r) => {
        if (!r.tiremanNames) return <span style={{ color: 'var(--th-orange)', fontSize: '0.78rem', fontWeight: 600 }}>Picked Up</span>
        return <div style={{ fontSize: '0.78rem', color: 'var(--th-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>{r.tiremanNames}</div>
      }
    },
    {
      key: 'items',
      label: 'Items',
      render: (r) => {
        const names = (r.item_names || '').split(',').map(n => n.trim()).filter(Boolean)
        if (names.length === 0) return <span style={{color:'var(--th-text-faint)',fontSize:'0.78rem'}}>—</span>
        return (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.15rem' }}>
            {names.slice(0, 2).map((n, i) => (
              <span key={i} style={{ fontSize:'0.78rem', color:'var(--th-text-primary)', lineHeight:1.3,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'220px' }}>{n}</span>
            ))}
            {names.length > 2 && (
              <span style={{ fontSize:'0.72rem', color:'var(--th-text-faint)' }}>+{names.length - 2} more</span>
            )}
          </div>
        )
      }
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      render: (r) => (
        <div className="sl-amount-inline" style={{ whiteSpace: 'nowrap', fontFamily: "'Barlow Condensed',sans-serif", fontWeight:700, color: r.is_void ? 'var(--th-text-faint)' : 'var(--th-emerald)', fontSize:'1rem' }}>
          {fmt(r.total_amount)}
          <span style={{ marginLeft: '0.5rem', color: 'var(--th-text-faint)', fontSize: '0.85rem', fontWeight: 400 }}>
            {r.item_count || 0} item{r.item_count !== 1 ? 's' : ''}
          </span>
        </div>
      )
    }
  ]), [])

  const modalColumns = React.useMemo(() => ([
    {
      key: 'item_name',
      label: 'Item / Service',
      render: (d) => (
        <div>
          <div style={{fontWeight:600,color:'var(--th-text-primary)',fontSize:'0.84rem'}}>{d.item_name}</div>
          {(d.brand || d.tire_size || d.category) && (
            <div style={{fontSize:'0.72rem',color:'var(--th-text-faint)',whiteSpace:'normal'}}>
              {[d.brand, d.design, d.tire_size, d.category].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'sale_type',
      label: 'Type',
      render: (d) => <span className={`sl-type-badge ${d.sale_type === 'SERVICE' ? 'svc' : 'prd'}`}>{d.sale_type === 'SERVICE' ? 'Service' : 'Product'}</span>
    },
    { key: 'quantity', label: 'Qty', align: 'right' },
    {
      key: 'unit_price',
      label: 'Unit Price',
      align: 'right',
      render: (d) => <span style={{color:'var(--th-text-body)'}}>{fmt(d.unit_price)}</span>
    },
    {
      key: 'line_total',
      label: 'Total',
      align: 'right',
      render: (d) => <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,color:'var(--th-emerald)'}}>{fmt(d.line_total)}</span>
    }
  ]), [])

  const totalRevenue = kpi?.totalRevenue ?? sales.reduce((s, r) => s + (r.total_amount||0), 0)
  const todayRevenue = kpi?.todayRevenue ?? sales.filter(s => s.sale_datetime?.startsWith(today)).reduce((s,r) => s+(r.total_amount||0),0)
  const totalItems = kpi?.totalItems ?? sales.reduce((s,r) => s+(r.item_count||0),0)

  function exportExcel() {
    if (!salesWithTiremen.length) return
    import('xlsx').then(XLSX => {
      const rows = salesWithTiremen.map(s => ({
        'Sale ID':       s.sale_id,
        'Date':          s.sale_datetime?.slice(0, 10),
        'Time':          s.sale_datetime?.slice(11, 16),
        'Invoice #':     s.invoice_number || '',
        'Customer':      s.customer_name || 'Walk-in',
        'Payment Method': s.payment_method ? s.payment_method.replace('BANK_', 'Bank Transfer ') : '',
        'Handled By':    s.staff_name || '',
        'Items':         s.item_names || '',
        'Total (₱)':     s.total_amount,
        'Status':        s.is_void ? 'VOIDED' : 'ACTIVE',
        'Notes':         s.sale_notes || '',
      }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Sales')
      XLSX.writeFile(wb, `sales-${startDate}-to-${endDate}.xlsx`)
    })
  }

  return (
    <div className="sl-root">
      <div className="sl-header-row">
        <div className="th-title-format">
          Sales <span style={{ color: 'var(--th-sky)' }}>Ledger</span>
          {isShopClosed && (
            <div className="pos-closed-badge" style={{ marginLeft: '1rem', display: 'inline-flex', verticalAlign: 'middle' }}>
              <span className="pulse"></span>
              NEXT DAY MODE
            </div>
          )}
        </div>
        <div className="sl-header-actions">
          <button className="sl-export-btn sl-export-desktop" onClick={exportExcel}>⬇ Export Excel</button>
        </div>
      </div>

      <div className="th-kpi-row">
        <KpiCard label="Period Revenue" value={fmtCompact(totalRevenue)} accent="sky" loading={loading} sub={`${slTotal} transactions`} />
        <KpiCard label="Today's Revenue" value={fmtCompact(todayRevenue)} accent="emerald" loading={loading} />
        <KpiCard label="Items Sold" value={totalItems} accent="violet" loading={loading} sub="In selected period" />
      </div>

      <div style={{ marginTop: '0', marginBottom: '0' }}>
        <FilterHeader
          searchProps={{
            value: search,
            onChange: setSearch,
            placeholder: "Search invoice, customer, tireman, item...",
            suggestions: suggestions,
            onSuggestionSelect: s => setSearch(s.text),
            resultCount: search.trim() ? salesWithTiremen.length : undefined,
            totalCount: slTotal,
            resultLabel: "sales",
          }}
          leftComponent={
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input className="fh-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <span style={{ color: 'var(--th-text-faint)', fontSize: '0.8rem' }}>to</span>
              <input className="fh-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          }
          accentColor="var(--th-sky)"
        />
        
        {/* Mobile Export Button — appears below the search card */}
        <button 
          className="sl-export-btn sl-export-mobile" 
          onClick={exportExcel}
          disabled={loading || !salesWithTiremen.length}
          style={{ width: '100%', marginTop: '0.75rem' }}
        >
          ⬇ Export to Excel
        </button>
      </div>

      <DataTable
        columns={slColumns}
        rows={salesWithTiremen}
        rowKey="sale_id"
        onRowClick={openModal}
        selectedKey={modal?.sale.sale_id}
        loading={loading}
        skeletonRows={10}
        minWidth={850}
        getRowStyle={(r) => r.is_void ? { opacity: 0.5 } : undefined}
        emptyTitle="No Sales Found"
        emptyMessage={search.trim() ? "No sales match your search." : "No transactions in this period."}
        currentPage={slPage}
        totalPages={slTotalPages}
        onPageChange={setSlPage}
      />

      {/* Sale Detail Modal */}
      {modal && (
        <div className="sl-overlay" onClick={closeModal}>
          <div className="sl-modal" onClick={e => e.stopPropagation()}>
            <div className="sl-modal-header">
              <div style={{ display:'flex', flexDirection:'column' }}>
                <div className="sl-modal-title">Sale Details</div>
                <div className="sl-modal-invoice">{modal.sale.sale_id}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                {!modal.sale.is_void && (
                  <button className="th-btn th-btn-ghost" style={{ padding: '0.4rem 0.75rem', fontSize:'0.75rem' }} onClick={startEdit} disabled={editing}>
                    Edit Header
                  </button>
                )}
                {!!modal.sale.is_void && <span className="sl-type-badge svc" style={{background:'var(--th-rose-bg)',color:'var(--th-rose)'}}>VOIDED</span>}
                <button className="sl-modal-close" onClick={closeModal}>✕</button>
              </div>
            </div>

            <div className="sl-modal-body">
              {editing ? (
                <div className="animate-fade-in" style={{ padding: '1rem', background: 'var(--th-bg-card-alt)', borderRadius: 10, border: '1px solid var(--th-border-strong)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label className="sl-meta-label">Invoice Number</label>
                      <input className="sl-input" value={editInvoice} onChange={e => setEditInvoice(e.target.value)} style={{ width:'100%', padding:'0.5rem', background:'var(--th-bg-input)', border:'1px solid var(--th-border)', borderRadius:6, color:'var(--th-text-primary)' }} />
                    </div>
                    <div>
                      <label className="sl-meta-label">Customer</label>
                      <select className="sl-input" value={editCustomerId} onChange={e => setEditCustomerId(e.target.value)} style={{ width:'100%', padding:'0.5rem', background:'var(--th-bg-input)', border:'1px solid var(--th-border)', borderRadius:6, color:'var(--th-text-primary)' }}>
                        <option value="">Walk-in</option>
                        {customers.map(c => <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="sl-meta-label">Internal Notes</label>
                    <textarea className="sl-input" rows="2" value={editNotes} onChange={e => setEditNotes(e.target.value)} style={{ width:'100%', padding:'0.5rem', background:'var(--th-bg-input)', border:'1px solid var(--th-border)', borderRadius:6, color:'var(--th-text-primary)', resize:'none' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
                    <button className="th-btn th-btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
                    <button className="th-btn th-btn-sky" onClick={saveEdit}>Save Changes</button>
                  </div>
                </div>
              ) : (
                <div className="sl-meta-grid">
                  <div className="sl-meta-card">
                    <div className="sl-meta-label">Customer</div>
                    <div className="sl-meta-val">{modal.sale.customer_name || 'Walk-in'}</div>
                  </div>
                  <div className="sl-meta-card">
                    <div className="sl-meta-label">Date & Time</div>
                    <div className="sl-meta-val">{new Date(modal.sale.sale_datetime).toLocaleString('en-PH')}</div>
                  </div>
                  <div className="sl-meta-card">
                    <div className="sl-meta-label">Payment Method</div>
                    <div className="sl-meta-val sky" style={{ textTransform: 'uppercase' }}>{modal.sale.payment_method?.replace('_', ' ')}</div>
                  </div>
                  <div className="sl-meta-card span2">
                    <div className="sl-meta-label">Handled By</div>
                    <div className="sl-meta-val">{modal.sale.staff_name}</div>
                  </div>
                  <div className="sl-meta-card">
                    <div className="sl-meta-label">Tireman(s)</div>
                    <div className="sl-meta-val">
                      {modal.sale.tiremanNames ? modal.sale.tiremanNames : <span style={{ color: 'var(--th-orange)' }}>Picked Up</span>}
                    </div>
                  </div>
                </div>
              )}

              <div className="sl-section-title">Transaction Items</div>
              <DataTable
                columns={modalColumns}
                rows={modal.details}
                rowKey="sale_item_id"
                loading={loadingDetails}
                skeletonRows={3}
                minWidth={0}
              />

              <div className="sl-modal-total">
                <span className="sl-modal-total-label">Grand Total</span>
                <span className="sl-modal-total-val">{fmt(modal.sale.total_amount)}</span>
              </div>

              {!!modal.sale.sale_notes && (
                <div style={{ padding: '0.75rem 1rem', background: 'var(--th-bg-card-alt)', borderRadius: 8, borderLeft: '3px solid var(--th-orange)' }}>
                  <div className="sl-meta-label" style={{ marginBottom: '0.2rem' }}>Internal Notes</div>
                  <div style={{ fontSize: '0.86rem', color: 'var(--th-text-body)', whiteSpace: 'pre-wrap' }}>{modal.sale.sale_notes}</div>
                </div>
              )}
              
              {!!modal.sale.is_void && (
                <div style={{ padding: '0.75rem 1rem', background: 'var(--th-rose-bg)', color: 'var(--th-rose)', borderRadius: 8, fontSize: '0.85rem' }}>
                  <div className="sl-meta-label" style={{ color:'var(--th-rose)', marginBottom:'0.2rem' }}>Void Reason</div>
                  <strong>{modal.sale.void_reason || 'No reason provided.'}</strong>
                </div>
              )}

              {!modal.sale.is_void && !editing && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', float: 'inline-end', justifyContent: 'flex-start' }}>
                  <button 
                    onClick={() => setVoidTarget(modal.sale)}
                    style={{ 
                      background: 'none', border: 'none', color: 'var(--th-text-faint)', 
                      fontSize: '0.72rem', cursor: 'pointer', opacity: 0.5, 
                      textDecoration: 'underline', transition: 'opacity 0.2s' 
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
                  >
                    Void this transaction
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Save Edit */}
      {pendingSaveEdit && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <div className="confirm-title">Update Header?</div>
            <p className="th-text-sm" style={{color:'var(--th-text-body)', marginBottom:'1.5rem'}}>Save changes to invoice and customer details?</p>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => setPendingSaveEdit(null)}>Cancel</button>
              <button className="confirm-btn-ok" onClick={confirmSaveEdit} disabled={saving}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Void confirmation */}
      {voidTarget && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <div className="confirm-title">Void this Transaction?</div>
            <div className="confirm-details">
              <div className="confirm-detail-row"><span className="confirm-detail-label">Sale ID</span><span className="confirm-detail-val">{voidTarget.sale_id}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Total</span><span className="confirm-detail-val">{fmt(voidTarget.total_amount)}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Action</span><span className="confirm-detail-val" style={{color:'var(--th-rose)'}}>Restocks inventory + voids labor</span></div>
            </div>
            <div className="sl-field" style={{marginTop:'1rem', marginBottom:'1rem'}}>
              <div className="sl-label">Reason for voiding</div>
              <input className="sl-input" value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="e.g. Wrong items selected" style={{width:'100%', padding:'0.5rem', background:'var(--th-bg-input)', border:'1px solid var(--th-border)', borderRadius:6, color:'var(--th-text-primary)'}} />
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => setVoidTarget(null)}>Cancel</button>
              <button className="confirm-btn-ok danger" onClick={handleVoid} disabled={saving}>
                {saving ? 'Voiding...' : 'Yes, Void Sale'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SalesPage
