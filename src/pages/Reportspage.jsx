import React, { useState, useEffect } from 'react'
import { API_URL, apiFetch, SkeletonRows, currency, compactCurrency } from '../lib/config'
import KpiCard from '../components/KpiCard'
import DataTable from '../components/DataTable'
import FilterHeader from '../components/FilterHeader'
import { ChartThemeProvider, RevenueDonutChart, useChartTheme, ChartTooltip } from '../components/ChartWrapper'

// Custom Components
import Modal from '../components/Modal'

// MUI Components
import { Box, Typography, Button, Divider, Paper } from '@mui/material'
import { ThemeProvider, createTheme } from '@mui/material/styles'

// MUI X Charts
import { LineChart } from '@mui/x-charts/LineChart'
import { BarChart } from '@mui/x-charts/BarChart'
import { PieChart } from '@mui/x-charts/PieChart'

const fmt = n => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtK = n => {
  const v = Number(n || 0)
  if (v >= 1000000) return '₱' + (v / 1000000).toFixed(2) + 'M'
  if (v >= 1000) return '₱' + (v / 1000).toFixed(1) + 'k'
  return fmt(v)
}

function pctClass(p) {
  const n = parseFloat(p)
  if (n >= 30) return 'good'
  if (n >= 15) return 'warn'
  if (n >= 0) return 'neutral'
  return 'bad'
}

function presets() {
  const today = new Date()
  const month = today.getMonth() // 0-indexed (0-11)
  const fmtD = d => d.toISOString().split('T')[0]
  const ago = n => { const d = new Date(today); d.setDate(d.getDate() - n); return fmtD(d) }

  const startOf = (unit) => {
    const d = new Date(today)
    if (unit === 'year') { d.setMonth(0, 1); return fmtD(d) }
    if (unit === 'quarter') { d.setMonth(Math.floor(month / 3) * 3, 1); return fmtD(d) }
    if (unit === 'half') { d.setMonth(month < 6 ? 0 : 6, 1); return fmtD(d) }
  }

  const qtrNames = ["1st Qtr", "2nd Qtr", "3rd Qtr", "4th Qtr"]
  const currentQtrName = qtrNames[Math.floor(month / 3)]
  const currentHalfName = month < 6 ? "1st Half" : "2nd Half"

  return [
    { label: 'Today', start: fmtD(today), end: fmtD(today) },
    { label: '7 Days', start: ago(6), end: fmtD(today) },
    { label: '30 Days', start: ago(29), end: fmtD(today) },
    { label: currentQtrName, start: startOf('quarter'), end: fmtD(today) },
    { label: currentHalfName, start: startOf('half'), end: fmtD(today) },
    { label: 'This Yr', start: startOf('year'), end: fmtD(today) },
  ]
}

/* ── Shared Chart Components ── */

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
      <div className="tooltip-date">{date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</div>
      <div className="tooltip-value">{fmt(val)}</div>
      <div className="tooltip-footer">
        <span className="tooltip-label">Daily Revenue</span>
        {pct !== null && (
          <span className={`tooltip-badge ${isUp ? '' : 'down'}`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isUp ? 'none' : 'rotate(180deg)' }}>
              <path d="M7 17L17 7M17 7H7M17 7V17" />
            </svg>
            {isUp ? '+' : ''}{pct}%
          </span>
        )}
      </div>
    </div>
  )
}

function Sparkline({ data, color = "#0891B2" }) {
  const [isDark, setIsDark] = React.useState(() => document.documentElement.getAttribute('data-theme') === 'dark')

  React.useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
        }
      })
    })
    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [])

  const muiTheme = React.useMemo(() => createTheme({
    palette: { mode: isDark ? 'dark' : 'light' },
    typography: { fontFamily: 'var(--font-body)' }
  }), [isDark])

  const lineColor = isDark ? '#38bdf8' : '#0284c7'
  const gridStroke = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'
  const lineGlow = isDark
    ? 'drop-shadow(0px 0px 8px rgba(56,189,248,0.65)) drop-shadow(0px 2px 14px rgba(56,189,248,0.3))'
    : 'drop-shadow(0px 0px 5px rgba(2,132,199,0.4)) drop-shadow(0px 2px 8px rgba(2,132,199,0.2))'

  if (!data || data.length < 2) return <div className="pm-empty">Not enough data</div>

  const maxRevenue = Math.max(...data.map(d => d.value || 0), 0)
  const yAxisMax = React.useMemo(() => {
    if (maxRevenue === 0) return 10000
    return (Math.ceil(maxRevenue / 10000) * 10000) + 10000
  }, [maxRevenue])

  return (
    <div style={{ width: '100%', height: 'max(180px, 35vh)', marginTop: '16px', marginBottom: '-0.8rem' }}>
      <ThemeProvider theme={muiTheme}>
        <LineChart
          dataset={data}
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
            valueFormatter: (v) => fmtK(v),
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
            dataKey: 'value',
            area: false,
            color: lineColor,
            showMark: false,
            valueFormatter: (v) => fmt(v),
            curve: 'natural',
            xAxisData: data.map(d => d.date)
          }]}
          grid={{ horizontal: true }}
          sx={{
            '& .MuiChartsAxis-line': { stroke: 'transparent' },
            '& .MuiChartsAxis-tick': { stroke: 'transparent' },
            '& .MuiChartsGrid-line': { stroke: gridStroke, strokeDasharray: '4 4' },
            '& .MuiChartsAxis-left .MuiChartsAxis-tickLabel': {
              transform: 'translateX(-6px)'
            },
            '& .MuiChartsAxis-bottom .MuiChartsAxis-tickLabel': {
              display: 'none'
            },
            '.MuiLineElement-root': {
              strokeWidth: 2.5,
              filter: lineGlow,
            }
          }}
          margin={{ top: 10, right: 20, left: 35, bottom: 10 }}
          slotProps={{
            legend: { hidden: true },
            tooltip: { content: (props) => <CustomTooltip {...props} /> }
          }}
        />
      </ThemeProvider>
    </div>
  )
}

function RptBarChart({ items, color = "var(--th-emerald)" }) {
  if (!items || items.length === 0) return <div className="pm-empty">No data</div>

  return (
    <div style={{ width: '100%', height: '260px' }}>
      <BarChart
        dataset={items}
        xAxis={[{
          scaleType: 'band',
          dataKey: 'label',
          tickLabelStyle: { fontSize: 10, fill: 'var(--th-text-faint)' }
        }]}
        yAxis={[{
          valueFormatter: (v) => fmtK(v),
          tickLabelStyle: { fontSize: 10, fill: 'var(--th-text-faint)' }
        }]}
        series={[{
          dataKey: 'value',
          color: color,
          valueFormatter: (v) => fmt(v)
        }]}
        margin={{ top: 20, right: 10, left: 60, bottom: 40 }}
        slotProps={{
          legend: { hidden: true }
        }}
        borderRadius={4}
      />
    </div>
  )
}


/* ── Section Components ── */

