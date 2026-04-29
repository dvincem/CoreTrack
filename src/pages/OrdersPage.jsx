import '../pages_css/OrdersPage.css';
import React from 'react'
import Pagination from '../components/Pagination'
import SearchInput from '../components/SearchInput'
import { API_URL, currency, apiFetch } from '../lib/config'
import usePaginatedResource from '../hooks/usePaginatedResource'

/* ============================================================
   TIREHUB — ENHANCED ORDERS PAGE
   Drop-in replacement. Requires API_URL global + currency().
   ============================================================ */

const ordCurrency =
  typeof currency === "function"
    ? currency
    : (n) =>
      "₱" +
      Number(n || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

/* ── Status helpers ── */
const STATUS_META = {
  ALL: { color: "var(--th-sky)", label: "All" },
  PENDING: { color: "var(--th-amber)", label: "Pending" },
  CONFIRMED: { color: "var(--th-sky)", label: "Confirmed" },
  RECEIVED: { color: "var(--th-emerald)", label: "Received" },
  CANCELLED: { color: "var(--th-rose)", label: "Cancelled" },
};

const STATUS_ICONS = {
  ALL: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  PENDING: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  CONFIRMED: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  RECEIVED: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
    </svg>
  ),
  CANCELLED: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
};

/* ── Toast ── */
function OrdToast({ title, sub, onDone }) {
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
    <div className={`ord-toast${out ? " out" : ""}`}>
      <div className="ord-toast-icon">✓</div>
      <div>
        <div className="ord-toast-title">{title}</div>
        {sub && <div className="ord-toast-sub">{sub}</div>}
      </div>
    </div>
  );
}

/* ── Detail item card ── */
function DetailItem({ item, orderStatus }) {
  const isReceived = item.received_status !== "NOT_RECEIVED";

  // Badge reflects order status; only show item-level received/not-received when order is RECEIVED
  let badgeClass, badgeLabel;
  if (orderStatus === "RECEIVED") {
    badgeClass = isReceived ? "RECEIVED" : "CANCELLED";
    badgeLabel = isReceived ? "✓ Rcvd" : "✕ Not Rcvd";
  } else if (orderStatus === "CONFIRMED") {
    badgeClass = "CONFIRMED";
    badgeLabel = "✓ Confirmed";
  } else if (orderStatus === "CANCELLED") {
    badgeClass = "CANCELLED";
    badgeLabel = "✕ Cancelled";
  } else {
    badgeClass = "PENDING";
    badgeLabel = "Pending";
  }

  const showAmounts = orderStatus === "RECEIVED" && isReceived;

  return (
    <div
      className={`ord-detail-item ${orderStatus === "RECEIVED" ? (isReceived ? "received" : "not-received") : ""}`}
    >
      <div className="ord-detail-item-top">
        <div style={{ flex: 1 }}>
          <div className="ord-detail-item-name" style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
            {item.item_name}
            {item.is_new_item ? <span style={{ fontSize: "0.62rem", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: "uppercase", background: "rgba(52,211,153,0.15)", border: "1px solid #34d399", color: "#34d399", borderRadius: 4, padding: "0.05rem 0.35rem", lineHeight: 1.4 }}>NEW</span> : null}
          </div>
          {item.supplier_name && <div className="ord-detail-item-sku" style={{ color: "#38bdf8" }}>📦 {item.supplier_name}</div>}
          {item.sku && !item.is_new_item && <div className="ord-detail-item-sku">{item.sku}</div>}
          {item.dot_number && <div className="ord-detail-item-sku" style={{ color: "var(--th-amber, #fbbf24)", fontWeight: 700 }}>DOT {item.dot_number}</div>}
        </div>
        <span className={`ord-badge ${badgeClass}`}>
          {badgeLabel}
        </span>
      </div>
      <div className="ord-detail-item-stats">
        <div className="ord-detail-stat">
          <div className="ord-detail-stat-label">Qty</div>
          <div className="ord-detail-stat-val">{item.quantity}</div>
        </div>
        <div className="ord-detail-stat">
          <div className="ord-detail-stat-label">Unit Cost</div>
          <div className={`ord-detail-stat-val${showAmounts ? " amber" : ""}`}>
            {showAmounts ? ordCurrency(item.unit_cost) : "—"}
          </div>
        </div>
        <div className="ord-detail-stat">
          <div className="ord-detail-stat-label">Total</div>
          <div className={`ord-detail-stat-val${showAmounts ? " amber" : ""}`}>
            {showAmounts ? ordCurrency(item.line_total || 0) : "—"}
          </div>
        </div>
      </div>
      {item.received_notes && (
        <div className="ord-detail-note">📝 {item.received_notes}</div>
      )}
      {!isReceived && item.not_received_reason && (
        <div className="ord-detail-note warn">⚠ {item.not_received_reason}</div>
      )}
    </div>
  );
}

