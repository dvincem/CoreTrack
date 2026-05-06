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
 *   variants          — optional array of { item_id, dot_number, design?, qty, selling_price, unit_cost }
 *                       when present (length > 1) shows variant tabs/selector
 *   activeVariantId   — currently selected variant item_id (null = "All")
 *   onVariantChange   — (item_id | null) => void
 *   onDesignChange    — (design | null) => void  — called when a design pill is selected
 */
export default function ItemHistoryModal({
  item, onClose, currency, historyContent, children,
  variants, activeVariantId, onVariantChange, onDesignChange,
  onUpdateCost, onUpdatePrice
}) {
  const isGrouped = variants && variants.length > 1

  // Detect multi-design group (same brand+size, multiple designs)
  const uniqueDesigns = isGrouped
    ? [...new Set(variants.map(v => v.design).filter(Boolean))]
    : []
  const isDesignGroup = uniqueDesigns.length > 1

  // Local state: which design pill is active (design-group mode only)
  const [activeDesign, setActiveDesign] = React.useState(null)
  const [editingField, setEditingField] = React.useState(null) // 'cost' | 'price'
  const [tempVal, setTempVal] = React.useState('')

  // Reset local design selection when variants change (new item opened)
  React.useEffect(() => {
    setActiveDesign(null)
  }, [variants])

  // Active single variant (DOT-level)
  const activeVariant = isGrouped && activeVariantId
    ? variants.find(v => v.item_id === activeVariantId)
    : null

  // When a design is active but no specific DOT is selected: aggregate that design's variants
  const designActiveVariants = isDesignGroup && activeDesign && !activeVariantId
    ? variants.filter(v => v.design === activeDesign)
    : null

  // KPI values
  let displayCost, displayPrice, displayQty, displayDot, displayName, displaySku
  if (activeVariant) {
    displayCost  = activeVariant.unit_cost
    displayPrice = activeVariant.selling_price
    displayQty   = activeVariant.qty
    displayDot   = activeVariant.dot_number
    displayName  = activeVariant.item_name || item.item_name
    displaySku   = activeVariant.sku       || item.sku
  } else if (designActiveVariants && designActiveVariants.length > 0) {
    displayCost  = designActiveVariants.reduce((s, v) => s + (v.unit_cost || 0), 0) / designActiveVariants.length
    displayPrice = designActiveVariants[0]?.selling_price || 0
    displayQty   = designActiveVariants.reduce((s, v) => s + (v.qty || 0), 0)
    // Show the DOT when a design has exactly one batch — no ambiguity
    displayDot   = designActiveVariants.length === 1 ? designActiveVariants[0].dot_number : null
    displayName  = designActiveVariants[0]?.item_name || item.item_name
    displaySku   = designActiveVariants[0]?.sku       || item.sku
  } else {
    displayCost  = item.unit_cost    || 0
    displayPrice = item.selling_price || 0
    displayQty   = item.current_quantity ?? 0
    displayDot   = item.dot_number
    displayName  = item.item_name
    displaySku   = item.sku
  }
  const margin = displayPrice - displayCost

  // DOT items for the currently active design (for sub-selector)
  const dotVariantsForDesign = isDesignGroup && activeDesign
    ? variants.filter(v => v.design === activeDesign && v.dot_number)
    : null
  const showDotSubSelect = dotVariantsForDesign && dotVariantsForDesign.length > 1

  function handleDesignClick(design) {
    setActiveDesign(design)
    onVariantChange && onVariantChange(null)   // clear any DOT selection when changing design
    onDesignChange  && onDesignChange(design)
  }

  function handleAllDesignsClick() {
    setActiveDesign(null)
    onVariantChange && onVariantChange(null)
    onDesignChange  && onDesignChange(null)
  }

  function handleSaveEdit() {
    const val = parseFloat(tempVal)
    if (isNaN(val)) return
    if (editingField === 'cost') {
      onUpdateCost && onUpdateCost(val, activeVariantId)
    } else {
      onUpdatePrice && onUpdatePrice(val, activeVariantId)
    }
    setEditingField(null)
  }

  const pencilIcon = (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: '4px', cursor: 'pointer', opacity: 0.6 }}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )


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

          {/* ── Variant selector ── */}
          {isGrouped && (
            <div style={{
              padding: '0.65rem 1rem', borderBottom: '1px solid var(--th-border,#283245)',
              marginBottom: '0.5rem',
            }}>
              {isDesignGroup ? (
                <>
                  {/* Design pill tabs */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: showDotSubSelect ? '0.5rem' : 0 }}>
                    <button
                      onClick={handleAllDesignsClick}
                      style={{
                        padding: '0.28rem 0.7rem', borderRadius: 20,
                        border: `1px solid ${!activeDesign ? 'var(--th-amber,#fbbf24)' : 'var(--th-border,#283245)'}`,
                        background: !activeDesign ? 'var(--th-amber-bg,rgba(251,191,36,0.1))' : 'transparent',
                        color: !activeDesign ? 'var(--th-amber,#fbbf24)' : 'var(--th-text-dim,#94a3b8)',
                        fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700,
                        fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em',
                        cursor: 'pointer',
                      }}
                    >
                      ALL ({variants.reduce((s, v) => s + (v.qty || 0), 0)})
                    </button>
                    {uniqueDesigns.map(d => {
                      const dQty = variants.filter(v => v.design === d).reduce((s, v) => s + (v.qty || 0), 0)
                      return (
                        <button
                          key={d}
                          onClick={() => handleDesignClick(d)}
                          style={{
                            padding: '0.28rem 0.7rem', borderRadius: 20,
                            border: `1px solid ${activeDesign === d ? 'var(--th-violet,#a855f7)' : 'var(--th-border,#283245)'}`,
                            background: activeDesign === d ? 'rgba(168,85,247,0.12)' : 'transparent',
                            color: activeDesign === d ? 'var(--th-violet,#a855f7)' : 'var(--th-text-dim,#94a3b8)',
                            fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700,
                            fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em',
                            cursor: 'pointer',
                          }}
                        >
                          {d} ({dQty})
                        </button>
                      )
                    })}
                  </div>
                  {/* DOT sub-selector (only when a design is selected AND has multiple DOTs) */}
                  {showDotSubSelect && (
                    <select
                      value={activeVariantId || ''}
                      onChange={e => onVariantChange && onVariantChange(e.target.value || null)}
                      style={{
                        width: '100%',
                        background: 'var(--th-bg-input,#1a2132)',
                        border: '1px solid var(--th-amber,#fbbf24)',
                        borderRadius: 8,
                        color: 'var(--th-amber,#fbbf24)',
                        fontFamily: "'Barlow Condensed',sans-serif",
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        padding: '0.45rem 0.75rem',
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                    >
                      <option value="">ALL DOTs ({dotVariantsForDesign.reduce((s, v) => s + (v.qty || 0), 0)})</option>
                      {dotVariantsForDesign.map(v => (
                        <option key={v.item_id} value={v.item_id}>
                          DOT {v.dot_number} ({v.qty})
                        </option>
                      ))}
                    </select>
                  )}
                </>
              ) : (
                /* Original flat DOT selector for single-design DOT groups */
                <select
                  value={activeVariantId || ''}
                  onChange={e => onVariantChange && onVariantChange(e.target.value || null)}
                  style={{
                    width: '100%',
                    background: 'var(--th-bg-input,#1a2132)',
                    border: '1px solid var(--th-amber,#fbbf24)',
                    borderRadius: 8,
                    color: 'var(--th-amber,#fbbf24)',
                    fontFamily: "'Barlow Condensed',sans-serif",
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '0.45rem 0.75rem',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="">ALL ({variants.reduce((s, v) => s + (v.qty || 0), 0)})</option>
                  {variants.map(v => (
                    <option key={v.item_id} value={v.item_id}>
                      DOT {v.dot_number || '—'} ({v.qty})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Item details — 2×2 KPI grid */}
          <div className="inv-hist-item-card">
            <div className="inv-hist-item-name">
              {displayName}
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
                  marginLeft: '0.4rem',
                  background: isDesignGroup && activeDesign ? 'rgba(168,85,247,0.12)' : 'rgba(249,115,22,0.12)',
                  color: isDesignGroup && activeDesign ? 'var(--th-violet,#a855f7)' : 'var(--th-orange,#f97316)',
                  padding: '0.1rem 0.4rem', borderRadius: 4, fontSize: '0.68rem',
                  fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, verticalAlign: 'middle',
                }}>
                  {isDesignGroup && activeDesign
                    ? `${activeDesign} · ${designActiveVariants?.length || 0} variant${(designActiveVariants?.length || 0) !== 1 ? 's' : ''}`
                    : `${variants.length} variants`}
                </span>
              )}
            </div>
            <div className="inv-hist-item-sku">{displaySku}</div>
            <div className="inv-hist-stats">
              <div className="inv-hist-stat">
                <div className="inv-hist-stat-label">Unit Cost</div>
                {editingField === 'cost' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number" step="0.01" value={tempVal}
                      onChange={e => setTempVal(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                      autoFocus
                      style={{ width: '80px', background: 'var(--th-bg-input,#1a2132)', border: '1px solid var(--th-sky,#0ea5e9)', color: '#fff', fontSize: '0.85rem', borderRadius: 4, padding: '2px 4px' }}
                    />
                    <button onClick={handleSaveEdit} style={{ background: 'none', border: 'none', color: 'var(--th-emerald)', cursor: 'pointer', fontSize: '1rem' }}>✓</button>
                    <button onClick={() => setEditingField(null)} style={{ background: 'none', border: 'none', color: 'var(--th-rose)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                  </div>
                ) : (
                  <div className="inv-hist-stat-val sky" style={{ display: 'flex', alignItems: 'center' }}>
                    {currency(displayCost)}
                    <span onClick={() => { setEditingField('cost'); setTempVal(displayCost); }} style={{ display: 'inline-flex', cursor: 'pointer' }}>{pencilIcon}</span>
                  </div>
                )}
              </div>
              <div className="inv-hist-stat">
                <div className="inv-hist-stat-label">Stock</div>
                <div className="inv-hist-stat-val emerald">{displayQty}</div>
              </div>
              <div className="inv-hist-stat">
                <div className="inv-hist-stat-label">Sell Price</div>
                {editingField === 'price' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number" step="0.01" value={tempVal}
                      onChange={e => setTempVal(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                      autoFocus
                      style={{ width: '80px', background: 'var(--th-bg-input,#1a2132)', border: '1px solid var(--th-orange,#f97316)', color: '#fff', fontSize: '0.85rem', borderRadius: 4, padding: '2px 4px' }}
                    />
                    <button onClick={handleSaveEdit} style={{ background: 'none', border: 'none', color: 'var(--th-emerald)', cursor: 'pointer', fontSize: '1rem' }}>✓</button>
                    <button onClick={() => setEditingField(null)} style={{ background: 'none', border: 'none', color: 'var(--th-rose)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                  </div>
                ) : (
                  <div className="inv-hist-stat-val" style={{ color: 'var(--th-orange)', display: 'flex', alignItems: 'center' }}>
                    {currency(displayPrice)}
                    <span onClick={() => { setEditingField('price'); setTempVal(displayPrice); }} style={{ display: 'inline-flex', cursor: 'pointer' }}>{pencilIcon}</span>
                  </div>
                )}
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
