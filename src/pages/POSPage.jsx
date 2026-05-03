import '../pages_css/POSPage.css';
import React from 'react'
import { API_URL, currency, apiFetch } from '../lib/config'
import Pagination from '../components/Pagination'
import SearchInput from '../components/SearchInput'
import FilterHeader from '../components/FilterHeader'

const MANAGEMENT_ROLES = ['Owner', 'Manager', 'General Manager', 'Operations Manager', 'Sales', 'Sales Rep', 'Sales Representative', 'Cashier', 'Admin']
const SERVICE_ROLES = ['Tireman', 'Technician', 'Mechanic', 'Vulcanizer', 'Helper', 'Service Staff']

  /* ============================================================
     TIREHUB — ENHANCED POS PAGE
     Drop-in replacement for the original POSPage component.
     Requires: API_URL global, currency() helper (or uses built-in).
     ============================================================ */

  /* ── Styles ── */
  ;


const posCurrency = (n) => currency(n)

const CATEGORIES = ["All", "PCR", "SUV", "TBR", "LT", "MOTORCYCLE", "TUBE", "RECAP"];

/* ── Toast component ── */
function SaleToast({ amount, onDone }) {
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
    <div className={`pos-toast${out ? " out" : ""}`}>
      <div className="pos-toast-icon">✓</div>
      <div>
        <div className="pos-toast-title">Sale Complete</div>
        <div className="pos-toast-amount">{posCurrency(amount)}</div>
      </div>
    </div>
  );
}