function SectionDailyActivity({ shopId, startDate, endDate, setStartDate, setEndDate, activePreset, applyPreset, isOpen }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filterMode, setFilterMode] = useState('ALL')
  const [page, setPage] = useState(1)
  const pageSize = 10

  // ── Close Day Logic ──
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [isClosed, setIsClosed] = useState(false)
  const [userRole, setUserRole] = useState('')
  const [userPower, setUserPower] = useState(0)

  useEffect(() => {
    setUserRole(localStorage.getItem('th-role') || 'staff')
    setUserPower(parseInt(localStorage.getItem('th-user-power') || '0'))
  }, [])

  const canClose = userPower >= 80 || userRole?.includes('manager') || userRole === 'admin' || userRole === 'owner'

  async function handleCloseDay() {
    setIsClosing(true)
    try {
      const r = await apiFetch(`${API_URL}/shops/${shopId}/close-day`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closed_by: localStorage.getItem('th-user') || 'USER' })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to close day')
      setIsClosed(true)
      setShowCloseModal(false)
      // Refresh to show "Next Day Mode"
      window.location.reload()
    } catch (err) {
      alert(err.message)
    }
    setIsClosing(false)
  }
  // ──────────────────────

  useEffect(() => {
    setPage(1)
  }, [filterMode, shopId, endDate])

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    setError(null)
    const date = endDate

    // Check if shop is already closed for this date
    apiFetch(`${API_URL}/shops/${shopId}/business-date`)
      .then(r => r.json())
      .then(d => {
        if (d.business_date === date && d.is_closed) setIsClosed(true)
      })

    apiFetch(`${API_URL}/reports/daily-activity/${shopId}?date=${date}`)
      .then(r => r.json())
      .then(res => {
        if (!active) return
        if (res.error) {
          setError(res.error)
        } else {
          setData(res)
        }
        setLoading(false)
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "Failed to fetch report")
          setLoading(false)
        }
      })
    return () => { active = false }
  }, [shopId, endDate, isOpen])

  if (loading) return <div className="p-8 text-center text-gray-400 font-bold animate-pulse">Generating Daily Report...</div>
  if (error) return (
    <div className="p-8 text-center bg-red-950/20 border border-red-900 rounded-xl text-red-400">
      <div className="text-2xl font-bold mb-4">⚠️ Report Error</div>
      <div>{error}</div>
      <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-900/50 hover:bg-red-800 text-white rounded-lg transition-colors">Retry</button>
    </div>
  )
  if (!data) return null

  const { kpis, paymentSummary, transactions } = data

  const filteredTransactions = transactions.filter(t => {
    if (filterMode === 'ALL') return true
    const m = (t.paymentMethod || '').replace('BANK_', '')
    return m === filterMode
  })

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize))
  const paginatedTransactions = filteredTransactions.slice((page - 1) * pageSize, page * pageSize)

  const getMethodTotal = (m) => {
    return paymentSummary.filter(p => p.method === m || p.method === `BANK_${m}`).reduce((sum, p) => sum + p.total, 0)
  }

  const cashOnHand = getMethodTotal('CASH')
  const gcashTotal = getMethodTotal('GCASH')
  const bpiTotal = getMethodTotal('BPI')
  const bdoTotal = getMethodTotal('BDO')
  const cardTotal = getMethodTotal('CARD')
  const digitalTotal = getMethodTotal('DIGITAL')
  const creditTotal = getMethodTotal('CREDIT')

  const typeColors = {
    SALE: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    SERVICE: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
    EXPENSE: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    PURCHASE: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    COMMISSION: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    MANUAL_IN: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
    MANUAL_OUT: 'bg-red-500/10 text-red-500 border-red-500/20'
  }

  const txnCols = [
    { key: 'timestamp', label: 'Time', width: '80px', render: t => new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    { key: 'type', label: 'Type', width: '100px', align: 'center', render: t => <span className={`px-2 py-0.5 text-[0.6rem] font-black uppercase rounded border ${typeColors[t.type] || 'bg-gray-500/10 text-gray-500 border-gray-500/20'}`}>{t.type.replace('_', ' ')}</span> },
    { key: 'invoiceNumber', label: 'Ref/Invoice', width: '120px' },
    { key: 'customerName', label: 'Description', render: t => t.customerName || (t.type === 'SALE' || t.type === 'SERVICE' ? 'Walk-in' : 'General') },
    { key: 'paymentMethod', label: 'Method', align: 'center', render: t => <span className="px-2 py-0.5 text-[0.65rem] font-bold rounded bg-gray-500/10 border border-gray-500/20">{t.paymentMethod}</span> },
    {
      key: 'amount', label: 'Amount', align: 'right', render: t => {
        const isInflow = t.type === 'SALE' || t.type === 'SERVICE' || t.type === 'MANUAL_IN'
        return <span className={`font-bold ${isInflow ? 'text-emerald-500' : 'text-rose-500'}`}>{isInflow ? '+' : '-'}{currency(t.amount)}</span>
      }
    },
  ]

  const isToday = endDate === new Date().toISOString().split('T')[0]

  return (
    <div className="flex flex-col gap-2 p-0">
      {/* Tier 1: KPI Dashboard */}
      <div>
        <div className="flex justify-between items-center mb-3 border-b border-[var(--th-border)] pb-2">
          <h3 className="text-lg font-bold text-[var(--th-text-strong)] flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isClosed ? 'bg-orange-500' : 'bg-emerald-500 animate-pulse'}`} />
            Daily Report —
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setStartDate(e.target.value);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--th-text-strong)',
                fontFamily: 'inherit',
                fontWeight: 'bold',
                cursor: 'pointer',
                outline: 'none'
              }}
            />
            {isClosed && <span className="text-xs px-2 py-0.5 bg-orange-500/10 text-orange-400 rounded-full border border-orange-500/20 ml-2">CLOSED</span>}
          </h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Gross Sales" value={compactCurrency(kpis.grossSales)} accent="sky" sub={`Profit: ${compactCurrency(kpis.salesProfit)}`} />
          <KpiCard label="Gross Services" value={compactCurrency(kpis.grossServices)} accent="violet" sub={`Net: ${compactCurrency(kpis.serviceIncome)}`} />
          <KpiCard label="Expenses" value={compactCurrency(kpis.expenses)} accent="rose" />
          <KpiCard label="Purchases" value={compactCurrency(kpis.purchases)} accent="orange" />
          <KpiCard label="Commissions" value={compactCurrency(kpis.commissions)} accent="amber" />
          <KpiCard label="Net Profit" value={compactCurrency(kpis.netProfit)} accent="emerald" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tier 2: Payment Reconciliation */}
        <div className="lg:col-span-1 bg-[var(--th-bg-card)] border border-[var(--th-border)] rounded-xl overflow-hidden shadow-sm flex flex-col h-fit">
          <div className="px-5 py-3 bg-[var(--th-bg-card)] border-b border-[var(--th-border)] flex justify-between items-center opacity-90">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--th-text-faint)]">Payment Reconciliation</h3>
            <span className={`px-2 py-0.5 ${isClosed ? 'bg-orange-500/10 text-orange-400' : 'bg-emerald-500/10 text-emerald-400'} text-[0.6rem] font-black uppercase rounded tracking-widest border border-emerald-500/20`}>{isClosed ? 'Snaphot' : 'Live'}</span>
          </div>

          <div className="p-5 flex flex-col gap-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-[var(--th-text-faint)] text-xs uppercase">Cash on Hand</span>
                <span className="font-black text-lg text-emerald-500 font-mono">{currency(cashOnHand)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-semibold text-[var(--th-text-faint)] text-xs uppercase">Digital Total</span>
                <span className="font-black text-lg text-blue-500 font-mono">{currency(digitalTotal)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-semibold text-[var(--th-text-faint)] text-xs uppercase">Credit Sales</span>
                <span className="font-black text-lg text-amber-500 font-mono">{currency(creditTotal)}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--th-border)] flex justify-between items-center">
              <span className="font-bold text-[var(--th-text-faint)] text-sm uppercase">Total Daily Inflow</span>
              <span className="font-black text-xl text-[var(--th-text-strong)] font-mono">{currency(cashOnHand + digitalTotal + creditTotal)}</span>
            </div>

            {/* Detailed Breakdown Grid */}
            <div className="mt-2 pt-4 border-t border-[var(--th-border)] grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { method: 'CASH', total: cashOnHand },
                { method: 'GCASH', total: gcashTotal },
                { method: 'BPI', total: bpiTotal },
                { method: 'BDO', total: bdoTotal },
                { method: 'CARD', total: cardTotal },
                { method: 'CREDIT', total: creditTotal }
              ].map(p => (
                <div key={p.method} className="bg-black/[0.03] dark:bg-white/[0.03] border border-[var(--th-border)] rounded-lg p-2 flex flex-col items-center justify-center transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.05]">
                  <span className="text-[0.6rem] text-[var(--th-text-faint)] font-bold uppercase tracking-tight mb-0.5">{p.method}</span>
                  <span className="text-sm font-black text-[var(--th-text-strong)] font-mono">{currency(p.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tier 3: Daily Activity Feed */}
        <div className="lg:col-span-2 bg-[var(--th-bg-card)] border border-[var(--th-border)] rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="px-5 py-3 bg-[var(--th-bg-card)] border-b border-[var(--th-border)] flex justify-between items-center flex-wrap gap-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--th-text-faint)]">Daily Activity Feed</h3>
            <div className="flex bg-[var(--th-bg-card)] rounded p-1 border border-[var(--th-border)] flex-wrap">
              {['ALL', 'CASH', 'GCASH', 'BPI', 'BDO', 'CARD', 'CREDIT'].map(m => (
                <button
                  key={m}
                  onClick={() => setFilterMode(m)}
                  className={`px-3 py-1 text-[0.65rem] font-black rounded transition-all tracking-widest ${filterMode === m ? 'bg-emerald-600 text-white shadow-sm' : 'text-[var(--th-text-faint)] hover:text-[var(--th-text-strong)]'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <DataTable
            columns={txnCols}
            rows={paginatedTransactions}
            rowKey={(row) => `${row.type}-${row.id}`}
            minWidth={500}
            mobileLayout="scroll"
            emptyTitle="No Activity"
            emptyMessage={`No ${filterMode === 'ALL' ? '' : filterMode} transactions found for today.`}
            style={{ border: 'none', background: 'transparent' }}
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      </div>

      {/* Close Day Modal */}
      <Modal
        isOpen={showCloseModal}
        onClose={() => !isClosing && setShowCloseModal(false)}
        title="Close Business Day?"
        maxWidth="500px"
        footer={
          <div className="flex gap-3 w-full">
            <button
              onClick={() => setShowCloseModal(false)}
              disabled={isClosing}
              className="flex-1 px-4 py-3 bg-[var(--th-bg-card-alt)] hover:bg-gray-800 text-gray-400 font-bold rounded-xl border border-[var(--th-border)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCloseDay}
              disabled={isClosing}
              style={{ flex: 2 }}
              className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-lg shadow-orange-900/20 transition-all flex items-center justify-center gap-2"
            >
              {isClosing ? (
                <><svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Processing...</>
              ) : 'Confirm & Close'}
            </button>
          </div>
        }
      >
        <div className="p-2 space-y-4">
          <p className="text-sm text-gray-400">Confirming will finalize the daily record for {endDate}.</p>

          <div className="p-4 bg-black/20 rounded-xl border border-[var(--th-border)]">
            <div className="text-xs text-gray-500 uppercase font-bold mb-2">Reconciliation Summary</div>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-2xl font-black text-white">{currency(cashOnHand)}</div>
                <div className="text-[0.65rem] text-emerald-500 font-bold uppercase">Cash on Hand</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-white">{currency(digitalTotal)}</div>
                <div className="text-[0.65rem] text-blue-500 font-bold uppercase">Digital Total</div>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-400 bg-orange-500/5 p-4 rounded-xl border border-orange-500/20 leading-relaxed">
            <strong className="text-orange-400 block mb-1">Warning: Final Action</strong>
            This will trigger an immediate system backup and lock today's reports. New transactions will be recorded for tomorrow.
          </div>
        </div>
      </Modal>
    </div>
  )
}

function SectionSales({ shopId, startDate, endDate, setStartDate, setEndDate, activePreset, applyPreset, isOpen }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    const qs = `startDate=${startDate}&endDate=${endDate}`
    apiFetch(`${API_URL}/sales/${shopId}?${qs}&perPage=500`).then(r => r.json())
      .then((salesRes) => {
        if (!active) return
        const sales = salesRes.data || []
        const dailyMap = {}
        sales.forEach(s => {
          const d = s.sale_datetime.split('T')[0]
          dailyMap[d] = (dailyMap[d] || 0) + s.total_amount
        })
        const dailyChart = Object.entries(dailyMap).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ date: k, value: v }))
        const dowMap = { 'Sun': 0, 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0 }
        const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        sales.forEach(s => {
          const dow = dowNames[new Date(s.sale_datetime).getDay()]
          dowMap[dow] += s.total_amount
        })
        const dowChart = dowNames.map(d => ({ label: d, value: dowMap[d] }))
        const totalRevenue = sales.reduce((acc, s) => acc + s.total_amount, 0)
        setData({
          revenue: totalRevenue,
          txnCount: sales.length,
          avgSale: sales.length ? totalRevenue / sales.length : 0,
          dailyChart,
          dowChart
        })
        setLoading(false)
      }).catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [shopId, startDate, endDate, isOpen])

  if (loading || !data) return <div className="pm-loading">Loading Sales Data...</div>

  return (
    <>
      <div className="pm-section">Overview — {startDate} to {endDate}</div>

      <div className="rpt-adaptive-stack">
        <div>
          <FilterHeader leftComponent={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', flexWrap: 'nowrap', width: '100%', height: '100%' }}>
              <span style={{ fontSize: 'inherit', fontWeight: 600, color: 'var(--th-text-muted)', whiteSpace: 'nowrap' }}>From</span>
              <input className="fh-date" type="date" value={startDate} onChange={e => { setStartDate(e.target.value); applyPreset({ label: null }) }} style={{ flex: 1, minWidth: '120px' }} />
              <span style={{ fontSize: 'inherit', fontWeight: 600, color: 'var(--th-text-muted)', whiteSpace: 'nowrap' }}>To</span>
              <input className="fh-date" type="date" value={endDate} onChange={e => { setEndDate(e.target.value); applyPreset({ label: null }) }} style={{ flex: 1, minWidth: '120px' }} />
            </div>
          }
            filters={presets().map(p => ({ label: p.label, value: p.label, active: activePreset === p.label }))}
            onFilterChange={(label) => {
              const p = presets().find(x => x.label === label);
              if (p) applyPreset(p);
            }}
            accentColor="var(--th-emerald)"
          />
        </div>
        <div className="rpt-kpi-grid">
          <KpiCard label="Total Revenue" value={fmtK(data.revenue)} accent="sky" />
          <KpiCard label="Transactions" value={data.txnCount} accent="violet" />
          <KpiCard label="Average Sale" value={fmtK(data.avgSale)} accent="emerald" />
        </div>
      </div>

      <div className="pm-three-col" >
        <div className="pm-card">
          <div className="pm-card-head">Daily Revenue Trend</div>
          <Sparkline data={data.dailyChart} color="var(--th-sky)" />
        </div>
        <div className="pm-card">
          <div className="pm-card-head">Revenue by Day of Week</div>
          <RevenueDonutChart items={data.dowChart} valueFormatter={fmtK} />
        </div>
      </div>
    </>
  )
}

function SectionPayment({ shopId, startDate, endDate, isOpen }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    const qs = `startDate=${startDate}&endDate=${endDate}`
    apiFetch(`${API_URL}/sales/${shopId}?${qs}&perPage=500`)
      .then(r => r.json())
      .then(res => {
        if (!active) return
        const sales = res.data || []
        const pMap = { 'CASH': 0, 'GCASH': 0, 'CARD': 0, 'CREDIT': 0 }
        sales.forEach(s => {
          const pm = (s.payment_method || 'CASH').toUpperCase()
          if (pMap[pm] !== undefined) pMap[pm] += s.total_amount
          else pMap['CASH'] += s.total_amount
        })
        setData([
          { label: 'CASH', value: pMap['CASH'], color: '#10b981' },
          { label: 'GCASH', value: pMap['GCASH'], color: '#3b82f6' },
          { label: 'CARD', value: pMap['CARD'], color: '#8b5cf6' },
          { label: 'CREDIT', value: pMap['CREDIT'], color: '#f59e0b' },
        ])
        setLoading(false)
      })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [shopId, startDate, endDate, isOpen])

  if (loading || (!data.length && loading)) return <div className="pm-loading">Loading...</div>

  return (
    <div className="pm-card" style={{ flex: 1, minHeight: '340px', display: 'flex', flexDirection: 'column' }}>
      <div className="pm-card-head">Revenue by Payment Method</div>
      <RevenueDonutChart
        items={data}
        valueFormatter={fmtK}
        palette={['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b']}
      />
    </div>
  )
}

function CategoryPie({ items }) {
  if (!items || items.length === 0) return <div className="pm-empty">No data</div>
  const COLORS = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f87171', '#6366f1', '#f472b6', '#2dd4bf', '#a78bfa']
  return (
    <RevenueDonutChart
      items={items}
      valueFormatter={fmtK}
      palette={COLORS}
    />
  )
}

function SectionCategories({ shopId, startDate, endDate, isOpen }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    const qs = `startDate=${startDate}&endDate=${endDate}`
    apiFetch(`${API_URL}/profits/by-category/${shopId}?${qs}`)
      .then(r => r.json())
      .then(res => {
        if (!active) return
        if (Array.isArray(res)) {
          const mapped = res
            .map(c => ({ label: c.category || 'Unknown', value: parseFloat(c.revenue || 0) }))
            .filter(c => c.value > 0)
            .sort((a, b) => b.value - a.value)
          setData(mapped)
        }
        setLoading(false)
      })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [shopId, startDate, endDate, isOpen])
  if (loading || (!data.length && loading)) return <div className="pm-loading">Loading Categories...</div>
  return (
    <div className="pm-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', minHeight: '380px' }}>
      <div className="pm-card-head">Revenue by Category</div>
      <div style={{ width: '100%', height: '300px' }}>
        <CategoryPie items={data} />
      </div>
    </div>
  )
}

function SectionTopItems({ shopId, startDate, endDate, isOpen }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    const qs = `startDate=${startDate}&endDate=${endDate}`
    apiFetch(`${API_URL}/profits/top-items/${shopId}?${qs}&limit=10`).then(r => r.json())
      .then(res => {
        if (!active) return
        if (Array.isArray(res)) setData(res)
        setLoading(false)
      })
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
          <div className="pm-item-meta">{i.brand} &middot; {i.category}</div>
          <div className="pm-bar-track">
            <div className="pm-bar-fill" style={{ background: 'var(--th-emerald)', width: `${Math.max(2, (i.net_profit / maxProfit) * 100)}%` }} />
          </div>
        </div>
      )
    },
    { key: 'total_qty', label: 'Qty Sold', align: 'center', render: i => <span style={{ fontWeight: 700 }}>{i.total_qty}</span> },
    { key: 'revenue', label: 'Revenue', align: 'right', render: i => <div className="pm-money sky">{fmtK(i.revenue)}</div> },
    { key: 'net_profit', label: 'Net Profit', align: 'right', render: i => <div className="pm-money emerald">{fmtK(i.net_profit)}</div> },
    { key: 'margin_pct', label: 'Margin', align: 'right', render: i => <span className={`pm-pct-pill ${pctClass(i.margin_pct)}`}>{i.margin_pct}%</span> },
  ]
  return (
    <div className="pm-card">
      <div className="pm-card-head">Top Items by Performance</div>
      <DataTable columns={columns} rows={data} rowKey="item_or_service_id" loading={loading} skeletonRows={5} />
    </div>
  )
}

function SectionBusinessHealth({ shopId, startDate, endDate, isOpen }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    const qs = `start=${startDate}&end=${endDate}`
    apiFetch(`${API_URL}/financial-health/${shopId}?${qs}`)
      .then(r => r.json())
      .then(res => {
        if (!active) return
        if (!res.error) setData(res)
        setLoading(false)
      })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [shopId, startDate, endDate, isOpen])
  if (loading || !data) return <div className="pm-loading">Digesting Financial Data...</div>
  const { net_position: net, sales_revenue: rev, receivables_collected: coll, payables_created: pay, expenses_total: exp } = data
  const isGreen = net >= 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{
        background: isGreen ? 'color-mix(in srgb, var(--th-emerald) 8%, var(--th-bg-card))' : 'color-mix(in srgb, var(--th-rose) 8%, var(--th-bg-card))',
        border: `1px solid ${isGreen ? 'var(--th-emerald)' : 'var(--th-rose)'}`,
        borderRadius: '16px', padding: '1.5rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexFlow: 'wrap', gap: '2rem', marginBottom: '.5rem'
      }}>
        <div style={{ flex: 1, minWidth: '250px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: isGreen ? 'var(--th-emerald)' : 'var(--th-rose)', color: '#fff', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem' }}>
            {isGreen ? '● Business is in the Green' : '● Action Required: Cash Deficit'}
          </div>
          <div style={{ fontSize: '3rem', fontWeight: 900, color: isGreen ? 'var(--th-emerald)' : 'var(--th-rose)', lineHeight: 1, fontFamily: 'Barlow Condensed, sans-serif' }}>
            {net < 0 ? '−' : '+'}{fmtK(Math.abs(net))}
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--th-text-faint)', fontWeight: 600, marginTop: '0.5rem' }}>Net Business Position for this period</div>
        </div>
        <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--th-text-faint)', fontWeight: 600 }}>Total Money In (Revenue + Collections)</span>
            <span style={{ color: 'var(--th-emerald)', fontWeight: 800 }}>+{fmtK(rev + coll)}</span>
          </div>
          <div className="pm-bar-track" style={{ marginTop: 0, height: 8 }}>
            <div className="pm-bar-fill" style={{ height: '100%', background: 'var(--th-emerald)', width: `${Math.min(100, ((rev + coll) / Math.max(rev + coll + pay + exp, 1)) * 100)}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            <span style={{ color: 'var(--th-text-faint)', fontWeight: 600 }}>Total Money Out (Payables + Expenses)</span>
            <span style={{ color: 'var(--th-rose)', fontWeight: 800 }}>−{fmtK(pay + exp)}</span>
          </div>
          <div className="pm-bar-track" style={{ marginTop: 0, height: 8 }}>
            <div className="pm-bar-fill" style={{ height: '100%', background: 'var(--th-rose)', width: `${Math.min(100, ((pay + exp) / Math.max(rev + coll + pay + exp, 1)) * 100)}%` }} />
          </div>
        </div>
      </div>
      <div className="rpt-kpi-grid">
        <KpiCard label="Receivables" value={fmtK(data.open_receivables)} accent="sky" sub={`${data.open_receivables_count} accounts`} />
        <KpiCard label="Payables" value={fmtK(data.open_payables)} accent="rose" sub={`${data.open_payables_count} bills`} />
        <KpiCard label="Collection Rate" value={`${data.collection_rate || 0}%`} accent="emerald" sub="Efficiency" />
        <KpiCard label="Overdue" value={fmtK(data.overdue_payables)} accent="amber" sub={`${data.overdue_payables_count} past due`} />
      </div>

      {/* Added: Upcoming Payables & Money Owed */}
      <div className="pm-three-col" style={{ marginTop: '0.5rem' }}>
        <div className="pm-card">
          <div className="pm-card-head">Upcoming Payables (Next 14 Days)</div>
          <div style={{ padding: '1rem' }}>
            {(!data.upcoming_payables || data.upcoming_payables.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--th-text-faint)', fontSize: '0.85rem' }}>
                No payables due in the next 14 days
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {data.upcoming_payables.map(p => {
                  const name = p.payable_type === 'SUPPLIER' ? (p.supplier_name || 'Supplier') : (p.payee_name || 'General');
                  return (
                    <div key={p.payable_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid var(--th-border)' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--th-text-faint)' }}>{p.description || '—'}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: 'var(--th-rose)' }}>{fmtK(p.balance_amount)}</div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--th-amber)' }}>Due: {p.due_date}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="pm-card" style={{ background: 'color-mix(in srgb, var(--th-sky) 5%, var(--th-bg-card))' }}>
          <div className="pm-card-head">Money Owed to You</div>
          <div style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--th-sky)', fontFamily: 'Barlow Condensed' }}>
              {fmtK(data.open_receivables)}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--th-text-faint)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '1rem' }}>
              {data.open_receivables_count} Open Accounts
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--th-text-muted)', lineHeight: 1.5 }}>
              These are pending collections from credit sales. Collecting these will immediately improve your net cash position.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionProfit({ shopId, startDate, endDate, isOpen }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    const qs = `startDate=${startDate}&endDate=${endDate}`
    apiFetch(`${API_URL}/profits/summary/${shopId}?${qs}`)
      .then(r => r.json())
      .then(res => {
        if (!active) return
        if (!res.error) setData(res)
        setLoading(false)
      })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [shopId, startDate, endDate, isOpen])
  if (loading || !data) return null
  return (
    <div className="pm-equation" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
      <div className="pm-eq-item">
        <div className="pm-eq-label">Gross Tire Profit</div>
        <div className="pm-eq-val" style={{ color: 'var(--th-violet)' }}>{fmtK(data.product_gross)}</div>
      </div>
      <div className="pm-eq-op">−</div>
      <div className="pm-eq-item">
        <div className="pm-eq-label">Commission</div>
        <div className="pm-eq-val" style={{ color: 'var(--th-rose)' }}>{fmtK(data.total_commission)}</div>
      </div>
      <div className="pm-eq-op">+</div>
      <div className="pm-eq-item">
        <div className="pm-eq-label">Service Margin</div>
        <div className="pm-eq-val" style={{ color: 'var(--th-sky)' }}>{fmtK(data.service_margin)}</div>
      </div>
      <div className="pm-eq-op">−</div>
      <div className="pm-eq-item">
        <div className="pm-eq-label">Materials</div>
        <div className="pm-eq-val" style={{ color: 'var(--th-amber)' }}>{fmtK(data.material_costs)}</div>
      </div>
      <div className="pm-eq-op">−</div>
      <div className="pm-eq-item">
        <div className="pm-eq-label">Expenses</div>
        <div className="pm-eq-val" style={{ color: 'var(--th-rose)' }}>{fmtK(data.total_expenses)}</div>
      </div>
      <div className="pm-eq-op">=</div>
      <div className="pm-eq-item pm-eq-result">
        <div className="pm-eq-label">Net Margin</div>
        <div className="pm-eq-val">{data.overall_margin_pct}%</div>
      </div>
    </div>
  )
}

