import '../pages_css/ServicesSummaryPage.css';
import React from 'react'
import { API_URL, apiFetch } from '../lib/config'
import usePaginatedResource from '../hooks/usePaginatedResource'
import KpiCard from '../components/KpiCard'
import { DataTable } from '../components/DataTable'
import SearchInput from '../components/SearchInput'
import FilterHeader from '../components/FilterHeader'

const fmt = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const today = () => new Date().toISOString().split('T')[0]

export default function ServicesSummaryPage({ shopId, isShopClosed }) {
  const [activeTab, setActiveTab] = React.useState('summary')

  // Shared date state
  const [startDate, setStartDate] = React.useState(today())
  const [endDate, setEndDate] = React.useState(today())

  // Summary state
  const [data, setData] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [modal, setModal] = React.useState(null)
  const [activeRange, setActiveRange] = React.useState('today')

  // History state
  const historyWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const [histStartDate, setHistStartDate] = React.useState(historyWeekAgo)
  const [histEndDate, setHistEndDate] = React.useState(today())
  const [staffMap, setStaffMap] = React.useState({})
  const PAGE_SIZE = 10
  const [saleModal, setSaleModal] = React.useState(null)
  const {
    data: records,
    page, setPage,
    totalPages,
    stats: histStats,
    loading: histLoading,
    search: histSearch, setSearch: setHistSearch,
  } = usePaginatedResource({
    url: `${API_URL}/services-history/${shopId}`,
    perPage: PAGE_SIZE,
    extraParams: { startDate: histStartDate, endDate: histEndDate },
    enabled: !!shopId,
    deps: [shopId, histStartDate, histEndDate],
  })
  const serverTotalRevenue = histStats?.totalRevenue || 0
  const [expandedRows, setExpandedRows] = React.useState(new Set())
  const toggleRow = key => setExpandedRows(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  function applyRange(key) {
    const t = today()
    const d = new Date(t)
    let from = t
    if (key === 'today') { from = t }
    else if (key === '7d') { d.setDate(d.getDate() - 6); from = d.toISOString().split('T')[0] }
    else if (key === '30d') { d.setDate(d.getDate() - 29); from = d.toISOString().split('T')[0] }
    else if (key === 'wk') { const day = d.getDay(); d.setDate(d.getDate() - day); from = d.toISOString().split('T')[0] }
    else if (key === 'mo') { from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }
    else if (key === 'yr') { from = `${d.getFullYear()}-01-01` }
    setStartDate(from)
    setEndDate(t)
    setActiveRange(key)
    loadWith(from, t)
  }

  React.useEffect(() => { load() }, [shopId])

  async function load() { await loadWith(startDate, endDate) }

  async function loadWith(from, to) {
    setLoading(true)
    try {
      const qs = `?startDate=${from}&endDate=${to}`
      const r = await apiFetch(`${API_URL}/services-summary/${shopId}${qs}`)
      setData((await r.json()) || [])
    } catch (err) {
      console.error('services-summary fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    apiFetch(`${API_URL}/staff/${shopId}`)
      .then(r => r.json())
      .then(d => {
        const map = {}
        if (Array.isArray(d)) d.forEach(s => { map[s.staff_id] = s.full_name })
        setStaffMap(map)
      })
      .catch(() => { })
  }, [shopId])

  const totalSvcRevenue = data.reduce((s, t) => s + t.services.reduce((a, x) => a + x.amount, 0), 0)
  const totalCommissions = data.reduce((s, t) => s + t.commissions.reduce((a, x) => a + x.amount, 0), 0)
  const totalBaleDeducted = data.reduce((s, t) => s + (t.bale_deducted || 0), 0)
  const totalSvcPay = totalSvcRevenue / 2
  const totalPayout = totalSvcPay + totalCommissions - totalBaleDeducted

  // Server-paginated: `records` is already the current page's data,
  // `serverTotalRevenue` is computed across the filtered (unpaginated) set.
  const filteredRecords = records
  const totalRevenue = serverTotalRevenue
  const paginated = records

  return (
    <div className="ss-root">
      {/* Header */}
      <div className="ss-page-header">
        <div className="th-title-format">
          SERVICES <span style={{ color: 'var(--th-orange)' }}>Summary</span>
          {isShopClosed && (
            <div className="pos-closed-badge" style={{ marginLeft: '1rem', display: 'inline-flex', verticalAlign: 'middle' }}>
              <span className="pulse"></span>
              NEXT DAY MODE
            </div>
          )}
        </div>
        <div className="ss-tabs ss-tabs-desktop">
          <button className={`ss-tab${activeTab === 'summary' ? ' active' : ''}`} onClick={() => setActiveTab('summary')}>Summary</button>
          <button className={`ss-tab${activeTab === 'history' ? ' active' : ''}`} onClick={() => setActiveTab('history')}>History</button>
        </div>
      </div>

      {/* ── SUMMARY TAB ── */}
      {activeTab === 'summary' && (
        <>
          {/* KPI cards — first on mobile */}
          <div className="th-kpi-row">
            <KpiCard label="Tiremen Active" value={data.length} accent="violet" loading={loading} />
            <KpiCard label="Service Total" value={fmt(totalSvcRevenue)} accent="sky" loading={loading} />
            <KpiCard label="Service Pay (÷2)" value={fmt(totalSvcPay)} accent="amber" loading={loading} />
            <KpiCard label="+ Commission" value={fmt(totalCommissions)} accent="emerald" loading={loading} />
            <KpiCard label="= Total Payout" value={fmt(totalPayout)} accent="orange" loading={loading} sub={totalBaleDeducted > 0 ? `− ${fmt(totalBaleDeducted)} bale` : undefined} />
          </div>

          {/* Filter Header for Summary */}
          <div style={{ marginBottom: '0' }}>
            <FilterHeader
              leftComponent={
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', flexWrap: 'nowrap', width: '100%', height: '100%' }}>
                  <span className="ss-label" style={{ fontWeight: 600, color: 'var(--th-text-muted)' }}>From</span>
                  <input className="fh-date" type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setActiveRange(''); loadWith(e.target.value, endDate) }} style={{ flex: 1, minWidth: '120px' }} />
                  <span className="ss-label" style={{ fontWeight: 600, color: 'var(--th-text-muted)' }}>To</span>
                  <input className="fh-date" type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setActiveRange(''); loadWith(startDate, e.target.value) }} style={{ flex: 1, minWidth: '120px' }} />
                </div>
              }
              filters={[
                { value: 'today', label: 'Today', active: activeRange === 'today' },
                { value: '7d', label: '7 Days', active: activeRange === '7d' },
                { value: '30d', label: '30 Days', active: activeRange === '30d' },
                { value: 'wk', label: 'This Wk', active: activeRange === 'wk' },
                { value: 'mo', label: 'This Mo', active: activeRange === 'mo' },
                { value: 'yr', label: 'This Yr', active: activeRange === 'yr' },
              ]}
              onFilterChange={applyRange}
              accentColor="var(--th-orange)"
            />
          </div>

          {/* Mobile-only tab bar — below filter */}
          <div className="ss-tabs ss-tabs-mobile">
            <button className={`ss-tab${activeTab === 'summary' ? ' active' : ''}`} onClick={() => setActiveTab('summary')}>Summary</button>
            <button className={`ss-tab${activeTab === 'history' ? ' active' : ''}`} onClick={() => setActiveTab('history')}>History</button>
          </div>

          {/* Tireman cards */}
          {loading ? (
            <div className="ss-card-grid" style={{ marginTop: '1rem' }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="ss-tireman-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    <div className="th-skel-cell" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <div className="th-skel-cell w60" style={{ height: 14 }} />
                      <div className="th-skel-cell w30" style={{ height: 10 }} />
                    </div>
                  </div>
                  <div className="th-skel-cell w100" style={{ height: 10 }} />
                  <div className="th-skel-cell w80" style={{ height: 10 }} />
                  <div className="th-skel-cell w40" style={{ height: 10 }} />
                </div>
              ))}
            </div>
          ) : data.length === 0 ? (
            <div className="ss-empty">
              <svg style={{ opacity: 0.25, marginBottom: "0.75rem" }} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14" /></svg>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "1.1rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--th-text-dim)", marginBottom: "0.3rem" }}>No Service Records</div>
              No service records found for this period.
            </div>
          ) : (
            <>
              <div className="th-section-label">Breakdown by Tireman</div>
              <div className="ss-card-grid">
                {data.map(tireman => {
                  const svcTotal = tireman.services.reduce((s, x) => s + x.amount, 0)
                  const comTotal = tireman.commissions.reduce((s, x) => s + x.amount, 0)
                  const baleDeducted = tireman.bale_deducted || 0
                  const svcPay = svcTotal / 2
                  const payout = svcPay + comTotal - baleDeducted
                  const initials = tireman.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

                  return (
                    <div key={tireman.staff_id} className="ss-tireman-card" onClick={() => { setModal({ tireman, svcTotal, comTotal, baleDeducted, svcPay, payout, initials }); setExpandedRows(new Set()) }} style={{ cursor: 'pointer' }}>

                      {/* Header */}
                      <div className="ss-tireman-head">
                        <div className="ss-tireman-name-wrap">
                          <div className="ss-avatar">{initials}</div>
                          <div>
                            <div className="ss-tireman-name">{tireman.full_name}</div>
                            {tireman.staff_code && <div className="ss-tireman-code">{tireman.staff_code}</div>}
                          </div>
                        </div>
                        <div className="ss-payout-chips">
                          <div className="ss-payout-chip">
                            <span className="ss-payout-chip-label">Svc Total</span>
                            <span className="ss-payout-chip-val sky">{fmt(svcTotal)}</span>
                          </div>
                          <span className="ss-chip-sep">·</span>
                          <div className="ss-payout-chip">
                            <span className="ss-payout-chip-label">Svc Pay (÷2)</span>
                            <span className="ss-payout-chip-val amber">{fmt(svcPay)}</span>
                          </div>
                          <span className="ss-chip-sep">+</span>
                          <div className="ss-payout-chip">
                            <span className="ss-payout-chip-label">Commission</span>
                            <span className="ss-payout-chip-val emerald">{fmt(comTotal)}</span>
                          </div>
                          {baleDeducted > 0 && (
                            <>
                              <span className="ss-chip-sep">−</span>
                              <div className="ss-payout-chip">
                                <span className="ss-payout-chip-label">Bale</span>
                                <span className="ss-payout-chip-val rose">{fmt(baleDeducted)}</span>
                              </div>
                            </>
                          )}
                          <span className="ss-chip-sep">=</span>
                          <div className="ss-payout-chip">
                            <span className="ss-payout-chip-label">Payout</span>
                            <span className="ss-payout-chip-val orange">{fmt(payout)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Two detail tables */}
                      <div className="ss-detail-grid">

                        {/* Services table */}
                        <div className="ss-detail-section">
                          <div className="ss-detail-head">
                            <span className="ss-detail-head-label sky">🔧 Services Performed</span>
                            <span className="ss-detail-count">{tireman.services.length}</span>
                          </div>
                          <table className="ss-table">
                            <thead>
                              <tr>
                                <th>Service</th>
                                <th className="r">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tireman.services.length === 0 ? (
                                <tr><td colSpan={2} className="ss-empty-cell">No services recorded</td></tr>
                              ) : tireman.services.map(s => (
                                <tr key={s.log_id}>
                                  <td>
                                    <div className="ss-svc-name">{s.service_name}</div>
                                    {s.quantity !== 1 && <div className="ss-svc-qty">× {s.quantity}</div>}
                                  </td>
                                  <td><div className="ss-money sky">{fmt(s.amount)}</div></td>
                                </tr>
                              ))}
                            </tbody>
                            {tireman.services.length > 0 && (
                              <tfoot>
                                <tr className="ss-total-row">
                                  <td className="ss-total-label">Total</td>
                                  <td><div className="ss-money sky">{fmt(svcTotal)}</div></td>
                                </tr>
                              </tfoot>
                            )}
                          </table>
                        </div>

                        {/* Commission table */}
                        <div className="ss-detail-section">
                          <div className="ss-detail-head">
                            <span className="ss-detail-head-label emerald">💰 Commission Earned</span>
                            <span className="ss-detail-count">{tireman.commissions.length}</span>
                          </div>
                          <table className="ss-table">
                            <thead>
                              <tr>
                                <th>Description</th>
                                <th className="r">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tireman.commissions.length === 0 ? (
                                <tr><td colSpan={2} className="ss-empty-cell">No commissions recorded</td></tr>
                              ) : tireman.commissions.map(c => (
                                <tr key={c.log_id}>
                                  <td>
                                    <div className="ss-svc-name">{c.service_name}</div>
                                    {c.quantity !== 1 && <div className="ss-svc-qty">× {c.quantity}</div>}
                                  </td>
                                  <td><div className="ss-money emerald">{fmt(c.amount)}</div></td>
                                </tr>
                              ))}
                            </tbody>
                            {tireman.commissions.length > 0 && (
                              <tfoot>
                                <tr className="ss-total-row">
                                  <td className="ss-total-label">Total</td>
                                  <td><div className="ss-money emerald">{fmt(comTotal)}</div></td>
                                </tr>
                              </tfoot>
                            )}
                          </table>
                        </div>
                      </div>

                      {/* Final Payout Row */}
                      <div className="ss-final-payout-row">
                        <div className="ss-final-payout-label">Total Payout</div>
                        <div className="ss-final-payout-val">{fmt(payout)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Detail Modal */}
          {modal && (() => {
            const { tireman, svcTotal, comTotal, baleDeducted, svcPay, payout, initials } = modal
            return (
              <div className="hist-modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
                <div className="inv-history" style={{ maxWidth: 680 }}>
                  {/* Header */}
                  <div className="inv-hist-header">
                    <div className="inv-hist-title">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
                      </svg>
                      Tireman Breakdown
                    </div>
                    <button className="inv-hist-close" onClick={() => setModal(null)}>✕</button>
                  </div>
                  {/* Body */}
                  <div className="inv-hist-body">
                    {/* Tireman info + KPI stats */}
                    <div className="inv-hist-item-card">
                      <div className="inv-hist-item-name">{initials} · {tireman.full_name}</div>
                      {tireman.staff_code && <div className="inv-hist-item-sku">{tireman.staff_code}</div>}
                      <div className="inv-hist-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                        <div className="inv-hist-stat">
                          <div className="inv-hist-stat-label">Svc Total</div>
                          <div className="inv-hist-stat-val sky">{fmt(svcTotal)}</div>
                        </div>
                        <div className="inv-hist-stat">
                          <div className="inv-hist-stat-label">Svc Pay (÷2)</div>
                          <div className="inv-hist-stat-val" style={{ color: 'var(--th-amber)' }}>{fmt(svcPay)}</div>
                        </div>
                        <div className="inv-hist-stat">
                          <div className="inv-hist-stat-label">Commission</div>
                          <div className="inv-hist-stat-val emerald">{fmt(comTotal)}</div>
                        </div>
                        {baleDeducted > 0 && (
                          <div className="inv-hist-stat">
                            <div className="inv-hist-stat-label">Bale Deducted</div>
                            <div className="inv-hist-stat-val rose">{fmt(baleDeducted)}</div>
                          </div>
                        )}
                        <div className="inv-hist-stat">
                          <div className="inv-hist-stat-label">Total Payout</div>
                          <div className="inv-hist-stat-val" style={{ color: 'var(--th-orange)' }}>{fmt(payout)}</div>
                        </div>
                      </div>
                    </div>
                    {/* Detail tables */}
                    <div style={{ padding: '1rem' }}>
                      <div className="ss-detail-grid">
                        {/* Services */}
                        <div className="ss-detail-section">
                          <div className="ss-detail-head">
                            <span className="ss-detail-head-label sky">🔧 Services Performed</span>
                            <span className="ss-detail-count">{tireman.services.length}</span>
                          </div>
                          <table className="ss-table">
                            <thead><tr><th>Service</th><th className="r">Amount</th></tr></thead>
                            <tbody>
                              {tireman.services.length === 0 ? (
                                <tr><td colSpan={2} className="ss-empty-cell">No services recorded</td></tr>
                              ) : tireman.services.map(s => (
                                <tr key={s.log_id} onClick={e => { e.stopPropagation(); toggleRow('svc-' + s.log_id) }} style={{ cursor: 'pointer' }}>
                                  <td><div className={`ss-svc-name${expandedRows.has('svc-' + s.log_id) ? ' ss-svc-expanded' : ''}`}>{s.service_name}</div>{s.quantity !== 1 && <div className="ss-svc-qty">× {s.quantity}</div>}</td>
                                  <td><div className="ss-money sky">{fmt(s.amount)}</div></td>
                                </tr>
                              ))}
                            </tbody>
                            {tireman.services.length > 0 && (
                              <tfoot><tr className="ss-total-row"><td className="ss-total-label">Total</td><td><div className="ss-money sky">{fmt(svcTotal)}</div></td></tr></tfoot>
                            )}
                          </table>
                        </div>
                        {/* Commission */}
                        <div className="ss-detail-section">
                          <div className="ss-detail-head">
                            <span className="ss-detail-head-label emerald">💰 Commission Earned</span>
                            <span className="ss-detail-count">{tireman.commissions.length}</span>
                          </div>
                          <table className="ss-table">
                            <thead><tr><th>Description</th><th className="r">Amount</th></tr></thead>
                            <tbody>
                              {tireman.commissions.length === 0 ? (
                                <tr><td colSpan={2} className="ss-empty-cell">No commissions recorded</td></tr>
                              ) : tireman.commissions.map(c => (
                                <tr key={c.log_id} onClick={e => { e.stopPropagation(); toggleRow('com-' + c.log_id) }} style={{ cursor: 'pointer' }}>
                                  <td><div className={`ss-svc-name${expandedRows.has('com-' + c.log_id) ? ' ss-svc-expanded' : ''}`}>{c.service_name}</div>{c.quantity !== 1 && <div className="ss-svc-qty">× {c.quantity}</div>}</td>
                                  <td><div className="ss-money emerald">{fmt(c.amount)}</div></td>
                                </tr>
                              ))}
                            </tbody>
                            {tireman.commissions.length > 0 && (
                              <tfoot><tr className="ss-total-row"><td className="ss-total-label">Total</td><td><div className="ss-money emerald">{fmt(comTotal)}</div></td></tr></tfoot>
                            )}
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Final Payout Row */}
                    <div className="ss-final-payout-row">
                      <div className="ss-final-payout-label">Total Payout</div>
                      <div className="ss-final-payout-val">{fmt(payout)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        <div className="ss-history-content">
          {/* KPI summary */}
          <div className="th-kpi-row">
            <KpiCard label="Transactions" value={filteredRecords.length} accent="sky" loading={histLoading} />
            <KpiCard label="Total Revenue" value={fmt(totalRevenue)} accent="emerald" loading={histLoading} />
            <KpiCard label="Date Range" value={`${histStartDate} → ${histEndDate}`} accent="orange" loading={histLoading} />
          </div>

          {/* Filter Header for History */}
          <div style={{ marginBottom: '0' }}>
            <FilterHeader
              searchProps={{
                value: histSearch,
                onChange: v => { setHistSearch(v); setPage(1) },
                placeholder: "Search invoice, customer, service, staff…",
                resultCount: filteredRecords.length,
                totalCount: records.length,
                resultLabel: "records",
              }}
              leftComponent={
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', flexWrap: 'nowrap', width: '100%', height: '100%' }}>
                  <span className="ss-label" style={{ fontWeight: 600, color: 'var(--th-text-muted)' }}>From</span>
                  <input className="fh-date" type="date" value={histStartDate} onChange={e => setHistStartDate(e.target.value)} style={{ flex: 1, minWidth: '120px' }} />
                  <span className="ss-label" style={{ fontWeight: 600, color: 'var(--th-text-muted)' }}>To</span>
                  <input className="fh-date" type="date" value={histEndDate} onChange={e => setHistEndDate(e.target.value)} style={{ flex: 1, minWidth: '120px' }} />
                </div>
              }
              accentColor="var(--th-orange)"
            />
          </div>

          {/* Mobile-only tab bar — below filter */}
          <div className="ss-tabs ss-tabs-mobile">
            <button className={`ss-tab${activeTab === 'summary' ? ' active' : ''}`} onClick={() => setActiveTab('summary')}>Summary</button>
            <button className={`ss-tab${activeTab === 'history' ? ' active' : ''}`} onClick={() => setActiveTab('history')}>History</button>
          </div>

          <div className="th-section-label">Transactions</div>
          <DataTable
            rowKey="sale_id"
            loading={histLoading}
            rows={paginated}
            onRowClick={r => setSaleModal(r)}
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            skeletonRows={6}
            skeletonWidths={['w40', 'w30', 'w60', 'w40', 'w30', 'w40', 'w20', 'w30']}
            emptyTitle="No Transactions"
            emptyMessage="No service transactions found for this date range."
            columns={[
              {
                key: 'invoice', label: 'Invoice / Sale', render: r => (
                  <><div className="sh-invoice">{r.invoice_number || '—'}</div><div className="sh-sale-id">{r.sale_id}</div></>
                )
              },
              {
                key: 'datetime', label: 'Date & Time', render: r => (
                  <><div className="sh-datetime">{new Date(r.sale_datetime).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</div><div className="sh-date-sub">{new Date(r.sale_datetime).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</div></>
                )
              },
              {
                key: 'customer', label: 'Customer', render: r => (
                  r.customer_name ? <div className="sh-customer">{r.customer_name}</div> : <div className="sh-walkin">Walk-in</div>
                )
              },
              {
                key: 'services', label: 'Services', render: r => {
                  const svcs = r.services ? r.services.split(',').filter(Boolean) : []
                  return svcs.length > 0 ? svcs.map((s, i) => <span key={i} className="sh-svc-pill">{s.trim()}</span>) : <span style={{ color: 'var(--th-text-faint)', fontSize: '0.78rem' }}>—</span>
                }
              },
              { key: 'staff', label: 'Handled By', render: r => <div className="sh-staff">{r.staff_name || r.created_by || '—'}</div> },
              {
                key: 'tiremen', label: 'Tiremen', render: r => {
                  const names = (r.tireman_ids || []).map(id => staffMap[id] || id).filter(Boolean)
                  return names.length > 0 ? names.map((n, i) => <span key={i} className="sh-tireman-pill">{n}</span>) : <span style={{ color: 'var(--th-text-faint)', fontSize: '0.78rem' }}>—</span>
                }
              },
              { key: 'amount', label: 'Amount', align: 'right', render: r => <div className="sh-amount">{fmt(r.total_amount)}</div> },
              { key: 'notes', label: 'Notes', render: r => r.sale_notes ? <div className="sh-notes">{r.sale_notes}</div> : <span style={{ color: 'var(--th-text-faint)', fontSize: '0.78rem' }}>—</span> },
            ]}
          />
        </div>
      )}

      {/* ── Sale Detail Modal ── */}
      {saleModal && (() => {
        const r = saleModal
        const tiremanNames = (r.tireman_ids || []).map(id => staffMap[id] || id).filter(Boolean)
        const services = r.services ? r.services.split(',').filter(Boolean).map(s => s.trim()) : []
        return (
          <div className="hist-modal-overlay" onClick={e => e.target === e.currentTarget && setSaleModal(null)}>
            <div className="inv-history">
              <div className="inv-hist-header">
                <div className="inv-hist-title">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Sale Details
                </div>
                <button className="inv-hist-close" onClick={() => setSaleModal(null)}>✕</button>
              </div>
              <div className="inv-hist-body">
                <div className="inv-hist-item-card">
                  <div className="inv-hist-item-name">
                    {r.sale_id}
                    {r.invoice_number && (
                      <span style={{ marginLeft: '0.5rem', background: 'var(--th-sky-bg)', color: 'var(--th-sky)', padding: '0.1rem 0.4rem', borderRadius: 4, fontSize: '0.72rem', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, verticalAlign: 'middle' }}>
                        {r.invoice_number}
                      </span>
                    )}
                  </div>
                  <div className="inv-hist-item-sku">
                    {new Date(r.sale_datetime).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                  </div>
                  <div className="inv-hist-stats">
                    <div className="inv-hist-stat">
                      <div className="inv-hist-stat-label">Customer</div>
                      <div className="inv-hist-stat-val sky" style={{ fontSize: '0.95rem' }}>{r.customer_name || 'Walk-in'}</div>
                    </div>
                    <div className="inv-hist-stat">
                      <div className="inv-hist-stat-label">Handled By</div>
                      <div className="inv-hist-stat-val" style={{ fontSize: '0.9rem', color: 'var(--th-text-primary)' }}>{r.staff_name || r.created_by || '—'}</div>
                    </div>
                    <div className="inv-hist-stat">
                      <div className="inv-hist-stat-label">Services</div>
                      <div className="inv-hist-stat-val" style={{ fontSize: '0.9rem', color: 'var(--th-text-primary)' }}>{services.length || '—'}</div>
                    </div>
                    <div className="inv-hist-stat">
                      <div className="inv-hist-stat-label">Total</div>
                      <div className="inv-hist-stat-val" style={{ color: 'var(--th-emerald)' }}>{fmt(r.total_amount)}</div>
                    </div>
                  </div>
                </div>
                <div className="inv-hist-list">
                  {tiremanNames.length > 0 && (
                    <div style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--th-border)' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--th-text-muted)', marginBottom: '0.35rem' }}>Tiremen</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {tiremanNames.map((n, i) => <span key={i} className="sh-tireman-pill">{n}</span>)}
                      </div>
                    </div>
                  )}
                  {r.sale_notes && (
                    <div style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--th-border)' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--th-text-muted)', marginBottom: '0.3rem' }}>Notes</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--th-amber)', fontWeight: 600, wordBreak: 'break-word', lineHeight: 1.4 }}>{r.sale_notes}</div>
                    </div>
                  )}
                  {services.length > 0 && (
                    <div style={{ padding: '0.6rem 0.75rem' }}>
                      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--th-text-muted)', marginBottom: '0.4rem' }}>Services</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {services.map((svc, i) => (
                          <div key={i} style={{ background: 'var(--th-bg-card-alt)', border: '1px solid var(--th-border)', borderLeft: '2px solid var(--th-sky)', borderRadius: 6, padding: '0.45rem 0.7rem', fontSize: '0.88rem', color: 'var(--th-text-body)', wordBreak: 'break-word' }}>
                            {svc}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0.75rem', borderTop: '1px solid var(--th-border)', marginTop: '0.25rem' }}>
                    <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--th-text-muted)' }}>Total Amount</span>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--th-emerald)' }}>{fmt(r.total_amount)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
