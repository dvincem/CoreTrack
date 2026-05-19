import '../pages_css/SalesPage.css';
import React from 'react'
import { API_URL, apiFetch } from '../lib/config'
import DataTable from '../components/DataTable'
import KpiCard from '../components/KpiCard'
import SearchInput from '../components/SearchInput'
import FilterHeader from '../components/FilterHeader'
import usePaginatedResource from '../hooks/usePaginatedResource'
import { useSearchPrefill } from '../hooks/useSearchPrefill'



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
  const [activePreset, setActivePreset] = React.useState('')
  const [kpi, setKpi] = React.useState(null)

  const [viewMode, setViewMode] = React.useState('transactions') // 'transactions' | 'items'

  const { data: sales, page: slPage, setPage: setSlPage, totalPages: slTotalPages,
    total: slTotal, search, setSearch, loading, refetch: fetchSales } =
    usePaginatedResource({
      url: `${API_URL}/sales/${shopId}`,
      perPage: SL_PAGE_SIZE,
      extraParams: { startDate, endDate },
      enabled: !!shopId && viewMode === 'transactions',
      deps: [shopId, startDate, endDate, viewMode],
    })

  const { data: itemsList, page: itemPage, setPage: setItemPage, totalPages: itemTotalPages,
    total: itemTotal, search: itemSearch, setSearch: setItemSearch, loading: itemLoading, refetch: fetchItems, stats: itemStats } =
    usePaginatedResource({
      url: `${API_URL}/sales/${shopId}/items-list`,
      perPage: SL_PAGE_SIZE,
      extraParams: { startDate, endDate, paginated: true },
      enabled: !!shopId && viewMode === 'items',
      deps: [shopId, startDate, endDate, viewMode],
    })

  // Modal state
  const [modal, setModal] = React.useState(null) // { sale, details }
  const [loadingDetails, setLoadingDetails] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [voidTarget, setVoidTarget] = React.useState(null)
  const [voidReason, setVoidReason] = React.useState('')
  const [customers, setCustomers] = React.useState([])
  const [inlineEditingField, setInlineEditingField] = React.useState(null) // customer, payment, invoice, notes
  const [inlineEditVal, setInlineEditVal] = React.useState('')

  const prefill = useSearchPrefill('sales')
  React.useEffect(() => {
    if (prefill.q) setSearch(prefill.q)
  }, [])

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
    setModal({ sale, details: [] })
    setLoadingDetails(true)
    try {
      const r = await apiFetch(`${API_URL}/sales/${sale.sale_id}/details`)
      const d = await r.json()
      setModal({ sale, details: Array.isArray(d) ? d : [] })
    } catch { setModal({ sale, details: [] }) }
    finally { setLoadingDetails(false) }
  }

  function closeModal() { setModal(null) }

  async function commitInlineEdit(field, newVal) {
    const saleId = modal.sale.sale_id
    const payload = {
      invoice_number: modal.sale.invoice_number,
      sale_notes: modal.sale.sale_notes,
      customer_id: modal.sale.customer_id,
      payment_method: modal.sale.payment_method || 'CASH'
    }

    if (field === 'customer') payload.customer_id = newVal === "" ? null : newVal
    else if (field === 'payment') payload.payment_method = newVal
    else if (field === 'invoice') payload.invoice_number = newVal
    else if (field === 'notes') payload.sale_notes = newVal

    setSaving(true)
    try {
      const r = await apiFetch(`${API_URL}/sales/${saleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (r.ok) {
        const updated = { ...modal.sale, ...payload }
        if (field === 'customer') {
          const cust = customers.find(c => String(c.customer_id) === String(payload.customer_id))
          updated.customer_name = cust ? cust.customer_name : 'Walk-in'
        }
        setModal(m => ({ ...m, sale: updated }))
        fetchSales()
        setInlineEditingField(null)
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

  const pencilIcon = (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: '4px', cursor: 'pointer', opacity: 0.6 }}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )

  const itemColumns = React.useMemo(() => ([
    {
      key: 'time', label: 'Time', render: r => (
        <div>
          <div className="sl-datetime" style={{ fontSize: '0.8rem', color: 'var(--th-text-body)' }}>{new Date(r.sale_datetime).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--th-text-faint)' }}>{new Date(r.sale_datetime).toLocaleDateString('en-PH')}</div>
        </div>
      )
    },
    {
      key: 'invoice', label: 'Invoice #', render: r => (
        <div style={{ cursor: 'pointer' }} onClick={() => openModal({ sale_id: r.sale_id })}>
          {r.invoice_number ? <div className="sl-invoice" style={{ display: 'inline-block' }}>{r.invoice_number}</div> : <div className="sl-invoice" style={{ display: 'inline-block' }}>{r.sale_id}</div>}
        </div>
      )
    },
    {
      key: 'product', label: 'Product', render: r => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--th-text-primary)', fontSize: '0.84rem' }}>{r.item_name}</div>
          {(r.brand || r.tire_size || r.category) && (
            <div style={{ fontSize: '0.72rem', color: 'var(--th-text-faint)' }}>
              {[r.brand, r.tire_size, r.category].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      )
    },
    { key: 'qty', label: 'Qty', align: 'center', render: r => <div style={{ fontWeight: 600 }}>{r.quantity}</div> },
    { key: 'price', label: 'Unit Price', align: 'right', render: r => <div style={{ color: 'var(--th-text-body)' }}>{fmt(r.unit_price)}</div> },
    { key: 'total', label: 'Total', align: 'right', render: r => <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, color: 'var(--th-emerald)', fontSize: '0.95rem' }}>{fmt(r.line_total)}</div> }
  ]), [])

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

  const totalRevenue = kpi?.totalRevenue ?? sales.filter(r => !r.is_void).reduce((s, r) => s + (r.total_amount||0), 0)
  const todayRevenue = kpi?.todayRevenue ?? sales.filter(s => !s.is_void && s.sale_datetime?.startsWith(today)).reduce((s,r) => s+(r.total_amount||0),0)
  const totalItems = kpi?.totalItems ?? sales.filter(r => !r.is_void).reduce((s,r) => s+(r.item_count||0),0)
  const kpiTransactionCount = kpi?.totalTransactions ?? slTotal

  const itemsTotalUnits = itemStats?.totalUnits || 0
  const itemsTotalRevenue = itemStats?.totalRevenue || 0
  const itemsUniqueBrands = itemStats?.uniqueBrands || 0

  function handleToggleMode(mode) {
    setViewMode(mode);
  }

  const applyPreset = (preset) => {
    const now = new Date()
    let start, end = today
    if (preset === 'today') {
      start = today
    } else if (preset === 'week') {
      start = new Date(now.setDate(now.getDate() - now.getDay())).toISOString().split('T')[0]
    } else if (preset === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    } else if (preset === 'year') {
      start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
    }
    setStartDate(start)
    setEndDate(end)
    setActivePreset(preset)
  }

  function exportExcel() {
    if (viewMode === 'transactions' && !salesWithTiremen.length) return
    if (viewMode === 'items' && !(itemsList && itemsList.length)) return
    import('xlsx').then(XLSX => {
      let rows;
      let sheetName;
      let filename;
      
      if (viewMode === 'transactions') {
        rows = salesWithTiremen.map(s => ({
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
        sheetName = 'Sales'
        filename = `sales-${startDate}-to-${endDate}.xlsx`
      } else {
        rows = itemsList.map(i => ({
          'Date':          i.sale_datetime?.slice(0, 10),
          'Time':          i.sale_datetime?.slice(11, 16),
          'Invoice #':     i.invoice_number || i.sale_id,
          'Item Name':     i.item_name,
          'Brand':         i.brand || '',
          'Size':          i.tire_size || '',
          'Qty':           i.quantity,
          'Unit Price':    i.unit_price,
          'Total':         i.line_total,
          'Customer':      i.customer_name || 'Walk-in'
        }))
        sheetName = 'Products Sold'
        filename = `products-sold-${startDate}-to-${endDate}.xlsx`
      }
      
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName)
      XLSX.writeFile(wb, filename)
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
        {viewMode === 'transactions' ? (
          <>
            <KpiCard label="Period Revenue" value={fmtCompact(totalRevenue)} accent="sky" loading={loading} sub={`${kpiTransactionCount} transactions (excl. voids)`} />
            <KpiCard label="Today's Revenue" value={fmtCompact(todayRevenue)} accent="emerald" loading={loading} />
            <KpiCard label="Items Sold" value={totalItems} accent="violet" loading={loading} sub="In selected period" />
          </>
        ) : (
          <>
            <KpiCard label="Units Sold" value={itemsTotalUnits} accent="sky" loading={itemLoading} sub={`${itemTotal} records`} />
            <KpiCard label="Product Revenue" value={fmtCompact(itemsTotalRevenue)} accent="emerald" loading={itemLoading} sub="Products & Recap only" />
            <KpiCard label="Unique Brands" value={itemsUniqueBrands} accent="violet" loading={itemLoading} sub="In selected period" />
          </>
        )}
      </div>

      <div style={{ marginTop: '0', marginBottom: '0' }}>
        <FilterHeader
          searchProps={{
            value: viewMode === 'transactions' ? search : itemSearch,
            onChange: viewMode === 'transactions' ? setSearch : setItemSearch,
            placeholder: viewMode === 'transactions' ? "Search invoice, customer, tireman, item..." : "Search item, brand, size, invoice...",
            suggestions: [],
            onSuggestionSelect: s => viewMode === 'transactions' ? setSearch(s.text) : setItemSearch(s.text),
            resultCount: viewMode === 'transactions' ? (search.trim() ? salesWithTiremen.length : undefined) : (itemSearch.trim() ? (itemsList ? itemsList.length : 0) : undefined),
            totalCount: viewMode === 'transactions' ? slTotal : itemTotal,
            resultLabel: viewMode === 'transactions' ? "sales" : "items",
          }}
          leftComponent={
            <div className="sl-filters-wrapper">
              <div className="sl-view-toggle">
                <button
                  onClick={() => handleToggleMode('transactions')}
                  className="sl-view-btn"
                  style={{
                    borderRight: "1.5px solid var(--th-sky)",
                    background: viewMode === 'transactions' ? "var(--th-sky)" : "transparent",
                    color: viewMode === 'transactions' ? "#fff" : "var(--th-text-faint)",
                    opacity: viewMode === 'transactions' ? 1 : 0.5,
                  }}
                >
                  📋 Invoices
                </button>
                <button
                  onClick={() => handleToggleMode('items')}
                  className="sl-view-btn"
                  style={{
                    background: viewMode === 'items' ? "var(--th-sky)" : "transparent",
                    color: viewMode === 'items' ? "#fff" : "var(--th-text-faint)",
                    opacity: viewMode === 'items' ? 1 : 0.5,
                  }}
                >
                  📦 Items Sold
                </button>
              </div>

              <div className="sl-filter-group">
                <span className="sl-filter-label">From</span>
                <input className="sl-filter-date" type="date" max={today} value={startDate} onChange={e => { setStartDate(e.target.value); setActivePreset(''); }} />
                <span className="sl-filter-label">To</span>
                <input className="sl-filter-date" type="date" max={today} value={endDate} onChange={e => { setEndDate(e.target.value); setActivePreset(''); }} />
              </div>
            </div>
          }
          filters={[
            { value: 'today', label: 'Today', active: activePreset === 'today' },
            { value: 'week', label: 'This Week', active: activePreset === 'week' },
            { value: 'month', label: 'This Month', active: activePreset === 'month' },
            { value: 'year', label: 'This Year', active: activePreset === 'year' }
          ]}
          onFilterChange={applyPreset}
          accentColor="var(--th-sky)"
        />
        
        {/* Mobile Export Button — appears below the search card */}
        <button 
          className="sl-export-btn sl-export-mobile" 
          onClick={exportExcel}
          disabled={(viewMode === 'transactions' ? loading : itemLoading) || (viewMode === 'transactions' ? !salesWithTiremen.length : !(itemsList && itemsList.length))}
          style={{ width: '100%', marginTop: '0.75rem' }}
        >
          ⬇ Export to Excel
        </button>
      </div>

      {viewMode === 'transactions' ? (
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
      ) : (
        <DataTable
          columns={itemColumns}
          rows={itemsList || []}
          rowKey="sale_item_id"
          loading={itemLoading}
          skeletonRows={10}
          minWidth={700}
          emptyTitle="No Items Found"
          emptyMessage={itemSearch.trim() ? "No items match your search." : "No products sold on this date."}
          currentPage={itemPage}
          totalPages={itemTotalPages}
          onPageChange={setItemPage}
        />
      )}

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
                {!!modal.sale.is_void && <span className="sl-type-badge svc" style={{background:'var(--th-rose-bg)',color:'var(--th-rose)'}}>VOIDED</span>}
                <button className="sl-modal-close" onClick={closeModal}>✕</button>
              </div>
            </div>

            <div className="sl-modal-body">
                <div className="sl-meta-grid">
                  <div className="sl-meta-card">
                    <div className="sl-meta-label">Customer</div>
                    {inlineEditingField === 'customer' ? (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <select 
                          className="sl-input" 
                          value={inlineEditVal} 
                          onChange={e => setInlineEditVal(e.target.value)} 
                          style={{ flex: 1, padding: '2px 4px', fontSize: '0.8rem' }}
                        >
                          <option value="">Walk-in</option>
                          {customers.map(c => <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>)}
                        </select>
                        <button onClick={() => commitInlineEdit('customer', inlineEditVal)} style={{ background: 'none', border: 'none', color: 'var(--th-emerald)', cursor: 'pointer' }}>✓</button>
                        <button onClick={() => setInlineEditingField(null)} style={{ background: 'none', border: 'none', color: 'var(--th-rose)', cursor: 'pointer' }}>✕</button>
                      </div>
                    ) : (
                      <div className="sl-meta-val" style={{ display: 'flex', alignItems: 'center' }}>
                        {modal.sale.customer_name || 'Walk-in'}
                        <span onClick={() => { setInlineEditingField('customer'); setInlineEditVal(modal.sale.customer_id || ''); }}>{pencilIcon}</span>
                      </div>
                    )}
                  </div>
                  <div className="sl-meta-card">
                    <div className="sl-meta-label">Invoice Number</div>
                    {inlineEditingField === 'invoice' ? (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input 
                          className="sl-input" 
                          value={inlineEditVal} 
                          onChange={e => setInlineEditVal(e.target.value)} 
                          onKeyDown={e => e.key === 'Enter' && commitInlineEdit('invoice', inlineEditVal)}
                          autoFocus
                          style={{ flex: 1, padding: '2px 4px', fontSize: '0.8rem' }}
                        />
                        <button onClick={() => commitInlineEdit('invoice', inlineEditVal)} style={{ background: 'none', border: 'none', color: 'var(--th-emerald)', cursor: 'pointer' }}>✓</button>
                        <button onClick={() => setInlineEditingField(null)} style={{ background: 'none', border: 'none', color: 'var(--th-rose)', cursor: 'pointer' }}>✕</button>
                      </div>
                    ) : (
                      <div className="sl-meta-val" style={{ display: 'flex', alignItems: 'center' }}>
                        {modal.sale.invoice_number || '—'}
                        <span onClick={() => { setInlineEditingField('invoice'); setInlineEditVal(modal.sale.invoice_number || ''); }}>{pencilIcon}</span>
                      </div>
                    )}
                  </div>
                  <div className="sl-meta-card">
                    <div className="sl-meta-label">Payment Method</div>
                    {inlineEditingField === 'payment' ? (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <select 
                          className="sl-input" 
                          value={inlineEditVal} 
                          onChange={e => setInlineEditVal(e.target.value)} 
                          style={{ flex: 1, padding: '2px 4px', fontSize: '0.8rem' }}
                        >
                          <option value="CASH">Cash</option>
                          <option value="GCASH">GCash</option>
                          <option value="BANK_BPI">BPI</option>
                          <option value="BANK_BDO">BDO</option>
                          <option value="CARD">Card</option>
                          <option value="CHECK">Check</option>
                          <option value="CREDIT">Credit</option>
                        </select>
                        <button onClick={() => commitInlineEdit('payment', inlineEditVal)} style={{ background: 'none', border: 'none', color: 'var(--th-emerald)', cursor: 'pointer' }}>✓</button>
                        <button onClick={() => setInlineEditingField(null)} style={{ background: 'none', border: 'none', color: 'var(--th-rose)', cursor: 'pointer' }}>✕</button>
                      </div>
                    ) : (
                      <div className="sl-meta-val sky" style={{ textTransform: 'uppercase', display: 'flex', alignItems: 'center' }}>
                        {modal.sale.payment_method?.replace('_', ' ')}
                        <span onClick={() => { setInlineEditingField('payment'); setInlineEditVal(modal.sale.payment_method || 'CASH'); }}>{pencilIcon}</span>
                      </div>
                    )}
                  </div>
                  <div className="sl-meta-card">
                    <div className="sl-meta-label">Date & Time</div>
                    <div className="sl-meta-val">{new Date(modal.sale.sale_datetime).toLocaleString('en-PH')}</div>
                  </div>
                  <div className="sl-meta-card">
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

              <div style={{ padding: '0.75rem 1rem', background: 'var(--th-bg-card-alt)', borderRadius: 8, borderLeft: '3px solid var(--th-orange)' }}>
                <div className="sl-meta-label" style={{ marginBottom: '0.2rem', display: 'flex', alignItems: 'center' }}>
                  Internal Notes
                  {inlineEditingField !== 'notes' && (
                    <span onClick={() => { setInlineEditingField('notes'); setInlineEditVal(modal.sale.sale_notes || ''); }}>{pencilIcon}</span>
                  )}
                </div>
                {inlineEditingField === 'notes' ? (
                  <div>
                    <textarea 
                      className="sl-input" 
                      rows="3" 
                      value={inlineEditVal} 
                      onChange={e => setInlineEditVal(e.target.value)} 
                      style={{ width: '100%', padding: '0.5rem', background: 'var(--th-bg-input)', border: '1px solid var(--th-border)', borderRadius: 6, color: 'var(--th-text-primary)', resize: 'none' }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button className="th-btn th-btn-sky" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }} onClick={() => commitInlineEdit('notes', inlineEditVal)}>Save</button>
                      <button className="th-btn th-btn-ghost" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }} onClick={() => setInlineEditingField(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.86rem', color: 'var(--th-text-body)', whiteSpace: 'pre-wrap' }}>
                    {modal.sale.sale_notes || <span style={{ color: 'var(--th-text-faint)', fontStyle: 'italic' }}>No notes</span>}
                  </div>
                )}
              </div>
              
              {!!modal.sale.is_void && (
                <div style={{ padding: '0.75rem 1rem', background: 'var(--th-rose-bg)', color: 'var(--th-rose)', borderRadius: 8, fontSize: '0.85rem' }}>
                  <div className="sl-meta-label" style={{ color:'var(--th-rose)', marginBottom:'0.2rem' }}>Void Reason</div>
                  <strong>{modal.sale.void_reason || 'No reason provided.'}</strong>
                </div>
              )}

              {!modal.sale.is_void && (
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