/* ── Consumables section for a cart item ── */
function CartItemConsumables({ item, valveItems, weightItems, onUpdate, balancingServicePrice }) {
  const update = (patch) => onUpdate(item.cart_id, patch);

  const onValveChange = (e) => {
    if (e.target.checked) {
      const rubber = valveItems.find(v =>
        v.item_name?.toLowerCase().includes('rubber') || v.sku?.toLowerCase().includes('rubber')
      ) || valveItems[0];
      update({ valve_type: 'RUBBER', valve_quantity: item.quantity, valve_item_id: rubber?.item_id || null, valve_name: rubber?.item_name || null });
    } else {
      update({ valve_type: null, valve_quantity: 0, valve_item_id: null, valve_name: null });
    }
  };

  const onBalancingChange = (e) => {
    if (e.target.checked) {
      const chrome = weightItems.find(w => w.item_name?.toLowerCase().includes('chrome') || w.sku?.toLowerCase().includes('chrome'));
      update({ wheel_balancing: true, balancing_quantity: item.quantity, wheel_weights_item_id: chrome?.item_id || null, wheel_weights_name: chrome?.item_name || null, wheel_weights_qty: 0, balancing_labor_price: balancingServicePrice || 0 });
    } else {
      update({ wheel_balancing: false, balancing_quantity: 0, wheel_weights_item_id: null, wheel_weights_name: null, wheel_weights_qty: 0, balancing_labor_price: 0 });
    }
  };

  const dim = { fontSize: '0.68rem', color: 'var(--th-text-faint)' };

  return (
    <div className="pos-consumables">

      {/* ── Both toggles on one row ── */}
      <div style={{ display: 'flex', gap: '0.9rem' }}>
        <label className="pos-toggle-label">
          <input type="checkbox" checked={!!item.valve_type} onChange={onValveChange} />
          Tire Valve
        </label>
        <label className="pos-toggle-label">
          <input type="checkbox" checked={!!item.wheel_balancing} onChange={onBalancingChange} />
          Wheel Balancing
        </label>
      </div>

      {/* ── Valve detail: inline select + qty ── */}
      {item.valve_type && (
        <div className="pos-consumable-detail" style={{ marginTop: '0.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <select
              className="pos-sub-select"
              style={{ flex: 1, margin: 0 }}
              value={item.valve_item_id || ""}
              onChange={(e) => {
                const sv = valveItems.find((v) => v.item_id === e.target.value);
                update({ valve_item_id: e.target.value, valve_name: sv?.item_name, valve_type: sv?.item_name?.toLowerCase().includes('steel') ? 'STEEL' : 'RUBBER' });
              }}
            >
              <option value="">Select Valve</option>
              {valveItems.map((v) => (
                <option key={v.item_id} value={v.item_id}>{v.item_name} (Stock: {v.current_quantity})</option>
              ))}
            </select>
            {item.valve_item_id && <span style={{ ...dim, whiteSpace: 'nowrap' }}>×{item.valve_quantity || item.quantity}</span>}
          </div>
          {valveItems.length === 0 && <div className="pos-sub-no-stock">No valves in stock</div>}
        </div>
      )}

      {/* ── Balancing detail ── */}
      {item.wheel_balancing && (
        <div className="pos-consumable-detail" style={{ marginTop: '0.15rem' }}>

          {/* Row 1: Qty inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.3rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.12rem' }}>
              <label className="pos-sub-label">Tires Balanced</label>
              <input type="number" className="pos-sub-num"
                value={item.balancing_quantity || item.quantity} min="1"
                onChange={e => update({ balancing_quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                style={{ flex: 1, height: '32px', width: '100%' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.12rem' }}>
              <label className="pos-sub-label">Weight Qty {!item.wheel_weights_item_id && <span style={{ color: 'var(--th-rose)' }}>*</span>}</label>
              <input type="number" className="pos-sub-num"
                value={item.wheel_weights_qty || 0} min="0"
                onChange={e => update({ wheel_weights_qty: Math.max(0, parseInt(e.target.value) || 0) })}
                style={{ flex: 1, height: '32px', width: '100%' }} />
            </div>
          </div>

          {/* Row 2: Dropdowns */}
          <div className="pos-balancing-grid-row2">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.12rem' }}>
              <label className="pos-sub-label">Weight Type</label>
              <select
                className="pos-sub-select"
                value={item.wheel_weights_item_id || ""}
                style={{
                  borderColor: !item.wheel_weights_item_id ? 'var(--th-rose)' : 'var(--th-border-strong)',
                  height: '32px'
                }}
                onChange={(e) => {
                  const sw = weightItems.find((w) => w.item_id === e.target.value);
                  update({ wheel_weights_item_id: e.target.value, wheel_weights_name: sw?.item_name });
                }}
              >
                <option value="">Select Weight Type</option>
                {weightItems.map((w) => (
                  <option key={w.item_id} value={w.item_id}>{w.item_name} (Stock: {w.current_quantity})</option>
                ))}
              </select>
              {weightItems.length === 0 && <div className="pos-sub-no-stock" style={{ fontSize: '0.7rem' }}>No weights in stock</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.12rem' }}>
              <label className="pos-sub-label">Labor/Tire</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', height: '32px', background: 'var(--th-bg-input)', border: '1px solid var(--th-border-strong)', borderRadius: '6px', padding: '0.25rem 0.4rem' }}>
                <span style={dim}>₱</span>
                <input type="number" className="pos-sub-num"
                  value={item.balancing_labor_price ?? balancingServicePrice ?? 0}
                  min="0" step="1"
                  onChange={e => update({ balancing_labor_price: Math.max(0, Number(e.target.value)) })}
                  style={{ flex: 1, minWidth: 0, height: '100%', background: 'transparent', border: 'none', padding: 0, textAlign: 'right' }} />
              </div>
            </div>
          </div>

          {/* Total row */}
          {(item.wheel_weights_qty > 0 || (item.balancing_labor_price ?? balancingServicePrice ?? 0) > 0) && (
            <div style={{
              paddingTop: '0.2rem',
              borderTop: '1px solid var(--th-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--th-text-faint)', fontWeight: 600 }}>
                Total Labor Cost
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--th-sky)', fontWeight: 700 }}>
                ₱{((item.balancing_labor_price ?? balancingServicePrice ?? 0) * (item.balancing_quantity || item.quantity)).toLocaleString()}
              </span>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

/* ── Cart Item ── */
function CartItem({ item, valveItems, weightItems, onRemove, onUpdate, balancingServicePrice }) {
  const update = (cartId, patch) => onUpdate(cartId, patch);
  const [priceInput, setPriceInput] = React.useState(null);   // null = not editing
  const [totalInput, setTotalInput] = React.useState(null);


  return (
    <div className="pos-cart-item">
      {/* Header: name · badge · remove */}
      <div className="pos-ci-top">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pos-ci-name" style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexWrap: "wrap", lineHeight: 1.1 }}>
            {item.brand && <span style={{ fontWeight: 800, color: "var(--th-text-heading)" }}>{item.brand}</span>}
            <span style={{ fontWeight: 600 }}>{item.name}</span>
            {item.design && <span style={{ color: "var(--th-text-faint)", fontStyle: "italic", fontSize: "0.85em" }}>{item.design}</span>}
            {item.dot_number ? (
              <span style={{ fontSize: "0.62rem", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", padding: "0.05rem 0.35rem", borderRadius: 4, background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)", lineHeight: 1.4, marginLeft: "0.1rem" }}>DOT {item.dot_number}</span>
            ) : null}
            {item.is_custom && (
              <span style={{ fontSize: "0.62rem", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", padding: "0.05rem 0.35rem", borderRadius: 4, background: "var(--th-orange-bg)", color: "var(--th-orange)", border: "1px solid var(--th-orange)", lineHeight: 1.4 }}>MISC</span>
            )}
          </div>
          {(item.sku || item.category) && (
            <div className="pos-ci-meta">
              {[item.category, item.sku].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <span className={`pos-ci-type-badge ${item.type === "SERVICE" ? "service" : "product"}`}>
          {item.type === "SERVICE" ? "Svc" : "Prd"}
        </span>
        {item.type === "PRODUCT" && (
          <button
            title={item.no_install ? "Pickup only — no commission" : "Mark as pickup (no install)"}
            onClick={() => update(item.cart_id, { no_install: !item.no_install })}
            style={{
              padding: "0.1rem 0.35rem", borderRadius: 4, cursor: "pointer",
              fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700,
              fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.04em",
              lineHeight: 1.4, transition: "all 0.15s",
              background: item.no_install ? "var(--th-sky-bg)" : "var(--th-bg-input)",
              border: `1px solid ${item.no_install ? "var(--th-sky)" : "var(--th-border-strong)"}`,
              color: item.no_install ? "var(--th-sky)" : "var(--th-text-faint)",
            }}
          >{item.no_install ? "📦 Pickup" : "🔧 Install"}</button>
        )}
        <button className="pos-ci-remove" onClick={() => onRemove(item.cart_id)} title="Remove">✕</button>
      </div>

      {/* Price · Qty · Total in single row */}
      <div className="pos-ci-expanded-row">
        {/* Unit Price */}
        <div className="pos-ci-row-item">
          <label className="pos-ci-grid-label">Price</label>
          <div className="pos-ci-price-wrap">
            <span className="pos-ci-price-sign">₱</span>
            <input
              type="text"
              inputMode="decimal"
              className={`pos-ci-price-input${item.price !== item.defaultPrice ? ' discounted' : ''}`}
              value={priceInput !== null ? priceInput : (item.price ?? 0)}
              onFocus={e => { setPriceInput(String(item.price ?? 0)); e.target.select(); }}
              onChange={e => setPriceInput(e.target.value)}
              onBlur={() => {
                const v = Math.max(0, parseFloat(priceInput) || 0);
                update(item.cart_id, { price: v });
                setPriceInput(null);
              }}
            />
          </div>
        </div>

        {/* Quantity */}
        <div className="pos-ci-row-item">
          <label className="pos-ci-grid-label">Qty</label>
          <div className="pos-ci-qty-row" style={{ justifyContent: 'flex-start' }}>
            <button className="pos-qty-btn" onClick={() => {
              const q = Math.max(1, item.quantity - 1);
              update(item.cart_id, { quantity: q, ...(item.valve_type && { valve_quantity: q }) });
            }}>−</button>
            <input
              type="number"
              className="pos-qty-display"
              value={item.quantity}
              min="1"
              max={item.type === "PRODUCT" ? item.stock : 99}
              onChange={e => {
                const max = item.type === "PRODUCT" ? item.stock : 99;
                const q = Math.min(Math.max(1, parseInt(e.target.value) || 1), max);
                update(item.cart_id, { quantity: q, ...(item.valve_type && { valve_quantity: q }) });
              }}
            />
            <button className="pos-qty-btn" onClick={() => {
              const max = item.type === "PRODUCT" ? item.stock : 99;
              const q = Math.min(item.quantity + 1, max);
              update(item.cart_id, { quantity: q, ...(item.valve_type && { valve_quantity: q }) });
            }}>+</button>
          </div>
        </div>

        {/* Total - editable input field */}
        <div className="pos-ci-row-item">
          <label className="pos-ci-grid-label">Total</label>
          <div className="pos-ci-price-wrap">
            <span className="pos-ci-price-sign">₱</span>
            <input
              type="text"
              inputMode="decimal"
              className={`pos-ci-price-input${item.price !== item.defaultPrice ? ' discounted' : ''}`}
              value={totalInput !== null ? totalInput : Math.round(item.price * item.quantity * 100) / 100}
              title="Edit total — unit price adjusts"
              onFocus={e => { setTotalInput(String(Math.round(item.price * item.quantity * 100) / 100)); e.target.select(); }}
              onChange={e => setTotalInput(e.target.value)}
              onBlur={() => {
                const total = Math.max(0, parseFloat(totalInput) || 0);
                const newPrice = item.quantity > 0 ? Math.round((total / item.quantity) * 100) / 100 : 0;
                update(item.cart_id, { price: newPrice });
                setTotalInput(null);
              }}
            />
          </div>
        </div>
      </div>
      {item.price !== item.defaultPrice && (
        <div className="pos-ci-price-hint">
          <span style={{ color: 'var(--th-rose)' }}>was ₱{Number(item.defaultPrice).toLocaleString()}</span>
          <button className="pos-ci-price-reset" onClick={() => update(item.cart_id, { price: item.defaultPrice })}>reset</button>
        </div>
      )}

      {/* Consumable controls — only for tire categories that support valve/balancing */}
      {item.type === "PRODUCT" && ['PCR', 'SUV', 'MOTORCYCLE', 'TIRE', 'RECAP', 'LT', 'TBR'].includes((item.category || '').toUpperCase()) && (
        <CartItemConsumables
          item={item}
          valveItems={valveItems}
          weightItems={weightItems}
          onUpdate={update}
          balancingServicePrice={balancingServicePrice}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
function POSPage({ shopId, onRefresh, authUser, currentStaffId, currentStaffName, isShopClosed, businessDate }) {
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

  const [items, setItems] = React.useState([]);
  const [services, setServices] = React.useState([]);
  const [staff, setStaff] = React.useState([]);
  const [presentStaffIds, setPresentStaffIds] = React.useState([]);
  const [selectedHandlerId, setSelectedHandlerId] = React.useState("");
  const [cart, setCart] = React.useState([]);
  const [showClearCartModal, setShowClearCartModal] = React.useState(false);

  React.useEffect(() => {
    if (currentStaffId) {
      setSelectedHandlerId(currentStaffId);
    }
  }, [currentStaffId]);
  const [valveItems, setValveItems] = React.useState([]);
  const [weightItems, setWeightItems] = React.useState([]);

  const [selectedTiremen, setSelectedTiremen] = React.useState([]);
  const [selectedCustomer, setSelectedCustomer] = React.useState("");
  const [saleNotes, setSaleNotes] = React.useState("");
  const [invoiceNumber, setInvoiceNumber] = React.useState("");
  const [hasInvoice, setHasInvoice] = React.useState(true);
  const [paymentSplits, setPaymentSplits] = React.useState([{ method: "CASH", amount: "" }]);
  const [splitMode, setSplitMode] = React.useState(false);
  const [creditDueDate, setCreditDueDate] = React.useState("");
  const [creditDownPayment, setCreditDownPayment] = React.useState("");
  const [customers, setCustomers] = React.useState([]);
  const [commissionOverride, setCommissionOverride] = React.useState(null); // null = auto
  const [search, setSearch] = React.useState("");
  const [searchSuggestions, setSearchSuggestions] = React.useState([]);
  const [category, setCategory] = React.useState("");
  const [brandLogos, setBrandLogos] = React.useState({});

  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [posLoaded, setPosLoaded] = React.useState(false);
  const [showMiscModal, setShowMiscModal] = React.useState(false);
  const [miscForm, setMiscForm] = React.useState({ name: "", price: "", cost: "", qty: "1", category: "", newCategory: "" });
  const [toast, setToast] = React.useState(null); // { amount }
  const [dotModal, setDotModal] = React.useState(null); // array of DOT variants to pick from
  const [showCommission, setShowCommission] = React.useState(true); // collapsible commission section
  const cartColRef = React.useRef(null);

  // Scroll to cart on mobile
  const scrollToCart = () => {
    if (cartColRef.current) {
      cartColRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Server-grouped product picker state
  const [posGroups, setPosGroups] = React.useState([]);
  const [posTotalPages, setPosTotalPages] = React.useState(1);
  const [posLoading, setPosLoading] = React.useState(false);
  const [livePosCategories, setLivePosCategories] = React.useState([]);

  async function fetchPosCategories() {
    if (!shopId) return;
    try {
      const r = await apiFetch(`${API_URL}/item-categories/${shopId}`);
      const d = await r.json();
      if (Array.isArray(d)) setLivePosCategories(d);
    } catch { }
  }

  React.useEffect(() => {
    loadPOS();
    fetchPosCategories();
  }, [shopId]);

  /* Debounced server-side picker fetch */
  React.useEffect(() => {
    const timer = setTimeout(() => { fetchPosItems(1); }, 300);
    return () => clearTimeout(timer);
  }, [search, category, shopId]);

  // Fetch brand logos once on mount for backdrop rendering
  React.useEffect(() => {
    apiFetch(`${API_URL}/brand-assets`)
      .then(r => r.json())
      .then(data => {
        const map = {};
        if (Array.isArray(data)) data.forEach(b => { if (b.logo_url) map[b.brand_name] = b.logo_url; });
        setBrandLogos(map);
      })
      .catch(() => { });
  }, [shopId]);

  /* Suggestions — derived from currently visible groups & variants */
  React.useEffect(() => {
    if (!search.trim()) { setSearchSuggestions([]); return; }
    const q = search.toLowerCase();
    const seen = new Set();
    const sugs = [];
    const consider = (field, type, icon) => {
      if (field && field.toLowerCase().startsWith(q) && !seen.has(field)) {
        seen.add(field);
        sugs.push({ text: field, type, icon });
      }
    };
    for (const g of posGroups) {
      consider(g.size, 'Size', '📏');
      consider(g.brand, 'Brand', '🏷️');
      if (g.variants) {
        for (const v of g.variants) {
          consider(v.sku, 'SKU', '🔖');
          consider(v.item_name, 'Item', '📦');
          if (sugs.length >= 8) break;
        }
      } else {
        consider(g.representative_item_id, 'ID', '🔖');
      }
      if (sugs.length >= 8) break;
    }
    setSearchSuggestions(sugs.slice(0, 8));
  }, [search, posGroups]);

  async function loadPOS() {
    try {
      const todayLocal = businessDate || new Date().toISOString().split('T')[0];

      const [srv, stf, cust, valve, weight, attendanceRes] = await Promise.all([
        apiFetch(`${API_URL}/services`),
        apiFetch(`${API_URL}/staff/${shopId}`),
        apiFetch(`${API_URL}/customers/${shopId}`),
        apiFetch(`${API_URL}/items/${shopId}?category=VALVE`),
        apiFetch(`${API_URL}/items/${shopId}?category=WHEEL WEIGHT`),
        apiFetch(`${API_URL}/attendance/${shopId}?attendance_date=${todayLocal}`)
      ]);
      setServices((await srv.json()) || []);
      setStaff((await stf.json()) || []);
      setCustomers((await cust.json()) || []);
      const valves = (await valve.json()) || [];
      const weights = (await weight.json()) || [];
      const attendance = (await attendanceRes.json()) || [];

      setValveItems(valves.filter(i => (i.current_quantity || 0) > 0));
      setWeightItems(weights.filter(i => (i.current_quantity || 0) > 0));
      setPresentStaffIds(Array.isArray(attendance) ? attendance.filter(a => a.status === 'PRESENT').map(a => a.staff_id) : []);
      await fetchPosItems(1);
    } catch {
      setError("POS load failed");
    } finally {
      setPosLoaded(true);
    }
  }

  async function fetchPosItems(page = 1) {
    setPosLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), perPage: '50', inStockOnly: 'true' });
      if (search.trim()) qs.set('q', search.trim());
      if (category && category !== 'All') qs.set('category', category);
      const r = await apiFetch(`${API_URL}/pos-items/${shopId}?${qs.toString()}`);
      const d = await r.json();
      const groups = Array.isArray(d?.data) ? d.data : [];
      setPosGroups(groups);
      setPosTotalPages(d?.meta?.totalPages || 1);
      // Flat `items` retained for components that still iterate it (e.g. cart lookups).
      const flat = [];
      for (const g of groups) {
        if (g.variants && g.variants.length) flat.push(...g.variants);
        else flat.push({
          item_id: g.representative_item_id,
          sku: g.sku, item_name: g.item_name,
          category: g.category, brand: g.brand, design: g.design, size: g.size,
          unit_cost: g.unit_cost, selling_price: g.selling_price,
          current_quantity: g.total_quantity,
        });
      }
      setItems(flat);
    } catch {
      setError("Items load error");
      setPosGroups([]); setItems([]);
    } finally {
      setPosLoading(false);
    }
  }

  function addToCart(item) {
    setError("");
    if ((item.current_quantity || 0) <= 0) {
      setError("Out of stock");
      return;
    }
    const isSealant = (item.item_name || '').toUpperCase().includes('SEALANT') || (item.category || '').toUpperCase().includes('SEALANT');
    const existing = !isSealant && cart.find((c) => c.item_or_service_id === item.item_id);
    if (existing) {
      setCart(
        cart.map((c) =>
          c.item_or_service_id === item.item_id
            ? {
              ...c,
              quantity: Math.min(c.quantity + 1, item.current_quantity),
            }
            : c,
        ),
      );
    } else {
      setCart([
        ...cart,
        {
          cart_id: `${Date.now()}-${Math.random()}`,
          item_or_service_id: item.item_id,
          name: item.item_name,
          price: Number(item.selling_price || 0),
          defaultPrice: Number(item.selling_price || 0),
          type: "PRODUCT",
          quantity: 1,
          valve_type: null,
          valve_item_id: null,
          valve_name: null,
          valve_quantity: 0,
          wheel_balancing: false,
          balancing_quantity: 0,
          wheel_weights_item_id: null,
          wheel_weights_name: null,
          wheel_weights_qty: 0,
          stock: item.current_quantity,
          sku: item.sku,
          category: item.category,
          size: item.size,
          brand: item.brand,
          design: item.design,
          dot_number: item.dot_number || null,
          sealant_commission: (item.item_name || item.category || '').toUpperCase().includes('SEALANT') ? 400 : undefined,
        },
      ]);
    }
  }

  function addService(service) {
    setError("");
    setCart([
      ...cart,
      {
        cart_id: `${Date.now()}-${Math.random()}`,
        item_or_service_id: service.service_id,
        name: service.service_name,
        price: Number(service.base_price || 0),
        defaultPrice: Number(service.base_price || 0),
        type: "SERVICE",
        quantity: 1,
      },
    ]);
  }

  function addCustomItem() {
    const name = miscForm.name.trim();
    const price = parseFloat(miscForm.price);
    const cost = parseFloat(miscForm.cost) || 0;
    const qty = parseInt(miscForm.qty) || 1;
    if (!name) return;
    if (!price || price <= 0) return;
    setCart(prev => [...prev, {
      cart_id: `MISC-${Date.now()}-${Math.random()}`,
      item_or_service_id: `MISC-${Date.now()}`,
      name,
      price,
      defaultPrice: price,
      type: "PRODUCT",
      quantity: qty,
      unit_cost: cost,
      is_custom: true,
      category: (miscForm.category === "__new__" ? miscForm.newCategory.trim() : miscForm.category) || "MISC",
      sealant_commission: (name.toUpperCase().includes('SEALANT') || ((miscForm.category === "__new__" ? miscForm.newCategory : miscForm.category) || '').toUpperCase().includes('SEALANT')) ? 400 : undefined,
      sku: null, brand: null, design: null, size: null,
      stock: 9999,
      valve_type: null, valve_item_id: null, valve_name: null, valve_quantity: 0,
      wheel_balancing: false, balancing_quantity: 0,
      wheel_weights_item_id: null, wheel_weights_name: null, wheel_weights_qty: 0,
    }]);
    setMiscForm({ name: "", price: "", cost: "", qty: "1", category: "", newCategory: "" });
    setShowMiscModal(false);
  }

  function removeItem(id) {
    setCart(cart.filter((c) => c.cart_id !== id));
  }
  function clearCart() {
    setCart([]);
  }

  function updateCartItem(cartId, patch) {
    setCart(cart.map((c) => (c.cart_id === cartId ? { ...c, ...patch } : c)));
  }

  const balancingServicePrice = React.useMemo(
    () => services.find(s =>
      s.service_name?.toLowerCase().includes('balanc')
    )?.base_price ?? 0,
    [services]
  );

  const total = React.useMemo(
    () => cart.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [cart],
  );

  const splitTotal = paymentSplits.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const splitRemaining = Math.max(0, total - splitTotal);
  const splitOver = splitTotal > total + 0.01;
  const hasCreditSplit = paymentSplits.some(p => p.method === "CREDIT");
  const primaryPaymentMethod = paymentSplits[0]?.method || "CASH";

  async function completeSale() {
    setError("");
    if (!selectedHandlerId) {
      setError("No staff profile selected. Please select a handler.");
      return;
    }
    if (needsTireman && selectedTiremen.length === 0) {
      setError("Select at least one tireman — this sale has installable items or services");
      return;
    }
    if (cart.length === 0) {
      setError("Cart is empty");
      return;
    }
    const incompleteBalancing = cart.filter(c =>
      c.wheel_balancing && !c.wheel_weights_item_id
    );
    if (incompleteBalancing.length > 0) {
      setError(`Select wheel weights for: ${incompleteBalancing.map(c => c.name).join(', ')}`);
      return;
    }
    if (paymentSplits.length === 0 || !paymentSplits[0].method) { setError("Payment method is required"); return; }
    if (splitMode) {
      const _splitTotal = paymentSplits.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
      if (Math.abs(_splitTotal - total) > 1) { setError(`Payment splits must equal the total. Entered: ₱${_splitTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })} / Total: ₱${total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`); return; }
    }
    if (paymentSplits.some(p => p.method === "CREDIT") && !selectedCustomer) { setError("Select a customer for credit/pautang transactions"); return; }
    if (hasInvoice && !invoiceNumber.trim()) { setError("Invoice number is required"); return; }
    if (!saleNotes.trim()) { setError("Notes are required (add vehicle/plate info)"); return; }
    setLoading(true);
    try {
      const allItems = [];
      for (const c of cart) {
        const effectiveUnitPrice = c.wheel_balancing
          ? Math.max(0, c.price - (c.balancing_labor_price ?? balancingServicePrice ?? 0))
          : c.price;
        allItems.push({
          item_or_service_id: c.item_or_service_id,
          item_name: c.name,
          sale_type: c.type,
          quantity: c.quantity,
          unit_price: effectiveUnitPrice,
          unit_cost: c.unit_cost != null ? c.unit_cost : null,
          is_custom: c.is_custom || false,
          sku: c.sku || null,
          brand: c.brand || null,
          design: c.design || null,
          tire_size: c.size || null,
          category: c.category || null,
          dot_number: c.dot_number || null,
        });
        if (c.valve_type && c.valve_item_id && c.valve_quantity > 0) {
          allItems.push({
            item_or_service_id: c.valve_item_id,
            item_name: c.valve_name || "Valve",
            sale_type: "PRODUCT",
            quantity: c.valve_quantity,
            unit_price: 0,
            category: c.category || null,
            valve_type: c.valve_type,
            valve_quantity: c.valve_quantity,
          });
        }
        if (
          c.wheel_balancing &&
          c.wheel_weights_item_id &&
          c.wheel_weights_qty > 0
        ) {
          allItems.push({
            item_or_service_id: c.wheel_weights_item_id,
            item_name: c.wheel_weights_name || "Wheel Weights",
            sale_type: "PRODUCT",
            quantity: c.wheel_weights_qty,
            unit_price: 0,
            wheel_balancing: true,
            wheel_weights_qty: c.wheel_weights_qty,
          });
        }
      }
      const r = await apiFetch(`${API_URL}/sales/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: shopId,
          staff_id: selectedHandlerId,
          created_by: authUser || "POS",
          tireman_ids: selectedTiremen,
          tireman_commission_total: effectiveCommission,
          tireman_balancing_total: cart.reduce((sum, c) =>
            sum + (c.wheel_balancing ? (c.balancing_labor_price ?? balancingServicePrice ?? 0) * (c.balancing_quantity || c.quantity) : 0), 0),
          customer_id: selectedCustomer || null,
          sale_notes: saleNotes.trim() || null,
          invoice_number: hasInvoice ? invoiceNumber.trim() : "",
          payment_method: paymentSplits[0]?.method || "CASH",
          payment_splits: splitMode ? paymentSplits.map(p => ({ method: p.method, amount: parseFloat(p.amount) || 0 })) : null,
          credit_due_date: paymentSplits.some(p => p.method === "CREDIT") ? (creditDueDate || null) : null,
          credit_down_payment: paymentSplits.some(p => p.method === "CREDIT") ? (parseFloat(creditDownPayment) || 0) : 0,
          items: allItems,
        }),
      });
      const res = await r.json();
      if (!r.ok) throw new Error(res.error || "Sale failed");

      const saleTotal = total;
      clearCart();
      setSelectedTiremen([]);
      setSelectedCustomer("");
      setSelectedHandlerId(currentStaffId || "");
      setSaleNotes("");
      setInvoiceNumber("");
      setCommissionOverride(null);
      setPaymentSplits([{ method: "CASH", amount: "" }]);
      setSplitMode(false);
      setCreditDueDate("");
      setCreditDownPayment("");
      setToast({ amount: saleTotal });
      onRefresh();
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  // Commission calculation per cart
  const commissionBreakdown = React.useMemo(() => {
    const lines = [];
    for (const item of cart) {
      if (item.type !== 'PRODUCT') continue;
      if (item.no_install) continue;
      const cat = (item.category || '').toUpperCase();
      let rateLabel = '';
      let rate = 0;
      if (cat === 'PCR' || cat === 'MOTORCYCLE') { rate = 60; rateLabel = 'PCR/Motorcycle install'; }
      else if (cat === 'SUV' || cat === 'LT') { rate = 100; rateLabel = 'SUV/LT install'; }
      else if (cat === 'TBR' || cat === 'TRUCK') { rate = 100; rateLabel = 'Truck install'; }
      else if (cat === 'RECAP') { rate = 70; rateLabel = 'Recap tire install'; }
      else if (cat === 'TIRE') { rate = 60; rateLabel = 'Tire install'; }
      if (rate > 0) {
        lines.push({ label: `${item.name} (${rateLabel})`, qty: item.quantity, rate, total: rate * item.quantity });
      }
      // Valve attached as consumable to a tire
      if (item.valve_type && item.valve_quantity > 0) {
        const isSteel = (item.valve_name || '').toUpperCase().includes('STEEL');
        const valveRate = isSteel ? 50 : 40;
        const valveLabel = isSteel ? 'Steel valve' : 'Rubber valve';
        lines.push({ label: valveLabel, qty: item.valve_quantity, rate: valveRate, total: valveRate * item.valve_quantity });
      }
      // Sealant commission
      const isSealant = (item.name || '').toUpperCase().includes('SEALANT') || (item.category || '').toUpperCase().includes('SEALANT');
      if (isSealant && rate === 0) {
        const sealantFlat = item.sealant_commission ?? 400;
        if (sealantFlat > 0) {
          lines.push({ label: `${item.name} (sealant, flat)`, qty: 1, rate: sealantFlat, total: sealantFlat });
        }
      }
      // Standalone valve product sold directly
      const itemNameUpper = (item.name || item.sku || '').toUpperCase();
      const isStandaloneValve = (itemNameUpper.includes('VALVE') || cat.includes('VALVE')) && rate === 0 && !item.valve_type;
      if (isStandaloneValve) {
        const isSteel = itemNameUpper.includes('STEEL');
        const valveRate = isSteel ? 50 : 40;
        const valveLabel = `${item.name || 'Valve'} (Standalone)`;
        lines.push({ label: valveLabel, qty: item.quantity, rate: valveRate, total: valveRate * item.quantity });
      }
    }
    return lines;
  }, [cart]);

  const autoCommission = React.useMemo(
    () => commissionBreakdown.reduce((s, l) => s + l.total, 0),
    [commissionBreakdown]
  );

  // Reset override when cart changes significantly
  React.useEffect(() => {
    setCommissionOverride(null);
  }, [cart.length]);

  const effectiveCommission = commissionOverride !== null ? commissionOverride : autoCommission;
  const perTiremanCommission = selectedTiremen.length > 0
    ? effectiveCommission / selectedTiremen.length
    : 0;

  const needsTireman = cart.some(c => c.type === 'SERVICE') ||
    cart.some(c => c.wheel_balancing) ||
    autoCommission > 0;

  const serviceStaff = React.useMemo(
    () => staff.filter(s => SERVICE_ROLES.map(r => r.toLowerCase()).includes((s.role || '').toLowerCase()) && presentStaffIds.includes(s.staff_id)),
    [staff, presentStaffIds]
  );

  /* Category filter + DOT grouping now happen server-side via /pos-items.
     Map the server response into the {_rep, _variants} shape consumed
     downstream (product cards, DOT modal) so render code stays unchanged. */
  const groupedItems = React.useMemo(() => {
    return posGroups.map(g => {
      const rep = (g.variants && g.variants[0]) || {
        item_id: g.representative_item_id,
        sku: g.sku, item_name: g.item_name,
        category: g.category, brand: g.brand, design: g.design, size: g.size,
        unit_cost: g.unit_cost, selling_price: g.selling_price,
        dot_number: null,
        current_quantity: g.total_quantity,
      };
      // Rep carries the aggregated total quantity so the card shows full stock.
      const _rep = { ...rep, current_quantity: g.total_quantity, unit_cost: g.unit_cost, selling_price: g.selling_price, brand: g.brand, design: g.design, size: g.size };
      return { _rep, _variants: g.variants && g.variants.length > 1 ? g.variants : null };
    });
  }, [posGroups]);

  // Server owns pagination — `pagedItems` is just the current page.
  const [prodPage, setProdPage] = React.useState(1);
  const prodTotalPages = posTotalPages;
  const pagedItems = groupedItems;
  React.useEffect(() => { setProdPage(1); }, [category, search]);
  React.useEffect(() => { fetchPosItems(prodPage); /* eslint-disable-next-line */ }, [prodPage]);

  return (
    <>
      {toast && (
        <SaleToast amount={toast.amount} onDone={() => setToast(null)} />
      )}

      {/* ── DOT Selection Modal ── */}
      {dotModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setDotModal(null); }}>
          <div style={{ background: "var(--th-bg-card)", border: "1px solid var(--th-border)", borderRadius: 12, padding: "1.5rem", width: 360, maxWidth: "90vw" }}>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: "1rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--th-text-primary)", marginBottom: "0.25rem" }}>
              Select DOT Batch
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--th-text-faint)", marginBottom: "1rem" }}>
              {dotModal[0]?.item_name}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {dotModal.map((v, idx) => {
                const qty = v.current_quantity || 0;
                const stockCls = qty <= 2 ? "#fb7185" : qty <= 3 ? "#fbbf24" : "#34d399";
                return (
                  <button key={v.item_id} onClick={() => { addToCart(v); setDotModal(null); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", borderRadius: 8, border: "1px solid var(--th-border)", background: "var(--th-bg-input)", cursor: "pointer", transition: "border-color 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "var(--th-violet)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "var(--th-border)"}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      {idx === 0 && <span style={{ fontSize: "0.6rem", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid #34d399", borderRadius: 4, padding: "0.1rem 0.35rem" }}>Sell First</span>}
                      <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "0.95rem", color: "#fbbf24" }}>DOT {v.dot_number}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <span style={{ fontSize: "0.78rem", color: stockCls, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif" }}>Stock: {qty}</span>
                      <span style={{ fontWeight: 700, color: "var(--th-text-primary)", fontFamily: "'Barlow Condensed',sans-serif", fontSize: "1rem" }}>{posCurrency(v.selling_price)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setDotModal(null)} style={{ marginTop: "1rem", width: "100%", padding: "0.5rem", borderRadius: 7, border: "1px solid var(--th-border)", background: "transparent", color: "var(--th-text-dim)", cursor: "pointer", fontSize: "0.82rem" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="pos-page-header">
        <div className="th-title-format">Point<span style={{ color: 'var(--th-orange)' }}>of Sale</span></div>
      </div>

      <div className="pos-root">
        {/* ── LEFT: Catalog ── */}
        <div className="pos-left">
          {/* Custom / Misc item modal */}
          {showMiscModal && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={e => { if (e.target === e.currentTarget) setShowMiscModal(false); }}>
              <div style={{ background: "var(--th-bg-card)", border: "1px solid var(--th-border-strong)", borderRadius: 14, width: 800, maxWidth: "95vw", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
                <div style={{ padding: "0.9rem 1.1rem 0.7rem", borderBottom: "1px solid var(--th-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: "1.1rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--th-text-heading)" }}>
                    Custom / Misc Item
                  </span>
                  <button onClick={() => setShowMiscModal(false)} style={{ background: "none", border: "none", color: "var(--th-text-faint)", fontSize: "1.3rem", cursor: "pointer", lineHeight: 1 }}>×</button>
                </div>
                <div style={{ padding: "0.9rem 1.1rem", display: "flex", flexWrap: "nowrap", gap: "0.5rem", overflowX: "auto", alignItems: "flex-end" }}>
                  <div style={{ flex: "2 1 180px", minWidth: "150px" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--th-text-dim)", marginBottom: "0.25rem" }}>Item Name <span style={{ color: "var(--th-rose)" }}>*</span></div>
                    <input
                      autoFocus
                      type="text" placeholder="e.g. Generic tire sealant"
                      value={miscForm.name}
                      onChange={e => setMiscForm(f => ({ ...f, name: e.target.value }))}
                      style={{ width: "100%", background: "var(--th-bg-input)", border: "1px solid var(--th-border-strong)", color: "var(--th-text-primary)", padding: "0.45rem 0.65rem", borderRadius: 7, fontFamily: "var(--font-body)", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ flex: "1 1 100px", minWidth: "80px" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--th-text-dim)", marginBottom: "0.25rem" }}>Price <span style={{ color: "var(--th-rose)" }}>*</span></div>
                    <input
                      type="number" min="0" step="0.01" placeholder="0.00"
                      value={miscForm.price}
                      onChange={e => setMiscForm(f => ({ ...f, price: e.target.value }))}
                      style={{ width: "100%", background: "var(--th-bg-input)", border: "1px solid var(--th-border-strong)", color: "var(--th-text-primary)", padding: "0.45rem 0.65rem", borderRadius: 7, fontFamily: "var(--font-body)", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ flex: "1 1 100px", minWidth: "80px" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--th-text-dim)", marginBottom: "0.25rem" }}>Cost <span style={{ color: "var(--th-rose)" }}>*</span></div>
                    <input
                      type="number" min="0" step="0.01" placeholder="0.00"
                      value={miscForm.cost}
                      onChange={e => setMiscForm(f => ({ ...f, cost: e.target.value }))}
                      style={{ width: "100%", background: "var(--th-bg-input)", border: "1px solid var(--th-border-strong)", color: "var(--th-text-primary)", padding: "0.45rem 0.65rem", borderRadius: 7, fontFamily: "var(--font-body)", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ flex: "0.6 1 70px", minWidth: "60px" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--th-text-dim)", marginBottom: "0.25rem" }}>Qty</div>
                    <input
                      type="number" min="1" step="1"
                      value={miscForm.qty}
                      onChange={e => setMiscForm(f => ({ ...f, qty: e.target.value }))}
                      style={{ width: "100%", background: "var(--th-bg-input)", border: "1px solid var(--th-border-strong)", color: "var(--th-text-primary)", padding: "0.45rem 0.65rem", borderRadius: 7, fontFamily: "var(--font-body)", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ flex: "1.2 1 120px", minWidth: "100px" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--th-text-dim)", marginBottom: "0.25rem" }}>Category <span style={{ color: "var(--th-rose)" }}>*</span></div>
                    <select
                      value={miscForm.category}
                      onChange={e => setMiscForm(f => ({ ...f, category: e.target.value, newCategory: "" }))}
                      style={{ width: "100%", background: "var(--th-bg-input)", border: "1px solid var(--th-border-strong)", color: miscForm.category ? "var(--th-text-primary)" : "var(--th-text-faint)", padding: "0.45rem 0.65rem", borderRadius: 7, fontFamily: "var(--font-body)", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }}
                    >
                      <option value="">MISC</option>
                      <option value="PCR">PCR</option>
                      <option value="MOTORCYCLE">MOTORCYCLE</option>
                      <option value="SUV">SUV</option>
                      <option value="LT">LT</option>
                      <option value="TBR">TBR</option>
                      <option value="RECAP">RECAP</option>
                      <option value="SEALANT">SEALANT</option>
                      <option value="TUBE">TUBE</option>
                      <option value="__new__">+ Add new category…</option>
                    </select>
                    {miscForm.category === "__new__" && (
                      <input
                        autoFocus
                        type="text" placeholder="Type category name…"
                        value={miscForm.newCategory}
                        onChange={e => setMiscForm(f => ({ ...f, newCategory: e.target.value }))}
                        style={{ marginTop: "0.35rem", width: "100%", background: "var(--th-bg-input)", border: "1px solid var(--th-orange)", color: "var(--th-text-primary)", padding: "0.45rem 0.65rem", borderRadius: 7, fontFamily: "var(--font-body)", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }}
                      />
                    )}
                  </div>
                </div>
                {miscForm.price && miscForm.cost && parseFloat(miscForm.price) > 0 && (
                    <div style={{ background: "var(--th-emerald-bg)", border: "1px solid var(--th-emerald)", borderRadius: 7, padding: "0.4rem 0.65rem", fontSize: "0.82rem", color: "var(--th-text-muted)" }}>
                      Margin: <strong style={{ color: "var(--th-emerald)", fontFamily: "'Barlow Condensed',sans-serif", fontSize: "0.95rem" }}>
                        ₱{((parseFloat(miscForm.price) - parseFloat(miscForm.cost || 0)) * (parseInt(miscForm.qty) || 1)).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </strong>
                      <span style={{ color: "var(--th-text-faint)", marginLeft: "0.4rem" }}>
                        ({(((parseFloat(miscForm.price) - parseFloat(miscForm.cost || 0)) / parseFloat(miscForm.price)) * 100).toFixed(1)}% margin)
                      </span>
                    </div>
                  )}
                  <div style={{ padding: "0.75rem 1.1rem", borderTop: "1px solid var(--th-border)", display: "flex", gap: "0.6rem" }}>
                  <button onClick={() => setShowMiscModal(false)}
                    style={{ padding: "0.55rem 1rem", borderRadius: 8, background: "var(--th-bg-input)", color: "var(--th-text-muted)", border: "1px solid var(--th-border-strong)", cursor: "pointer", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "0.88rem", textTransform: "uppercase" }}>
                    Cancel
                  </button>
                  <button
                    onClick={addCustomItem}
                    disabled={
                      !miscForm.name.trim() ||
                      !miscForm.price || parseFloat(miscForm.price) <= 0 ||
                      miscForm.cost === "" ||
                      !miscForm.category || (miscForm.category === "__new__" && !miscForm.newCategory.trim())
                    }
                    style={{ flex: 1, padding: "0.55rem", borderRadius: 8, background: "var(--th-orange)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.06em", opacity: (!miscForm.name.trim() || !miscForm.price || parseFloat(miscForm.price) <= 0 || miscForm.cost === "" || !miscForm.category || (miscForm.category === "__new__" && !miscForm.newCategory.trim())) ? 0.4 : 1, transition: "opacity 0.15s" }}>
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Search + category bar + custom — single row */}
          <div className="pos-search-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <FilterHeader
                accentColor="var(--th-orange)"
                searchProps={{
                  value: search,
                  onChange: (val) => { setSearch(val); setError(""); },
                  placeholder: "Search size · SKU · brand · item name",
                  suggestions: searchSuggestions,
                  onSuggestionSelect: (s) => setSearch(s.text),
                }}
                filters={[
                  { label: "All", value: "", active: category === "" },
                  ...livePosCategories.map(cat => ({
                    label: cat,
                    value: cat,
                    active: category === cat,
                  }))
                ]}
                twoRow
                onFilterChange={setCategory}
              />
            </div>
            <button
              onClick={() => setShowMiscModal(true)}
              className="pos-custom-btn"
              title="Add a custom item not in inventory"
            >+ Custom</button>
          </div>{/* end search+custom row */}

          {/* Catalog */}
          <div className="pos-catalog">
            {/* Loading skeleton */}
            {!posLoaded && (
              <div className="pos-skeleton">
                <div className="pos-skel-section-head" />
                <div className="pos-skel-grid">
                  {Array.from({ length: 4 }).map((_, i) => <div key={i} className="pos-skel-card" />)}
                </div>
                <div className="pos-skel-section-head" style={{ marginTop: '0.75rem' }} />
                <div className="pos-skel-grid pos-skel-grid-lg">
                  {Array.from({ length: 8 }).map((_, i) => <div key={i} className="pos-skel-card pos-skel-card-lg" />)}
                </div>
              </div>
            )}
            {/* Services + Products */}
            {posLoaded && <React.Fragment>
              <div className="th-section-label">Services</div>
              <div className="pos-service-grid">
                {services.length === 0 ? (
                  <div className="pos-catalog-empty">No services configured</div>
                ) : services.map((s) => (
                  <button
                    key={s.service_id}
                    className="pos-service-card"
                    onClick={() => addService(s)}
                  >
                    <div className="pos-service-name">{s.service_name}</div>
                    <div className="pos-service-price">
                      {posCurrency(s.base_price)}
                    </div>
                  </button>
                ))}
              </div>

              <div className="th-section-label">Products</div>
              <div className="pos-product-grid">
                {pagedItems.map(({ _rep: i, _variants }) => {
                  const hasMultipleDots = _variants && _variants.length > 1;
                  const qty = _variants
                    ? _variants.reduce((s, v) => s + (v.current_quantity || 0), 0)
                    : (i.current_quantity || 0);
                  const stockCls = qty <= 2 ? "critical" : qty <= 3 ? "low" : "ok";
                  const handleClick = () => {
                    if (hasMultipleDots) setDotModal(_variants);
                    else addToCart(_variants ? _variants[0] : i);
                  };
                  return (
                    <button
                      key={i.item_id}
                      className="pos-product-card"
                      onClick={handleClick}
                    >
                      {/* Brand logo backdrop */}
                      {brandLogos[i.brand] && (
                        <div
                          className="pos-brand-backdrop"
                          style={{ backgroundImage: `url(${brandLogos[i.brand]})` }}
                        />
                      )}
                      {hasMultipleDots && (
                        <span className="pos-multi-dot-badge">{_variants.length} DOTs</span>
                      )}
                      <div className="pos-card-cat">{i.category}</div>
                      <div style={{ fontSize: 'clamp(0.88rem, 0.78rem + 0.4vw, 1.05rem)', color: 'var(--th-text-dim)', marginBottom: '0.1rem', fontWeight: 700 }}>
                        {i.brand || i.item_name}
                      </div>
                      {i.design && (
                        <div style={{ fontSize: 'clamp(0.82rem, 0.72rem + 0.35vw, 0.95rem)', color: 'var(--th-text-muted)', marginBottom: '0.08rem', fontStyle: 'italic' }}>
                          {i.design}
                        </div>
                      )}
                      {i.size && (
                        <div style={{ fontSize: 'clamp(0.82rem, 0.72rem + 0.35vw, 0.95rem)', color: 'var(--th-text-dim)', marginBottom: '0.15rem', fontWeight: 700 }}>
                          {i.size}
                        </div>
                      )}
                      {!hasMultipleDots && i.dot_number && (
                        <div style={{ fontSize: "0.82rem", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, color: "#fbbf24", letterSpacing: "0.04em", marginBottom: "0.15rem" }}>DOT {i.dot_number}</div>
                      )}
                      <div className="pos-card-price">{posCurrency(i.selling_price)}</div>
                      <div className={`pos-card-stock ${stockCls}`}>Stock: {qty}</div>
                    </button>
                  );
                })}
                {pagedItems.length === 0 && (
                  <div className="pos-catalog-empty" style={{ gridColumn: "1/-1" }}>
                    No products found
                  </div>
                )}
              </div>
              <Pagination currentPage={prodPage} totalPages={prodTotalPages} onPageChange={setProdPage} />
            </React.Fragment>}
          </div>
        </div>

        {/* ── RIGHT: Cart ── */}
        <div className="pos-cart-col" ref={cartColRef}>
          {/* Cart header */}
          <div className="pos-cart-header">
            <div className="pos-cart-title">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              Cart
              {cart.length > 0 && (
                <span className="pos-cart-badge">{cart.length}</span>
              )}

              {/* Header Title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {isShopClosed && (
                  <div className="pos-closed-badge">
                    <span className="pulse"></span>
                    NEXT DAY MODE
                  </div>
                )}
              </div>
            </div>
            {cart.length > 0 && (
              <button className="pos-cart-clear" onClick={() => setShowClearCartModal(true)}>
                Clear
              </button>
            )}
          </div>

          {/* Staff row: Processed By + Handled By */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", padding: "0.3rem 0.85rem 0" }}>
            <div>
              <div className="pos-staff-label">Processed By</div>
              <div style={{
                background: "var(--th-bg-input)", border: "1px solid var(--th-border-mid)",
                borderRadius: 7, padding: "0.3rem 0.5rem",
                fontSize: "0.8rem", fontWeight: 600, color: "var(--th-text-primary)",
                display: "flex", alignItems: "center", gap: "0.3rem",
              }}>
                <span style={{ color: "var(--th-orange)", fontSize: "0.6rem" }}>●</span>
                {authUser || "System"}
              </div>
            </div>
            <div>
              <div className="pos-staff-label">Handled By</div>
              <select
                value={selectedHandlerId}
                onChange={e => setSelectedHandlerId(e.target.value)}
                style={{
                  background: "var(--th-bg-input)", border: "1px solid var(--th-border-mid)",
                  borderRadius: 7, padding: "0.3rem 0.5rem",
                  fontSize: "0.8rem", fontWeight: 600, color: "var(--th-text-primary)",
                  width: "100%", outline: "none", appearance: "auto"
                }}
              >
                {staff
                  .filter(s => MANAGEMENT_ROLES.map(r => r.toLowerCase()).includes((s.role || '').toLowerCase()) && (presentStaffIds.includes(s.staff_id) || s.staff_id === currentStaffId))
                  .map(s => (
                    <option key={s.staff_id} value={s.staff_id}>{s.full_name}</option>
                  ))
                }
                {!staff.some(s => s.staff_id === currentStaffId && MANAGEMENT_ROLES.map(r => r.toLowerCase()).includes((s.role || '').toLowerCase())) && currentStaffId && (
                  <option value={currentStaffId}>{currentStaffName || "—"}</option>
                )}
              </select>
            </div>
          </div>

          {/* Form fields — compact grid */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", padding: "0.25rem 0.85rem 0" }}>

            {/* Row 1: Customer + Invoice # */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
              <div>
                <div className="pos-staff-label">Customer</div>
                <select
                  className="pos-staff-select"
                  style={{ padding: "0.3rem 0.45rem", fontSize: "0.8rem", borderRadius: 7 }}
                  value={selectedCustomer}
                  onChange={e => setSelectedCustomer(e.target.value)}
                >
                  <option value="">— Walk-in —</option>
                  {customers.map(c => (
                    <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="pos-staff-label">Invoice #{hasInvoice && <span style={{ color: "var(--th-rose)", fontWeight: 600, marginLeft: 3 }}>*</span>}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  {hasInvoice ? (
                    <input
                      type="text"
                      className="pos-staff-select"
                      style={{ padding: "0.3rem 0.45rem", fontSize: "0.8rem", borderRadius: 7, flex: 1, minWidth: 0 }}
                      placeholder="0001"
                      inputMode="numeric"
                      value={invoiceNumber}
                      onChange={e => setInvoiceNumber(e.target.value.replace(/\D/g, ''))}
                    />
                  ) : (
                    <div style={{ flex: 1, padding: "0.3rem 0.5rem", fontSize: "0.78rem", borderRadius: 7, background: "var(--th-bg-input)", border: "1px dashed var(--th-border-strong)", color: "var(--th-text-faint)", fontStyle: "italic" }}>
                      No invoice
                    </div>
                  )}
                  <div
                    onClick={() => { setHasInvoice(v => !v); setInvoiceNumber(""); }}
                    title={hasInvoice ? "No invoice" : "Has invoice"}
                    style={{
                      width: 28, height: 16, borderRadius: 8, cursor: "pointer", flexShrink: 0,
                      background: hasInvoice ? "var(--th-sky)" : "var(--th-bg-input)",
                      border: `1px solid ${hasInvoice ? "var(--th-sky)" : "var(--th-border-strong)"}`,
                      position: "relative", transition: "background 0.2s, border-color 0.2s",
                    }}
                  >
                    <div style={{
                      position: "absolute", top: 2, left: hasInvoice ? 12 : 2,
                      width: 10, height: 10, borderRadius: "50%",
                      background: hasInvoice ? "#fff" : "var(--th-text-faint)",
                      transition: "left 0.2s",
                    }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Notes */}
            <div>
              <div className="pos-staff-label">Notes <span style={{ color: "var(--th-rose)", fontWeight: 600 }}>*</span></div>
              <input
                type="text"
                className="pos-staff-select"
                style={{ padding: "0.3rem 0.45rem", fontSize: "0.8rem", borderRadius: 7, width: "100%", boxSizing: "border-box" }}
                placeholder="Vehicle plate, type, any relevant info"
                value={saleNotes}
                onChange={e => setSaleNotes(e.target.value)}
                maxLength={300}
              />
            </div>

            {/* Row 3: Payment method */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                <div className="pos-staff-label" style={{ marginBottom: 0 }}>Payment <span style={{ color: "var(--th-rose)", fontWeight: 600 }}>*</span></div>
                <button type="button"
                  onClick={() => {
                    const next = !splitMode;
                    setSplitMode(next);
                    if (!next) setPaymentSplits([{ method: paymentSplits[0]?.method || "CASH", amount: "" }]);
                    else setPaymentSplits([{ method: paymentSplits[0]?.method || "CASH", amount: "" }]);
                  }}
                  style={{
                    fontSize: "0.7rem", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700,
                    padding: "0.18rem 0.55rem", borderRadius: 5, cursor: "pointer", letterSpacing: "0.04em",
                    textTransform: "uppercase", transition: "all 0.15s",
                    background: splitMode ? "var(--th-sky-bg)" : "var(--th-bg-input)",
                    color: splitMode ? "var(--th-sky)" : "var(--th-text-dim)",
                    border: `1px solid ${splitMode ? "var(--th-sky)" : "var(--th-border-strong)"}`
                  }}>
                  ⊕ Split Pay
                </button>
              </div>

              {!splitMode ? (
                /* Single payment method grid */
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.25rem" }}>
                  {[
                    { value: "CASH", label: "Cash" },
                    { value: "GCASH", label: "GCash" },
                    { value: "BANK_BPI", label: "BPI" },
                    { value: "BANK_BDO", label: "BDO" },
                    { value: "CARD", label: "Card" },
                    { value: "CHECK", label: "Check" },
                    { value: "CREDIT", label: "Credit" },
                  ].map(opt => {
                    const active = paymentSplits[0]?.method === opt.value;
                    return (
                      <button key={opt.value} type="button"
                        onClick={() => setPaymentSplits([{ method: opt.value, amount: "" }])}
                        style={{
                          padding: "0.28rem 0", borderRadius: 6, cursor: "pointer", textAlign: "center",
                          fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700,
                          fontSize: "0.72rem", letterSpacing: "0.02em", transition: "all 0.15s",
                          border: `1.5px solid ${active ? (opt.value === "CREDIT" ? "var(--th-rose)" : "var(--th-emerald)") : "var(--th-border-strong)"}`,
                          background: active ? (opt.value === "CREDIT" ? "var(--th-rose-bg)" : "var(--th-emerald-bg)") : "var(--th-bg-input)",
                          color: active ? (opt.value === "CREDIT" ? "var(--th-rose)" : "var(--th-emerald)") : "var(--th-text-muted)",
                        }}>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Split payment rows */
                <div style={{ background: "var(--th-bg-input)", border: "1px solid var(--th-sky)", borderRadius: 8, padding: "0.6rem 0.65rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  {paymentSplits.map((split, idx) => (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.25rem", alignItems: "center" }}>
                      <select
                        value={split.method}
                        onChange={e => setPaymentSplits(prev => prev.map((p, i) => i === idx ? { ...p, method: e.target.value } : p))}
                        style={{
                          background: "var(--th-bg-card)", border: "1px solid var(--th-border-strong)",
                          color: split.method === "CREDIT" ? "var(--th-rose)" : "var(--th-emerald)",
                          padding: "0.3rem 0.4rem", borderRadius: 6,
                          fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700,
                          fontSize: "0.8rem", outline: "none", cursor: "pointer",
                        }}
                      >
                        <option value="CASH">💵 Cash</option>
                        <option value="GCASH">📲 GCash</option>
                        <option value="BANK_BPI">🏦 BPI</option>
                        <option value="BANK_BDO">🏦 BDO</option>
                        <option value="CARD">💳 Card</option>
                        <option value="CHECK">📄 Check</option>
                        <option value="CREDIT">📒 Credit</option>
                      </select>
                      <input
                        type="number" min="0" step="0.01" placeholder="0.00"
                        value={split.amount}
                        onChange={e => setPaymentSplits(prev => prev.map((p, i) => i === idx ? { ...p, amount: e.target.value } : p))}
                        style={{
                          background: "var(--th-bg-card)", border: "1px solid var(--th-border-strong)",
                          color: "var(--th-text-primary)", padding: "0.3rem 0.5rem", borderRadius: 6,
                          fontFamily: "var(--font-body)", fontSize: "0.85rem", outline: "none", width: "100%",
                        }}
                      />
                      {paymentSplits.length > 1
                        ? <button type="button" onClick={() => setPaymentSplits(prev => prev.filter((_, i) => i !== idx))}
                          style={{ background: "none", border: "none", color: "var(--th-text-faint)", fontSize: "1rem", cursor: "pointer", padding: "0 0.2rem", lineHeight: 1 }}
                          onMouseOver={e => e.currentTarget.style.color = "var(--th-rose)"}
                          onMouseOut={e => e.currentTarget.style.color = "var(--th-text-faint)"}>×</button>
                        : <span style={{ width: "1.2rem" }} />
                      }
                    </div>
                  ))}

                  {/* Add split + balance bar */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.1rem" }}>
                    {paymentSplits.length < 4
                      ? <button type="button"
                        onClick={() => setPaymentSplits(prev => [...prev, { method: "CASH", amount: "" }])}
                        style={{
                          fontSize: "0.7rem", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700,
                          padding: "0.15rem 0.5rem", borderRadius: 5, cursor: "pointer",
                          background: "none", color: "var(--th-sky)", border: "1px solid var(--th-sky)",
                          letterSpacing: "0.04em", textTransform: "uppercase"
                        }}>+ Add</button>
                      : <span />
                    }
                    {(() => {
                      const entered = paymentSplits.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
                      const remaining = total - entered;
                      const over = entered > total + 0.01;
                      const exact = Math.abs(remaining) <= 0.01;
                      return (
                        <div style={{
                          padding: "0.2rem 0.5rem", borderRadius: 5,
                          background: exact ? "var(--th-emerald-bg)" : over ? "var(--th-rose-bg)" : "transparent",
                          fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "0.78rem",
                          color: exact ? "var(--th-emerald)" : over ? "var(--th-rose)" : "var(--th-amber)",
                        }}>
                          {exact ? "✓ Exact" : over ? `⚠ Over ₱${Math.abs(remaining).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : `Remaining ₱${remaining.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Credit due date + down payment — shown in both modes */}
              {hasCreditSplit && (
                <div style={{ marginTop: "0.3rem", background: "var(--th-rose-bg)", border: "1px solid var(--th-rose)", borderRadius: 7, padding: "0.5rem 0.65rem" }}>
                  <div style={{ fontSize: "0.68rem", color: "var(--th-rose)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                    📒 Credit — Customer required · Due Date
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input type="date" value={creditDueDate} onChange={e => setCreditDueDate(e.target.value)}
                      style={{
                        flex: 1, background: "var(--th-bg-input)", border: "1px solid var(--th-border-strong)",
                        color: "var(--th-text-primary)", padding: "0.35rem 0.5rem", borderRadius: 6,
                        fontFamily: "var(--font-body)", fontSize: "0.85rem", outline: "none"
                      }} />
                    <input type="number" min="0" step="0.01" placeholder="Down payment (opt.)"
                      value={creditDownPayment} onChange={e => setCreditDownPayment(e.target.value)}
                      style={{
                        flex: 1, background: "var(--th-bg-input)", border: "1px solid var(--th-border-strong)",
                        color: "var(--th-text-primary)", padding: "0.35rem 0.5rem", borderRadius: 6,
                        fontFamily: "var(--font-body)", fontSize: "0.85rem", outline: "none"
                      }} />
                  </div>
                </div>
              )}
            </div>

            {/* Row 4: Tireman chips */}
            <div>
              <div className="pos-staff-label" style={{ marginBottom: "0.2rem" }}>
                Tireman(s){needsTireman
                  ? <span style={{ color: "var(--th-rose)", fontWeight: 600 }}> *</span>
                  : <span style={{ color: "var(--th-text-faint)", fontSize: "0.65rem", fontWeight: 400 }}> (optional — pickup only)</span>
                }
                {selectedTiremen.length > 0 && (
                  <span style={{
                    marginLeft: "0.35rem", background: "var(--th-orange-bg)", color: "var(--th-orange)",
                    borderRadius: 20, padding: "0.05rem 0.4rem", fontSize: "0.65rem", fontWeight: 700,
                  }}>{selectedTiremen.length}</span>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.28rem" }}>
                {serviceStaff.map((s) => {
                  const active = selectedTiremen.includes(s.staff_id);
                  return (
                    <button key={s.staff_id} onClick={() =>
                      setSelectedTiremen(prev => active ? prev.filter(id => id !== s.staff_id) : [...prev, s.staff_id])
                    } style={{
                      padding: "0.15rem 0.45rem",
                      borderRadius: 20,
                      border: `1px solid ${active ? "var(--th-orange)" : "var(--th-border-strong)"}`,
                      background: active ? "var(--th-orange-bg)" : "var(--th-bg-input)",
                      color: active ? "var(--th-orange)" : "var(--th-text-muted)",
                      fontSize: "0.76rem", fontWeight: active ? 700 : 400,
                      cursor: "pointer", transition: "all 0.15s",
                    }}>
                      {s.full_name.split(' ')[0]}
                    </button>
                  );
                })}
                {serviceStaff.length === 0 && (
                  <span style={{ fontSize: "0.74rem", color: "var(--th-text-faint)" }}>No service staff</span>
                )}
              </div>
            </div>
          </div>


          {/* Error */}
          {error && (
            <div className="pos-error">
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



          {/* Cart items */}
          <div className="pos-cart-items">
            {cart.length === 0 ? (
              <div className="pos-cart-empty">
                <div className="pos-cart-empty-icon">🛒</div>
                <div className="pos-cart-empty-text">Cart is empty</div>
              </div>
            ) : (
              cart.map((item) => (
                <CartItem
                  key={item.cart_id}
                  item={item}
                  valveItems={valveItems}
                  weightItems={weightItems}
                  onRemove={removeItem}
                  onUpdate={updateCartItem}
                  balancingServicePrice={balancingServicePrice}
                />
              ))
            )}
          </div>

          {/* Commission panel — bottom of cart, above footer */}
          {commissionBreakdown.length > 0 && (
            <div style={{
              margin: "0 0 0 0",
              borderTop: "1px solid var(--th-border)",
              padding: "0.45rem 0.85rem",
              background: "var(--th-bg-card-alt)",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                cursor: "pointer", userSelect: "none",
              }} onClick={() => setShowCommission(!showCommission)}>
                <div style={{
                  fontFamily: "'Barlow Condensed',sans-serif",
                  fontWeight: 700, fontSize: "0.72rem",
                  textTransform: "uppercase", letterSpacing: "0.07em",
                  color: "var(--th-text-faint)",
                }}>
                  Tireman Commission
                </div>
                {/* Total always visible in header */}
                <div style={{
                  display: "flex", alignItems: "center", gap: "0.5rem",
                  marginLeft: "auto", marginRight: "0.5rem",
                }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--th-text-muted)" }}>
                    Total
                  </span>
                  <div style={{
                    display: "flex", alignItems: "center", gap: "0.25rem",
                    background: "var(--th-bg-input)",
                    border: `1px solid ${commissionOverride !== null ? "var(--th-sky)" : "var(--th-border-strong)"}`,
                    borderRadius: 7, padding: "0.25rem 0.5rem",
                  }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--th-text-faint)" }}>₱</span>
                    <input
                      type="number" min="0" step="1"
                      value={effectiveCommission}
                      onChange={e => setCommissionOverride(Math.max(0, Number(e.target.value)))}
                      onClick={e => e.stopPropagation()}
                      style={{
                        width: 60, background: "transparent", border: "none", outline: "none",
                        color: "var(--th-amber)", fontFamily: "'Barlow Condensed',sans-serif",
                        fontWeight: 700, fontSize: "0.9rem", textAlign: "right", cursor: "text",
                      }}
                    />
                  </div>
                </div>
                <span style={{
                  fontSize: "0.9rem", color: "var(--th-text-faint)",
                  transition: "transform 0.15s", transform: showCommission ? "rotate(0deg)" : "rotate(-90deg)",
                  flexShrink: 0,
                }}>▼</span>
              </div>

              {showCommission && (
                <>
                  {commissionBreakdown.map((line, i) => (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between",
                      fontSize: "0.78rem", color: "var(--th-text-muted)",
                      marginBottom: "0.15rem", marginTop: i === 0 ? "0.2rem" : 0,
                    }}>
                      <span>{line.qty}× {line.label} @ ₱{line.rate}</span>
                      <span style={{ fontWeight: 600, color: "var(--th-amber)" }}>₱{line.total.toLocaleString()}</span>
                    </div>
                  ))}

                  <div style={{ borderTop: "1px solid var(--th-border)", margin: "0.25rem 0" }} />

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--th-text-muted)", flex: 1 }}>
                      Total
                      {commissionOverride !== null && (
                        <button onClick={() => setCommissionOverride(null)} style={{
                          marginLeft: "0.35rem", fontSize: "0.68rem",
                          background: "none", border: "none",
                          color: "var(--th-sky)", cursor: "pointer", textDecoration: "underline",
                        }}>reset</button>
                      )}
                    </span>
                    <div style={{
                      display: "flex", alignItems: "center", gap: "0.25rem",
                      background: "var(--th-bg-input)",
                      border: `1px solid ${commissionOverride !== null ? "var(--th-sky)" : "var(--th-border-strong)"}`,
                      borderRadius: 7, padding: "0.25rem 0.5rem",
                    }}>
                      <span style={{ fontSize: "0.72rem", color: "var(--th-text-faint)" }}>₱</span>
                      <input
                        type="number" min="0" step="1"
                        value={effectiveCommission}
                        onChange={e => setCommissionOverride(Math.max(0, Number(e.target.value)))}
                        style={{
                          width: 68, background: "transparent", border: "none", outline: "none",
                          color: "var(--th-amber)", fontFamily: "'Barlow Condensed',sans-serif",
                          fontWeight: 700, fontSize: "0.95rem", textAlign: "right",
                        }}
                      />
                    </div>
                  </div>

                  {selectedTiremen.length > 0 ? (
                    <div style={{
                      fontSize: "0.75rem", color: "var(--th-text-faint)",
                      display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: "0.3rem",
                      gap: "0.5rem",
                    }}>
                      <span style={{ flex: 1, wordBreak: "break-word" }}>÷ {selectedTiremen.length} tireman{selectedTiremen.length > 1 ? 'en' : ''}</span>
                      <span style={{ fontWeight: 600, color: "var(--th-emerald)", whiteSpace: "nowrap", flexShrink: 0 }}>
                        ₱{perTiremanCommission.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each
                      </span>
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.72rem", color: "var(--th-text-faint)", marginTop: "0.3rem", fontStyle: "italic" }}>
                      Select tireman(s) to split
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="pos-cart-footer" style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "0.6rem", alignItems: "center" }}>
            <div>
              <div className="pos-total-label" style={{ marginBottom: "0.1rem" }}>Total</div>
              <div className="pos-total-amount">{posCurrency(total)}</div>
            </div>
            <button
              className={`pos-complete-btn${loading ? " loading" : ""}`}
              onClick={completeSale}
              disabled={loading || !selectedHandlerId || (needsTireman && selectedTiremen.length === 0) || cart.length === 0 || paymentSplits.length === 0 || (hasInvoice && !invoiceNumber.trim()) || !saleNotes.trim()}
            >
              {loading ? "Processing…" : "Complete Sale →"}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile floating cart button */}
      <button
        className="pos-mobile-cart-btn"
        onClick={scrollToCart}
        title="Go to cart"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        {cart.length > 0 && (
          <span className="pos-mobile-cart-badge">{cart.length}</span>
        )}
      </button>

      {/* ── Clear Cart Modal ── */}
      {showClearCartModal && (
        <div className="confirm-overlay" onClick={e => e.target === e.currentTarget && setShowClearCartModal(false)} style={{ zIndex: 9999 }}>
          <div className="confirm-box" style={{ maxWidth: 400 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div className="confirm-title" style={{ marginBottom: 0, color: 'var(--th-rose)' }}>
                Clear Cart
              </div>
              <button className="pos-modal-close" onClick={() => setShowClearCartModal(false)} style={{ background: 'none', border: 'none', color: 'var(--th-text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div className="confirm-details" style={{ borderLeft: '3px solid var(--th-rose)', paddingLeft: '1rem', marginBottom: '1.5rem' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--th-text-body)' }}>
                Are you sure you want to clear all items from the cart? This action cannot be undone.
              </p>
            </div>
            <div className="confirm-actions" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="confirm-btn-cancel" onClick={() => setShowClearCartModal(false)}>Cancel</button>
              <button
                className="pos-complete-btn"
                style={{ width: 'auto', background: 'var(--th-rose)', padding: '0.5rem 1rem' }}
                onClick={() => { clearCart(); setShowClearCartModal(false); }}
              >
                ✕ Confirm Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default POSPage
