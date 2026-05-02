import '../pages_css/ExpensesPage.css';
import React from 'react'
import { API_URL, currency, compactCurrency, apiFetch } from '../lib/config'
import KpiCard from '../components/KpiCard'
import SearchInput from '../components/SearchInput'
import { DataTable } from '../components/DataTable'
import Modal from '../components/Modal'
import usePaginatedResource from '../hooks/usePaginatedResource'
import FilterHeader from '../components/FilterHeader'



const PAYMENT_METHODS = ['CASH', 'GCASH', 'BANK TRANSFER', 'CHECK', 'CARD', 'OTHER']
const CAT_COLORS = ['#fb7185', '#f97316', '#fbbf24', '#34d399', '#38bdf8', '#a78bfa', '#e879f9', '#64748b']

const BLANK_FORM = {
  category_id: '',
  description: '',
  amount: '',
  expense_date: new Date().toISOString().split('T')[0],
  payment_method: 'CASH',
  reference_no: '',
  notes: '',
}

export default function ExpensesPage({ shopId, isShopClosed }) {
  const [summary, setSummary] = React.useState({ total: 0, by_method: [], by_category: [], daily: [] })
  const [categories, setCategories] = React.useState([])
  const [error, setError] = React.useState('')
  const [toast, setToast] = React.useState(null)

  // Filters
  const today = new Date().toISOString().split('T')[0]
  const [startDate, setStartDate] = React.useState(today)
  const [endDate, setEndDate] = React.useState(today)
  const [filterCat, setFilterCat] = React.useState('')
  const [activeRange, setActiveRange] = React.useState('today')

  const EXP_PAGE_SIZE = 20
  const { data: expenses, page: expPage, setPage: setExpPage, totalPages: expTotalPages,
    total: expTotal, search, setSearch, loading, refetch: fetchExpenses } =
    usePaginatedResource({
      url: `${API_URL}/expenses/${shopId}`,
      perPage: EXP_PAGE_SIZE,
      extraParams: { startDate, endDate, category_id: filterCat || '' },
      enabled: !!shopId,
      deps: [shopId, startDate, endDate, filterCat],
    })

  function applyRange(key) {
    const t = new Date().toISOString().split('T')[0]
    const d = new Date(t)
    let from = t
    if (key === '7d') { d.setDate(d.getDate() - 6); from = d.toISOString().split('T')[0] }
    else if (key === '30d') { d.setDate(d.getDate() - 29); from = d.toISOString().split('T')[0] }
    else if (key === '3mo') { d.setMonth(d.getMonth() - 3); from = d.toISOString().split('T')[0] }
    else if (key === '6mo') { d.setMonth(d.getMonth() - 6); from = d.toISOString().split('T')[0] }
    else if (key === 'yr') { from = `${d.getFullYear()}-01-01` }
    setStartDate(from); setEndDate(t); setActiveRange(key)
  }

  // Form
  const [showExpForm, setShowExpForm] = React.useState(false)
  const [form, setForm] = React.useState(BLANK_FORM)
  const [editingId, setEditingId] = React.useState(null)
  const [formError, setFormError] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  // Selected expense for detail modal
  const [selectedExpense, setSelectedExpense] = React.useState(null)

  // Void modal
  const [voidTarget, setVoidTarget] = React.useState(null)
  const [voidReason, setVoidReason] = React.useState('')
  const [pendingExpense, setPendingExpense] = React.useState(null)

  // Category add
  const [newCatName, setNewCatName] = React.useState('')
  const [newCatColor, setNewCatColor] = React.useState(CAT_COLORS[0])

  const [, forceUpdate] = React.useReducer(x => x + 1, 0)

  React.useEffect(() => {
    const obs = new MutationObserver(() => forceUpdate())
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    fetchCategories()
    return () => obs.disconnect()
  }, [shopId])

  React.useEffect(() => { fetchSummary() }, [shopId, startDate, endDate])

  async function fetchSummary() {
    try {
      const r = await apiFetch(`${API_URL}/expenses-summary/${shopId}?startDate=${startDate}&endDate=${endDate}`)
      const d = await r.json()
      setSummary({ total: d.total || 0, by_method: d.by_method || [], by_category: d.by_category || [], daily: d.daily || [] })
    } catch (err) {
      console.error('fetchSummary failed:', err)
    }
  }

  async function fetchCategories() {
    try {
      const r = await apiFetch(`${API_URL}/expense-categories/${shopId}`)
      setCategories((await r.json()) || [])
    } catch (err) {
      console.error('fetchCategories failed:', err)
    }
  }

  function showToast(msg, icon = '✓') {
    setToast({ msg, icon })
    setTimeout(() => setToast(null), 2500)
  }

  function saveExpense(e) {
    e.preventDefault()
    setFormError('')
    if (!form.description.trim()) return setFormError('Description is required')
    if (!form.amount || parseFloat(form.amount) <= 0) return setFormError('Enter a valid amount')
    if (!form.expense_date) return setFormError('Date is required')
    const catName = categories.find(c => String(c.category_id) === String(form.category_id))?.name || 'Uncategorized'
    setPendingExpense({ ...form, amount: parseFloat(form.amount), catName, isEdit: !!editingId })
  }

  async function confirmSaveExpense() {
    const { catName, isEdit, ...payload } = pendingExpense
    setPendingExpense(null)
    setSaving(true)
    try {
      const fullPayload = { ...payload, shop_id: shopId, recorded_by: localStorage.getItem('th-user') || 'USER' }
      let r
      if (isEdit) {
        r = await apiFetch(`${API_URL}/expenses/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fullPayload) })
      } else {
        r = await apiFetch(`${API_URL}/expenses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fullPayload) })
      }
      const d = await r.json()
      if (!r.ok) return setFormError(d.error || 'Failed to save')
      setForm(BLANK_FORM)
      setEditingId(null)
      setShowExpForm(false)
      fetchExpenses()
      fetchSummary()
      showToast(isEdit ? 'Expense updated' : 'Expense recorded')
    } catch (ex) { setFormError(ex.message) }
    setSaving(false)
  }

  function startEdit(exp) {
    setEditingId(exp.expense_id)
    setForm({
      category_id: exp.category_id || '',
      description: exp.description,
      amount: exp.amount,
      expense_date: exp.expense_date,
      payment_method: exp.payment_method || 'CASH',
      reference_no: exp.reference_no || '',
      notes: exp.notes || '',
    })
    setFormError('')
    setShowExpForm(true)
  }

  function cancelEdit() { setForm(BLANK_FORM); setEditingId(null); setFormError(''); setShowExpForm(false) }

  async function confirmVoid() {
    if (!voidTarget) return
    try {
      const r = await apiFetch(`${API_URL}/expenses/${voidTarget.expense_id}/void`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ void_reason: voidReason }),
      })
      if (!r.ok) { const d = await r.json(); return setError(d.error || 'Failed to void') }
      setVoidTarget(null); setVoidReason('')
      fetchExpenses(); fetchSummary()
      showToast('Expense voided', '🗑')
    } catch (ex) { setError(ex.message) }
  }

  async function addCategory() {
    if (!newCatName.trim()) return
    try {
      const r = await apiFetch(`${API_URL}/expense-categories`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: shopId, name: newCatName.trim(), color: newCatColor }),
      })
      if (!r.ok) return
      setNewCatName('')
      fetchCategories()
      showToast('Category added')
    } catch (err) {
      console.error('addCategory failed:', err)
      showToast('Failed to add category', '✗')
    }
  }

  async function deleteCategory(category_id) {
    try {
      await apiFetch(`${API_URL}/expense-categories/${category_id}`, { method: 'DELETE' })
      fetchCategories()
      showToast('Category removed', '🗑')
    } catch (err) {
      console.error('deleteCategory failed:', err)
      showToast('Failed to remove category', '✗')
    }
  }

  function exportExcel() {
    if (!expenses.length) return
    import('xlsx').then(XLSX => {
      const rows = expenses.map(e => ({
        'Date': e.expense_date,
        'Description': e.description,
        'Category': e.category_name || 'Uncategorized',
        'Payment Method': e.payment_method,
        'Ref #': e.reference_no || '',
        'Amount': e.amount,
        'Notes': e.notes || '',
        'Recorded By': e.recorded_by || '',
      }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Expenses')
      XLSX.writeFile(wb, `expenses-${startDate}-to-${endDate}.xlsx`)
    })
  }

  const cashTotal = summary.by_method.find(m => m.payment_method === 'CASH')?.total || 0
  const gcashTotal = summary.by_method.find(m => m.payment_method === 'GCASH')?.total || 0

  const expColumns = React.useMemo(() => [
    {
      key: 'expense_date', label: 'Date', width: '95px',
      render: row => <span style={{ color: 'var(--th-text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{row.expense_date}</span>
    },
    {
      key: 'description', label: 'Description',
      render: row => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--th-text-primary)', fontSize: '0.88rem' }}>{row.description}</div>
          {row.notes && <div style={{ fontSize: '0.75rem', color: 'var(--th-text-faint)', marginTop: '0.1rem' }}>{row.notes}</div>}
        </div>
      )
    },
    {
      key: 'category_name', label: 'Category',
      render: row => row.category_name ? (
        <span className="exp-cat-pill" style={{ background: (row.category_color || '#f97316') + '22', color: row.category_color || '#f97316', border: `1px solid ${(row.category_color || '#f97316')}44` }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: row.category_color || '#f97316', display: 'inline-block' }} />
          {row.category_name}
        </span>
      ) : <span style={{ color: 'var(--th-text-faint)', fontSize: '0.78rem' }}>—</span>
    },
    {
      key: 'payment_method', label: 'Method',
      render: row => <span className="exp-method">{row.payment_method}</span>
    },
    {
      key: 'reference_no', label: 'Ref #',
      render: row => <span style={{ color: 'var(--th-text-faint)', fontSize: '0.8rem' }}>{row.reference_no || '—'}</span>
    },
    {
      key: 'amount', label: 'Amount', align: 'right',
      render: row => <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, color: 'var(--th-rose)', fontSize: '0.95rem' }}>{currency(row.amount)}</span>
    },
  ], [])

  return (
    <div className="exp-root">
      {/* Confirm Save Expense */}
      {pendingExpense && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <div className="confirm-title">{pendingExpense.isEdit ? 'Confirm Update Expense' : 'Confirm Record Expense'}</div>
            <div className="confirm-details">
              <div className="confirm-detail-row"><span className="confirm-detail-label">Description</span><span className="confirm-detail-val">{pendingExpense.description}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Amount</span><span className="confirm-detail-val">{currency(pendingExpense.amount)}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Category</span><span className="confirm-detail-val">{pendingExpense.catName}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Payment</span><span className="confirm-detail-val">{pendingExpense.payment_method}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Date</span><span className="confirm-detail-val">{pendingExpense.expense_date}</span></div>
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => setPendingExpense(null)}>Cancel</button>
              <button className="confirm-btn-ok" onClick={confirmSaveExpense}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Void modal */}
      {voidTarget && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <div className="confirm-title">Void Expense?</div>
            <div className="confirm-details">
              <div className="confirm-detail-row"><span className="confirm-detail-label">Description</span><span className="confirm-detail-val">{voidTarget.description}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Amount</span><span className="confirm-detail-val">{currency(voidTarget.amount)}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Date</span><span className="confirm-detail-val">{voidTarget.expense_date}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Action</span><span className="confirm-detail-val" style={{ color: 'var(--th-rose)' }}>Cannot be undone</span></div>
            </div>
            <div className="exp-field" style={{ marginBottom: '1rem' }}>
              <label className="exp-label">Reason (optional)</label>
              <input className="exp-input" style={{ width: '100%', boxSizing: 'border-box' }} placeholder="Enter void reason…" value={voidReason} onChange={e => setVoidReason(e.target.value)} />
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => { setVoidTarget(null); setVoidReason('') }}>Cancel</button>
              <button className="confirm-btn-ok danger" onClick={confirmVoid}>Void</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="exp-toast"><span className="exp-toast-icon">{toast.icon}</span>{toast.msg}</div>}

      {/* Header */}
      <div className="exp-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="th-title-format">Ex<span style={{ color: 'var(--th-rose)' }}>penses</span></div>
          {isShopClosed && (
            <div className="pos-closed-badge">
              <span className="pulse"></span>
              NEXT DAY MODE
            </div>
          )}
        </div>
        <div className="exp-header-btns-desktop">
          <button className="exp-btn exp-btn-ghost" onClick={exportExcel} disabled={!expenses.length}>⬇ Export</button>
          <button className="exp-btn exp-btn-rose" onClick={() => { cancelEdit(); setShowExpForm(true) }}>+ New Expense</button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="th-kpi-row">
        <KpiCard label="Total Expenses" value={compactCurrency(summary.total)} accent="rose" sub={`${expTotal} entries`} />
        <KpiCard label="Cash Out" value={compactCurrency(cashTotal)} accent="sky" sub="cash payments" />
        <KpiCard label="GCash Out" value={compactCurrency(gcashTotal)} accent="emerald" sub="digital payments" />
        <KpiCard label="Categories" value={summary.by_category.length} accent="amber" sub="with entries" />
        <KpiCard label="Days Active" value={summary.daily.length} accent="violet" sub="with expenses" />
      </div>

      {/* Filter Header Toolbar */}
      <div style={{ marginTop: '0', marginBottom: '0' }}>
        <FilterHeader searchProps={{
          value: search,
          onChange: setSearch,
          placeholder: "Description, category, ref #…",
          resultCount: search.trim() ? expTotal : undefined,
          totalCount: expTotal,
          resultLabel: "expenses",
        }}
          leftComponent={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', flexWrap: 'nowrap', width: '100%', height: '100%' }}>
              <span style={{ fontSize: 'inherit', fontWeight: 600, color: 'var(--th-text-muted)', whiteSpace: 'nowrap' }}>From</span>
              <input className="fh-date" type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setActiveRange('') }} style={{ flex: 1, minWidth: '120px' }} />
              <span style={{ fontSize: 'inherit', fontWeight: 600, color: 'var(--th-text-muted)', whiteSpace: 'nowrap' }}>To</span>
              <input className="fh-date" type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setActiveRange('') }} style={{ flex: 1, minWidth: '120px' }} />
            </div>
          }
          filters={[
            { value: 'today', label: 'Today', active: activeRange === 'today' },
            { value: '7d', label: '7 Days', active: activeRange === '7d' },
            { value: '30d', label: '30 Days', active: activeRange === '30d' },
            { value: '3mo', label: '3 Months', active: activeRange === '3mo' },
            { value: '6mo', label: '6 Months', active: activeRange === '6mo' },
            { value: 'yr', label: 'This Yr', active: activeRange === 'yr' },
          ]}
          onFilterChange={applyRange}
          accentColor="var(--th-rose)"
        />
      </div>

      {/* Mobile action strip */}
      <div className="exp-mobile-actions">
        <button className="exp-btn exp-btn-ghost" onClick={exportExcel} disabled={!expenses.length}>⬇ Export</button>
        <button className="exp-btn exp-btn-rose" onClick={() => { cancelEdit(); setShowExpForm(true) }}>+ New Expense</button>
      </div>

      {error && <div className="exp-error">{error}</div>}

      {/* Expense Form Modal */}
      {showExpForm && (
        <div className="exp-form-overlay" onClick={e => { if (e.target === e.currentTarget) cancelEdit(); }}>
          <div className="exp-form-modal">
            <div className="exp-form-modal-header">
              <div className="exp-form-modal-title">{editingId ? '✏ Edit Expense' : '+ New Expense'}</div>
              <button className="exp-form-modal-close" onClick={cancelEdit}>✕</button>
            </div>
            <form onSubmit={saveExpense} style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              <div className="exp-form-grid">
                <div>
                  <label className="exp-label">Description *</label>
                  <input className="exp-input" placeholder="e.g. Electricity bill…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div>
                  <label className="exp-label">Amount (₱) *</label>
                  <input type="number" step="0.01" min="0" className="exp-input" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
              </div>
              <div className="exp-form-grid">
                <div>
                  <label className="exp-label">Date *</label>
                  <input type="date" className="exp-input" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
                </div>
                <div>
                  <label className="exp-label">Payment Method</label>
                  <select className="exp-select" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="exp-label">Reference # (optional)</label>
                <input className="exp-input" style={{ width: '100%', boxSizing: 'border-box' }} placeholder="Receipt / OR number…" value={form.reference_no} onChange={e => setForm(f => ({ ...f, reference_no: e.target.value }))} />
              </div>
              <div>
                <label className="exp-label">Notes (optional)</label>
                <textarea className="exp-textarea" placeholder="Additional details…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              {formError && <div className="exp-error">{formError}</div>}
              <div className="exp-form-actions">
                <button type="button" className="exp-btn exp-btn-ghost" onClick={cancelEdit}>Cancel</button>
                <button type="submit" className="exp-btn exp-btn-rose" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? '✓ Update' : '+ Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expenses table */}
      <div className="exp-section">Expenses List</div>
      <DataTable
        columns={expColumns}
        rows={expenses}
        rowKey="expense_id"
        onRowClick={(row) => setSelectedExpense(row)}
        loading={loading}
        skeletonRows={8}
        skeletonWidths={['w20', 'w40', 'w20', 'w20', 'w20', 'w20', 'w20']}
        minWidth={700}
        currentPage={expPage}
        totalPages={expTotalPages}
        onPageChange={setExpPage}
        emptyTitle="No Expenses"
        emptyMessage="No expenses found for this period."
      />
      {selectedExpense && (
        <Modal
          isOpen={!!selectedExpense}
          onClose={() => setSelectedExpense(null)}
          title="Expense Detail"
          maxWidth="500px"
          footer={
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
              <button className="exp-btn exp-btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setSelectedExpense(null); startEdit(selectedExpense) }}>✏ Edit</button>
              <button className="exp-btn exp-btn-rose" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setSelectedExpense(null); setVoidTarget(selectedExpense); setVoidReason('') }}>🗑 Void</button>
            </div>
          }
        >
          <div className="inv-hist-body" style={{ border: 'none' }}>
            <div className="inv-hist-item-card">
              <div className="inv-hist-item-name">{selectedExpense.description}</div>
              <div className="inv-hist-item-sku">{selectedExpense.category_name || 'Uncategorized'}</div>
              <div className="inv-hist-stats">
                <div className="inv-hist-stat">
                  <div className="inv-hist-stat-label">Amount</div>
                  <div className="inv-hist-stat-val" style={{ color: 'var(--th-rose)', fontSize: '1.1rem' }}>{currency(selectedExpense.amount)}</div>
                </div>
                <div className="inv-hist-stat">
                  <div className="inv-hist-stat-label">Date</div>
                  <div className="inv-hist-stat-val" style={{ fontSize: '0.92rem' }}>{selectedExpense.expense_date}</div>
                </div>
                <div className="inv-hist-stat">
                  <div className="inv-hist-stat-label">Payment</div>
                  <div className="inv-hist-stat-val" style={{ fontSize: '0.88rem' }}>{selectedExpense.payment_method}</div>
                </div>
                <div className="inv-hist-stat">
                  <div className="inv-hist-stat-label">Ref #</div>
                  <div className="inv-hist-stat-val" style={{ fontSize: '0.88rem', color: 'var(--th-text-muted)' }}>{selectedExpense.reference_no || '—'}</div>
                </div>
              </div>
            </div>
            {selectedExpense.notes && (
              <div style={{ padding: '0.85rem 1.2rem' }}>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--th-text-faint)', fontWeight: 700, marginBottom: '0.3rem' }}>Notes</div>
                <div style={{ fontSize: '0.88rem', color: 'var(--th-text-body)' }}>{selectedExpense.notes}</div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
