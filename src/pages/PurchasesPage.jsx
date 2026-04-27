import React from 'react'
import { API_URL, currency, apiFetch } from '../lib/config'
import SearchInput from '../components/SearchInput'
import DataTable from '../components/DataTable'
import KpiCard from '../components/KpiCard'
import FilterHeader from '../components/FilterHeader'

// ── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_TIRE_CATS      = ['PCR', 'SUV', 'TBR', 'LT', 'MOTORCYCLE', 'TUBE', 'RECAP']
const DEFAULT_INV_OTHER_CATS = ['VALVE', 'WHEEL WEIGHT', 'WHEEL BALANCING', 'MAG WHEEL', 'ACCESSORIES', 'OTHER']
const DEFAULT_SUPPLY_CATS    = ['Consumable', 'Maintenance', 'Repair Material', 'Other Supply']

const LS_KEYS = { tire: 'pur-cats-tire-v2', other: 'pur-cats-other', supply: 'pur-cats-supply' }
function loadCats(key, defaults) {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : [...defaults] } catch { return [...defaults] }
}
function saveCats(key, cats) {
  try { localStorage.setItem(key, JSON.stringify(cats)) } catch {}
}

const ADD_NEW = '__ADD_NEW__'

function CategorySelect({ value, onChange, options, setOptions, storageKey, height = 38 }) {
  const handleChange = (e) => {
    if (e.target.value === ADD_NEW) {
      const name = window.prompt('Enter new category name:')
      if (name && name.trim()) {
        const trimmed = name.trim()
        const next = options.includes(trimmed) ? options : [...options, trimmed]
        setOptions(next)
        saveCats(storageKey, next)
        onChange(trimmed)
      }
    } else {
      onChange(e.target.value)
    }
  }

  return (
    <select className="pur-input" style={{ height }} value={value} onChange={handleChange}>
      {options.map(c => <option key={c} value={c}>{c}</option>)}
      <option value={ADD_NEW}>+ Add category…</option>
    </select>
  )
}

function extractRimSize(s) {
  if (!s) return null
  const r = s.match(/R(\d+)/i)
  if (r) return parseInt(r[1])
  const d = s.match(/-(\d+)$/)
  if (d) return parseInt(d[1])
  return null
}

function buildSKU(form, itemType) {
  const parts = []
  if (itemType === 'TIRE') {
    if (form.brand)  parts.push(form.brand.trim().substring(0, 5).toUpperCase())
    if (form.design) parts.push(form.design.trim().substring(0, 4).toUpperCase())
    if (form.size)   parts.push(form.size.trim().replace(/[\/ \-]/g, ''))
  } else {
    if (form.item_name) parts.push(form.item_name.trim().substring(0, 8).toUpperCase().replace(/\s+/g, '-'))
    if (form.category)  parts.push(form.category.toUpperCase().replace(/\s+/g, ''))
  }
  if (parts.length === 0) return ''
  return (itemType === 'TIRE' ? 'TIRE' : 'ITEM') + '-' + parts.join('-')
}

const TODAY = new Date().toISOString().split('T')[0]

const BLANK_INV = (itemType) => ({
  item_name: '', brand: '', design: '', size: '', rim_size: '',
  dot_number: '', category: itemType === 'TIRE' ? 'TIRE' : 'VALVE',
  unit_cost: '', selling_price: '',
  quantity: '1', reorder_point: '5', notes: '',
})

const BLANK_SUP = () => ({
  item_name: '', category: 'Consumable',
  quantity: '1', unit_cost: '', notes: '',
})

