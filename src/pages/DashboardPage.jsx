import '../pages_css/DashboardPage.css';
import React from 'react'
import { API_URL, apiFetch, SkeletonRows, getLocalTodayYYYYMMDD } from '../lib/config'
import KpiCard from '../components/KpiCard'
import { LineChart } from '@mui/x-charts/LineChart'
import { ThemeProvider, createTheme } from '@mui/material/styles'

const fmt = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtK = (n) => {
  const v = Number(n || 0)
  if (v >= 1_000_000) return '₱' + (v / 1_000_000).toFixed(2) + 'M'
  if (v >= 1_000)     return '₱' + (v / 1_000).toFixed(1) + 'k'
  return fmt(v)
}

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
      const offset = d.getTimezoneOffset()
      const dLocal = new Date(d.getTime() - (offset * 60 * 1000))
      days.push({ date: dLocal.toISOString().split('T')[0], isToday: i === 0 })
    }
    const start = days[0].date, end = days[29].date
    if (!shopId) return
    // NOTE: Month Sales KPI = calendar month (e.g. May 1-today).
    // This chart = rolling 30 days (e.g. Apr 16-May 16), so totals will differ.
    apiFetch(`${API_URL}/dashboard-revenue-trend/${shopId}?startDate=${start}&endDate=${end}`)
      .then(r => r.json())
      .then(d => {
        const totals = {}
        if (Array.isArray(d)) {
          d.forEach(row => {
            if (row.date) totals[row.date] = row.revenue || 0
          })
        }
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

  const [hoveredIndex, setHoveredIndex] = React.useState(null)
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 })
  const svgRef = React.useRef(null)
  const containerRef = React.useRef(null)
  const [width, setWidth] = React.useState(1000)

  React.useEffect(() => {
    if (!containerRef.current) return
    const handleResize = () => {
      setWidth(containerRef.current.getBoundingClientRect().width || 1000)
    }
    handleResize()
    const observer = new ResizeObserver(handleResize)
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Theme-responsive tokens
  const lineColor = isDark ? '#38bdf8' : '#0284c7'
  const legendColor = isDark ? '#64748b' : 'var(--th-text-dim)'
  const gridStroke = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'

  const maxRevenue = Math.max(...chartData.map(d => d.revenue || 0), 0)
  const yAxisMax = maxRevenue === 0 ? 10000 : Math.ceil(maxRevenue / 10000) * 10000 + 10000

  // Standard coordinate space with dynamic width
  const viewBoxWidth = width
  const viewBoxHeight = 280
  const leftMargin = 65 // tight flush left margin for maximum width
  const rightMargin = 15 // tight flush right margin for maximum width
  const topMargin = 30
  const bottomMargin = 45
  const plotWidth = viewBoxWidth - leftMargin - rightMargin
  const plotHeight = viewBoxHeight - topMargin - bottomMargin

  // Map data to viewBox coordinates
  const points = chartData.map((d, i) => {
    const x = leftMargin + (i / (chartData.length - 1)) * plotWidth
    const y = viewBoxHeight - bottomMargin - ((d.revenue || 0) / yAxisMax) * plotHeight
    return { x, y, date: d.date, value: d.revenue, isToday: d.isToday, isPeak: d.isPeak }
  })

  // Calculate cubic bezier spline curve
  const bezierPath = (() => {
    if (points.length === 0) return ''
    let d = `M ${points[0].x} ${points[0].y}`
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i]
      const p1 = points[i + 1]
      const cpX1 = p0.x + (p1.x - p0.x) / 3
      const cpY1 = p0.y
      const cpX2 = p0.x + 2 * (p1.x - p0.x) / 3
      const cpY2 = p1.y
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`
    }
    return d
  })()

  const areaPath = bezierPath 
    ? `${bezierPath} L ${points[points.length - 1].x} ${viewBoxHeight - bottomMargin} L ${points[0].x} ${viewBoxHeight - bottomMargin} Z` 
    : ''

  const handleMouseMove = (e) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    // Map client coordinates to viewBox coordinates
    const clientX = e.clientX - rect.left
    const clientY = e.clientY - rect.top
    const xSvg = (clientX / rect.width) * viewBoxWidth
    const ySvg = (clientY / rect.height) * viewBoxHeight

    // Find closest x index
    let closestIdx = 0
    let minDiff = Infinity
    points.forEach((p, idx) => {
      const diff = Math.abs(p.x - xSvg)
      if (diff < minDiff) {
        minDiff = diff
        closestIdx = idx
      }
    })

    const activePt = points[closestIdx]
    const xPercent = (activePt.x / viewBoxWidth) * 100
    const yPercent = (activePt.y / viewBoxHeight) * 100

    setHoveredIndex(closestIdx)
    setMousePos({ x: xPercent, y: yPercent })
  }

  const handleMouseLeave = () => {
    setHoveredIndex(null)
  }

  const formatXAxisDate = (dateStr) => {
    if (!dateStr) return ''
    return dateStr.slice(5).replace('-', '/')
  }

  const formatTooltipDate = (dateStr) => {
    if (!dateStr) return ''
    const parts = dateStr.split('-')
    if (parts.length !== 3) return dateStr
    const year = parts[0]
    const monthIdx = parseInt(parts[1], 10) - 1
    const day = parseInt(parts[2], 10)
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    return `${day} ${months[monthIdx]} ${year}`
  }

  // Adjust tick interval based on density (8 ticks across 30 days)
  const tickInterval = Math.max(1, Math.ceil(points.length / 8))
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map(p => yAxisMax * p)
  const activePoint = hoveredIndex !== null ? points[hoveredIndex] : null

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
      <div 
        ref={containerRef}
        className="th-monthly-chart-wrap" 
        style={{ width: '100%', marginTop: 0, marginBottom: 0, position: 'relative', height: '280px', userSelect: 'none' }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchMove={(e) => {
            if (e.touches && e.touches[0]) {
              handleMouseMove(e.touches[0])
            }
          }}
          onTouchEnd={handleMouseLeave}
          style={{ overflow: 'visible', display: 'block' }}
        >
          <defs>
            {/* Stunning neon multi-stop gradient for the stroke */}
            <linearGradient id="strokeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="50%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>

            {/* Luxurious vertical area gradient */}
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(14, 165, 233, 0.22)" />
              <stop offset="50%" stopColor="rgba(129, 140, 248, 0.08)" />
              <stop offset="100%" stopColor="rgba(236, 72, 153, 0.0)" />
            </linearGradient>

            {/* Gorgeous glow filter */}
            <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="5" stdDeviation="7" floodColor="#818cf8" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Horizontal Grid lines */}
          {gridValues.map((val, idx) => {
            const y = viewBoxHeight - bottomMargin - (val / yAxisMax) * plotHeight
            return (
              <g key={idx}>
                <line
                  x1={leftMargin}
                  y1={y}
                  x2={viewBoxWidth - rightMargin}
                  y2={y}
                  stroke={gridStroke}
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
                <text
                  x={leftMargin - 18}
                  y={y + 4}
                  textAnchor="end"
                  fill="var(--th-text-dim)"
                  style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 600 }}
                >
                  {yFmt(val)}
                </text>
              </g>
            )
          })}

          {/* X-Axis Labels */}
          {points.map((p, idx) => {
            if (idx % tickInterval !== 0 && idx !== points.length - 1) return null
            return (
              <text
                key={idx}
                x={p.x}
                y={viewBoxHeight - bottomMargin + 25}
                textAnchor="middle"
                fill="var(--th-text-faint)"
                style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 600 }}
              >
                {formatXAxisDate(p.date)}
              </text>
            )
          })}

          {/* Shaded area */}
          {areaPath && (
            <path
              d={areaPath}
              fill="url(#areaGrad)"
            />
          )}

          {/* Curved Line */}
          {bezierPath && (
            <path
              d={bezierPath}
              fill="none"
              stroke="url(#strokeGrad)"
              strokeWidth="3.5"
              strokeLinecap="round"
              filter="url(#lineGlow)"
            />
          )}

          {/* Today Node & Peak Node */}
          {points.map((p, idx) => {
            if (p.isToday) {
              return (
                <circle
                  key={`today-${idx}`}
                  cx={p.x}
                  cy={p.y}
                  r="6"
                  fill="var(--th-orange)"
                  stroke="var(--th-bg-card)"
                  strokeWidth="2"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(249, 115, 22, 0.4))' }}
                />
              )
            }
            if (p.isPeak) {
              return (
                <circle
                  key={`peak-${idx}`}
                  cx={p.x}
                  cy={p.y}
                  r="6"
                  fill="none"
                  stroke="url(#strokeGrad)"
                  strokeWidth="2.5"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(129, 140, 248, 0.4))' }}
                />
              )
            }
            return null
          })}

          {/* Hover interactive helpers */}
          {activePoint && (
            <g>
              <line
                x1={activePoint.x}
                y1={topMargin}
                x2={activePoint.x}
                y2={viewBoxHeight - bottomMargin}
                stroke="rgba(129, 140, 248, 0.35)"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="10"
                fill="rgba(129, 140, 248, 0.25)"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="5"
                fill="#ffffff"
                stroke="#818cf8"
                strokeWidth="2.5"
              />
            </g>
          )}
        </svg>

        {/* Floating glassmorphic tooltip card */}
        {activePoint && (
          <div
            style={{
              position: 'absolute',
              left: `${mousePos.x}%`,
              top: `${mousePos.y - 12}%`,
              transform: 'translate(-50%, -100%)',
              background: 'var(--th-bg-card)',
              border: '1px solid var(--th-border-strong)',
              borderRadius: '12px',
              padding: '12px 16px',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
              minWidth: '160px',
              pointerEvents: 'none',
              zIndex: 999,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              transition: 'left 0.08s ease-out, top 0.08s ease-out'
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--th-text-dim)', fontWeight: 500 }}>
              {formatTooltipDate(activePoint.date)}
            </span>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: '20px', color: 'var(--th-text-heading)' }}>
              {fmt(activePoint.value)}
            </span>
            <div style={{
              fontSize: '10px',
              color: 'var(--th-text-faint)',
              marginTop: '4px',
              borderTop: '1px solid var(--th-border)',
              paddingTop: '6px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Daily Revenue
            </div>
          </div>
        )}
      </div>

      <style>{`
        .th-monthly-chart-wrap {
          height: 280px;
        }
        @media (max-width: 640px) {
          .th-monthly-chart-wrap {
            height: 280px; /* Taller height on mobile for perfect legibility, matching reports trend chart! */
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
  const [categories, setCategories] = React.useState([])
  const [selectedCategory, setSelectedCategory] = React.useState('ALL')

  React.useEffect(() => {
    if (!shopId) return
    apiFetch(`${API_URL}/dashboard-categories/${shopId}`)
      .then(r => r.json())
      .then(d => setCategories(Array.isArray(d) ? d : []))
      .catch(() => { })
  }, [shopId])

  React.useEffect(() => {
    if (!shopId) return
    apiFetch(`${API_URL}/dashboard-top-items/${shopId}?category=${selectedCategory}`)
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => { })
  }, [shopId, selectedCategory])


  const maxQty = Math.max(...items.map(i => i.total_qty), 1)

  return (
    <div className="th-panel">
      <div className="th-panel-title">
        <div className="th-panel-title-left">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 20 18 10" /><polyline points="12 20 12 4" /><polyline points="6 20 6 14" /></svg>
          Top Products
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <select
            className="th-top-cat-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="ALL">ALL CATEGORIES</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <span className="th-panel-badge">This Month</span>
        </div>

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

/* ── Goals Widget (manager/owner only) ── */
function paceStatus(on_pace, pace_pct) {
  if (on_pace == null) return null
  if (on_pace) return 'on-track'
  return (pace_pct != null && pace_pct >= 10) ? 'at-risk' : 'behind'
}

function DashGoalBar({ label, actual, target, on_pace, pace_pct }) {
  const status = paceStatus(on_pace, pace_pct)
  const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0
  const fill = status === 'on-track' ? 'var(--th-emerald)' : status === 'at-risk' ? 'var(--th-rose)' : 'var(--th-amber)'
  const chipLabel = status === 'on-track' ? '✓ On Track' : status === 'at-risk' ? 'At Risk' : 'Behind'
  const chipCls = status === 'on-track' ? 'dg-chip dg-chip--green' : status === 'at-risk' ? 'dg-chip dg-chip--red' : 'dg-chip dg-chip--amber'
  return (
    <div className="dg-bar">
      <div className="dg-bar-head">
        <span className="dg-bar-label">{label}</span>
        <span className={chipCls}>{chipLabel}</span>
      </div>
      <div className="dg-bar-track">
        <div className="dg-bar-fill" style={{ width: `${pct}%`, background: fill }} />
      </div>
      <div className="dg-bar-foot">
        <span className="dg-bar-actual">{fmtK(actual)}</span>
        <span className="dg-bar-target">/ {fmtK(target)} · {pct}%</span>
      </div>
    </div>
  )
}

function GoalsMiniCard({ label, data }) {
  const hasRevGoal = data?.revenue_target != null
  const hasPrfGoal = data?.profit_target != null
  if (!hasRevGoal && !hasPrfGoal) {
    return (
      <div className="dg-card">
        <div className="dg-card-label">{label}</div>
        <div className="dg-card-unset">No goals set</div>
      </div>
    )
  }
  return (
    <div className="dg-card">
      <div className="dg-card-label-row">
        <span className="dg-card-label">{label}</span>
        {data?.days_remaining != null && <span className="dg-days">{data.days_remaining}d left</span>}
      </div>
      {hasRevGoal && (
        <DashGoalBar label="Gross Sales" actual={data.actual_revenue} target={data.revenue_target} on_pace={data.revenue_on_pace} pace_pct={data.revenue_pace_pct} />
      )}
      {hasPrfGoal && (
        <DashGoalBar label="Net Profit" actual={data.actual_profit} target={data.profit_target} on_pace={data.profit_on_pace} pace_pct={data.profit_pace_pct} />
      )}
    </div>
  )
}

function GoalsWidget({ shopId }) {
  const [progress, setProgress] = React.useState(null)
  React.useEffect(() => {
    if (!shopId) return
    apiFetch(`${API_URL}/goals-progress/${shopId}`).then(r => r.json()).then(setProgress).catch(() => {})
  }, [shopId])

  if (!progress) return null
  const { monthly, quarterly, annual } = progress
  const anyGoal = [monthly, quarterly, annual].some(p => p?.revenue_target != null || p?.profit_target != null)
  if (!anyGoal) return null

  return (
    <>
      <div className="th-section-label">Revenue Goals</div>
      <div className="dg-grid">
        <GoalsMiniCard label="This Month"   data={monthly} />
        <GoalsMiniCard label="This Quarter" data={quarterly} />
        <GoalsMiniCard label="This Year"    data={annual} />
      </div>
    </>
  )
}

/* ── Main ── */
function DashboardPage({ shopId, shopName, businessDate, userPower = 0 }) {
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

    const effectiveDate = businessDate || getLocalTodayYYYYMMDD()
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
      <div className="th-kpi-grid3">
        <KpiCard label="Today's Sales" value={fmtK(data.today_sales || 0)} accent="orange"
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
      <div className="th-kpi-grid3">
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
      <div className="th-kpi-grid3">
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

      {/* Revenue Goals (manager/owner only) */}
      {userPower >= 60 && <GoalsWidget shopId={shopId} />}

      {/* Top Products + Status */}
      <div className="th-bottom-row">
        <TopItems shopId={shopId} />
        <StatusAlerts recapCount={recapCount} lowStockCount={lowStockCount} openARCount={data.open_receivables_count || 0} loading={loading} />
      </div>
    </div>
  )
}

export default DashboardPage
