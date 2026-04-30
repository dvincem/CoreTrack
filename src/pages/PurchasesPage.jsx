import '../pages_css/PurchasesPage.css';
import React from 'react'
import { API_URL, currency, apiFetch } from '../lib/config'
import SearchInput from '../components/SearchInput'
import DataTable from '../components/DataTable'
import KpiCard from '../components/KpiCard'
import FilterHeader from '../components/FilterHeader'

// ── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_TIRE_CATS = ['PCR', 'SUV', 'TBR', 'LT', 'MOTORCYCLE', 'TUBE', 'RECAP']
const DEFAULT_INV_OTHER_CATS = ['VALVE', 'WHEEL WEIGHT', 'WHEEL BALANCING', 'MAG WHEEL', 'ACCESSORIES', 'OTHER']
const DEFAULT_SUPPLY_CATS = ['Consumable', 'Maintenance', 'Repair Material', 'Other Supply']

const LS_KEYS = { tire: 'pur-cats-tire-v2', other: 'pur-cats-other', supply: 'pur-cats-supply' }
function loadCats(key, defaults) {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : [...defaults] } catch { return [...defaults] }
}
function saveCats(key, cats) {
  try { localStorage.setItem(key, JSON.stringify(cats)) } catch { }
}

const ADD_NEW = '__ADD_NEW__'