function SectionStaff({ shopId, startDate, endDate, isOpen }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    const qs = `startDate=${startDate}&endDate=${endDate}`
    apiFetch(`${API_URL}/labor-summary/${shopId}?${qs}`)
      .then(r => r.json())
      .then(res => {
        if (!active) return
        if (Array.isArray(res)) setData(res)
        setLoading(false)
      })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [shopId, startDate, endDate, isOpen])
  if (loading) return <div className="pm-loading">Loading Staff Data...</div>
  if (!data.length) return <div className="pm-empty">No staff data for this period.</div>
  const maxGross = Math.max(...data.map(s => s.gross_earnings), 1)

  const totalServices = data.reduce((sum, s) => sum + s.service_count, 0)
  const totalCommission = data.reduce((sum, s) => sum + s.commission_total, 0)
  const topEarner = data.reduce((max, s) => s.gross_earnings > (max ? max.gross_earnings : 0) ? s : max, null)

  const columns = [
    {
      key: 'full_name', label: 'Staff Member', render: s => (
        <div>
          <div className="pm-item-name">{s.full_name}</div>
          <div className="pm-item-meta">{s.staff_code}</div>
          <div className="pm-bar-track">
            <div className="pm-bar-fill" style={{ background: 'var(--th-orange)', width: `${Math.max(2, (s.gross_earnings / maxGross) * 100)}%` }} />
          </div>
        </div>
      )
    },
    { key: 'service_count', label: 'Services', align: 'center' },
    { key: 'service_total', label: 'Service Rev', align: 'right', render: s => <div className="pm-money sky">{fmtK(s.service_total)}</div> },
    { key: 'commission_total', label: 'Commission', align: 'right', render: s => <div className="pm-money rose">{fmtK(s.commission_total)}</div> },
    { key: 'net_earnings', label: 'Net Earnings', align: 'right', render: s => <div className="pm-money emerald">{fmtK(s.net_earnings)}</div> },
  ]
  return (
    <div style={{ marginTop: 0, marginBottom: 0 }}>
      <div className="pm-section">Operations & Staff</div>
      <div className="rpt-kpi-grid">
        <KpiCard label="Total Services" value={totalServices} accent="sky" />
        <KpiCard label="Total Commissions" value={fmtK(totalCommission)} accent="rose" />
        <KpiCard label="Top Earner" value={topEarner ? topEarner.full_name : '—'} accent="emerald" sub={topEarner ? fmtK(topEarner.gross_earnings) : ''} />
      </div>
      <div className="card-ops pm-card">
        <div className="pm-card-head">Staff Performance Summary</div>
        <DataTable columns={columns} rows={data} rowKey="staff_id" />
      </div>
    </div>
  )
}

