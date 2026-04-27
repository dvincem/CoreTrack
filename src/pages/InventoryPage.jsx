import React from 'react'
import { API_URL, currency, apiFetch } from '../lib/config'
import SearchInput from '../components/SearchInput'
import KpiCard from '../components/KpiCard'
import DataTable from '../components/DataTable'
import ItemHistoryModal from '../components/ItemHistoryModal'
import usePaginatedResource from '../hooks/usePaginatedResource'

/* ============================================================
   TIREHUB — ENHANCED INVENTORY PAGE
   Drop-in replacement. Requires API_URL global + currency().
   ============================================================ */

;


const invCurrency =
  typeof currency === "function"
    ? currency
    : (n) =>
        "₱" +
        Number(n || 0).toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

/* ── Toast ── */
function InvToast({ title, sub, onDone }) {
  const [out, setOut] = React.useState(false);
  React.useEffect(() => {
    const t1 = setTimeout(() => setOut(true), 2600);
    const t2 = setTimeout(onDone, 2900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);
  return (
    <div className={`inv-toast${out ? " out" : ""}`}>
      <div className="inv-toast-icon">✓</div>
      <div>
        <div className="inv-toast-title">{title}</div>
        {sub && <div className="inv-toast-sub">{sub}</div>}
      </div>
    </div>
  );
}

/* ── History Panel ── */

/* ── Create Order Modal ── */
function CreateOrderModal({
  suppliers,
  orderItems,
  orderNotes,
  orderSearchQuery,
  orderModalCurrentPage,
  orderModalTotalPages,
  orderModalCurrentItems,
  filteredOrderItems,
  orderModalTotalCount,
  totalOrderAmount,
  loading,
  error,
  onClose,
  onAddItem,
  onUpdateQty,
  onUpdateSupplier,
  onRemoveItem,
  onSearchChange,
  onPageChange,
  onNotesChange,
  onSubmit,
  ORDER_MODAL_ITEMS_PER_PAGE,
}) {
  const [leftTab, setLeftTab] = React.useState("existing"); // "existing" | "new"
  const [newItemForm, setNewItemForm] = React.useState({
    brand: "", supplier_id: "", design: "", size: "", category: "",
    unit_cost: "", selling_price: "", quantity: "1", reorder_point: "0",
  });
  const [newItemError, setNewItemError] = React.useState("");
  
  const [dbSizes, setDbSizes] = React.useState([]);
  const [showSizeSug, setShowSizeSug] = React.useState(false);

  React.useEffect(() => {
    apiFetch(`${API_URL}/item-sizes/any`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) setDbSizes(d);
      })
      .catch(() => {});
  }, []);

  const sizeSuggestions = React.useMemo(() => {
    if (!newItemForm.size) return [];
    const q = newItemForm.size.toLowerCase();
    return dbSizes.filter(s => s.toLowerCase().includes(q)).slice(0, 8);
  }, [newItemForm.size, dbSizes]);

  // All unique brands available from at least 1 supplier
  const availableBrands = React.useMemo(() => {
    const seen = new Set();
    const brands = [];
    for (const s of (suppliers || [])) {
      for (const b of (s.supplier_brands || [])) {
        if (!seen.has(b.brand_name)) { seen.add(b.brand_name); brands.push(b.brand_name); }
      }
    }
    return brands.sort();
  }, [suppliers]);

  // Suppliers that carry the selected brand
  const suppliersForBrand = React.useMemo(() => {
    if (!newItemForm.brand) return [];
    return (suppliers || []).filter(s =>
      (s.supplier_brands || []).some(b => b.brand_name === newItemForm.brand)
    );
  }, [suppliers, newItemForm.brand]);

  function handleNewBrandChange(brand) {
    setNewItemForm(f => ({ ...f, brand, supplier_id: "" }));
  }

  function addNewItemToOrder() {
    setNewItemError("");
    if (!newItemForm.brand) return setNewItemError("Select a brand");
    if (!newItemForm.supplier_id) return setNewItemError("Select a supplier");
    if (!newItemForm.design.trim()) return setNewItemError("Design is required");
    if (!newItemForm.size.trim()) return setNewItemError("Size is required");
    if (!newItemForm.category.trim()) return setNewItemError("Category is required");
    if (!newItemForm.unit_cost || parseFloat(newItemForm.unit_cost) <= 0) return setNewItemError("Unit cost is required");
    if (!newItemForm.selling_price || parseFloat(newItemForm.selling_price) <= 0) return setNewItemError("Selling price is required");
    const qty = parseInt(newItemForm.quantity) || 1;
    const cost = parseFloat(newItemForm.unit_cost);
    const label = `${newItemForm.brand} ${newItemForm.design} ${newItemForm.size}`;
    onAddItem({
      item_id: `NEW-${Date.now()}-${Math.random()}`,
      item_name: label,
      sku: `NEW-${newItemForm.brand}-${newItemForm.size}`,
      is_new_item: true,
      brand: newItemForm.brand,
      design: newItemForm.design,
      size: newItemForm.size,
      category: newItemForm.category,
      unit_cost: cost,
      selling_price: parseFloat(newItemForm.selling_price),
      quantity: qty,
      reorder_point: parseInt(newItemForm.reorder_point) || 0,
      supplier_id: newItemForm.supplier_id,
      current_quantity: 0,
      line_total: cost * qty,
    });
    setNewItemForm({ brand: "", supplier_id: "", design: "", size: "", category: "", unit_cost: "", selling_price: "", quantity: "1", reorder_point: "0" });
    setNewItemError("");
  }

  const tabBtn = (tab, label) => (
    <button onClick={() => setLeftTab(tab)} style={{
      flex: 1, padding: "0.5rem 0.75rem", cursor: "pointer",
      fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "0.82rem",
      textTransform: "uppercase", letterSpacing: "0.06em",
      border: "none", borderBottom: leftTab === tab ? "2px solid var(--th-orange,#f97316)" : "2px solid transparent",
      background: "transparent",
      color: leftTab === tab ? "var(--th-orange,#f97316)" : "var(--th-text-dim,#94a3b8)",
      transition: "color 0.15s, border-color 0.15s",
    }}>{label}</button>
  );

  return (
    <div
      className="inv-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="inv-modal">
        <div className="inv-modal-header">
          <div className="inv-modal-title">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{
                display: "inline",
                marginRight: 6,
                verticalAlign: "middle",
              }}
            >
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            Create Purchase Order
          </div>
          <button className="inv-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="inv-modal-body">
          <div className="inv-modal-2col">
            {/* LEFT: item picker */}
            <div>
              <div style={{ display: "flex", borderBottom: "1px solid var(--th-border,#283245)", marginBottom: "0.6rem" }}>
                {tabBtn("existing", "Existing Items")}
                {tabBtn("new", "+ New Item")}
              </div>

              {leftTab === "new" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                  <div>
                    <label style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Brand <span style={{color:"#38bdf8"}}>*</span></label>
                    <select className="inv-input" value={newItemForm.brand} onChange={e => handleNewBrandChange(e.target.value)}>
                      <option value="">— Select brand —</option>
                      {availableBrands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    {availableBrands.length === 0 && <div style={{ fontSize: "0.75rem", color: "#fb7185", marginTop: "0.25rem" }}>No brands added to any supplier yet. Add brands in the Suppliers page first.</div>}
                  </div>
                  {newItemForm.brand && (
                    <div>
                      <label style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Supplier <span style={{color:"#38bdf8"}}>*</span></label>
                      <select className="inv-input" value={newItemForm.supplier_id} onChange={e => setNewItemForm(f => ({...f, supplier_id: e.target.value}))}>
                        <option value="">— Select supplier —</option>
                        {suppliersForBrand.map(s => <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>)}
                      </select>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    <div>
                      <label style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Design <span style={{color:"#38bdf8"}}>*</span></label>
                      <input className="inv-input" placeholder="e.g. Turanza" value={newItemForm.design} onChange={e => setNewItemForm(f => ({...f, design: e.target.value}))} />
                    </div>
                    <div style={{ position: "relative" }}>
                      <label style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Size <span style={{color:"#38bdf8"}}>*</span></label>
                      <input className="inv-input" placeholder="e.g. 205/65R16" value={newItemForm.size} onChange={e => setNewItemForm(f => ({...f, size: e.target.value}))} onFocus={() => setShowSizeSug(true)} onBlur={() => setTimeout(() => setShowSizeSug(false), 200)} />
                      {showSizeSug && sizeSuggestions.length > 0 && (
                        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--th-bg-input,#1a2132)", border: "1px solid var(--th-border-strong,#3d5068)", borderRadius: "8px", overflowY: "auto", maxHeight: "150px", zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                          {sizeSuggestions.map(s => (
                            <div key={s} onMouseDown={() => { setNewItemForm(f => ({...f, size: s})); setShowSizeSug(false); }} style={{ padding: "0.5rem 0.75rem", cursor: "pointer", borderBottom: "1px solid var(--th-border-mid,#283245)", fontSize: "0.85rem", color: "var(--th-text-primary,#f8fafc)" }} onMouseEnter={e => e.currentTarget.style.background = "var(--th-border-mid,#283245)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>{s}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Category <span style={{color:"#38bdf8"}}>*</span></label>
                      <select className="inv-input" value={newItemForm.category} onChange={e => setNewItemForm(f => ({...f, category: e.target.value}))}>
                        <option value="">— Select —</option>
                        {["PCR","SUV","TRUCK","MOTORCYCLE","VALVE","WEIGHT","SEALANT","MISC"].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Qty to Order <span style={{color:"#38bdf8"}}>*</span></label>
                      <input className="inv-input" type="number" min="1" placeholder="1" value={newItemForm.quantity} onChange={e => setNewItemForm(f => ({...f, quantity: e.target.value}))} />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Unit Cost <span style={{color:"#38bdf8"}}>*</span></label>
                      <input className="inv-input" type="number" min="0" step="0.01" placeholder="0.00" value={newItemForm.unit_cost} onChange={e => setNewItemForm(f => ({...f, unit_cost: e.target.value}))} />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Selling Price <span style={{color:"#38bdf8"}}>*</span></label>
                      <input className="inv-input" type="number" min="0" step="0.01" placeholder="0.00" value={newItemForm.selling_price} onChange={e => setNewItemForm(f => ({...f, selling_price: e.target.value}))} />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Reorder Point</label>
                      <input className="inv-input" type="number" min="0" placeholder="0" value={newItemForm.reorder_point} onChange={e => setNewItemForm(f => ({...f, reorder_point: e.target.value}))} />
                    </div>
                  </div>
                  {newItemError && <div style={{ fontSize: "0.8rem", color: "#fb7185", background: "rgba(251,113,133,0.1)", border: "1px solid #fb7185", borderRadius: 6, padding: "0.4rem 0.65rem" }}>{newItemError}</div>}
                  <button className="inv-btn inv-btn-emerald" onClick={addNewItemToOrder} style={{ marginTop: "0.25rem" }}>+ Add to Order</button>
                </div>
              ) : (
              <>
              <div className="inv-modal-section-title">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                Select Items
              </div>
              <div style={{ position: "relative", marginBottom: "0.4rem" }}>
                <input
                  className="inv-input"
                  style={{ paddingLeft: "2rem" }}
                  placeholder="Search by name, SKU, brand, size…"
                  value={orderSearchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                />
                <span
                  style={{
                    position: "absolute",
                    left: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#475569",
                    pointerEvents: "none",
                  }}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
              </div>

              <div style={{ maxHeight: "380px", overflowY: "auto" }}>
                {orderModalCurrentItems.map((item) => {
                  const qty = item.current_quantity || 0;
                  const inOrder = orderItems.some(
                    (o) => o.item_id === item.item_id,
                  );
                  const stockCls = qty <= 0 ? "out" : qty <= 2 ? "critical" : qty <= 3 ? "low" : "ok";
                  return (
                    <div
                      key={item.item_id}
                      className={`inv-order-item-row${inOrder ? " in-order" : ""}`}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="inv-order-item-name">
                          {item.item_name}
                        </div>
                        <div className="inv-order-item-meta">{item.sku}</div>
                        <div
                          className={`inv-order-item-stock inv-stock-badge ${stockCls}`}
                          style={{ display: "inline-block", marginTop: 3 }}
                        >
                          Stock: {qty}
                        </div>
                      </div>
                      <button
                        className="inv-btn inv-btn-sky inv-btn-sm"
                        onClick={() => onAddItem(item)}
                        style={{ marginLeft: "0.5rem" }}
                      >
                        {inOrder ? "+" : "+ Add"}
                      </button>
                    </div>
                  );
                })}
              </div>

              {orderModalTotalCount > ORDER_MODAL_ITEMS_PER_PAGE && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: "0.6rem",
                    paddingTop: "0.5rem",
                    borderTop: "1px solid #283245",
                  }}
                >
                  <span style={{ fontSize: "0.7rem", color: "#475569" }}>
                    {orderModalCurrentPage * ORDER_MODAL_ITEMS_PER_PAGE -
                      ORDER_MODAL_ITEMS_PER_PAGE +
                      1}
                    –
                    {Math.min(
                      orderModalCurrentPage * ORDER_MODAL_ITEMS_PER_PAGE,
                      orderModalTotalCount,
                    )}{" "}
                    of {orderModalTotalCount}
                  </span>
                  <div style={{ display: "flex", gap: "0.35rem" }}>
                    <button
                      className="inv-page-btn"
                      disabled={orderModalCurrentPage === 1}
                      onClick={() => onPageChange(orderModalCurrentPage - 1)}
                    >
                      ← Prev
                    </button>
                    <span className="inv-page-current">
                      {orderModalCurrentPage}/{orderModalTotalPages}
                    </span>
                    <button
                      className="inv-page-btn"
                      disabled={orderModalCurrentPage === orderModalTotalPages}
                      onClick={() => onPageChange(orderModalCurrentPage + 1)}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
              </>
              )}
            </div>

            {/* RIGHT: order cart */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {/* Cart header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "0.5rem", borderBottom: "1px solid var(--th-border,#283245)" }}>
                <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--th-text-dim,#94a3b8)" }}>
                  Order Items
                </span>
                <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "0.78rem", background: orderItems.length > 0 ? "rgba(249,115,22,0.15)" : "rgba(100,116,139,0.12)", color: orderItems.length > 0 ? "var(--th-orange,#f97316)" : "#475569", border: `1px solid ${orderItems.length > 0 ? "rgba(249,115,22,0.3)" : "#283245"}`, borderRadius: 20, padding: "0.1rem 0.6rem" }}>
                  {orderItems.length} {orderItems.length === 1 ? "item" : "items"}
                </span>
              </div>

              {/* Cart items */}
              <div style={{ flex: 1, minHeight: 0, maxHeight: "300px", overflowY: "auto" }}>
                {orderItems.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "120px", gap: "0.5rem", color: "#3d5068" }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
                      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                    </svg>
                    <span style={{ fontSize: "0.78rem" }}>No items added yet</span>
                  </div>
                ) : (
                  orderItems.map((oi) => (
                    <div key={oi.order_item_id} style={{ borderBottom: "1px solid var(--th-border,#283245)", padding: "0.4rem 0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <div className="inv-order-cart-info" style={{ flex: 1, minWidth: 0 }}>
                          <div className="inv-order-cart-name" style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
                            {oi.item_name}
                            {oi.is_new_item && <span style={{ fontSize: "0.62rem", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", background: "rgba(52,211,153,0.15)", border: "1px solid #34d399", color: "#34d399", borderRadius: 4, padding: "0.05rem 0.35rem", lineHeight: 1.4 }}>NEW</span>}
                          </div>
                          <div className="inv-order-cart-sku">{oi.is_new_item ? `${oi.category}` : oi.sku}</div>
                        </div>
                        <button className="inv-qty-btn" onClick={() => onUpdateQty(oi.order_item_id, oi.quantity - 1)}>−</button>
                        <input
                          className="inv-qty-display"
                          type="number"
                          value={oi.quantity}
                          onChange={(e) => onUpdateQty(oi.order_item_id, parseInt(e.target.value) || 1)}
                        />
                        <button className="inv-qty-btn" onClick={() => onUpdateQty(oi.order_item_id, oi.quantity + 1)}>+</button>
                        <div className="inv-order-line-total">{invCurrency(oi.line_total)}</div>
                        <button className="inv-cancel-btn" onClick={() => onRemoveItem(oi.order_item_id)}>✕</button>
                      </div>
                      {/* Supplier selector — prefer brand-matched suppliers, fall back to all */}
                      {!oi.is_new_item && (() => {
                        const allSuppliers = suppliers || [];
                        const itemBrand = (oi.brand || "").trim().toUpperCase();
                        const brandSuppliers = allSuppliers.filter(s =>
                          (s.supplier_brands || []).some(b =>
                            b.brand_name.trim().toUpperCase() === itemBrand
                          )
                        );
const listToShow = brandSuppliers.length > 0 ? brandSuppliers : allSuppliers;
                        const isFallback = brandSuppliers.length === 0 && allSuppliers.length > 0;
                        if (allSuppliers.length === 0) {
                          return (
                            <div style={{ marginTop: "0.3rem", fontSize: "0.72rem", color: "#fb7185", background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.3)", borderRadius: 5, padding: "0.25rem 0.5rem" }}>
                              ⚠ No suppliers found. Add suppliers first.
                            </div>
                          );
                        }
                        return (
                          <div style={{ marginTop: "0.3rem" }}>
                            {isFallback && (
                              <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginBottom: "0.2rem" }}>
                                No supplier has "{oi.brand}" registered — showing all suppliers
                              </div>
                            )}
                            <select
                              value={oi.supplier_id || ""}
                              onChange={(e) => onUpdateSupplier(oi.order_item_id, e.target.value)}
                              style={{ width: "100%", fontSize: "0.75rem", padding: "0.25rem 0.4rem", borderRadius: 5, border: oi.supplier_id ? "1px solid var(--th-border,#283245)" : "1px solid #f97316", background: "var(--th-bg-input,#1a2132)", color: oi.supplier_id ? "var(--th-text-muted,#94a3b8)" : "#f97316", outline: "none", cursor: "pointer" }}
                            >
                              <option value="">⚠ Select supplier…</option>
                              {listToShow.map(s => (
                                <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })()}
                      {oi.is_new_item && oi.supplier_id && (
                        <div style={{ marginTop: "0.25rem", fontSize: "0.72rem", color: "#64748b" }}>
                          📦 {(suppliers || []).find(s => s.supplier_id === oi.supplier_id)?.supplier_name || "Supplier linked"}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="inv-form-label">Order Notes (optional)</label>
                <textarea
                  className="inv-textarea"
                  rows="2"
                  value={orderNotes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  placeholder="e.g., Rush delivery, special request…"
                />
              </div>

              {/* Total */}
              <div className="inv-order-total-bar">
                <span className="inv-order-total-label">Order Total</span>
                <span className="inv-order-total-amount">{invCurrency(totalOrderAmount)}</span>
              </div>

              {error && (
                <div className="inv-error">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="inv-modal-footer">
          <button
            className="inv-btn inv-btn-slate"
            style={{ flex: "0 0 auto", minWidth: 110 }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="inv-btn inv-btn-orange"
            style={{ flex: 1 }}
            disabled={loading || orderItems.length === 0}
            onClick={onSubmit}
          >
            {loading ? "Creating…" : `✓ Create Order${orderItems.length > 0 ? ` (${orderItems.length})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
function InventoryPage({ shopId, setPageContext }) {
  // Re-render when theme changes
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => {
    const obs = new MutationObserver(() => forceUpdate());
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);

  const [searchSuggestions, setSearchSuggestions] = React.useState([]);
  const [showCreateOrderModal, setShowCreateOrderModal] = React.useState(false);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [pendingOrder, setPendingOrder] = React.useState(null);

  const ITEMS_PER_PAGE = 10;
  const ORDER_MODAL_ITEMS_PER_PAGE = 10;
  const {
    data: items,
    page: currentPage, setPage: setCurrentPage,
    totalPages: itemsTotalPages,
    loading: itemsLoading,
    search: searchQuery, setSearch: setSearchQuery,
    refetch: refetchItems,
  } = usePaginatedResource({
    url: `${API_URL}/items/${shopId}`,
    perPage: ITEMS_PER_PAGE,
    enabled: !!shopId,
    deps: [shopId],
  });
  const filteredItems = items;

  const [selectedItemForHistory, setSelectedItemForHistory] =
    React.useState(null);
  const [itemHistory, setItemHistory] = React.useState([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);

  const [orderItems, setOrderItems] = React.useState([]);
  const [orderNotes, setOrderNotes] = React.useState("");
  const [orderSearchQuery, setOrderSearchQuery] = React.useState("");
  const [orderModalCurrentPage, setOrderModalCurrentPage] = React.useState(1);
  const [orderModalItems, setOrderModalItems] = React.useState([]);
  const [orderModalTotalCount, setOrderModalTotalCount] = React.useState(0);
  const [orderModalTotalPagesSrv, setOrderModalTotalPagesSrv] = React.useState(1);
  const [orderModalLoading, setOrderModalLoading] = React.useState(false);

  const [suppliers, setSuppliers] = React.useState([]);
  const [kpi, setKpi] = React.useState(null);

  // Quick Order mode
  const [quickOrderMode, setQuickOrderMode] = React.useState(false);
  const [quickSelected, setQuickSelected] = React.useState(new Set());

  React.useEffect(() => {
    fetchSuppliers();
    fetchKpi();
  }, [shopId]);

  React.useEffect(() => {
    if (!showCreateOrderModal) return;
    setOrderModalCurrentPage(1);
  }, [orderSearchQuery, showCreateOrderModal]);

  React.useEffect(() => {
    if (!showCreateOrderModal) return;
    const t = setTimeout(() => { fetchOrderModalItems(); }, 300);
    return () => clearTimeout(t);
  }, [showCreateOrderModal, orderSearchQuery, orderModalCurrentPage, shopId]);

  async function fetchOrderModalItems() {
    setOrderModalLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(orderModalCurrentPage),
        perPage: String(ORDER_MODAL_ITEMS_PER_PAGE),
      });
      if (orderSearchQuery.trim()) qs.set('q', orderSearchQuery.trim());
      const r = await apiFetch(`${API_URL}/items/${shopId}?${qs.toString()}`);
      const d = await r.json();
      const rows = Array.isArray(d?.data) ? d.data : (Array.isArray(d) ? d : []);
      setOrderModalItems(rows);
      setOrderModalTotalCount(d?.meta?.total ?? rows.length);
      setOrderModalTotalPagesSrv(d?.meta?.totalPages || 1);
    } catch {
      setOrderModalItems([]); setOrderModalTotalCount(0); setOrderModalTotalPagesSrv(1);
    }
    setOrderModalLoading(false);
  }

  async function fetchKpi() {
    try {
      const r = await apiFetch(`${API_URL}/items-kpi/${shopId}`);
      const d = await r.json();
      if (d && !d.error) setKpi(d);
    } catch { /* non-fatal — KPI card falls back to client aggregation */ }
  }

  React.useEffect(() => {
    if (!searchQuery.trim()) { setSearchSuggestions([]); return; }
    const q = searchQuery.toLowerCase();
    const seen = new Set();
    const sugs = [];
    for (const item of items) {
      for (const [field, type, icon] of [
        [item.item_name, "Item", "📦"],
        [item.sku, "SKU", "🔖"],
        [item.brand, "Brand", "🏷️"],
        [item.design, "Design", "✨"],
        [item.size, "Size", "📏"],
      ]) {
        if (field && field.toLowerCase().startsWith(q) && !seen.has(field)) {
          seen.add(field);
          sugs.push({ text: field, type, icon });
          if (sugs.length >= 8) break;
        }
      }
      if (sugs.length >= 8) break;
    }
    setSearchSuggestions(sugs);
  }, [searchQuery, items]);

  async function fetchSuppliers() {
    try {
      const qs = shopId ? `?shop_id=${encodeURIComponent(shopId)}` : '';
      const r = await apiFetch(`${API_URL}/suppliers${qs}`);
      setSuppliers((await r.json()) || []);
    } catch (err) {
      console.error('fetchSuppliers failed:', err);
    }
  }

  const HISTORY_PAGE_SIZE = 50;
  const [historyPage, setHistoryPage] = React.useState(1);
  const [historyTotalPages, setHistoryTotalPages] = React.useState(1);
  const [historyLoadingMore, setHistoryLoadingMore] = React.useState(false);

  async function fetchItemHistory(itemId, { append = false, page = 1 } = {}) {
    if (append) setHistoryLoadingMore(true); else setHistoryLoading(true);
    try {
      const r = await apiFetch(
        `${API_URL}/inventory-ledger/${shopId}?item_id=${itemId}&page=${page}&perPage=${HISTORY_PAGE_SIZE}`,
      );
      const d = await r.json();
      const rows = Array.isArray(d?.data) ? d.data : (Array.isArray(d) ? d : []);
      setItemHistory(prev => (append ? [...prev, ...rows] : rows));
      setHistoryTotalPages(d?.meta?.totalPages || 1);
      setHistoryPage(page);
    } catch {
      if (!append) setItemHistory([]);
    }
    setHistoryLoading(false);
    setHistoryLoadingMore(false);
  }

  async function loadMoreHistory() {
    if (!selectedItemForHistory || historyPage >= historyTotalPages) return;
    await fetchItemHistory(selectedItemForHistory.item_id, { append: true, page: historyPage + 1 });
  }

  async function handleItemClick(item) {
    setSelectedItemForHistory(item);
    await fetchItemHistory(item.item_id);
  }

  function addItemToOrder(item) {
    const existing = orderItems.find((o) => o.item_id === item.item_id);
    if (existing) {
      setOrderItems(
        orderItems.map((o) =>
          o.item_id === item.item_id
            ? {
                ...o,
                quantity: o.quantity + 1,
                line_total: (o.quantity + 1) * o.unit_cost,
              }
            : o,
        ),
      );
    } else {
      setOrderItems([
        ...orderItems,
        {
          ...item,
          order_item_id: `TEMP-${Date.now()}`,
          quantity: item.quantity || 1,
          unit_cost: item.unit_cost,
          line_total: (item.quantity || 1) * item.unit_cost,
        },
      ]);
    }
  }

  function removeFromOrder(id) {
    setOrderItems(orderItems.filter((o) => o.order_item_id !== id));
  }

  function updateOrderSupplier(id, supplier_id) {
    setOrderItems(orderItems.map((o) => o.order_item_id === id ? { ...o, supplier_id } : o));
  }

  function updateOrderQuantity(id, qty) {
    if (qty <= 0) {
      removeFromOrder(id);
      return;
    }
    setOrderItems(
      orderItems.map((o) =>
        o.order_item_id === id
          ? { ...o, quantity: qty, line_total: qty * o.unit_cost }
          : o,
      ),
    );
  }

  function toggleQuickSelect(itemId) {
    setQuickSelected(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (quickSelected.size === currentItems.length) {
      setQuickSelected(new Set());
    } else {
      setQuickSelected(new Set(currentItems.map(i => i.item_id)));
    }
  }

  function launchQuickOrder() {
    for (const itemId of quickSelected) {
      const item = items.find(i => i.item_id === itemId);
      if (!item) continue;
      const brandUpper = (item.brand || "").trim().toUpperCase();
      const brandSuppliers = suppliers.filter(s =>
        (s.supplier_brands || []).some(b => b.brand_name.trim().toUpperCase() === brandUpper)
      );
      const autoSupplier = brandSuppliers.length === 1 ? brandSuppliers[0] : null;
      const newEntry = {
        ...item,
        order_item_id: `TEMP-${Date.now()}-${Math.random()}`,
        quantity: 1,
        line_total: item.unit_cost,
        supplier_id: autoSupplier ? autoSupplier.supplier_id : null,
        supplier_name: autoSupplier ? autoSupplier.supplier_name : null,
      };
      setOrderItems(prev => {
        const existing = prev.find(o => o.item_id === item.item_id);
        if (existing) return prev;
        return [...prev, newEntry];
      });
    }
    setQuickOrderMode(false);
    setQuickSelected(new Set());
    setShowCreateOrderModal(true);
    setOrderModalCurrentPage(1);
  }

  function submitOrder() {
    if (orderItems.length === 0) {
      setError("Add items to the order first");
      return;
    }
    const missingSupplier = orderItems.filter(o => !o.supplier_id);
    if (missingSupplier.length > 0) {
      setError(`Select a supplier for: ${missingSupplier.map(o => o.item_name).join(", ")}`);
      return;
    }
    const supplierNames = [...new Set(orderItems.map(o => (suppliers.find(s => s.supplier_id === o.supplier_id) || {}).supplier_name || o.supplier_id))];
    const totalQty = orderItems.reduce((s, o) => s + (o.quantity || 0), 0);
    const totalCost = orderItems.reduce((s, o) => s + ((o.quantity || 0) * (o.unit_cost || 0)), 0);
    setPendingOrder({ items: orderItems, notes: orderNotes, supplierNames, totalQty, totalCost });
  }

  async function confirmSubmitOrder() {
    const fd = pendingOrder;
    setPendingOrder(null);
    // Group by supplier → one order per supplier
    const groups = {};
    for (const o of fd.items) {
      const sid = o.supplier_id;
      if (!groups[sid]) groups[sid] = [];
      groups[sid].push(o);
    }
    setLoading(true);
    try {
      const supplierIds = Object.keys(groups);
      const results = await Promise.all(supplierIds.map(sid => {
        const groupItems = groups[sid];
        const supplierName = (suppliers.find(s => s.supplier_id === sid) || {}).supplier_name || sid;
        return apiFetch(`${API_URL}/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shop_id: shopId,
            items: groupItems.filter(o => !o.is_new_item).map(o => ({
              item_id: o.item_id, quantity: o.quantity, unit_cost: o.unit_cost, supplier_id: sid,
            })),
            new_items: groupItems.filter(o => o.is_new_item).map(o => ({
              brand: o.brand, design: o.design, size: o.size, category: o.category,
              unit_cost: o.unit_cost, selling_price: o.selling_price,
              quantity: o.quantity, reorder_point: o.reorder_point || 0, supplier_id: sid,
            })),
            order_notes: `${fd.notes || "Order from inventory"} — ${supplierName}`,
          }),
        }).then(r => r.json()).then(res => { if (res.error) throw new Error(res.error); return res; });
      }));
      setOrderItems([]);
      setOrderNotes("");
      setShowCreateOrderModal(false);
      setError("");
      setToast({
        title: results.length > 1 ? `${results.length} Orders Created` : "Order Created",
        sub: results.length > 1 ? `Split across ${results.length} suppliers` : `Total: ${invCurrency(results[0].total_amount)}`,
      });
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  /* Derived — server supplies the filtered+paginated slice; sort only within the page. */
  const currentItems = filteredItems || [];
  const totalPages   = itemsTotalPages;

  // Order-modal list: server-paginated; sort within the visible page only.
  const orderModalCurrentItems = orderModalItems || [];
  const filteredOrderItems = orderModalCurrentItems; // kept for modal prop compatibility
  const orderModalTotalPages = orderModalTotalPagesSrv;
  const totalOrderAmount = orderItems.reduce((s, o) => s + o.line_total, 0);

  // ── AI Context ────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (items.length > 0 || kpi) {
      let totalItems, totalStock, stockValue, lowStock;
      if (kpi) {
        totalItems = kpi.totalItems;
        totalStock = kpi.totalStockUnits;
        stockValue = kpi.stockValueCost;
        lowStock = kpi.lowStockCount;
      } else {
        const activeItems = items.filter(i => i.is_active !== 0);
        totalItems = activeItems.length;
        totalStock = activeItems.reduce((s, i) => s + (i.current_quantity || 0), 0);
        stockValue = activeItems.reduce((s, i) => s + (i.current_quantity || 0) * (i.unit_cost || 0), 0);
        lowStock = activeItems.filter(i => { 
          const rp = i.reorder_point ?? 5; 
          return (i.current_quantity || 0) > 0 && (i.current_quantity || 0) <= rp; 
        }).length;
      }

      setPageContext({
        view: "Inventory Management",
        metrics: {
          total_unique_items: totalItems,
          total_stock_units: totalStock,
          total_inventory_value: stockValue,
          low_stock_count: lowStock
        }
      });
    }
  }, [items, kpi, setPageContext]);

  // ── DataTable column definitions ──
  const invColumns = [
    ...(quickOrderMode ? [{
      key: '_select',
      sortable: false,
      label: (
        <input
          type="checkbox"
          checked={currentItems.length > 0 && quickSelected.size === currentItems.length}
          onChange={toggleSelectAll}
          style={{ cursor: 'pointer', accentColor: 'var(--th-amber)' }}
        />
      ),
      width: 36,
      align: 'center',
      render: (item) => (
        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'center' }}>
          <input
            type="checkbox"
            checked={quickSelected.has(item.item_id)}
            onChange={() => toggleQuickSelect(item.item_id)}
            style={{ cursor: 'pointer', accentColor: 'var(--th-amber)' }}
          />
        </div>
      ),
    }] : []),
    {
      key: 'sku', label: 'SKU',
      render: (item) => <span className="inv-td-sku">{item.sku}</span>,
    },
    {
      key: 'brand', label: 'Brand',
      render: (item) => {
        const qty = item.current_quantity || 0;
        const isLowStock = qty > 0 && qty <= 3;
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', maxWidth: '100%' }}>
            <span className="inv-td-name">{item.brand || '\u2014'}</span>
            {isLowStock && (
              <span
                title={qty <= 2 ? 'Critical \u2014 restock immediately' : 'Low stock \u2014 reorder soon'}
                style={{ color: qty <= 2 ? '#fb7185' : '#f59e0b', fontSize: '1.05rem', lineHeight: 1, flexShrink: 0 }}
              >⚠</span>
            )}
          </span>
        );
      },
    },
    {
      key: 'design', label: 'Design',
      render: (item) => <span className="inv-td-name">{item.design || '\u2014'}</span>,
    },
    {
      key: 'size', label: 'Size',
      render: (item) => <span className="inv-td-size">{item.size || '\u2014'}</span>,
    },
    {
      key: 'dot_number', label: 'DOT',
      render: (item) => item.dot_number ? (
        <span style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', padding: '0.12rem 0.4rem', borderRadius: 4, fontSize: '0.72rem', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: '0.04em' }}>
          {item.dot_number}
        </span>
      ) : '\u2014',
    },
    {
      key: 'unit_cost', label: 'Unit Cost', align: 'right',
      render: (item) => (
        <span style={{ color: 'var(--th-sky)', fontWeight: 600 }}>
          {invCurrency(item.unit_cost || 0)}
        </span>
      ),
    },
    {
      key: 'selling_price', label: 'Sell Price', align: 'right',
      render: (item) => <span className="inv-price-val">{invCurrency(item.selling_price || 0)}</span>,
    },
    {
      key: 'profit', label: 'Profit/Unit', align: 'right',
      render: (item) => {
        const profit = (item.selling_price || 0) - (item.unit_cost || 0);
        return <span className={`inv-profit-badge ${profit >= 0 ? 'pos' : 'neg'}`}>{invCurrency(profit)}</span>;
      },
    },
    {
      key: 'current_quantity', label: 'Stock', align: 'center',
      render: (item) => {
        const qty = item.current_quantity || 0;
        const stockCls = qty <= 0 ? 'out' : qty <= 2 ? 'critical' : qty <= 3 ? 'low' : 'ok';
        return <span className={`inv-stock-badge ${stockCls}`}>{qty}</span>;
      },
    },
  ];

  return (
    <>
      <style>{`
        .inv-main {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: .5rem;
            overflow: hidden;
            min-width: 0;
        }
        @media (min-width: 641px) {
            .si-wrap {
            }
        }
        .inv-mobile-action-btns  { display: none; }
        .inv-mobile-title-bar    { display: none; }
        @media (max-width: 640px) {
          .inv-mobile-title-bar    { display: block; order: 1; text-align: center; }
          .inv-kpi-grid            { order: 2; }
          .si-wrap                 { margin-bottom: 0; order: 3; }
          .inv-mobile-action-btns  { display: flex !important; order: 4; gap: 0.5rem; }
          .inv-mobile-action-btns .inv-btn { flex: 1; justify-content: center; }
          .inv-header-and-search   { order: 5; }
          .inv-header-and-search .inv-title { display: none; }
          .inv-header-btns         { display: none !important; }
          .inv-sec-table           { order: 6; }
          .inv-table-section       { order: 7; }
          .inv-error               { order: 8; }
        }
        @media (max-width: 768px) {
          .th-section-label {
            font-size: 0.7rem;
            margin-bottom: .5rem;
          }
        }
        `}</style>      {toast && (
        <InvToast
          title={toast.title}
          sub={toast.sub}
          onDone={() => setToast(null)}
        />
      )}

      {showCreateOrderModal && (
        <CreateOrderModal
          items={items}
          suppliers={suppliers}
          orderItems={orderItems}
          orderNotes={orderNotes}
          orderSearchQuery={orderSearchQuery}
          orderModalCurrentPage={orderModalCurrentPage}
          orderModalTotalPages={orderModalTotalPages}
          orderModalCurrentItems={orderModalCurrentItems}
          filteredOrderItems={filteredOrderItems}
          orderModalTotalCount={orderModalTotalCount}
          totalOrderAmount={totalOrderAmount}
          loading={loading}
          error={error}
          ORDER_MODAL_ITEMS_PER_PAGE={ORDER_MODAL_ITEMS_PER_PAGE}
          onClose={() => {
            setShowCreateOrderModal(false);
            setOrderItems([]);
            setOrderNotes("");
            setOrderSearchQuery("");
            setError("");
          }}
          onAddItem={addItemToOrder}
          onUpdateQty={updateOrderQuantity}
          onUpdateSupplier={updateOrderSupplier}
          onRemoveItem={removeFromOrder}
          onSearchChange={(v) => {
            setOrderSearchQuery(v);
            setOrderModalCurrentPage(1);
          }}
          onPageChange={setOrderModalCurrentPage}
          onNotesChange={setOrderNotes}
          onSubmit={submitOrder}
        />
      )}

      <div className="inv-root">
        {/* ── MAIN PANEL ── */}
        <div className="inv-main">
          {/* Mobile-only title (shows above KPI on mobile) */}
          <div className="inv-mobile-title-bar">
            <div className="inv-title">Inven<span>tory</span></div>
          </div>

          {/* Header + Search + Actions (grid on desktop, flex-col on mobile) */}
          <div className="inv-header-and-search">
            <div className="inv-title">
              Inven<span>tory</span>
            </div>

            <div className="inv-header-btns">
              <button
                className="inv-btn inv-btn-sky"
                onClick={() => {
                  setShowCreateOrderModal(true);
                  setOrderModalCurrentPage(1);
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                </svg>
                Create Order
              </button>
              <button
                className="inv-btn"
                style={{
                  background: quickOrderMode ? "rgba(251,191,36,0.15)" : "var(--th-bg-input)",
                  border: quickOrderMode ? "1px solid var(--th-amber)" : "1px solid var(--th-border-strong)",
                  color: quickOrderMode ? "var(--th-amber)" : "var(--th-text-dim)",
                }}
                onClick={() => {
                  setQuickOrderMode(m => !m);
                  setQuickSelected(new Set());
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 11 12 14 22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                Quick Order
              </button>
            </div>

          </div>{/* end inv-header-and-search */}

          {/* KPI Cards — sourced from /items-kpi (server-side aggregate) with
              a client-side fallback if the KPI endpoint has not resolved yet. */}
          {(kpi || items.length > 0) && (() => {
            const fmtCompact = (n) => {
              if (n >= 1_000_000) return '₱' + (n / 1_000_000).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'M';
              if (n >= 1_000) return '₱' + (n / 1_000).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'K';
              return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            };
            let totalItems, totalStock, stockValue, retailValue, lowStock;
            if (kpi) {
              totalItems  = kpi.totalItems;
              totalStock  = kpi.totalStockUnits;
              stockValue  = kpi.stockValueCost;
              retailValue = kpi.stockValueRetail;
              lowStock    = kpi.lowStockCount;
            } else {
              const activeItems = items.filter(i => i.is_active !== 0);
              totalItems  = activeItems.length;
              totalStock  = activeItems.reduce((s, i) => s + (i.current_quantity || 0), 0);
              stockValue  = activeItems.reduce((s, i) => s + (i.current_quantity || 0) * (i.unit_cost || 0), 0);
              retailValue = activeItems.reduce((s, i) => s + (i.current_quantity || 0) * (i.selling_price || 0), 0);
              lowStock    = activeItems.filter(i => { const rp = i.reorder_point ?? 5; return (i.current_quantity || 0) > 0 && (i.current_quantity || 0) <= rp; }).length;
            }
            return (
              <div className="inv-kpi-grid">
                <KpiCard label="Total Items" value={totalItems} accent="sky" sub={`${totalStock} pcs in stock`} />
                <KpiCard label="Stock Value" value={fmtCompact(stockValue)} accent="violet" sub="at cost" />
                <KpiCard label="Retail Value" value={fmtCompact(retailValue)} accent="emerald" sub="at selling price" />
                <KpiCard label="Low Stock" value={lowStock} accent={lowStock > 0 ? "rose" : "sky"} sub="at or below reorder point" />
              </div>
            );
          })()}

          {/* Search — below KPI on desktop, below KPI on mobile too */}
          <SearchInput
            className="inv-search-wrap"
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by name, SKU, brand, design, size…"
            suggestions={searchSuggestions}
            resultCount={filteredItems.length}
            totalCount={items.length}
            resultLabel="items"
          />

          {/* Mobile Actions — Create Order & Quick Order (hidden on desktop) */}
          <div className="inv-mobile-action-btns">
            <button
              className="inv-btn inv-btn-sky"
              onClick={() => {
                setShowCreateOrderModal(true);
                setOrderModalCurrentPage(1);
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
              </svg>
              Create Order
            </button>
            <button
              className="inv-btn"
              style={{
                background: quickOrderMode ? "rgba(251,191,36,0.15)" : "var(--th-bg-input)",
                border: quickOrderMode ? "1px solid var(--th-amber)" : "1px solid var(--th-border-strong)",
                color: quickOrderMode ? "var(--th-amber)" : "var(--th-text-dim)",
              }}
              onClick={() => {
                setQuickOrderMode(m => !m);
                setQuickSelected(new Set());
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 11 12 14 22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              Quick Order
            </button>
          </div>

          {/* Table + History Panel side by side (only this section shrinks) */}
          <div className="th-section-label inv-sec-table">Inventory Items</div>
          <div className="inv-table-section" style={{ display: "flex", gap: "1rem", minHeight: 0, alignItems: "flex-start" }}>
          
          <DataTable
            columns={invColumns}
            rows={currentItems}
            rowKey="item_id"
            initialSort={{ key: 'current_quantity', direction: 'asc' }}
            onRowClick={(item) => quickOrderMode ? toggleQuickSelect(item.item_id) : handleItemClick(item)}
            selectedKey={!quickOrderMode ? selectedItemForHistory?.item_id : undefined}
            getRowStyle={(item) => quickOrderMode && quickSelected.has(item.item_id)
              ? { background: 'rgba(251,191,36,0.07)', outline: '1px solid rgba(251,191,36,0.25)' }
              : undefined}
            loading={itemsLoading}
            skeletonRows={8}
            skeletonWidths={['w80', 'w40', 'w40', 'w30', 'w20', 'w60', 'w60', 'w50', 'w20']}
            emptyTitle="No Items Found"
            emptyMessage={searchQuery ? 'No items match your search.' : 'No items found.'}
            minWidth={850}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            style={{ flex: 1, minWidth: 0 }}
          />

          {/* ── QUICK ORDER FLOATING BAR ── */}
          {quickOrderMode && (
            <div style={{
              position: "fixed", bottom: "1.5rem", left: "50%", transform: "translateX(-50%)",
              background: "var(--th-bg-card)", border: "1px solid var(--th-amber)",
              borderRadius: 12, padding: "0.75rem 1.25rem",
              display: "flex", alignItems: "center", gap: "1rem",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)", zIndex: 100,
              fontFamily: "'Barlow Condensed', sans-serif",
            }}>
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--th-amber)", letterSpacing: "0.05em" }}>
                {quickSelected.size} item{quickSelected.size !== 1 ? "s" : ""} selected
              </span>
              <button
                onClick={launchQuickOrder}
                disabled={quickSelected.size === 0}
                style={{
                  padding: "0.45rem 1.1rem", borderRadius: 8, border: "none", cursor: quickSelected.size === 0 ? "not-allowed" : "pointer",
                  background: quickSelected.size > 0 ? "linear-gradient(135deg,#d97706,#fbbf24)" : "var(--th-bg-input)",
                  color: quickSelected.size > 0 ? "#000" : "var(--th-text-faint)",
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.9rem",
                  textTransform: "uppercase", letterSpacing: "0.06em", opacity: quickSelected.size === 0 ? 0.5 : 1,
                }}
              >
                ✓ Add to Order
              </button>
              <button
                onClick={() => { setQuickOrderMode(false); setQuickSelected(new Set()); }}
                style={{
                  padding: "0.45rem 0.9rem", borderRadius: 8,
                  border: "1px solid var(--th-border-strong)", background: "var(--th-bg-input)",
                  color: "var(--th-text-dim)", cursor: "pointer",
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.9rem",
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}
              >
                Cancel
              </button>
            </div>
          )}

          </div>{/* end table+panel flex row */}

          {selectedItemForHistory && (
            <ItemHistoryModal
              item={selectedItemForHistory}
              onClose={() => { setSelectedItemForHistory(null); setItemHistory([]); setHistoryPage(1); setHistoryTotalPages(1); }}
              currency={invCurrency}
              historyContent={
                historyLoading ? (
                  <div className="inv-hist-loading"><div className="inv-hist-spinner" /> Loading…</div>
                ) : itemHistory.length === 0 ? (
                  <div className="inv-hist-empty">No transactions found</div>
                ) : (<>
                  {itemHistory.map((e, i) => {
                    const tc = e.transaction_type === "PURCHASE" ? "PURCHASE" : e.transaction_type === "SALE" ? "SALE" : e.transaction_type === "ADJUSTMENT" ? "ADJUSTMENT" : "other";
                    return (
                      <div key={i} className={`inv-hist-entry ${tc}`}>
                        <div className="inv-hist-entry-top">
                          <span className={`inv-hist-type ${tc}`}>{e.transaction_type}</span>
                          <span className="inv-hist-date">
                            {new Date(e.created_at).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
                          </span>
                        </div>
                        <div className="inv-hist-entry-data">
                          <div>Qty: <b>{e.quantity}</b></div>
                          <div>Total: <b>{invCurrency((e.unit_cost || 0) * Math.abs(e.quantity))}</b></div>
                        </div>
                        {(e.ledger_dot_number || e.dot_number) && <div className="inv-hist-ref" style={{ color: "var(--th-amber, #fbbf24)", fontWeight: 700 }}>DOT {e.ledger_dot_number || e.dot_number}</div>}
                        {e.reference_id && <div className="inv-hist-ref">Ref: {e.reference_id}</div>}
                      </div>
                    );
                  })}
                  {historyPage < historyTotalPages && (
                    <button
                      className="inv-hist-loadmore"
                      onClick={loadMoreHistory}
                      disabled={historyLoadingMore}
                      style={{ marginTop: '0.75rem', padding: '0.5rem 1rem', border: '1px solid var(--th-border, #333)', borderRadius: 6, background: 'transparent', color: 'inherit', cursor: 'pointer', width: '100%' }}
                    >
                      {historyLoadingMore ? 'Loading…' : `Load more (${historyPage}/${historyTotalPages})`}
                    </button>
                  )}
                </>)
              }
            />
          )}
        </div>
      </div>

      {/* ── RECEIVE STOCK MODAL ── */}

      {/* Confirm: Submit Order */}
      {pendingOrder && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <div className="confirm-title">Confirm Create Order</div>
            <div className="confirm-details">
              <div className="confirm-detail-row"><span className="confirm-detail-label">Suppliers</span><span className="confirm-detail-val">{pendingOrder.supplierNames.join(", ")}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Items</span><span className="confirm-detail-val">{pendingOrder.items.length} line(s), {pendingOrder.totalQty} units</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Est. Cost</span><span className="confirm-detail-val">{invCurrency(pendingOrder.totalCost)}</span></div>
              {pendingOrder.notes && <div className="confirm-detail-row"><span className="confirm-detail-label">Notes</span><span className="confirm-detail-val">{pendingOrder.notes}</span></div>}
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => setPendingOrder(null)}>Cancel</button>
              <button className="confirm-btn-ok" onClick={confirmSubmitOrder} disabled={loading}>Place Order</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default InventoryPage
