import '../pages_css/Reportspage.css';
import React, { useState, useEffect } from 'react'
import { API_URL, apiFetch, SkeletonRows, currency, compactCurrency } from '../lib/config'
import KpiCard from '../components/KpiCard'
import DataTable from '../components/DataTable'
import FilterHeader from '../components/FilterHeader'
import { ChartThemeProvider, RevenueDonutChart, useChartTheme, ChartTooltip } from '../components/ChartWrapper'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { LineChart } from '@mui/x-charts/LineChart'
import { BarChart } from '@mui/x-charts/BarChart'
import { PieChart } from '@mui/x-charts/PieChart'

/* ─────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────── */
const fmt = n =>
  '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtK = n => {
  const v = Number(n || 0)
  if (v >= 1_000_000) return '₱' + (v / 1_000_000).toFixed(2) + 'M'
  if (v >= 1_000) return '₱' + (v / 1_000).toFixed(1) + 'k'
  return fmt(v)
}

function pctClass(p) {
  const n = parseFloat(p)
  if (n >= 30) return 'good'
  if (n >= 15) return 'warn'
  if (n >= 0) return 'neutral'
  return 'bad'
}

const SVG = (d, extra = {}) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...extra}>
    {d}
  </svg>
)

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function presets(todayStr) {
  const todayDate = new Date(todayStr || new Date())
  const month = todayDate.getMonth()
  const ago = n => {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const startOf = unit => {
    const d = new Date(todayDate)
    if (unit === 'year') { return `${d.getFullYear()}-01-01` }
    if (unit === 'quarter') { return `${d.getFullYear()}-${String(Math.floor(month / 3) * 3 + 1).padStart(2, '0')}-01` }
    if (unit === 'half') { return `${d.getFullYear()}-${String(month < 6 ? 1 : 7).padStart(2, '0')}-01` }
  }
  const qtrNames = ['1st Qtr', '2nd Qtr', '3rd Qtr', '4th Qtr']
  return [
    { label: 'Today', start: todayStr, end: todayStr },
    { label: '7 Days', start: ago(6), end: todayStr },
    { label: '30 Days', start: ago(29), end: todayStr },
    { label: qtrNames[Math.floor(month / 3)], start: startOf('quarter'), end: todayStr },
    { label: month < 6 ? '1st Half' : '2nd Half', start: startOf('half'), end: todayStr },
    { label: 'This Yr', start: startOf('year'), end: todayStr },
  ]
}

/* ─────────────────────────────────────────────
   FILTER STRIP (shared across tabs)
───────────────────────────────────────────── */
function FilterStrip({ startDate, endDate, setStartDate, setEndDate, activePreset, applyPreset, today }) {
  return (
    <div className="rpt-filter-strip">
      <span className="rpt-filter-label">From</span>
      <input
        className="rpt-filter-date"
        type="date"
        value={startDate}
        onChange={e => { setStartDate(e.target.value); applyPreset({ label: null }) }}
      />
      <span className="rpt-filter-label">To</span>
      <input
        className="rpt-filter-date"
        type="date"
        value={endDate}
        onChange={e => { setEndDate(e.target.value); applyPreset({ label: null }) }}
      />
      <div className="rpt-filter-presets">
        {presets(today).map(p => (
          <button
            key={p.label}
            className={`rpt-filter-preset${activePreset === p.label ? ' active' : ''}`}
            onClick={() => applyPreset(p)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   CUSTOM CHART TOOLTIP
───────────────────────────────────────────── */
function CustomTooltip({ itemData, series }) {
  if (!itemData || !series) return null
  const s = series[0]
  const idx = itemData.dataIndex
  const val = s.data[idx]
  const prevVal = idx > 0 ? s.data[idx - 1] : null
  const date = s.xAxisData?.[idx] || ''
  const pct = prevVal ? (((val - prevVal) / prevVal) * 100).toFixed(2) : null
  const isUp = pct === null || parseFloat(pct) >= 0
  return (
    <div className="custom-tooltip">
      <div className="tooltip-date">
        {date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
      </div>
      <div className="tooltip-value">{fmt(val)}</div>
      <div className="tooltip-footer">
        <span className="tooltip-label">Daily Revenue</span>
        {pct !== null && (
          <span className={`tooltip-badge ${isUp ? '' : 'down'}`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: isUp ? 'none' : 'rotate(180deg)' }}>
              <path d="M7 17L17 7M17 7H7M17 7V17" />
            </svg>
            {isUp ? '+' : ''}{pct}%
          </span>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   SPARKLINE
───────────────────────────────────────────── */
function Sparkline({ data, color = '#0891B2' }) {
  const [isDark, setIsDark] = React.useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark'
  )
  React.useEffect(() => {
    const ob = new MutationObserver(() =>
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
    )
    ob.observe(document.documentElement, { attributes: true })
    return () => ob.disconnect()
  }, [])

  const muiTheme = React.useMemo(() =>
    createTheme({ palette: { mode: isDark ? 'dark' : 'light' }, typography: { fontFamily: 'var(--font-body)' } }),
    [isDark]
  )
  const lineColor = isDark ? '#38bdf8' : '#0284c7'
  const gridStroke = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const lineGlow = isDark
    ? 'drop-shadow(0 0 8px rgba(56,189,248,0.65)) drop-shadow(0 2px 14px rgba(56,189,248,0.3))'
    : 'drop-shadow(0 0 5px rgba(2,132,199,0.4)) drop-shadow(0 2px 8px rgba(2,132,199,0.2))'

  if (!data || data.length < 2) return <div className="pm-empty">Not enough data</div>

  const maxRevenue = Math.max(...data.map(d => d.value || 0), 0)
  const yAxisMax = React.useMemo(() =>
    maxRevenue === 0 ? 10_000 : (Math.ceil(maxRevenue / 10_000) * 10_000) + 10_000,
    [maxRevenue]
  )

  return (
    <div className="rpt-sparkline-wrap">
      <ThemeProvider theme={muiTheme}>
        <LineChart
          dataset={data}
          xAxis={[{ dataKey: 'date', scaleType: 'band', valueFormatter: d => d.slice(5).replace('-', '/'), disableLine: true, disableTicks: true, tickLabelStyle: { display: 'none' } }]}
          yAxis={[{ max: yAxisMax, valueFormatter: v => fmtK(v), disableLine: true, disableTicks: true, tickLabelStyle: { fontFamily: 'var(--font-body)', fill: 'var(--th-text-dim)', fontSize: 11, fontWeight: 500 } }]}
          series={[{ dataKey: 'value', area: false, color: lineColor, showMark: false, valueFormatter: v => fmt(v), curve: 'natural', xAxisData: data.map(d => d.date) }]}
          grid={{ horizontal: true }}
          sx={{
            '& .MuiChartsAxis-line': { stroke: 'transparent' },
            '& .MuiChartsAxis-tick': { stroke: 'transparent' },
            '& .MuiChartsGrid-line': { stroke: gridStroke, strokeDasharray: '4 4' },
            '& .MuiChartsAxis-left .MuiChartsAxis-tickLabel': { transform: 'translateX(-6px)' },
            '& .MuiChartsAxis-bottom .MuiChartsAxis-tickLabel': { display: 'none' },
            '.MuiLineElement-root': { strokeWidth: 2.5, filter: lineGlow },
          }}
          margin={{ top: 10, right: 20, left: 35, bottom: 10 }}
          slotProps={{ legend: { hidden: true }, tooltip: { content: props => <CustomTooltip {...props} /> } }}
        />
      </ThemeProvider>
    </div>
  )
}

/* ─────────────────────────────────────────────
   BAR CHART (MUI X)
───────────────────────────────────────────── */
function RptBarChart({ items, color = 'var(--th-emerald)' }) {
  if (!items || items.length === 0) return <div className="pm-empty">No data</div>
  return (
    <div style={{ width: '100%', height: 260 }}>
      <BarChart
        dataset={items}
        xAxis={[{ scaleType: 'band', dataKey: 'label', tickLabelStyle: { fontSize: 10, fill: 'var(--th-text-faint)' } }]}
        yAxis={[{ valueFormatter: v => fmtK(v), tickLabelStyle: { fontSize: 10, fill: 'var(--th-text-faint)' } }]}
        series={[{ dataKey: 'value', color, valueFormatter: v => fmt(v) }]}
        margin={{ top: 20, right: 10, left: 60, bottom: 40 }}
        slotProps={{ legend: { hidden: true } }}
        borderRadius={4}
      />
    </div>
  )
}

/* ─────────────────────────────────────────────
   SECTION: DAILY ACTIVITY
───────────────────────────────────────────── */
function SectionDailyActivity({ shopId, startDate, endDate, setStartDate, setEndDate, activePreset, applyPreset, isOpen }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filterMode, setFilterMode] = useState('ALL')
  const [page, setPage] = useState(1)
  const pageSize = 10


  const [isClosed, setIsClosed] = useState(false)


  useEffect(() => { setPage(1) }, [filterMode, shopId, endDate])

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true); setError(null)
    const date = endDate
    apiFetch(`${API_URL}/shops/${shopId}/business-date`)
      .then(r => r.json())
      .then(d => { if (d.business_date === date && d.is_closed) setIsClosed(true) })
    apiFetch(`${API_URL}/reports/daily-activity/${shopId}?date=${date}`)
      .then(r => r.json())
      .then(res => {
        if (!active) return
        res.error ? setError(res.error) : setData(res)
        setLoading(false)
      })
      .catch(err => { if (active) { setError(err.message || 'Failed to fetch'); setLoading(false) } })
    return () => { active = false }
  }, [shopId, endDate, isOpen])

  if (loading) return <div className="rpt-loading">Generating Daily Report…</div>
  if (error) return (
    <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--th-rose-bg)', border: '1px solid var(--th-rose)', borderRadius: 12, color: 'var(--th-rose)' }}>
      <div style={{ fontWeight: 900, fontSize: '1.1rem', marginBottom: '0.5rem' }}>⚠ Report Error</div>
      <div style={{ fontSize: '0.85rem' }}>{error}</div>
      <button onClick={() => window.location.reload()} style={{ marginTop: '1rem', padding: '0.45rem 1rem', background: 'var(--th-rose)', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 700 }}>Retry</button>
    </div>
  )
  if (!data) return null

  const { kpis, paymentSummary, transactions } = data

  const filteredTxns = transactions.filter(t => {
    if (filterMode === 'ALL') return true
    return (t.paymentMethod || '').replace('BANK_', '') === filterMode
  })
  const totalPages = Math.max(1, Math.ceil(filteredTxns.length / pageSize))
  const paginatedTxns = filteredTxns.slice((page - 1) * pageSize, page * pageSize)

  const getMethodTotal = m =>
    paymentSummary.filter(p => p.method === m || p.method === `BANK_${m}`).reduce((s, p) => s + p.total, 0)

  const cashOnHand = getMethodTotal('CASH')
  const gcashTotal = getMethodTotal('GCASH')
  const bpiTotal = getMethodTotal('BPI')
  const bdoTotal = getMethodTotal('BDO')
  const cardTotal = getMethodTotal('CARD')
  const digitalTotal = gcashTotal + bpiTotal + bdoTotal + cardTotal
  const creditTotal = getMethodTotal('CREDIT')

  const typeColors = {
    SALE: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    SERVICE: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
    EXPENSE: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    PURCHASE: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    COMMISSION: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    MANUAL_IN: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
    MANUAL_OUT: 'bg-red-500/10 text-red-500 border-red-500/20',
  }

  const txnCols = [
    { key: 'timestamp', label: 'Time', width: '80px', render: t => new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    { key: 'type', label: 'Type', width: '100px', align: 'center', render: t => <span className={`px-2 py-0.5 text-[0.6rem] font-black uppercase rounded border ${typeColors[t.type] || 'bg-gray-500/10 text-gray-500 border-gray-500/20'}`}>{t.type.replace('_', ' ')}</span> },
    { key: 'invoiceNumber', label: 'Ref/Invoice', width: '120px' },
    { key: 'customerName', label: 'Description', render: t => t.customerName || (t.type === 'SALE' || t.type === 'SERVICE' ? 'Walk-in' : 'General') },
    { key: 'paymentMethod', label: 'Method', align: 'center', render: t => <span className="px-2 py-0.5 text-[0.65rem] font-bold rounded bg-gray-500/10 border border-gray-500/20">{t.paymentMethod}</span> },
    {
      key: 'amount', label: 'Amount', align: 'right', render: t => {
        const inflow = t.type === 'SALE' || t.type === 'SERVICE' || t.type === 'MANUAL_IN'
        return <span className={`font-bold ${inflow ? 'text-emerald-500' : 'text-rose-500'}`}>{inflow ? '+' : '-'}{currency(t.amount)}</span>
      }
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* ── Day header row ── */}
      <div className="rpt-day-header">
        <div className="rpt-day-title">
          <span className="rpt-day-dot" style={{ background: isClosed ? 'var(--th-amber)' : 'var(--th-emerald)', boxShadow: isClosed ? 'none' : '0 0 6px var(--th-emerald)' }} />
          Daily Report —
          <input
            type="date" value={endDate} className="rpt-day-date-input"
            onChange={e => { setEndDate(e.target.value); setStartDate(e.target.value) }}
          />
          {isClosed && <span className="rpt-badge" style={{ background: 'var(--th-amber-bg)', color: 'var(--th-amber)', border: '1px solid var(--th-amber)' }}>Closed</span>}
        </div>
      </div>

      {/* ── KPI rows ── */}
      <div className="th-section-label">Financial Summary</div>
      <div className="th-kpi-grid">
        <KpiCard label="Gross Sales" value={compactCurrency(kpis.grossSales)} accent="orange" sub={`Profit: ${compactCurrency(kpis.salesProfit)}`} icon={SVG(<><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>)} />
        <KpiCard label="Gross Services" value={compactCurrency(kpis.grossServices)} accent="violet" sub={`Net: ${compactCurrency(kpis.serviceIncome)}`} icon={SVG(<><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></>)} />
        <KpiCard label="Net Profit" value={compactCurrency(kpis.netProfit)} accent="emerald" sub="Calculated P&L" icon={SVG(<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>)} />
      </div>

      <div className="th-section-label">Operational Outflow</div>
      <div className="th-kpi-grid">
        <KpiCard label="Expenses" value={compactCurrency(kpis.expenses)} accent="rose" sub="Total outflows" icon={SVG(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /></>)} />
        <KpiCard label="Purchases" value={compactCurrency(kpis.purchases)} accent="orange" sub="Inventory spend" icon={SVG(<><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></>)} />
        <KpiCard label="Commissions" value={compactCurrency(kpis.commissions)} accent="amber" sub="Staff incentives" icon={SVG(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>)} />
      </div>

      {/* ── Feed + Recon ── */}
      <div className="rpt-grid-3">
        {/* Daily Activity Feed */}
        <div className="rpt-card" style={{ overflow: 'hidden' }}>
          <div className="rpt-card-head">
            <span className="rpt-card-title">Daily Activity Feed</span>
            <div className="rpt-mode-bar">
              {['ALL', 'CASH', 'GCASH', 'BPI', 'BDO', 'CARD', 'CREDIT'].map(m => (
                <button
                  key={m}
                  className={`rpt-mode-btn${filterMode === m ? ' active' : ''}`}
                  onClick={() => setFilterMode(m)}
                >{m}</button>
              ))}
            </div>
          </div>
          <DataTable
            columns={txnCols}
            rows={paginatedTxns}
            rowKey={row => `${row.type}-${row.id}`}
            loading={loading}
            skeletonRows={8}
            skeletonWidths={['w40', 'w40', 'w60', 'w80', 'w60', 'w60']}
            emptyTitle="No Activity"
            emptyMessage={`No ${filterMode === 'ALL' ? '' : filterMode} transactions found for today.`}
            minWidth={850}
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            style={{ border: 'none', background: 'transparent' }}
          />
        </div>

        {/* Payment Reconciliation */}
        <div className="rpt-card">
          <div className="rpt-card-head">
            <span className="rpt-card-title">Payment Reconciliation</span>
            <span className="rpt-badge" style={isClosed
              ? { background: 'var(--th-amber-bg)', color: 'var(--th-amber)', border: '1px solid var(--th-amber)' }
              : { background: 'var(--th-emerald-bg)', color: 'var(--th-emerald)', border: '1px solid var(--th-emerald)' }}>
              {isClosed ? 'Snapshot' : 'Live'}
            </span>
          </div>
          <div className="rpt-card-body">
            <div className="rpt-recon-row">
              <span className="rpt-recon-label">Cash on Hand</span>
              <span className="rpt-recon-value emerald">{currency(cashOnHand)}</span>
            </div>
            <div className="rpt-recon-row">
              <span className="rpt-recon-label">Digital Total</span>
              <span className="rpt-recon-value sky">{currency(digitalTotal)}</span>
            </div>
            <div className="rpt-recon-row">
              <span className="rpt-recon-label">Credit Sales</span>
              <span className="rpt-recon-value amber">{currency(creditTotal)}</span>
            </div>
            <div className="rpt-recon-row total">
              <span style={{ color: 'var(--th-text-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Daily Inflow</span>
              <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900, fontSize: '1.25rem', color: 'var(--th-text-heading)' }}>{currency(cashOnHand + digitalTotal + creditTotal)}</span>
            </div>
            {/* mini breakdown grid */}
            <div className="rpt-method-grid" style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--th-border)' }}>
              {[
                { method: 'CASH', total: cashOnHand },
                { method: 'GCASH', total: gcashTotal },
                { method: 'BPI', total: bpiTotal },
                { method: 'BDO', total: bdoTotal },
                { method: 'CARD', total: cardTotal },
                { method: 'CREDIT', total: creditTotal },
              ].map(p => (
                <div key={p.method} className="rpt-method-chip">
                  <span className="rpt-method-chip-label">{p.method}</span>
                  <span className="rpt-method-chip-value">{currency(p.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

/* ─────────────────────────────────────────────
   SECTION: SALES OVERVIEW
───────────────────────────────────────────── */
function SectionSales({ shopId, startDate, endDate, setStartDate, setEndDate, activePreset, applyPreset, isOpen }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    const qs = `startDate=${startDate}&endDate=${endDate}`
    apiFetch(`${API_URL}/sales/${shopId}?${qs}&perPage=500`)
      .then(r => r.json())
      .then(salesRes => {
        if (!active) return
        const sales = salesRes.data || []
        const dailyMap = {}
        sales.forEach(s => {
          const d = s.sale_datetime.split('T')[0]
          dailyMap[d] = (dailyMap[d] || 0) + s.total_amount
        })
        const dailyChart = Object.entries(dailyMap).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ date: k, value: v }))
        const dowMap = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 }
        const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        sales.forEach(s => { const dow = dowNames[new Date(s.sale_datetime).getDay()]; dowMap[dow] += s.total_amount })
        const dowChart = dowNames.map(d => ({ label: d, value: dowMap[d] }))
        const totalRevenue = sales.reduce((a, s) => a + s.total_amount, 0)
        setData({ revenue: totalRevenue, txnCount: sales.length, avgSale: sales.length ? totalRevenue / sales.length : 0, dailyChart, dowChart })
        setLoading(false)
      })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [shopId, startDate, endDate, isOpen])

  if (loading || !data) return <div className="rpt-loading">Loading Sales Data…</div>

  return (
    <>
      <FilterStrip startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate} activePreset={activePreset} applyPreset={applyPreset} />

      <div className="th-section-label">Overview — {startDate} → {endDate}</div>

      <div className="th-kpi-grid">
        <KpiCard label="Total Revenue" value={fmtK(data.revenue)} accent="sky" icon={SVG(<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>)} />
        <KpiCard label="Transactions" value={data.txnCount} accent="violet" icon={SVG(<><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /></>)} />
        <KpiCard label="Average Sale" value={fmtK(data.avgSale)} accent="emerald" icon={SVG(<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>)} />
      </div>

      <div className="rpt-grid-3">
        <div className="rpt-card">
          <div className="rpt-card-head"><span className="rpt-card-title">Daily Revenue Trend</span></div>
          <div className="rpt-card-body" style={{ paddingTop: 0 }}>
            <Sparkline data={data.dailyChart} color="var(--th-sky)" />
          </div>
        </div>
        <div className="rpt-card">
          <div className="rpt-card-head"><span className="rpt-card-title">Revenue by Day of Week</span></div>
          <div className="rpt-card-body">
            <RevenueDonutChart items={data.dowChart} valueFormatter={fmtK} />
          </div>
        </div>
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────
   SECTION: PAYMENT BREAKDOWN
───────────────────────────────────────────── */
function SectionPayment({ shopId, startDate, endDate, isOpen }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    apiFetch(`${API_URL}/sales/${shopId}?startDate=${startDate}&endDate=${endDate}&perPage=500`)
      .then(r => r.json())
      .then(res => {
        if (!active) return
        const sales = res.data || []
        const pMap = { CASH: 0, GCASH: 0, CARD: 0, CREDIT: 0 }
        sales.forEach(s => {
          const pm = (s.payment_method || 'CASH').toUpperCase()
          pMap[pm] !== undefined ? (pMap[pm] += s.total_amount) : (pMap.CASH += s.total_amount)
        })
        setData([
          { label: 'CASH', value: pMap.CASH, color: '#10b981' },
          { label: 'GCASH', value: pMap.GCASH, color: '#3b82f6' },
          { label: 'CARD', value: pMap.CARD, color: '#8b5cf6' },
          { label: 'CREDIT', value: pMap.CREDIT, color: '#f59e0b' },
        ])
        setLoading(false)
      })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [shopId, startDate, endDate, isOpen])

  if (loading) return <div className="rpt-loading">Loading…</div>

  return (
    <div className="rpt-card" style={{ minHeight: 340, display: 'flex', flexDirection: 'column' }}>
      <div className="rpt-card-head"><span className="rpt-card-title">Revenue by Payment Method</span></div>
      <div className="rpt-card-body" style={{ flex: 1 }}>
        <RevenueDonutChart items={data} valueFormatter={fmtK} palette={['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b']} />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   SECTION: CATEGORIES
───────────────────────────────────────────── */
function SectionCategories({ shopId, startDate, endDate, isOpen }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const COLORS = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f87171', '#6366f1', '#f472b6', '#2dd4bf', '#a78bfa']

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    apiFetch(`${API_URL}/profits/by-category/${shopId}?startDate=${startDate}&endDate=${endDate}`)
      .then(r => r.json())
      .then(res => {
        if (!active) return
        if (Array.isArray(res)) setData(res.map(c => ({ label: c.category || 'Unknown', value: parseFloat(c.revenue || 0) })).filter(c => c.value > 0).sort((a, b) => b.value - a.value))
        setLoading(false)
      })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [shopId, startDate, endDate, isOpen])

  if (loading) return <div className="rpt-loading">Loading Categories…</div>

  return (
    <div className="rpt-card" style={{ minHeight: 380, display: 'flex', flexDirection: 'column' }}>
      <div className="rpt-card-head"><span className="rpt-card-title">Revenue by Category</span></div>
      <div className="rpt-card-body" style={{ flex: 1 }}>
        {data.length === 0
          ? <div className="rpt-empty">No category data for this period</div>
          : <RevenueDonutChart items={data} valueFormatter={fmtK} palette={COLORS} />
        }
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   SECTION: TOP ITEMS
───────────────────────────────────────────── */
function SectionTopItems({ shopId, startDate, endDate, isOpen }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    apiFetch(`${API_URL}/profits/top-items/${shopId}?startDate=${startDate}&endDate=${endDate}&limit=10`)
      .then(r => r.json())
      .then(res => { if (!active) return; if (Array.isArray(res)) setData(res); setLoading(false) })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [shopId, startDate, endDate, isOpen])

  const maxProfit = Math.max(...data.map(i => i.net_profit), 1)

  const columns = [
    { key: 'rank', label: '#', width: '40px', render: (_, idx) => <span className="pm-item-rank">#{idx + 1}</span> },
    {
      key: 'item_name', label: 'Item', render: i => (
        <div>
          <div className="pm-item-name">{i.item_name}</div>
          <div className="pm-item-meta">{i.brand} · {i.category}</div>
          <div className="pm-bar-track"><div className="pm-bar-fill" style={{ background: 'var(--th-emerald)', width: `${Math.max(2, (i.net_profit / maxProfit) * 100)}%` }} /></div>
        </div>
      )
    },
    { key: 'total_qty', label: 'Qty Sold', align: 'center', render: i => <span style={{ fontWeight: 700 }}>{i.total_qty}</span> },
    { key: 'revenue', label: 'Revenue', align: 'right', render: i => <div className="pm-money sky">{fmtK(i.revenue)}</div> },
    { key: 'net_profit', label: 'Net Profit', align: 'right', render: i => <div className="pm-money emerald">{fmtK(i.net_profit)}</div> },
    { key: 'margin_pct', label: 'Margin', align: 'right', render: i => <span className={`pm-pct-pill ${pctClass(i.margin_pct)}`}>{i.margin_pct}%</span> },
  ]

  return (
    <div className="rpt-card">
      <div className="rpt-card-head"><span className="rpt-card-title">Top Items by Performance</span></div>
      <DataTable columns={columns} rows={data} rowKey="item_or_service_id" loading={loading} skeletonRows={5} />
    </div>
  )
}

/* ─────────────────────────────────────────────
   SECTION: INVENTORY
───────────────────────────────────────────── */
function SectionInventory({ shopId, startDate, endDate, setStartDate, setEndDate, activePreset, applyPreset, isOpen, children }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    apiFetch(`${API_URL}/current-stock/${shopId}`)
      .then(r => r.json())
      .then(res => { if (!active) return; if (Array.isArray(res)) setData(res); setLoading(false) })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [shopId, isOpen])

  if (loading) return <div className="rpt-loading">Loading Inventory…</div>

  const totalItems = data.length
  const totalValue = data.reduce((s, i) => s + ((i.current_quantity || 0) * (i.unit_cost || 0)), 0)
  const lowStock = data.filter(i => (i.current_quantity || 0) > 0 && (i.current_quantity || 0) <= 5).length
  const outOfStock = data.filter(i => (i.current_quantity || 0) <= 0).length
  const topValue = [...data].sort((a, b) => ((b.current_quantity || 0) * (b.unit_cost || 0)) - ((a.current_quantity || 0) * (a.unit_cost || 0))).slice(0, 5)
  const chartData = topValue.map(i => ({ name: i.item_name.split(' ').slice(0, 2).join(' '), fullName: i.item_name, value: (i.current_quantity || 0) * (i.unit_cost || 0) }))

  return (
    <>
      <div className="th-section-label">Inventory Status</div>

      <FilterStrip startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate} activePreset={activePreset} applyPreset={applyPreset} />

      <div className="th-kpi-grid">
        <KpiCard label="Total Stock Value" value={fmtK(totalValue)} accent="sky" sub="Based on unit cost" icon={SVG(<><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>)} />
        <KpiCard label="Active Items" value={totalItems} accent="violet" icon={SVG(<><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /></>)} />
        <KpiCard label="Low Stock (≤5)" value={lowStock} accent="amber" icon={SVG(<><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></>)} />
        <KpiCard label="Out of Stock" value={outOfStock} accent="rose" icon={SVG(<><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></>)} />
      </div>

      <div className="rpt-grid-3">
        <div className="rpt-card" style={{ minHeight: 380 }}>
          <div className="rpt-card-head"><span className="rpt-card-title">Highest Value Inventory (Top 5)</span></div>
          <div className="rpt-card-body" style={{ paddingTop: 0 }}>
            <div style={{ width: '100%', height: 280 }}>
              <BarChart
                dataset={chartData}
                yAxis={[{ scaleType: 'band', dataKey: 'name', tickLabelStyle: { fontSize: 10, fill: 'var(--th-text-faint)' } }]}
                xAxis={[{ valueFormatter: v => fmtK(v), tickLabelStyle: { fontSize: 10, fill: 'var(--th-text-faint)' } }]}
                series={[{ dataKey: 'value', color: '#38bdf8', valueFormatter: v => fmt(v) }]}
                layout="horizontal"
                margin={{ top: 10, right: 30, left: 100, bottom: 40 }}
                slotProps={{ legend: { hidden: true } }}
                borderRadius={4}
              />
            </div>
          </div>
        </div>
        {children}
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────
   SECTION: BUSINESS HEALTH
───────────────────────────────────────────── */
function SectionBusinessHealth({ shopId, startDate, endDate, isOpen }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    apiFetch(`${API_URL}/financial-health/${shopId}?start=${startDate}&end=${endDate}`)
      .then(r => r.json())
      .then(res => { if (!active) return; if (!res.error) setData(res); setLoading(false) })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [shopId, startDate, endDate, isOpen])

  if (loading || !data) return <div className="rpt-loading">Digesting Financial Data…</div>

  const { net_position: net, sales_revenue: rev, receivables_collected: coll, payables_created: pay, expenses_total: exp } = data
  const isGreen = net >= 0
  const totalIn = rev + coll
  const totalOut = pay + exp
  const totalBoth = totalIn + totalOut || 1

  return (
    <>
      {/* Hero health card */}
      <div className={`rpt-health-card ${isGreen ? 'green' : 'red'}`}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="rpt-health-pill" style={{ background: isGreen ? 'var(--th-emerald)' : 'var(--th-rose)' }}>
            ● {isGreen ? 'Business is in the Green' : 'Action Required: Cash Deficit'}
          </div>
          <div className="rpt-health-amount" style={{ color: isGreen ? 'var(--th-emerald)' : 'var(--th-rose)' }}>
            {net < 0 ? '−' : '+'}{fmtK(Math.abs(net))}
          </div>
          <div className="rpt-health-sub">Net Business Position for this period</div>
        </div>
        <div className="rpt-health-flows">
          <div className="rpt-health-flow-row">
            <span style={{ color: 'var(--th-text-faint)', fontWeight: 600 }}>Money In (Revenue + Collections)</span>
            <span style={{ color: 'var(--th-emerald)', fontWeight: 800 }}>+{fmtK(totalIn)}</span>
          </div>
          <div className="pm-bar-track" style={{ height: 8, marginTop: 0 }}>
            <div className="pm-bar-fill" style={{ height: '100%', background: 'var(--th-emerald)', width: `${Math.min(100, (totalIn / totalBoth) * 100)}%` }} />
          </div>
          <div className="rpt-health-flow-row" style={{ marginTop: '0.4rem' }}>
            <span style={{ color: 'var(--th-text-faint)', fontWeight: 600 }}>Money Out (Payables + Expenses)</span>
            <span style={{ color: 'var(--th-rose)', fontWeight: 800 }}>−{fmtK(totalOut)}</span>
          </div>
          <div className="pm-bar-track" style={{ height: 8, marginTop: 0 }}>
            <div className="pm-bar-fill" style={{ height: '100%', background: 'var(--th-rose)', width: `${Math.min(100, (totalOut / totalBoth) * 100)}%` }} />
          </div>
        </div>
      </div>

      <div className="th-kpi-grid">
        <KpiCard label="Receivables" value={fmtK(data.open_receivables)} accent="sky" sub={`${data.open_receivables_count} accounts`} icon={SVG(<><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></>)} />
        <KpiCard label="Payables" value={fmtK(data.open_payables)} accent="rose" sub={`${data.open_payables_count} bills`} icon={SVG(<><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></>)} />
        <KpiCard label="Collection Rate" value={`${data.collection_rate || 0}%`} accent="emerald" sub="Efficiency" icon={SVG(<><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>)} />
        <KpiCard label="Overdue" value={fmtK(data.overdue_payables)} accent="amber" sub={`${data.overdue_payables_count} past due`} icon={SVG(<><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>)} />
      </div>

      <div className="rpt-grid-3">
        <div className="rpt-card">
          <div className="rpt-card-head"><span className="rpt-card-title">Upcoming Payables (Next 14 Days)</span></div>
          <div className="rpt-card-body">
            {(!data.upcoming_payables || data.upcoming_payables.length === 0)
              ? <div className="rpt-empty">No payables due in the next 14 days</div>
              : data.upcoming_payables.map(p => {
                const name = p.payable_type === 'SUPPLIER' ? (p.supplier_name || 'Supplier') : (p.payee_name || 'General')
                return (
                  <div key={p.payable_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--th-border)' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--th-text-faint)' }}>{p.description || '—'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: 'var(--th-rose)', fontFamily: 'Barlow Condensed, sans-serif' }}>{fmtK(p.balance_amount)}</div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--th-amber)' }}>Due: {p.due_date}</div>
                    </div>
                  </div>
                )
              })
            }
          </div>
        </div>

        <div className="rpt-card" style={{ background: 'color-mix(in srgb, var(--th-sky) 5%, var(--th-bg-card))' }}>
          <div className="rpt-card-head"><span className="rpt-card-title">Money Owed to You</span></div>
          <div className="rpt-card-body">
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--th-sky)', fontFamily: 'Barlow Condensed, sans-serif', lineHeight: 1 }}>{fmtK(data.open_receivables)}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--th-text-faint)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '1rem', marginTop: '0.35rem' }}>{data.open_receivables_count} Open Accounts</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--th-text-muted)', lineHeight: 1.55 }}>These are pending collections from credit sales. Collecting these will immediately improve your net cash position.</p>
          </div>
        </div>
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────
   SECTION: PROFIT EQUATION
───────────────────────────────────────────── */
function SectionProfit({ shopId, startDate, endDate, isOpen }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    apiFetch(`${API_URL}/profits/summary/${shopId}?startDate=${startDate}&endDate=${endDate}`)
      .then(r => r.json())
      .then(res => { if (!active) return; if (!res.error) setData(res); setLoading(false) })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [shopId, startDate, endDate, isOpen])

  if (loading || !data) return null

  return (
    <div className="pm-equation">
      <div className="pm-eq-item"><div className="pm-eq-label">Gross Tire Profit</div><div className="pm-eq-val" style={{ color: 'var(--th-violet)' }}>{fmtK(data.product_gross)}</div></div>
      <div className="pm-eq-op">−</div>
      <div className="pm-eq-item"><div className="pm-eq-label">Commission</div><div className="pm-eq-val" style={{ color: 'var(--th-rose)' }}>{fmtK(data.total_commission)}</div></div>
      <div className="pm-eq-op">+</div>
      <div className="pm-eq-item"><div className="pm-eq-label">Service Margin</div><div className="pm-eq-val" style={{ color: 'var(--th-sky)' }}>{fmtK(data.service_margin)}</div></div>
      <div className="pm-eq-op">−</div>
      <div className="pm-eq-item"><div className="pm-eq-label">Materials</div><div className="pm-eq-val" style={{ color: 'var(--th-amber)' }}>{fmtK(data.material_costs)}</div></div>
      <div className="pm-eq-op">−</div>
      <div className="pm-eq-item"><div className="pm-eq-label">Expenses</div><div className="pm-eq-val" style={{ color: 'var(--th-rose)' }}>{fmtK(data.total_expenses)}</div></div>
      <div className="pm-eq-op">=</div>
      <div className="pm-eq-item pm-eq-result"><div className="pm-eq-label">Net Margin</div><div className="pm-eq-val">{data.overall_margin_pct}%</div></div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   SECTION: EXPENSES
───────────────────────────────────────────── */
function SectionExpenses({ shopId, startDate, endDate, isOpen, children }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    apiFetch(`${API_URL}/expenses-summary/${shopId}?startDate=${startDate}&endDate=${endDate}`)
      .then(r => r.json())
      .then(res => { if (!active) return; if (!res.error) setData(res); setLoading(false) })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [shopId, startDate, endDate, isOpen])

  if (loading || !data) return <div className="rpt-loading">Loading Expenses…</div>

  const dailyTrend = (data.daily || []).map(d => ({ date: d.expense_date, value: d.total }))
  const topCategory = (data.by_category || [])[0]

  return (
    <>
      <div className="rpt-section-label">Expense Overview</div>
      <div className="th-kpi-grid">
        <KpiCard label="Total Expenses" value={fmtK(data.total)} accent="rose" icon={SVG(<><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></>)} />
        <KpiCard label="Top Category" value={topCategory ? topCategory.category_name : '—'} accent="amber" sub={topCategory ? fmtK(topCategory.total) : ''} icon={SVG(<><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></>)} />
      </div>
      <div className={children ? 'rpt-grid-3' : ''}>
        <div className="rpt-card" style={{ minHeight: 340 }}>
          <div className="rpt-card-head"><span className="rpt-card-title">Daily Expense Trend</span></div>
          <div className="rpt-card-body" style={{ paddingTop: 0 }}>
            <Sparkline data={dailyTrend} color="var(--th-rose)" />
          </div>
        </div>
        {children}
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────
   SECTION: STAFF & OPERATIONS
───────────────────────────────────────────── */
function SectionStaff({ shopId, startDate, endDate, isOpen }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    apiFetch(`${API_URL}/labor-summary/${shopId}?startDate=${startDate}&endDate=${endDate}`)
      .then(r => r.json())
      .then(res => { if (!active) return; if (Array.isArray(res)) setData(res); setLoading(false) })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [shopId, startDate, endDate, isOpen])

  if (loading) return <div className="rpt-loading">Loading Staff Data…</div>
  if (!data.length) return <div className="rpt-empty">No staff data for this period.</div>

  const maxGross = Math.max(...data.map(s => s.gross_earnings), 1)
  const totalServices = data.reduce((s, x) => s + x.service_count, 0)
  const totalCommission = data.reduce((s, x) => s + x.commission_total, 0)
  const topEarner = data.reduce((max, s) => s.gross_earnings > (max ? max.gross_earnings : 0) ? s : max, null)

  const columns = [
    {
      key: 'full_name', label: 'Staff Member', render: s => (
        <div>
          <div className="pm-item-name">{s.full_name}</div>
          <div className="pm-item-meta">{s.staff_code}</div>
          <div className="pm-bar-track"><div className="pm-bar-fill" style={{ background: 'var(--th-orange)', width: `${Math.max(2, (s.gross_earnings / maxGross) * 100)}%` }} /></div>
        </div>
      )
    },
    { key: 'service_count', label: 'Services', align: 'center' },
    { key: 'service_total', label: 'Service Rev', align: 'right', render: s => <div className="pm-money sky">{fmtK(s.service_total)}</div> },
    { key: 'commission_total', label: 'Commission', align: 'right', render: s => <div className="pm-money rose">{fmtK(s.commission_total)}</div> },
    { key: 'net_earnings', label: 'Net Earnings', align: 'right', render: s => <div className="pm-money emerald">{fmtK(s.net_earnings)}</div> },
  ]

  return (
    <>
      <div className="th-section-label">Operations & Staff</div>
      <div className="th-kpi-grid">
        <KpiCard label="Total Services" value={totalServices} accent="sky" icon={SVG(<><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></>)} />
        <KpiCard label="Total Commissions" value={fmtK(totalCommission)} accent="rose" icon={SVG(<><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></>)} />
        <KpiCard label="Top Earner" value={topEarner ? topEarner.full_name : '—'} accent="emerald" sub={topEarner ? fmtK(topEarner.gross_earnings) : ''} icon={SVG(<><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></>)} />
      </div>
      <div className="rpt-card">
        <div className="rpt-card-head"><span className="rpt-card-title">Staff Performance Summary</span></div>
        <DataTable columns={columns} rows={data} rowKey="staff_id" />
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────
   SECTION: RETURNS
───────────────────────────────────────────── */
function SectionReturns({ shopId, startDate, endDate, isOpen }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    apiFetch(`${API_URL}/returns/${shopId}?from=${startDate}&to=${endDate}`)
      .then(r => r.json())
      .then(res => { if (!active) return; if (Array.isArray(res)) setData(res); setLoading(false) })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [shopId, startDate, endDate, isOpen])

  if (loading) return <div className="rpt-loading">Loading Returns…</div>

  const custReturns = data.filter(r => r.return_type === 'CUSTOMER_RETURN').length
  const suppReturns = data.filter(r => r.return_type === 'SUPPLIER_RETURN').length
  const totalValue = data.reduce((s, r) => s + ((r.quantity || 0) * (r.unit_cost || 0)), 0)
  const rTypeMap = {}
  data.forEach(r => { const lbl = r.return_scenario || r.reason || 'Other'; rTypeMap[lbl] = (rTypeMap[lbl] || 0) + 1 })
  const rTypeChart = Object.entries(rTypeMap).map(([k, v]) => ({ label: k, value: v }))

  return (
    <>
      <div className="th-section-label">Returns Management</div>
      <div className="th-kpi-grid">
        <KpiCard label="Customer Returns" value={custReturns} accent="rose" icon={SVG(<><path d="M2.5 2v6h6" /><path d="M2.66 15.57a10 10 0 1 0 .57-8.38" /></>)} />
        <KpiCard label="Supplier Returns" value={suppReturns} accent="violet" icon={SVG(<><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></>)} />
        <KpiCard label="Est. Impact Value" value={fmtK(totalValue)} accent="amber" sub="Based on unit cost" icon={SVG(<><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>)} />
      </div>
      <div className="rpt-card">
        <div className="rpt-card-head"><span className="rpt-card-title">Returns by Scenario / Reason</span></div>
        <div className="rpt-card-body" style={{ paddingTop: 0 }}>
          <RptBarChart items={rTypeChart} color="var(--th-rose)" />
        </div>
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────
   MAIN INNER COMPONENT
───────────────────────────────────────────── */
function ReportspageInner({ shopId, businessDate }) {
  const today = businessDate || new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
  const defaultStart = thirtyDaysAgo.toISOString().split('T')[0]

  const [startDate, setStartDate] = useState(() => localStorage.getItem('rpt_startDate') || defaultStart)
  const [endDate, setEndDate] = useState(() => localStorage.getItem('rpt_endDate') || today)
  const [activePreset, setActivePreset] = useState(() => localStorage.getItem('rpt_activePreset') || '30 Days')
  const [activeTab, setActiveTab] = useState(0)

  useEffect(() => {
    localStorage.setItem('rpt_startDate', startDate)
    localStorage.setItem('rpt_endDate', endDate)
    activePreset ? localStorage.setItem('rpt_activePreset', activePreset) : localStorage.removeItem('rpt_activePreset')
  }, [startDate, endDate, activePreset])

  const TABS = [
    { id: 0, label: 'Daily Activity', badge: 'New' },
    { id: 1, label: 'Sales Overview' },
    { id: 2, label: 'Products & Inventory', badge: 'Live' },
    { id: 3, label: 'Financial Health & Margins', badge: 'Live' },
    { id: 4, label: 'Operations & Staff' },
  ]

  function applyPreset(p) {
    if (p.label) { setStartDate(p.start); setEndDate(p.end); setActivePreset(p.label) }
    else setActivePreset(null)
  }

  return (
    <div className="rpt-root">
      {/* ── Page header ── */}
      <div className="rpt-page-header">
        <div>
          <div className="rpt-page-title">Reports <span>&amp; Analytics</span></div>
          <div className="rpt-page-sub">Comprehensive insights powered by live data — visualizations and breakdowns across your entire operation.</div>
        </div>
      </div>

      {/* ── Tab navigation ── */}
      <div className="rpt-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`rpt-nav-item${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.badge && <span className="rpt-nav-badge">{tab.badge}</span>}
          </button>
        ))}
      </div>

      {/* ── Tab panels ── */}
      <div className="rpt-panel">

        {activeTab === 0 && (
          <SectionDailyActivity
            shopId={shopId}
            startDate={startDate} endDate={endDate}
            setStartDate={setStartDate} setEndDate={setEndDate}
            activePreset={activePreset} applyPreset={applyPreset}
            isOpen
          />
        )}

        {activeTab === 1 && (
          <SectionSales
            shopId={shopId}
            startDate={startDate} endDate={endDate}
            setStartDate={setStartDate} setEndDate={setEndDate}
            activePreset={activePreset} applyPreset={applyPreset}
            isOpen
          />
        )}

        {activeTab === 2 && (
          <>
            <SectionInventory
              shopId={shopId}
              startDate={startDate} endDate={endDate}
              setStartDate={setStartDate} setEndDate={setEndDate}
              activePreset={activePreset} applyPreset={applyPreset}
              today={today}
              isOpen
            >
              <SectionCategories shopId={shopId} startDate={startDate} endDate={endDate} isOpen />
            </SectionInventory>
            <SectionTopItems shopId={shopId} startDate={startDate} endDate={endDate} isOpen />
          </>
        )}

        {activeTab === 3 && (
          <>
            <FilterStrip
              startDate={startDate} endDate={endDate}
              setStartDate={setStartDate} setEndDate={setEndDate}
              activePreset={activePreset} applyPreset={applyPreset}
              today={today}
            />
            <SectionBusinessHealth shopId={shopId} startDate={startDate} endDate={endDate} isOpen />
            <SectionProfit shopId={shopId} startDate={startDate} endDate={endDate} isOpen />
            <SectionExpenses shopId={shopId} startDate={startDate} endDate={endDate} isOpen>
              <SectionPayment shopId={shopId} startDate={startDate} endDate={endDate} isOpen />
            </SectionExpenses>
          </>
        )}

        {activeTab === 4 && (
          <>
            <FilterStrip
              startDate={startDate} endDate={endDate}
              setStartDate={setStartDate} setEndDate={setEndDate}
              activePreset={activePreset} applyPreset={applyPreset}
              today={today}
            />
            <SectionStaff shopId={shopId} startDate={startDate} endDate={endDate} isOpen />
            <SectionReturns shopId={shopId} startDate={startDate} endDate={endDate} isOpen />
          </>
        )}

      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   EXPORT
───────────────────────────────────────────── */
export default function Reportspage(props) {
  return (
    <ChartThemeProvider>
      <ReportspageInner {...props} />
    </ChartThemeProvider>
  )
}