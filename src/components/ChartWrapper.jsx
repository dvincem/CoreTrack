import React, { useState, useEffect, useMemo, createContext, useContext } from 'react'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { PieChart } from '@mui/x-charts/PieChart'

// 1. Universal Theme Setup
const ChartThemeContext = createContext()

export const ChartThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark')

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          const newTheme = document.documentElement.getAttribute('data-theme')
          setTheme(newTheme)
        }
      })
    })
    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [])

  const muiTheme = useMemo(() => createTheme({
    palette: { mode: theme === 'dark' ? 'dark' : 'light' },
    typography: { fontFamily: 'var(--font-body)' }
  }), [theme])

  // Purple monochromatic palette
  const purplePalette = theme === 'dark' 
    ? ['#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95']
    : ['#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6']

  const chartStyles = {
    text: 'var(--th-text-body)',
    muted: 'var(--th-text-muted)',
    faint: 'var(--th-text-faint)',
    border: 'var(--th-border)',
    card: 'var(--th-bg-card)',
    cardAlt: 'var(--th-bg-card-alt)',
    stroke: 'var(--th-bg-card)', // Segments border blends with card background
    grid: theme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
    purplePalette
  }

  return (
    <ChartThemeContext.Provider value={{ theme, chartStyles, muiTheme }}>
      <ThemeProvider theme={muiTheme}>
        {children}
      </ThemeProvider>
    </ChartThemeContext.Provider>
  )
}

export const useChartTheme = () => useContext(ChartThemeContext)

// 3. Custom Tooltip
export const ChartTooltip = ({ itemData, series, valueFormatter }) => {
  const { chartStyles } = useChartTheme()
  if (!itemData || !series) return null
  
  const s = series[0]
  const idx = itemData.dataIndex
  const val = s.data[idx].value
  const label = s.data[idx].label

  return (
    <div className="bg-[var(--th-bg-card-alt)] border border-[var(--th-border-strong)] p-4 rounded-xl shadow-2xl min-w-[160px]">
      <div className="text-[10px] font-bold text-[var(--th-text-faint)] uppercase tracking-wider mb-1">{label}</div>
      <div className="text-xl font-black text-[var(--th-text-primary)]">
        {valueFormatter ? valueFormatter(val) : val}
      </div>
    </div>
  )
}

// 2. Donut Chart Construction (Revenue by Day of Week)
export const RevenueDonutChart = ({ items, valueFormatter, palette }) => {
  const { chartStyles } = useChartTheme()
  
  if (!items || items.length === 0) return <div className="p-8 text-center text-sm italic text-[var(--th-text-faint)]">No data</div>

  const activePalette = palette || chartStyles.purplePalette

  const chartData = items.filter(i => i.value > 0).map((item, idx) => ({
    id: idx,
    value: item.value,
    label: item.label,
    color: activePalette[idx % activePalette.length]
  }))

  if (!chartData.length) return <div className="p-8 text-center text-sm italic text-[var(--th-text-faint)]">No data available</div>

  const total = items.reduce((acc, curr) => acc + curr.value, 0)

  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative w-full h-[280px] flex items-center justify-center">
        <PieChart
          series={[
            {
              data: chartData,
              innerRadius: 70,
              outerRadius: 100,
              paddingAngle: 3,
              cornerRadius: 6,
              stroke: chartStyles.stroke,
              strokeWidth: 2,
              highlightScope: { faded: 'global', highlighted: 'item' },
              faded: { innerRadius: 30, additionalRadius: -30, color: 'gray' },
            },
          ]}
          slotProps={{
            legend: { hidden: true }, // Custom legend handled below
            tooltip: { content: (props) => <ChartTooltip {...props} valueFormatter={valueFormatter} /> }
          }}
          height={280}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[10px] text-[var(--th-text-faint)] uppercase font-extrabold tracking-widest">Total Revenue</div>
          <div className="text-lg font-black text-[var(--th-text-primary)]">{valueFormatter ? valueFormatter(total) : total}</div>
        </div>
      </div>

      {/* Custom Legend */}
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-4 px-2">
        {chartData.map((item) => (
          <div key={item.label} className="flex items-center gap-2 group cursor-default">
            <div 
              className="w-2.5 h-2.5 rounded-full shadow-sm transition-transform group-hover:scale-125" 
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[10px] font-bold text-[var(--th-text-muted)] group-hover:text-[var(--th-text-primary)] uppercase tracking-wider transition-colors">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
