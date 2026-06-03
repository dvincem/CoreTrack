import React, { useState, useEffect, useMemo, createContext, useContext, useRef, useCallback } from 'react'

// ─── Theme Context ──────────────────────────────────────────────────────────
const ChartThemeContext = createContext()

export const ChartThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'light')

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute('data-theme') || 'light')
    })
    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [])

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
    grid: theme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
    purplePalette
  }

  return (
    <ChartThemeContext.Provider value={{ theme, chartStyles }}>
      {children}
    </ChartThemeContext.Provider>
  )
}

export const useChartTheme = () => useContext(ChartThemeContext)

// ─── SVG Arc Math ──────────────────────────────────────────────────────────
function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx, cy, outerR, innerR, startAngle, endAngle) {
  // Clamp full-circle sweep to avoid degenerate path
  const sweep = endAngle - startAngle
  const safeEnd = sweep >= 360 ? startAngle + 359.9999 : endAngle
  const large = safeEnd - startAngle > 180 ? 1 : 0

  const o1 = polarToCartesian(cx, cy, outerR, startAngle)
  const o2 = polarToCartesian(cx, cy, outerR, safeEnd)
  const i1 = polarToCartesian(cx, cy, innerR, safeEnd)
  const i2 = polarToCartesian(cx, cy, innerR, startAngle)

  return [
    `M ${o1.x} ${o1.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${i2.x} ${i2.y}`,
    'Z',
  ].join(' ')
}

