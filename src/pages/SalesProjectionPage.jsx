import '../pages_css/SalesProjectionPage.css';
import React from 'react'
import { API_URL, currency, compactCurrency, apiFetch, SkeletonRows } from '../lib/config'
import KpiCard from '../components/KpiCard'
import SearchInput from '../components/SearchInput'
import { DataTable } from '../components/DataTable'
import FilterHeader from '../components/FilterHeader'

const fmt  = n => compactCurrency(n)
const fmtN = n => Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 1 })

function fmtDate(d) {
  if (!d) return '∞'
  try { return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return d }
}

const STATUS_CFG = {
  OUT_OF_STOCK: { label: 'Out of Stock', color: 'var(--th-rose)',    bg: 'var(--th-rose-bg)',    sort: 0 },
  CRITICAL:     { label: 'Critical',     color: 'var(--th-rose)',    bg: 'var(--th-rose-bg)',    sort: 1 },
  WARNING:      { label: 'Warning',      color: 'var(--th-amber)',   bg: 'var(--th-amber-bg)',   sort: 2 },
  OK:           { label: 'OK',           color: 'var(--th-emerald)', bg: 'var(--th-emerald-bg)', sort: 3 },
}

/* ── Inline bar for velocity ── */
function VelocityBar({ value, max }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="sp-vel-track">
      <div className="sp-vel-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

/* ── Days pill with color ── */
function DaysPill({ days, status }) {
  if (days === null) return <span className="sp-days-pill sp-days-inf">No data</span>
  const cfg = STATUS_CFG[status] || STATUS_CFG.OK
  return (
    <span className="sp-days-pill" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}` }}>
      {days === 9999 ? '∞' : days}d
    </span>
  )
}

export default function SalesProjectionPage({ shopId }) {
  const [history,   setHistory]   = React.useState(30)
  const [horizon,   setHorizon]   = React.useState(30)
  const [leadTime,  setLeadTime]  = React.useState(3)
  const [data,      setData]      = React.useState(null)
  const [loading,   setLoading]   = React.useState(false)
  const [error,     setError]     = React.useState('')
  const [filter,    setFilter]    = React.useState('ALL')
  const [search,    setSearch]    = React.useState('')
  const [sortCol,   setSortCol]   = React.useState('status')
  const [sortAsc,   setSortAsc]   = React.useState(true)
  const [catFilter, setCatFilter] = React.useState('ALL')
  const [detailItem, setDetailItem] = React.useState(null)
  
  const [page, setPage] = React.useState(1)
  const pageSize = 10

  async function load() {
    if (!shopId) return
    setLoading(true); setError('')
    try {
      const r = await apiFetch(`${API_URL}/sales-projection/${shopId}?history=${history}&horizon=${horizon}&lead_time=${leadTime}`)
      const json = await r.json()
      if (!r.ok) throw new Error(json.error || 'Failed to load')
      setData(json)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  React.useEffect(() => { load() }, [shopId, history, horizon, leadTime])

  const summary = data?.summary || {}
  const allItems = data?.items || []

  // Unique categories
  const categories = React.useMemo(() => {
    const cats = [...new Set(allItems.map(i => i.category).filter(Boolean))]
    return cats.sort()
  }, [allItems])

  // Max daily qty for velocity bars
  const maxDailyQty = Math.max(...allItems.map(i => i.avg_daily_qty), 1)

  // Filter + search + sort
  const filtered = React.useMemo(() => {
    let rows = allItems
    if (filter !== 'ALL') rows = rows.filter(i => i.status === filter)
    if (catFilter !== 'ALL') rows = rows.filter(i => i.category === catFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(i =>
        (i.item_name || '').toLowerCase().includes(q) ||
        (i.sku || '').toLowerCase().includes(q) ||
        (i.brand || '').toLowerCase().includes(q)
      )
    }
    // Sort
    rows = [...rows].sort((a, b) => {
      let av, bv
      if (sortCol === 'status')         { av = STATUS_CFG[a.status]?.sort ?? 9; bv = STATUS_CFG[b.status]?.sort ?? 9 }
      else if (sortCol === 'days')      { av = a.days_remaining ?? 9999; bv = b.days_remaining ?? 9999 }
      else if (sortCol === 'stock')     { av = a.current_stock;  bv = b.current_stock }
      else if (sortCol === 'velocity')  { av = a.avg_daily_qty;  bv = b.avg_daily_qty }
      else if (sortCol === 'proj_rev')  { av = a.projected_revenue; bv = b.projected_revenue }
      else if (sortCol === 'reorder')   { av = a.suggested_reorder; bv = b.suggested_reorder }
      else                              { av = a.item_name; bv = b.item_name }
      if (av < bv) return sortAsc ? -1 : 1
      if (av > bv) return sortAsc ?  1 : -1
      return 0
    })
    return rows
  }, [allItems, filter, catFilter, search, sortCol, sortAsc])

  React.useEffect(() => {
    setPage(1)
  }, [filter, catFilter, search, sortCol, sortAsc])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginatedRows = React.useMemo(() => {
    return filtered.slice((page - 1) * pageSize, page * pageSize)
  }, [filtered, page])

  function toggleSort(col) {
    if (sortCol === col) setSortAsc(v => !v)
    else { setSortCol(col); setSortAsc(true) }
  }

  function SortTh({ col, children, right }) {
    const active = sortCol === col
    return (
      <th
        className={`sp-th-sort${active ? ' active' : ''}${right ? ' right' : ''}`}
        onClick={() => toggleSort(col)}
      >
        {children}
        <span className="sp-sort-arrow">{active ? (sortAsc ? '↑' : '↓') : '↕'}</span>
      </th>
    )
  }

  const oos = summary.out_of_stock || 0
  const heroVc = oos > 0 ? 'red' : 'green'

  const spColumns = React.useMemo(() => [
    { key: 'item_name', label: 'Item', render: row => (
      <div className="sp-cell-item">
        <div className="sp-item-name">{row.item_name}</div>
        {row.sku && <div className="sp-item-sku">{row.sku}</div>}
      </div>
    )},
    { key: 'brand', label: 'Brand / Cat', render: row => (
      <>
        <div className="sp-brand">{row.brand || '—'}</div>
        {row.category && <div className="sp-cat">{row.category}</div>}
      </>
    )},
    { key: 'current_stock', label: 'Stock', align: 'right', render: row => (
      <span className={row.current_stock <= 0 ? 'sp-zero' : row.current_stock <= row.reorder_point ? 'sp-low' : ''}>
        {fmtN(row.current_stock)}
      </span>
    )},
    { key: 'avg_daily_qty', label: 'Daily Sales', align: 'right', render: row => (
      <div>
        <div>{fmtN(row.avg_daily_qty)}<span className="sp-unit">/day</span></div>
        <VelocityBar value={row.avg_daily_qty} max={maxDailyQty} />
      </div>
    )},
    { key: 'days_remaining', label: 'Days Left', align: 'right', render: row => (
      <DaysPill days={row.days_remaining} status={row.status} />
    )},
    { key: 'depletion_date', label: 'Depletes', render: row => (
      <span className="sp-date">{fmtDate(row.depletion_date)}</span>
    )},
    { key: 'suggested_reorder', label: 'Reorder Qty', align: 'right', render: row => (
      row.suggested_reorder > 0
        ? <span className="sp-reorder-qty">{fmtN(row.suggested_reorder)}</span>
        : <span className="sp-ok-check">✓</span>
    )},
    { key: 'projected_revenue', label: 'Proj. Revenue', align: 'right', render: row => (
      <span className="sp-proj-rev">{fmt(row.projected_revenue)}</span>
    )},
    { key: 'status', label: 'Status', render: row => {
      const cfg = STATUS_CFG[row.status] || STATUS_CFG.OK
      return <span className="sp-status-badge" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}` }}>{cfg.label}</span>
    }},
  ], [maxDailyQty])

  return (
    <div className="fh-root">
      {/* ── Header ── */}
      <div className="fh-header">
        <div>
          <div className="th-title-format">Sales <span style={{ color: 'var(--th-violet)' }}>Projection</span></div>
          <div className="fh-subtitle">Forecast future sales and identify stock reorder needs</div>
        </div>
        {loading && <span className="sp-spinner" style={{ width: 18, height: 18 }} />}
      </div>

      {/* ── Hero Card ── */}
      {loading ? (
        <div className="fh-hero neutral">
          <div className="fh-hero-left">
            <div className="fh-skel" style={{ height: 22, width: 100, borderRadius: 20, marginBottom: '1rem' }} />
            <div className="fh-skel" style={{ height: 48, width: 180, marginBottom: '0.5rem' }} />
            <div className="fh-skel" style={{ height: 14, width: 120 }} />
          </div>
          <div className="fh-hero-right">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="fh-skel" style={{ height: 80, borderRadius: 10 }} />
            ))}
          </div>
        </div>
      ) : data ? (
        <div className={`fh-hero ${heroVc}`}>
          <div className="fh-hero-left">
            <div className={`fh-verdict-chip ${heroVc}`}>
              {oos > 0
                ? <><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Stock Alert</>
                : <><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>Stock Healthy</>
              }
            </div>
            <div className={`fh-net-amount ${heroVc}`}>{fmt(summary.total_projected_revenue)}</div>
            <div className="fh-net-label">Projected Revenue · next {horizon} days</div>
            <div className="fh-net-compare">
              <span>Avg daily {fmt(summary.avg_daily_revenue_total)}</span>
              <span className="fh-net-pct fl">based on {history}d</span>
            </div>
          </div>
          <div className="fh-hero-right">
            <KpiCard label="Out of Stock" value={String(oos)} accent="rose" sub="need immediate reorder" />
            <KpiCard label="Critical / Warning" value={String((summary.critical || 0) + (summary.warning || 0))} accent="amber" sub="stock running low" />
            <KpiCard label="Need Reorder" value={String(summary.items_needing_reorder)} accent="emerald" sub="items to purchase" />
            <KpiCard label="Avg Daily Revenue" value={fmt(summary.avg_daily_revenue_total)} accent="violet" sub={`based on ${history}d history`} />
          </div>
        </div>
      ) : null}

      {error && <div className="sp-error">{error}</div>}

      {/* ── Controls ── */}
      <div className="sp-controls-bar">
        <div className="sp-ctrl-group">
          <div className="sp-ctrl-label">
            History <span style={{ textTransform: 'none', letterSpacing: '0', marginLeft: '0.25rem' }}>— How far back to look</span>
          </div>
          <div className="sp-ctrl-pills">
            {[30, 60, 90].map(d => (
              <button key={d} className={`sp-ctrl-pill${history === d ? ' active' : ''}`} onClick={() => setHistory(d)}>{d}d</button>
            ))}
          </div>
        </div>
        <div className="sp-ctrl-group">
          <div className="sp-ctrl-label">
            Horizon <span style={{ textTransform: 'none', letterSpacing: '0', marginLeft: '0.25rem' }}>— How far forward to prepare for</span>
          </div>
          <div className="sp-ctrl-pills">
            {[7, 14, 30, 60, 90].map(d => (
              <button key={d} className={`sp-ctrl-pill${horizon === d ? ' active' : ''}`} onClick={() => setHorizon(d)}>{d}d</button>
            ))}
          </div>
        </div>
        <div className="sp-ctrl-group">
          <div className="sp-ctrl-label">
            Lead Time <span style={{ textTransform: 'none', letterSpacing: '0', marginLeft: '0.25rem' }}>— How long deliveries take</span>
          </div>
          <div className="sp-ctrl-pills">
            {[1, 2, 3, 4, 5].map(d => (
              <button key={d} className={`sp-ctrl-pill${leadTime === d ? ' active' : ''}`} onClick={() => setLeadTime(d)}>{d}d</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Filters + Search consolidated via FilterHeader ── */}
      {data && (
        <div style={{ marginTop: '0', marginBottom: '0' }}>
          <FilterHeader
            searchProps={{
              value: search,
              onChange: setSearch,
              placeholder: "Search item, SKU, brand…",
              resultCount: filtered.length,
              totalCount: allItems.length,
              resultLabel: "items",
            }}
            leftComponent={
              <select className="fh-select" value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ minWidth: '160px' }}>
                <option value="ALL">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            }
            filters={[
              ['ALL',          `All (${allItems.length})`],
              ['OUT_OF_STOCK', `Out of Stock (${summary.out_of_stock || 0})`],
              ['CRITICAL',     `Critical (${summary.critical || 0})`],
              ['WARNING',      `Warning (${summary.warning || 0})`],
              ['OK',           `OK (${summary.ok || 0})`],
            ].map(([val, label]) => ({
              label: label,
              value: val,
              active: filter === val
            }))}
            onFilterChange={setFilter}
            accentColor="var(--th-violet)"
          />
        </div>
      )}

      {/* ── Section divider ── */}
      <div className="th-section-label">Projection Details</div>

      {/* ── Table ── */}
      <DataTable
        columns={spColumns}
        rows={paginatedRows}
        rowKey="item_id"
        loading={loading}
        skeletonRows={8}
        minWidth={900}
        onRowClick={row => setDetailItem(row)}
        getRowClassName={row => `sp-row sp-row-${(row.status || 'ok').toLowerCase()}`}
        emptyTitle={!data ? 'No Projection Data' : 'No items match your filters'}
        emptyMessage={!data ? 'Run Projection to analyze your sales' : undefined}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      {data && filtered.length > 0 && (
        <div className="sp-table-footer">
          Showing {filtered.length} of {allItems.length} items · Based on last {history} days · Projecting {horizon} days ahead · Lead time {leadTime} days
        </div>
      )}

      {/* ── Item Detail Modal ── */}
      {detailItem && (() => {
        const r = detailItem
        const cfg = STATUS_CFG[r.status] || STATUS_CFG.OK
        // Stock health gauge: stock vs demand for horizon+lead
        const totalDemand = Math.ceil(r.avg_daily_qty * (horizon + leadTime))
        const stockPct = totalDemand > 0 ? Math.min(100, Math.round((r.current_stock / totalDemand) * 100)) : (r.current_stock > 0 ? 100 : 0)
        // Days gauge: days remaining out of horizon
        const daysVal = r.days_remaining === null ? horizon : Math.min(r.days_remaining, horizon)
        const daysPct = Math.round((daysVal / horizon) * 100)
        // Velocity bar: this item vs max across all items
        const velPct = maxDailyQty > 0 ? Math.min(100, Math.round((r.avg_daily_qty / maxDailyQty) * 100)) : 0
        // SVG ring helper
        const ring = (pct, color, size = 80, stroke = 7) => {
          const radius = (size - stroke) / 2
          const circ = 2 * Math.PI * radius
          const offset = circ - (pct / 100) * circ
          return (
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="var(--th-border)" strokeWidth={stroke} />
              <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
            </svg>
          )
        }
        const stockColor = stockPct >= 60 ? 'var(--th-emerald)' : stockPct >= 30 ? 'var(--th-amber)' : 'var(--th-rose)'
        const daysColor = daysPct >= 60 ? 'var(--th-emerald)' : daysPct >= 30 ? 'var(--th-amber)' : 'var(--th-rose)'

        return (
          <div style={{ position:'fixed',inset:0,zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.7)',backdropFilter:'blur(8px)',WebkitBackdropFilter:'blur(8px)',padding:'1rem' }} onClick={e => { if (e.target === e.currentTarget) setDetailItem(null) }}>
            <div style={{ width:'100%',maxWidth:460,borderRadius:18,overflow:'hidden',background:'var(--th-bg-card)',border:'1px solid var(--th-border-strong)',boxShadow:'0 32px 80px rgba(0,0,0,0.55)',animation:'spModalIn 0.22s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <style>{`@keyframes spModalIn{from{opacity:0;transform:scale(0.93) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
              {/* Header */}
              <div style={{ padding:'1.1rem 1.25rem 1rem', background:`linear-gradient(135deg, ${cfg.color}18 0%, transparent 60%)`, borderBottom:`1px solid ${cfg.color}44`, display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'0.75rem' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', flexWrap:'wrap', marginBottom:'0.35rem' }}>
                    <span style={{ fontSize:'0.75rem', fontWeight:800, padding:'3px 9px', borderRadius:20, background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.color}55`, letterSpacing:'0.05em', textTransform:'uppercase' }}>{cfg.label}</span>
                    {r.brand && <span style={{ fontSize:'0.75rem', fontWeight:700, padding:'2px 7px', borderRadius:4, background:'var(--th-bg-input)', color:'var(--th-text-dim)', border:'1px solid var(--th-border)' }}>{r.brand}</span>}
                    {r.category && <span style={{ fontSize:'0.75rem', fontWeight:700, padding:'2px 7px', borderRadius:4, background:'var(--th-violet-bg)', color:'var(--th-violet)', border:'1px solid var(--th-violet)' }}>{r.category}</span>}
                  </div>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:'1.4rem', textTransform:'uppercase', letterSpacing:'0.03em', color:'var(--th-text-heading)', lineHeight:1.15 }}>{r.item_name}</div>
                  {r.sku && <div style={{ fontSize:'0.8rem', color:'var(--th-text-faint)', marginTop:'0.15rem', fontFamily:'monospace', letterSpacing:'0.04em' }}>{r.sku}</div>}
                </div>
                <button onClick={() => setDetailItem(null)} style={{ background:'rgba(255,255,255,0.07)', border:'1px solid var(--th-border)', borderRadius:8, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--th-text-faint)', fontSize:'1rem', flexShrink:0, transition:'background 0.15s' }}>✕</button>
              </div>

              {/* Gauges row */}
              <div style={{ display:'flex', justifyContent:'center', gap:'1.5rem', padding:'1.25rem 1rem', borderBottom:'1px solid var(--th-border)', background:'var(--th-bg-card-alt)' }}>
                {[{
                  pct: stockPct, color: stockColor, label: 'STOCK',
                  val: fmtN(r.current_stock), valSize: '1.4rem'
                },{
                  pct: daysPct, color: daysColor, label: 'DAYS LEFT',
                  val: r.days_remaining === null ? '∞' : r.days_remaining > horizon ? `${horizon}+` : r.days_remaining, valSize: '1.4rem'
                },{
                  pct: Math.min(100, Math.round((r.projected_revenue / Math.max(...allItems.map(i=>i.projected_revenue),1))*100)),
                  color: 'var(--th-emerald)', label: 'REVENUE', val: fmt(r.projected_revenue), valSize: '1.1rem'
                }].map(({pct,color,label,val,valSize}) => (
                  <div key={label} style={{ textAlign:'center', position:'relative' }}>
                    <div style={{ position:'relative', width:84, height:84 }}>
                      {ring(pct, color, 84, 7)}
                      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:valSize, lineHeight:1, color }}>{val}</span>
                      </div>
                    </div>
                    <div style={{ fontSize:'0.7rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--th-text-faint)', marginTop:'0.4rem' }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Velocity bar */}
              <div style={{ padding:'0.8rem 1.25rem', borderBottom:'1px solid var(--th-border)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.4rem' }}>
                  <span style={{ fontSize:'0.75rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--th-text-faint)' }}>Sales Velocity</span>
                  <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:'1.1rem', color:'var(--th-violet)' }}>{fmtN(r.avg_daily_qty)}/day</span>
                </div>
                <div style={{ height:6, borderRadius:3, background:'var(--th-bg-input)', overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:3, background:'linear-gradient(90deg,var(--th-violet),var(--th-sky))', width:`${velPct}%`, transition:'width 0.5s ease', boxShadow:`0 0 8px var(--th-violet)66` }} />
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:'0.3rem' }}>
                  <span style={{ fontSize:'0.75rem', color:'var(--th-text-faint)' }}>{fmtN(r.total_qty_sold)} sold in {history}d ({r.tx_count} txns)</span>
                  <span style={{ fontSize:'0.75rem', color:'var(--th-text-faint)' }}>{fmt(r.avg_daily_revenue)}/day</span>
                </div>
              </div>

              {/* Depletion timeline */}
              <div style={{ padding:'0.8rem 1.25rem', borderBottom:'1px solid var(--th-border)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.55rem' }}>
                  <span style={{ fontSize:'0.75rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--th-text-faint)' }}>Depletion Timeline</span>
                  <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:'1rem', color:daysColor }}>{fmtDate(r.depletion_date)}</span>
                </div>
                {/* Progress bar track */}
                <div style={{ position:'relative', height:14, borderRadius:99, background:'var(--th-bg-input)', border:'1px solid var(--th-border)', overflow:'hidden' }}>
                  {/* Stock coverage fill */}
                  <div style={{
                    position:'absolute', left:0, top:0, bottom:0,
                    width:`${daysPct}%`,
                    borderRadius:99,
                    background:`linear-gradient(90deg, ${daysColor}cc, ${daysColor})`,
                    transition:'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                    boxShadow:`0 0 10px ${daysColor}88`
                  }} />
                  {/* Lead-time danger zone overlay */}
                  {(() => {
                    const ltPct = Math.min(100, Math.round((leadTime / horizon) * 100))
                    return (
                      <div style={{
                        position:'absolute', right:0, top:0, bottom:0,
                        width:`${ltPct}%`,
                        background:'var(--th-amber)22',
                        borderLeft:'2px solid var(--th-amber)',
                        pointerEvents:'none'
                      }} />
                    )
                  })()}
                </div>
                {/* Labels below bar */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginTop:'0.45rem' }}>
                  <span style={{ fontSize:'0.75rem', color:daysColor, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif" }}>
                    {r.days_remaining === null ? 'No sales data' : r.days_remaining > horizon ? `${horizon}+ days` : `${r.days_remaining}d remaining`}
                  </span>
                  <span style={{ fontSize:'0.75rem', color:'var(--th-amber)', fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif" }}>
                    ⚠ Lead {leadTime}d zone
                  </span>
                  <span style={{ fontSize:'0.75rem', color:'var(--th-text-faint)' }}>
                    {horizon}d horizon
                  </span>
                </div>
              </div>


              {/* Verdict card */}
              <div style={{ margin:'0.85rem 1.25rem', borderRadius:12, padding:'0.85rem 1rem', display:'flex', alignItems:'center', gap:'0.85rem', background: r.suggested_reorder>0 ? 'var(--th-rose-bg)' : 'var(--th-emerald-bg)', border:`1px solid ${r.suggested_reorder>0 ? 'var(--th-rose)' : 'var(--th-emerald)'}55` }}>
                <div style={{ width:42, height:42, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.3rem', flexShrink:0, background: r.suggested_reorder>0 ? 'var(--th-rose)' : 'var(--th-emerald)', color:'#fff', boxShadow:`0 4px 12px ${r.suggested_reorder>0?'var(--th-rose)':'var(--th-emerald)'}55` }}>
                  {r.suggested_reorder > 0 ? '↓' : '✓'}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:'1.15rem', textTransform:'uppercase', letterSpacing:'0.04em', color: r.suggested_reorder>0 ? 'var(--th-rose)' : 'var(--th-emerald)' }}>
                    {r.suggested_reorder > 0 ? `Reorder ${fmtN(r.suggested_reorder)} units` : 'Stock Sufficient'}
                  </div>
                  <div style={{ fontSize:'0.8rem', color:'var(--th-text-dim)', marginTop:'0.15rem' }}>
                    {r.suggested_reorder > 0 ? `Need ${fmtN(totalDemand)} for ${horizon+leadTime}d demand · have ${fmtN(r.current_stock)}` : `Covers ${horizon}d horizon + ${leadTime}d lead time`}
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0, paddingLeft:'0.5rem', borderLeft:'1px solid var(--th-border)' }}>
                  <div style={{ fontSize:'0.7rem', textTransform:'uppercase', color:'var(--th-text-faint)', fontWeight:700, letterSpacing:'0.06em' }}>Unit Price</div>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:'1.15rem', color:'var(--th-text-heading)', marginTop:'0.1rem' }}>{fmt(r.avg_unit_price)}</div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding:'0.75rem 1.25rem 1rem', display:'flex', gap:'0.5rem' }}>
                <button onClick={() => setDetailItem(null)} style={{ flex:1, padding:'0.65rem', borderRadius:10, border:'1px solid var(--th-border-strong)', background:'rgba(255,255,255,0.05)', color:'var(--th-text-muted)', fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:'1rem', textTransform:'uppercase', letterSpacing:'0.06em', cursor:'pointer', transition:'background 0.15s' }}>Close</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