function SectionExpenses({ shopId, startDate, endDate, isOpen, children }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    const qs = `startDate=${startDate}&endDate=${endDate}`
    apiFetch(`${API_URL}/expenses-summary/${shopId}?${qs}`)
      .then(r => r.json())
      .then(res => {
        if (!active) return
        if (!res.error) setData(res)
        setLoading(false)
      })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [shopId, startDate, endDate, isOpen])
  if (loading || !data) return <div className="pm-loading">Loading Expenses...</div>
  const dailyTrend = (data.daily || []).map(d => ({ date: d.expense_date, value: d.total }))
  const topCategory = (data.by_category || [])[0]
  return (
    <div>
      <div className="pm-section">Expense Overview</div>
      <div className="th-kpi-row rpt-kpi-block" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
        <KpiCard label="Total Expenses" value={fmtK(data.total)} accent="rose" />
        <KpiCard label="Top Category" value={topCategory ? topCategory.category_name : '—'} accent="amber" sub={topCategory ? fmtK(topCategory.total) : ''} />
      </div>
      <div className={children ? "pm-three-col" : "pm-root"}>
        {children}
        <div className="pm-card" style={{ minHeight: '340px' }}>
          <div className="pm-card-head">Daily Expense Trend</div>
          <Sparkline data={dailyTrend} color="var(--th-rose)" />
        </div>
      </div>
    </div>
  )
}

