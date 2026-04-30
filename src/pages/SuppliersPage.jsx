import '../pages_css/SuppliersPage.css';
import React from 'react'
import { API_URL, apiFetch, SkeletonRows } from '../lib/config'
import Pagination from '../components/Pagination'
import KpiCard from '../components/KpiCard'
import SearchInput from '../components/SearchInput'
import FilterHeader from '../components/FilterHeader'



const BLANK_FORM = { supplier_name: '', contact_person: '', contact_number: '', email_address: '', address: '', default_payment_terms_days: '30' }
const BLANK_BRAND = () => ({ id: Date.now(), brand_name: '', item_type: '', brand_origins: '' })
const SUPP_PAGE_SIZE = 15
const ITEM_TYPES = ['PCR', 'SUV', 'TBR', 'LT', 'MOTORCYCLE', 'RECAP', 'TUBE', 'ACCESSORY', 'OTHER']

function SuppliersPage({ shopId }) {
  const [suppliers, setSuppliers] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [suggestions, setSuggestions] = React.useState([])
  const [filter, setFilter] = React.useState('All')
  const [suppPage, setSuppPage] = React.useState(1)

  // Add modal
  const [showAdd, setShowAdd] = React.useState(false)
  const [addForm, setAddForm] = React.useState(BLANK_FORM)
  const [addError, setAddError] = React.useState('')
  const [addSaving, setAddSaving] = React.useState(false)

  // Edit modal
  const [editTarget, setEditTarget] = React.useState(null)
  const [editForm, setEditForm] = React.useState(BLANK_FORM)
  const [editError, setEditError] = React.useState('')
  const [editSaving, setEditSaving] = React.useState(false)

  // Remove confirm
  const [removeTarget, setRemoveTarget] = React.useState(null)
  const [removeSaving, setRemoveSaving] = React.useState(false)

  // Detail modal
  const [detail, setDetail] = React.useState(null)
  const [detailTab, setDetailTab] = React.useState('brands')
  const [supplierInventory, setSupplierInventory] = React.useState([])
  const [invLoading, setInvLoading] = React.useState(false)
  const [showBrandForm, setShowBrandForm] = React.useState(false)
  const [brandInputs, setBrandInputs] = React.useState([BLANK_BRAND()])
  const [brandSaving, setBrandSaving] = React.useState(false)
  const [detailError, setDetailError] = React.useState('')

  // Delete brand confirm
  const [deleteBrand, setDeleteBrand] = React.useState(null)

  React.useEffect(() => { fetchSuppliers() }, [shopId])
  React.useEffect(() => { setSuppPage(1) }, [search, filter])

  async function fetchSuppliers() {
    setLoading(true)
    try {
      const qs = shopId ? `?shop_id=${encodeURIComponent(shopId)}` : ''
      const r = await apiFetch(`${API_URL}/suppliers${qs}`)
      setSuppliers((await r.json()) || [])
    } catch { setSuppliers([]) }
    finally { setLoading(false) }
  }

  async function fetchSupplierInventory(supplier_id) {
    setInvLoading(true)
    try {
      const qs = shopId ? `?shop_id=${encodeURIComponent(shopId)}` : ''
      const r = await apiFetch(`${API_URL}/supplier-inventory/${supplier_id}${qs}`)
      setSupplierInventory((await r.json()) || [])
    } catch { setSupplierInventory([]) }
    finally { setInvLoading(false) }
  }

  function openDetail(s) {
    setDetail(s)
    setDetailTab('brands')
    setShowBrandForm(false)
    setBrandInputs([BLANK_BRAND()])
    setDetailError('')
    setSupplierInventory([])
  }

  function switchTab(tab) {
    setDetailTab(tab)
    if (tab === 'inventory' && supplierInventory.length === 0 && detail) {
      fetchSupplierInventory(detail.supplier_id)
    }
  }

  async function handleAdd() {
    if (!addForm.supplier_name.trim()) { setAddError('Supplier name is required.'); return }
    setAddSaving(true); setAddError('')
    try {
      const r = await apiFetch(`${API_URL}/suppliers`, {
        method: 'POST',
        body: JSON.stringify({ ...addForm, shop_id: shopId || null, default_payment_terms_days: parseInt(addForm.default_payment_terms_days) || 30 }),
      })
      const data = await r.json()
      if (!r.ok) { setAddError(data.error || 'Failed to add'); return }
      setShowAdd(false); setAddForm(BLANK_FORM)
      fetchSuppliers()
    } catch { setAddError('Could not connect to server.') }
    finally { setAddSaving(false) }
  }

  async function handleEdit() {
    if (!editForm.supplier_name.trim()) { setEditError('Supplier name is required.'); return }
    setEditSaving(true); setEditError('')
    try {
      const r = await apiFetch(`${API_URL}/suppliers/${editTarget.supplier_id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...editForm, default_payment_terms_days: parseInt(editForm.default_payment_terms_days) || 30 }),
      })
      const data = await r.json()
      if (!r.ok) { setEditError(data.error || 'Failed to update'); return }
      const updated = { ...editTarget, ...editForm, supplier_name: editForm.supplier_name.trim(), default_payment_terms_days: parseInt(editForm.default_payment_terms_days) || 30 }
      setSuppliers(prev => prev.map(s => s.supplier_id === editTarget.supplier_id ? updated : s))
      setEditTarget(null)
    } catch { setEditError('Could not connect to server.') }
    finally { setEditSaving(false) }
  }

  async function handleRemove() {
    setRemoveSaving(true)
    try {
      await apiFetch(`${API_URL}/suppliers/${removeTarget.supplier_id}`, { method: 'DELETE' })
      setSuppliers(prev => prev.filter(s => s.supplier_id !== removeTarget.supplier_id))
    } catch { }
    finally { setRemoveTarget(null); setRemoveSaving(false) }
  }

  async function handleAddBrands() {
    const valid = brandInputs.filter(b => b.brand_name.trim() && b.item_type.trim() && b.brand_origins.trim())
    if (valid.length === 0) { setDetailError('Fill in at least one complete brand entry.'); return }
    setBrandSaving(true); setDetailError('')
    try {
      const results = await Promise.all(valid.map(b =>
        apiFetch(`${API_URL}/supplier-brands`, {
          method: 'POST',
          body: JSON.stringify({ supplier_id: detail.supplier_id, brand_name: b.brand_name, item_type: b.item_type, brand_origins: b.brand_origins }),
        }).then(r => r.json())
      ))
      const err = results.find(r => r.error)
      if (err) { setDetailError(err.error); return }
      const updated = { ...detail, supplier_brands: [...(detail.supplier_brands || []), ...results.filter(r => !r.error)] }
      setDetail(updated)
      setSuppliers(prev => prev.map(s => s.supplier_id === updated.supplier_id ? updated : s))
      setBrandInputs([BLANK_BRAND()])
      setShowBrandForm(false)
    } catch { setDetailError('Could not connect to server.') }
    finally { setBrandSaving(false) }
  }

  async function confirmDeleteBrand() {
    const { brand_id } = deleteBrand
    setDeleteBrand(null)
    try {
      const r = await apiFetch(`${API_URL}/supplier-brands/${brand_id}`, { method: 'DELETE' })
      if (!r.ok) return
      const updated = { ...detail, supplier_brands: detail.supplier_brands.filter(b => b.brand_id !== brand_id) }
      setDetail(updated)
      setSuppliers(prev => prev.map(s => s.supplier_id === updated.supplier_id ? updated : s))
    } catch { }
  }

  // KPIs
  const totalBrands = suppliers.reduce((sum, s) => sum + (s.supplier_brands?.length || 0), 0)
  const withBrands = suppliers.filter(s => s.supplier_brands?.length > 0).length
  const avgTerms = suppliers.length > 0
    ? Math.round(suppliers.reduce((sum, s) => sum + (s.default_payment_terms_days || 30), 0) / suppliers.length)
    : 0

  // Suggestions
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
    for (const s of suppliers) {
      if (results.length >= 10) break
      if (s.supplier_name?.toLowerCase().includes(q)) add(s.supplier_name, 'SUPPLIER', '🏭')
      if (s.supplier_code?.toLowerCase().includes(q)) add(s.supplier_code, 'CODE', '🆔')
      if (s.contact_person?.toLowerCase().includes(q)) add(s.contact_person, 'CONTACT', '👤')
      if (s.contact_number?.toLowerCase().includes(q)) add(s.contact_number, 'PHONE', '📞')
      s.supplier_brands?.forEach(b => {
        if (b.brand_name?.toLowerCase().includes(q)) add(b.brand_name, 'BRAND', '🏷️')
        if (b.item_type?.toLowerCase().includes(q)) add(b.item_type, 'TYPE', '📦')
      })
    }
    setSuggestions(results.slice(0, 10))
  }, [search, suppliers])

  // Filter
  const filtered = suppliers.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !q || [s.supplier_name, s.contact_person, s.contact_number, s.email_address].some(v => v && v.toLowerCase().includes(q))
      || s.supplier_brands?.some(b => b.brand_name?.toLowerCase().includes(q) || b.item_type?.toLowerCase().includes(q))
    const matchFilter = filter === 'All' || (filter === 'With Brands' && s.supplier_brands?.length > 0)
    return matchSearch && matchFilter
  })

  const paged = filtered.slice((suppPage - 1) * SUPP_PAGE_SIZE, suppPage * SUPP_PAGE_SIZE)

  function openAdd() { setShowAdd(true); setAddForm(BLANK_FORM); setAddError('') }

  return (
    <>
      <style>{`
        .supp-root {
            font-family: var(--font-body);
            color: var(--th-text-primary);
            display: flex;
            flex-direction: column;
            gap: .5rem;
        }
      `}</style>
      <div className="supp-root">
        {/* Header row: title + desktop Add button */}
        <div className="supp-header-row">
          <div className="th-title-format">Suppli<span style={{ color: 'var(--th-amber)' }}>ers</span></div>
          <button className="supp-btn-add supp-add-desktop" onClick={openAdd}>+ Add Supplier</button>
        </div>

        {/* KPI Cards */}
        <div className="th-kpi-row">
          <KpiCard label="Total Suppliers" value={suppliers.length} accent="amber" loading={loading} />
          <KpiCard label="Total Brands" value={totalBrands} accent="sky" loading={loading} />
          <KpiCard label="With Brands" value={withBrands} accent="emerald" loading={loading} />
          <KpiCard label="Avg Payment Terms" value={`${avgTerms}d`} accent="violet" loading={loading} />
        </div>

        {/* Filter Header */}
        <FilterHeader
          searchProps={{
            value: search,
            onChange: v => { setSearch(v); setSuppPage(1) },
            placeholder: "Search supplier, brand, contact…",
            suggestions: suggestions,
            onSuggestionSelect: s => { setSearch(s.text); setSuppPage(1) },
            resultCount: search.trim() ? filtered.length : undefined,
            resultLabel: "suppliers",
          }}
          filters={[
            { label: "All", value: "All", active: filter === "All" },
            { label: "With Brands", value: "With Brands", active: filter === "With Brands" },
          ]}
          onFilterChange={setFilter}
          accentColor="var(--th-amber,#fbbf24)"
        />

        {/* Mobile-only Add button */}
        <button className="supp-btn-add supp-add-mobile" onClick={openAdd}>+ Add Supplier</button>

        {/* Table */}
        <div className="th-section-label">Supplier Directory</div>
        <div className="supp-table-card">
          {loading ? (
            <table className="supp-table"><tbody><SkeletonRows rows={6} cols={4} widths={['w60', 'w40', 'w30', 'w30']} /></tbody></table>
          ) : filtered.length === 0 ? (
            <div className="supp-empty">{search || filter !== 'All' ? 'No suppliers match the filter.' : 'No suppliers found. Click "+ Add Supplier" to get started.'}</div>
          ) : (
            <>
              <div className="supp-table-scroll">
                <table className="supp-table">
                  <thead>
                    <tr>
                      <th>Supplier</th>
                      <th>Contact</th>
                      <th>Brands</th>
                      <th>Payment Terms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map(s => (
                      <tr key={s.supplier_id} style={{ cursor: 'pointer' }} onClick={() => openDetail(s)}>
                        <td>
                          <div className="supp-name">{s.supplier_name}</div>
                          <div className="supp-code">{s.supplier_code}</div>
                        </td>
                        <td>
                          {s.contact_person && <div className="supp-contact">{s.contact_person}</div>}
                          {s.contact_number && <div className="supp-phone">{s.contact_number}</div>}
                          {!s.contact_person && !s.contact_number && <span style={{ color: 'var(--th-text-faint)' }}>—</span>}
                        </td>
                        <td>
                          {s.supplier_brands?.length > 0 ? (
                            <div>
                              {s.supplier_brands.slice(0, 2).map((b, i) => <span key={i} className="supp-brand-chip">{b.brand_name}</span>)}
                              {s.supplier_brands.length > 2 && <span className="supp-more-chip">+{s.supplier_brands.length - 2}</span>}
                            </div>
                          ) : <span style={{ color: 'var(--th-text-faint)' }}>—</span>}
                        </td>
                        <td style={{ color: 'var(--th-text-body)' }}>
                          {s.default_payment_terms_days || 30} days
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination currentPage={suppPage} totalPages={Math.ceil(filtered.length / SUPP_PAGE_SIZE)} onPageChange={setSuppPage} />
            </>
          )}
        </div>

        {/* Add Supplier Modal */}
        {showAdd && (
          <div className="supp-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
            <div className="supp-modal">
              <div className="supp-modal-title">
                New Supplier
                <button className="supp-modal-close" onClick={() => setShowAdd(false)}>✕</button>
              </div>
              {/* Row 1: Supplier Name + Contact Person */}
              <div className="supp-modal-grid">
                <div className="supp-modal-field">
                  <label className="supp-modal-label">Company Name *</label>
                  <input className="supp-modal-input" placeholder="e.g. Bridgestone PH" value={addForm.supplier_name} onChange={e => setAddForm(f => ({ ...f, supplier_name: e.target.value }))} autoFocus />
                </div>
                <div className="supp-modal-field">
                  <label className="supp-modal-label">Contact Person</label>
                  <input className="supp-modal-input" placeholder="Optional" value={addForm.contact_person} onChange={e => setAddForm(f => ({ ...f, contact_person: e.target.value }))} />
                </div>
              </div>
              {/* Row 2: Contact Number + Email */}
              <div className="supp-modal-grid">
                <div className="supp-modal-field">
                  <label className="supp-modal-label">Contact Number</label>
                  <input className="supp-modal-input" type="tel" placeholder="Optional" value={addForm.contact_number} onChange={e => setAddForm(f => ({ ...f, contact_number: e.target.value }))} />
                </div>
                <div className="supp-modal-field">
                  <label className="supp-modal-label">Email</label>
                  <input className="supp-modal-input" type="email" placeholder="Optional" value={addForm.email_address} onChange={e => setAddForm(f => ({ ...f, email_address: e.target.value }))} />
                </div>
              </div>
              {/* Row 3: Address + Payment Terms */}
              <div className="supp-modal-grid">
                <div className="supp-modal-field">
                  <label className="supp-modal-label">Address</label>
                  <input className="supp-modal-input" placeholder="Optional" value={addForm.address} onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))} />
                </div>
                <div className="supp-modal-field">
                  <label className="supp-modal-label">Payment Terms (days)</label>
                  <input className="supp-modal-input" type="number" min="0" value={addForm.default_payment_terms_days} onChange={e => setAddForm(f => ({ ...f, default_payment_terms_days: e.target.value }))} />
                </div>
              </div>
              {addError && <div className="supp-modal-error">{addError}</div>}
              {/* Row 4: Actions */}
              <div className="supp-modal-actions">
                <button className="supp-modal-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="supp-modal-ok" onClick={handleAdd} disabled={addSaving}>{addSaving ? 'Adding…' : '✓ Add Supplier'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Supplier Modal */}
        {editTarget && (
          <div className="supp-overlay" onClick={e => e.target === e.currentTarget && setEditTarget(null)}>
            <div className="supp-modal">
              <div className="supp-modal-title">
                Edit Supplier
                <button className="supp-modal-close" onClick={() => setEditTarget(null)}>✕</button>
              </div>
              {/* Row 1: Supplier Name + Contact Person */}
              <div className="supp-modal-grid">
                <div className="supp-modal-field">
                  <label className="supp-modal-label">Supplier Name *</label>
                  <input className="supp-modal-input" value={editForm.supplier_name} onChange={e => setEditForm(f => ({ ...f, supplier_name: e.target.value }))} autoFocus />
                </div>
                <div className="supp-modal-field">
                  <label className="supp-modal-label">Contact Person</label>
                  <input className="supp-modal-input" placeholder="Optional" value={editForm.contact_person} onChange={e => setEditForm(f => ({ ...f, contact_person: e.target.value }))} />
                </div>
              </div>
              {/* Row 2: Contact Number + Email */}
              <div className="supp-modal-grid">
                <div className="supp-modal-field">
                  <label className="supp-modal-label">Contact Number</label>
                  <input className="supp-modal-input" type="tel" placeholder="Optional" value={editForm.contact_number} onChange={e => setEditForm(f => ({ ...f, contact_number: e.target.value }))} />
                </div>
                <div className="supp-modal-field">
                  <label className="supp-modal-label">Email</label>
                  <input className="supp-modal-input" type="email" placeholder="Optional" value={editForm.email_address} onChange={e => setEditForm(f => ({ ...f, email_address: e.target.value }))} />
                </div>
              </div>
              {/* Row 3: Address + Payment Terms */}
              <div className="supp-modal-grid">
                <div className="supp-modal-field">
                  <label className="supp-modal-label">Address</label>
                  <input className="supp-modal-input" placeholder="Optional" value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
                </div>
                <div className="supp-modal-field">
                  <label className="supp-modal-label">Payment Terms (days)</label>
                  <input className="supp-modal-input" type="number" min="0" value={editForm.default_payment_terms_days} onChange={e => setEditForm(f => ({ ...f, default_payment_terms_days: e.target.value }))} />
                </div>
              </div>
              {editError && <div className="supp-modal-error">{editError}</div>}
              {/* Row 4: Actions */}
              <div className="supp-modal-actions">
                <button className="supp-modal-cancel" onClick={() => setEditTarget(null)}>Cancel</button>
                <button className="supp-modal-ok" onClick={handleEdit} disabled={editSaving}>{editSaving ? 'Saving…' : '✓ Save Changes'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Remove Confirm Modal */}
        {removeTarget && (
          <div className="supp-overlay" style={{ zIndex: 1100 }} onClick={e => e.target === e.currentTarget && setRemoveTarget(null)}>
            <div className="supp-modal">
              <div className="supp-modal-title" style={{ color: 'var(--th-rose)' }}>Remove Supplier?</div>
              <p style={{ fontSize: '0.88rem', color: 'var(--th-text-body)', marginBottom: '1rem' }}>
                <b>{removeTarget.supplier_name}</b> will be permanently removed.
              </p>
              <div style={{ background: 'var(--th-bg-card-alt)', border: '1px solid var(--th-border)', borderRadius: 8, padding: '0.7rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--th-text-faint)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Name</span><span style={{ fontWeight: 700 }}>{removeTarget.supplier_name}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--th-text-faint)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Code</span><span style={{ fontFamily: 'monospace' }}>{removeTarget.supplier_code}</span></div>
                {removeTarget.supplier_brands?.length > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--th-text-faint)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Brands</span><span style={{ color: 'var(--th-rose)' }}>{removeTarget.supplier_brands.length} brand(s) will be removed</span></div>}
              </div>
              <div className="supp-modal-actions">
                <button className="supp-modal-cancel" onClick={() => setRemoveTarget(null)}>Cancel</button>
                <button className="supp-modal-ok sp-danger" onClick={handleRemove} disabled={removeSaving}>{removeSaving ? 'Removing…' : 'Remove'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Supplier Detail Modal — inv-history pattern */}
        {detail && (
          <div className="hist-modal-overlay" onClick={e => e.target === e.currentTarget && setDetail(null)}>
            <div className="inv-history supp-detail-modal">
              {/* Sticky header */}
              <div className="inv-hist-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--th-amber,#fbbf24)" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
                  <div style={{ minWidth: 0 }}>
                    <div className="inv-hist-item-name" style={{ color: 'var(--th-amber,#fbbf24)' }}>{detail.supplier_name}</div>
                    <div className="inv-hist-item-sku">{detail.supplier_code}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                  <button className="supp-btn-edit" onClick={() => {
                    setEditTarget(detail)
                    setEditForm({ supplier_name: detail.supplier_name, contact_person: detail.contact_person || '', contact_number: detail.contact_number || '', email_address: detail.email_address || '', address: detail.address || '', default_payment_terms_days: String(detail.default_payment_terms_days || 30) })
                    setEditError('')
                    setDetail(null)
                  }}>Edit</button>
                  <button className="inv-hist-close" onClick={() => setDetail(null)}>✕</button>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="inv-hist-body" style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {detailError && <div className="supp-modal-error">{detailError}</div>}

                {/* KPI stats card */}
                <div className="inv-hist-item-card">
                  <div className="inv-hist-stats">
                    {detail.contact_person && (
                      <div className="inv-hist-stat">
                        <div className="inv-hist-stat-label">Contact Person</div>
                        <div className="inv-hist-stat-val" style={{ fontSize: '0.9rem', wordBreak: 'break-word' }}>{detail.contact_person}</div>
                      </div>
                    )}
                    {detail.contact_number && (
                      <div className="inv-hist-stat">
                        <div className="inv-hist-stat-label">Phone</div>
                        <div className="inv-hist-stat-val emerald" style={{ fontSize: '0.9rem', wordBreak: 'break-word' }}>{detail.contact_number}</div>
                      </div>
                    )}
                    {detail.email_address && (
                      <div className="inv-hist-stat">
                        <div className="inv-hist-stat-label">Email</div>
                        <div className="inv-hist-stat-val sky" style={{ fontSize: '0.82rem', wordBreak: 'break-all' }}>{detail.email_address}</div>
                      </div>
                    )}
                    <div className="inv-hist-stat">
                      <div className="inv-hist-stat-label">Payment Terms</div>
                      <div className="inv-hist-stat-val violet">{detail.default_payment_terms_days || 30}<span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--th-text-faint)' }}> days</span></div>
                    </div>
                  </div>
                </div>

                {/* Address */}
                {detail.address && (
                  <div className="inv-hist-entry other" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.2rem' }}>
                    <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--th-text-faint)', fontWeight: 700 }}>Address</span>
                    <span style={{ color: 'var(--th-text-body)', fontSize: '0.88rem' }}>{detail.address}</span>
                  </div>
                )}

                {/* Tabs */}
                <div className="supp-tabs" style={{ marginBottom: 0 }}>
                  {['brands', 'inventory'].map(t => (
                    <button key={t} className={`supp-tab${detailTab === t ? ' active' : ''}`} onClick={() => switchTab(t)}>
                      {t === 'brands' ? `Brands (${detail.supplier_brands?.length || 0})` : 'Inventory'}
                    </button>
                  ))}
                </div>

                {detailTab === 'brands' && (
                  <>
                    <div className="supp-section-head">
                      <span>Brand Catalog</span>
                      <button className="supp-btn-view" onClick={() => setShowBrandForm(v => !v)}>{showBrandForm ? 'Cancel' : '+ Add Brand'}</button>
                    </div>

                    {showBrandForm && (
                      <div className="supp-brand-form">
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--th-text-faint)', marginBottom: '0.5rem' }}>New Brand Entry</div>
                        {brandInputs.map((b, i) => (
                          <div key={b.id} className="supp-brand-form-row">
                            <div>
                              {i === 0 && <div className="supp-modal-label">Brand Name</div>}
                              <input className="supp-modal-input" placeholder="e.g. BRIDGESTONE" value={b.brand_name} onChange={e => setBrandInputs(prev => prev.map((x, j) => j === i ? { ...x, brand_name: e.target.value } : x))} />
                            </div>
                            <div>
                              {i === 0 && <div className="supp-modal-label">Item Type</div>}
                              <select className="supp-modal-input" value={b.item_type} onChange={e => setBrandInputs(prev => prev.map((x, j) => j === i ? { ...x, item_type: e.target.value } : x))}>
                                <option value="">— Type —</option>
                                {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </div>
                            <div>
                              {i === 0 && <div className="supp-modal-label">Origins</div>}
                              <input className="supp-modal-input" placeholder="e.g. Japan" value={b.brand_origins} onChange={e => setBrandInputs(prev => prev.map((x, j) => j === i ? { ...x, brand_origins: e.target.value } : x))} />
                            </div>
                            <div>
                              {i === 0 && <div className="supp-modal-label" style={{ visibility: 'hidden' }}>x</div>}
                              <button style={{ background: 'var(--th-rose-bg)', border: '1px solid var(--th-rose)', color: 'var(--th-rose)', borderRadius: 6, padding: '0.45rem 0.6rem', cursor: 'pointer', fontSize: '0.82rem', width: '100%' }} onClick={() => setBrandInputs(prev => prev.length > 1 ? prev.filter((_, j) => j !== i) : prev)}>✕</button>
                            </div>
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <button style={{ background: 'var(--th-bg-card-alt)', border: '1px solid var(--th-border-strong)', color: 'var(--th-text-muted)', borderRadius: 7, padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }} onClick={() => setBrandInputs(prev => [...prev, BLANK_BRAND()])}>+ Add Row</button>
                          <button className="supp-modal-ok" style={{ flex: '0 0 auto', padding: '0.4rem 1.1rem' }} onClick={handleAddBrands} disabled={brandSaving}>{brandSaving ? <span className="supp-spinner" /> : '✓ Save Brands'}</button>
                        </div>
                      </div>
                    )}

                    <div>
                      {detail.supplier_brands?.length > 0 ? (
                        detail.supplier_brands.map(b => (
                          <div key={b.brand_id} className="supp-brand-row">
                            <div>
                              <div className="supp-brand-name">{b.brand_name}</div>
                              <div className="supp-brand-meta">{b.item_type}{b.brand_origins ? ` · ${b.brand_origins}` : ''}</div>
                            </div>
                            <button className="supp-brand-del" onClick={() => setDeleteBrand(b)}>✕ Remove</button>
                          </div>
                        ))
                      ) : <div className="supp-brand-empty">No brands added yet</div>}
                    </div>
                  </>
                )}

                {detailTab === 'inventory' && (
                  <>
                    <div className="supp-section-head">
                      <span>Items Received from Supplier</span>
                    </div>
                    {invLoading ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--th-text-faint)', fontSize: '0.82rem', padding: '0.75rem 0' }}><div className="th-spinner th-spinner-sm" />Loading…</div>
                    ) : supplierInventory.length === 0 ? (
                      <div style={{ color: 'var(--th-text-faint)', fontSize: '0.82rem', textAlign: 'center', padding: '1rem' }}>No inventory records for this supplier.</div>
                    ) : (
                      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <table className="supp-inv-table">
                          <thead>
                            <tr>
                              <th>Item</th>
                              <th>Brand</th>
                              <th>Size</th>
                              <th style={{ textAlign: 'right' }}>Received</th>
                              <th style={{ textAlign: 'right' }}>Stock</th>
                              <th style={{ textAlign: 'right' }}>Last Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {supplierInventory.map(item => (
                              <tr key={item.item_id}>
                                <td style={{ color: 'var(--th-text-heading)', fontWeight: 600, fontSize: '0.85rem' }}>{item.item_name}</td>
                                <td style={{ color: 'var(--th-amber,#fbbf24)', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{item.brand || '—'}</td>
                                <td style={{ color: 'var(--th-text-dim)' }}>{item.size || '—'}</td>
                                <td style={{ textAlign: 'right', color: 'var(--th-sky)' }}>{item.total_received}</td>
                                <td style={{ textAlign: 'right', color: item.current_quantity > 0 ? 'var(--th-emerald)' : 'var(--th-rose)' }}>{item.current_quantity}</td>
                                <td style={{ textAlign: 'right', color: 'var(--th-text-body)' }}>₱{Number(item.unit_cost || 0).toLocaleString('en-PH')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                {/* Remove link */}
                <div style={{ paddingTop: '0.85rem', borderTop: '1px solid var(--th-border)' }}>
                  <button style={{ background: 'none', border: 'none', color: 'var(--th-text-faint)', fontSize: '0.78rem', cursor: 'pointer', padding: '0', textDecoration: 'underline', textUnderlineOffset: '3px' }} onClick={() => { setRemoveTarget(detail); setDetail(null) }}>
                    Remove this supplier
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Brand Confirm */}
        {deleteBrand && (
          <div className="supp-overlay" style={{ zIndex: 1100 }} onClick={e => e.target === e.currentTarget && setDeleteBrand(null)}>
            <div className="supp-modal">
              <div className="supp-modal-title" style={{ color: 'var(--th-rose)' }}>Remove Brand?</div>
              <div style={{ background: 'var(--th-bg-card-alt)', border: '1px solid var(--th-border)', borderRadius: 8, padding: '0.7rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--th-text-faint)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Brand</span><span style={{ fontWeight: 700, color: 'var(--th-amber,#fbbf24)' }}>{deleteBrand.brand_name}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--th-text-faint)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Type</span><span>{deleteBrand.item_type}</span></div>
              </div>
              <div className="supp-modal-actions">
                <button className="supp-modal-cancel" onClick={() => setDeleteBrand(null)}>Cancel</button>
                <button className="supp-modal-ok sp-danger" onClick={confirmDeleteBrand}>Remove</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default SuppliersPage
