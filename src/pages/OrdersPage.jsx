import "../pages_css/OrdersPage.css";
import React from "react";
import Pagination from "../components/Pagination";
import SearchInput from "../components/SearchInput";
import { API_URL, currency, apiFetch } from "../lib/config";
import usePaginatedResource from "../hooks/usePaginatedResource";

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

const ordCompact = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000_000) return "₱" + (v / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "") + "B";
  if (v >= 1_000_000)     return "₱" + (v / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (v >= 1_000)         return "₱" + (v / 1_000).toFixed(2).replace(/\.?0+$/, "") + "K";
  return "₱" + v.toFixed(2);
};

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

  const showAmounts =
    orderStatus !== "RECEIVED" || item.received_status !== "NOT_RECEIVED";

  return (
    <div
      className={`ord-detail-item ${orderStatus === "RECEIVED" ? (isReceived ? "received" : "not-received") : ""}`}
    >
      <div className="ord-detail-item-top">
        <div style={{ flex: 1 }}>
          <div
            className="ord-detail-item-name"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              flexWrap: "wrap",
            }}
          >
            {item.item_name}
            {item.is_new_item ? (
              <span
                style={{
                  fontSize: "0.62rem",
                  fontFamily: "'Barlow Condensed',sans-serif",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  background: "rgba(52,211,153,0.15)",
                  border: "1px solid #34d399",
                  color: "#34d399",
                  borderRadius: 4,
                  padding: "0.05rem 0.35rem",
                  lineHeight: 1.4,
                }}
              >
                NEW
              </span>
            ) : null}
          </div>
          {item.supplier_name && (
            <div className="ord-detail-item-sku" style={{ color: "#38bdf8" }}>
              📦 {item.supplier_name}
            </div>
          )}
          {item.sku && !item.is_new_item && (
            <div className="ord-detail-item-sku">{item.sku}</div>
          )}
          {item.dot_number && (
            <div
              className="ord-detail-item-sku"
              style={{ color: "var(--th-amber, #fbbf24)", fontWeight: 700 }}
            >
              DOT {item.dot_number}
            </div>
          )}
        </div>
        <span className={`ord-badge ${badgeClass}`}>{badgeLabel}</span>
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
  items,
  suppliers,
  orderItems,
  orderNotes,
  orderSearchQuery,
  orderModalCurrentPage,
  orderModalTotalPages,
  orderModalCurrentItems,
  filteredOrderItems,
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
  const [leftTab, setLeftTab] = React.useState("existing");
  const [newItemForm, setNewItemForm] = React.useState({
    brand: "",
    supplier_id: "",
    design: "",
    size: "",
    category: "",
    unit_cost: "",
    selling_price: "",
    quantity: "1",
    reorder_point: "0",
  });
  const [newItemError, setNewItemError] = React.useState("");

  const [dbSizes, setDbSizes] = React.useState([]);
  const [showSizeSug, setShowSizeSug] = React.useState(false);

  const [dbBrands, setDbBrands] = React.useState([]);
  const [showBrandSug, setShowBrandSug] = React.useState(false);

  const [dbDesigns, setDbDesigns] = React.useState([]);
  const [showDesignSug, setShowDesignSug] = React.useState(false);

  React.useEffect(() => {
    // Sizes
    apiFetch(`${API_URL}/item-sizes/any`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setDbSizes(d);
      })
      .catch(() => {});

    // Brands
    apiFetch(`${API_URL}/item-brands/any`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setDbBrands(d);
      })
      .catch(() => {});

    // Designs
    apiFetch(`${API_URL}/item-designs/any`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setDbDesigns(d);
      })
      .catch(() => {});
  }, []);

  const sizeSuggestions = React.useMemo(() => {
    if (!newItemForm.size) return [];
    const q = newItemForm.size.toLowerCase();
    return dbSizes.filter((s) => s.toLowerCase().includes(q)).slice(0, 8);
  }, [newItemForm.size, dbSizes]);

  const brandSuggestions = React.useMemo(() => {
    if (!newItemForm.brand) return [];
    const q = newItemForm.brand.toLowerCase();
    const matches = [];
    const seen = new Set();

    // 1. Exact/partial brand matches
    dbBrands.forEach((b) => {
      if (b.toLowerCase().includes(q)) {
        matches.push({ brand: b });
        seen.add(b.toUpperCase());
      }
    });

    // 2. Matching designs -> suggest their brands
    dbDesigns.forEach((d) => {
      if (
        d.design.toLowerCase().includes(q) &&
        !seen.has(d.brand?.toUpperCase())
      ) {
        matches.push({ brand: d.brand, fromDesign: d.design });
        seen.add(d.brand.toUpperCase());
      }
    });

    return matches.slice(0, 8);
  }, [newItemForm.brand, dbBrands, dbDesigns]);

  const designSuggestions = React.useMemo(() => {
    if (!newItemForm.design) return [];
    const q = newItemForm.design.toLowerCase();
    const brand = newItemForm.brand.toLowerCase();

    // Filter by query and optionally by brand
    const filtered = dbDesigns.filter((d) => {
      const matchQuery = d.design.toLowerCase().includes(q);
      const matchBrand = brand ? (d.brand || "").toLowerCase() === brand : true;
      return matchQuery && matchBrand;
    });

    if (filtered.length > 0) return filtered.slice(0, 8);

    // Fallback to any design matching the query
    return dbDesigns
      .filter((d) => d.design.toLowerCase().includes(q))
      .slice(0, 8);
  }, [newItemForm.design, newItemForm.brand, dbDesigns]);

  const availableBrands = React.useMemo(() => {
    const seen = new Set();
    const brands = [];
    for (const s of suppliers || []) {
      for (const b of s.supplier_brands || []) {
        if (!seen.has(b.brand_name)) {
          seen.add(b.brand_name);
          brands.push(b.brand_name);
        }
      }
    }
    return brands.sort();
  }, [suppliers]);

  const suppliersForBrand = React.useMemo(() => {
    if (!newItemForm.brand) return [];
    const filtered = (suppliers || []).filter((s) =>
      (s.supplier_brands || []).some(
        (b) => b.brand_name.toUpperCase() === newItemForm.brand.toUpperCase(),
      ),
    );
    return filtered.length > 0 ? filtered : suppliers || [];
  }, [suppliers, newItemForm.brand]);

  function handleNewBrandChange(brand) {
    setNewItemForm((f) => ({ ...f, brand, supplier_id: "" }));
  }

  function addNewItemToOrder() {
    setNewItemError("");
    if (!newItemForm.brand) return setNewItemError("Select a brand");
    if (!newItemForm.supplier_id) return setNewItemError("Select a supplier");
    if (!newItemForm.design.trim())
      return setNewItemError("Design is required");
    if (!newItemForm.size.trim()) return setNewItemError("Size is required");
    if (!newItemForm.category.trim())
      return setNewItemError("Category is required");
    if (!newItemForm.unit_cost || parseFloat(newItemForm.unit_cost) <= 0)
      return setNewItemError("Unit cost is required");
    if (
      !newItemForm.selling_price ||
      parseFloat(newItemForm.selling_price) <= 0
    )
      return setNewItemError("Selling price is required");
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
    setNewItemForm({
      brand: "",
      supplier_id: "",
      design: "",
      size: "",
      category: "",
      unit_cost: "",
      selling_price: "",
      quantity: "1",
      reorder_point: "0",
    });
    setNewItemError("");
  }

  const tabBtn = (tab, label) => (
    <button
      onClick={() => setLeftTab(tab)}
      style={{
        flex: 1,
        padding: "0.5rem 0.75rem",
        cursor: "pointer",
        fontFamily: "'Barlow Condensed',sans-serif",
        fontWeight: 700,
        fontSize: "clamp(0.72rem, 2.7vw, 0.82rem)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        border: "none",
        borderBottom:
          leftTab === tab
            ? "2px solid var(--th-orange,#f97316)"
            : "2px solid transparent",
        background: "transparent",
        color:
          leftTab === tab
            ? "var(--th-orange,#f97316)"
            : "var(--th-text-dim,#94a3b8)",
        transition: "color 0.15s, border-color 0.15s",
      }}
    >
      {label}
    </button>
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
              <div
                style={{
                  display: "flex",
                  borderBottom: "1px solid var(--th-border,#283245)",
                  marginBottom: "0.6rem",
                }}
              >
                {tabBtn("existing", "Existing Items")}
                {tabBtn("new", "+ New Item")}
              </div>

              {leftTab === "new" ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.55rem",
                  }}
                >
                  <div style={{ position: "relative" }}>
                    <label
                      style={{
                        fontSize: "clamp(0.62rem, 2.2vw, 0.72rem)",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        color: "#64748b",
                        fontWeight: 600,
                        display: "block",
                        marginBottom: "0.25rem",
                      }}
                    >
                      Brand <span style={{ color: "#38bdf8" }}>*</span>
                    </label>
                    <input
                      className="inv-input"
                      placeholder="e.g. PRINX"
                      value={newItemForm.brand}
                      onChange={(e) => handleNewBrandChange(e.target.value)}
                      onFocus={() => setShowBrandSug(true)}
                      onBlur={() =>
                        setTimeout(() => setShowBrandSug(false), 200)
                      }
                    />
                    {showBrandSug && brandSuggestions.length > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 4px)",
                          left: 0,
                          right: 0,
                          background: "var(--th-bg-input,#1a2132)",
                          border: "1px solid var(--th-border-strong,#3d5068)",
                          borderRadius: "8px",
                          overflowY: "auto",
                          maxHeight: "150px",
                          zIndex: 50,
                          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                        }}
                      >
                        {brandSuggestions.map((s, si) => (
                          <div
                            key={si}
                            onMouseDown={() => {
                              setNewItemForm((f) => ({
                                ...f,
                                brand: s.brand,
                                design: s.fromDesign || f.design,
                                supplier_id: "",
                              }));
                              setShowBrandSug(false);
                            }}
                            style={{
                              padding: "0.5rem 0.75rem",
                              cursor: "pointer",
                              borderBottom:
                                "1px solid var(--th-border-mid,#283245)",
                              fontSize: "0.85rem",
                              color: "var(--th-text-primary,#f8fafc)",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background =
                                "var(--th-border-mid,#283245)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = "transparent")
                            }
                          >
                            {s.brand}
                            {s.fromDesign && (
                              <span
                                style={{
                                  fontSize: "0.7rem",
                                  color: "var(--th-orange)",
                                  marginLeft: "0.5rem",
                                  opacity: 0.8,
                                }}
                              >
                                ({s.fromDesign})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {newItemForm.brand && (
                    <div>
                      <label
                        style={{
                          fontSize: "clamp(0.62rem, 2.2vw, 0.72rem)",
                          textTransform: "uppercase",
                          letterSpacing: "0.07em",
                          color: "#64748b",
                          fontWeight: 600,
                          display: "block",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Supplier <span style={{ color: "#38bdf8" }}>*</span>
                      </label>
                      <select
                        className="inv-input"
                        value={newItemForm.supplier_id}
                        onChange={(e) =>
                          setNewItemForm((f) => ({
                            ...f,
                            supplier_id: e.target.value,
                          }))
                        }
                      >
                        <option value="">— Select supplier —</option>
                        {suppliersForBrand.map((s) => (
                          <option key={s.supplier_id} value={s.supplier_id}>
                            {s.supplier_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "0.5rem",
                    }}
                  >
                    <div style={{ position: "relative" }}>
                      <label
                        style={{
                          fontSize: "clamp(0.62rem, 2.2vw, 0.72rem)",
                          textTransform: "uppercase",
                          letterSpacing: "0.07em",
                          color: "#64748b",
                          fontWeight: 600,
                          display: "block",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Design <span style={{ color: "#38bdf8" }}>*</span>
                      </label>
                      <input
                        className="inv-input"
                        placeholder="e.g. Turanza"
                        value={newItemForm.design}
                        onChange={(e) =>
                          setNewItemForm((f) => ({
                            ...f,
                            design: e.target.value,
                          }))
                        }
                        onFocus={() => setShowDesignSug(true)}
                        onBlur={() =>
                          setTimeout(() => setShowDesignSug(false), 200)
                        }
                      />
                      {showDesignSug && designSuggestions.length > 0 && (
                        <div
                          style={{
                            position: "absolute",
                            top: "calc(100% + 4px)",
                            left: 0,
                            right: 0,
                            background: "var(--th-bg-input,#1a2132)",
                            border: "1px solid var(--th-border-strong,#3d5068)",
                            borderRadius: "8px",
                            overflowY: "auto",
                            maxHeight: "150px",
                            zIndex: 50,
                            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                          }}
                        >
                          {designSuggestions.map((d, di) => (
                            <div
                              key={di}
                              onMouseDown={() => {
                                setNewItemForm((f) => ({
                                  ...f,
                                  design: d.design,
                                  brand: d.brand || f.brand,
                                  category: d.category || f.category,
                                }));
                                setShowDesignSug(false);
                              }}
                              style={{
                                padding: "0.5rem 0.75rem",
                                cursor: "pointer",
                                borderBottom:
                                  "1px solid var(--th-border-mid,#283245)",
                                fontSize: "0.85rem",
                                color: "var(--th-text-primary,#f8fafc)",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.background =
                                  "var(--th-border-mid,#283245)")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.background =
                                  "transparent")
                              }
                            >
                              {d.design}
                              {!newItemForm.brand && d.brand && (
                                <span
                                  style={{
                                    fontSize: "0.7rem",
                                    color: "var(--th-text-muted)",
                                    marginLeft: "0.5rem",
                                  }}
                                >
                                  ({d.brand})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ position: "relative" }}>
                      <label
                        style={{
                          fontSize: "clamp(0.62rem, 2.2vw, 0.72rem)",
                          textTransform: "uppercase",
                          letterSpacing: "0.07em",
                          color: "#64748b",
                          fontWeight: 600,
                          display: "block",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Size <span style={{ color: "#38bdf8" }}>*</span>
                      </label>
                      <input
                        className="inv-input"
                        placeholder="e.g. 205/65R16"
                        value={newItemForm.size}
                        onChange={(e) =>
                          setNewItemForm((f) => ({
                            ...f,
                            size: e.target.value,
                          }))
                        }
                        onFocus={() => setShowSizeSug(true)}
                        onBlur={() =>
                          setTimeout(() => setShowSizeSug(false), 200)
                        }
                      />
                      {showSizeSug && sizeSuggestions.length > 0 && (
                        <div
                          style={{
                            position: "absolute",
                            top: "calc(100% + 4px)",
                            left: 0,
                            right: 0,
                            background: "var(--th-bg-input,#1a2132)",
                            border: "1px solid var(--th-border-strong,#3d5068)",
                            borderRadius: "8px",
                            overflowY: "auto",
                            maxHeight: "150px",
                            zIndex: 50,
                            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                          }}
                        >
                          {sizeSuggestions.map((s) => (
                            <div
                              key={s}
                              onMouseDown={() => {
                                setNewItemForm((f) => ({ ...f, size: s }));
                                setShowSizeSug(false);
                              }}
                              style={{
                                padding: "0.5rem 0.75rem",
                                cursor: "pointer",
                                borderBottom:
                                  "1px solid var(--th-border-mid,#283245)",
                                fontSize: "0.85rem",
                                color: "var(--th-text-primary,#f8fafc)",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.background =
                                  "var(--th-border-mid,#283245)")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.background =
                                  "transparent")
                              }
                            >
                              {s}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: "clamp(0.62rem, 2.2vw, 0.72rem)",
                          textTransform: "uppercase",
                          letterSpacing: "0.07em",
                          color: "#64748b",
                          fontWeight: 600,
                          display: "block",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Category <span style={{ color: "#38bdf8" }}>*</span>
                      </label>
                      <select
                        className="inv-input"
                        value={newItemForm.category}
                        onChange={(e) =>
                          setNewItemForm((f) => ({
                            ...f,
                            category: e.target.value,
                          }))
                        }
                      >
                        <option value="">— Select —</option>
                        {[
                          "PCR",
                          "SUV",
                          "TRUCK",
                          "MOTORCYCLE",
                          "VALVE",
                          "WEIGHT",
                          "SEALANT",
                          "MISC",
                        ].map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: "clamp(0.62rem, 2.2vw, 0.72rem)",
                          textTransform: "uppercase",
                          letterSpacing: "0.07em",
                          color: "#64748b",
                          fontWeight: 600,
                          display: "block",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Qty to Order <span style={{ color: "#38bdf8" }}>*</span>
                      </label>
                      <input
                        className="inv-input"
                        type="number"
                        min="1"
                        placeholder="1"
                        value={newItemForm.quantity}
                        onChange={(e) =>
                          setNewItemForm((f) => ({
                            ...f,
                            quantity: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: "clamp(0.62rem, 2.2vw, 0.72rem)",
                          textTransform: "uppercase",
                          letterSpacing: "0.07em",
                          color: "#64748b",
                          fontWeight: 600,
                          display: "block",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Unit Cost <span style={{ color: "#38bdf8" }}>*</span>
                      </label>
                      <input
                        className="inv-input"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={newItemForm.unit_cost}
                        onChange={(e) =>
                          setNewItemForm((f) => ({
                            ...f,
                            unit_cost: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: "clamp(0.62rem, 2.2vw, 0.72rem)",
                          textTransform: "uppercase",
                          letterSpacing: "0.07em",
                          color: "#64748b",
                          fontWeight: 600,
                          display: "block",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Selling Price{" "}
                        <span style={{ color: "#38bdf8" }}>*</span>
                      </label>
                      <input
                        className="inv-input"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={newItemForm.selling_price}
                        onChange={(e) =>
                          setNewItemForm((f) => ({
                            ...f,
                            selling_price: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: "clamp(0.62rem, 2.2vw, 0.72rem)",
                          textTransform: "uppercase",
                          letterSpacing: "0.07em",
                          color: "#64748b",
                          fontWeight: 600,
                          display: "block",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Reorder Point
                      </label>
                      <input
                        className="inv-input"
                        type="number"
                        min="0"
                        placeholder="0"
                        value={newItemForm.reorder_point}
                        onChange={(e) =>
                          setNewItemForm((f) => ({
                            ...f,
                            reorder_point: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  {newItemError && (
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "#fb7185",
                        background: "rgba(251,113,133,0.1)",
                        border: "1px solid #fb7185",
                        borderRadius: 6,
                        padding: "0.4rem 0.65rem",
                      }}
                    >
                      {newItemError}
                    </div>
                  )}
                  <button
                    className="inv-btn inv-btn-emerald"
                    onClick={addNewItemToOrder}
                    style={{ marginTop: "0.25rem" }}
                  >
                    + Add to Order
                  </button>
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
                      const stockCls = qty > 5 ? "ok" : qty > 0 ? "low" : "out";
                      return (
                        <div
                          key={item.item_id}
                          className={`inv-order-item-row${inOrder ? " in-order" : ""}`}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="inv-order-item-name">
                              {item.item_name}
                            </div>
                            <div className="inv-order-item-meta">
                              {item.sku}
                            </div>
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
                  {filteredOrderItems.length > ORDER_MODAL_ITEMS_PER_PAGE && (
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
                          filteredOrderItems.length,
                        )}{" "}
                        of {filteredOrderItems.length}
                      </span>
                      <div style={{ display: "flex", gap: "0.35rem" }}>
                        <button
                          className="inv-page-btn"
                          disabled={orderModalCurrentPage === 1}
                          onClick={() =>
                            onPageChange(orderModalCurrentPage - 1)
                          }
                        >
                          ← Prev
                        </button>
                        <span className="inv-page-current">
                          {orderModalCurrentPage}/{orderModalTotalPages}
                        </span>
                        <button
                          className="inv-page-btn"
                          disabled={
                            orderModalCurrentPage === orderModalTotalPages
                          }
                          onClick={() =>
                            onPageChange(orderModalCurrentPage + 1)
                          }
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
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: "0.5rem",
                  borderBottom: "1px solid var(--th-border,#283245)",
                }}
              >
                <span
                  style={{
                    fontFamily: "'Barlow Condensed',sans-serif",
                    fontWeight: 700,
                    fontSize: "clamp(0.72rem, 2.6vw, 0.82rem)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--th-text-dim,#94a3b8)",
                  }}
                >
                  Order Items
                </span>
                <span
                  style={{
                    fontFamily: "'Barlow Condensed',sans-serif",
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    background:
                      orderItems.length > 0
                        ? "rgba(249,115,22,0.15)"
                        : "rgba(100,116,139,0.12)",
                    color:
                      orderItems.length > 0
                        ? "var(--th-orange,#f97316)"
                        : "#475569",
                    border: `1px solid ${orderItems.length > 0 ? "rgba(249,115,22,0.3)" : "#283245"}`,
                    borderRadius: 20,
                    padding: "0.1rem 0.6rem",
                  }}
                >
                  {orderItems.length}{" "}
                  {orderItems.length === 1 ? "item" : "items"}
                </span>
              </div>
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  maxHeight: "300px",
                  overflowY: "auto",
                }}
              >
                {orderItems.length === 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "120px",
                      gap: "0.5rem",
                      color: "#3d5068",
                    }}
                  >
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      style={{ opacity: 0.3 }}
                    >
                      <circle cx="9" cy="21" r="1" />
                      <circle cx="20" cy="21" r="1" />
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                    </svg>
                    <span style={{ fontSize: "0.78rem" }}>
                      No items added yet
                    </span>
                  </div>
                ) : (
                  orderItems.map((oi) => (
                    <div
                      key={oi.order_item_id}
                      style={{
                        borderBottom: "1px solid var(--th-border,#283245)",
                        padding: "0.4rem 0",
                      }}
                    >
                      <div
                        className="inv-order-cart-row"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                        }}
                      >
                        <div
                          className="inv-order-cart-info"
                          style={{ flex: 1, minWidth: 0 }}
                        >
                          <div
                            className="inv-order-cart-name"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.35rem",
                              flexWrap: "wrap",
                            }}
                          >
                            {oi.item_name}
                            {oi.is_new_item && (
                              <span
                                style={{
                                  fontSize: "0.62rem",
                                  fontFamily: "'Barlow Condensed',sans-serif",
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                  background: "rgba(52,211,153,0.15)",
                                  border: "1px solid #34d399",
                                  color: "#34d399",
                                  borderRadius: 4,
                                  padding: "0.05rem 0.35rem",
                                  lineHeight: 1.4,
                                }}
                              >
                                NEW
                              </span>
                            )}
                          </div>
                          <div className="inv-order-cart-sku">
                            {oi.is_new_item ? oi.category : oi.sku}
                          </div>
                        </div>
                        <button
                          className="inv-qty-btn"
                          onClick={() =>
                            onUpdateQty(oi.order_item_id, oi.quantity - 1)
                          }
                        >
                          −
                        </button>
                        <input
                          className="inv-qty-display"
                          type="number"
                          min="1"
                          value={oi.quantity}
                          onChange={(e) =>
                            onUpdateQty(
                              oi.order_item_id,
                              Math.max(1, parseInt(e.target.value) || 1),
                            )
                          }
                        />
                        <button
                          className="inv-qty-btn"
                          onClick={() =>
                            onUpdateQty(oi.order_item_id, oi.quantity + 1)
                          }
                        >
                          +
                        </button>
                        <div className="inv-order-line-total">
                          {ordCurrency(oi.line_total)}
                        </div>
                        <button
                          className="inv-cancel-btn"
                          onClick={() => onRemoveItem(oi.order_item_id)}
                        >
                          ✕
                        </button>
                      </div>
                      {(() => {
                        const allSuppliers = suppliers || [];
                        const itemBrand = (oi.brand || "").trim().toUpperCase();
                        const brandSuppliers = allSuppliers.filter((s) =>
                          (s.supplier_brands || []).some(
                            (b) =>
                              b.brand_name.trim().toUpperCase() === itemBrand,
                          ),
                        );
                        const listToShow =
                          brandSuppliers.length > 0
                            ? brandSuppliers
                            : allSuppliers;
                        const isFallback = brandSuppliers.length === 0;
                        return (
                          <div
                            className="inv-order-supplier-wrap"
                            style={{
                              marginTop: "0.4rem",
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "0.3rem",
                              alignItems: "center",
                            }}
                          >
                            {isFallback && (
                              <span
                                style={{
                                  fontSize: "clamp(0.6rem, 2.1vw, 0.68rem)",
                                  color: "#64748b",
                                  width: "100%",
                                  marginBottom: "0.1rem",
                                }}
                              >
                                No brand match — select supplier:
                              </span>
                            )}
                            {listToShow.map((s) => {
                              const selected = oi.supplier_id === s.supplier_id;
                              return (
                                <button
                                  key={s.supplier_id}
                                  className="inv-order-supplier-chip"
                                  onClick={() =>
                                    onUpdateSupplier(
                                      oi.order_item_id,
                                      selected ? "" : s.supplier_id,
                                    )
                                  }
                                  style={{
                                    padding: "0.2rem 0.6rem",
                                    borderRadius: 20,
                                    fontSize: "0.75rem",
                                    cursor: "pointer",
                                    fontFamily: "'Barlow Condensed',sans-serif",
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.04em",
                                    border: selected
                                      ? "1.5px solid #38bdf8"
                                      : "1px solid #3d5068",
                                    background: selected
                                      ? "rgba(56,189,248,0.15)"
                                      : "var(--th-bg-input,#283245)",
                                    color: selected ? "#38bdf8" : "#64748b",
                                    transition: "all 0.12s",
                                  }}
                                >
                                  {selected ? "✓ " : ""}
                                  {s.supplier_name}
                                </button>
                              );
                            })}
                            {!oi.supplier_id && (
                              <span
                                style={{ fontSize: "0.7rem", color: "#f97316" }}
                              >
                                ⚠ required
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ))
                )}
              </div>
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
              <div className="inv-order-total-bar">
                <span className="inv-order-total-label">Order Total</span>
                <span className="inv-order-total-amount">
                  {ordCurrency(totalOrderAmount)}
                </span>
              </div>
              {error && (
                <div className="inv-error">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
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
            {loading
              ? "Creating…"
              : `✓ Create Order${orderItems.length > 0 ? ` (${orderItems.length})` : ""}`}
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
    <div
      className="confirm-overlay"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
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
          <button
            className="confirm-btn-cancel"
            onClick={onCancel}
            disabled={loading}
          >
            Back
          </button>
          <button
            className={`confirm-btn-ok${isDanger ? " danger" : ""}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Processing…" : pending.okLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   ⚡ QUICK RECEIVE MODAL
   Walk-in / Pickup bypass — skips Pending & Confirmed
════════════════════════════════════════ */
const TIRE_CATS_QR = [
  "PCR",
  "SUV",
  "TBR",
  "LT",
  "MOTORCYCLE",
  "TIRE",
  "RECAP",
  "TUBE",
];

function QuickReceiveModal({ shopId, suppliers, items, onClose, onSuccess }) {
  const [dr, setDr] = React.useState(() => localStorage.getItem(`th-qr-dr-${shopId}`) || "");
  const [paymentMode, setPaymentMode] = React.useState(() => localStorage.getItem(`th-qr-paymode-${shopId}`) || "TERMS");
  const [checkInfo, setCheckInfo] = React.useState(() => {
    try {
      const saved = localStorage.getItem(`th-qr-check-${shopId}`);
      return saved ? JSON.parse(saved) : { check_number: "", bank: "", check_date: "" };
    } catch { return { check_number: "", bank: "", check_date: "" }; }
  });
  const [notes, setNotes] = React.useState(() => localStorage.getItem(`th-qr-notes-${shopId}`) || "");
  const [lines, setLines] = React.useState(() => {
    try {
      const saved = localStorage.getItem(`th-qr-lines-${shopId}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState("");

  // --- Quick Receive Persistence ---
  React.useEffect(() => {
    if (!shopId) return;
    localStorage.setItem(`th-qr-dr-${shopId}`, dr);
    localStorage.setItem(`th-qr-paymode-${shopId}`, paymentMode);
    localStorage.setItem(`th-qr-check-${shopId}`, JSON.stringify(checkInfo));
    localStorage.setItem(`th-qr-notes-${shopId}`, notes);
    localStorage.setItem(`th-qr-lines-${shopId}`, JSON.stringify(lines));
  }, [dr, paymentMode, checkInfo, notes, lines, shopId]);

  // Item search state
  const [itemSearch, setItemSearch] = React.useState("");
  const [showSug, setShowSug] = React.useState(false);
  const itemSearchRef = React.useRef(null);

  const suggestions = React.useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return [];
    return (items || [])
      .filter((i) =>
        [i.item_name, i.sku, i.brand, i.design, i.size].some(
          (f) => f && f.toLowerCase().includes(q),
        ),
      )
      .slice(0, 10);
  }, [itemSearch, items]);

  function addLine(item) {
    setLines((prev) => [
      ...prev,
      {
        _key: `${Date.now()}-${Math.random()}`,
        item_id: item.item_id,
        item_name:
          item.item_name || `${item.brand} ${item.design} ${item.size}`,
        category: item.category || "",
        brand: item.brand || "",
        design: item.design || "",
        size: item.size || "",
        current_qty: item.current_quantity || 0,
        supplier_id: item.supplier_id || "",
        quantity: 1,
        unit_cost: item.unit_cost || 0,
        dot_number: "",
        is_new_item: false,
      },
    ]);
    setItemSearch("");
    setShowSug(false);
  }

  function updateLine(key, field, value) {
    setLines((prev) =>
      prev.map((l) => (l._key === key ? { ...l, [field]: value } : l)),
    );
  }

  function removeLine(key) {
    setLines((prev) => prev.filter((l) => l._key !== key));
  }

  const totalAmount = lines.reduce(
    (s, l) =>
      s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_cost) || 0),
    0,
  );

  // ── Tab + New Item Form state ──
  const [qrTab, setQrTab] = React.useState("search"); // 'search' | 'new'
  const [newItemForm, setNewItemForm] = React.useState({
    brand: "",
    supplier_id: "",
    design: "",
    size: "",
    category: "",
    unit_cost: "",
    selling_price: "",
    quantity: "1",
    reorder_point: "0",
    dot_number: "",
  });
  const [newItemErr, setNewItemErr] = React.useState("");

  // Autocomplete data (fetched once)
  const [dbSizes, setDbSizes] = React.useState([]);
  const [dbBrands, setDbBrands] = React.useState([]);
  const [dbDesigns, setDbDesigns] = React.useState([]);
  const [showNiSize, setShowNiSize] = React.useState(false);
  const [showNiBrand, setShowNiBrand] = React.useState(false);
  const [showNiDesign, setShowNiDesign] = React.useState(false);

  React.useEffect(() => {
    apiFetch(`${API_URL}/item-sizes/any`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setDbSizes(d);
      })
      .catch(() => {});
    apiFetch(`${API_URL}/item-brands/any`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setDbBrands(d);
      })
      .catch(() => {});
    apiFetch(`${API_URL}/item-designs/any`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setDbDesigns(d);
      })
      .catch(() => {});
  }, []);

  const niSizeSuggestions = React.useMemo(() => {
    if (!newItemForm.size) return [];
    const q = newItemForm.size.toLowerCase();
    return dbSizes.filter((s) => s.toLowerCase().includes(q)).slice(0, 8);
  }, [newItemForm.size, dbSizes]);

  const niBrandSuggestions = React.useMemo(() => {
    if (!newItemForm.brand) return [];
    const q = newItemForm.brand.toLowerCase();
    const seen = new Set();
    const out = [];
    dbBrands.forEach((b) => {
      if (b.toLowerCase().includes(q) && !seen.has(b)) {
        seen.add(b);
        out.push({ brand: b });
      }
    });
    dbDesigns.forEach((d) => {
      if (
        d.design.toLowerCase().includes(q) &&
        d.brand &&
        !seen.has(d.brand.toUpperCase())
      ) {
        seen.add(d.brand.toUpperCase());
        out.push({ brand: d.brand, fromDesign: d.design });
      }
    });
    return out.slice(0, 8);
  }, [newItemForm.brand, dbBrands, dbDesigns]);

  const niDesignSuggestions = React.useMemo(() => {
    if (!newItemForm.design) return [];
    const q = newItemForm.design.toLowerCase();
    const brand = newItemForm.brand.toLowerCase();
    const filtered = dbDesigns.filter(
      (d) =>
        d.design.toLowerCase().includes(q) &&
        (brand ? (d.brand || "").toLowerCase() === brand : true),
    );
    return (
      filtered.length > 0
        ? filtered
        : dbDesigns.filter((d) => d.design.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [newItemForm.design, newItemForm.brand, dbDesigns]);

  const suppliersForNiBrand = React.useMemo(() => {
    if (!newItemForm.brand) return suppliers || [];
    const filtered = (suppliers || []).filter((s) =>
      (s.supplier_brands || []).some(
        (b) => b.brand_name.toUpperCase() === newItemForm.brand.toUpperCase(),
      ),
    );
    return filtered.length > 0 ? filtered : suppliers || [];
  }, [newItemForm.brand, suppliers]);

  function addNewItemToLines() {
    setNewItemErr("");
    if (!newItemForm.brand.trim()) return setNewItemErr("Brand is required");
    if (!newItemForm.supplier_id) return setNewItemErr("Select a supplier");
    if (!newItemForm.design.trim()) return setNewItemErr("Design is required");
    if (!newItemForm.size.trim()) return setNewItemErr("Size is required");
    if (!newItemForm.category) return setNewItemErr("Category is required");
    if (!newItemForm.unit_cost || parseFloat(newItemForm.unit_cost) <= 0)
      return setNewItemErr("Unit cost is required");
    if (
      !newItemForm.selling_price ||
      parseFloat(newItemForm.selling_price) <= 0
    )
      return setNewItemErr("Selling price is required");
    const isTire = TIRE_CATS_QR.includes(
      (newItemForm.category || "").toUpperCase(),
    );
    if (isTire && !newItemForm.dot_number.trim())
      return setNewItemErr("DOT number is required for tire categories");
    const qty = parseInt(newItemForm.quantity) || 1;
    const cost = parseFloat(newItemForm.unit_cost);
    const brandUp = newItemForm.brand.toUpperCase();
    const designUp = newItemForm.design.toUpperCase();
    setLines((prev) => [
      ...prev,
      {
        _key: `NEW-${Date.now()}-${Math.random()}`,
        item_id: null,
        is_new_item: true,
        item_name: `${brandUp} ${designUp} ${newItemForm.size}`,
        brand: brandUp,
        design: designUp,
        size: newItemForm.size,
        category: newItemForm.category,
        supplier_id: newItemForm.supplier_id,
        quantity: qty,
        unit_cost: cost,
        selling_price: parseFloat(newItemForm.selling_price),
        reorder_point: parseInt(newItemForm.reorder_point) || 0,
        dot_number: newItemForm.dot_number.trim(),
        current_qty: 0,
      },
    ]);
    setNewItemForm({
      brand: "",
      supplier_id: "",
      design: "",
      size: "",
      category: "",
      unit_cost: "",
      selling_price: "",
      quantity: "1",
      reorder_point: "0",
      dot_number: "",
    });
    setNewItemErr("");
    setQrTab("search");
  }

  async function handleSubmit() {
    setErr("");
    if (!dr.trim()) {
      setErr("Delivery Receipt (DR) number is required");
      return;
    }
    if (lines.length === 0) {
      setErr("Add at least one item");
      return;
    }
    for (const l of lines) {
      if (!l.quantity || parseFloat(l.quantity) <= 0) {
        setErr(`Quantity must be > 0 for ${l.item_name}`);
        return;
      }
      if (!l.supplier_id) {
        setErr(`Select a supplier for ${l.item_name}`);
        return;
      }
      const isTire = TIRE_CATS_QR.includes((l.category || "").toUpperCase());
      if (isTire && !l.dot_number?.trim()) {
        setErr(`DOT number required for tire: ${l.item_name}`);
        return;
      }
    }

    const existingLines = lines.filter((l) => !l.is_new_item);
    const newItemLines = lines.filter((l) => l.is_new_item);

    setSubmitting(true);
    try {
      const token = localStorage.getItem("th-token");
      const r = await apiFetch(`${API_URL}/orders/quick-receive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shop_id: shopId,
          delivery_receipt: dr.trim(),
          payment_mode: paymentMode,
          check_info: paymentMode === "CHECK" ? checkInfo : null,
          notes: notes.trim() || null,
          received_by: localStorage.getItem("th-user") || "SYSTEM",
          lines: existingLines.map((l) => ({
            item_id: l.item_id,
            supplier_id: l.supplier_id,
            quantity: parseFloat(l.quantity),
            unit_cost: parseFloat(l.unit_cost),
            dot_number: l.dot_number?.trim() || null,
          })),
          new_items: newItemLines.map((l) => ({
            brand: l.brand,
            design: l.design,
            size: l.size,
            category: l.category,
            unit_cost: parseFloat(l.unit_cost),
            selling_price: parseFloat(l.selling_price),
            quantity: parseFloat(l.quantity),
            dot_number: l.dot_number?.trim() || null,
            supplier_id: l.supplier_id,
            reorder_point: l.reorder_point || 0,
          })),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Quick Receive failed");
      // Clear drafts upon success
      localStorage.removeItem(`th-qr-dr-${shopId}`);
      localStorage.removeItem(`th-qr-paymode-${shopId}`);
      localStorage.removeItem(`th-qr-check-${shopId}`);
      localStorage.removeItem(`th-qr-notes-${shopId}`);
      localStorage.removeItem(`th-qr-lines-${shopId}`);
      onSuccess(data);
    } catch (e) {
      setErr(e.message);
    }
    setSubmitting(false);
  }

  const modeBtn = (mode, label, icon) => (
    <button
      key={mode}
      onClick={() => setPaymentMode(mode)}
      className="ord-paymode-btn"
      style={{
        flex: 1,
        border:
          paymentMode === mode
            ? "1.5px solid var(--th-emerald)"
            : "1px solid var(--th-border-strong)",
        background:
          paymentMode === mode ? "var(--th-emerald-bg)" : "var(--th-bg-input)",
        color:
          paymentMode === mode ? "var(--th-emerald)" : "var(--th-text-dim)",
      }}
    >
      {icon} {label}
    </button>
  );

  return (
    <div
      className="inv-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && !submitting && onClose()}
    >
      <div
        className="inv-modal"
        style={{
          maxWidth: 880,
          maxHeight: "95vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div className="inv-modal-header">
          <div
            className="inv-modal-title"
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <div
              style={{
                background: "var(--th-emerald-bg)",
                color: "var(--th-emerald)",
                width: 32,
                height: 32,
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid var(--th-emerald-glow)",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <div
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                }}
              >
                ⚡ Quick Receive
              </div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "var(--th-text-dim)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Walk-In / Pickup Bypass
              </div>
            </div>
          </div>
          <button className="inv-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div
          className="inv-modal-body"
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: ".5rem",
            padding: "1.25rem",
            minHeight: "400px",
          }}
        >
          {/* Top Form Section */}
          <div
            style={{
              display: "grid",
              gap: "1rem",
              background: "var(--th-bg-card-alt)",
              padding: "1rem",
              borderRadius: "12px",
              border: "1px solid var(--th-border)",
              alignContent: "start",
            }}
          >
            <div className="qr-in">
              <div className="qr-in-width" style={{ gridColumn: "span 1" }}>
                <label className="th-label" style={{ fontSize: "0.7rem" }}>
                  Delivery Receipt (DR) #{" "}
                  <span style={{ color: "var(--th-rose)" }}>*</span>
                </label>
                <input
                  className="inv-input"
                  style={{ background: "var(--th-bg-card)" }}
                  placeholder="e.g. DR-2026-00123"
                  value={dr}
                  onChange={(e) => setDr(e.target.value)}
                />
              </div>
              <div className="qr-in-width" style={{ gridColumn: "span 1" }}>
                <label className="th-label" style={{ fontSize: "0.7rem" }}>
                  Notes (optional)
                </label>
                <input
                  className="inv-input"
                  style={{ background: "var(--th-bg-card)" }}
                  placeholder="e.g. Picked up from warehouse"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label className="th-label" style={{ fontSize: "0.7rem" }}>
                Payment Mode <span style={{ color: "var(--th-rose)" }}>*</span>
              </label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {modeBtn("CASH", "Cash", "💵")}
                {modeBtn("CHECK", "Check Release", "✏️")}
                {modeBtn("TERMS", "Supplier Terms", "🗓️")}
              </div>
            </div>

            {paymentMode === "CHECK" && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: "0.5rem",
                  padding: "0.75rem",
                  background: "var(--th-bg-card)",
                  borderRadius: "8px",
                  border: "1px solid var(--th-border)",
                }}
              >
                <div>
                  <label className="th-label" style={{ fontSize: "0.65rem" }}>
                    Check #
                  </label>
                  <input
                    className="inv-input"
                    placeholder="001234"
                    value={checkInfo.check_number}
                    onChange={(e) =>
                      setCheckInfo((c) => ({
                        ...c,
                        check_number: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="th-label" style={{ fontSize: "0.65rem" }}>
                    Bank
                  </label>
                  <input
                    className="inv-input"
                    placeholder="BDO"
                    value={checkInfo.bank}
                    onChange={(e) =>
                      setCheckInfo((c) => ({ ...c, bank: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="th-label" style={{ fontSize: "0.65rem" }}>
                    Check Date
                  </label>
                  <input
                    className="inv-input"
                    type="date"
                    value={checkInfo.check_date}
                    onChange={(e) =>
                      setCheckInfo((c) => ({
                        ...c,
                        check_date: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            )}
          </div>

          {/* Item Add Section — tabbed */}
          <div
            style={{
              background: "var(--th-bg-card-alt)",
              borderRadius: "12px",
              border: "1px solid var(--th-border)",
              overflow: "visible",
            }}
          >
            {/* Tab Strip */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid var(--th-border)",
              }}
            >
              {[
                ["search", "🔍 Search Existing"],
                ["new", "✦ New Item"],
              ].map(([t, lbl]) => (
                <button
                  key={t}
                  onClick={() => setQrTab(t)}
                  style={{
                    flex: 1,
                    padding: "0.6rem 1rem",
                    cursor: "pointer",
                    fontFamily: "'Barlow Condensed',sans-serif",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    border: "none",
                    borderBottom:
                      qrTab === t
                        ? "2px solid var(--th-orange)"
                        : "2px solid transparent",
                    background: "transparent",
                    color:
                      qrTab === t ? "var(--th-orange)" : "var(--th-text-dim)",
                    transition: "color 0.15s, border-color 0.15s",
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {qrTab === "search" ? (
              /* ── Search existing ── */
              <div style={{ padding: "1rem", position: "relative" }}>
                <input
                  ref={itemSearchRef}
                  className="inv-input"
                  style={{
                    paddingLeft: "2.5rem",
                    background: "var(--th-bg-card)",
                    height: "42px",
                    fontSize: "1rem",
                  }}
                  placeholder="Type item name, brand, size or SKU…"
                  value={itemSearch}
                  onChange={(e) => {
                    setItemSearch(e.target.value);
                    setShowSug(true);
                  }}
                  onFocus={() => setShowSug(true)}
                  onBlur={() => setTimeout(() => setShowSug(false), 200)}
                />
                <span
                  style={{
                    position: "absolute",
                    left: 28,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--th-text-faint)",
                    pointerEvents: "none",
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                {showSug && suggestions.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% - 4px)",
                      left: 16,
                      right: 16,
                      background: "var(--th-bg-card)",
                      border: "1px solid var(--th-border-strong)",
                      borderRadius: "10px",
                      zIndex: 100,
                      maxHeight: 280,
                      overflowY: "auto",
                      boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
                    }}
                  >
                    {suggestions.map((item) => (
                      <div
                        key={item.item_id}
                        onMouseDown={() => addLine(item)}
                        className="ord-sug-item"
                        style={{
                          padding: "0.75rem 1rem",
                          borderBottom: "1px solid var(--th-border)",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: "0.9rem",
                              color: "var(--th-text-primary)",
                            }}
                          >
                            {item.item_name}
                          </div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--th-text-dim)",
                            }}
                          >
                            {item.sku || "No SKU"} · {item.category} ·{" "}
                            {item.brand}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color:
                                (item.current_quantity || 0) > 0
                                  ? "var(--th-emerald)"
                                  : "var(--th-rose)",
                              fontWeight: 700,
                            }}
                          >
                            Stock: {item.current_quantity || 0}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* ── New Item Form ── */
              <div
                style={{
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.6rem",
                }}
              >
                {/* Row 1: Brand + Supplier */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ position: "relative" }}>
                    <label
                      style={{
                        fontSize: "0.68rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        color: "var(--th-text-faint)",
                        fontWeight: 600,
                        display: "block",
                        marginBottom: "0.2rem",
                      }}
                    >
                      Brand <span style={{ color: "var(--th-sky)" }}>*</span>
                    </label>
                    <input
                      className="inv-input"
                      placeholder="e.g. PRINX"
                      value={newItemForm.brand}
                      onChange={(e) =>
                        setNewItemForm((f) => ({
                          ...f,
                          brand: e.target.value,
                          supplier_id: "",
                        }))
                      }
                      onFocus={() => setShowNiBrand(true)}
                      onBlur={() =>
                        setTimeout(() => setShowNiBrand(false), 200)
                      }
                    />
                    {showNiBrand && niBrandSuggestions.length > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 4px)",
                          left: 0,
                          right: 0,
                          background: "var(--th-bg-input)",
                          border: "1px solid var(--th-border-strong)",
                          borderRadius: "8px",
                          maxHeight: 150,
                          overflowY: "auto",
                          zIndex: 60,
                          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                        }}
                      >
                        {niBrandSuggestions.map((s, i) => (
                          <div
                            key={i}
                            onMouseDown={() => {
                              setNewItemForm((f) => ({
                                ...f,
                                brand: s.brand,
                                design: s.fromDesign || f.design,
                                supplier_id: "",
                              }));
                              setShowNiBrand(false);
                            }}
                            style={{
                              padding: "0.45rem 0.75rem",
                              cursor: "pointer",
                              fontSize: "0.85rem",
                              color: "var(--th-text-primary)",
                              borderBottom: "1px solid var(--th-border)",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background =
                                "var(--th-border)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = "transparent")
                            }
                          >
                            {s.brand}
                            {s.fromDesign && (
                              <span
                                style={{
                                  fontSize: "0.7rem",
                                  color: "var(--th-orange)",
                                  marginLeft: "0.4rem",
                                  opacity: 0.8,
                                }}
                              >
                                ({s.fromDesign})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label
                      style={{
                        fontSize: "0.68rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        color: "var(--th-text-faint)",
                        fontWeight: 600,
                        display: "block",
                        marginBottom: "0.2rem",
                      }}
                    >
                      Supplier <span style={{ color: "var(--th-sky)" }}>*</span>
                    </label>
                    <select
                      className="inv-input"
                      value={newItemForm.supplier_id}
                      onChange={(e) =>
                        setNewItemForm((f) => ({
                          ...f,
                          supplier_id: e.target.value,
                        }))
                      }
                    >
                      <option value="">— Select supplier —</option>
                      {suppliersForNiBrand.map((s) => (
                        <option key={s.supplier_id} value={s.supplier_id}>
                          {s.supplier_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* Row 2: Design + Size */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ position: "relative" }}>
                    <label
                      style={{
                        fontSize: "0.68rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        color: "var(--th-text-faint)",
                        fontWeight: 600,
                        display: "block",
                        marginBottom: "0.2rem",
                      }}
                    >
                      Design <span style={{ color: "var(--th-sky)" }}>*</span>
                    </label>
                    <input
                      className="inv-input"
                      placeholder="e.g. CHANGER"
                      value={newItemForm.design}
                      onChange={(e) =>
                        setNewItemForm((f) => ({
                          ...f,
                          design: e.target.value,
                        }))
                      }
                      onFocus={() => setShowNiDesign(true)}
                      onBlur={() =>
                        setTimeout(() => setShowNiDesign(false), 200)
                      }
                    />
                    {showNiDesign && niDesignSuggestions.length > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 4px)",
                          left: 0,
                          right: 0,
                          background: "var(--th-bg-input)",
                          border: "1px solid var(--th-border-strong)",
                          borderRadius: "8px",
                          maxHeight: 150,
                          overflowY: "auto",
                          zIndex: 60,
                          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                        }}
                      >
                        {niDesignSuggestions.map((d, i) => (
                          <div
                            key={i}
                            onMouseDown={() => {
                              setNewItemForm((f) => ({
                                ...f,
                                design: d.design,
                                brand: d.brand || f.brand,
                                category: d.category || f.category,
                              }));
                              setShowNiDesign(false);
                            }}
                            style={{
                              padding: "0.45rem 0.75rem",
                              cursor: "pointer",
                              fontSize: "0.85rem",
                              color: "var(--th-text-primary)",
                              borderBottom: "1px solid var(--th-border)",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background =
                                "var(--th-border)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = "transparent")
                            }
                          >
                            {d.design}
                            {!newItemForm.brand && d.brand && (
                              <span
                                style={{
                                  fontSize: "0.7rem",
                                  color: "var(--th-text-dim)",
                                  marginLeft: "0.4rem",
                                }}
                              >
                                ({d.brand})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ position: "relative" }}>
                    <label
                      style={{
                        fontSize: "0.68rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        color: "var(--th-text-faint)",
                        fontWeight: 600,
                        display: "block",
                        marginBottom: "0.2rem",
                      }}
                    >
                      Size <span style={{ color: "var(--th-sky)" }}>*</span>
                    </label>
                    <input
                      className="inv-input"
                      placeholder="e.g. 205/65R16"
                      value={newItemForm.size}
                      onChange={(e) =>
                        setNewItemForm((f) => ({ ...f, size: e.target.value }))
                      }
                      onFocus={() => setShowNiSize(true)}
                      onBlur={() => setTimeout(() => setShowNiSize(false), 200)}
                    />
                    {showNiSize && niSizeSuggestions.length > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 4px)",
                          left: 0,
                          right: 0,
                          background: "var(--th-bg-input)",
                          border: "1px solid var(--th-border-strong)",
                          borderRadius: "8px",
                          maxHeight: 150,
                          overflowY: "auto",
                          zIndex: 60,
                          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                        }}
                      >
                        {niSizeSuggestions.map((s) => (
                          <div
                            key={s}
                            onMouseDown={() => {
                              setNewItemForm((f) => ({ ...f, size: s }));
                              setShowNiSize(false);
                            }}
                            style={{
                              padding: "0.45rem 0.75rem",
                              cursor: "pointer",
                              fontSize: "0.85rem",
                              color: "var(--th-text-primary)",
                              borderBottom: "1px solid var(--th-border)",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background =
                                "var(--th-border)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = "transparent")
                            }
                          >
                            {s}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Row 3: Category + Qty + DOT */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 0.6fr 0.8fr",
                    gap: "0.5rem",
                  }}
                >
                  <div>
                    <label
                      style={{
                        fontSize: "0.68rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        color: "var(--th-text-faint)",
                        fontWeight: 600,
                        display: "block",
                        marginBottom: "0.2rem",
                      }}
                    >
                      Category <span style={{ color: "var(--th-sky)" }}>*</span>
                    </label>
                    <select
                      className="inv-input"
                      value={newItemForm.category}
                      onChange={(e) =>
                        setNewItemForm((f) => ({
                          ...f,
                          category: e.target.value,
                        }))
                      }
                    >
                      <option value="">— Select —</option>
                      {[
                        "PCR",
                        "SUV",
                        "TBR",
                        "LT",
                        "MOTORCYCLE",
                        "VALVE",
                        "WEIGHT",
                        "SEALANT",
                        "MISC",
                      ].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      style={{
                        fontSize: "0.68rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        color: "var(--th-text-faint)",
                        fontWeight: 600,
                        display: "block",
                        marginBottom: "0.2rem",
                      }}
                    >
                      Qty <span style={{ color: "var(--th-sky)" }}>*</span>
                    </label>
                    <input
                      className="inv-input"
                      type="number"
                      min="1"
                      placeholder="1"
                      value={newItemForm.quantity}
                      onChange={(e) =>
                        setNewItemForm((f) => ({
                          ...f,
                          quantity: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        fontSize: "0.68rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        color: "var(--th-text-faint)",
                        fontWeight: 600,
                        display: "block",
                        marginBottom: "0.2rem",
                      }}
                    >
                      DOT #
                      {TIRE_CATS_QR.includes(
                        (newItemForm.category || "").toUpperCase(),
                      ) && <span style={{ color: "var(--th-rose)" }}> *</span>}
                    </label>
                    <input
                      className="inv-input"
                      placeholder="e.g. 3524"
                      style={{
                        borderColor:
                          TIRE_CATS_QR.includes(
                            (newItemForm.category || "").toUpperCase(),
                          ) && !newItemForm.dot_number.trim()
                            ? "var(--th-rose)"
                            : undefined,
                      }}
                      value={newItemForm.dot_number}
                      onChange={(e) =>
                        setNewItemForm((f) => ({
                          ...f,
                          dot_number: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                {/* Row 4: Unit Cost + Selling Price + Reorder Point */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 0.7fr",
                    gap: "0.5rem",
                  }}
                >
                  <div>
                    <label
                      style={{
                        fontSize: "0.68rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        color: "var(--th-text-faint)",
                        fontWeight: 600,
                        display: "block",
                        marginBottom: "0.2rem",
                      }}
                    >
                      Unit Cost{" "}
                      <span style={{ color: "var(--th-sky)" }}>*</span>
                    </label>
                    <input
                      className="inv-input"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={newItemForm.unit_cost}
                      onChange={(e) =>
                        setNewItemForm((f) => ({
                          ...f,
                          unit_cost: e.target.value,
                        }))
                      }
                      style={{ color: "var(--th-amber)", fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        fontSize: "0.68rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        color: "var(--th-text-faint)",
                        fontWeight: 600,
                        display: "block",
                        marginBottom: "0.2rem",
                      }}
                    >
                      Selling Price{" "}
                      <span style={{ color: "var(--th-sky)" }}>*</span>
                    </label>
                    <input
                      className="inv-input"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={newItemForm.selling_price}
                      onChange={(e) =>
                        setNewItemForm((f) => ({
                          ...f,
                          selling_price: e.target.value,
                        }))
                      }
                      style={{ color: "var(--th-emerald)", fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        fontSize: "0.68rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        color: "var(--th-text-faint)",
                        fontWeight: 600,
                        display: "block",
                        marginBottom: "0.2rem",
                      }}
                    >
                      Reorder Pt.
                    </label>
                    <input
                      className="inv-input"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={newItemForm.reorder_point}
                      onChange={(e) =>
                        setNewItemForm((f) => ({
                          ...f,
                          reorder_point: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                {newItemErr && (
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--th-rose)",
                      background: "var(--th-rose-bg)",
                      border: "1px solid var(--th-rose)",
                      borderRadius: 6,
                      padding: "0.35rem 0.6rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {newItemErr}
                  </div>
                )}
                <button
                  className="inv-btn inv-btn-emerald"
                  onClick={addNewItemToLines}
                  style={{ marginTop: "0.15rem", fontWeight: 800 }}
                >
                  ✦ Add to Receive List
                </button>
              </div>
            )}
          </div>

          {/* Line Items — responsive card list */}
          {lines.length > 0 && (
            <div className="qr-lines-wrap">
              {/* Desktop table header */}
              <div className="qr-lines-header">
                {[
                  "Item",
                  "Supplier",
                  "Qty",
                  "Cost",
                  "DOT #",
                  "Subtotal",
                  "",
                ].map((h) => (
                  <div
                    key={h}
                    className={`qr-lines-hcell${h === "Subtotal" ? " right" : h === "" ? " center" : ""}`}
                  >
                    {h}
                  </div>
                ))}
              </div>

              {lines.map((line) => {
                const isTire = TIRE_CATS_QR.includes(
                  (line.category || "").toUpperCase(),
                );
                const lineTotal =
                  (parseFloat(line.quantity) || 0) *
                  (parseFloat(line.unit_cost) || 0);
                const brandUp = (line.brand || "").trim().toUpperCase();
                const brandSups = (suppliers || []).filter((s) =>
                  (s.supplier_brands || []).some(
                    (b) => b.brand_name.trim().toUpperCase() === brandUp,
                  ),
                );
                const supList =
                  brandSups.length > 0 ? brandSups : suppliers || [];
                return (
                  <div key={line._key} className="qr-line-card">
                    {/* ── Item info + delete (always visible) ── */}
                    <div className="qr-card-item-row">
                      <div className="qr-card-item-info">
                        <div className="qr-card-item-name">
                          {line.item_name}
                          {line.is_new_item && (
                            <span className="qr-card-new-badge">NEW</span>
                          )}
                        </div>
                        <div className="qr-card-item-sub">
                          {line.category}
                          {!line.is_new_item && ` · Stock: ${line.current_qty}`}
                        </div>
                      </div>
                      <button
                        onClick={() => removeLine(line._key)}
                        className="inv-btn-icon qr-card-delete"
                      >
                        ✕
                      </button>
                    </div>

                    {/* ── Supplier (full-width on mobile, cell on desktop) ── */}
                    <div className="qr-card-supplier-row">
                      <label className="qr-card-label">Supplier</label>
                      <select
                        className="inv-input qr-card-select"
                        value={line.supplier_id}
                        onChange={(e) =>
                          updateLine(line._key, "supplier_id", e.target.value)
                        }
                      >
                        <option value="">— Select Supplier —</option>
                        {supList.map((s) => (
                          <option key={s.supplier_id} value={s.supplier_id}>
                            {s.supplier_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* ── Qty / Cost / DOT / Subtotal ── */}
                    <div className="qr-card-inputs-row">
                      <div className="qr-card-field">
                        <label className="qr-card-label">Qty</label>
                        <input
                          className="inv-input"
                          type="number"
                          min="1"
                          step="1"
                          style={{ textAlign: "center", fontWeight: 700 }}
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(line._key, "quantity", e.target.value)
                          }
                        />
                      </div>
                      <div className="qr-card-field">
                        <label className="qr-card-label">Cost</label>
                        <div style={{ position: "relative" }}>
                          <span className="qr-cost-prefix">₱</span>
                          <input
                            className="inv-input"
                            type="number"
                            min="0"
                            step="0.01"
                            style={{
                              paddingLeft: "1.25rem",
                              fontWeight: 700,
                              color: "var(--th-amber)",
                            }}
                            value={line.unit_cost}
                            onChange={(e) =>
                              updateLine(line._key, "unit_cost", e.target.value)
                            }
                          />
                        </div>
                      </div>
                      <div className="qr-card-field">
                        <label className="qr-card-label">DOT #</label>
                        {isTire ? (
                          <input
                            className="inv-input"
                            placeholder="e.g. 3524"
                            style={{
                              textAlign: "center",
                              borderColor: !line.dot_number?.trim()
                                ? "var(--th-rose)"
                                : undefined,
                              background: !line.dot_number?.trim()
                                ? "var(--th-rose-bg)"
                                : undefined,
                            }}
                            value={line.dot_number}
                            onChange={(e) =>
                              updateLine(
                                line._key,
                                "dot_number",
                                e.target.value,
                              )
                            }
                          />
                        ) : (
                          <div className="qr-card-na">N/A</div>
                        )}
                      </div>
                      <div className="qr-card-field qr-card-field-subtotal">
                        <label className="qr-card-label">Subtotal</label>
                        <div className="qr-card-subtotal-val">
                          {ordCurrency(lineTotal)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Grand Total */}
              <div className="qr-lines-total">
                <span className="qr-lines-total-label">Grand Total</span>
                <span className="qr-lines-total-amount">
                  {ordCurrency(totalAmount)}
                </span>
              </div>
            </div>
          )}

          {/* Error */}
          {err && (
            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--th-rose)",
                background: "var(--th-rose-bg)",
                border: "1px solid var(--th-rose)",
                borderRadius: 7,
                padding: "0.45rem 0.7rem",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
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
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="inv-modal-footer"
          style={{ justifyContent: "flex-end", gap: "0.75rem" }}
        >
          <button
            className="inv-btn inv-btn-slate"
            style={{ flex: "0 0 auto", minWidth: 120, height: "42px" }}
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            className="inv-btn"
            style={{
              flex: "0 0 auto",
              minWidth: 200,
              height: "42px",
              background:
                lines.length > 0
                  ? "var(--th-emerald)"
                  : "var(--th-bg-card-alt)",
              color: lines.length > 0 ? "#061018" : "var(--th-text-faint)",
              fontWeight: 900,
              boxShadow:
                lines.length > 0 ? "0 4px 12px var(--th-emerald-glow)" : "none",
            }}
            disabled={submitting || lines.length === 0}
            onClick={handleSubmit}
          >
            {submitting ? (
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <div
                  className="th-spinner th-spinner-sm"
                  style={{ borderTopColor: "#061018" }}
                ></div>
                Processing…
              </div>
            ) : (
              `⚡ Confirm & Quick Receive`
            )}
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
  // Edit mode state for detail modal
  const [editMode, setEditMode] = React.useState(false);
  const [editNotes, setEditNotes] = React.useState("");
  const [editDR, setEditDR] = React.useState("");
  const [editItems, setEditItems] = React.useState([]); // [{order_item_id, quantity, unit_cost, dot_number, ...rest}]
  const [editSaving, setEditSaving] = React.useState(false);
  const [editAddSearch, setEditAddSearch] = React.useState("");
  const [editAddResults, setEditAddResults] = React.useState([]);
  const [editAddPending, setEditAddPending] = React.useState([]); // new items to add
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [supplierFilter, setSupplierFilter] = React.useState("");
  const [searchSuggestions, setSearchSuggestions] = React.useState([]);
  const ORDERS_PAGE_SIZE = 10;

  // Stable KPI counts — fetched independently, never affected by the status filter
  const [ordersKpi, setOrdersKpi] = React.useState({
    total: 0, pending: 0, confirmed: 0, received: 0, cancelled: 0,
    totalValue: 0, pendingValue: 0, receivedValue: 0,
  });
  const fetchOrdersKpi = React.useCallback(async () => {
    if (!shopId) return;
    try {
      const r = await apiFetch(`${API_URL}/orders-kpi/${shopId}`);
      const d = await r.json();
      if (!d.error) setOrdersKpi(d);
    } catch { /* non-fatal */ }
  }, [shopId]);
  React.useEffect(() => { fetchOrdersKpi(); }, [fetchOrdersKpi]);

  const {
    data: orders,
    page: ordersPage,
    setPage: setOrdersPage,
    totalPages: ordersTotalPages,
    total: ordersTotalCount,
    search: searchQuery,
    setSearch: setSearchQuery,
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
  const [receiveCheckInfo, setReceiveCheckInfo] = React.useState({
    check_number: "",
    bank: "",
    check_date: "",
  });

  // Confirmation modal state
  const [pending, setPending] = React.useState(null); // { title, rows, okLabel, danger, action }

  // Quick Receive state
  const [showQuickReceive, setShowQuickReceive] = React.useState(false);

  // Create Order modal state
  const [showCreateOrderModal, setShowCreateOrderModal] = React.useState(false);
  const [items, setItems] = React.useState([]);
  const [suppliers, setSuppliers] = React.useState([]);
  const [createOrderItems, setCreateOrderItems] = React.useState([]);
  const [createOrderNotes, setCreateOrderNotes] = React.useState("");
  const [createOrderSearch, setCreateOrderSearch] = React.useState("");
  const [createOrderPage, setCreateOrderPage] = React.useState(1);
  const [isDraftLoaded, setIsDraftLoaded] = React.useState(false);
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

  // --- Create Order Persistence ---
  React.useEffect(() => {
    if (!shopId) return;
    try {
      const items = localStorage.getItem(`th-ord-create-items-${shopId}`);
      if (items) setCreateOrderItems(JSON.parse(items));
      const notes = localStorage.getItem(`th-ord-create-notes-${shopId}`);
      if (notes) setCreateOrderNotes(notes);
    } catch (e) { console.error("Failed to load Order draft", e); }
    setIsDraftLoaded(true);
  }, [shopId]);

  React.useEffect(() => {
    if (!shopId || !isDraftLoaded) return;
    localStorage.setItem(`th-ord-create-items-${shopId}`, JSON.stringify(createOrderItems));
    localStorage.setItem(`th-ord-create-notes-${shopId}`, createOrderNotes);
  }, [createOrderItems, createOrderNotes, shopId, isDraftLoaded]);

  React.useEffect(() => {
    fetchItems();
    fetchSuppliers();
  }, [shopId]);

  async function fetchItems() {
    try {
      const r = await apiFetch(`${API_URL}/items/${shopId}`);
      setItems((await r.json()) || []);
    } catch (err) {
      console.error("fetchItems failed:", err);
    }
  }

  async function fetchSuppliers() {
    try {
      const qs = shopId ? `?shop_id=${encodeURIComponent(shopId)}` : "";
      const r = await apiFetch(`${API_URL}/suppliers${qs}`);
      setSuppliers((await r.json()) || []);
    } catch (err) {
      console.error("fetchSuppliers failed:", err);
    }
  }

  function addItemToCreateOrder(item) {
    const existing = createOrderItems.find((o) => o.item_id === item.item_id);
    if (existing) {
      setCreateOrderItems(
        createOrderItems.map((o) =>
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
      const brandLower = (item.brand || "").trim().toUpperCase();
      const brandSuppliers = suppliers.filter((s) =>
        (s.supplier_brands || []).some(
          (b) => b.brand_name.trim().toUpperCase() === brandLower,
        ),
      );
      const autoSupplier =
        brandSuppliers.length === 1 ? brandSuppliers[0] : null;
      setCreateOrderItems([
        ...createOrderItems,
        {
          ...item,
          order_item_id: `TEMP-${Date.now()}`,
          quantity: item.quantity || 1,
          unit_cost: item.unit_cost,
          line_total: (item.quantity || 1) * item.unit_cost,
          supplier_id: autoSupplier ? autoSupplier.supplier_id : null,
          supplier_name: autoSupplier ? autoSupplier.supplier_name : null,
        },
      ]);
    }
  }

  function removeFromCreateOrder(id) {
    setCreateOrderItems(createOrderItems.filter((o) => o.order_item_id !== id));
  }

  function updateCreateOrderSupplier(id, supplier_id) {
    setCreateOrderItems(
      createOrderItems.map((o) =>
        o.order_item_id === id ? { ...o, supplier_id } : o,
      ),
    );
  }

  function updateCreateOrderQuantity(id, qty) {
    if (qty <= 0) {
      removeFromCreateOrder(id);
      return;
    }
    setCreateOrderItems(
      createOrderItems.map((o) =>
        o.order_item_id === id
          ? { ...o, quantity: qty, line_total: qty * o.unit_cost }
          : o,
      ),
    );
  }

  async function submitCreateOrder() {
    if (createOrderItems.length === 0) {
      setError("Add items to the order first");
      return;
    }
    const missingSupplier = createOrderItems.filter((o) => !o.supplier_id);
    if (missingSupplier.length > 0) {
      setError(
        `Select a supplier for: ${missingSupplier.map((o) => o.item_name).join(", ")}`,
      );
      return;
    }
    // Group items by supplier → one order per supplier
    const groups = {};
    for (const o of createOrderItems) {
      const sid = o.supplier_id;
      if (!groups[sid]) groups[sid] = [];
      groups[sid].push(o);
    }
    const supplierNames = Object.keys(groups).map((sid) => {
      const s = suppliers.find((x) => x.supplier_id === sid);
      return s ? s.supplier_name : sid;
    });
    const total = createOrderItems.reduce((s, o) => s + (o.line_total || 0), 0);
    setPending({
      title: "Create Purchase Order?",
      rows: [
        {
          label: "Items",
          value: `${createOrderItems.length} line${createOrderItems.length !== 1 ? "s" : ""}`,
        },
        { label: "Supplier(s)", value: supplierNames.join(", ") },
        { label: "Total Amount", value: ordCurrency(total) },
        ...(Object.keys(groups).length > 1
          ? [
              {
                label: "Orders",
                value: `Will split into ${Object.keys(groups).length} orders`,
              },
            ]
          : []),
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
      const results = await Promise.all(
        supplierIds.map((sid) => {
          const groupItems = groups[sid];
          const supplierName =
            (suppliers.find((s) => s.supplier_id === sid) || {})
              .supplier_name || sid;
          return apiFetch(`${API_URL}/orders`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              shop_id: shopId,
              items: groupItems
                .filter((o) => !o.is_new_item)
                .map((o) => ({
                  item_id: o.item_id,
                  quantity: o.quantity,
                  unit_cost: o.unit_cost,
                  supplier_id: sid,
                })),
              new_items: groupItems
                .filter((o) => o.is_new_item)
                .map((o) => ({
                  brand: o.brand,
                  design: o.design,
                  size: o.size,
                  category: o.category,
                  unit_cost: o.unit_cost,
                  selling_price: o.selling_price,
                  quantity: o.quantity,
                  reorder_point: o.reorder_point || 0,
                  supplier_id: sid,
                })),
              order_notes: `${createOrderNotes || "Order"} — ${supplierName}`,
            }),
          })
            .then((r) => r.json())
            .then((res) => {
              if (res.error) throw new Error(res.error);
              return res;
            });
        }),
      );
      localStorage.removeItem(`th-ord-create-items-${shopId}`);
      localStorage.removeItem(`th-ord-create-notes-${shopId}`);
      setCreateOrderItems([]);
      setCreateOrderNotes("");
      setShowCreateOrderModal(false);
      setError("");
      setToast({
        title:
          results.length > 1
            ? `${results.length} Orders Created`
            : "Order Created",
        sub:
          results.length > 1
            ? `Split across ${results.length} suppliers`
            : `Total: ${ordCurrency(results[0].total_amount)}`,
      });
      fetchOrders();
      fetchOrdersKpi();
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
    const order = orders.find((o) => o.order_id === orderId) || orderDetails;
    const itemCount = (order?.items || orderDetails?.items)?.length ?? 0;
    const amount =
      order?.total_amount ??
      orderDetails?.items?.reduce((s, i) => s + (i.line_total || 0), 0) ??
      0;
    setPending({
      title: `${newStatus === "CONFIRMED" ? "Confirm" : "Update"} Order?`,
      rows: [
        { label: "Order", value: orderId },
        { label: "New Status", value: newStatus },
        {
          label: "Items",
          value: `${itemCount} item${itemCount !== 1 ? "s" : ""}`,
        },
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
      fetchOrdersKpi();
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
    const order = orders.find((o) => o.order_id === orderId);
    const itemCount = order?.items?.length ?? 0;
    setPending({
      title: "Cancel Order?",
      rows: [
        { label: "Order", value: orderId },
        { label: "Status", value: order?.status || "—" },
        {
          label: "Items",
          value: `${itemCount} item${itemCount !== 1 ? "s" : ""}`,
        },
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
      fetchOrdersKpi();
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
      if (!receiveCheckInfo.check_date) {
        setError("Check date is required");
        return;
      }
    }
    const notRecvd = orderDetails.items.filter(
      (item) =>
        !receivedItems.some((ri) => ri.order_item_id === item.order_item_id),
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
      if (!qty || qty <= 0) {
        setError(`Invalid quantity for ${ri.item_name}`);
        return;
      }
      // DOT required for tire items
      const isTire =
        (ri.category || "").toUpperCase() === "TIRE" ||
        (ri.category || "").toUpperCase().includes("TIRE") ||
        /\d+\/\d+[Rr]\d+/.test(ri.size || "") ||
        (ri.item_name || "").toLowerCase().includes("tire");
      const dot = (ov.dot_number ?? ri.dot_number ?? "").toString().trim();
      if (isTire && !dot) {
        setError(`DOT number is required for tire: ${ri.item_name}`);
        return;
      }
    }
    const paymentLabel =
      receivePaymentMode === "CASH"
        ? "Cash"
        : receivePaymentMode === "CHECK"
          ? "Check Release"
          : "Supplier Terms";
    const totalReceived = receivedItems.reduce((s, ri) => {
      const ov = receiveOverrides[ri.order_item_id] || {};
      const qty = parseFloat(ov.quantity ?? ri.quantity);
      const cost = parseFloat(ov.unit_cost ?? ri.unit_cost);
      return s + qty * cost;
    }, 0);
    setPending({
      title: "Complete Receive Order?",
      rows: [
        { label: "Order", value: selectedOrderForReceive },
        {
          label: "Items Received",
          value: `${receivedItems.length} of ${orderDetails.items?.length}`,
        },
        {
          label: "Items List",
          value: receivedItems
            .map((ri) => {
              const ov = receiveOverrides[ri.order_item_id] || {};
              const dot = (ov.dot_number ?? ri.dot_number ?? "")
                .toString()
                .trim();
              return dot ? `${ri.item_name} [DOT ${dot}]` : ri.item_name;
            })
            .join(", "),
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

  // ── Edit mode helpers ────────────────────────────────────────────────────
  function openEditMode() {
    if (!orderDetails) return;
    setEditNotes(orderDetails.order_notes || "");
    setEditDR(orderDetails.delivery_receipt || "");
    setEditItems((orderDetails.items || []).map(i => ({
      order_item_id: i.order_item_id,
      quantity: i.quantity,
      unit_cost: i.unit_cost,
      dot_number: i.dot_number || "",
      item_name: i.item_name || i.displaySize || "",
      brand: i.brand, design: i.design, size: i.size,
      received_status: i.received_status,
    })));
    setEditAddPending([]);
    setEditAddSearch("");
    setEditAddResults([]);
    setEditMode(true);
  }

  function cancelEditMode() {
    setEditMode(false);
    setEditAddPending([]);
    setEditAddSearch("");
    setEditAddResults([]);
  }

  async function saveEditMode() {
    if (!orderDetails) return;
    setEditSaving(true);
    try {
      // 1. Save header (notes + DR)
      await apiFetch(`${API_URL}/orders/${orderDetails.order_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_notes: editNotes, delivery_receipt: editDR }),
      });
      // 2. Save each item
      for (const ei of editItems) {
        const orig = (orderDetails.items || []).find(i => i.order_item_id === ei.order_item_id);
        const changed = !orig ||
          String(ei.quantity) !== String(orig.quantity) ||
          String(ei.unit_cost) !== String(orig.unit_cost) ||
          (ei.dot_number || "") !== (orig.dot_number || "");
        if (changed) {
          await apiFetch(`${API_URL}/orders/${orderDetails.order_id}/items/${ei.order_item_id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quantity: ei.quantity, unit_cost: ei.unit_cost, dot_number: ei.dot_number }),
          });
        }
      }
      // 3. Add new items
      if (editAddPending.length > 0) {
        await apiFetch(`${API_URL}/orders/${orderDetails.order_id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: editAddPending }),
        });
      }
      // Refresh
      const r2 = await apiFetch(`${API_URL}/orders/${orderDetails.order_id}/details`);
      const fresh = await r2.json();
      setOrderDetails(fresh);
      setEditMode(false);
      setEditAddPending([]);
      fetchOrders();
      fetchOrdersKpi();
      setToast({ msg: "Order saved.", type: "success" });
    } catch (e) {
      setToast({ msg: e.message || "Save failed", type: "error" });
    } finally {
      setEditSaving(false);
    }
  }

  async function editAddItemSearch(q) {
    setEditAddSearch(q);
    if (!q || q.length < 2) { setEditAddResults([]); return; }
    try {
      const r = await apiFetch(`${API_URL}/items/${shopId}?q=${encodeURIComponent(q)}&perPage=20`);
      const d = await r.json();
      setEditAddResults(Array.isArray(d) ? d : (d.data || []));
    } catch { setEditAddResults([]); }
  }

  function editAddItemSelect(item) {
    setEditAddPending(prev => [...prev, {
      item_id: item.item_id,
      supplier_id: item.supplier_id || null,
      quantity: 1,
      unit_cost: item.unit_cost || 0,
      dot_number: "",
      item_name: [item.brand, item.design, item.size].filter(Boolean).join(" ") || item.item_name || item.item_id,
      is_new_item: 0,
    }]);
    setEditAddSearch("");
    setEditAddResults([]);
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
            check_info:
              receivePaymentMode === "CHECK" ? receiveCheckInfo : null,
            received_items: receivedItems.map((ri) => {
              const ov = receiveOverrides[ri.order_item_id] || {};
              return {
                order_item_id: ri.order_item_id,
                quantity: parseFloat(ov.quantity ?? ri.quantity),
                unit_cost: parseFloat(ov.unit_cost ?? ri.unit_cost),
                dot_number:
                  (ov.dot_number ?? ri.dot_number ?? "").toString().trim() ||
                  null,
              };
            }),
            not_received_items: (orderDetails.items || [])
              .filter(
                (item) =>
                  !receivedItems.some(
                    (ri) => ri.order_item_id === item.order_item_id,
                  ),
              )
              .map((item) => ({
                order_item_id: item.order_item_id,
                reason:
                  notReceivedReasons[item.order_item_id] || "Not provided",
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
      cancelEditMode();
      setOrderDetails(null);
      setToast({
        title: "Order Received",
        sub: `${receivedItems.length} item${receivedItems.length !== 1 ? "s" : ""} added to inventory`,
      });
      fetchOrders();
      fetchOrdersKpi();
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  /* Derived data */
  // statusCounts always reflects ALL orders — not affected by the active status tab
  const statusCounts = {
    ALL:       ordersKpi.total,
    PENDING:   ordersKpi.pending,
    CONFIRMED: ordersKpi.confirmed,
    RECEIVED:  ordersKpi.received,
    CANCELLED: ordersKpi.cancelled,
  };

  // Unique suppliers derived from all loaded orders
  const uniqueSuppliers = React.useMemo(() => {
    const map = new Map();
    for (const o of orders) {
      for (const item of o.items || []) {
        if (
          item.supplier_id &&
          item.supplier_name &&
          !map.has(item.supplier_id)
        ) {
          map.set(item.supplier_id, item.supplier_name);
        }
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
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
      if (
        o.delivery_receipt &&
        o.delivery_receipt.toLowerCase().includes(q) &&
        !seen.has(o.delivery_receipt)
      ) {
        seen.add(o.delivery_receipt);
        sugs.push({ text: o.delivery_receipt, type: "DR #" });
        if (sugs.length >= 8) break;
      }
    }
    for (const o of filteredOrders) {
      for (const item of o.items || []) {
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
        .ord-actions-desktop { display: flex; gap: 0.6rem; align-items: center; }
        .ord-actions-mobile  { display: none; }
        @media (max-width: 640px) {
          .ord-header { text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; }
          .ord-header .ord-title { display: flex; flex-direction: row; align-items: center; justify-content: center; width: 100%; }
          .ord-actions-desktop { display: none !important; }
          .ord-actions-mobile  { display: flex !important; flex-direction: row; align-items: center; justify-content: space-between; gap: 0.5rem; width: 100%; margin-top: 0; }
          .ord-actions-mobile button { flex: 1; padding-left: 0; padding-right: 0; justify-content: center; }
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
      {showCreateOrderModal &&
        (() => {
          const filteredItems = items.filter(
            (i) =>
              !createOrderSearch.trim() ||
              [i.item_name, i.sku, i.brand, i.design, i.size].some(
                (f) =>
                  f &&
                  f.toLowerCase().includes(createOrderSearch.toLowerCase()),
              ),
          );
          const totalPages = Math.max(
            1,
            Math.ceil(filteredItems.length / CREATE_ORDER_PER_PAGE),
          );
          const safePage = Math.min(createOrderPage, totalPages);
          const pageItems = filteredItems.slice(
            (safePage - 1) * CREATE_ORDER_PER_PAGE,
            safePage * CREATE_ORDER_PER_PAGE,
          );
          const total = createOrderItems.reduce(
            (s, o) => s + (o.line_total || 0),
            0,
          );
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
              onClose={() => {
                setShowCreateOrderModal(false);
                setError("");
              }}
              onAddItem={addItemToCreateOrder}
              onUpdateQty={updateCreateOrderQuantity}
              onUpdateSupplier={updateCreateOrderSupplier}
              onRemoveItem={removeFromCreateOrder}
              onSearchChange={(v) => {
                setCreateOrderSearch(v);
                setCreateOrderPage(1);
              }}
              onPageChange={setCreateOrderPage}
              onNotesChange={setCreateOrderNotes}
              onSubmit={submitCreateOrder}
              ORDER_MODAL_ITEMS_PER_PAGE={CREATE_ORDER_PER_PAGE}
            />
          );
        })()}

      {/* ⚡ Quick Receive Modal */}
      {showQuickReceive && (
        <QuickReceiveModal
          shopId={shopId}
          suppliers={suppliers}
          items={items}
          onClose={() => setShowQuickReceive(false)}
          onSuccess={(result) => {
            setShowQuickReceive(false);
            setToast({
              title: "⚡ Quick Receive Complete",
              sub: `${result.items_received} item(s) added to inventory`,
            });
            fetchOrders();
            fetchOrdersKpi();
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {/* ── Main layout ── */}
      <div className="ord-root">
        <div className="ord-main">
          {/* Header */}
          <div className="ord-header">
            <div className="ord-title">
              Purchase <span>Orders</span>
            </div>
            <div className="ord-actions-desktop">
              <button
                className="inv-btn inv-btn-orange"
                onClick={() => {
                  setShowCreateOrderModal(true);
                  setError("");
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
                Create Order
              </button>
              <button
                className="inv-btn"
                style={{
                  background: "var(--th-emerald-bg,rgba(52,211,153,0.12))",
                  color: "var(--th-emerald,#34d399)",
                  border: "1px solid var(--th-emerald,#34d399)",
                }}
                onClick={() => {
                  setShowQuickReceive(true);
                  setError("");
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                Quick Receive
              </button>
            </div>
          </div>

          {/* KPIs */}
          {(() => {
            return (
              <div className="th-kpi-row">
                <div className="th-kpi sky">
                  <div className="th-kpi-label kpi-lbl">Total Orders</div>
                  <div className="th-kpi-value kpi-val">{ordersKpi.total}</div>
                  <div className="th-kpi-sub kpi-sub">
                    {ordCompact(ordersKpi.totalValue)} total value
                  </div>
                </div>
                <div className="th-kpi amber">
                  <div className="th-kpi-label kpi-lbl">Pending</div>
                  <div className="th-kpi-value kpi-val">
                    {ordersKpi.pending}
                  </div>
                  <div className="th-kpi-sub kpi-sub">
                    {ordCompact(ordersKpi.pendingValue)} awaiting
                  </div>
                </div>
                <div className="th-kpi violet">
                  <div className="th-kpi-label kpi-lbl">Confirmed</div>
                  <div className="th-kpi-value kpi-val">
                    {ordersKpi.confirmed}
                  </div>
                  <div className="th-kpi-sub kpi-sub">ready for delivery</div>
                </div>
                <div className="th-kpi emerald">
                  <div className="th-kpi-label kpi-lbl">Received</div>
                  <div className="th-kpi-value kpi-val">
                    {ordersKpi.received}
                  </div>
                  <div className="th-kpi-sub kpi-sub">
                    {ordCompact(ordersKpi.receivedValue)} completed
                  </div>
                </div>
                <div className="th-kpi rose">
                  <div className="th-kpi-label kpi-lbl">Cancelled</div>
                  <div className="th-kpi-value kpi-val">
                    {ordersKpi.cancelled}
                  </div>
                  <div className="th-kpi-sub kpi-sub">voided orders</div>
                </div>
              </div>
            );
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
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            {/* Search */}
            <div
              style={{
                background: "var(--th-bg-card)",
                border: "1px solid var(--th-border)",
                borderRadius: "10px",
                padding: "0.5rem",
              }}
            >
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by order ID, DR#, or notes…"
                suggestions={searchSuggestions}
                resultCount={
                  searchQuery || supplierFilter
                    ? displayOrders.length
                    : undefined
                }
                totalCount={
                  searchQuery || supplierFilter
                    ? filteredOrders.length
                    : undefined
                }
                resultLabel="orders"
                style={{ marginBottom: 0 }}
              />
            </div>

            {/* Mobile-only action buttons */}
            <div className="ord-actions-mobile">
              <button
                className="inv-btn inv-btn-orange"
                onClick={() => {
                  setShowCreateOrderModal(true);
                  setError("");
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
                Create Order
              </button>
              <button
                className="inv-btn"
                style={{
                  background: "var(--th-emerald-bg,rgba(52,211,153,0.12))",
                  color: "var(--th-emerald,#34d399)",
                  border: "1px solid var(--th-emerald,#34d399)",
                }}
                onClick={() => {
                  setShowQuickReceive(true);
                  setError("");
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                Quick Receive
              </button>
            </div>

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
              <div
                style={{
                  background: "var(--th-bg-card)",
                  border: "1px solid var(--th-border)",
                  borderRadius: "10px",
                  padding: "0.5rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontFamily: "'Barlow Condensed',sans-serif",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "var(--th-text-dim)",
                      flexShrink: 0,
                    }}
                  >
                    Supplier:
                  </span>
                  <button
                    onClick={() => setSupplierFilter("")}
                    style={{
                      fontFamily: "'Barlow Condensed',sans-serif",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      padding: "0.25rem 0.75rem",
                      borderRadius: 20,
                      border: "1px solid",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      background: !supplierFilter
                        ? "var(--th-orange)"
                        : "transparent",
                      color: !supplierFilter ? "#fff" : "var(--th-text-dim)",
                      borderColor: !supplierFilter
                        ? "var(--th-orange)"
                        : "var(--th-border-strong)",
                    }}
                  >
                    All
                  </button>
                  {uniqueSuppliers.map((s) => (
                    <button
                      key={s.id}
                      onClick={() =>
                        setSupplierFilter(supplierFilter === s.id ? "" : s.id)
                      }
                      style={{
                        fontFamily: "'Barlow Condensed',sans-serif",
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        padding: "0.25rem 0.75rem",
                        borderRadius: 20,
                        border: "1px solid",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        background:
                          supplierFilter === s.id
                            ? "var(--th-sky)"
                            : "transparent",
                        color:
                          supplierFilter === s.id
                            ? "#1a2132"
                            : "var(--th-text-dim)",
                        borderColor:
                          supplierFilter === s.id
                            ? "var(--th-sky)"
                            : "var(--th-border-strong)",
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
                          <svg
                            className="ord-table-empty-icon"
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          >
                            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            <path d="M12 12v4M10 12h4" />
                          </svg>
                          <div className="ord-table-empty-title">
                            {searchQuery || supplierFilter
                              ? "No Orders Match"
                              : "No Orders Found"}
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
                            <div
                              className="ord-order-notes"
                              style={{ color: "var(--th-sky)" }}
                            >
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
            <Pagination
              currentPage={ordersPage}
              totalPages={ordersTotalPages}
              onPageChange={setOrdersPage}
            />
          </div>
        </div>
      </div>

      {/* ── Details modal ── */}
      {orderDetails && !showReceiveModal && !showCancelModal && (
        <div
          className="ord-details-overlay"
          onClick={(e) => e.target === e.currentTarget && (cancelEditMode(), setOrderDetails(null))}
        >
          <div className="ord-details">
            <div className="ord-details-header">
              <div className="ord-details-header-row">
                <div className="ord-details-title">Order Details</div>
                <div className="ord-details-id">{orderDetails.order_id}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {!editMode && (
                  <button
                    className="ord-btn ord-btn-sky"
                    style={{ padding: "0.28rem 0.8rem", fontSize: "0.82rem" }}
                    onClick={openEditMode}
                  >
                    ✎ Edit
                  </button>
                )}
                <button
                  className="ord-details-close"
                  onClick={() => { cancelEditMode(); setOrderDetails(null); }}
                >
                  ✕
                </button>
              </div>
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
                          orderDetails.status === "RECEIVED" &&
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
                  <div
                    className="ord-meta-card"
                    style={{ gridColumn: "span 2" }}
                  >
                    <div className="ord-meta-label">Delivery Receipt (DR#)</div>
                    <div
                      className="ord-meta-val"
                      style={{
                        fontSize: "0.95rem",
                        color: "var(--th-sky)",
                        fontFamily: "'Barlow Condensed',sans-serif",
                        fontWeight: 700,
                      }}
                    >
                      {orderDetails.delivery_receipt}
                    </div>
                  </div>
                )}
                {orderDetails.payment_mode && (
                  <div
                    className="ord-meta-card"
                    style={{ gridColumn: "span 2" }}
                  >
                    <div className="ord-meta-label">Payment Mode</div>
                    <div style={{ marginTop: "0.25rem" }}>
                      {orderDetails.payment_mode === "CASH" && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            padding: "0.25rem 0.75rem",
                            borderRadius: 20,
                            background: "var(--th-emerald-bg)",
                            color: "var(--th-emerald)",
                            fontFamily: "'Barlow Condensed',sans-serif",
                            fontWeight: 700,
                            fontSize: "0.88rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          💵 Cash
                        </span>
                      )}
                      {orderDetails.payment_mode === "CHECK" && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            padding: "0.25rem 0.75rem",
                            borderRadius: 20,
                            background: "var(--th-violet-bg)",
                            color: "var(--th-violet)",
                            fontFamily: "'Barlow Condensed',sans-serif",
                            fontWeight: 700,
                            fontSize: "0.88rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          🖊 Check Release
                        </span>
                      )}
                      {orderDetails.payment_mode === "TERMS" && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            padding: "0.25rem 0.75rem",
                            borderRadius: 20,
                            background: "var(--th-sky-bg)",
                            color: "var(--th-sky)",
                            fontFamily: "'Barlow Condensed',sans-serif",
                            fontWeight: 700,
                            fontSize: "0.88rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          📅 Supplier Terms
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              {editMode ? (
                <div className="ord-notes-block">
                  <div className="ord-notes-label">DR # &amp; Notes</div>
                  <input
                    type="text"
                    placeholder="Delivery Receipt #"
                    value={editDR}
                    onChange={e => setEditDR(e.target.value)}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "var(--th-surface)", color: "var(--th-text)",
                      border: "1px solid var(--th-border)", borderRadius: 6,
                      padding: "0.4rem 0.6rem", fontSize: "0.88rem", marginBottom: "0.5rem",
                    }}
                  />
                  <textarea
                    rows={3}
                    placeholder="Order notes..."
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    style={{
                      width: "100%", boxSizing: "border-box", resize: "vertical",
                      background: "var(--th-surface)", color: "var(--th-text)",
                      border: "1px solid var(--th-border)", borderRadius: 6,
                      padding: "0.4rem 0.6rem", fontSize: "0.88rem",
                    }}
                  />
                </div>
              ) : orderDetails.order_notes ? (
                <div className="ord-notes-block">
                  <div className="ord-notes-label">Notes</div>
                  <div className="ord-notes-text">
                    {orderDetails.order_notes}
                  </div>
                </div>
              ) : null}

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
              {editMode ? (
                <>
                  {editItems.map((ei, idx) => (
                    <div key={ei.order_item_id} style={{
                      background: "var(--th-surface)",
                      border: "1px solid var(--th-border)",
                      borderRadius: 8, padding: "0.6rem 0.75rem",
                      marginBottom: "0.5rem",
                    }}>
                      <div style={{ fontSize: "0.82rem", color: "var(--th-text-muted)", marginBottom: "0.4rem", fontWeight: 600 }}>
                        {ei.item_name || [ei.brand, ei.design, ei.size].filter(Boolean).join(" ") || ei.order_item_id}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem" }}>
                        <label style={{ fontSize: "0.75rem", color: "var(--th-text-muted)" }}>
                          Qty
                          <input type="number" min="0.01" step="any" value={ei.quantity}
                            onChange={e => setEditItems(prev => prev.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))}
                            style={{ display: "block", width: "100%", boxSizing: "border-box",
                              background: "var(--th-bg)", color: "var(--th-text)",
                              border: "1px solid var(--th-border)", borderRadius: 5,
                              padding: "0.3rem 0.4rem", fontSize: "0.85rem", marginTop: "0.2rem" }} />
                        </label>
                        <label style={{ fontSize: "0.75rem", color: "var(--th-text-muted)" }}>
                          Unit Cost
                          <input type="number" min="0" step="any" value={ei.unit_cost}
                            onChange={e => setEditItems(prev => prev.map((x, i) => i === idx ? { ...x, unit_cost: e.target.value } : x))}
                            style={{ display: "block", width: "100%", boxSizing: "border-box",
                              background: "var(--th-bg)", color: "var(--th-text)",
                              border: "1px solid var(--th-border)", borderRadius: 5,
                              padding: "0.3rem 0.4rem", fontSize: "0.85rem", marginTop: "0.2rem" }} />
                        </label>
                        <label style={{ fontSize: "0.75rem", color: "var(--th-text-muted)" }}>
                          DOT #
                          <input type="text" value={ei.dot_number}
                            onChange={e => setEditItems(prev => prev.map((x, i) => i === idx ? { ...x, dot_number: e.target.value } : x))}
                            placeholder="e.g. 2524"
                            style={{ display: "block", width: "100%", boxSizing: "border-box",
                              background: "var(--th-bg)", color: "var(--th-text)",
                              border: "1px solid var(--th-border)", borderRadius: 5,
                              padding: "0.3rem 0.4rem", fontSize: "0.85rem", marginTop: "0.2rem" }} />
                        </label>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--th-amber)", marginTop: "0.3rem", textAlign: "right" }}>
                        Subtotal: {ordCurrency((parseFloat(ei.quantity) || 0) * (parseFloat(ei.unit_cost) || 0))}
                      </div>
                    </div>
                  ))}

                  {/* Add new items (PENDING/CONFIRMED only) */}
                  {["PENDING", "CONFIRMED"].includes(orderDetails.status) && (
                    <div style={{ marginTop: "0.75rem" }}>
                      <div className="ord-section-title" style={{ marginBottom: "0.4rem" }}>+ Add Items</div>
                      <div style={{ position: "relative" }}>
                        <input
                          type="text"
                          placeholder="Search item to add..."
                          value={editAddSearch}
                          onChange={e => editAddItemSearch(e.target.value)}
                          style={{
                            width: "100%", boxSizing: "border-box",
                            background: "var(--th-surface)", color: "var(--th-text)",
                            border: "1px solid var(--th-border)", borderRadius: 6,
                            padding: "0.4rem 0.6rem", fontSize: "0.85rem",
                          }}
                        />
                        {editAddResults.length > 0 && (
                          <div style={{
                            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                            background: "var(--th-surface)", border: "1px solid var(--th-border)",
                            borderRadius: 6, maxHeight: 200, overflowY: "auto",
                          }}>
                            {editAddResults.map(it => (
                              <div key={it.item_id}
                                onClick={() => editAddItemSelect(it)}
                                style={{
                                  padding: "0.45rem 0.65rem", cursor: "pointer",
                                  fontSize: "0.83rem", borderBottom: "1px solid var(--th-border-soft)",
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = "var(--th-hover)"}
                                onMouseLeave={e => e.currentTarget.style.background = ""}
                              >
                                <span style={{ fontWeight: 600 }}>{[it.brand, it.design, it.size].filter(Boolean).join(" ") || it.item_name}</span>
                                {it.sku && <span style={{ color: "var(--th-text-muted)", marginLeft: "0.4rem", fontSize: "0.78rem" }}>{it.sku}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Staged new items */}
                      {editAddPending.map((ap, idx) => (
                        <div key={idx} style={{
                          background: "var(--th-emerald-bg, #d1fae5)", border: "1px solid var(--th-emerald)",
                          borderRadius: 8, padding: "0.5rem 0.75rem", marginTop: "0.4rem",
                        }}>
                          <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--th-emerald)", marginBottom: "0.3rem" }}>
                            + {ap.item_name}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "0.4rem", alignItems: "end" }}>
                            <label style={{ fontSize: "0.75rem", color: "var(--th-text-muted)" }}>
                              Qty
                              <input type="number" min="0.01" step="any" value={ap.quantity}
                                onChange={e => setEditAddPending(prev => prev.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))}
                                style={{ display: "block", width: "100%", boxSizing: "border-box",
                                  background: "var(--th-bg)", color: "var(--th-text)",
                                  border: "1px solid var(--th-border)", borderRadius: 5,
                                  padding: "0.3rem 0.4rem", fontSize: "0.85rem", marginTop: "0.2rem" }} />
                            </label>
                            <label style={{ fontSize: "0.75rem", color: "var(--th-text-muted)" }}>
                              Unit Cost
                              <input type="number" min="0" step="any" value={ap.unit_cost}
                                onChange={e => setEditAddPending(prev => prev.map((x, i) => i === idx ? { ...x, unit_cost: e.target.value } : x))}
                                style={{ display: "block", width: "100%", boxSizing: "border-box",
                                  background: "var(--th-bg)", color: "var(--th-text)",
                                  border: "1px solid var(--th-border)", borderRadius: 5,
                                  padding: "0.3rem 0.4rem", fontSize: "0.85rem", marginTop: "0.2rem" }} />
                            </label>
                            <label style={{ fontSize: "0.75rem", color: "var(--th-text-muted)" }}>
                              DOT #
                              <input type="text" value={ap.dot_number}
                                onChange={e => setEditAddPending(prev => prev.map((x, i) => i === idx ? { ...x, dot_number: e.target.value } : x))}
                                placeholder="e.g. 2524"
                                style={{ display: "block", width: "100%", boxSizing: "border-box",
                                  background: "var(--th-bg)", color: "var(--th-text)",
                                  border: "1px solid var(--th-border)", borderRadius: 5,
                                  padding: "0.3rem 0.4rem", fontSize: "0.85rem", marginTop: "0.2rem" }} />
                            </label>
                            <button
                              onClick={() => setEditAddPending(prev => prev.filter((_, i) => i !== idx))}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--th-rose)", fontSize: "1rem", paddingBottom: "0.1rem" }}
                            >✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                orderDetails.items?.map((item) => (
                  <DetailItem
                    key={item.order_item_id}
                    item={item}
                    orderStatus={orderDetails.status}
                  />
                ))
              )}
            </div>

            <div className="ord-details-footer">
              {editMode ? (
                <>
                  <button
                    className="ord-btn ord-btn-emerald"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={saveEditMode}
                    disabled={editSaving}
                  >
                    {editSaving ? "Saving…" : "✓ Save Changes"}
                  </button>
                  <button
                    className="ord-btn"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={cancelEditMode}
                    disabled={editSaving}
                  >
                    ✕ Cancel
                  </button>
                </>
              ) : (
                <>
              {orderDetails.status === "PENDING" && (
                <>
                  <button
                    className="ord-btn ord-btn-sky"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={() =>
                      stageUpdateOrderStatus(orderDetails.order_id, "CONFIRMED")
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
                </>
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
                  setReceiveCheckInfo({
                    check_number: "",
                    bank: "",
                    check_date: "",
                  });
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
                <label
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    color: "var(--th-text-dim)",
                    display: "block",
                    marginBottom: "0.3rem",
                  }}
                >
                  Delivery Receipt (DR) #{" "}
                  <span style={{ color: "var(--th-rose)" }}>*</span>
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
                <label
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    color: "var(--th-text-dim)",
                    display: "block",
                    marginBottom: "0.4rem",
                  }}
                >
                  Payment Mode{" "}
                  <span style={{ color: "var(--th-rose)" }}>*</span>
                </label>
                <div className="ord-paymode-btns">
                  {[
                    {
                      value: "CASH",
                      label: "💵 Cash",
                      color: "var(--th-emerald)",
                      bg: "var(--th-emerald-bg)",
                    },
                    {
                      value: "CHECK",
                      label: "🖊 Check Release",
                      color: "var(--th-violet)",
                      bg: "var(--th-violet-bg)",
                    },
                    {
                      value: "TERMS",
                      label: "📅 Supplier Terms",
                      color: "var(--th-sky)",
                      bg: "var(--th-sky-bg)",
                    },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      className="ord-paymode-btn"
                      onClick={() => setReceivePaymentMode(opt.value)}
                      style={{
                        border:
                          receivePaymentMode === opt.value
                            ? `1.5px solid ${opt.color}`
                            : "1px solid var(--th-border-strong)",
                        background:
                          receivePaymentMode === opt.value
                            ? opt.bg
                            : "var(--th-bg-input)",
                        color:
                          receivePaymentMode === opt.value
                            ? opt.color
                            : "var(--th-text-dim)",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {receivePaymentMode === "CASH" && (
                  <div
                    style={{
                      marginTop: "0.5rem",
                      padding: "0.5rem 0.75rem",
                      borderRadius: 6,
                      background: "var(--th-emerald-bg)",
                      fontSize: "0.82rem",
                      color: "var(--th-emerald)",
                    }}
                  >
                    Payable will be recorded as already <b>PAID</b> on receipt.
                  </div>
                )}
                {receivePaymentMode === "TERMS" && (
                  <div
                    style={{
                      marginTop: "0.5rem",
                      padding: "0.5rem 0.75rem",
                      borderRadius: 6,
                      background: "var(--th-sky-bg)",
                      fontSize: "0.82rem",
                      color: "var(--th-sky)",
                    }}
                  >
                    Payable will be created as <b>OPEN</b> with due date from
                    supplier payment terms.
                  </div>
                )}
                {receivePaymentMode === "CHECK" && (
                  <div
                    style={{
                      marginTop: "0.6rem",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "0.5rem",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: "var(--th-text-dim)",
                          display: "block",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Check #{" "}
                        <span style={{ color: "var(--th-rose)" }}>*</span>
                      </label>
                      <input
                        className="ord-input"
                        placeholder="e.g. 001234"
                        value={receiveCheckInfo.check_number}
                        onChange={(e) =>
                          setReceiveCheckInfo((p) => ({
                            ...p,
                            check_number: e.target.value,
                          }))
                        }
                        style={{ fontSize: "0.88rem" }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: "var(--th-text-dim)",
                          display: "block",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Bank <span style={{ color: "var(--th-rose)" }}>*</span>
                      </label>
                      <input
                        className="ord-input"
                        placeholder="e.g. BPI, BDO"
                        value={receiveCheckInfo.bank}
                        onChange={(e) =>
                          setReceiveCheckInfo((p) => ({
                            ...p,
                            bank: e.target.value,
                          }))
                        }
                        style={{ fontSize: "0.88rem" }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: "var(--th-text-dim)",
                          display: "block",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Check Date{" "}
                        <span style={{ color: "var(--th-rose)" }}>*</span>
                      </label>
                      <input
                        className="ord-input"
                        type="date"
                        value={receiveCheckInfo.check_date}
                        onChange={(e) =>
                          setReceiveCheckInfo((p) => ({
                            ...p,
                            check_date: e.target.value,
                          }))
                        }
                        style={{ fontSize: "0.88rem" }}
                      />
                    </div>
                    <div
                      style={{
                        gridColumn: "1 / -1",
                        padding: "0.45rem 0.7rem",
                        borderRadius: 6,
                        background: "var(--th-violet-bg)",
                        fontSize: "0.82rem",
                        color: "var(--th-violet)",
                      }}
                    >
                      Payable will be created as <b>CHECK_RELEASED</b> — waiting
                      for supplier to deposit and clear.
                    </div>
                  </div>
                )}
              </div>

              <p
                style={{
                  fontSize: "0.88rem",
                  color: "var(--th-text-muted)",
                  marginBottom: "1rem",
                }}
              >
                Check items that arrived. Edit qty/price if delivery differs
                from the order.{" "}
                <strong style={{ color: "var(--th-amber, #fbbf24)" }}>
                  DOT number is required for all tire items.
                </strong>{" "}
                Unchecked items need a reason.
              </p>

              {orderDetails.items?.map((item) => {
                const isChecked = receivedItems.some(
                  (ri) => ri.order_item_id === item.order_item_id,
                );
                const ov = receiveOverrides[item.order_item_id] || {};
                const dispQty = ov.quantity ?? item.quantity;
                const dispCost = ov.unit_cost ?? item.unit_cost;
                const isTire =
                  (item.category || "").toUpperCase() === "TIRE" ||
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
                        <div
                          className="ord-check-name"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.3rem",
                          }}
                        >
                          {item.item_name}
                          {item.is_new_item ? (
                            <span
                              style={{
                                fontSize: "0.6rem",
                                fontFamily: "'Barlow Condensed',sans-serif",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                background: "rgba(52,211,153,0.15)",
                                border: "1px solid #34d399",
                                color: "#34d399",
                                borderRadius: 4,
                                padding: "0.05rem 0.3rem",
                              }}
                            >
                              NEW
                            </span>
                          ) : null}
                        </div>
                        {item.supplier_name && (
                          <div
                            className="ord-check-sku"
                            style={{ color: "#38bdf8" }}
                          >
                            📦 {item.supplier_name}
                          </div>
                        )}
                        {item.sku && !item.is_new_item && (
                          <div className="ord-check-sku">{item.sku}</div>
                        )}
                        <div className="ord-check-qty">
                          Ordered: <b>{item.quantity} units</b> @{" "}
                          {ordCurrency(item.unit_cost)}
                        </div>
                      </div>
                    </label>
                    {isChecked && (
                      <div
                        className="ord-check-fields"
                        style={{
                          display: "flex",
                          gap: "0.6rem",
                          alignItems: "flex-start",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <label
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              color: "var(--th-text-dim)",
                              display: "block",
                              marginBottom: "0.25rem",
                              minHeight: "1.35rem",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Qty Received{" "}
                            <span style={{ color: "var(--th-orange)" }}>*</span>
                          </label>
                          <input
                            className="ord-input"
                            type="number"
                            min="0.01"
                            step="any"
                            value={dispQty}
                            onChange={(e) =>
                              setReceiveOverrides((prev) => ({
                                ...prev,
                                [item.order_item_id]: {
                                  ...prev[item.order_item_id],
                                  quantity: e.target.value,
                                },
                              }))
                            }
                            style={{ fontSize: "0.88rem", width: "100%" }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              color: "var(--th-text-dim)",
                              display: "block",
                              marginBottom: "0.25rem",
                              minHeight: "1.35rem",
                            }}
                          >
                            Unit Cost
                          </label>
                          <input
                            className="ord-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={dispCost}
                            onChange={(e) =>
                              setReceiveOverrides((prev) => ({
                                ...prev,
                                [item.order_item_id]: {
                                  ...prev[item.order_item_id],
                                  unit_cost: e.target.value,
                                },
                              }))
                            }
                            style={{ fontSize: "0.88rem", width: "100%" }}
                          />
                        </div>
                        {isTire && (
                          <div style={{ flex: 1 }}>
                            <label
                              style={{
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                color: "var(--th-amber, #fbbf24)",
                                display: "block",
                                marginBottom: "0.25rem",
                                minHeight: "1.35rem",
                              }}
                            >
                              DOT / Year{" "}
                              <span style={{ color: "var(--th-orange)" }}>
                                *
                              </span>
                            </label>
                            <input
                              className="ord-input"
                              type="text"
                              placeholder="e.g. 2025"
                              value={dispDot}
                              onChange={(e) =>
                                setReceiveOverrides((prev) => ({
                                  ...prev,
                                  [item.order_item_id]: {
                                    ...prev[item.order_item_id],
                                    dot_number: e.target.value,
                                  },
                                }))
                              }
                              style={{
                                fontSize: "0.88rem",
                                width: "100%",
                                borderColor:
                                  isTire && !dispDot
                                    ? "var(--th-rose, #fb7185)"
                                    : undefined,
                              }}
                            />
                            {isTire && !dispDot && (
                              <div
                                style={{
                                  fontSize: "0.62rem",
                                  color: "var(--th-rose, #fb7185)",
                                  marginTop: "0.2rem",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Required
                              </div>
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
                          style={{
                            marginLeft: "1.6rem",
                            width: "calc(100% - 1.6rem)",
                          }}
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
                  setReceiveCheckInfo({
                    check_number: "",
                    bank: "",
                    check_date: "",
                  });
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