function CategorySelect({ value, onChange, options, setOptions, storageKey, height = 38 }) {
  const [showCatModal, setShowCatModal] = React.useState(false)
  const [newCatName, setNewCatName] = React.useState('')

  const handleChange = (e) => {
    if (e.target.value === ADD_NEW) {
      setShowCatModal(true)
      setNewCatName('')
    } else {
      onChange(e.target.value)
    }
  }

  const handleSaveCat = () => {
    if (newCatName && newCatName.trim()) {
      const trimmed = newCatName.trim()
      const next = options.includes(trimmed) ? options : [...options, trimmed]
      setOptions(next)
      saveCats(storageKey, next)
      onChange(trimmed)
    } else {
      onChange(options[0] || '')
    }
    setShowCatModal(false)
  }

  return (
    <>
      <select className="pur-input" style={{ height }} value={value} onChange={handleChange}>
        {options.map(c => <option key={c} value={c}>{c}</option>)}
        <option value={ADD_NEW}>+ Add category…</option>
      </select>

      {showCatModal && (
        <div className="confirm-overlay" onClick={e => e.target === e.currentTarget && setShowCatModal(false)} style={{ zIndex: 9999 }}>
          <div className="confirm-box" style={{ maxWidth: 400 }}>
            <div className="confirm-title" style={{ color: 'var(--th-sky)' }}>Add New Category</div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="pur-label">Category Name</label>
              <input
                autoFocus
                className="pur-input"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveCat()}
                placeholder="e.g. Filters"
              />
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => { setShowCatModal(false); onChange(options[0] || ''); }}>Cancel</button>
              <button className="pur-save-btn inv" style={{ width: 'auto' }} onClick={handleSaveCat} disabled={!newCatName.trim()}>
                ✓ Save Category
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
    if (form.brand) parts.push(form.brand.trim().substring(0, 5).toUpperCase())
    if (form.design) parts.push(form.design.trim().substring(0, 4).toUpperCase())
    if (form.size) parts.push(form.size.trim().replace(/[\/ \-]/g, ''))
  } else {
    if (form.item_name) parts.push(form.item_name.trim().substring(0, 8).toUpperCase().replace(/\s+/g, '-'))
    if (form.category) parts.push(form.category.toUpperCase().replace(/\s+/g, ''))
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
  const [modalTab, setModalTab] = React.useState('inv') // 'inv' | 'sup'

  // Items to add (Bulk support)
  const [itemsToAdd, setItemsToAdd] = React.useState([])

  const [pending, setPending] = React.useState(null) // { type: 'inv'|'sup', data: [] }
  const [saving, setSaving] = React.useState(false)
  const [editMode, setEditMode] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState(null)
  const [suppliers, setSuppliers] = React.useState([])
  const [tireCats, setTireCats] = React.useState(() => loadCats(LS_KEYS.tire, DEFAULT_TIRE_CATS))
  const [otherCats, setOtherCats] = React.useState(() => loadCats(LS_KEYS.other, DEFAULT_INV_OTHER_CATS))
  const [supplyCats, setSupplyCats] = React.useState(() => loadCats(LS_KEYS.supply, DEFAULT_SUPPLY_CATS))

  // History List
  const [startDate, setStartDate] = React.useState(TODAY)
  const [endDate, setEndDate] = React.useState(TODAY)
  const [histTab, setHistTab] = React.useState('all') // 'all'|'inv'|'sup'
  const [baseRows, setBaseRows] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const PAGE_SIZE = 15

  const [detailRow, setDetailRow] = React.useState(null)
  const [toast, setToast] = React.useState(null)
  const [voidingId, setVoidingId] = React.useState(null) // purchase_id to void
  const [voidReason, setVoidReason] = React.useState('')

  // DB suggestions
  const [dbBrands, setDbBrands] = React.useState([])
  const [dbDesigns, setDbDesigns] = React.useState([])
  const [dbSizes, setDbSizes] = React.useState([])
  const [activeSug, setActiveSug] = React.useState(null) // { idx, field }

  React.useEffect(() => {
    fetchSuppliers()
    load()
    fetchDbSuggestions()
  }, [shopId, startDate, endDate])

  async function fetchDbSuggestions() {
    try {
      apiFetch(`${API_URL}/item-brands/any`).then(r => r.json()).then(d => Array.isArray(d) && setDbBrands(d)).catch(() => {})
      apiFetch(`${API_URL}/item-designs/any`).then(r => r.json()).then(d => Array.isArray(d) && setDbDesigns(d)).catch(() => {})
      apiFetch(`${API_URL}/item-sizes/any`).then(r => r.json()).then(d => Array.isArray(d) && setDbSizes(d)).catch(() => {})
    } catch { }
  }

  async function fetchSuppliers() {
    try {
      const r = await apiFetch(`${API_URL}/suppliers/${shopId}`)
      const d = await r.json()
      setSuppliers(Array.isArray(d) ? d : [])
    } catch { }
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

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const updateItemToAdd = (idx, k, v) => {
    setItemsToAdd(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [k]: v }
      return next
    })
  }

  const addMoreItem = () => {
    setItemsToAdd(prev => [
      ...prev,
      { id: Date.now() + Math.random(), ...(modalTab === 'inv' ? BLANK_INV('TIRE') : BLANK_SUP()), itemType: modalTab === 'inv' ? 'TIRE' : 'SUPPLY' }
    ])
  }

  const removeItemToAdd = (idx) => {
    if (itemsToAdd.length <= 1) return
    setItemsToAdd(prev => prev.filter((_, i) => i !== idx))
  }

  const handleConfirm = () => {
    for (let i = 0; i < itemsToAdd.length; i++) {
      const item = itemsToAdd[i]
      if (modalTab === 'inv') {
        if (item.itemType === 'TIRE') {
          if (!item.brand || !item.design || !item.size || !item.dot_number || !item.unit_cost) {
            return alert(`Please fill in all required tire fields for Item #${i + 1}.`)
          }
        } else {
          if (!item.item_name || !item.unit_cost) {
            return alert(`Please fill in required item fields for Item #${i + 1}.`)
          }
        }
      } else {
        if (!item.item_name || !item.unit_cost) {
          return alert(`Please fill in required supply fields for Item #${i + 1}.`)
        }
      }
    }
    setPending({ type: modalTab, data: itemsToAdd.map(it => ({ ...it, item_type: it.itemType })) })
  }

  async function savePending() {
    setSaving(true)
    try {
      const isInv = pending.type === 'inv'
      const url = editMode
        ? `${API_URL}/purchase-items/${editingItem.purchase_item_id}`
        : `${API_URL}/purchases/${shopId}`
      const method = editMode ? 'PUT' : 'POST'

      // Standardize payload
      const standardizedItems = pending.data.map(item => ({
        ...item,
        item_name: item.item_name || (item.brand + ' ' + item.design),
        sku: isInv ? buildSKU(item, item.item_type) : null,
        rim_size: isInv ? extractRimSize(item.size) : null,
      }))

      const payload = editMode ? standardizedItems[0] : {
        notes: '',
        handled_by: currentStaffId || 'ADMIN',
        items: standardizedItems // Backend POST expects an array
      }

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errText = await res.text()
        try {
          const errJson = JSON.parse(errText)
          throw new Error(errJson.error || 'Failed to save')
        } catch {
          throw new Error(`Server Error: ${res.status}`)
        }
      }

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      showToast(editMode ? 'Purchase updated' : `Recorded ${standardizedItems.length} item(s)`)
      setPending(null)
      setShowModal(false)
      setEditMode(false)
      setEditingItem(null)
      setItemsToAdd([])
      load()
    } catch (e) {
      alert(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleVoid(purchaseId) {
    setVoidingId(purchaseId)
    setVoidReason('')
  }

  async function submitVoid() {
    if (!voidingId) return
    if (!voidReason.trim()) return alert("Reason is required")

    try {
      setLoading(true)
      const res = await apiFetch(`${API_URL}/purchases/${voidingId}/void`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ void_reason: voidReason.trim() })
      })
      if (!res.ok) throw new Error('Failed to void')
      showToast('Purchase voided successfully')
      setDetailRow(null)
      setVoidingId(null)
      load()
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleEdit(row) {
    setDetailRow(null)
    setEditMode(true)
    setEditingItem(row)

    if (row.item_master_id) {
      setModalTab('inv')
      const isTire = DEFAULT_TIRE_CATS.includes(row.category)
      setItemsToAdd([{
        id: Date.now(),
        itemType: isTire ? 'TIRE' : 'OTHER',
        item_name: row.item_name || '',
        brand: row.brand || '',
        design: row.design || '',
        size: row.size || '',
        dot_number: row.dot_number || '',
        category: row.category || (isTire ? 'PCR' : 'VALVE'),
        unit_cost: row.unit_cost || '',
        selling_price: row.selling_price || '',
        quantity: row.quantity || '1',
        notes: row.header_notes || '',
      }])
    } else {
      setModalTab('sup')
      setItemsToAdd([{
        id: Date.now(),
        itemType: 'SUPPLY',
        item_name: row.item_name || '',
        category: row.category || 'Consumable',
        quantity: row.quantity || '1',
        unit_cost: row.unit_cost || '',
        notes: row.header_notes || '',
      }])
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setPending(null)
    setEditMode(false)
    setEditingItem(null)
    setItemsToAdd([])
  }

  const openNewPurchase = () => {
    setModalTab('inv')
    setItemsToAdd([{ id: Date.now(), ...BLANK_INV('TIRE'), itemType: 'TIRE' }])
    setShowModal(true)
  }

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
  const pagedRows = histRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const invRows = histRows.filter(r => !!r.item_master_id)
  const supRows = histRows.filter(r => !r.item_master_id)
  const invSpent = invRows.reduce((s, r) => s + (r.line_total || 0), 0)
  const supSpent = supRows.reduce((s, r) => s + (r.line_total || 0), 0)

  const fmtDateTime = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
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
            <div className="pur-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
          <button className="pur-btn-primary pur-new-btn-desktop" onClick={openNewPurchase}>
            + NEW PURCHASE
          </button>
        </div>

        {/* KPIs */}
        <div className="th-kpi-row">
          <KpiCard
            label="Inventory Spent"
            value={currency(invSpent)}
            sub={`${invRows.length} item${invRows.length !== 1 ? 's' : ''}`}
            accent="sky"
            loading={loading}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /></svg>}
          />
          <KpiCard
            label="Supplies Spent"
            value={currency(supSpent)}
            sub={`${supRows.length} record${supRows.length !== 1 ? 's' : ''}`}
            accent="sky"
            loading={loading}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></svg>}
          />
          <KpiCard
            label="Total Spent"
            value={currency(invSpent + supSpent)}
            sub="combined"
            accent="sky"
            loading={loading}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>}
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
        <button className="pur-btn-primary pur-new-btn-mobile-v2" onClick={openNewPurchase}>
          + NEW PURCHASE
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{
                    color: r.is_void ? 'var(--th-text-dim)' : (r.item_master_id ? 'var(--th-emerald)' : 'var(--th-amber)'),
                    fontWeight: 700,
                    textDecoration: r.is_void ? 'line-through' : 'none'
                  }}>
                    {currency(r.line_total)}
                  </span>
                  {r.is_void && <span style={{ fontSize: '0.65rem', color: 'var(--th-rose)', fontWeight: 700 }}>VOIDED</span>}
                </div>
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
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 01-8 0" />
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
                <div className="pur-modal-title">{editMode ? 'Edit Purchase' : 'New Purchase'}</div>
                <button className="pur-modal-close" onClick={closeModal}>✕</button>
              </div>

              {/* Modal tab toggle - hidden in edit mode to prevent changing item type */}
              {!editMode && (
                <div className="pur-page-tabs">
                  <button className={`pur-page-tab ${modalTab === 'inv' ? 'active inv' : ''}`} onClick={() => {
                    setModalTab('inv');
                    setItemsToAdd([{ id: Date.now(), ...BLANK_INV('TIRE'), itemType: 'TIRE' }]);
                  }}>
                    📦 Inventory Item
                  </button>
                  <button className={`pur-page-tab ${modalTab === 'sup' ? 'active sup' : ''}`} onClick={() => {
                    setModalTab('sup');
                    setItemsToAdd([{ id: Date.now(), ...BLANK_SUP(), itemType: 'SUPPLY' }]);
                  }}>
                    🧴 Supply / Consumable
                  </button>
                </div>
              )}

              <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
                {itemsToAdd.map((item, idx) => (
                  <div key={item.id} style={{
                    background: "var(--th-bg-soft)",
                    borderRadius: 12,
                    padding: "1rem",
                    border: "1px solid var(--th-border-strong)",
                    marginBottom: ".5rem",
                    position: "relative"
                  }}>
                    {itemsToAdd.length > 1 && !editMode && (
                      <button
                        onClick={() => removeItemToAdd(idx)}
                        style={{
                          position: "absolute",
                          top: "0.8rem",
                          right: "0.8rem",
                          background: "var(--th-rose-bg)",
                          color: "var(--th-rose)",
                          border: "none",
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          zIndex: 10
                        }}
                      >✕</button>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '.5rem', alignItems: 'center' }}>
                      <div style={{
                        width: "28px",
                        height: "28px",
                        background: modalTab === 'inv' ? "var(--th-sky)" : "var(--th-violet)",
                        color: "#fff",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "0.8rem"
                      }}>{idx + 1}</div>

                      {modalTab === 'inv' && !editMode && (
                        <div style={{ display: 'flex', gap: '0.3rem', background: 'var(--th-bg-dark)', padding: '0.25rem', borderRadius: 8 }}>
                          <button
                            className={`pur-btn-toggle ${item.itemType === 'TIRE' ? 'active' : ''}`}
                            onClick={() => updateItemToAdd(idx, 'itemType', 'TIRE')}
                            style={{ padding: '0.3rem 0.8rem', fontSize: '0.7rem' }}
                          >Tires</button>
                          <button
                            className={`pur-btn-toggle ${item.itemType === 'OTHER' ? 'active' : ''}`}
                            onClick={() => updateItemToAdd(idx, 'itemType', 'OTHER')}
                            style={{ padding: '0.3rem 0.8rem', fontSize: '0.7rem' }}
                          >Other</button>
                        </div>
                      )}
                    </div>

                    {modalTab === 'inv' ? (
                      /* INVENTORY ITEM FIELDS */
                      item.itemType === 'TIRE' ? (
                        <>
                          <div className="pur-row">
                            <div style={{ flex: 1, position: 'relative' }}>
                              <label className="pur-label">Brand *</label>
                              <input className="pur-input" placeholder="Bridgestone" value={item.brand} 
                                onChange={e => updateItemToAdd(idx, 'brand', e.target.value)} 
                                onFocus={() => setActiveSug({ idx, field: 'brand' })}
                                onBlur={() => setTimeout(() => setActiveSug(null), 200)}
                              />
                              {activeSug?.idx === idx && activeSug?.field === 'brand' && item.brand && (
                                <div className="pur-sug-drop">
                                  {dbBrands.filter(b => b.toLowerCase().includes(item.brand.toLowerCase())).slice(0, 8).map(b => (
                                    <div key={b} className="pur-sug-item" onMouseDown={() => updateItemToAdd(idx, 'brand', b)}>{b}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div style={{ flex: 1, position: 'relative' }}>
                              <label className="pur-label">Design *</label>
                              <input className="pur-input" placeholder="Turanza" value={item.design} 
                                onChange={e => updateItemToAdd(idx, 'design', e.target.value)} 
                                onFocus={() => setActiveSug({ idx, field: 'design' })}
                                onBlur={() => setTimeout(() => setActiveSug(null), 200)}
                              />
                              {activeSug?.idx === idx && activeSug?.field === 'design' && item.design && (
                                <div className="pur-sug-drop">
                                  {dbDesigns.filter(d => {
                                    const m = d.design.toLowerCase().includes(item.design.toLowerCase());
                                    const b = item.brand ? d.brand?.toLowerCase() === item.brand.toLowerCase() : true;
                                    return m && b;
                                  }).slice(0, 8).map(d => (
                                    <div key={d.design} className="pur-sug-item" onMouseDown={() => updateItemToAdd(idx, 'design', d.design)}>{d.design}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div style={{ flex: 1, position: 'relative' }}>
                              <label className="pur-label">Size *</label>
                              <input className="pur-input" placeholder="205/55R16" value={item.size} 
                                onChange={e => updateItemToAdd(idx, 'size', e.target.value)} 
                                onFocus={() => setActiveSug({ idx, field: 'size' })}
                                onBlur={() => setTimeout(() => setActiveSug(null), 200)}
                              />
                              {activeSug?.idx === idx && activeSug?.field === 'size' && item.size && (
                                <div className="pur-sug-drop">
                                  {dbSizes.filter(s => s.toLowerCase().includes(item.size.toLowerCase())).slice(0, 8).map(s => (
                                    <div key={s} className="pur-sug-item" onMouseDown={() => updateItemToAdd(idx, 'size', s)}>{s}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div style={{ flex: 1 }}>
                              <label className="pur-label" style={{ color: 'var(--th-amber)' }}>DOT *</label>
                              <input className="pur-input" placeholder="2025" value={item.dot_number}
                                onChange={e => updateItemToAdd(idx, 'dot_number', e.target.value.replace(/\D/g, '').slice(0, 4))} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label className="pur-label">Category *</label>
                              <CategorySelect value={item.category} onChange={v => updateItemToAdd(idx, 'category', v)} options={tireCats} setOptions={setTireCats} storageKey={LS_KEYS.tire} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label className="pur-label">Cost *</label>
                              <input className="pur-input" type="number" step="0.01" value={item.unit_cost} onChange={e => updateItemToAdd(idx, 'unit_cost', e.target.value)} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label className="pur-label">Price *</label>
                              <input className="pur-input" type="number" step="0.01" value={item.selling_price} onChange={e => updateItemToAdd(idx, 'selling_price', e.target.value)} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label className="pur-label">Qty</label>
                              <input className="pur-input" type="number" min="1" value={item.quantity} onChange={e => updateItemToAdd(idx, 'quantity', e.target.value)} />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="pur-row">
                            <div style={{ flex: 2 }}>
                              <label className="pur-label">Item Name *</label>
                              <input className="pur-input" value={item.item_name} onChange={e => updateItemToAdd(idx, 'item_name', e.target.value)} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label className="pur-label">Category *</label>
                              <CategorySelect value={item.category} onChange={v => updateItemToAdd(idx, 'category', v)} options={otherCats} setOptions={setOtherCats} storageKey={LS_KEYS.other} />
                            </div>
                          </div>
                          <div className="pur-row">
                            <div style={{ flex: 1 }}>
                              <label className="pur-label">Cost *</label>
                              <input className="pur-input" type="number" step="0.01" value={item.unit_cost} onChange={e => updateItemToAdd(idx, 'unit_cost', e.target.value)} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label className="pur-label">Price *</label>
                              <input className="pur-input" type="number" step="0.01" value={item.selling_price} onChange={e => updateItemToAdd(idx, 'selling_price', e.target.value)} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label className="pur-label">Qty</label>
                              <input className="pur-input" type="number" min="1" value={item.quantity} onChange={e => updateItemToAdd(idx, 'quantity', e.target.value)} />
                            </div>
                          </div>
                        </>
                      )
                    ) : (
                      /* SUPPLY ITEM FIELDS */
                      <>
                        <div className="pur-row">
                          <div style={{ flex: 2 }}>
                            <label className="pur-label">Description *</label>
                            <input className="pur-input" value={item.item_name} onChange={e => updateItemToAdd(idx, 'item_name', e.target.value)} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label className="pur-label">Category</label>
                            <CategorySelect value={item.category} onChange={v => updateItemToAdd(idx, 'category', v)} options={supplyCats} setOptions={setSupplyCats} storageKey={LS_KEYS.supply} />
                          </div>
                        </div>
                        <div className="pur-row">
                          <div style={{ flex: 1 }}>
                            <label className="pur-label">Qty</label>
                            <input className="pur-input" type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => updateItemToAdd(idx, 'quantity', e.target.value)} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label className="pur-label">Unit Cost *</label>
                            <input className="pur-input" type="number" step="0.01" value={item.unit_cost} onChange={e => updateItemToAdd(idx, 'unit_cost', e.target.value)} />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {!editMode && (
                <div>
                  <button
                    className="pur-page-tab"
                    onClick={addMoreItem}
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      border: '1px dashed var(--th-border-strong)',
                      background: 'rgba(255,255,255,0.02)'
                    }}
                  >
                    + Add another item
                  </button>
                </div>
              )}

              <div className="pur-modal-footer">
                <button className="pur-clear-btn" onClick={closeModal}>Cancel</button>
                <button className={`pur-save-btn ${modalTab === 'inv' ? 'inv' : 'sup'}`} style={{ width: 'auto' }} onClick={handleConfirm} disabled={saving}>
                  {editMode ? '✓ Update Purchase' : `✓ Record ${itemsToAdd.length} item(s)`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Pending Confirmation Dialog ── */}
        {pending && (
          <div className="confirm-overlay">
            <div className="confirm-box" style={{ maxWidth: 500 }}>
              <div className="confirm-title">Confirm {pending.type === 'inv' ? 'Inventory Purchase' : 'Supply Record'}</div>
              <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--th-border)' }}>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Item</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem' }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.data.map((it, idx) => {
                      const name = it.brand ? `${it.brand} ${it.design}` : it.item_name;
                      const total = (parseFloat(it.unit_cost) || 0) * (parseFloat(it.quantity) || 0);
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--th-border-strong)' }}>
                          <td style={{ padding: '0.5rem' }}>{name}</td>
                          <td style={{ textAlign: 'right', padding: '0.5rem' }}>{it.quantity}</td>
                          <td style={{ textAlign: 'right', padding: '0.5rem' }}>{currency(total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="confirm-detail-row" style={{ borderTop: '2px solid var(--th-border)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                <span className="confirm-detail-label">Grand Total</span>
                <span className="confirm-detail-val" style={{ color: 'var(--th-amber)', fontSize: '1.2rem' }}>
                  {currency(pending.data.reduce((acc, it) => acc + (parseFloat(it.unit_cost) || 0) * (parseFloat(it.quantity) || 0), 0))}
                </span>
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
              <button className="confirm-btn-cancel" style={{ width: 'auto' }} onClick={() => setDetailRow(null)}>Close</button>
              {!detailRow.is_void && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="pur-save-btn inv" style={{ width: 'auto', padding: '0.5rem 1rem' }} onClick={() => handleEdit(detailRow)}>
                    ✎ Edit Purchase
                  </button>
                  <button className="pur-save-btn sup" style={{ width: 'auto', padding: '0.5rem 1rem', background: 'var(--th-rose)' }} onClick={() => handleVoid(detailRow.purchase_id)}>
                    ✕ Void
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ── Void Modal ── */}
      {voidingId && (
        <div className="confirm-overlay" onClick={e => e.target === e.currentTarget && setVoidingId(null)} style={{ zIndex: 9999 }}>
          <div className="confirm-box" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div className="confirm-title" style={{ marginBottom: 0, color: 'var(--th-rose)' }}>
                Void Purchase
              </div>
              <button className="pur-modal-close" onClick={() => setVoidingId(null)}>✕</button>
            </div>
            <div className="confirm-details" style={{ borderLeft: '3px solid var(--th-rose)', paddingLeft: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--th-text-body)' }}>
                Are you sure you want to void this purchase? The associated stock will be automatically reverted from the inventory.
              </p>
            </div>
            <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
              <label className="pur-label">Reason for Voiding <span style={{ color: "var(--th-rose)" }}>*</span></label>
              <textarea
                className="pur-input"
                rows="3"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Reason for voiding (required)…"
                style={{ resize: 'vertical' }}
              />
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => setVoidingId(null)}>Cancel</button>
              <button
                className="pur-save-btn sup"
                style={{ width: 'auto', background: 'var(--th-rose)' }}
                onClick={submitVoid}
                disabled={loading || !voidReason.trim()}
              >
                {loading ? 'Processing…' : '✕ Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  )
}

export default PurchasesPage

