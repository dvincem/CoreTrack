import React from 'react'

/**
 * ItemHistoryModal — reusable item history modal
 *
 * Props:
 *   item              — { item_name, sku, dot_number?, unit_cost, current_quantity, selling_price }
 *   onClose           — () => void
 *   currency          — (n: number) => string   formatter
 *   historyContent    — JSX rendered inside the Transaction History list
 *   children          — optional slot between KPI card and history list
 *   variants          — optional array of { item_id, dot_number, qty, selling_price, unit_cost }
 *                       when present (length > 1) shows DOT variant tabs
 *   activeVariantId   — currently selected variant item_id (null = "All")
 *   onVariantChange   — (item_id | null) => void
 */
export default function ItemHistoryModal({
  item, onClose, currency, historyContent, children,
  variants, activeVariantId, onVariantChange,
}) {
  const isGrouped = variants && variants.length > 1

  // Determine which data to show in the KPI block
  const activeVariant = isGrouped && activeVariantId
    ? variants.find(v => v.item_id === activeVariantId)
    : null

  const displayCost  = activeVariant ? activeVariant.unit_cost    : (item.unit_cost    || 0)
  const displayPrice = activeVariant ? activeVariant.selling_price : (item.selling_price || 0)
  const displayQty   = activeVariant ? activeVariant.qty           : (item.current_quantity ?? 0)
  const displayDot   = activeVariant ? activeVariant.dot_number    : item.dot_number
  const margin       = displayPrice - displayCost

  return (
    <div className="hist-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="inv-history">

        {/* ── Sticky header ── */}
        <div className="inv-hist-header">
          <div className="inv-hist-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Item History
          </div>
          <button className="inv-hist-close" onClick={onClose}>✕</button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="inv-hist-body">

          {/* ── DOT variant tabs (only for grouped items) ── */}
          {isGrouped && (
            <div style={{
              display: 'flex', gap: '0.35rem', flexWrap: 'wrap',
              padding: '0.65rem 1rem 0.65rem', borderBottom: '1px solid var(--th-border,#283245)',
              marginBottom: '0.5rem',
            }}>
              <button
                onClick={() => onVariantChange && onVariantChange(null)}
                style={{
                  padding: '0.5rem 0.7rem', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: '0.75rem',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  background: !activeVariantId ? 'var(--th-amber,#fbbf24)' : 'transparent',
                  color: !activeVariantId ? '#000' : 'var(--th-text-dim,#94a3b8)',
                  border: !activeVariantId ? '1px solid var(--th-amber,#fbbf24)' : '1px solid var(--th-border,#283245)',
                  transition: 'all 0.15s',
                }}
              >
                All ({variants.reduce((s, v) => s + (v.qty || 0), 0)})
              </button>
              {variants.map(v => (
                <button
                  key={v.item_id}
                  onClick={() => onVariantChange && onVariantChange(v.item_id)}
                  style={{
                    padding: '0.5rem 0.7rem', borderRadius: 20, cursor: 'pointer',
                    fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: '0.75rem',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    background: activeVariantId === v.item_id ? 'var(--th-amber,#fbbf24)' : 'transparent',
                    color: activeVariantId === v.item_id ? '#000' : 'var(--th-text-dim,#94a3b8)',
                    border: activeVariantId === v.item_id ? '1px solid var(--th-amber,#fbbf24)' : '1px solid var(--th-border,#283245)',
                    transition: 'all 0.15s',
                  }}
                >
                  DOT {v.dot_number || '—'} <span style={{ opacity: 0.75, fontWeight: 600 }}>({v.qty})</span>
                </button>
              ))}
            </div>
          )}

          {/* Item details — 2×2 KPI grid */}
          <div className="inv-hist-item-card">
            <div className="inv-hist-item-name">
              {item.item_name}
              {displayDot && (
                <span style={{
                  marginLeft: '0.5rem', background: 'var(--th-amber-bg)', color: 'var(--th-amber)',
                  padding: '0.1rem 0.4rem', borderRadius: 4, fontSize: '0.72rem',
                  fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, verticalAlign: 'middle',
                }}>
                  DOT {displayDot}
                </span>
              )}
              {isGrouped && !activeVariantId && (
                <span style={{
                  marginLeft: '0.4rem', background: 'rgba(249,115,22,0.12)', color: 'var(--th-orange,#f97316)',
                  padding: '0.1rem 0.4rem', borderRadius: 4, fontSize: '0.68rem',
                  fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, verticalAlign: 'middle',
                }}>
                  {variants.length} variants
                </span>
              )}
            </div>
            <div className="inv-hist-item-sku">{item.sku}</div>
            <div className="inv-hist-stats">
              <div className="inv-hist-stat">
                <div className="inv-hist-stat-label">Unit Cost</div>
                <div className="inv-hist-stat-val sky">{currency(displayCost)}</div>
              </div>
              <div className="inv-hist-stat">
                <div className="inv-hist-stat-label">Stock</div>
                <div className="inv-hist-stat-val emerald">{displayQty}</div>
              </div>
              <div className="inv-hist-stat">
                <div className="inv-hist-stat-label">Sell Price</div>
                <div className="inv-hist-stat-val" style={{ color: 'var(--th-orange)' }}>
                  {currency(displayPrice)}
                </div>
              </div>
              <div className="inv-hist-stat">
                <div className="inv-hist-stat-label">Margin</div>
                <div className="inv-hist-stat-val" style={{ color: margin >= 0 ? 'var(--th-emerald)' : 'var(--th-rose)' }}>
                  {currency(margin)}
                </div>
              </div>
            </div>
          </div>

          {/* Optional slot: archive button, stock adjustment, etc. */}
          {children}

          {/* Transaction history list */}
          <div className="inv-hist-list">
            <div className="th-section-label">Transaction History</div>
            {historyContent}
          </div>

        </div>{/* end inv-hist-body */}
      </div>
    </div>
  )
}
