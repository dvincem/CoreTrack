import React from 'react'
import { API_URL, apiFetch, SkeletonRows } from '../lib/config'
import usePaginatedResource from '../hooks/usePaginatedResource'
import Pagination from '../components/Pagination'
import KpiCard from '../components/KpiCard'
import SearchInput from '../components/SearchInput'
import FilterHeader from '../components/FilterHeader'



const BLANK_FORM = { customer_name: '', company: '', contact_number: '', address: '', car_plate_number: '' }

const CU_PAGE_SIZE = 15

function CustomerPage({ shopId }) {
  const [suggestions, setSuggestions] = React.useState([])
  const [filter, setFilter] = React.useState('All')
  const [kpi, setKpi] = React.useState(null)
  const CU_PAGE_SIZE = 10
  const {
    data: customers,
    page: cuPage, setPage: setCuPage,
    totalPages: cuTotalPages,
    total: cuTotal,
    loading,
    search, setSearch,
    refetch: fetchCustomers,
  } = usePaginatedResource({
    url: `${API_URL}/customers/${shopId}`,
    perPage: CU_PAGE_SIZE,
    extraParams: { filter: filter !== 'All' ? filter : '' },
    enabled: !!shopId,
    deps: [shopId, filter],
  })

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
  const [detailCustomer, setDetailCustomer] = React.useState(null)
  const [customerSales, setCustomerSales] = React.useState([])
  const [loadingSales, setLoadingSales] = React.useState(false)
  const [showPlateForm, setShowPlateForm] = React.useState(false)
  const [plateInput, setPlateInput] = React.useState('')
  const [plateSaving, setPlateSaving] = React.useState(false)
  const [detailError, setDetailError] = React.useState('')

  React.useEffect(() => {
    if (!shopId) return
    apiFetch(`${API_URL}/customers-kpi/${shopId}`)
      .then(r => r.json()).then(d => { if (!d.error) setKpi(d) }).catch(() => { })
  }, [shopId])

  function openDetail(c) {
    setDetailCustomer(c)
    setCustomerSales([])
    setLoadingSales(true)
    setShowPlateForm(false)
    setDetailError('')
    apiFetch(`${API_URL}/customer-sales/${c.customer_id}`)
      .then(r => r.json())
      .then(d => { setCustomerSales(Array.isArray(d) ? d : []); setLoadingSales(false) })
      .catch(() => setLoadingSales(false))
  }

  async function handleAdd() {
    if (!addForm.customer_name.trim()) { setAddError('Customer name is required.'); return }
    setAddSaving(true); setAddError('')
    try {
      const r = await apiFetch(`${API_URL}/customers`, {
        method: 'POST',
        body: JSON.stringify({ shop_id: shopId, customer_name: addForm.customer_name.trim(), company: addForm.company || null, contact_number: addForm.contact_number || null, address: addForm.address || null }),
      })
      const data = await r.json()
      if (!r.ok) { setAddError(data.error || 'Failed to add'); return }
      if (addForm.car_plate_number.trim()) {
        try {
          await apiFetch(`${API_URL}/vehicle-plates`, {
            method: 'POST',
            body: JSON.stringify({ customer_id: data.customer_id, plate_number: addForm.car_plate_number.trim() }),
          })
        } catch { }
      }
      setShowAdd(false); setAddForm(BLANK_FORM)
      fetchCustomers()
    } catch { setAddError('Could not connect to server.') }
    finally { setAddSaving(false) }
  }

  async function handleEdit() {
    if (!editForm.customer_name.trim()) { setEditError('Customer name is required.'); return }
    setEditSaving(true); setEditError('')
    try {
      const r = await apiFetch(`${API_URL}/customers/${editTarget.customer_id}`, {
        method: 'PUT',
        body: JSON.stringify({ customer_name: editForm.customer_name.trim(), company: editForm.company || null, contact_number: editForm.contact_number || null, address: editForm.address || null }),
      })
      const data = await r.json()
      if (!r.ok) { setEditError(data.error || 'Failed to update'); return }
      setEditTarget(null)
      fetchCustomers()
    } catch { setEditError('Could not connect to server.') }
    finally { setEditSaving(false) }
  }

  async function handleRemove() {
    setRemoveSaving(true)
    try {
      const r = await apiFetch(`${API_URL}/customers/${removeTarget.customer_id}`, { method: 'DELETE' })
      if (!r.ok) return
      fetchCustomers()
    } catch { }
    finally { setRemoveTarget(null); setRemoveSaving(false) }
  }

  async function handleAddPlate() {
    if (!plateInput.trim()) return
    setPlateSaving(true); setDetailError('')
    try {
      const r = await apiFetch(`${API_URL}/vehicle-plates`, {
        method: 'POST',
        body: JSON.stringify({ customer_id: detailCustomer.customer_id, plate_number: plateInput.trim() }),
      })
      const data = await r.json()
      if (!r.ok) { setDetailError(data.error || 'Failed to add plate'); return }
      setDetailCustomer(prev => ({ ...prev, vehicle_plates: [...(prev.vehicle_plates || []), data] }))
      setPlateInput(''); setShowPlateForm(false)
      fetchCustomers()
    } catch { setDetailError('Could not connect to server.') }
    finally { setPlateSaving(false) }
  }

  async function handleDeletePlate(plateId) {
    try {
      const r = await apiFetch(`${API_URL}/vehicle-plates/${plateId}`, { method: 'DELETE' })
      if (!r.ok) return
      setDetailCustomer(prev => ({ ...prev, vehicle_plates: prev.vehicle_plates.filter(p => p.plate_id !== plateId) }))
      fetchCustomers()
    } catch { }
  }

  // KPIs — from server aggregate; fallback to current-page count while loading
  const withVehicles = kpi?.withVehicles ?? customers.filter(c => c.vehicle_plates?.length > 0).length
  const companies = kpi?.companies ?? customers.filter(c => c.company).length
  const newThisMonth = kpi?.newThisMonth ?? 0

  // Suggestions from customer list
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
    for (const c of customers) {
      if (results.length >= 10) break
      if (c.customer_name?.toLowerCase().includes(q)) add(c.customer_name, 'NAME', '👤')
      if (c.customer_code?.toLowerCase().includes(q)) add(c.customer_code, 'ID', '🆔')
      if (c.company?.toLowerCase().includes(q)) add(c.company, 'COMPANY', '🏢')
      if (c.contact_number?.toLowerCase().includes(q)) add(c.contact_number, 'CONTACT', '📞')
    }
    setSuggestions(results.slice(0, 10))
  }, [search, customers])

  // Server owns filter+search+pagination; `customers` is the current page.
  const filtered = customers
  const paged = customers

  function openAdd() { setShowAdd(true); setAddForm(BLANK_FORM); setAddError('') }

  return (
    <>
      <style>{`
        .cp-root {
            font-family: var(--font-body);
            color: var(--th-text-primary);
            display: flex;
            flex-direction: column;
            gap: .5rem;
        }
      `}</style>
      <div className="cp-root">
        {/* Header row: title + desktop Add button */}
        <div className="cp-header-row">
          <div className="th-title-format">Custo<span style={{ color: 'var(--th-sky)' }}>mers</span></div>
          <button className="cp-btn-add cp-add-desktop" onClick={openAdd}>+ Add Customer</button>
        </div>

        {/* KPI Cards */}
        <div className="th-kpi-row">
          <KpiCard label="Total Customers" value={kpi?.totalCustomers ?? cuTotal} accent="sky" loading={loading} />
          <KpiCard label="With Vehicles" value={withVehicles} accent="violet" loading={loading} />
          <KpiCard label="Companies / B2B" value={companies} accent="amber" loading={loading} />
          <KpiCard label="New This Month" value={newThisMonth} accent="emerald" loading={loading} />
        </div>

        {/* Filter Header */}
        <FilterHeader
          searchProps={{
            value: search,
            onChange: (v) => { setSearch(v); setCuPage(1); },
            placeholder: "Search name, ID, company, phone…",
            suggestions: suggestions,
            onSuggestionSelect: (s) => { setSearch(s.text); setCuPage(1); },
            resultCount: search.trim() ? filtered.length : undefined,
            resultLabel: "customers",
          }}
          filters={[
            { label: "All", value: "All", active: filter === "All" },
            { label: "With Vehicles", value: "With Vehicles", active: filter === "With Vehicles" },
            { label: "Companies", value: "Companies", active: filter === "Companies" },
          ]}
          onFilterChange={setFilter}
          accentColor="var(--th-sky)"
        />

        {/* Mobile-only Add button */}
        <button className="cp-btn-add cp-add-mobile" onClick={openAdd}>+ Add Customer</button>

        {/* Table */}
        <div className="th-section-label">Customer Directory</div>
        <div className="cp-table-card">
          {loading ? (
            <table className="cp-table"><tbody><SkeletonRows rows={7} cols={4} widths={['w60', 'w40', 'w30', 'w20']} /></tbody></table>
          ) : filtered.length === 0 ? (
            <div className="cp-empty">{search || filter !== 'All' ? 'No customers match the filter.' : 'No customers found. Click "+ Add Customer" to get started.'}</div>
          ) : (
            <>
              <div className="cp-table-scroll">
                <table className="cp-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Company</th>
                      <th>Contact</th>
                      <th>Vehicles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map(c => (
                      <tr key={c.customer_id} style={{ cursor: 'pointer' }} onClick={() => openDetail(c)}>
                        <td>
                          <div className="cp-name">{c.customer_name}</div>
                          <div className="cp-code">{c.customer_code}</div>
                        </td>
                        <td>
                          {c.company
                            ? <div className="cp-company">{c.company}</div>
                            : <span style={{ color: 'var(--th-text-faint)' }}>—</span>}
                        </td>
                        <td>
                          {c.contact_number
                            ? <div className="cp-phone">{c.contact_number}</div>
                            : <span style={{ color: 'var(--th-text-faint)' }}>—</span>}
                          {c.address && <div style={{ fontSize: '0.76rem', color: 'var(--th-text-dim)', marginTop: '0.15rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.address}</div>}
                        </td>
                        <td>
                          {c.vehicle_plates?.length > 0 ? (
                            <div>
                              {c.vehicle_plates.slice(0, 2).map((p, i) => <span key={i} className="cp-plate-chip">{p.plate_number}</span>)}
                              {c.vehicle_plates.length > 2 && <span className="cp-more-chip">+{c.vehicle_plates.length - 2}</span>}
                            </div>
                          ) : <span style={{ color: 'var(--th-text-faint)' }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination currentPage={cuPage} totalPages={cuTotalPages} onPageChange={setCuPage} />
            </>
          )}
        </div>

        {/* Add Customer Modal */}
        {showAdd && (
          <div className="cp-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
            <div className="cp-modal">
              <div className="cp-modal-title">
                New Customer
                <button className="cp-modal-close" onClick={() => setShowAdd(false)}>✕</button>
              </div>
              {/* Row 1: Name + Company */}
              <div className="cp-modal-grid">
                <div className="cp-modal-field">
                  <label className="cp-modal-label">Customer/Company Name *</label>
                  <input className="cp-modal-input" placeholder="Full name" value={addForm.customer_name} onChange={e => setAddForm(f => ({ ...f, customer_name: e.target.value }))} autoFocus />
                </div>
                <div className="cp-modal-field">
                  <label className="cp-modal-label">Contact person</label>
                  <input className="cp-modal-input" placeholder="Optional" value={addForm.company} onChange={e => setAddForm(f => ({ ...f, company: e.target.value }))} />
                </div>
              </div>
              {/* Row 2: Contact + Car Plate */}
              <div className="cp-modal-grid">
                <div className="cp-modal-field">
                  <label className="cp-modal-label">Contact Number</label>
                  <input className="cp-modal-input" type="tel" placeholder="Optional" value={addForm.contact_number} onChange={e => setAddForm(f => ({ ...f, contact_number: e.target.value }))} />
                </div>
                <div className="cp-modal-field">
                  <label className="cp-modal-label">Car Plate</label>
                  <input className="cp-modal-input" placeholder="e.g. ABC-1234" value={addForm.car_plate_number} onChange={e => setAddForm(f => ({ ...f, car_plate_number: e.target.value }))} />
                </div>
              </div>
              {/* Row 3: Address */}
              <div className="cp-modal-field">
                <label className="cp-modal-label">Address</label>
                <input className="cp-modal-input" placeholder="Optional" value={addForm.address} onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              {addError && <div className="cp-modal-error">{addError}</div>}
              {/* Row 4: Actions footer */}
              <div className="cp-modal-actions">
                <button className="cp-modal-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="cp-modal-ok" onClick={handleAdd} disabled={addSaving}>{addSaving ? 'Adding…' : '✓ Add Customer'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Customer Modal */}
        {editTarget && (
          <div className="cp-overlay" onClick={e => e.target === e.currentTarget && setEditTarget(null)}>
            <div className="cp-modal">
              <div className="cp-modal-title">
                Edit Customer
                <button className="cp-modal-close" onClick={() => setEditTarget(null)}>✕</button>
              </div>
              {/* Row 1: Name + Company */}
              <div className="cp-modal-grid">
                <div className="cp-modal-field">
                  <label className="cp-modal-label">Customer Name *</label>
                  <input className="cp-modal-input" value={editForm.customer_name} onChange={e => setEditForm(f => ({ ...f, customer_name: e.target.value }))} autoFocus />
                </div>
                <div className="cp-modal-field">
                  <label className="cp-modal-label">Company</label>
                  <input className="cp-modal-input" placeholder="Optional" value={editForm.company} onChange={e => setEditForm(f => ({ ...f, company: e.target.value }))} />
                </div>
              </div>
              {/* Row 2: Contact Number */}
              <div className="cp-modal-field">
                <label className="cp-modal-label">Contact Number</label>
                <input className="cp-modal-input" type="tel" placeholder="Optional" value={editForm.contact_number} onChange={e => setEditForm(f => ({ ...f, contact_number: e.target.value }))} />
              </div>
              {/* Row 3: Address */}
              <div className="cp-modal-field">
                <label className="cp-modal-label">Address</label>
                <input className="cp-modal-input" placeholder="Optional" value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              {editError && <div className="cp-modal-error">{editError}</div>}
              {/* Row 4: Actions footer */}
              <div className="cp-modal-actions">
                <button className="cp-modal-cancel" onClick={() => setEditTarget(null)}>Cancel</button>
                <button className="cp-modal-ok" onClick={handleEdit} disabled={editSaving}>{editSaving ? 'Saving…' : '✓ Save Changes'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Remove Confirm Modal */}
        {removeTarget && (
          <div className="cp-overlay" style={{ zIndex: 1100 }} onClick={e => e.target === e.currentTarget && setRemoveTarget(null)}>
            <div className="cp-modal">
              <div className="cp-modal-title" style={{ color: 'var(--th-rose)' }}>Remove Customer?</div>
              <p style={{ fontSize: '0.88rem', color: 'var(--th-text-body)', marginBottom: '1rem' }}>
                <b>{removeTarget.customer_name}</b> will be permanently deleted.
              </p>
              <div style={{ background: 'var(--th-bg-card-alt)', border: '1px solid var(--th-border)', borderRadius: 8, padding: '0.7rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--th-text-faint)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Name</span><span style={{ fontWeight: 700 }}>{removeTarget.customer_name}</span></div>
                {removeTarget.customer_code && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--th-text-faint)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>ID</span><span style={{ fontFamily: 'monospace' }}>{removeTarget.customer_code}</span></div>}
                {removeTarget.contact_number && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--th-text-faint)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 600 }}>Contact</span><span>{removeTarget.contact_number}</span></div>}
              </div>
              <div className="cp-modal-actions">
                <button className="cp-modal-cancel" onClick={() => setRemoveTarget(null)}>Cancel</button>
                <button className="cp-modal-ok danger" onClick={handleRemove} disabled={removeSaving}>{removeSaving ? 'Removing…' : 'Remove'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Customer Detail Modal — inv-history pattern */}
        {detailCustomer && (
          <div className="hist-modal-overlay" onClick={e => e.target === e.currentTarget && setDetailCustomer(null)}>
            <div className="inv-history cp-detail-modal">
              {/* Sticky header */}
              <div className="inv-hist-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--th-sky)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  <div style={{ minWidth: 0 }}>
                    <div className="inv-hist-item-name" style={{ color: 'var(--th-sky)' }}>{detailCustomer.customer_name}</div>
                    <div className="inv-hist-item-sku">{detailCustomer.customer_code}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                  <button className="cp-btn-edit" onClick={() => {
                    setEditTarget(detailCustomer)
                    setEditForm({ customer_name: detailCustomer.customer_name, company: detailCustomer.company || '', contact_number: detailCustomer.contact_number || '', address: detailCustomer.address || '', car_plate_number: '' })
                    setEditError('')
                    setDetailCustomer(null)
                  }}>Edit</button>
                  <button className="inv-hist-close" onClick={() => setDetailCustomer(null)}>✕</button>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="inv-hist-body">
                {detailError && <div className="cp-modal-error" style={{ marginBottom: '0.75rem' }}>{detailError}</div>}

                {/* KPI stats card */}
                <div className="inv-hist-item-card">
                  <div className="inv-hist-stats">
                    {detailCustomer.company && (
                      <div className="inv-hist-stat">
                        <div className="inv-hist-stat-label">Company</div>
                        <div className="inv-hist-stat-val sky">{detailCustomer.company}</div>
                      </div>
                    )}
                    {detailCustomer.contact_number && (
                      <div className="inv-hist-stat">
                        <div className="inv-hist-stat-label">Contact</div>
                        <div className="inv-hist-stat-val emerald">{detailCustomer.contact_number}</div>
                      </div>
                    )}
                    <div className="inv-hist-stat">
                      <div className="inv-hist-stat-label">Vehicles</div>
                      <div className="inv-hist-stat-val violet">{detailCustomer.vehicle_plates?.length || 0}</div>
                    </div>
                    <div className="inv-hist-stat">
                      <div className="inv-hist-stat-label">Member Since</div>
                      <div className="inv-hist-stat-val">{new Date(detailCustomer.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                  </div>
                </div>

                {/* Address */}
                {detailCustomer.address && (
                  <div className="inv-hist-entry other" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.2rem' }}>
                    <span className="cp-detail-label">Address</span>
                    <span style={{ color: 'var(--th-text-body)', fontSize: '0.88rem' }}>{detailCustomer.address}</span>
                  </div>
                )}

                {/* Vehicle Plates */}
                <div className="cp-section-head" style={{ marginTop: '0.25rem' }}>
                  <span>Vehicle Plates ({detailCustomer.vehicle_plates?.length || 0})</span>
                  <button className="cp-btn-view" onClick={() => setShowPlateForm(v => !v)}>{showPlateForm ? 'Cancel' : '+ Add'}</button>
                </div>
                {showPlateForm && (
                  <div className="cp-add-plate-row">
                    <input className="cp-modal-input" style={{ flex: 1 }} placeholder="e.g. ABC-1234" value={plateInput} onChange={e => setPlateInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddPlate()} autoFocus />
                    <button className="cp-modal-ok" style={{ flex: '0 0 auto', padding: '0.5rem 1rem', marginTop: 0 }} onClick={handleAddPlate} disabled={plateSaving}>{plateSaving ? <span className="cp-spinner" /> : 'Add'}</button>
                  </div>
                )}
                <div className="cp-plates-wrap" style={{ marginBottom: '0.85rem' }}>
                  {detailCustomer.vehicle_plates?.length > 0 ? (
                    detailCustomer.vehicle_plates.map(p => (
                      <div key={p.plate_id} className="cp-plate-row">
                        <span className="cp-plate-num">{p.plate_number}</span>
                        <button className="cp-plate-del" onClick={() => handleDeletePlate(p.plate_id)}>✕ Remove</button>
                      </div>
                    ))
                  ) : <div className="cp-plate-empty">No vehicles registered yet</div>}
                </div>

                {/* Transaction History */}
                <div className="cp-section-head">
                  <span>Transaction History</span>
                  <span style={{ background: 'var(--th-sky-bg)', color: 'var(--th-sky)', borderRadius: 20, padding: '0.1rem 0.5rem', fontSize: '0.72rem', fontWeight: 700 }}>{customerSales.length}</span>
                </div>
                <div className="cp-history-wrap">
                  {loadingSales ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--th-text-faint)', fontSize: '0.82rem', padding: '0.5rem 0' }}><div className="th-spinner th-spinner-sm" />Loading…</div>
                  ) : customerSales.length === 0 ? (
                    <div style={{ color: 'var(--th-text-faint)', fontSize: '0.82rem', textAlign: 'center', padding: '0.75rem' }}>No transactions recorded yet.</div>
                  ) : customerSales.map(s => (
                    <div key={s.sale_id} className="cp-sale-card">
                      <div className="cp-sale-row">
                        <span className="cp-sale-id">{s.sale_id}</span>
                        <span className="cp-sale-amount">₱{Number(s.total_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="cp-sale-meta">
                        {new Date(s.sale_datetime).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                        {s.staff_name && <span style={{ marginLeft: '0.45rem', color: 'var(--th-text-faint)' }}>· {s.staff_name}</span>}
                      </div>
                      {s.items_summary && <div className="cp-sale-items">{s.items_summary}</div>}
                    </div>
                  ))}
                </div>

                {/* Remove link */}
                <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid var(--th-border)' }}>
                  <button style={{ background: 'none', border: 'none', color: 'var(--th-text-faint)', fontSize: '0.78rem', cursor: 'pointer', padding: '0', textDecoration: 'underline', textUnderlineOffset: '3px' }} onClick={() => { setRemoveTarget(detailCustomer); setDetailCustomer(null) }}>
                    Remove this customer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default CustomerPage
