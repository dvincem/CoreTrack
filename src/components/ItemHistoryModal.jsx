import React from 'react'

/**
 * ItemHistoryModal — reusable item history modal
 *
 * Props:
 *   item           — { item_name, sku, dot_number?, unit_cost, current_quantity, selling_price }
 *   onClose        — () => void
 *   currency       — (n: number) => string   formatter (invCurrency / prodCurrency)
 *   historyContent — JSX rendered inside the Transaction History list (loading/empty/entries)
 *   children       — optional slot rendered between the KPI card and the history list
 *                    (e.g. archive button, stock adjustment form)
 */
export default function ItemHistoryModal({ item, onClose, currency, historyContent, children }) {
  const margin = (item.selling_price || 0) - (item.unit_cost || 0)

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

          {/* Item details — 2×2 KPI grid */}
          <div className="inv-hist-item-card">
            <div className="inv-hist-item-name">
              {item.item_name}
              {item.dot_number && (
                <span style={{
                  marginLeft: '0.5rem', background: 'var(--th-amber-bg)', color: 'var(--th-amber)',
                  padding: '0.1rem 0.4rem', borderRadius: 4, fontSize: '0.72rem',
                  fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, verticalAlign: 'middle',
                }}>
                  DOT {item.dot_number}
                </span>
              )}
            </div>
            <div className="inv-hist-item-sku">{item.sku}</div>
            <div className="inv-hist-stats">
              <div className="inv-hist-stat">
                <div className="inv-hist-stat-label">Unit Cost</div>
                <div className="inv-hist-stat-val sky">{currency(item.unit_cost)}</div>
              </div>
              <div className="inv-hist-stat">
                <div className="inv-hist-stat-label">Stock</div>
                <div className="inv-hist-stat-val emerald">{item.current_quantity ?? 0}</div>
              </div>
              <div className="inv-hist-stat">
                <div className="inv-hist-stat-label">Sell Price</div>
                <div className="inv-hist-stat-val" style={{ color: 'var(--th-orange)' }}>
                  {currency(item.selling_price)}
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
