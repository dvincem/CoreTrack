import React from 'react'

let styleInjected = false

function injectKpiStyles() {
  if (styleInjected) return
  styleInjected = true

  const style = document.createElement('style')
  style.textContent = `
    /* ── KPI Card Base ── */
    .th-kpi {
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: var(--th-bg-card);
      border: 1px solid var(--th-border);
      border-radius: clamp(8px, 1.2vw, 16px);
      padding: clamp(0.8rem, 2.5vw, 1.2rem);
      transition: all 0.2s ease;
    }

    .th-kpi::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      width: 3px;
      border-radius: 16px 0 0 16px;
      background: var(--th-sky);
      transition: width 0.2s ease;
    }

    .th-kpi:hover {
      border-color: var(--th-border-strong);
      transform: translateY(-2px);
    }

    /* ── Accent Colors ── */
    .th-kpi.accent-orange::before { background: var(--th-orange); }
    .th-kpi.accent-sky::before { background: var(--th-sky); }
    .th-kpi.accent-emerald::before { background: var(--th-emerald); }
    .th-kpi.accent-violet::before { background: var(--th-violet); }
    .th-kpi.accent-amber::before { background: var(--th-amber); }
    .th-kpi.accent-rose::before { background: var(--th-rose); }

    /* ── Icon ── */
    .th-kpi-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: clamp(2rem, 5vw, 2.8rem);
      height: clamp(2rem, 5vw, 2.8rem);
      background: rgba(0, 0, 0, 0.04);
      border-radius: clamp(6px, 1vw, 10px);
      margin-bottom: clamp(0.5rem, 1.5vw, 0.8rem);
      color: var(--th-text-strong);
      flex-shrink: 0;
    }

    .th-kpi-icon svg {
      width: clamp(1rem, 3vw, 1.4rem);
      height: clamp(1rem, 3vw, 1.4rem);
      color: inherit;
    }

    /* ── Label ── */
    .th-kpi-label {
      font-size: clamp(0.65rem, 1.8vw, 0.75rem);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--th-text-faint);
      margin-bottom: clamp(0.4rem, 1vw, 0.6rem);
      line-height: 1.2;
      padding-left: 5px;
    }

    /* ── Value ── */
    .th-kpi-value {
      font-size: clamp(1.4rem, 4vw, 2.2rem);
      font-weight: 800;
      color: var(--th-text-strong);
      line-height: 1;
      margin-bottom: clamp(0.3rem, 1vw, 0.5rem);
      padding-left: 5px;
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      word-break: break-word;
    }

    /* ── Subtitle ── */
    .th-kpi-sub {
      font-size: clamp(0.68rem, 1.8vw, 0.82rem);
      color: var(--th-text-faint);
      line-height: 1.35;
      padding-left: 5px;
    }

    /* ── Loading Skeleton ── */
    .th-kpi .th-skeleton {
      height: clamp(1.4rem, 4vw, 2rem);
      background: linear-gradient(90deg, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.05) 75%);
      background-size: 200% 100%;
      animation: skeleton-loading 1.5s infinite;
      border-radius: 6px;
      margin-bottom: clamp(0.3rem, 1vw, 0.5rem);
    }

    /* ── Compact Mode ── */
    .th-kpi.compact {
      flex-direction: row;
      align-items: center;
      padding: 0.6rem 0.8rem;
      gap: 1rem;
      min-height: 0;
    }
    .th-kpi.compact .th-kpi-label {
      margin-bottom: 0;
      padding-left: 0;
      white-space: nowrap;
      min-width: 100px;
    }
    .th-kpi.compact .th-kpi-value {
      font-size: 1.25rem;
      margin-bottom: 0;
      padding-left: 0;
    }
    .th-kpi.compact .th-kpi-sub {
      margin-left: auto;
      padding-left: 0;
      text-align: right;
    }

    @keyframes skeleton-loading {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* ── Mobile (≤640px) ── */
    @media (max-width: 640px) {
      .th-kpi {
        padding: clamp(0.65rem, 2vw, 1rem);
        border-radius: clamp(6px, 1.5vw, 12px);
      }

      .th-kpi::before {
        width: 2px;
      }

      .th-kpi-icon {
        width: clamp(1.8rem, 4.5vw, 2.4rem);
        height: clamp(1.8rem, 4.5vw, 2.4rem);
        margin-bottom: clamp(0.4rem, 1vw, 0.6rem);
      }

      .th-kpi-value {
        font-size: clamp(1.2rem, 3.5vw, 1.8rem);
      }
    }

    /* ── Tablet (641px - 900px) ── */
    @media (min-width: 641px) and (max-width: 900px) {
      .th-kpi {
        padding: clamp(0.75rem, 2.2vw, 1.1rem);
      }
    }

    /* ── Desktop (901px+) ── */
    @media (min-width: 901px) {
      .th-kpi:hover {
        border-color: var(--th-border-strong);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
      }
    }
  `
  document.head.appendChild(style)
}

/**
 * Universal KPI Card Component
 * Used across all pages for consistent KPI display
 * 
 * Props:
 *   - label: KPI title (e.g., "Total Sales")
 *   - value: Main value to display
 *   - icon: Optional icon/SVG element
 *   - accent: Color accent ('orange', 'sky', 'emerald', 'violet', 'amber', 'rose')
 *   - sub: Optional subtitle/secondary text
 *   - loading: Boolean to show skeleton loading state
 */
export default function KpiCard({ label, value, icon, accent = 'sky', sub, loading, compact, ...props }) {
  React.useEffect(() => {
    injectKpiStyles()
  }, [])

  return (
    <div className={`th-kpi accent-${accent}${compact ? ' compact' : ''}`} {...props}>
      {icon && <div className="th-kpi-icon">{icon}</div>}
      <div className="th-kpi-label">{label}</div>
      {loading ? <div className="th-skeleton" /> : <div className="th-kpi-value">{value}</div>}
      {sub && <div className="th-kpi-sub">{sub}</div>}
    </div>
  )
}