/* ── Create Order Modal ── */
function CreateOrderModal({
  items, suppliers, orderItems, orderNotes, orderSearchQuery,
  orderModalCurrentPage, orderModalTotalPages, orderModalCurrentItems,
  filteredOrderItems, totalOrderAmount, loading, error,
  onClose, onAddItem, onUpdateQty, onUpdateSupplier, onRemoveItem,
  onSearchChange, onPageChange, onNotesChange, onSubmit, ORDER_MODAL_ITEMS_PER_PAGE,
}) {
  const [leftTab, setLeftTab] = React.useState("existing");
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
      .catch(() => { });
  }, []);

  const sizeSuggestions = React.useMemo(() => {
    if (!newItemForm.size) return [];
    const q = newItemForm.size.toLowerCase();
    return dbSizes.filter(s => s.toLowerCase().includes(q)).slice(0, 8);
  }, [newItemForm.size, dbSizes]);

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
    onAddItem({
      item_id: `NEW-${Date.now()}-${Math.random()}`,
      item_name: `${newItemForm.brand} ${newItemForm.design} ${newItemForm.size}`,
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
      fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "clamp(0.72rem, 2.7vw, 0.82rem)",
      textTransform: "uppercase", letterSpacing: "0.06em",
      border: "none", borderBottom: leftTab === tab ? "2px solid var(--th-orange,#f97316)" : "2px solid transparent",
      background: "transparent",
      color: leftTab === tab ? "var(--th-orange,#f97316)" : "var(--th-text-dim,#94a3b8)",
      transition: "color 0.15s, border-color 0.15s",
    }}>{label}</button>
  );

  return (
    <div className="inv-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="inv-modal">
        <div className="inv-modal-header">
          <div className="inv-modal-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }}>
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            Create Purchase Order
          </div>
          <button className="inv-modal-close" onClick={onClose}>✕</button>
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
                    <label style={{ fontSize: "clamp(0.62rem, 2.2vw, 0.72rem)", textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Brand <span style={{ color: "#38bdf8" }}>*</span></label>
                    <select className="inv-input" value={newItemForm.brand} onChange={e => handleNewBrandChange(e.target.value)}>
                      <option value="">— Select brand —</option>
                      {availableBrands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    {availableBrands.length === 0 && <div style={{ fontSize: "0.75rem", color: "#fb7185", marginTop: "0.25rem" }}>No brands added to any supplier yet. Add brands in the Suppliers page first.</div>}
                  </div>
                  {newItemForm.brand && (
                    <div>
                      <label style={{ fontSize: "clamp(0.62rem, 2.2vw, 0.72rem)", textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Supplier <span style={{ color: "#38bdf8" }}>*</span></label>
                      <select className="inv-input" value={newItemForm.supplier_id} onChange={e => setNewItemForm(f => ({ ...f, supplier_id: e.target.value }))}>
                        <option value="">— Select supplier —</option>
                        {suppliersForBrand.map(s => <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>)}
                      </select>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    <div>
                      <label style={{ fontSize: "clamp(0.62rem, 2.2vw, 0.72rem)", textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Design <span style={{ color: "#38bdf8" }}>*</span></label>
                      <input className="inv-input" placeholder="e.g. Turanza" value={newItemForm.design} onChange={e => setNewItemForm(f => ({ ...f, design: e.target.value }))} />
                    </div>
                    <div style={{ position: "relative" }}>
                      <label style={{ fontSize: "clamp(0.62rem, 2.2vw, 0.72rem)", textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Size <span style={{ color: "#38bdf8" }}>*</span></label>
                      <input className="inv-input" placeholder="e.g. 205/65R16" value={newItemForm.size} onChange={e => setNewItemForm(f => ({ ...f, size: e.target.value }))} onFocus={() => setShowSizeSug(true)} onBlur={() => setTimeout(() => setShowSizeSug(false), 200)} />
                      {showSizeSug && sizeSuggestions.length > 0 && (
                        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--th-bg-input,#1a2132)", border: "1px solid var(--th-border-strong,#3d5068)", borderRadius: "8px", overflowY: "auto", maxHeight: "150px", zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                          {sizeSuggestions.map(s => (
                            <div key={s} onMouseDown={() => { setNewItemForm(f => ({ ...f, size: s })); setShowSizeSug(false); }} style={{ padding: "0.5rem 0.75rem", cursor: "pointer", borderBottom: "1px solid var(--th-border-mid,#283245)", fontSize: "0.85rem", color: "var(--th-text-primary,#f8fafc)" }} onMouseEnter={e => e.currentTarget.style.background = "var(--th-border-mid,#283245)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>{s}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={{ fontSize: "clamp(0.62rem, 2.2vw, 0.72rem)", textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Category <span style={{ color: "#38bdf8" }}>*</span></label>
                      <select className="inv-input" value={newItemForm.category} onChange={e => setNewItemForm(f => ({ ...f, category: e.target.value }))}>
                        <option value="">— Select —</option>
                        {["PCR", "SUV", "TRUCK", "MOTORCYCLE", "VALVE", "WEIGHT", "SEALANT", "MISC"].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "clamp(0.62rem, 2.2vw, 0.72rem)", textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Qty to Order <span style={{ color: "#38bdf8" }}>*</span></label>
                      <input className="inv-input" type="number" min="1" placeholder="1" value={newItemForm.quantity} onChange={e => setNewItemForm(f => ({ ...f, quantity: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: "clamp(0.62rem, 2.2vw, 0.72rem)", textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Unit Cost <span style={{ color: "#38bdf8" }}>*</span></label>
                      <input className="inv-input" type="number" min="0" step="0.01" placeholder="0.00" value={newItemForm.unit_cost} onChange={e => setNewItemForm(f => ({ ...f, unit_cost: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: "clamp(0.62rem, 2.2vw, 0.72rem)", textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Selling Price <span style={{ color: "#38bdf8" }}>*</span></label>
                      <input className="inv-input" type="number" min="0" step="0.01" placeholder="0.00" value={newItemForm.selling_price} onChange={e => setNewItemForm(f => ({ ...f, selling_price: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: "clamp(0.62rem, 2.2vw, 0.72rem)", textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Reorder Point</label>
                      <input className="inv-input" type="number" min="0" placeholder="0" value={newItemForm.reorder_point} onChange={e => setNewItemForm(f => ({ ...f, reorder_point: e.target.value }))} />
                    </div>
                  </div>
                  {newItemError && <div style={{ fontSize: "0.8rem", color: "#fb7185", background: "rgba(251,113,133,0.1)", border: "1px solid #fb7185", borderRadius: 6, padding: "0.4rem 0.65rem" }}>{newItemError}</div>}
                  <button className="inv-btn inv-btn-emerald" onClick={addNewItemToOrder} style={{ marginTop: "0.25rem" }}>+ Add to Order</button>
                </div>
              ) : (
                <>
                  <div className="inv-modal-section-title">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    Select Items
                  </div>
                  <div style={{ position: "relative", marginBottom: "0.4rem" }}>
                    <input className="inv-input" style={{ paddingLeft: "2rem" }} placeholder="Search by name, SKU, brand, size…" value={orderSearchQuery} onChange={(e) => onSearchChange(e.target.value)} />
                    <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    </span>
                  </div>
                  <div style={{ maxHeight: "380px", overflowY: "auto" }}>
                    {orderModalCurrentItems.map((item) => {
                      const qty = item.current_quantity || 0;
                      const inOrder = orderItems.some(o => o.item_id === item.item_id);
                      const stockCls = qty > 5 ? "ok" : qty > 0 ? "low" : "out";
                      return (
                        <div key={item.item_id} className={`inv-order-item-row${inOrder ? " in-order" : ""}`}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="inv-order-item-name">{item.item_name}</div>
                            <div className="inv-order-item-meta">{item.sku}</div>
                            <div className={`inv-order-item-stock inv-stock-badge ${stockCls}`} style={{ display: "inline-block", marginTop: 3 }}>Stock: {qty}</div>
                          </div>
                          <button className="inv-btn inv-btn-sky inv-btn-sm" onClick={() => onAddItem(item)} style={{ marginLeft: "0.5rem" }}>
                            {inOrder ? "+" : "+ Add"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {filteredOrderItems.length > ORDER_MODAL_ITEMS_PER_PAGE && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.6rem", paddingTop: "0.5rem", borderTop: "1px solid #283245" }}>
                      <span style={{ fontSize: "0.7rem", color: "#475569" }}>
                        {orderModalCurrentPage * ORDER_MODAL_ITEMS_PER_PAGE - ORDER_MODAL_ITEMS_PER_PAGE + 1}–{Math.min(orderModalCurrentPage * ORDER_MODAL_ITEMS_PER_PAGE, filteredOrderItems.length)} of {filteredOrderItems.length}
                      </span>
                      <div style={{ display: "flex", gap: "0.35rem" }}>
                        <button className="inv-page-btn" disabled={orderModalCurrentPage === 1} onClick={() => onPageChange(orderModalCurrentPage - 1)}>← Prev</button>
                        <span className="inv-page-current">{orderModalCurrentPage}/{orderModalTotalPages}</span>
                        <button className="inv-page-btn" disabled={orderModalCurrentPage === orderModalTotalPages} onClick={() => onPageChange(orderModalCurrentPage + 1)}>Next →</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* RIGHT: order cart */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "0.5rem", borderBottom: "1px solid var(--th-border,#283245)" }}>
                <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "clamp(0.72rem, 2.6vw, 0.82rem)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--th-text-dim,#94a3b8)" }}>Order Items</span>
                <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "0.78rem", background: orderItems.length > 0 ? "rgba(249,115,22,0.15)" : "rgba(100,116,139,0.12)", color: orderItems.length > 0 ? "var(--th-orange,#f97316)" : "#475569", border: `1px solid ${orderItems.length > 0 ? "rgba(249,115,22,0.3)" : "#283245"}`, borderRadius: 20, padding: "0.1rem 0.6rem" }}>
                  {orderItems.length} {orderItems.length === 1 ? "item" : "items"}
                </span>
              </div>
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
                      <div className="inv-order-cart-row" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <div className="inv-order-cart-info" style={{ flex: 1, minWidth: 0 }}>
                          <div className="inv-order-cart-name" style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
                            {oi.item_name}
                            {oi.is_new_item && <span style={{ fontSize: "0.62rem", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", background: "rgba(52,211,153,0.15)", border: "1px solid #34d399", color: "#34d399", borderRadius: 4, padding: "0.05rem 0.35rem", lineHeight: 1.4 }}>NEW</span>}
                          </div>
                          <div className="inv-order-cart-sku">{oi.is_new_item ? oi.category : oi.sku}</div>
                        </div>
                        <button className="inv-qty-btn" onClick={() => onUpdateQty(oi.order_item_id, oi.quantity - 1)}>−</button>
                        <input className="inv-qty-display" type="number" min="1" value={oi.quantity} onChange={(e) => onUpdateQty(oi.order_item_id, Math.max(1, parseInt(e.target.value) || 1))} />
                        <button className="inv-qty-btn" onClick={() => onUpdateQty(oi.order_item_id, oi.quantity + 1)}>+</button>
                        <div className="inv-order-line-total">{ordCurrency(oi.line_total)}</div>
                        <button className="inv-cancel-btn" onClick={() => onRemoveItem(oi.order_item_id)}>✕</button>
                      </div>
                      {(() => {
                        const allSuppliers = suppliers || [];
                        const itemBrand = (oi.brand || "").trim().toUpperCase();
                        const brandSuppliers = allSuppliers.filter(s =>
                          (s.supplier_brands || []).some(b => b.brand_name.trim().toUpperCase() === itemBrand)
                        );
                        const listToShow = brandSuppliers.length > 0 ? brandSuppliers : allSuppliers;
                        const isFallback = brandSuppliers.length === 0;
                        return (
                          <div className="inv-order-supplier-wrap" style={{ marginTop: "0.4rem", display: "flex", flexWrap: "wrap", gap: "0.3rem", alignItems: "center" }}>
                            {isFallback && <span style={{ fontSize: "clamp(0.6rem, 2.1vw, 0.68rem)", color: "#64748b", width: "100%", marginBottom: "0.1rem" }}>No brand match — select supplier:</span>}
                            {listToShow.map(s => {
                              const selected = oi.supplier_id === s.supplier_id;
                              return (
                                <button key={s.supplier_id} className="inv-order-supplier-chip" onClick={() => onUpdateSupplier(oi.order_item_id, selected ? "" : s.supplier_id)} style={{
                                  padding: "0.2rem 0.6rem", borderRadius: 20, fontSize: "0.75rem", cursor: "pointer",
                                  fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
                                  border: selected ? "1.5px solid #38bdf8" : "1px solid #3d5068",
                                  background: selected ? "rgba(56,189,248,0.15)" : "var(--th-bg-input,#283245)",
                                  color: selected ? "#38bdf8" : "#64748b",
                                  transition: "all 0.12s",
                                }}>
                                  {selected ? "✓ " : ""}{s.supplier_name}
                                </button>
                              );
                            })}
                            {!oi.supplier_id && <span style={{ fontSize: "0.7rem", color: "#f97316" }}>⚠ required</span>}
                          </div>
                        );
                      })()}
                    </div>
                  ))
                )}
              </div>
              <div>
                <label className="inv-form-label">Order Notes (optional)</label>
                <textarea className="inv-textarea" rows="2" value={orderNotes} onChange={(e) => onNotesChange(e.target.value)} placeholder="e.g., Rush delivery, special request…" />
              </div>
              <div className="inv-order-total-bar">
                <span className="inv-order-total-label">Order Total</span>
                <span className="inv-order-total-amount">{ordCurrency(totalOrderAmount)}</span>
              </div>
              {error && (
                <div className="inv-error">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="inv-modal-footer">
          <button className="inv-btn inv-btn-slate" style={{ flex: "0 0 auto", minWidth: 110 }} onClick={onClose}>Cancel</button>
          <button className="inv-btn inv-btn-orange" style={{ flex: 1 }} disabled={loading || orderItems.length === 0} onClick={onSubmit}>
            {loading ? "Creating…" : `✓ Create Order${orderItems.length > 0 ? ` (${orderItems.length})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Confirm Modal ── */
function ConfirmModal({ pending, onConfirm, onCancel, loading }) {
  if (!pending) return null;
  const isDanger = pending.danger === true;
  return (
    <div className="confirm-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="confirm-box">
        <div className="confirm-title">{pending.title}</div>
        <div className="confirm-details">
          {(pending.rows || []).map((row, i) => (
            <div key={i} className="confirm-detail-row">
              <span className="confirm-detail-label">{row.label}</span>
              <span className="confirm-detail-val">{row.value}</span>
            </div>
          ))}
        </div>
        <div className="confirm-actions">
          <button className="confirm-btn-cancel" onClick={onCancel} disabled={loading}>Back</button>
          <button className={`confirm-btn-ok${isDanger ? " danger" : ""}`} onClick={onConfirm} disabled={loading}>
            {loading ? "Processing…" : (pending.okLabel || "Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
export default function OrdersPage({ shopId, onRefresh }) {
  const [orderDetails, setOrderDetails] = React.useState(null);
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [supplierFilter, setSupplierFilter] = React.useState("");
  const [searchSuggestions, setSearchSuggestions] = React.useState([]);
  const ORDERS_PAGE_SIZE = 10;
  const {
    data: orders,
    page: ordersPage, setPage: setOrdersPage,
    totalPages: ordersTotalPages,
    total: ordersTotalCount,
    search: searchQuery, setSearch: setSearchQuery,
    refetch: fetchOrders,
  } = usePaginatedResource({
    url: `${API_URL}/orders/${shopId}`,
    perPage: ORDERS_PAGE_SIZE,
    extraParams: {
      status: statusFilter && statusFilter !== "ALL" ? statusFilter : "",
      supplier_id: supplierFilter || "",
    },
    enabled: !!shopId,
    deps: [shopId, statusFilter, supplierFilter],
  });
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [toast, setToast] = React.useState(null);

  const [showCancelModal, setShowCancelModal] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");
  const [selectedOrderForCancel, setSelectedOrderForCancel] =
    React.useState(null);

  const [showReceiveModal, setShowReceiveModal] = React.useState(false);
  const [selectedOrderForReceive, setSelectedOrderForReceive] =
    React.useState(null);
  const [receivedItems, setReceivedItems] = React.useState([]);
  const [notReceivedReasons, setNotReceivedReasons] = React.useState({});
  const [receiveOverrides, setReceiveOverrides] = React.useState({}); // {order_item_id: {quantity, unit_cost, dot_number}}
  const [deliveryReceipt, setDeliveryReceipt] = React.useState("");
  const [receivePaymentMode, setReceivePaymentMode] = React.useState("TERMS"); // CASH | CHECK | TERMS
  const [receiveCheckInfo, setReceiveCheckInfo] = React.useState({ check_number: "", bank: "", check_date: "" });

  // Confirmation modal state
  const [pending, setPending] = React.useState(null); // { title, rows, okLabel, danger, action }

  // Create Order modal state
  const [showCreateOrderModal, setShowCreateOrderModal] = React.useState(false);
  const [items, setItems] = React.useState([]);
  const [suppliers, setSuppliers] = React.useState([]);
  const [createOrderItems, setCreateOrderItems] = React.useState([]);
  const [createOrderNotes, setCreateOrderNotes] = React.useState("");
  const [createOrderSearch, setCreateOrderSearch] = React.useState("");
  const [createOrderPage, setCreateOrderPage] = React.useState(1);
  const CREATE_ORDER_PER_PAGE = 10;

  // Re-render on theme change
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => {
    const obs = new MutationObserver(() => forceUpdate());
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);

  React.useEffect(() => {
    fetchItems();
    fetchSuppliers();
  }, [shopId]);

  async function fetchItems() {
    try {
      const r = await apiFetch(`${API_URL}/items/${shopId}`);
      setItems((await r.json()) || []);
    } catch (err) {
      console.error('fetchItems failed:', err);
    }
  }

  async function fetchSuppliers() {
    try {
      const qs = shopId ? `?shop_id=${encodeURIComponent(shopId)}` : '';
      const r = await apiFetch(`${API_URL}/suppliers${qs}`);
      setSuppliers((await r.json()) || []);
    } catch (err) {
      console.error('fetchSuppliers failed:', err);
    }
  }

  function addItemToCreateOrder(item) {
    const existing = createOrderItems.find(o => o.item_id === item.item_id);
    if (existing) {
      setCreateOrderItems(createOrderItems.map(o =>
        o.item_id === item.item_id
          ? { ...o, quantity: o.quantity + 1, line_total: (o.quantity + 1) * o.unit_cost }
          : o
      ));
    } else {
      const brandLower = (item.brand || "").trim().toUpperCase();
      const brandSuppliers = suppliers.filter(s =>
        (s.supplier_brands || []).some(b => b.brand_name.trim().toUpperCase() === brandLower)
      );
      const autoSupplier = brandSuppliers.length === 1 ? brandSuppliers[0] : null;
      setCreateOrderItems([...createOrderItems, {
        ...item,
        order_item_id: `TEMP-${Date.now()}`,
        quantity: item.quantity || 1,
        unit_cost: item.unit_cost,
        line_total: (item.quantity || 1) * item.unit_cost,
        supplier_id: autoSupplier ? autoSupplier.supplier_id : null,
        supplier_name: autoSupplier ? autoSupplier.supplier_name : null,
      }]);
    }
  }

  function removeFromCreateOrder(id) {
    setCreateOrderItems(createOrderItems.filter(o => o.order_item_id !== id));
  }

  function updateCreateOrderSupplier(id, supplier_id) {
    setCreateOrderItems(createOrderItems.map(o => o.order_item_id === id ? { ...o, supplier_id } : o));
  }

  function updateCreateOrderQuantity(id, qty) {
    if (qty <= 0) { removeFromCreateOrder(id); return; }
    setCreateOrderItems(createOrderItems.map(o =>
      o.order_item_id === id ? { ...o, quantity: qty, line_total: qty * o.unit_cost } : o
    ));
  }

  async function submitCreateOrder() {
    if (createOrderItems.length === 0) { setError("Add items to the order first"); return; }
    const missingSupplier = createOrderItems.filter(o => !o.supplier_id);
    if (missingSupplier.length > 0) {
      setError(`Select a supplier for: ${missingSupplier.map(o => o.item_name).join(", ")}`);
      return;
    }
    // Group items by supplier → one order per supplier
    const groups = {};
    for (const o of createOrderItems) {
      const sid = o.supplier_id;
      if (!groups[sid]) groups[sid] = [];
      groups[sid].push(o);
    }
    const supplierNames = Object.keys(groups).map(sid => {
      const s = suppliers.find(x => x.supplier_id === sid);
      return s ? s.supplier_name : sid;
    });
    const total = createOrderItems.reduce((s, o) => s + (o.line_total || 0), 0);
    setPending({
      title: "Create Purchase Order?",
      rows: [
        { label: "Items", value: `${createOrderItems.length} line${createOrderItems.length !== 1 ? "s" : ""}` },
        { label: "Supplier(s)", value: supplierNames.join(", ") },
        { label: "Total Amount", value: ordCurrency(total) },
        ...(Object.keys(groups).length > 1 ? [{ label: "Orders", value: `Will split into ${Object.keys(groups).length} orders` }] : []),
      ],
      okLabel: "Create Order",
      danger: false,
      action: doSubmitCreateOrder,
    });
  }

  async function doSubmitCreateOrder() {
    const groups = {};
    for (const o of createOrderItems) {
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
            order_notes: `${createOrderNotes || "Order"} — ${supplierName}`,
          }),
        }).then(r => r.json()).then(res => { if (res.error) throw new Error(res.error); return res; });
      }));
      setCreateOrderItems([]);
      setCreateOrderNotes("");
      setShowCreateOrderModal(false);
      setError("");
      setToast({
        title: results.length > 1 ? `${results.length} Orders Created` : "Order Created",
        sub: results.length > 1 ? `Split across ${results.length} suppliers` : `Total: ${ordCurrency(results[0].total_amount)}`,
      });
      fetchOrders();
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function confirmSubmit() {
    if (!pending) return;
    const action = pending.action;
    setPending(null);
    await action();
  }

  async function fetchOrderDetails(orderId) {
    try {
      const r = await apiFetch(`${API_URL}/orders/${orderId}/details`);
      const data = await r.json();
      setOrderDetails(data);
      return data;
    } catch {
      setError("Failed to load order details");
      return null;
    }
  }

  async function openReceiveModal(orderId) {
    setSelectedOrderForReceive(orderId);
    await fetchOrderDetails(orderId);
    setShowReceiveModal(true);
    setReceivedItems([]);
    setNotReceivedReasons({});
    setReceiveOverrides({});
    setDeliveryReceipt("");
    setReceivePaymentMode("TERMS");
    setReceiveCheckInfo({ check_number: "", bank: "", check_date: "" });
  }

  function stageUpdateOrderStatus(orderId, newStatus) {
    const order = orders.find(o => o.order_id === orderId) || orderDetails;
    const itemCount = (order?.items || orderDetails?.items)?.length ?? 0;
    const amount = order?.total_amount ?? orderDetails?.items?.reduce((s, i) => s + (i.line_total || 0), 0) ?? 0;
    setPending({
      title: `${newStatus === "CONFIRMED" ? "Confirm" : "Update"} Order?`,
      rows: [
        { label: "Order", value: orderId },
        { label: "New Status", value: newStatus },
        { label: "Items", value: `${itemCount} item${itemCount !== 1 ? "s" : ""}` },
        { label: "Amount", value: ordCurrency(amount) },
      ],
      okLabel: newStatus === "CONFIRMED" ? "Confirm Order" : `Set ${newStatus}`,
      danger: false,
      action: () => updateOrderStatus(orderId, newStatus),
    });
  }

  async function updateOrderStatus(orderId, newStatus) {
    setLoading(true);
    try {
      const r = await apiFetch(`${API_URL}/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const res = await r.json();
      if (!r.ok) throw new Error(res.error || "Update failed");
      setToast({ title: "Status Updated", sub: `Order → ${newStatus}` });
      fetchOrders();
      if (orderDetails?.order_id === orderId) await fetchOrderDetails(orderId);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  function stageCancelOrder(orderId, reason) {
    if (!reason.trim()) {
      setError("Please provide a cancellation reason");
      return;
    }
    const order = orders.find(o => o.order_id === orderId);
    const itemCount = order?.items?.length ?? 0;
    setPending({
      title: "Cancel Order?",
      rows: [
        { label: "Order", value: orderId },
        { label: "Status", value: order?.status || "—" },
        { label: "Items", value: `${itemCount} item${itemCount !== 1 ? "s" : ""}` },
        { label: "Amount", value: ordCurrency(order?.total_amount) },
        { label: "Reason", value: reason },
      ],
      okLabel: "Cancel Order",
      danger: true,
      action: () => cancelOrder(orderId, reason),
    });
  }

  async function cancelOrder(orderId, reason) {
    setLoading(true);
    try {
      const r = await apiFetch(`${API_URL}/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED", reason }),
      });
      const res = await r.json();
      if (!r.ok) throw new Error(res.error || "Cancel failed");
      setCancelReason("");
      setShowCancelModal(false);
      setSelectedOrderForCancel(null);
      if (orderDetails?.order_id === orderId) setOrderDetails(null);
      setToast({ title: "Order Cancelled" });
      fetchOrders();
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function stageReceiveOrder() {
    if (!deliveryReceipt.trim()) {
      setError("Delivery Receipt (DR) number is required");
      return;
    }
    if (receivedItems.length === 0) {
      setError("Select at least one item as received");
      return;
    }
    if (receivePaymentMode === "CHECK") {
      if (!receiveCheckInfo.check_date) { setError("Check date is required"); return; }
    }
    const notRecvd = orderDetails.items.filter(
      (item) => !receivedItems.some((ri) => ri.order_item_id === item.order_item_id),
    );
    const missingReason = notRecvd.filter(
      (item) => !notReceivedReasons[item.order_item_id]?.trim(),
    );
    if (missingReason.length > 0) {
      setError("Provide a reason for all items not received");
      return;
    }
    // Validate overrides
    for (const ri of receivedItems) {
      const ov = receiveOverrides[ri.order_item_id] || {};
      const qty = parseFloat(ov.quantity ?? ri.quantity);
      if (!qty || qty <= 0) { setError(`Invalid quantity for ${ri.item_name}`); return; }
      // DOT required for tire items
      const isTire = (ri.category || "").toUpperCase() === "TIRE" || (ri.category || "").toUpperCase().includes("TIRE") ||
        /\d+\/\d+[Rr]\d+/.test(ri.size || "") || (ri.item_name || "").toLowerCase().includes("tire");
      const dot = (ov.dot_number ?? ri.dot_number ?? "").toString().trim();
      if (isTire && !dot) { setError(`DOT number is required for tire: ${ri.item_name}`); return; }
    }
    const paymentLabel = receivePaymentMode === "CASH" ? "Cash" : receivePaymentMode === "CHECK" ? "Check Release" : "Supplier Terms";
    const totalReceived = receivedItems.reduce((s, ri) => {
      const ov = receiveOverrides[ri.order_item_id] || {};
      const qty = parseFloat(ov.quantity ?? ri.quantity);
      const cost = parseFloat(ov.unit_cost ?? ri.unit_cost);
      return s + (qty * cost);
    }, 0);
    setPending({
      title: "Complete Receive Order?",
      rows: [
        { label: "Order", value: selectedOrderForReceive },
        { label: "Items Received", value: `${receivedItems.length} of ${orderDetails.items?.length}` },
        {
          label: "Items List", value: receivedItems.map(ri => {
            const ov = receiveOverrides[ri.order_item_id] || {};
            const dot = (ov.dot_number ?? ri.dot_number ?? "").toString().trim();
            return dot ? `${ri.item_name} [DOT ${dot}]` : ri.item_name;
          }).join(", ")
        },
        { label: "Payment", value: ordCurrency(totalReceived) },
        { label: "Method", value: paymentLabel },
        { label: "DR #", value: deliveryReceipt },
      ],
      okLabel: "Complete Receive",
      danger: false,
      action: receiveOrder,
    });
  }

  async function receiveOrder() {
    setLoading(true);
    try {
      const r = await apiFetch(
        `${API_URL}/orders/${selectedOrderForReceive}/receive`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            received_by: "WAREHOUSE",
            delivery_receipt: deliveryReceipt.trim() || null,
            payment_mode: receivePaymentMode,
            check_info: receivePaymentMode === "CHECK" ? receiveCheckInfo : null,
            received_items: receivedItems.map((ri) => {
              const ov = receiveOverrides[ri.order_item_id] || {};
              return {
                order_item_id: ri.order_item_id,
                quantity: parseFloat(ov.quantity ?? ri.quantity),
                unit_cost: parseFloat(ov.unit_cost ?? ri.unit_cost),
                dot_number: (ov.dot_number ?? ri.dot_number ?? "").toString().trim() || null,
              };
            }),
            not_received_items: (orderDetails.items || [])
              .filter((item) => !receivedItems.some((ri) => ri.order_item_id === item.order_item_id))
              .map((item) => ({
                order_item_id: item.order_item_id,
                reason: notReceivedReasons[item.order_item_id] || "Not provided",
              })),
          }),
        },
      );
      const res = await r.json();
      if (!r.ok) throw new Error(res.error || "Receive failed");
      setShowReceiveModal(false);
      setSelectedOrderForReceive(null);
      setReceivedItems([]);
      setNotReceivedReasons({});
      setReceiveOverrides({});
      setDeliveryReceipt("");
      setReceivePaymentMode("TERMS");
      setReceiveCheckInfo({ check_number: "", bank: "", check_date: "" });
      setOrderDetails(null);
      setToast({
        title: "Order Received",
        sub: `${receivedItems.length} item${receivedItems.length !== 1 ? "s" : ""} added to inventory`,
      });
      fetchOrders();
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  /* Derived data */
  const statusCounts = {
    ALL: orders.length,
    PENDING: orders.filter((o) => o.status === "PENDING").length,
    CONFIRMED: orders.filter((o) => o.status === "CONFIRMED").length,
    RECEIVED: orders.filter((o) => o.status === "RECEIVED").length,
    CANCELLED: orders.filter((o) => o.status === "CANCELLED").length,
  };

  // Unique suppliers derived from all loaded orders
  const uniqueSuppliers = React.useMemo(() => {
    const map = new Map();
    for (const o of orders) {
      for (const item of o.items || []) {
        if (item.supplier_id && item.supplier_name && !map.has(item.supplier_id)) {
          map.set(item.supplier_id, item.supplier_name);
        }
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  // Server owns filter+paginate. `orders` is already the current page for the
  // active status/supplier/search. Backend sorts by created_at DESC.
  const filteredOrders = orders;
  const displayOrders = orders;
  const pagedOrders = orders;

  /* Suggestions */
  React.useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchSuggestions([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const seen = new Set();
    const sugs = [];
    for (const o of filteredOrders) {
      if (o.order_id.toLowerCase().startsWith(q) && !seen.has(o.order_id)) {
        seen.add(o.order_id);
        sugs.push({ text: o.order_id, type: "Order ID" });
        if (sugs.length >= 6) break;
      }
    }
    for (const o of filteredOrders) {
      if (o.delivery_receipt && o.delivery_receipt.toLowerCase().includes(q) && !seen.has(o.delivery_receipt)) {
        seen.add(o.delivery_receipt);
        sugs.push({ text: o.delivery_receipt, type: "DR #" });
        if (sugs.length >= 8) break;
      }
    }
    for (const o of filteredOrders) {
      for (const item of (o.items || [])) {
        for (const [val, label] of [
          [item.supplier_name, "Supplier"],
          [item.brand, "Brand"],
          [item.item_name, "Item"],
        ]) {
          if (val && val.toLowerCase().includes(q) && !seen.has(val)) {
            seen.add(val);
            sugs.push({ text: val, type: label });
          }
        }
        if (sugs.length >= 10) break;
      }
      if (sugs.length >= 10) break;
    }
    setSearchSuggestions(sugs);
  }, [searchQuery, filteredOrders]);

  const chipStatus = (order, item) => {
    if (order.status === "CANCELLED") return "CANCELLED";
    if (item.received_status === "NOT_RECEIVED") return "NOT_RECEIVED";
    if (order.status === "RECEIVED" && item.received_status === "RECEIVED")
      return "RECEIVED";
    return order.status;
  };

  return (
    <>
      <style>{`
        .ord-root {
            display: flex;
            flex-direction: column;
            gap: .5rem;
        }
        .ord-main {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            min-width: 0;
            gap: .5rem;
        }
        .ord-header {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 0.6rem;
            margin-bottom: 0;
            border-bottom: 1px solid var(--th-border);
            padding-bottom: 1rem;
        }
        .ord-create-btn-desktop { display: inline-flex; }
        .ord-create-btn-mobile  { display: none; }
        @media (max-width: 640px) {
          .ord-header { text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; }
          .ord-header div { display: flex; flex-direction: row; align-items: center; }
          .ord-create-btn-desktop { display: none !important; }
          .ord-create-btn-mobile  { display: flex !important; width: 100%; justify-content: center; margin-top: 0; }
          .ord-title { justify-content: center; width: 100%; }
        }
      `}</style>
      {toast && (
        <OrdToast
          title={toast.title}
          sub={toast.sub}
          onDone={() => setToast(null)}
        />
      )}

      {/* ── Confirmation Modal ── */}
      {pending && (
        <ConfirmModal
          pending={pending}
          onConfirm={confirmSubmit}
          onCancel={() => setPending(null)}
          loading={loading}
        />
      )}

      {/* ── Create Order Modal ── */}
      {showCreateOrderModal && (() => {
        const filteredItems = items.filter(i =>
          !createOrderSearch.trim() ||
          [i.item_name, i.sku, i.brand, i.design, i.size].some(f => f && f.toLowerCase().includes(createOrderSearch.toLowerCase()))
        );
        const totalPages = Math.max(1, Math.ceil(filteredItems.length / CREATE_ORDER_PER_PAGE));
        const safePage = Math.min(createOrderPage, totalPages);
        const pageItems = filteredItems.slice((safePage - 1) * CREATE_ORDER_PER_PAGE, safePage * CREATE_ORDER_PER_PAGE);
        const total = createOrderItems.reduce((s, o) => s + (o.line_total || 0), 0);
        return (
          <CreateOrderModal
            items={items}
            suppliers={suppliers}
            orderItems={createOrderItems}
            orderNotes={createOrderNotes}
            orderSearchQuery={createOrderSearch}
            orderModalCurrentPage={safePage}
            orderModalTotalPages={totalPages}
            orderModalCurrentItems={pageItems}
            filteredOrderItems={filteredItems}
            totalOrderAmount={total}
            loading={loading}
            error={error}
            onClose={() => { setShowCreateOrderModal(false); setCreateOrderItems([]); setCreateOrderNotes(""); setError(""); }}
            onAddItem={addItemToCreateOrder}
            onUpdateQty={updateCreateOrderQuantity}
            onUpdateSupplier={updateCreateOrderSupplier}
            onRemoveItem={removeFromCreateOrder}
            onSearchChange={(v) => { setCreateOrderSearch(v); setCreateOrderPage(1); }}
            onPageChange={setCreateOrderPage}
            onNotesChange={setCreateOrderNotes}
            onSubmit={submitCreateOrder}
            ORDER_MODAL_ITEMS_PER_PAGE={CREATE_ORDER_PER_PAGE}
          />
        );
      })()}

      {/* ── Main layout ── */}
      <div className="ord-root">
        <div className="ord-main">
          {/* Header */}
          <div className="ord-header">
            <div className="ord-title">
              Purchase <span>Orders</span>
            </div>
            <button
              className="inv-btn inv-btn-orange ord-create-btn-desktop"
              onClick={() => { setShowCreateOrderModal(true); setError(""); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              Create Order
            </button>
          </div>

          {/* KPIs */}
          {(() => {
            const totalVal = orders.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0)
            const pendingVal = orders.filter(o => o.status === 'PENDING').reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0)
            const receivedVal = orders.filter(o => o.status === 'RECEIVED').reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0)
            return (
              <div className="th-kpi-row">
                <div className="th-kpi sky">
                  <div className="th-kpi-label kpi-lbl">Total Orders</div>
                  <div className="th-kpi-value kpi-val">{orders.length}</div>
                  <div className="th-kpi-sub kpi-sub">{ordCurrency(totalVal)} total value</div>
                </div>
                <div className="th-kpi amber">
                  <div className="th-kpi-label kpi-lbl">Pending</div>
                  <div className="th-kpi-value kpi-val">{statusCounts.PENDING}</div>
                  <div className="th-kpi-sub kpi-sub">{ordCurrency(pendingVal)} awaiting</div>
                </div>
                <div className="th-kpi violet">
                  <div className="th-kpi-label kpi-lbl">Confirmed</div>
                  <div className="th-kpi-value kpi-val">{statusCounts.CONFIRMED}</div>
                  <div className="th-kpi-sub kpi-sub">ready for delivery</div>
                </div>
                <div className="th-kpi emerald">
                  <div className="th-kpi-label kpi-lbl">Received</div>
                  <div className="th-kpi-value kpi-val">{statusCounts.RECEIVED}</div>
                  <div className="th-kpi-sub kpi-sub">{ordCurrency(receivedVal)} completed</div>
                </div>
                <div className="th-kpi rose">
                  <div className="th-kpi-label kpi-lbl">Cancelled</div>
                  <div className="th-kpi-value kpi-val">{statusCounts.CANCELLED}</div>
                  <div className="th-kpi-sub kpi-sub">voided orders</div>
                </div>
              </div>
            )
          })()}

          {/* Error */}
          {error && !showCancelModal && !showReceiveModal && (
            <div className="ord-error">
              <span>{error}</span>
              <button className="ord-error-close" onClick={() => setError("")}>
                ✕
              </button>
            </div>
          )}

          {/* Search + Filters container — unified card */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}>
            {/* Search */}
            <div style={{ background: 'var(--th-bg-card)', border: '1px solid var(--th-border)', borderRadius: '10px', padding: '0.5rem' }}>
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by order ID, DR#, or notes…"
                suggestions={searchSuggestions}
                resultCount={(searchQuery || supplierFilter) ? displayOrders.length : undefined}
                totalCount={(searchQuery || supplierFilter) ? filteredOrders.length : undefined}
                resultLabel="orders"
                style={{ marginBottom: 0 }}
              />
            </div>

            {/* Mobile-only Create Order button */}
            <button
              className="inv-btn inv-btn-orange ord-create-btn-mobile"
              onClick={() => { setShowCreateOrderModal(true); setError(""); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              Create Order
            </button>

            {/* Status filter */}
            <div className="ord-status-bar">
              {["ALL", "PENDING", "CONFIRMED", "RECEIVED", "CANCELLED"].map(
                (status) => {
                  const meta = STATUS_META[status];
                  const active = statusFilter === status;
                  return (
                    <button
                      key={status}
                      className={`ord-status-btn${active ? " active" : ""}`}
                      onClick={() => setStatusFilter(status)}
                    >
                      <div
                        style={{
                          color: active ? meta.color : "var(--th-text-faint)",
                        }}
                      >
                        {STATUS_ICONS[status]}
                      </div>
                      <div
                        className="ord-status-count"
                        style={{ color: active ? meta.color : undefined }}
                      >
                        {statusCounts[status]}
                      </div>
                      <div className="ord-status-btn-label">{meta.label}</div>
                      {active && (
                        <div
                          className="ord-status-bar-indicator"
                          style={{ background: meta.color }}
                        />
                      )}
                    </button>
                  );
                },
              )}
            </div>

            {/* Supplier filter */}
            {uniqueSuppliers.length > 0 && (
              <div style={{ background: 'var(--th-bg-card)', border: '1px solid var(--th-border)', borderRadius: '10px', padding: '0.5rem' }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.75rem", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--th-text-dim)", flexShrink: 0 }}>
                    Supplier:
                  </span>
                  <button
                    onClick={() => setSupplierFilter("")}
                    style={{
                      fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "0.8rem",
                      textTransform: "uppercase", letterSpacing: "0.04em",
                      padding: "0.25rem 0.75rem", borderRadius: 20, border: "1px solid",
                      cursor: "pointer", transition: "all 0.15s",
                      background: !supplierFilter ? "var(--th-orange)" : "transparent",
                      color: !supplierFilter ? "#fff" : "var(--th-text-dim)",
                      borderColor: !supplierFilter ? "var(--th-orange)" : "var(--th-border-strong)",
                    }}
                  >
                    All
                  </button>
                  {uniqueSuppliers.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSupplierFilter(supplierFilter === s.id ? "" : s.id)}
                      style={{
                        fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "0.8rem",
                        textTransform: "uppercase", letterSpacing: "0.04em",
                        padding: "0.25rem 0.75rem", borderRadius: 20, border: "1px solid",
                        cursor: "pointer", transition: "all 0.15s",
                        background: supplierFilter === s.id ? "var(--th-sky)" : "transparent",
                        color: supplierFilter === s.id ? "#1a2132" : "var(--th-text-dim)",
                        borderColor: supplierFilter === s.id ? "var(--th-sky)" : "var(--th-border-strong)",
                      }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="th-section-label">Order History</div>

          {/* Table */}
          <div className="ord-table-wrap">
            <div className="ord-table-scroll">
              <table className="ord-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Items</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                    <th>Status / Date</th>
                  </tr>
                </thead>
                <tbody>
                  {displayOrders.length === 0 ? (
                    <tr>
                      <td colSpan="4">
                        <div className="ord-table-empty">
                          <svg className="ord-table-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /><path d="M12 12v4M10 12h4" /></svg>
                          <div className="ord-table-empty-title">
                            {searchQuery || supplierFilter ? "No Orders Match" : "No Orders Found"}
                          </div>
                          <div>
                            {searchQuery || supplierFilter
                              ? "Try a different search term or supplier filter"
                              : "Orders created from Inventory will appear here"}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pagedOrders.map((order) => (
                      <tr
                        key={order.order_id}
                        className={
                          orderDetails?.order_id === order.order_id
                            ? "selected"
                            : ""
                        }
                        onClick={() => fetchOrderDetails(order.order_id)}
                      >
                        {/* Order ID */}
                        <td>
                          <div className="ord-order-id">{order.order_id}</div>
                          {order.delivery_receipt && (
                            <div className="ord-order-notes" style={{ color: "var(--th-sky)" }}>
                              🧾 DR# {order.delivery_receipt}
                            </div>
                          )}
                          {order.order_notes && (
                            <div className="ord-order-notes">
                              📝 {order.order_notes}
                            </div>
                          )}
                        </td>

                        {/* Items */}
                        <td>
                          {order.items?.length > 0 ? (
                            order.items.map((item, idx) => {
                              const cs = chipStatus(order, item);
                              return (
                                <div
                                  key={idx}
                                  className={`ord-item-chip ${cs}`}
                                >
                                  <div className="ord-chip-name">
                                    {item.brand || item.item_name}
                                  </div>
                                  {item.design && (
                                    <div className="ord-chip-sub">
                                      {item.design} ·{" "}
                                      {item.displaySize || item.size || ""}
                                    </div>
                                  )}
                                  <div
                                    className={`ord-chip-qty ${order.status}`}
                                  >
                                    Qty: {item.quantity}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <span
                              style={{
                                color: "var(--th-text-faint)",
                                fontSize: "0.82rem",
                              }}
                            >
                              —
                            </span>
                          )}
                        </td>

                        {/* Amount */}
                        <td style={{ textAlign: "right" }}>
                          <div className="ord-amount-val">
                            {ordCurrency(order.total_amount)}
                          </div>
                        </td>

                        {/* Status + date */}
                        <td>
                          <span className={`ord-badge ${order.status}`}>
                            {STATUS_ICONS[order.status]}
                            {order.status}
                          </span>
                          <div className="ord-date">
                            {new Date(order.created_at).toLocaleString(
                              "en-PH",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              },
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={ordersPage} totalPages={ordersTotalPages} onPageChange={setOrdersPage} />
          </div>
        </div>

      </div>

      {/* ── Details modal ── */}
      {orderDetails && !showReceiveModal && !showCancelModal && (
        <div className="ord-details-overlay" onClick={(e) => e.target === e.currentTarget && setOrderDetails(null)}>
          <div className="ord-details">
            <div className="ord-details-header">
              <div className="ord-details-header-row">
                <div className="ord-details-title">Order Details</div>
                <div className="ord-details-id">{orderDetails.order_id}</div>
              </div>
              <button
                className="ord-details-close"
                onClick={() => setOrderDetails(null)}
              >
                ✕
              </button>
            </div>

            <div className="ord-details-body">
              {/* Meta cards */}
              <div className="ord-meta-grid">
                <div className="ord-meta-card">
                  <div className="ord-meta-label">Status</div>
                  <div>
                    <span className={`ord-badge ${orderDetails.status}`}>
                      {STATUS_ICONS[orderDetails.status]} {orderDetails.status}
                    </span>
                  </div>
                </div>
                <div className="ord-meta-card">
                  <div className="ord-meta-label">Total</div>
                  <div className="ord-meta-val amber">
                    {ordCurrency(
                      orderDetails.items?.reduce(
                        (s, i) =>
                          i.received_status === "NOT_RECEIVED"
                            ? s
                            : s + (i.line_total || 0),
                        0,
                      ),
                    )}
                  </div>
                </div>
                <div className="ord-meta-card">
                  <div className="ord-meta-label">Date</div>
                  <div className="ord-meta-val" style={{ fontSize: "0.88rem" }}>
                    {new Date(
                      orderDetails.created_at || Date.now(),
                    ).toLocaleString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </div>
                </div>
                <div className="ord-meta-card">
                  <div className="ord-meta-label">Items</div>
                  <div className="ord-meta-val">
                    {orderDetails.items?.length ?? 0}
                  </div>
                </div>
                {orderDetails.delivery_receipt && (
                  <div className="ord-meta-card" style={{ gridColumn: "span 2" }}>
                    <div className="ord-meta-label">Delivery Receipt (DR#)</div>
                    <div className="ord-meta-val" style={{ fontSize: "0.95rem", color: "var(--th-sky)", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>
                      {orderDetails.delivery_receipt}
                    </div>
                  </div>
                )}
                {orderDetails.payment_mode && (
                  <div className="ord-meta-card" style={{ gridColumn: "span 2" }}>
                    <div className="ord-meta-label">Payment Mode</div>
                    <div style={{ marginTop: "0.25rem" }}>
                      {orderDetails.payment_mode === "CASH" && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.25rem 0.75rem", borderRadius: 20, background: "var(--th-emerald-bg)", color: "var(--th-emerald)", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "0.88rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          💵 Cash
                        </span>
                      )}
                      {orderDetails.payment_mode === "CHECK" && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.25rem 0.75rem", borderRadius: 20, background: "var(--th-violet-bg)", color: "var(--th-violet)", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "0.88rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          🖊 Check Release
                        </span>
                      )}
                      {orderDetails.payment_mode === "TERMS" && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.25rem 0.75rem", borderRadius: 20, background: "var(--th-sky-bg)", color: "var(--th-sky)", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "0.88rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          📅 Supplier Terms
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              {orderDetails.order_notes && (
                <div className="ord-notes-block">
                  <div className="ord-notes-label">Notes</div>
                  <div className="ord-notes-text">
                    {orderDetails.order_notes}
                  </div>
                </div>
              )}

              {/* Receipt stats */}
              {orderDetails.status === "RECEIVED" && (
                <div className="ord-receipt-stats">
                  <div className="ord-receipt-stat">
                    <div
                      className="ord-receipt-stat-label"
                      style={{ color: "var(--th-emerald)" }}
                    >
                      Received
                    </div>
                    <div
                      className="ord-receipt-stat-val"
                      style={{ color: "var(--th-emerald)" }}
                    >
                      {
                        orderDetails.items?.filter(
                          (i) => i.received_status !== "NOT_RECEIVED",
                        ).length
                      }
                    </div>
                  </div>
                  <div className="ord-receipt-stat">
                    <div
                      className="ord-receipt-stat-label"
                      style={{ color: "var(--th-rose)" }}
                    >
                      Not Rcvd
                    </div>
                    <div
                      className="ord-receipt-stat-val"
                      style={{ color: "var(--th-rose)" }}
                    >
                      {
                        orderDetails.items?.filter(
                          (i) => i.received_status === "NOT_RECEIVED",
                        ).length
                      }
                    </div>
                  </div>
                  <div className="ord-receipt-stat">
                    <div
                      className="ord-receipt-stat-label"
                      style={{ color: "var(--th-sky)" }}
                    >
                      Total
                    </div>
                    <div
                      className="ord-receipt-stat-val"
                      style={{ color: "var(--th-sky)" }}
                    >
                      {orderDetails.items?.length}
                    </div>
                  </div>
                </div>
              )}

              {/* Item list */}
              <div className="ord-section-title">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                </svg>
                Items ({orderDetails.items?.length})
              </div>
              {orderDetails.items?.map((item) => (
                <DetailItem key={item.order_item_id} item={item} orderStatus={orderDetails.status} />
              ))}
            </div>

            <div className="ord-details-footer">
              {orderDetails.status === "PENDING" && (
                <>
                  <button
                    className="ord-btn ord-btn-sky"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={() =>
                      stageUpdateOrderStatus(
                        orderDetails.order_id,
                        "CONFIRMED",
                      )
                    }
                  >
                    ✓ Confirm Order
                  </button>
                  <button
                    className="ord-btn ord-btn-rose"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => {
                      setSelectedOrderForCancel(orderDetails.order_id);
                      setShowCancelModal(true);
                    }}
                  >
                    ✕ Cancel
                  </button>
                </>
              )}

              {orderDetails.status === "CONFIRMED" && (
                <>
                  <button
                    className="ord-btn ord-btn-emerald"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => openReceiveModal(orderDetails.order_id)}
                  >
                    📦 Receive Items
                  </button>
                  <button
                    className="ord-btn ord-btn-rose"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => {
                      setSelectedOrderForCancel(orderDetails.order_id);
                      setShowCancelModal(true);
                    }}
                  >
                    ✕ Cancel
                  </button>
                </>
              )}

              {orderDetails.status === "CANCELLED" && (
                <div
                  style={{
                    color: "var(--th-rose)",
                    fontSize: "0.88rem",
                    textAlign: "center",
                    width: "100%",
                    fontStyle: "italic",
                  }}
                >
                  This order was cancelled and cannot be processed.
                </div>
              )}

              {orderDetails.status === "RECEIVED" && (
                <div
                  style={{
                    color: "var(--th-emerald)",
                    fontSize: "0.88rem",
                    textAlign: "center",
                    width: "100%",
                    fontWeight: 600,
                  }}
                >
                  ✓ Inventory updated from this order.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Modal ── */}
      {showCancelModal && (
        <div
          className="ord-overlay"
          onClick={(e) =>
            e.target === e.currentTarget && setShowCancelModal(false)
          }
        >
          <div className="ord-modal ord-modal-sm">
            <div className="ord-modal-header">
              <div className="ord-modal-title">Cancel Order</div>
              <button
                className="ord-modal-close"
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason("");
                  setError("");
                }}
              >
                ✕
              </button>
            </div>
            <div className="ord-modal-body">
              {error && (
                <div className="ord-error" style={{ marginBottom: "0.75rem" }}>
                  {error}
                  <button
                    className="ord-error-close"
                    onClick={() => setError("")}
                  >
                    ✕
                  </button>
                </div>
              )}
              <p
                style={{
                  color: "var(--th-text-body)",
                  fontSize: "0.92rem",
                  marginBottom: "0.85rem",
                }}
              >
                Are you sure you want to cancel order{" "}
                <strong
                  style={{
                    color: "var(--th-amber)",
                    fontFamily: "'Barlow Condensed', sans-serif",
                  }}
                >
                  {selectedOrderForCancel}
                </strong>
                ?
              </p>
              <label
                style={{
                  fontSize: "0.78rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  color: "var(--th-text-dim)",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.35rem",
                }}
              >
                Cancellation Reason *
              </label>
              <textarea
                className="ord-textarea"
                rows="3"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g., Stock unavailable, Customer request…"
              />
            </div>
            <div className="ord-modal-footer">
              <button
                className="ord-btn ord-btn-rose"
                style={{
                  flex: 1,
                  justifyContent: "center",
                  padding: "0.65rem",
                }}
                disabled={loading || !cancelReason.trim()}
                onClick={() =>
                  stageCancelOrder(selectedOrderForCancel, cancelReason)
                }
              >
                {loading ? "Cancelling…" : "✕ Cancel Order"}
              </button>
              <button
                className="ord-btn ord-btn-slate"
                style={{
                  flex: 1,
                  justifyContent: "center",
                  padding: "0.65rem",
                }}
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason("");
                  setError("");
                }}
              >
                Keep Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Receive Modal ── */}
      {showReceiveModal && orderDetails && (
        <div
          className="ord-overlay"
          onClick={(e) =>
            e.target === e.currentTarget && setShowReceiveModal(false)
          }
        >
          <div className="ord-modal ord-modal-lg">
            <div className="ord-modal-header">
              <div>
                <div className="ord-modal-title">Receive Order</div>
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--th-orange)",
                    marginTop: "0.1rem",
                    fontWeight: 600,
                  }}
                >
                  {selectedOrderForReceive}
                </div>
              </div>
              <button
                className="ord-modal-close"
                onClick={() => {
                  setShowReceiveModal(false);
                  setReceivedItems([]);
                  setNotReceivedReasons({});
                  setReceiveOverrides({});
                  setDeliveryReceipt("");
                  setReceivePaymentMode("TERMS");
                  setReceiveCheckInfo({ check_number: "", bank: "", check_date: "" });
                  setError("");
                }}
              >
                ✕
              </button>
            </div>
            <div className="ord-modal-body">
              {error && (
                <div className="ord-error" style={{ marginBottom: "0.75rem" }}>
                  {error}
                  <button
                    className="ord-error-close"
                    onClick={() => setError("")}
                  >
                    ✕
                  </button>
                </div>
              )}
              {/* DR# field */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--th-text-dim)", display: "block", marginBottom: "0.3rem" }}>
                  Delivery Receipt (DR) # <span style={{ color: "var(--th-rose)" }}>*</span>
                </label>
                <input
                  className="ord-input"
                  placeholder="e.g. DR-2026-00123"
                  value={deliveryReceipt}
                  onChange={(e) => setDeliveryReceipt(e.target.value)}
                />
              </div>

              {/* Payment Mode */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--th-text-dim)", display: "block", marginBottom: "0.4rem" }}>
                  Payment Mode <span style={{ color: "var(--th-rose)" }}>*</span>
                </label>
                <div className="ord-paymode-btns">
                  {[
                    { value: "CASH", label: "💵 Cash", color: "var(--th-emerald)", bg: "var(--th-emerald-bg)" },
                    { value: "CHECK", label: "🖊 Check Release", color: "var(--th-violet)", bg: "var(--th-violet-bg)" },
                    { value: "TERMS", label: "📅 Supplier Terms", color: "var(--th-sky)", bg: "var(--th-sky-bg)" },
                  ].map(opt => (
                    <button key={opt.value} className="ord-paymode-btn" onClick={() => setReceivePaymentMode(opt.value)} style={{
                      border: receivePaymentMode === opt.value ? `1.5px solid ${opt.color}` : "1px solid var(--th-border-strong)",
                      background: receivePaymentMode === opt.value ? opt.bg : "var(--th-bg-input)",
                      color: receivePaymentMode === opt.value ? opt.color : "var(--th-text-dim)",
                    }}>{opt.label}</button>
                  ))}
                </div>
                {receivePaymentMode === "CASH" && (
                  <div style={{ marginTop: "0.5rem", padding: "0.5rem 0.75rem", borderRadius: 6, background: "var(--th-emerald-bg)", fontSize: "0.82rem", color: "var(--th-emerald)" }}>
                    Payable will be recorded as already <b>PAID</b> on receipt.
                  </div>
                )}
                {receivePaymentMode === "TERMS" && (
                  <div style={{ marginTop: "0.5rem", padding: "0.5rem 0.75rem", borderRadius: 6, background: "var(--th-sky-bg)", fontSize: "0.82rem", color: "var(--th-sky)" }}>
                    Payable will be created as <b>OPEN</b> with due date from supplier payment terms.
                  </div>
                )}
                {receivePaymentMode === "CHECK" && (
                  <div style={{ marginTop: "0.6rem", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                    <div>
                      <label style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--th-text-dim)", display: "block", marginBottom: "0.25rem" }}>Check # <span style={{ color: "var(--th-rose)" }}>*</span></label>
                      <input className="ord-input" placeholder="e.g. 001234" value={receiveCheckInfo.check_number} onChange={e => setReceiveCheckInfo(p => ({ ...p, check_number: e.target.value }))} style={{ fontSize: "0.88rem" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--th-text-dim)", display: "block", marginBottom: "0.25rem" }}>Bank <span style={{ color: "var(--th-rose)" }}>*</span></label>
                      <input className="ord-input" placeholder="e.g. BPI, BDO" value={receiveCheckInfo.bank} onChange={e => setReceiveCheckInfo(p => ({ ...p, bank: e.target.value }))} style={{ fontSize: "0.88rem" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--th-text-dim)", display: "block", marginBottom: "0.25rem" }}>Check Date <span style={{ color: "var(--th-rose)" }}>*</span></label>
                      <input className="ord-input" type="date" value={receiveCheckInfo.check_date} onChange={e => setReceiveCheckInfo(p => ({ ...p, check_date: e.target.value }))} style={{ fontSize: "0.88rem" }} />
                    </div>
                    <div style={{ gridColumn: "1 / -1", padding: "0.45rem 0.7rem", borderRadius: 6, background: "var(--th-violet-bg)", fontSize: "0.82rem", color: "var(--th-violet)" }}>
                      Payable will be created as <b>CHECK_RELEASED</b> — waiting for supplier to deposit and clear.
                    </div>
                  </div>
                )}
              </div>

              <p style={{ fontSize: "0.88rem", color: "var(--th-text-muted)", marginBottom: "1rem" }}>
                Check items that arrived. Edit qty/price if delivery differs from the order. <strong style={{ color: "var(--th-amber, #fbbf24)" }}>DOT number is required for all tire items.</strong> Unchecked items need a reason.
              </p>

              {orderDetails.items?.map((item) => {
                const isChecked = receivedItems.some(
                  (ri) => ri.order_item_id === item.order_item_id,
                );
                const ov = receiveOverrides[item.order_item_id] || {};
                const dispQty = ov.quantity ?? item.quantity;
                const dispCost = ov.unit_cost ?? item.unit_cost;
                const isTire = (item.category || "").toUpperCase() === "TIRE" ||
                  (item.category || "").toUpperCase().includes("TIRE") ||
                  /\d+\/\d+[Rr]\d+/.test(item.size || "") ||
                  (item.item_name || "").toLowerCase().includes("tire");
                const dispDot = ov.dot_number ?? item.dot_number ?? "";
                return (
                  <div
                    key={item.order_item_id}
                    className={`ord-check-item ${isChecked ? "checked" : "unchecked"}`}
                  >
                    <label className="ord-check-label">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setReceivedItems([...receivedItems, item]);
                            const nr = { ...notReceivedReasons };
                            delete nr[item.order_item_id];
                            setNotReceivedReasons(nr);
                          } else {
                            setReceivedItems(
                              receivedItems.filter(
                                (ri) => ri.order_item_id !== item.order_item_id,
                              ),
                            );
                          }
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div className="ord-check-name" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          {item.item_name}
                          {item.is_new_item ? <span style={{ fontSize: "0.6rem", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: "uppercase", background: "rgba(52,211,153,0.15)", border: "1px solid #34d399", color: "#34d399", borderRadius: 4, padding: "0.05rem 0.3rem" }}>NEW</span> : null}
                        </div>
                        {item.supplier_name && <div className="ord-check-sku" style={{ color: "#38bdf8" }}>📦 {item.supplier_name}</div>}
                        {item.sku && !item.is_new_item && (
                          <div className="ord-check-sku">{item.sku}</div>
                        )}
                        <div className="ord-check-qty">
                          Ordered: <b>{item.quantity} units</b> @ {ordCurrency(item.unit_cost)}
                        </div>
                      </div>
                    </label>
                    {isChecked && (
                      <div className="ord-check-fields" style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--th-text-dim)", display: "block", marginBottom: "0.25rem", minHeight: "1.35rem", whiteSpace: "nowrap" }}>
                            Qty Received <span style={{ color: "var(--th-orange)" }}>*</span>
                          </label>
                          <input
                            className="ord-input"
                            type="number"
                            min="0.01"
                            step="any"
                            value={dispQty}
                            onChange={(e) => setReceiveOverrides(prev => ({ ...prev, [item.order_item_id]: { ...prev[item.order_item_id], quantity: e.target.value } }))}
                            style={{ fontSize: "0.88rem", width: "100%" }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--th-text-dim)", display: "block", marginBottom: "0.25rem", minHeight: "1.35rem" }}>
                            Unit Cost
                          </label>
                          <input
                            className="ord-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={dispCost}
                            onChange={(e) => setReceiveOverrides(prev => ({ ...prev, [item.order_item_id]: { ...prev[item.order_item_id], unit_cost: e.target.value } }))}
                            style={{ fontSize: "0.88rem", width: "100%" }}
                          />
                        </div>
                        {isTire && (
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--th-amber, #fbbf24)", display: "block", marginBottom: "0.25rem", minHeight: "1.35rem" }}>
                              DOT / Year <span style={{ color: "var(--th-orange)" }}>*</span>
                            </label>
                            <input
                              className="ord-input"
                              type="text"
                              placeholder="e.g. 2025"
                              value={dispDot}
                              onChange={(e) => setReceiveOverrides(prev => ({ ...prev, [item.order_item_id]: { ...prev[item.order_item_id], dot_number: e.target.value } }))}
                              style={{ fontSize: "0.88rem", width: "100%", borderColor: isTire && !dispDot ? "var(--th-rose, #fb7185)" : undefined }}
                            />
                            {isTire && !dispDot && (
                              <div style={{ fontSize: "0.62rem", color: "var(--th-rose, #fb7185)", marginTop: "0.2rem", whiteSpace: "nowrap" }}>Required</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {!isChecked && (
                      <>
                        <div className="ord-reason-label">
                          Reason not received *
                        </div>
                        <textarea
                          className="ord-textarea"
                          style={{ marginLeft: "1.6rem", width: "calc(100% - 1.6rem)" }}
                          rows="2"
                          value={notReceivedReasons[item.order_item_id] || ""}
                          onChange={(e) =>
                            setNotReceivedReasons({
                              ...notReceivedReasons,
                              [item.order_item_id]: e.target.value,
                            })
                          }
                          placeholder="e.g., Out of stock, delivery mistake…"
                        />
                      </>
                    )}
                  </div>
                );
              })}

              <div className="ord-receive-summary">
                <div>
                  <b>{receivedItems.length}</b> of{" "}
                  <b>{orderDetails.items?.length}</b> items marked as received
                </div>
                {orderDetails.items?.length - receivedItems.length > 0 && (
                  <div className="ord-receive-warn">
                    {orderDetails.items.length - receivedItems.length} item(s)
                    will be marked as not received
                  </div>
                )}
              </div>
            </div>
            <div className="ord-modal-footer">
              <button
                className="ord-btn ord-btn-emerald"
                style={{
                  flex: 1,
                  justifyContent: "center",
                  padding: "0.65rem",
                }}
                disabled={loading || receivedItems.length === 0}
                onClick={stageReceiveOrder}
              >
                {loading ? "Processing…" : "✓ Complete Receive"}
              </button>
              <button
                className="ord-btn ord-btn-slate"
                style={{
                  flex: 1,
                  justifyContent: "center",
                  padding: "0.65rem",
                }}
                onClick={() => {
                  setShowReceiveModal(false);
                  setReceivedItems([]);
                  setNotReceivedReasons({});
                  setReceiveOverrides({});
                  setDeliveryReceipt("");
                  setReceivePaymentMode("TERMS");
                  setReceiveCheckInfo({ check_number: "", bank: "", check_date: "" });
                  setError("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