// ── Component ────────────────────────────────────────────────────────────────
function PurchasesPage({ shopId, currentStaffId, isShopClosed }) {
  const [showModal, setShowModal] = React.useState(false)
  const [modalTab, setModalTab]   = React.useState('inv') // 'inv' | 'sup'

  // Inventory form
  const [itemType, setItemType] = React.useState('TIRE')
  const [invForm, setInvForm]   = React.useState(BLANK_INV('TIRE'))

  // Supplies form
  const [supForm, setSupForm]   = React.useState(BLANK_SUP())

  const [pending, setPending]   = React.useState(null) // { type: 'inv'|'sup', data: {} }
  const [saving, setSaving]     = React.useState(false)
  const [suppliers, setSuppliers] = React.useState([])
  const [tireCats, setTireCats]         = React.useState(() => loadCats(LS_KEYS.tire, DEFAULT_TIRE_CATS))
  const [otherCats, setOtherCats]       = React.useState(() => loadCats(LS_KEYS.other, DEFAULT_INV_OTHER_CATS))
  const [supplyCats, setSupplyCats]     = React.useState(() => loadCats(LS_KEYS.supply, DEFAULT_SUPPLY_CATS))

  // History List
  const [startDate, setStartDate] = React.useState(TODAY)
  const [endDate,   setEndDate]   = React.useState(TODAY)
  const [histTab,   setHistTab]   = React.useState('all') // 'all'|'inv'|'sup'
  const [baseRows,  setBaseRows]  = React.useState([])
  const [loading,   setLoading]   = React.useState(false)
  const [search,    setSearch]    = React.useState('')
  const [page,      setPage]      = React.useState(1)
  const PAGE_SIZE = 15

  const [detailRow, setDetailRow] = React.useState(null)
  const [toast,     setToast]     = React.useState(null)

  React.useEffect(() => {
    fetchSuppliers()
    load()
  }, [shopId, startDate, endDate])

  async function fetchSuppliers() {
    try {
      const r = await apiFetch(`${API_URL}/suppliers/${shopId}`)
      const d = await r.json()
      setSuppliers(Array.isArray(d) ? d : [])
    } catch {}
  }

  async function load() {
    setLoading(true)
    try {
      const r = await apiFetch(`${API_URL}/purchases-history/${shopId}?startDate=${startDate}&endDate=${endDate}`)
      const d = await r.json()
      setBaseRows(Array.isArray(d) ? d : [])
    } catch { setBaseRows([]) }
    finally { setLoading(false) }
  }

  function showToast(msg, ok=true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const setInvField = (k, v) => setInvForm(f => ({ ...f, [k]: v }))

  const handleInvConfirm = () => {
    if (itemType === 'TIRE') {
      if (!invForm.brand || !invForm.design || !invForm.size || !invForm.dot_number || !invForm.unit_cost) {
        return alert('Please fill in all required tire fields.')
      }
    } else {
      if (!invForm.item_name || !invForm.unit_cost) {
        return alert('Please fill in required item fields.')
      }
    }
    setPending({ type: 'inv', data: { ...invForm, item_type: itemType } })
  }

  const handleSupConfirm = () => {
    if (!supForm.item_name || !supForm.unit_cost) return alert('Fill required fields.')
    setPending({ type: 'sup', data: { ...supForm } })
  }

  async function savePending() {
    setSaving(true)
    try {
      const isInv = pending.type === 'inv'
      const url = isInv ? `${API_URL}/items` : `${API_URL}/purchases-supplies`
      const payload = {
        ...pending.data,
        shop_id: shopId,
        recorded_by: currentStaffId || 'ADMIN',
        purchase_date: TODAY,
      }
      if (isInv) {
        payload.sku = buildSKU(payload, itemType)
        payload.rim_size = extractRimSize(payload.size)
      }

      const res = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      showToast(`Recorded: ${pending.data.item_name || (pending.data.brand + ' ' + pending.data.design)}`)
      setPending(null)
      setShowModal(false)
      setInvForm(BLANK_INV(itemType))
      setSupForm(BLANK_SUP())
      load()
    } catch (e) {
      alert(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const closeModal = () => { setShowModal(false); setPending(null) }

  // ── Derived ──
  const histRows = React.useMemo(() => {
    let list = [...baseRows]
    if (histTab === 'inv') list = list.filter(r => !!r.item_master_id)
    if (histTab === 'sup') list = list.filter(r => !r.item_master_id)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.item_name?.toLowerCase().includes(q) ||
        r.brand?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q) ||
        r.category?.toLowerCase().includes(q)
      )
    }
    return list
  }, [baseRows, histTab, search])

  const totalPages = Math.ceil(histRows.length / PAGE_SIZE) || 1
  const pagedRows  = histRows.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)

  const invRows = histRows.filter(r => !!r.item_master_id)
  const supRows = histRows.filter(r => !r.item_master_id)
  const invSpent = invRows.reduce((s, r) => s + (r.line_total || 0), 0)
  const supSpent = supRows.reduce((s, r) => s + (r.line_total || 0), 0)

  const fmtDateTime = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('en-PH', { month:'short', day:'numeric' }) + ' ' + d.toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' })
  }

  return (
    <>
      {toast && (
        <div style={{
          position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999,
          background: toast.ok ? 'var(--th-emerald)' : 'var(--th-rose)', color: '#fff',
          padding: '0.75rem 1.25rem', borderRadius: '10px', fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 700, fontSize: '0.85rem', boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
        }}>
          {toast.msg}
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .pur-header { text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; }
          .pur-header > div { display: flex; flex-direction: column; align-items: center; width: 100%; }
          .pur-new-btn-desktop { display: none !important; }
          .pur-new-btn-mobile-v2 { display: block !important; width: 100%; margin-top: 0; }
          .pur-title { justify-content: center; width: 100%; }
        }
        .pur-new-btn-mobile-v2 { display: none; }
        .pur-root {
            font-family: var(--font-body);
            color: var(--th-text-body);
            display: flex;
            flex-direction: column;
            gap: .5rem;
        }
      `}</style>

      <div className="pur-root">
        {/* Header */}
        <div className="pur-header">
          <div>
            <div className="pur-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div>INVENTORY <span>PURCHASES</span></div>
              {isShopClosed && (
                <div className="pos-closed-badge">
                  <span className="pulse"></span>
                  NEXT DAY MODE
                </div>
              )}
            </div>
            <div className="pur-header-sub">
              Purchased inventory &amp; supplies · tracked for profit &amp; margins
            </div>
          </div>
          <button className="pur-save-btn inv pur-new-btn-desktop" onClick={() => setShowModal(true)}>
            + New Purchase
          </button>
        </div>

        {/* KPIs */}
        <div className="th-kpi-row">
          <KpiCard
            label="Inventory Spent"
            value={currency(invSpent)}
            sub={`${invRows.length} item${invRows.length !== 1 ? 's' : ''}`}
            accent="emerald"
            loading={loading}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>}
          />
          <KpiCard
            label="Supplies Spent"
            value={currency(supSpent)}
            sub={`${supRows.length} record${supRows.length !== 1 ? 's' : ''}`}
            accent="amber"
            loading={loading}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>}
          />
          <KpiCard
            label="Total Spent"
            value={currency(invSpent + supSpent)}
            sub="combined"
            accent="sky"
            loading={loading}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
          />
        </div>

        {/* Search + Filter + history toggle */}
        <FilterHeader
          searchProps={{
            value: search,
            onChange: (v) => { setSearch(v); setPage(1); },
            placeholder: "Search by item name, category, or notes…",
            resultCount: search.trim() ? histRows.length : undefined,
            totalCount: baseRows.length,
            resultLabel: "purchases",
          }}
          leftComponent={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', flexWrap: 'nowrap', width: '100%', height: '100%' }}>
              <span style={{ fontSize: 'inherit', fontWeight: 600, color: 'var(--th-text-muted)', whiteSpace: 'nowrap' }}>From</span>
              <input className="fh-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ flex: 1, minWidth: '120px' }} />
              <span style={{ fontSize: 'inherit', fontWeight: 600, color: 'var(--th-text-muted)', whiteSpace: 'nowrap' }}>To</span>
              <input className="fh-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ flex: 1, minWidth: '120px' }} />
            </div>
          }
          filters={[
            { label: 'All', value: 'all', active: histTab === 'all' },
            { label: '📦 Inventory', value: 'inv', active: histTab === 'inv' },
            { label: '🧴 Supplies', value: 'sup', active: histTab === 'sup' },
          ]}
          onFilterChange={(v) => { setHistTab(v); setPage(1); }}
          accentColor="var(--th-sky)"
        />

        {/* Mobile-only New Purchase button (v2) — shown below the search/filter card */}
        <button className="pur-save-btn inv pur-new-btn-mobile-v2" onClick={() => setShowModal(true)}>
          + New Purchase
        </button>

        {/* Table */}
        <div className="th-section-label">Purchases</div>
        <DataTable
          columns={[
            {
              key: 'purchase_datetime',
              label: 'Date',
              width: '130px',
              render: (r) => (
                <span style={{ whiteSpace: 'nowrap', color: 'var(--th-text-dim)', fontSize: '0.78rem' }}>
                  {fmtDateTime(r.purchase_datetime || r.purchase_date)}
                </span>
              ),
            },
            {
              key: 'item_name',
              label: 'Item',
              render: (r) => (
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--th-text-primary)' }}>{r.item_name}</div>
                  {r.notes && <div style={{ fontSize: '0.72rem', color: 'var(--th-text-faint)' }}>{r.notes}</div>}
                </div>
              ),
            },
            {
              key: 'category',
              label: 'Category',
              render: (r) => (
                <span className={`pur-badge ${r.item_master_id ? 'inv' : 'sup'}`}>{r.category}</span>
              ),
            },
            { key: 'quantity', label: 'Qty', align: 'right' },
            {
              key: 'unit_cost',
              label: 'Unit Cost',
              align: 'right',
              render: (r) => currency(r.unit_cost),
            },
            {
              key: 'line_total',
              label: 'Total',
              align: 'right',
              render: (r) => (
                <span style={{ color: r.item_master_id ? 'var(--th-emerald)' : 'var(--th-amber)', fontWeight: 700 }}>
                  {currency(r.line_total)}
                </span>
              ),
            },
          ]}
          rows={pagedRows}
          rowKey="purchase_item_id"
          onRowClick={setDetailRow}
          loading={loading}
          skeletonRows={8}
          emptyTitle="No Purchases"
          emptyMessage={search.trim() ? 'No purchases match your search.' : `No ${histTab === 'inv' ? 'inventory purchases' : histTab === 'sup' ? 'supply records' : 'purchases'} in selected date range.`}
          emptyIcon={
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.25, marginBottom: '0.25rem' }}>
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
          }
          minWidth={640}
          mobileLayout="scroll"
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />

        {/* ── Modal ── */}
        {showModal && (
          <div className="pur-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
            <div className="pur-modal">
              <div className="pur-modal-header">
                <div className="pur-modal-title">New Purchase</div>
                <button className="pur-modal-close" onClick={closeModal}>✕</button>
              </div>

              {/* Modal tab toggle */}
              <div className="pur-page-tabs">
                <button className={`pur-page-tab ${modalTab === 'inv' ? 'active inv' : ''}`} onClick={() => setModalTab('inv')}>
                  📦 Inventory Item
                </button>
                <button className={`pur-page-tab ${modalTab === 'sup' ? 'active sup' : ''}`} onClick={() => setModalTab('sup')}>
                  🧴 Supply / Consumable
                </button>
              </div>

              {modalTab === 'inv' ? (
                /* INVENTORY FORM */
                <>
                  <div className="pur-panel-note inv">✓ Goes into POS inventory · affects stock &amp; margins</div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    <button className={`pur-btn-toggle ${itemType === 'TIRE' ? 'active' : ''}`} onClick={() => setItemType('TIRE')} style={{ flex: 1 }}>Tires</button>
                    <button className={`pur-btn-toggle ${itemType === 'OTHER' ? 'active' : ''}`} onClick={() => setItemType('OTHER')} style={{ flex: 1 }}>Other Parts</button>
                  </div>

                  {itemType === 'TIRE' ? (<>
                    <div className="pur-row">
                      <div style={{ flex: '1 1 120px' }}>
                        <label className="pur-label">Brand <span style={{ color: 'var(--th-rose)' }}>*</span></label>
                        <input className="pur-input" placeholder="e.g. Bridgestone" value={invForm.brand} onChange={e => setInvField('brand', e.target.value)} />
                      </div>
                      <div style={{ flex: '1 1 130px' }}>
                        <label className="pur-label">Design <span style={{ color: 'var(--th-rose)' }}>*</span></label>
                        <input className="pur-input" placeholder="e.g. Turanza" value={invForm.design} onChange={e => setInvField('design', e.target.value)} />
                      </div>
                      <div style={{ flex: '1 1 120px' }}>
                        <label className="pur-label">Size <span style={{ color: 'var(--th-rose)' }}>*</span></label>
                        <input className="pur-input" placeholder="e.g. 205/55R16" value={invForm.size} onChange={e => setInvField('size', e.target.value)} />
                      </div>
                      <div style={{ flex: '0 1 90px' }}>
                        <label className="pur-label" style={{ color: 'var(--th-amber)' }}>DOT / Year <span style={{ color: 'var(--th-rose)' }}>*</span></label>
                        <input className="pur-input" placeholder="e.g. 2025" value={invForm.dot_number}
                          onChange={e => setInvField('dot_number', e.target.value.replace(/\D/g, '').slice(0, 4))}
                          style={{ borderColor: invForm.dot_number.length === 4 ? undefined : 'var(--th-rose)' }} />
                      </div>
                    </div>
                    <div className="pur-row">
                      <div style={{ flex: '1 1 100px' }}>
                        <label className="pur-label">Category <span style={{ color: 'var(--th-rose)' }}>*</span></label>
                        <CategorySelect value={invForm.category} onChange={v => setInvField('category', v)} options={tireCats} setOptions={setTireCats} storageKey={LS_KEYS.tire} />
                      </div>
                      <div style={{ flex: '1 1 100px' }}>
                        <label className="pur-label">Unit Cost <span style={{ color: 'var(--th-rose)' }}>*</span></label>
                        <input className="pur-input" type="number" step="0.01" placeholder="0.00" value={invForm.unit_cost} onChange={e => setInvField('unit_cost', e.target.value)} />
                      </div>
                      <div style={{ flex: '1 1 100px' }}>
                        <label className="pur-label">Selling Price <span style={{ color: 'var(--th-rose)' }}>*</span></label>
                        <input className="pur-input" type="number" step="0.01" placeholder="0.00" value={invForm.selling_price} onChange={e => setInvField('selling_price', e.target.value)} />
                      </div>
                      <div style={{ flex: '0 1 65px' }}>
                        <label className="pur-label">Qty</label>
                        <input className="pur-input" type="number" min="1" placeholder="1" value={invForm.quantity} onChange={e => setInvField('quantity', e.target.value)} />
                      </div>
                    </div>
                  </>) : (<>
                    <div className="pur-row">
                      <div style={{ flex: '2 1 180px' }}>
                        <label className="pur-label">Item Name <span style={{ color: 'var(--th-rose)' }}>*</span></label>
                        <input className="pur-input" placeholder="e.g. TR413 Valve Stem" value={invForm.item_name} onChange={e => setInvField('item_name', e.target.value)} />
                      </div>
                      <div style={{ flex: '1 1 120px' }}>
                        <label className="pur-label">Category <span style={{ color: 'var(--th-rose)' }}>*</span></label>
                        <CategorySelect value={invForm.category} onChange={v => setInvField('category', v)} options={otherCats} setOptions={setOtherCats} storageKey={LS_KEYS.other} />
                      </div>
                    </div>
                    <div className="pur-row">
                      <div style={{ flex: '1 1 110px' }}>
                        <label className="pur-label">Unit Cost <span style={{ color: 'var(--th-rose)' }}>*</span></label>
                        <input className="pur-input" type="number" step="0.01" placeholder="0.00" value={invForm.unit_cost} onChange={e => setInvField('unit_cost', e.target.value)} />
                      </div>
                      <div style={{ flex: '1 1 110px' }}>
                        <label className="pur-label">Selling Price <span style={{ color: 'var(--th-rose)' }}>*</span></label>
                        <input className="pur-input" type="number" step="0.01" placeholder="0.00" value={invForm.selling_price} onChange={e => setInvField('selling_price', e.target.value)} />
                      </div>
                      <div style={{ flex: '0 1 65px' }}>
                        <label className="pur-label">Qty</label>
                        <input className="pur-input" type="number" min="1" placeholder="1" value={invForm.quantity} onChange={e => setInvField('quantity', e.target.value)} />
                      </div>
                    </div>
                  </>)}

                  <div>
                    <label className="pur-label">Notes</label>
                    <input className="pur-input" placeholder="Optional" value={invForm.notes} onChange={e => setInvField('notes', e.target.value)} />
                  </div>

                  <div className="pur-modal-footer">
                    <button className="pur-clear-btn" onClick={closeModal}>Cancel</button>
                    <button className="pur-save-btn inv" style={{ width: 'auto' }} onClick={handleInvConfirm} disabled={saving}>
                      ✓ Save to Inventory
                    </button>
                  </div>
                </>
              ) : (
                /* SUPPLIES FORM */
                <>
                  <div className="pur-panel-note sup">📋 Reference only · does not enter POS · cost deducted from profit</div>

                  <div className="pur-row">
                    <div style={{ flex: '2 1 200px' }}>
                      <label className="pur-label">Item / Description <span style={{ color: 'var(--th-rose)' }}>*</span></label>
                      <input className="pur-input" placeholder="e.g. Tire patch cement 1L" value={supForm.item_name} onChange={e => setSupForm(f => ({ ...f, item_name: e.target.value }))} />
                    </div>
                    <div style={{ flex: '1 1 130px' }}>
                      <label className="pur-label">Category</label>
                      <CategorySelect value={supForm.category} onChange={v => setSupForm(f => ({ ...f, category: v }))} options={supplyCats} setOptions={setSupplyCats} storageKey={LS_KEYS.supply} />
                    </div>
                  </div>
                  <div className="pur-row">
                    <div style={{ flex: '0 1 75px' }}>
                      <label className="pur-label">Qty</label>
                      <input className="pur-input" type="number" min="0.01" step="0.01" placeholder="1" value={supForm.quantity} onChange={e => setSupForm(f => ({ ...f, quantity: e.target.value }))} />
                    </div>
                    <div style={{ flex: '1 1 130px' }}>
                      <label className="pur-label">Unit Cost <span style={{ color: 'var(--th-rose)' }}>*</span></label>
                      <input className="pur-input" type="number" step="0.01" placeholder="0.00" value={supForm.unit_cost} onChange={e => setSupForm(f => ({ ...f, unit_cost: e.target.value }))} />
                    </div>
                    <div style={{ flex: '1 1 130px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      <label className="pur-label">Total Cost</label>
                      <div className="pur-input" style={{ background: 'var(--th-bg-card-alt)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: '1rem', color: 'var(--th-amber)', cursor: 'default' }}>
                        {supForm.unit_cost && parseFloat(supForm.unit_cost) > 0
                          ? currency((parseFloat(supForm.unit_cost) || 0) * (parseFloat(supForm.quantity) || 1))
                          : '—'}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="pur-label">Notes</label>
                    <input className="pur-input" placeholder="Optional" value={supForm.notes} onChange={e => setSupForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>

                  <div className="pur-modal-footer">
                    <button className="pur-clear-btn" onClick={closeModal}>Cancel</button>
                    <button className="pur-save-btn sup" style={{ width: 'auto' }} onClick={handleSupConfirm} disabled={saving}>
                      ✓ Record Supply
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Pending Confirmation Dialog ── */}
        {pending && (
          <div className="confirm-overlay">
            <div className="confirm-box">
              <div className="confirm-title">Confirm {pending.type === 'inv' ? 'Inventory Purchase' : 'Supply Record'}</div>
              <div className="confirm-details">
                <div className="confirm-detail-row">
                  <span className="confirm-detail-label">Item</span>
                  <span className="confirm-detail-val">{pending.data.brand ? (pending.data.brand + ' ' + pending.data.design) : pending.data.item_name}</span>
                </div>
                <div className="confirm-detail-row">
                  <span className="confirm-detail-label">Quantity</span>
                  <span className="confirm-detail-val">{pending.data.quantity}</span>
                </div>
                <div className="confirm-detail-row">
                  <span className="confirm-detail-label">Unit Cost</span>
                  <span className="confirm-detail-val">{currency(pending.data.unit_cost)}</span>
                </div>
                <div className="confirm-detail-row" style={{ borderTop: '1px solid var(--th-border)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                  <span className="confirm-detail-label">Total Cost</span>
                  <span className="confirm-detail-val" style={{ color: 'var(--th-amber)', fontSize: '1.1rem' }}>
                    {currency(pending.data.unit_cost * pending.data.quantity)}
                  </span>
                </div>
              </div>
              <div className="confirm-actions">
                <button className="confirm-btn-cancel" onClick={() => setPending(null)}>Back</button>
                <button className="confirm-btn-ok" onClick={savePending} disabled={saving}>
                  {saving ? 'Saving…' : '✓ Confirm & Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail modal ── */}
      {detailRow && (
        <div className="confirm-overlay" onClick={e => e.target === e.currentTarget && setDetailRow(null)}>
          <div className="confirm-box" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div className="confirm-title" style={{ marginBottom: 0 }}>
                {detailRow.item_master_id ? 'Inventory Purchase' : 'Supply Record'}
              </div>
              <button className="pur-modal-close" onClick={() => setDetailRow(null)}>✕</button>
            </div>
            <div className="confirm-details">
              <div className="confirm-detail-row">
                <span className="confirm-detail-label">Item</span>
                <span className="confirm-detail-val">{detailRow.item_name}</span>
              </div>
              <div className="confirm-detail-row">
                <span className="confirm-detail-label">Category</span>
                <span className="confirm-detail-val">{detailRow.category}</span>
              </div>
              <div className="confirm-detail-row">
                <span className="confirm-detail-label">Date</span>
                <span className="confirm-detail-val">{fmtDateTime(detailRow.purchase_datetime || detailRow.purchase_date)}</span>
              </div>
              <div className="confirm-detail-row">
                <span className="confirm-detail-label">Qty</span>
                <span className="confirm-detail-val">{detailRow.quantity}</span>
              </div>
              <div className="confirm-detail-row">
                <span className="confirm-detail-label">Unit Cost</span>
                <span className="confirm-detail-val">{currency(detailRow.unit_cost)}</span>
              </div>
              {detailRow.item_master_id && (
                <div className="confirm-detail-row">
                  <span className="confirm-detail-label">Selling Price</span>
                  <span className="confirm-detail-val">{detailRow.selling_price ? currency(detailRow.selling_price) : '—'}</span>
                </div>
              )}
              <div className="confirm-detail-row">
                <span className="confirm-detail-label">Total Cost</span>
                <span className="confirm-detail-val" style={{ color: 'var(--th-amber)', fontSize: '1.1rem' }}>{currency(detailRow.line_total)}</span>
              </div>
              {detailRow.notes && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--th-bg-card-alt)', borderRadius: 8, fontSize: '0.82rem', color: 'var(--th-text-body)' }}>
                  <strong>Notes:</strong> {detailRow.notes}
                </div>
              )}
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" style={{ width: '100%' }} onClick={() => setDetailRow(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default PurchasesPage