// ─── Pure SVG Donut Chart ──────────────────────────────────────────────────
export function RevenueDonutChart({ items, valueFormatter, palette, centerLabel = 'Total' }) {
  const { theme } = useChartTheme()
  const containerRef = useRef(null)
  const svgRef = useRef(null)

  const [size, setSize] = useState(280)
  const [hovered, setHovered] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [tooltipVisible, setTooltipVisible] = useState(false)

  // Responsive container width
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width
      setSize(Math.min(Math.max(180, w), 340))
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Default palettes
  const DEFAULT_PALETTE = [
    '#a78bfa', '#38bdf8', '#34d399', '#fbbf24', '#f87171',
    '#6366f1', '#f472b6', '#2dd4bf', '#8b5cf6', '#fb923c'
  ]
  const activePalette = palette || DEFAULT_PALETTE

  // Filter zero-value items
  const validItems = useMemo(() =>
    (items || []).filter(i => i.value > 0),
  [items])

  const total = useMemo(() =>
    (items || []).reduce((acc, i) => acc + (i.value || 0), 0),
  [items])

  // Build segments
  const segments = useMemo(() => {
    if (!validItems.length || total === 0) return []
    let angle = 0
    return validItems.map((item, idx) => {
      const pct = item.value / total
      const sweep = pct * 360
      const start = angle
      const end = angle + sweep
      angle = end
      return {
        ...item,
        color: item.color || activePalette[idx % activePalette.length],
        startAngle: start,
        endAngle: end,
        pct,
        idx,
      }
    })
  }, [validItems, total, activePalette])

  // Mouse handlers
  const handleSvgMouseMove = useCallback((e) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    setTooltipVisible(true)
  }, [])

  const handleSvgMouseLeave = useCallback(() => {
    setHovered(null)
    setTooltipVisible(false)
  }, [])

  // Empty state
  if (!items || items.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--th-text-faint)', fontStyle: 'italic' }}>
        No data
      </div>
    )
  }
  if (!validItems.length) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--th-text-faint)', fontStyle: 'italic' }}>
        No data available
      </div>
    )
  }

  // Geometry
  const cx = size / 2
  const cy = size / 2
  const outerR = size * 0.36
  const innerR = size * 0.22
  const GAP_DEG = segments.length > 1 ? 2.2 : 0

  const hovSeg = hovered !== null ? segments[hovered] : null

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>

      {/* ── SVG Area ── */}
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg
          ref={svgRef}
          width={size}
          height={size}
          style={{ display: 'block', overflow: 'visible' }}
          onMouseMove={handleSvgMouseMove}
          onMouseLeave={handleSvgMouseLeave}
        >
          <defs>
            {segments.map(seg => (
              <filter key={`glow-${seg.idx}`} id={`cglow-${seg.idx}`} x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor={seg.color} floodOpacity="0.65" />
              </filter>
            ))}
          </defs>

          {/* Segments */}
          {segments.map((seg) => {
            const isHov = hovered === seg.idx
            const gS = seg.startAngle + GAP_DEG / 2
            const gE = seg.endAngle - GAP_DEG / 2
            if (gE <= gS) return null

            const oR = isHov ? outerR + 11 : outerR
            const iR = isHov ? innerR - 5 : innerR
            const d = arcPath(cx, cy, oR, iR, gS, gE)

            return (
              <path
                key={seg.idx}
                d={d}
                fill={seg.color}
                opacity={hovered !== null && !isHov ? 0.3 : 1}
                filter={isHov ? `url(#cglow-${seg.idx})` : undefined}
                style={{
                  cursor: 'pointer',
                  transition: 'opacity 0.15s ease',
                }}
                onMouseEnter={() => setHovered(seg.idx)}
              />
            )
          })}

          {/* Center text — label */}
          <text
            x={cx}
            y={cy - 11}
            textAnchor="middle"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: Math.round(size * 0.042),
              fontWeight: 800,
              fill: hovSeg ? hovSeg.color : 'var(--th-text-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              pointerEvents: 'none',
              transition: 'fill 0.15s ease',
            }}
          >
            {hovSeg ? hovSeg.label : centerLabel}
          </text>

          {/* Center text — value */}
          <text
            x={cx}
            y={cy + 13}
            textAnchor="middle"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: Math.round(size * 0.066),
              fontWeight: 900,
              fill: hovSeg ? hovSeg.color : 'var(--th-text-primary)',
              pointerEvents: 'none',
              transition: 'fill 0.15s ease',
              letterSpacing: '-0.02em',
            }}
          >
            {hovSeg
              ? (valueFormatter ? valueFormatter(hovSeg.value) : hovSeg.value)
              : (valueFormatter ? valueFormatter(total) : total)
            }
          </text>

          {/* Center text — pct when hovered */}
          {hovSeg && (
            <text
              x={cx}
              y={cy + 30}
              textAnchor="middle"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: Math.round(size * 0.038),
                fontWeight: 700,
                fill: 'var(--th-text-faint)',
                pointerEvents: 'none',
              }}
            >
              {(hovSeg.pct * 100).toFixed(1)}% of total
            </text>
          )}
        </svg>

        {/* Floating tooltip */}
        {tooltipVisible && hovSeg && (
          <div
            style={{
              position: 'absolute',
              left: tooltipPos.x,
              top: tooltipPos.y,
              transform: 'translate(-50%, -115%)',
              background: 'var(--th-bg-card)',
              border: `1.5px solid ${hovSeg.color}`,
              borderRadius: 12,
              padding: '10px 14px',
              boxShadow: `0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px ${hovSeg.color}33`,
              minWidth: 150,
              pointerEvents: 'none',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1 }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: hovSeg.color,
                boxShadow: `0 0 8px ${hovSeg.color}`,
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: 10,
                fontWeight: 800,
                color: 'var(--th-text-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
              }}>
                {hovSeg.label}
              </span>
            </div>
            <div style={{
              fontSize: 18,
              fontWeight: 900,
              color: hovSeg.color,
              fontFamily: 'var(--font-body)',
              letterSpacing: '-0.02em',
            }}>
              {valueFormatter ? valueFormatter(hovSeg.value) : hovSeg.value}
            </div>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--th-text-faint)',
              borderTop: '1px solid var(--th-border)',
              paddingTop: 5,
              marginTop: 2,
            }}>
              {(hovSeg.pct * 100).toFixed(1)}%&nbsp;of&nbsp;
              {valueFormatter ? valueFormatter(total) : total}
            </div>
          </div>
        )}
      </div>

      {/* ── Legend ── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '7px 14px',
        marginTop: 14,
        padding: '0 6px',
        width: '100%',
      }}>
        {segments.map((seg) => (
          <div
            key={seg.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'default',
              opacity: hovered !== null && hovered !== seg.idx ? 0.38 : 1,
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={() => setHovered(seg.idx)}
            onMouseLeave={() => setHovered(null)}
          >
            <div style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: seg.color,
              flexShrink: 0,
              boxShadow: hovered === seg.idx ? `0 0 8px ${seg.color}` : 'none',
              transition: 'box-shadow 0.15s ease',
            }} />
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              color: hovered === seg.idx ? 'var(--th-text-primary)' : 'var(--th-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              transition: 'color 0.15s ease',
              whiteSpace: 'nowrap',
            }}>
              {seg.label}
            </span>
          </div>
        ))}
      </div>

    </div>
  )
}

// Kept for backwards compat — ChartTooltip is no longer needed
export function ChartTooltip() { return null }
