import React from 'react'
import { API_URL, apiFetch } from '../lib/config'
import KpiCard from '../components/KpiCard'
import SearchInput from '../components/SearchInput'
import { DataTable } from '../components/DataTable'
import usePaginatedResource from '../hooks/usePaginatedResource'
import FilterHeader from '../components/FilterHeader'

const fmt  = n => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtK = n => {
  const v = Number(n || 0)
  if (v >= 1000000) return '₱' + (v / 1000000).toFixed(2) + 'M'
  if (v >= 1000)    return '₱' + (v / 1000).toFixed(1) + 'k'
  return fmt(v)
}

function pctClass(p) {
  const n = parseFloat(p)
  if (n >= 30) return 'good'
  if (n >= 15) return 'warn'
  return 'bad'
}

const CAT_COLORS = {
  PCR: '#38bdf8', SUV: '#a78bfa', TRUCK: '#fbbf24',
  MOTORCYCLE: '#34d399', VALVE: '#fb7185', WEIGHT: '#f97316',
}

function presets() {
  const today = new Date()
  const fmtD = d => d.toISOString().split('T')[0]
  const ago = n => { const d = new Date(today); d.setDate(d.getDate() - n); return fmtD(d) }
  const startOf = (unit) => {
    const d = new Date(today)
    if (unit === 'week')  { d.setDate(d.getDate() - d.getDay()); return fmtD(d) }
    if (unit === 'month') { d.setDate(1); return fmtD(d) }
    if (unit === 'year')  { d.setMonth(0, 1); return fmtD(d) }
  }
  return [
    { label: 'Today',    start: fmtD(today),      end: fmtD(today) },
    { label: '7 Days',   start: ago(6),            end: fmtD(today) },
    { label: '30 Days',  start: ago(29),           end: fmtD(today) },
    { label: 'This Wk',  start: startOf('week'),   end: fmtD(today) },
    { label: 'This Mo',  start: startOf('month'),  end: fmtD(today) },
    { label: 'This Yr',  start: startOf('year'),   end: fmtD(today) },
  ]
}

