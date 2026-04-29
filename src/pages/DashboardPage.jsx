import '../pages_css/DashboardPage.css';
import React from 'react'
import { API_URL, apiFetch, SkeletonRows } from '../lib/config'
import KpiCard from '../components/KpiCard'
import { LineChart } from '@mui/x-charts/LineChart'
import { ThemeProvider, createTheme } from '@mui/material/styles'

const fmt = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtK = (n) => n >= 1000 ? '₱' + (n / 1000).toFixed(1) + 'k' : fmt(n)

// ── Y-axis formatter ─────────────────────────────────────────────────────────
function yFmt(val) {
  if (val === 0) return '₱0'
  if (val >= 1000000) return '₱' + (val / 1000000).toFixed(1) + 'M'
  if (val >= 1000) return '₱' + (val / 1000).toFixed(val >= 10000 ? 0 : 1) + 'k'
  return '₱' + val
}

// ── MonthlyChart ─────────────────────────────────────────────────────────────
function MonthlyChart({ shopId }) {
  const [chartData, setChartData] = React.useState([])
  const [total, setTotal] = React.useState(0)
  const [isDark, setIsDark] = React.useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark'
  )

  // Reactively track theme changes
  React.useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  React.useEffect(() => {
    const days = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      days.push({ date: d.toISOString().split('T')[0], isToday: i === 0 })
    }
    const start = days[0].date, end = days[29].date
    if (!shopId) return
    apiFetch(`${API_URL}/sales/${shopId}?startDate=${start}&endDate=${end}&perPage=200`)
      .then(r => r.json())
      .then(d => {
        const totals = {}
          ; (Array.isArray(d?.data) ? d.data : []).forEach(s => {
            const d = (s.sale_datetime || '').split('T')[0].split(' ')[0]
            if (d) totals[d] = (totals[d] || 0) + (s.total_amount || 0)
          })
        const mapped = days.map(d => ({
          date: d.date,
          label: d.date.slice(5).replace('-', '/'),
          revenue: totals[d.date] || 0,
          isToday: d.isToday,
        }))
        const maxVal = Math.max(...mapped.map(d => d.revenue))
        mapped.forEach(d => { d.isPeak = d.revenue === maxVal && maxVal > 0 })
        setChartData(mapped)
        setTotal(mapped.reduce((s, d) => s + d.revenue, 0))
      }).catch(() => { })
  }, [shopId])

  // Theme-responsive tokens
  const lineColor = isDark ? '#38bdf8' : '#0284c7'
  const legendColor = isDark ? '#64748b' : 'var(--th-text-dim)'
  const gridStroke = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'
  const markStroke = isDark ? '#0f172a' : '#ffffff'
  const lineGlow = isDark
    ? 'drop-shadow(0px 0px 8px rgba(56,189,248,0.65)) drop-shadow(0px 2px 14px rgba(56,189,248,0.3))'
    : 'drop-shadow(0px 0px 5px rgba(2,132,199,0.4)) drop-shadow(0px 2px 8px rgba(2,132,199,0.2))'

  const maxRevenue = Math.max(...chartData.map(d => d.revenue || 0), 0)
  const yAxisMax = React.useMemo(() => {
    if (maxRevenue === 0) return 10000
    return (Math.ceil(maxRevenue / 10000) * 10000) + 10000
  }, [maxRevenue])

  const muiTheme = React.useMemo(() => createTheme({
    palette: { mode: isDark ? 'dark' : 'light' },
    typography: { fontFamily: 'var(--font-body)' }
  }), [isDark])

  return (
    <div className="th-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="th-panel-title" style={{ borderBottom: 'none', paddingBottom: '0.4rem', marginBottom: '0.2rem' }}>
        <div className="th-panel-title-left">
          30-DAY REVENUE TREND
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)', color: legendColor, fontWeight: 600 }}>
            <div style={{ width: 24, height: 2, background: lineColor, borderRadius: 2, boxShadow: isDark ? '0 0 6px rgba(56,189,248,0.6)' : 'none' }} />
            Revenue
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)', color: legendColor, fontWeight: 600 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--th-orange)' }} />
            Today
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)', color: legendColor, fontWeight: 600 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', border: `2px solid ${lineColor}`, background: 'transparent' }} />
            Peak
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
        <div className="th-kpi-value" style={{ color: 'var(--th-text-heading)', paddingLeft: 0, marginBottom: 0 }}>{fmtK(total)}</div>
        <div className="th-kpi-sub" style={{ color: 'var(--th-text-dim)', paddingLeft: 0 }}>last 30 days</div>
      </div>

      {/* Chart */}
      <div className="th-monthly-chart-wrap" style={{ width: '100%', marginTop: 0, marginBottom: 0 }}>
        <ThemeProvider theme={muiTheme}>
          <LineChart
            dataset={chartData}
            xAxis={[{
              dataKey: 'date',
              scaleType: 'band',
              valueFormatter: (d) => d.slice(5).replace('-', '/'),
              disableLine: true,
              disableTicks: true,
              tickLabelStyle: { display: 'none' }
            }]}
            yAxis={[{
              max: yAxisMax,
              tickNumber: 6,
              valueFormatter: (v) => yFmt(v),
              disableLine: true,
              disableTicks: true,
              tickLabelStyle: {
                fontFamily: 'var(--font-body)',
                fill: 'var(--th-text-dim)',
                fontSize: 11,
                fontWeight: 500
              }
            }]}
            series={[{
              dataKey: 'revenue',
              area: false,
              color: lineColor,
              showMark: (params) => params.isToday || params.isPeak,
              valueFormatter: (v) => fmt(v),
              curve: 'natural',
              xAxisData: chartData.map(d => d.date)
            }]}
            grid={{ horizontal: true }}
            sx={{
              '& .MuiChartsAxis-line': { stroke: 'transparent' },
              '& .MuiChartsAxis-tick': { stroke: 'transparent' },
              '& .MuiChartsGrid-line': { stroke: gridStroke, strokeDasharray: '4 4' },
              '& .MuiChartsAxis-left .MuiChartsAxis-tickLabel': {
                transform: 'translateX(-2px)',
                fontSize: '10px !important'
              },
              '& .MuiChartsAxis-bottom .MuiChartsAxis-tickLabel': {
                display: 'none'
              },
              '.MuiLineElement-root': {
                strokeWidth: 2.5,
                filter: lineGlow,
              },
              '.MuiMarkElement-root': {
                fill: lineColor,
                stroke: markStroke,
                strokeWidth: 2,
                r: 4,
              }
            }}
            margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
            slotProps={{
              legend: { hidden: true }
            }}
          />
        </ThemeProvider>
      </div>

      <style>{`
        .th-monthly-chart-wrap {
          height: 280px;
        }
        @media (max-width: 640px) {
          .th-monthly-chart-wrap {
            height: 180px; /* makes it a more compact rectangle on mobile */
          }
        }
      `}</style>
    </div>
  )
}