function SectionReturns({ shopId, startDate, endDate, isOpen }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    const qs = `from=${startDate}&to=${endDate}`
    apiFetch(`${API_URL}/returns/${shopId}?${qs}`)
      .then(r => r.json())
      .then(res => {
        if (!active) return
        if (Array.isArray(res)) setData(res)
        setLoading(false)
      })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [shopId, startDate, endDate, isOpen])
  if (loading) return <div className="pm-loading">Loading Returns...</div>
  const custReturns = data.filter(r => r.return_type === 'CUSTOMER_RETURN').length
  const suppReturns = data.filter(r => r.return_type === 'SUPPLIER_RETURN').length
  const totalValue = data.reduce((sum, r) => sum + ((r.quantity || 0) * (r.unit_cost || 0)), 0)
  const rTypeMap = {}
  data.forEach(r => {
    const lbl = r.return_scenario || r.reason || 'Other'
    rTypeMap[lbl] = (rTypeMap[lbl] || 0) + 1
  })
  const rTypeChart = Object.entries(rTypeMap).map(([k, v]) => ({ label: k, value: v }))
  return (
    <div style={{ marginTop: 0, marginBottom: 0 }}>
      <div className="pm-section">Returns Management</div>
      <div className="rpt-kpi-grid">
        <KpiCard label="Customer Returns" value={custReturns} accent="rose" />
        <KpiCard label="Supplier Returns" value={suppReturns} accent="violet" />
        <KpiCard label="Est. Impact Value" value={fmtK(totalValue)} accent="amber" sub="Based on unit cost" />
      </div>
      <div className="card-ops pm-card">
        <div className="pm-card-head">Returns by Scenario / Reason</div>
        <RptBarChart items={rTypeChart} color="var(--th-rose)" />
      </div>
    </div>
  )
}