function ProfitsPage({ shopId, setPageContext }) {
  const today = new Date().toISOString().split('T')[0]
  const monthStart = today.slice(0, 8) + '01'

  const [startDate,    setStartDate]    = React.useState(monthStart)
  const [endDate,      setEndDate]      = React.useState(today)
  const [applied,      setApplied]      = React.useState({ start: monthStart, end: today })
  const [activePreset, setActivePreset] = React.useState('This Mo')

  const [summary,    setSummary]    = React.useState(null)
  const [byCategory, setByCategory] = React.useState([])
  const [topItems,   setTopItems]   = React.useState([])
  const [loading,    setLoading]    = React.useState(true)

  // ── AI Context ────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (summary) {
      setPageContext({
        view: "Profit & Margins",
        period: `${applied.start} to ${applied.end}`,
        metrics: {
          total_revenue: (summary.product_revenue || 0) + (summary.service_revenue || 0),
          cogs: summary.product_cogs,
          net_profit: summary.net_profit,
          margin: summary.overall_margin_pct,
          expenses: summary.total_expenses
        }
      });
    }
  }, [summary, applied, setPageContext]);

  const [suggestions, setSuggestions] = React.useState([])

  const TX_PAGE_SIZE = 20
  const {
    data: transactions,
    page: txPage, setPage: setTxPage,
    totalPages: txPages,
    total: txTotal,
    search, setSearch,
    loading: txLoading,
  } = usePaginatedResource({
    url: `${API_URL}/profits/transactions/${shopId}`,
    perPage: TX_PAGE_SIZE,
    extraParams: { startDate: applied.start, endDate: applied.end },
    enabled: !!shopId,
    deps: [shopId, applied.start, applied.end],
  })

  React.useEffect(() => {
    fetchAll(applied.start, applied.end)
  }, [shopId, applied])

  async function fetchAll(start, end) {
    setLoading(true)
    const qs = `startDate=${start}&endDate=${end}`
    try {
      const [s, c, t] = await Promise.all([
        apiFetch(`${API_URL}/profits/summary/${shopId}?${qs}`).then(r => r.json()),
        apiFetch(`${API_URL}/profits/by-category/${shopId}?${qs}`).then(r => r.json()),
        apiFetch(`${API_URL}/profits/top-items/${shopId}?${qs}&limit=10`).then(r => r.json()),
      ])
      setSummary(s.error ? null : s)
      setByCategory(Array.isArray(c) ? c : [])
      setTopItems(Array.isArray(t) ? t : [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  function applyPreset(p) {
    setStartDate(p.start); setEndDate(p.end)
    setActivePreset(p.label)
    setApplied({ start: p.start, end: p.end })
  }

  function applyOnDateChange(field, val) {
    setActivePreset(null)
    const next = { start: startDate, end: endDate, [field]: val }
    if (field === 'start') setStartDate(val)
    else setEndDate(val)
    setApplied({ start: next.start, end: next.end })
  }

  React.useEffect(() => {
    const q = search.trim().toLowerCase()
    if (!q) { setSuggestions([]); return }
    const seen = new Set()
    const sugs = []
    for (const tx of transactions) {
      const candidates = [
        tx.invoice_number && { text: tx.invoice_number, type: 'Invoice' },
        tx.customer_name  && { text: tx.customer_name,  type: 'Customer' },
        tx.staff_name     && { text: tx.staff_name,     type: 'Staff' },
      ]
      for (const c of candidates) {
        if (c && c.text?.toLowerCase().startsWith(q) && !seen.has(c.text)) {
          seen.add(c.text)
          sugs.push(c)
          if (sugs.length >= 8) break
        }
      }
      if (sugs.length >= 8) break
    }
    setSuggestions(sugs)
  }, [search, transactions])

  const sv = summary || {}
  const maxCatProfit = Math.max(...byCategory.map(c => c.net_profit), 1)
  const maxItemProfit = Math.max(...topItems.map(i => i.net_profit), 1)



  const catColumns = React.useMemo(() => [
    {
      key: 'category',
      label: 'Category',
      render: (c) => (
        <>
          <span className={`pm-cat-badge ${c.category}`}>{c.category}</span>
          <div style={{fontSize:'0.68rem',color:'var(--th-text-faint)',marginTop:2}}>{c.transactions} sales</div>
          <div className="pm-bar-track">
            <div className="pm-bar-fill" style={{width:`${Math.max(4,(c.net_profit/maxCatProfit)*100)}%`,background:CAT_COLORS[c.category]||'var(--th-emerald)'}} />
          </div>
        </>
      ),
    },
    { key: 'total_qty',    label: 'Qty',          align: 'right', render: c => c.total_qty },
    { key: 'revenue',      label: 'Revenue',       align: 'right', render: c => <div className="pm-money sky">{fmtK(c.revenue)}</div> },
    { key: 'cogs',         label: 'COGS',          align: 'right', render: c => <div className="pm-money amber">{fmtK(c.cogs)}</div> },
    { key: 'gross_profit', label: 'Gross Profit',  align: 'right', render: c => <div className="pm-money violet">{fmtK(c.gross_profit)}</div> },
    { key: 'commission',   label: 'Commission',    align: 'right', render: c => <div className="pm-money rose">{fmtK(c.commission)}</div> },
    { key: 'net_profit',   label: 'Net Profit',    align: 'right', render: c => <div className="pm-money emerald">{fmtK(c.net_profit)}</div> },
    {
      key: 'net_margin_pct', label: 'Margin %', align: 'right',
      render: c => <span className={`pm-pct-pill ${pctClass(c.net_margin_pct)}`}>{c.net_margin_pct}%</span>,
    },
  ], [maxCatProfit])

  const txColumns = React.useMemo(() => [
    {
      key: 'invoice_number', label: 'Invoice',
      render: tx => <div className="pm-tx-inv">{tx.invoice_number || tx.sale_id}</div>,
    },
    {
      key: 'sale_datetime', label: 'Date / Time',
      render: tx => (
        <>
          <div style={{fontSize:'0.8rem',color:'var(--th-text-body)',whiteSpace:'nowrap'}}>
            {new Date(tx.sale_datetime).toLocaleString('en-PH',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true})}
          </div>
        </>
      ),
    },
    {
      key: 'customer_name', label: 'Customer',
      render: tx => <span style={{color:'var(--th-text-body)',fontSize:'0.8rem'}}>{tx.customer_name || <span style={{color:'var(--th-text-faint)'}}>Walk-in</span>}</span>,
    },
    {
      key: 'staff_name', label: 'Staff',
      render: tx => <span style={{color:'var(--th-text-body)',fontSize:'0.8rem'}}>{tx.staff_name || '—'}</span>,
    },
    { key: 'product_revenue',   label: 'Product Rev',      align: 'right', render: tx => <div className="pm-money sky">{fmtK(tx.product_revenue)}</div> },
    { key: 'product_cogs',      label: 'COGS',             align: 'right', render: tx => <div className="pm-money amber">{fmtK(tx.product_cogs)}</div> },
    { key: 'gross_profit',      label: 'Gross Profit',     align: 'right', render: tx => <div className="pm-money violet">{fmtK(tx.gross_profit)}</div> },
    { key: 'commission',        label: 'Commission',       align: 'right', render: tx => <div className="pm-money rose">{fmtK(tx.commission)}</div> },
    { key: 'net_tire_profit',   label: 'Net Tire Profit',  align: 'right', render: tx => <div className={`pm-money ${tx.net_tire_profit >= 0 ? 'emerald' : 'rose'}`}>{fmtK(tx.net_tire_profit)}</div> },
    { key: 'service_revenue',   label: 'Service Rev',      align: 'right', render: tx => <div className="pm-money dim">{fmtK(tx.service_revenue)}</div> },
    { key: 'service_margin',    label: 'Svc Margin',       align: 'right', render: tx => <div className="pm-money sky">{fmtK(tx.service_margin)}</div> },
    { key: 'net_profit',        label: 'Net Profit',       align: 'right', render: tx => <div className={`pm-money ${tx.net_profit >= 0 ? 'emerald' : 'rose'}`} style={{fontSize:'0.95rem'}}>{fmtK(tx.net_profit)}</div> },
    { key: 'margin_pct',        label: 'Margin %',         align: 'right', render: tx => <span className={`pm-pct-pill ${pctClass(tx.margin_pct)}`}>{tx.margin_pct}%</span> },
  ], [])

  const topItemsColumns = React.useMemo(() => [
    {
      key: 'rank', label: '#', width: '36px',
      render: (item, idx) => <span className="pm-item-rank">#{idx + 1}</span>,
    },
    {
      key: 'item_name', label: 'Item',
      render: (item) => (
        <>
          <div className="pm-item-name">{item.item_name}</div>
          <div className="pm-item-meta">{item.brand} · {item.category}</div>
          <div className="pm-bar-track">
            <div className="pm-bar-fill" style={{width:`${Math.max(4,(item.net_profit/maxItemProfit)*100)}%`,background:'var(--th-emerald)'}} />
          </div>
        </>
      ),
    },
    { key: 'total_qty',   label: 'Qty',     align: 'right', render: i => i.total_qty },
    { key: 'unit_cost',   label: 'Unit Cost',align: 'right', render: i => <div className="pm-money dim">{fmt(i.unit_cost)}</div> },
    { key: 'net_profit',  label: 'Net Profit',align: 'right', render: i => <div className="pm-money emerald">{fmtK(i.net_profit)}</div> },
    { key: 'margin_pct',  label: 'Margin %', align: 'right', render: i => <span className={`pm-pct-pill ${pctClass(i.margin_pct)}`}>{i.margin_pct}%</span> },
  ], [maxItemProfit])


  return (
    <>
      <style>{`
        .pm-root {
            font-family: var(--font-body);
            color: var(--th-text-body);
            display: flex;
            flex-direction: column;
            gap: .5rem;
        }
      `}</style>
      <div className="pm-root">
      {/* Header */}
      <div className="pm-header-row">
        <div className="th-title-format">Profit <span style={{ color: 'var(--th-emerald)' }}>&amp; Margins</span></div>
      </div>

      <div className="pm-sub">
        Revenue = total sales collected. Net Profit = Revenue − Cost of Goods − Commission − Material Costs − Operating Expenses.
      </div>

      {/* KPI cards */}
      <div className="pm-section">Overview — {applied.start} to {applied.end}</div>
      <div className="th-kpi-row">
        <KpiCard label="Total Sales"        value={fmtK((sv.product_revenue||0)+(sv.service_revenue||0))} accent="sky"    loading={loading} sub={`Tires ${fmtK(sv.product_revenue)} · Labor ${fmtK(sv.service_revenue)}`} />
        <KpiCard label="Cost of Goods"      value={fmtK(sv.product_cogs)}      accent="amber"   loading={loading} sub="Unit cost × qty sold" />
        <KpiCard label="Gross Tire Profit"  value={fmtK(sv.product_gross)}     accent="violet"  loading={loading} sub={`${sv.product_margin_pct ?? '—'}% margin`} />
        <KpiCard label="Commission Paid"    value={fmtK(sv.total_commission)}  accent="rose"    loading={loading} sub="Staff commissions" />
        <KpiCard label="Material Costs"     value={fmtK(sv.material_costs)}    accent="amber"   loading={loading} sub="Consumables & materials" />
        <KpiCard label="Expenses"           value={fmtK(sv.total_expenses)}    accent="rose"    loading={loading} sub="Rent, utilities & overhead" />
        <KpiCard label="Net Profit"         value={fmtK(sv.net_profit)}        accent={(sv.net_profit||0) >= 0 ? 'emerald' : 'rose'} loading={loading} sub={`${sv.overall_margin_pct ?? '—'}% net margin`} />
      </div>

      {/* Filter Header Toolbar */}
      <div style={{ marginTop: '0', marginBottom: '0' }}>
        <FilterHeader          searchProps={{
            value: search,
            onChange: setSearch,
            placeholder: "Search invoice, customer, staff…",
            suggestions: suggestions,
            onSuggestionSelect: s => setSearch(s.text),
            resultCount: search.trim() ? txTotal : undefined,
            totalCount: txTotal,
            resultLabel: "transactions",
          }}
          leftComponent={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', flexWrap: 'nowrap', width: '100%', height: '100%' }}>
              <span style={{ fontSize: 'inherit', fontWeight: 600, color: 'var(--th-text-muted)', whiteSpace: 'nowrap' }}>From</span>
              <input className="fh-date" type="date" value={startDate} onChange={e => applyOnDateChange('start', e.target.value)} style={{ flex: 1, minWidth: '120px' }} />
              <span style={{ fontSize: 'inherit', fontWeight: 600, color: 'var(--th-text-muted)', whiteSpace: 'nowrap' }}>To</span>
              <input className="fh-date" type="date" value={endDate} onChange={e => applyOnDateChange('end', e.target.value)} style={{ flex: 1, minWidth: '120px' }} />
            </div>
          }
          filters={presets().map(p => ({
            label: p.label,
            value: p.label,
            active: activePreset === p.label
          }))}
          onFilterChange={(label) => {
            const p = presets().find(x => x.label === label)
            if (p) applyPreset(p)
          }}
          accentColor="var(--th-emerald)"
        />
      </div>

      {/* Profit Equation */}
      {!loading && (
        <div className="pm-equation">
          <div className="pm-eq-item">
            <div className="pm-eq-label">Gross Tire Profit</div>
            <div className="pm-eq-val" style={{color:'var(--th-violet)'}}>{fmtK(sv.product_gross)}</div>
          </div>
          <div className="pm-eq-op">−</div>
          <div className="pm-eq-item">
            <div className="pm-eq-label">Commission</div>
            <div className="pm-eq-val" style={{color:'var(--th-rose)'}}>{fmtK(sv.total_commission)}</div>
          </div>
          <div className="pm-eq-op">+</div>
          <div className="pm-eq-item">
            <div className="pm-eq-label">Service Margin (÷2)</div>
            <div className="pm-eq-val" style={{color:'var(--th-sky)'}}>{fmtK(sv.service_margin)}</div>
          </div>
          <div className="pm-eq-op">−</div>
          <div className="pm-eq-item">
            <div className="pm-eq-label">Material Costs</div>
            <div className="pm-eq-val" style={{color:'var(--th-amber)'}}>{fmtK(sv.material_costs)}</div>
          </div>
          <div className="pm-eq-op">−</div>
          <div className="pm-eq-item">
            <div className="pm-eq-label">Expenses</div>
            <div className="pm-eq-val" style={{color:'var(--th-rose)'}}>{fmtK(sv.total_expenses)}</div>
          </div>
          <div className="pm-eq-op">=</div>
          <div className="pm-eq-item pm-eq-result" style={(sv.net_profit||0) < 0 ? {background:'var(--th-rose-bg)'} : {}}>
            <div className="pm-eq-label" style={(sv.net_profit||0) < 0 ? {color:'var(--th-rose)'} : {}}>Net Profit</div>
            <div className="pm-eq-val" style={(sv.net_profit||0) < 0 ? {color:'var(--th-rose)'} : {}}>{fmtK(sv.net_profit)}</div>
          </div>
        </div>
      )}

      {/* Inventory purchased reference */}
      {!loading && (sv.total_purchases || 0) > 0 && (
        <div className="pm-purchases-ref">
          <span className="pm-purchases-label">📦 Inventory Purchased</span>
          <span style={{color:'var(--th-amber)',fontWeight:700}}>{fmtK(sv.total_purchases)}</span>
          <span>across {sv.purchase_orders} purchase order{sv.purchase_orders !== 1 ? 's' : ''} this period</span>
          <span className="pm-purchases-note">Not deducted — only COGS (items sold) impacts profit</span>
        </div>
      )}

      {/* Category Breakdown + Top Items */}
      <div className="pm-section">Category &amp; Top Items</div>
      <div className="pm-three-col">
        {/* Category table */}
        <div className="pm-card">
          <div className="pm-card-head">
            <span>Profit by Category</span>
            <span style={{fontSize:'0.72rem',color:'var(--th-text-faint)'}}>{byCategory.length} categories</span>
          </div>
          <DataTable
            columns={catColumns}
            rows={byCategory}
            rowKey="category"
            loading={loading}
            skeletonRows={5}
            skeletonWidths={['w60','w20','w30','w30','w30','w30','w30','w20']}
            minWidth={600}
            emptyTitle="No Sales Data"
            emptyMessage="No sales data for this period."
          />
        </div>

        {/* Top items */}
        <div className="pm-card">
          <div className="pm-card-head">
            <span>Top 10 Items by Net Profit</span>
          </div>
          <DataTable
            columns={topItemsColumns}
            rows={topItems}
            rowKey="item_or_service_id"
            loading={loading}
            skeletonRows={5}
            skeletonWidths={['w20','w60','w20','w30','w30','w20']}
            minWidth={420}
            emptyTitle="No Data"
            emptyMessage="No top items for this period."
          />
        </div>
      </div>

      {/* Transaction drilldown */}
      <div className="pm-section">Transaction Drilldown — {txTotal} {search.trim() ? 'matching' : ''} sales</div>
      <div className="pm-card">
        <div className="pm-card-head">
          <span>All Transactions</span>
          <span style={{fontSize:'0.78rem',color:'var(--th-text-faint)'}}>{txTotal} total</span>
        </div>
        <DataTable
          columns={txColumns}
          rows={transactions}
          rowKey="sale_id"
          loading={loading}
          skeletonRows={8}
          skeletonWidths={['w30','w40','w40','w30','w20','w20','w20','w20','w20','w20','w20','w20','w20']}
          minWidth={1100}
          emptyTitle="No Transactions"
          emptyMessage="No transactions for this period."
          currentPage={txPage}
          totalPages={txPages}
          onPageChange={setTxPage}
        />
      </div>
    </div>
  </>
  )
}

export default ProfitsPage