function RecentSales({ shopId, loading }) {
  const [sales, setSales] = React.useState([])

  React.useEffect(() => {
    if (!shopId) return
    apiFetch(`${API_URL}/dashboard-recent/${shopId}`)
      .then(r => r.json())
      .then(d => setSales(Array.isArray(d) ? d.slice(0, 5) : []))
      .catch(() => { })
  }, [shopId])

  return (
    <div className="th-panel th-recent-sales-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="th-panel-title">
        <div className="th-panel-title-left">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
          Today's Sales
        </div>
        {sales.length > 0 && <span className="th-panel-badge">{sales.length}</span>}
      </div>
      
      <div className="th-recent-scroll-wrap" style={{ flex: 1, overflowY: 'auto', marginRight: '-0.4rem', paddingRight: '0.4rem' }}>
        {loading ? (
          <table className="th-recent-table"><tbody><SkeletonRows rows={5} cols={2} widths={['w80', 'w30']} /></tbody></table>
        ) : sales.length === 0 ? (
          <div style={{ color: 'var(--th-text-faint)', fontSize: '0.82rem', padding: '0.5rem 0' }}>No sales yet today.</div>
        ) : (
          <table className="th-recent-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th className="r">Amount</th>
              </tr>
            </thead>
            <tbody>
              {sales.map(s => {
                const time = new Date(s.sale_datetime).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
                const who = s.customer_name || 'Walk-in'
                return (
                  <tr key={s.sale_id}>
                    <td>
                      <div className="th-recent-name">{who}</div>
                      <div className="th-recent-sub">{s.invoice_number || s.sale_id} · {time}</div>
                    </td>
                    <td><div className="th-recent-amount">{fmt(s.total_amount)}</div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .th-recent-sales-panel {
          height: 100%;
          min-height: 380px;
        }
        @media (max-width: 700px) {
          .th-recent-sales-panel {
             height: 280px; 
             min-height: 280px;
          }
        }
        .th-recent-scroll-wrap::-webkit-scrollbar { width: 4px; }
        .th-recent-scroll-wrap::-webkit-scrollbar-thumb { background: var(--th-border); border-radius: 10px; }
      `}</style>
    </div>
  )
}

function TopItems({ shopId }) {
  const [items, setItems] = React.useState([])

  React.useEffect(() => {
    if (!shopId) return
    apiFetch(`${API_URL}/dashboard-top-items/${shopId}`)
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => { })
  }, [shopId])

  const maxQty = Math.max(...items.map(i => i.total_qty), 1)

  return (
    <div className="th-panel">
      <div className="th-panel-title">
        <div className="th-panel-title-left">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 20 18 10" /><polyline points="12 20 12 4" /><polyline points="6 20 6 14" /></svg>
          Top Products
        </div>
        <span className="th-panel-badge">This Month</span>
      </div>
      {items.length === 0 ? (
        <div style={{ color: 'var(--th-text-faint)', fontSize: '0.82rem', padding: '0.5rem 0' }}>No sales data yet.</div>
      ) : (
        items.map((item, idx) => {
          const rankClass = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : 'other'
          const rankLabel = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`
          return (
            <div key={idx} className="th-top-item">
              <div className={`th-top-item-rank ${rankClass}`}>{rankLabel}</div>
              <div className="th-top-item-info">
                <div className="th-top-item-name">{item.item_name}</div>
                <div className="th-top-item-brand">{item.brand} · {item.category}</div>
                <div className="th-bar-track">
                  <div className="th-bar-fill" style={{ width: `${(item.total_qty / maxQty) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="th-top-item-qty">{item.total_qty} pcs</div>
                <div className="th-top-item-rev">{fmtK(item.total_revenue)}</div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

function StatusAlerts({ recapCount, lowStockCount, openARCount, loading }) {
  const alerts = [
    {
      dot: lowStockCount > 0 ? 'red' : 'green',
      label: 'Low / Zero Stock',
      rowClass: lowStockCount > 0 ? 'danger' : '',
      value: loading ? '—' : lowStockCount,
      badgeClass: lowStockCount > 0 ? 'danger' : '',
    },
    {
      dot: recapCount > 0 ? 'amber' : 'green',
      label: 'Active Recap Jobs',
      rowClass: recapCount > 0 ? 'warn' : '',
      value: loading ? '—' : recapCount,
      badgeClass: recapCount > 0 ? 'warn' : '',
    },
    {
      dot: openARCount > 0 ? 'amber' : 'green',
      label: 'Open Receivables',
      rowClass: openARCount > 0 ? 'warn' : '',
      value: loading ? '—' : openARCount,
      badgeClass: openARCount > 0 ? 'warn' : '',
    },
    {
      dot: 'sky',
      label: 'System Status',
      rowClass: '',
      value: 'Online',
      badgeClass: '',
    },
  ]
  return (
    <div className="th-panel">
      <div className="th-panel-title">
        <div className="th-panel-title-left">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          System Health
        </div>
      </div>
      {alerts.map(a => (
        <div key={a.label} className={`th-alert-row ${a.rowClass}`}>
          <div className="th-alert-left">
            <span className={`th-alert-dot ${a.dot}`} />
            <span>{a.label}</span>
          </div>
          <span className={`th-alert-badge ${a.badgeClass}`}>{a.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Live clock hook ── */
function useLiveClock() {
  const [time, setTime] = React.useState(() => new Date())
  React.useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

/* ── Main ── */
function DashboardPage({ shopId, shopName, businessDate }) {
  const [, forceUpdate] = React.useReducer(x => x + 1, 0)
  React.useEffect(() => {
    const obs = new MutationObserver(() => forceUpdate())
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  const now = useLiveClock()

  const [data, setData] = React.useState({})
  const [loading, setLoading] = React.useState(true)
  const [spinning, setSpinning] = React.useState(false)
  const [lastRefresh, setLastRefresh] = React.useState(null)
  const [recapCount, setRecapCount] = React.useState(0)
  const [lowStockCount, setLowStockCount] = React.useState(0)


  const fetchAll = React.useCallback(() => {
    if (!shopId) return
    setSpinning(true); setLoading(true)

    const effectiveDate = businessDate || new Date().toISOString().split('T')[0]
    const p1 = apiFetch(`${API_URL}/dashboard/${shopId}?date=${effectiveDate}`).then(r => r.json()).then(d => setData(d || {})).catch(() => { })
    const p2 = apiFetch(`${API_URL}/recap-jobs/${shopId}`).then(r => r.json()).then(jobs => {
      if (Array.isArray(jobs)) setRecapCount(jobs.filter(j => !['CLAIMED', 'REJECTED', 'FORFEITED'].includes(j.current_status)).length)
    }).catch(() => { })
    const p3 = apiFetch(`${API_URL}/current-stock/${shopId}`).then(r => r.json()).then(items => {
      if (Array.isArray(items)) setLowStockCount(items.filter(i => (i.current_quantity || 0) <= 2).length)
    }).catch(() => { })

    Promise.all([p1, p2, p3]).finally(() => { setLoading(false); setSpinning(false); setLastRefresh(new Date()) })
  }, [shopId])

  React.useEffect(() => { fetchAll() }, [fetchAll])

  const ts = lastRefresh ? lastRefresh.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'
  const clockStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const dateStr = now.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const SVG = (d, extra = {}) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" {...extra}>{d}</svg>

  return (
    <div className="th-dash" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly' }}>
      {/* Header */}
      <div className="th-dash-header">
        <div>
          <div className="th-dash-title" style={{ textTransform: 'uppercase' }}>{shopName || "CoreTrack"} <span>Dashboard</span></div>
          <div className="th-dash-date">{dateStr}</div>
          <div className="th-dash-ts">Last refreshed: {ts}</div>
        </div>
        <div className="th-header-right">
          <div className="th-live-clock">{clockStr}</div>
          <button className={`th-refresh-btn${spinning ? ' spinning' : ''}`} onClick={fetchAll} disabled={spinning}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Today KPIs */}
      <div className="th-section-label">Today</div>
      <div className="th-kpi-grid">
        <KpiCard label="Today's Sales" value={fmt(data.today_sales || 0)} accent="orange"
          sub="Revenue today" loading={loading}
          icon={SVG(<><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>)} />
        <KpiCard label="Transactions" value={data.today_transactions || 0} accent="sky"
          sub="Sales today" loading={loading}
          icon={SVG(<><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></>)} />
        <KpiCard label="Staff Present" value={data.present_staff || 0} accent="amber"
          sub="Clocked in today" loading={loading}
          icon={SVG(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>)} />
      </div>

      {/* Month KPIs */}
      <div className="th-section-label">This Month</div>
      <div className="th-kpi-grid">
        <KpiCard label="Month Sales" value={fmtK(data.month_sales || 0)} accent="emerald"
          sub={`${data.month_transactions || 0} transactions`} loading={loading}
          icon={SVG(<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>)} />
        <KpiCard label="Receivables" value={fmtK(data.total_receivables || 0)} accent="violet"
          sub={`${data.open_receivables_count || 0} open accounts`} loading={loading}
          icon={SVG(<><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></>)} />
        <KpiCard label="Payables" value={fmtK(data.total_payables || 0)} accent="rose"
          sub="Open A/P" loading={loading}
          icon={SVG(<><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></>)} />
      </div>

      {/* Inventory KPIs */}
      <div className="th-section-label">Inventory</div>
      <div className="th-kpi-grid">
        <KpiCard label="Total Items" value={(data.total_items || 0).toLocaleString()} accent="sky"
          sub="Active SKUs" loading={loading}
          icon={SVG(<><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></>)} />
        <KpiCard label="Stock Units" value={(data.total_stock || 0).toLocaleString()} accent="violet"
          sub="Total in inventory" loading={loading}
          icon={SVG(<><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>)} />
        <KpiCard label="Customers" value={(data.total_customers || 0).toLocaleString()} accent="emerald"
          sub="Registered" loading={loading}
          icon={SVG(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>)} />
      </div>

      {/* 30-day chart + Recent Sales */}
      <div className="th-mid-row">
        <MonthlyChart shopId={shopId} />
        <RecentSales shopId={shopId} loading={loading} />
      </div>

      {/* Top Products + Status */}
      <div className="th-bottom-row">
        <TopItems shopId={shopId} />
        <StatusAlerts recapCount={recapCount} lowStockCount={lowStockCount} openARCount={data.open_receivables_count || 0} loading={loading} />
      </div>
    </div>
  )
}

export default DashboardPage