function SectionInventory({ shopId, startDate, endDate, setStartDate, setEndDate, activePreset, applyPreset, isOpen, children }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!isOpen) return
    let active = true
    setLoading(true)
    apiFetch(`${API_URL}/current-stock/${shopId}`)
      .then(r => r.json())
      .then(res => {
        if (!active) return
        if (Array.isArray(res)) setData(res)
        setLoading(false)
      })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [shopId, isOpen])
  if (loading) return <div className="pm-loading">Loading Inventory...</div>
  const totalItems = data.length
  const totalValue = data.reduce((sum, i) => sum + ((i.current_quantity || 0) * (i.unit_cost || 0)), 0)
  const lowStock = data.filter(i => (i.current_quantity || 0) > 0 && (i.current_quantity || 0) <= 5).length
  const outOfStock = data.filter(i => (i.current_quantity || 0) <= 0).length
  const topValue = [...data].sort((a, b) => ((b.current_quantity || 0) * (b.unit_cost || 0)) - ((a.current_quantity || 0) * (a.unit_cost || 0))).slice(0, 5)
  const chartData = topValue.map(i => ({
    name: i.item_name.split(' ').slice(0, 2).join(' '),
    fullName: i.item_name,
    value: (i.current_quantity || 0) * (i.unit_cost || 0)
  }))
  return (
    <div>
      <div className="pm-section">Inventory Status</div>

      <div className="rpt-adaptive-stack">
        <div>
          <FilterHeader leftComponent={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', flexWrap: 'nowrap', width: '100%', height: '100%' }}>
              <span style={{ fontSize: 'inherit', fontWeight: 600, color: 'var(--th-text-muted)', whiteSpace: 'nowrap' }}>From</span>
              <input className="fh-date" type="date" value={startDate} onChange={e => { setStartDate(e.target.value); applyPreset({ label: null }) }} style={{ flex: 1, minWidth: '120px' }} />
              <span style={{ fontSize: 'inherit', fontWeight: 600, color: 'var(--th-text-muted)', whiteSpace: 'nowrap' }}>To</span>
              <input className="fh-date" type="date" value={endDate} onChange={e => { setEndDate(e.target.value); applyPreset({ label: null }) }} style={{ flex: 1, minWidth: '120px' }} />
            </div>
          }
            filters={presets().map(p => ({ label: p.label, value: p.label, active: activePreset === p.label }))}
            onFilterChange={(label) => {
              const p = presets().find(x => x.label === label);
              if (p) applyPreset(p);
            }}
            accentColor="var(--th-emerald)"
          />
        </div>
        <div className="rpt-kpi-grid">
          <KpiCard label="Total Stock Value" value={fmtK(totalValue)} accent="sky" sub="Based on unit cost" />
          <KpiCard label="Active Items" value={totalItems} accent="violet" />
          <KpiCard label="Low Stock (≤5)" value={lowStock} accent="amber" />
          <KpiCard label="Out of Stock" value={outOfStock} accent="rose" />
        </div>
      </div>

      <div className="pm-three-col">
        <div className="pm-card" style={{ minHeight: '380px' }}>
          <div className="pm-card-head">Highest Value Inventory (Top 5)</div>
          <div style={{ width: '100%', height: '280px' }}>
            <BarChart
              dataset={chartData}
              yAxis={[{ scaleType: 'band', dataKey: 'name', tickLabelStyle: { fontSize: 10, fill: 'var(--th-text-faint)' } }]}
              xAxis={[{ valueFormatter: (v) => fmtK(v), tickLabelStyle: { fontSize: 10, fill: 'var(--th-text-faint)' } }]}
              series={[{ dataKey: 'value', color: '#38bdf8', valueFormatter: (v) => fmt(v) }]}
              layout="horizontal"
              margin={{ top: 10, right: 30, left: 100, bottom: 40 }}
              slotProps={{ legend: { hidden: true } }}
              borderRadius={4}
            />
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ── Main Page Component ── */

function ReportspageInner({ shopId }) {
  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
  const defaultStart = thirtyDaysAgo.toISOString().split('T')[0]

  const [startDate, setStartDate] = useState(() => localStorage.getItem('rpt_startDate') || defaultStart)
  const [endDate, setEndDate] = useState(() => localStorage.getItem('rpt_endDate') || today)
  const [activePreset, setActivePreset] = useState(() => localStorage.getItem('rpt_activePreset') || '30 Days')
  const [activeTab, setActiveTab] = useState(0)

  useEffect(() => {
    localStorage.setItem('rpt_startDate', startDate)
    localStorage.setItem('rpt_endDate', endDate)
    if (activePreset) localStorage.setItem('rpt_activePreset', activePreset)
    else localStorage.removeItem('rpt_activePreset')
  }, [startDate, endDate, activePreset])

  const TABS = [
    { id: 0, label: "Daily Activity", badge: "New" },
    { id: 1, label: "Sales Overview" },
    { id: 2, label: "Products & Inventory", badge: "Live" },
    { id: 3, label: "Financial Health & Margins", badge: "Live" },
    { id: 4, label: "Operations & Staff" },
  ]

  function applyPreset(p) {
    if (p.label) {
      setStartDate(p.start)
      setEndDate(p.end)
      setActivePreset(p.label)
    } else {
      setActivePreset(null)
    }
  }

  const RPT_ADDITIONAL_STYLES = `
    * {
      /* margin-top: 0; */
      scrollbar-width: thin;
      scrollbar-color: var(--th-border-strong) transparent;
    }

    [style*="display: flex"], [style*="display:flex"], [class*="toolbar"], [class*="btn-row"], [class*="btn-group"], [class*="action"], [class*="filter"], [class*="status-bar"], [class*="header"] {
      flex-wrap: nowrap;
    }

    .rpt-tabs-header {
      display: flex;
      gap: 0.25rem;
      overflow-x: auto;
      scrollbar-width: none;
      border-bottom: 1px solid var(--th-border);
      padding-bottom: 0;
      margin-bottom: .5rem;
      -ms-overflow-style: none;
      flex-wrap: nowrap;
    }
    .rpt-tabs-header::-webkit-scrollbar { display: none; }
    .rpt-tab-item {
      padding: 0.6rem 1.1rem; cursor: pointer; white-space: nowrap;
      font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 0.95rem;
      text-transform: uppercase; letter-spacing: 0.06em; color: var(--th-text-faint);
      border-bottom: 2px solid transparent; transition: all 0.2s; align-items: center; gap: 0.5rem;
      flex-shrink: 0;
    }
    .rpt-tab-item:hover { color: var(--th-text-primary); }
    .rpt-tab-item.active { color: var(--th-emerald); border-bottom-color: var(--th-emerald); }
    .rpt-tab-badge {
      font-size: 0.65rem; background: var(--th-emerald-bg); color: var(--th-emerald);
      padding: 0.1rem 0.4rem; border-radius: 10px; font-weight: 800;
    }

    .gap-6 {
      gap: .5rem;
      display: flex;
      flex-direction: column-reverse;
    }

    @media (min-width: 1024px) {
      .gap-6 {
        flex-direction: row;
      }
    }

    .gap-3 {
      gap: .5rem;
    }

    .flex {
      display: flex;
    }

    .pm-card {
      background: var(--th-bg-card);
      border: 1px solid var(--th-border);
      border-radius: 11px;
      overflow: hidden;
      margin-top: 0;
    }

    .card-ops.pm-card {
      margin-top: .5rem;
    }

    .pm-three-col {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: .5rem;
      grid-auto-flow: row;
      margin-bottom: .5rem;
      margin-top: 0;
    }

    .pm-filter-card {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      flex-wrap: wrap;
      background: var(--th-bg-card);
      border: 1px solid var(--th-border);
      border-radius: 10px;
      padding: 0.75rem 1rem;
      position: relative;
      z-index: 20;
      /* margin-bottom: .5rem; */
    }

    /* KPI Consistency */
    .rpt-kpi-grid {
      display: grid;
      /* grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); */
      gap: 0.45rem;
      grid-auto-flow: column dense;
      align-content: center;
      justify-content: center;
      align-items: center;
    }
    .rpt-kpi-grid .th-kpi {
      height: 100%;
      min-height: 110px;
    }

    /* Daily Activity Styles */
    .daily-neon-grid .th-kpi {
      border: 1px solid var(--th-border-strong);
      box-shadow: 0 0 15px rgba(0,0,0,0.1);
    }
    
    .daily-neon-grid .th-kpi.accent-sky { box-shadow: inset 0 0 10px rgba(56, 189, 248, 0.1); }
    .daily-neon-grid .th-kpi.accent-violet { box-shadow: inset 0 0 10px rgba(139, 92, 246, 0.1); }
    .daily-neon-grid .th-kpi.accent-rose { box-shadow: inset 0 0 10px rgba(244, 63, 94, 0.1); }
    .daily-neon-grid .th-kpi.accent-emerald { box-shadow: inset 0 0 10px rgba(16, 185, 129, 0.1); }
    
    .recon-row {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 0.5rem;
      border-bottom: 1px solid var(--th-border);
      font-size: 0.9rem;
    }
    .recon-row:last-child { border-bottom: none; }
    .recon-row.highlight { background: rgba(0,0,0,0.02); border-radius: 6px; }
    .recon-row.total { font-weight: 800; font-size: 1.1rem; padding-top: 1rem; }
    .recon-label { color: var(--th-text-muted); }
    .recon-value { font-weight: 700; font-family: 'Barlow Condensed', sans-serif; letter-spacing: 0.02em; }
    .recon-value.emerald { color: var(--th-emerald); }
    .recon-value.sky { color: var(--th-sky); }
    .recon-value.amber { color: var(--th-amber); }

    .pm-method-mini-card {
      background: rgba(0,0,0,0.03);
      padding: 0.5rem;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      border: 1px solid var(--th-border);
    }
    .mini-label { font-size: 0.65rem; color: var(--th-text-faint); text-transform: uppercase; font-weight: 700; }
    .mini-value { font-size: 0.9rem; font-weight: 800; }

    .mode-btn {
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid var(--th-border);
      background: var(--th-bg-card);
      font-size: 0.7rem;
      font-weight: 700;
      cursor: pointer;
      color: var(--th-text-muted);
      transition: all 0.2s;
    }
    .mode-btn:hover { background: rgba(0,0,0,0.05); }
    .mode-btn.active { background: var(--th-emerald); color: #fff; border-color: var(--th-emerald); }

    .flex.bg-\[var\(--th-bg-card\)\].rounded.p-1.border.border-\[var\(--th-border\)\] {
      display: flex;
      flex-wrap: wrap;
    }

    /* Adaptive Reordering */
    .rpt-adaptive-stack {
      display: flex;
      flex-direction: column-reverse;
      gap: .5rem;
      margin-bottom: 0;
      margin-top: 0;
    }
    .rpt-filter-block { order: 1; }
    .rpt-kpi-block { order: 2; }

    @media (max-width: 640px) {
      .rpt-tab-item { padding: 0.5rem 0.85rem; font-size: 0.82rem; }
      .pm-header-row { justify-content: center; }
      .th-title-format { font-size: 1.5rem; text-align: center; }
      
      .rpt-kpi-grid {
        grid-auto-flow: row dense;
      }
      
      /* Swap order on Mobile: KPIs first, then Filter */
      .rpt-filter-block { order: 2; margin-top: 0; margin-bottom: 0; }
      .rpt-kpi-block { order: 1; margin-bottom: 1.25rem; }
      
      .pm-section { margin-bottom: 0; }
      .rpt-adaptive-stack { margin-bottom: .5rem; }
      .pm-card { margin-bottom: 0; margin-top: 0; }
      .pm-two-col, .pm-three-col { grid-template-columns: 1fr !important; margin-top: .5rem; }
    }
    .rpt-tab-content.rpt-no-padding {
      padding: 0 !important;
    }

    /* Operations & Staff Tab Specific: Remove all paddings */
    .rpt-staff-ops-tab, 
    .rpt-staff-ops-tab .pm-card {
      padding: 0 !important;
    }
    .rpt-staff-ops-tab .th-kpi {
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: var(--th-bg-card);
      border: 1px solid var(--th-border);
      border-radius: clamp(8px, 1.2vw, 16px);
      padding: clamp(0.8rem, 2.5vw, 1.2rem) !important;
      transition: all 0.2s ease;
    }
    .rpt-staff-ops-tab .DataTable th,
    .rpt-staff-ops-tab .DataTable td {
      padding: 4px 8px !important;
    }
    .rpt-staff-ops-tab .pm-section {
      margin-top: 0 !important;
      margin-bottom: 4px !important;
    }
  `

  useEffect(() => {
    if (!document.getElementById('rpt-custom-styles')) {
      const s = document.createElement('style')
      s.id = 'rpt-custom-styles'
      s.innerHTML = RPT_ADDITIONAL_STYLES
      document.head.appendChild(s)
    }
  }, [])

  return (
    <div className="pm-root" style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
      <div className="pm-header-row">
        <div className="th-title-format">Reports <span style={{ color: 'var(--th-emerald)' }}>&amp; Analytics</span></div>
      </div>

      <div className="pm-sub" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
        Comprehensive insights powered by live data. Visualizations and breakdowns across your entire operation.
      </div>

      <div className="rpt-tabs-container">
        <div className="rpt-tabs-header">
          {TABS.map(tab => (
            <div key={tab.id} className={`rpt-tab-item ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
              {tab.badge && <span className="rpt-tab-badge">{tab.badge}</span>}
            </div>
          ))}
        </div>
        <div className={`rpt-tab-content ${activeTab === 4 ? 'rpt-no-padding' : ''}`}>
          {activeTab === 0 && (
            <SectionDailyActivity
              shopId={shopId}
              startDate={startDate} endDate={endDate}
              setStartDate={setStartDate} setEndDate={setEndDate}
              activePreset={activePreset} applyPreset={applyPreset}
              isOpen={true}
            />
          )}
          {activeTab === 1 && (
            <SectionSales
              shopId={shopId}
              startDate={startDate} endDate={endDate}
              setStartDate={setStartDate} setEndDate={setEndDate}
              activePreset={activePreset} applyPreset={applyPreset}
              isOpen={true}
            />
          )}
          {activeTab === 2 && (
            <>
              <SectionInventory
                shopId={shopId}
                startDate={startDate} endDate={endDate}
                setStartDate={setStartDate} setEndDate={setEndDate}
                activePreset={activePreset} applyPreset={applyPreset}
                isOpen={true}
              >
                <SectionCategories shopId={shopId} startDate={startDate} endDate={endDate} isOpen={true} />
              </SectionInventory>
              <SectionTopItems shopId={shopId} startDate={startDate} endDate={endDate} isOpen={true} />
            </>
          )}
          {activeTab === 3 && (
            <>
              <div className="rpt-adaptive-stack">
                <div>
                  <FilterHeader
                    leftComponent={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', flexWrap: 'nowrap', width: '100%', height: '100%' }}>
                        <span style={{ fontSize: 'inherit', fontWeight: 600, color: 'var(--th-text-muted)', whiteSpace: 'nowrap' }}>From</span>
                        <input className="fh-date" type="date" value={startDate} onChange={e => { setStartDate(e.target.value); applyPreset({ label: null }) }} style={{ flex: 1, minWidth: '120px' }} />
                        <span style={{ fontSize: 'inherit', fontWeight: 600, color: 'var(--th-text-muted)', whiteSpace: 'nowrap' }}>To</span>
                        <input className="fh-date" type="date" value={endDate} onChange={e => { setEndDate(e.target.value); applyPreset({ label: null }) }} style={{ flex: 1, minWidth: '120px' }} />
                      </div>
                    }
                    filters={presets().map(p => ({ label: p.label, value: p.label, active: activePreset === p.label }))}
                    onFilterChange={(label) => {
                      const p = presets().find(x => x.label === label);
                      if (p) applyPreset(p);
                    }}
                    accentColor="var(--th-emerald)"
                  />
                </div>
                <SectionBusinessHealth shopId={shopId} startDate={startDate} endDate={endDate} isOpen={true} />
              </div>
              <SectionProfit shopId={shopId} startDate={startDate} endDate={endDate} isOpen={true} />
              <SectionExpenses shopId={shopId} startDate={startDate} endDate={endDate} isOpen={true}>
                <SectionPayment shopId={shopId} startDate={startDate} endDate={endDate} isOpen={true} />
              </SectionExpenses>
            </>
          )}
          {activeTab === 4 && (
            <div className="rpt-staff-ops-tab">
              <div className="rpt-adaptive-stack">
                <div>
                  <FilterHeader
                    leftComponent={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', flexWrap: 'nowrap', width: '100%', height: '100%' }}>
                        <span style={{ fontSize: 'inherit', fontWeight: 600, color: 'var(--th-text-muted)', whiteSpace: 'nowrap' }}>From</span>
                        <input className="fh-date" type="date" value={startDate} onChange={e => { setStartDate(e.target.value); applyPreset({ label: null }) }} style={{ flex: 1, minWidth: '120px' }} />
                        <span style={{ fontSize: 'inherit', fontWeight: 600, color: 'var(--th-text-muted)', whiteSpace: 'nowrap' }}>To</span>
                        <input className="fh-date" type="date" value={endDate} onChange={e => { setEndDate(e.target.value); applyPreset({ label: null }) }} style={{ flex: 1, minWidth: '120px' }} />
                      </div>
                    }
                    filters={presets().map(p => ({ label: p.label, value: p.label, active: activePreset === p.label }))}
                    onFilterChange={(label) => {
                      const p = presets().find(x => x.label === label);
                      if (p) applyPreset(p);
                    }}
                    accentColor="var(--th-emerald)"
                  />
                </div>
                <SectionStaff shopId={shopId} startDate={startDate} endDate={endDate} isOpen={true} />
              </div>
              <SectionReturns shopId={shopId} startDate={startDate} endDate={endDate} isOpen={true} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Reportspage(props) {
  return (
    <ChartThemeProvider>
      <ReportspageInner {...props} />
    </ChartThemeProvider>
  )
}
