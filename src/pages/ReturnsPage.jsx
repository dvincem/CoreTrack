import '../pages_css/ReturnsPage.css';
import React, { useState, useEffect, useCallback } from "react";
import { API_URL, apiFetch } from "../lib/config";
import Pagination from '../components/Pagination'

/* ─── CSS ──────────────────────────────────────────────────────────────────── */
;


/* ─── Helpers ──────────────────────────────────────────────────────────────── */
const currency = (v) =>
  "₱" + parseFloat(v || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (dt) => {
  if (!dt) return "—";
  const d = new Date(dt);
  return d.toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
};

const TYPE_LABELS = {
  CUSTOMER_RETURN: "Customer Return",
  SUPPLIER_RETURN: "Supplier Return",
  SUPPLIER_REPLACEMENT: "Replacement In",
};

const SCENARIO_META = {
  FULL_REFUND:            { label: "Full Return & Refund",         icon: "↩", color: "orange", desc: "Item unused, accepted back in full. Restocked immediately, refund issued.", tag: "Restock + Refund" },
  DEFECTIVE_REPLACE_NOW:  { label: "Defective → Replace Now",      icon: "🔧", color: "sky",    desc: "Defective after use. Replace immediately from current stock.", tag: "Immediate Swap" },
  DEFECTIVE_REPLACE_LATER:{ label: "Defective → Replace Later",    icon: "⏳", color: "violet", desc: "Defective, no stock available now. Log and fulfill when stock arrives.", tag: "Pending" },
  WARRANTY_CLAIM:         { label: "Warranty Claim",               icon: "📋", color: "amber",  desc: "Send to supplier for testing. Await result: Covered / Not Covered.", tag: "Supplier Testing" },
};

const STATUS_BADGE = {
  PROCESSED:           "ret-badge-green",
  PENDING:             "ret-badge-orange",
  REPLACEMENT_PENDING: "ret-badge-sky",
  WARRANTY_PENDING:    "ret-badge-orange",
  READY_FOR_PICKUP:    "ret-badge-violet",
  RESOLVED:            "ret-badge-slate",
  COMPLETED:           "ret-badge-green",
  CANCELLED:           "ret-badge-rose",
};

const STATUS_LABEL = {
  PROCESSED:           "Processed",
  PENDING:             "Pending",
  REPLACEMENT_PENDING: "Awaiting Replacement",
  WARRANTY_PENDING:    "Warranty Testing",
  READY_FOR_PICKUP:    "Ready for Pickup",
  RESOLVED:            "Resolved",
  COMPLETED:           "Completed",
  CANCELLED:           "Cancelled",
};

const CUST_REASONS = ["DEFECTIVE", "UNUSED_RETURN", "WRONG_SIZE", "WRONG_ITEM", "DAMAGED_IN_SERVICE", "CUSTOMER_DISSATISFIED", "OTHER"];
const SUPP_REASONS = ["WARRANTY", "WRONG_ITEM", "DEFECTIVE", "OVERSHIPMENT", "OTHER"];
const REFUND_METHODS = ["CASH", "CARD", "STORE_CREDIT", "EXCHANGE"];

/* ─── Component ────────────────────────────────────────────────────────────── */
export default function ReturnsPage({ shopId, isShopClosed, businessDate }) {
  const TODAY = businessDate || new Date().toISOString().split('T')[0];
  const [tab, setTab] = useState("customer");

  /* ── ID lists for autocomplete ──────────────────────────────────── */
  const [saleIds, setSaleIds] = useState([]);
  const [orderIds, setOrderIds] = useState([]);

  /* ── Customer return state ──────────────────────────────────────── */
  const [custQuery, setCustQuery] = useState("");
  const [custSuggestions, setCustSuggestions] = useState([]);
  const [showCustSugs, setShowCustSugs] = useState(false);
  const [custSearching, setCustSearching] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [saleItems, setSaleItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [custChecked, setCustChecked] = useState({}); // sale_item_id → { checked, qty }
  const [custReason, setCustReason] = useState("DEFECTIVE");
  const [custNotes, setCustNotes] = useState("");
  const [custSubmitting, setCustSubmitting] = useState(false);
  const [custError, setCustError] = useState("");
  const [custSuccess, setCustSuccess] = useState("");
  // Scenario
  const [returnScenario, setReturnScenario] = useState("");
  const [refundMethod, setRefundMethod] = useState("CASH");
  // Replace Now — auto stock check per checked item
  const [replStockQuery, setReplStockQuery] = useState("");
  const [replStockResults, setReplStockResults] = useState([]);
  const [replStockSearching, setReplStockSearching] = useState(false);
  const [selectedReplItem, setSelectedReplItem] = useState(null);
  const [autoStockCheck, setAutoStockCheck] = useState({}); // item_id → { on_hand, item_name, sku, ... }
  const [autoStockLoading, setAutoStockLoading] = useState(false);
  // Warranty
  const [warrantyRef, setWarrantyRef] = useState("");
  const [warrantySentAt, setWarrantySentAt] = useState("");
  // History actions
  const [warrantyModal, setWarrantyModal] = useState(null);
  const [warrantyResult, setWarrantyResult] = useState("COVERED");
  const [warrantyNotes, setWarrantyNotes] = useState("");
  const [warrantySubmitting, setWarrantySubmitting] = useState(false);
  const [fulfillModal, setFulfillModal] = useState(null);
  const [fulfillMode, setFulfillMode] = useState("from_stock"); // 'from_stock' | 'new_delivery'
  const [fulfillDr, setFulfillDr] = useState("");
  const [fulfillDot, setFulfillDot] = useState("");
  const [fulfillStockInfo, setFulfillStockInfo] = useState(null); // { on_hand }
  const [fulfillStockLoading, setFulfillStockLoading] = useState(false);
  const [fulfillSubmitting, setFulfillSubmitting] = useState(false);

  /* ── Supplier return state ──────────────────────────────────────── */
  const [suppQuery, setSuppQuery] = useState("");
  const [suppSuggestions, setSuppSuggestions] = useState([]);
  const [showSuppSugs, setShowSuppSugs] = useState(false);
  const [suppSearching, setSuppSearching] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [orderItemsLoading, setOrderItemsLoading] = useState(false);
  const [selectedOrderItem, setSelectedOrderItem] = useState(null);
  const [suppQty, setSuppQty] = useState(1);
  const [suppReason, setSuppReason] = useState("WARRANTY");
  const [suppNotes, setSuppNotes] = useState("");
  const [expectReplacement, setExpectReplacement] = useState(false);
  const [suppSubmitting, setSuppSubmitting] = useState(false);
  const [suppError, setSuppError] = useState("");
  const [suppSuccess, setSuppSuccess] = useState("");

  /* ── History state ──────────────────────────────────────────────── */
  const [histReturns, setHistReturns] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histFilter, setHistFilter] = useState({ type: "", status: "" });
  const [histPage, setHistPage] = useState(1);
  const HIST_PAGE_SIZE = 10;
  const [replModal, setReplModal] = useState(null);
  const [replDot, setReplDot] = useState("");
  const [replDr, setReplDr] = useState("");
  const [replSubmitting, setReplSubmitting] = useState(false);
  const [replError, setReplError] = useState("");
  const [pendingCustReturn, setPendingCustReturn] = useState(null);
  const [pendingSuppReturn, setPendingSuppReturn] = useState(null);

  /* ── Load history on tab change ─────────────────────────────────── */
  const loadHistory = useCallback(() => {
    setHistLoading(true);
    const params = new URLSearchParams();
    if (histFilter.type) params.set("type", histFilter.type);
    if (histFilter.status) params.set("status", histFilter.status);
    apiFetch(`${API_URL}/returns/${shopId}?${params}`)
      .then((r) => r.json())
      .then((d) => { setHistReturns(Array.isArray(d) ? d : []); setHistLoading(false); setHistPage(1); })
      .catch(() => setHistLoading(false));
  }, [shopId, histFilter]);

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, loadHistory]);

  /* ── Load sale IDs and order IDs on mount ───────────────────────── */
  useEffect(() => {
    apiFetch(`${API_URL}/returns/${shopId}/sale-ids`)
      .then(r => r.json()).then(d => setSaleIds(Array.isArray(d) ? d : [])).catch(() => {});
    apiFetch(`${API_URL}/returns/${shopId}/order-ids`)
      .then(r => r.json()).then(d => setOrderIds(Array.isArray(d) ? d : [])).catch(() => {});
  }, [shopId]);

  /* ── Customer: autocomplete from loaded sale IDs ────────────────── */
  useEffect(() => {
    if (!custQuery.trim() || selectedSale) { setCustSuggestions([]); setShowCustSugs(false); return; }
    const q = custQuery.toLowerCase();
    const matches = saleIds.filter(s =>
      (s.sale_id || "").toLowerCase().includes(q) ||
      (s.invoice_number || "").toLowerCase().includes(q)
    ).slice(0, 10);
    setCustSuggestions(matches);
    setShowCustSugs(matches.length > 0);
  }, [custQuery, saleIds, selectedSale]);

  const selectSale = (sale) => {
    setSelectedSale(sale);
    setCustSuggestions([]); setShowCustSugs(false);
    setCustQuery(sale.invoice_number || sale.sale_id);
    setCustChecked({});
    setCustError("");
    setCustSuccess("");
    setItemsLoading(true);
    apiFetch(`${API_URL}/returns/sale/${sale.sale_id}/items`)
      .then((r) => r.json())
      .then((d) => { setSaleItems(Array.isArray(d) ? d : []); setItemsLoading(false); })
      .catch(() => setItemsLoading(false));
  };

  const toggleCustItem = (si) => {
    setCustChecked((prev) => {
      const cur = prev[si.sale_item_id];
      if (cur?.checked) {
        const n = { ...prev };
        delete n[si.sale_item_id];
        return n;
      }
      return { ...prev, [si.sale_item_id]: { checked: true, qty: si.returnable_qty, item: si } };
    });
  };

  const submitCustomerReturn = () => {
    const toReturn = Object.values(custChecked).filter((c) => c.checked && c.qty > 0);
    if (!toReturn.length) { setCustError("Select at least one item to return."); return; }
    if (!returnScenario) { setCustError("Select a return scenario."); return; }
    if (returnScenario === "DEFECTIVE_REPLACE_NOW") {
      const checkedItems = toReturn.map(c => c.item);
      const outOfStock = checkedItems.filter(item => (autoStockCheck[item.item_id]?.on_hand || 0) < (custChecked[item.sale_item_id]?.qty || 1));
      if (outOfStock.length > 0) { setCustError(`Cannot proceed — ${outOfStock.map(i => i.item_name).join(", ")} ${outOfStock.length > 1 ? "are" : "is"} out of stock.`); return; }
    }
    setCustError("");
    const items = toReturn.map((c) => ({
      sale_item_id: c.item.sale_item_id,
      item_id: c.item.item_id,
      item_name: c.item.item_name,
      quantity: parseFloat(c.qty),
      unit_price: c.item.unit_price,
      original_sale_id: selectedSale.sale_id,
    }));
    setPendingCustReturn({
      items, reason: custReason, notes: custNotes, saleName: selectedSale.sale_id,
      return_scenario: returnScenario, refund_method: refundMethod,
      // For DEFECTIVE_REPLACE_NOW the replacement is the same item from stock (1:1 swap)
      replacement_item_id: returnScenario === "DEFECTIVE_REPLACE_NOW" ? toReturn[0]?.item.item_id : selectedReplItem?.item_id,
      replacement_qty: toReturn.reduce((s, c) => s + parseFloat(c.qty), 0),
      warranty_ref: warrantyRef, warranty_sent_at: warrantySentAt,
      customer_name: selectedSale.customer_name,
    });
  };

  const confirmCustomerReturn = async () => {
    const fd = pendingCustReturn;
    setPendingCustReturn(null);
    setCustSubmitting(true);
    try {
      const r = await apiFetch(`${API_URL}/returns/customer`, {
        method: "POST",
        body: JSON.stringify({
          shop_id: shopId, items: fd.items, reason: fd.reason, notes: fd.notes,
          return_scenario: fd.return_scenario, refund_method: fd.refund_method,
          replacement_item_id: fd.replacement_item_id, replacement_qty: fd.replacement_qty,
          warranty_ref: fd.warranty_ref, warranty_sent_at: fd.warranty_sent_at,
          customer_name: fd.customer_name,
        }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setCustSuccess(d.message || "Return processed successfully.");
      setCustChecked({}); setCustQuery(""); setSelectedSale(null); setSaleItems([]);
      setCustNotes(""); setReturnScenario(""); setRefundMethod("CASH");
      setSelectedReplItem(null); setReplStockQuery(""); setWarrantyRef(""); setWarrantySentAt("");
    } catch (e) {
      setCustError(e.message);
    } finally {
      setCustSubmitting(false);
    }
  };

  /* ── Warranty result modal ──────────────────────────────────────── */
  const submitWarrantyResult = async () => {
    setWarrantySubmitting(true);
    try {
      const r = await apiFetch(`${API_URL}/returns/${warrantyModal.return_id}/warranty-result`, {
        method: "POST",
        body: JSON.stringify({ warranty_result: warrantyResult, notes: warrantyNotes }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setWarrantyModal(null); setWarrantyNotes("");
      loadHistory();
    } catch (e) {
      alert(e.message);
    } finally {
      setWarrantySubmitting(false);
    }
  };

  /* ── Complete handover (reserved replacement → customer claims) ── */
  const submitHandover = async (ret) => {
    if (!window.confirm(`Confirm handover of replacement for ${ret.item_name} to ${ret.customer_name || "customer"}?`)) return;
    try {
      const r = await apiFetch(`${API_URL}/returns/${ret.return_id}/complete-handover`, { method: "POST", body: JSON.stringify({}) });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      loadHistory();
    } catch (e) {
      alert(e.message);
    }
  };

  /* ── Fulfill pending replacement ────────────────────────────────── */
  const submitFulfillReplacement = async () => {
    setFulfillSubmitting(true);
    try {
      const r = await apiFetch(`${API_URL}/returns/${fulfillModal.return_id}/fulfill-replacement`, {
        method: "POST",
        body: JSON.stringify({
          mode: fulfillMode,
          dr_number: fulfillDr.trim() || null,
          dot_number: fulfillDot.trim() || null,
        }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setFulfillModal(null); setSelectedReplItem(null); setReplStockQuery("");
      setFulfillDr(""); setFulfillDot(""); setFulfillMode("from_stock");
      loadHistory();
    } catch (e) {
      alert(e.message);
    } finally {
      setFulfillSubmitting(false);
    }
  };

  /* ── Fulfill modal: auto stock check on open ───────────────────── */
  useEffect(() => {
    if (!fulfillModal || fulfillMode !== "from_stock") { setFulfillStockInfo(null); return; }
    setFulfillStockLoading(true);
    apiFetch(`${API_URL}/returns/${fulfillModal.shop_id || shopId}/stock-check/${encodeURIComponent(fulfillModal.item_id)}`)
      .then(r => r.json())
      .then(d => { setFulfillStockInfo(d); setFulfillStockLoading(false); })
      .catch(() => { setFulfillStockInfo(null); setFulfillStockLoading(false); });
  }, [fulfillModal, fulfillMode, shopId]);

  /* ── Replace Now: auto stock check when scenario selected ─────── */
  useEffect(() => {
    if (returnScenario !== "DEFECTIVE_REPLACE_NOW") { setAutoStockCheck({}); return; }
    const checkedItems = Object.values(custChecked).filter(c => c.checked && c.item?.item_id);
    if (checkedItems.length === 0) return;
    setAutoStockLoading(true);
    setAutoStockCheck({});
    Promise.all(
      checkedItems.map(c =>
        apiFetch(`${API_URL}/returns/${shopId}/stock-check/${encodeURIComponent(c.item.item_id)}`)
          .then(r => r.json())
          .then(d => ({ item_id: c.item.item_id, ...d }))
          .catch(() => ({ item_id: c.item.item_id, on_hand: 0 }))
      )
    ).then(results => {
      const map = {};
      results.forEach(r => { map[r.item_id] = r; });
      setAutoStockCheck(map);
      setAutoStockLoading(false);
    });
  }, [returnScenario, custChecked, shopId]);

  /* ── Replace Now: manual stock search (fulfill modal / fallback) ─ */
  useEffect(() => {
    if (replStockQuery.length < 1) { setReplStockResults([]); return; }
    const t = setTimeout(() => {
      setReplStockSearching(true);
      apiFetch(`${API_URL}/returns/${shopId}/stock-search?q=${encodeURIComponent(replStockQuery)}`)
        .then(r => r.json())
        .then(d => { setReplStockResults(Array.isArray(d) ? d : []); setReplStockSearching(false); })
        .catch(() => setReplStockSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [replStockQuery, shopId]);

  /* ── Supplier: autocomplete from loaded order IDs ───────────────── */
  useEffect(() => {
    if (!suppQuery.trim() || selectedOrder) { setSuppSuggestions([]); setShowSuppSugs(false); return; }
    const q = suppQuery.toLowerCase();
    const matches = orderIds.filter(o =>
      (o.order_id || "").toLowerCase().includes(q)
    ).slice(0, 10);
    setSuppSuggestions(matches);
    setShowSuppSugs(matches.length > 0);
  }, [suppQuery, orderIds, selectedOrder]);

  const selectOrder = (order) => {
    setSelectedOrder(order);
    setSuppSuggestions([]); setShowSuppSugs(false);
    setSuppQuery(order.order_id);
    setSelectedOrderItem(null);
    setSuppError("");
    setSuppSuccess("");
    setOrderItemsLoading(true);
    apiFetch(`${API_URL}/returns/order/${order.order_id}/items`)
      .then((r) => r.json())
      .then((d) => { setOrderItems(Array.isArray(d) ? d : []); setOrderItemsLoading(false); })
      .catch(() => setOrderItemsLoading(false));
  };

  const submitSupplierReturn = () => {
    if (!selectedOrderItem) { setSuppError("Select an item to return."); return; }
    if (!suppQty || suppQty <= 0) { setSuppError("Quantity must be greater than 0."); return; }
    if (suppQty > selectedOrderItem.returnable_qty) {
      setSuppError(`Max returnable quantity is ${selectedOrderItem.returnable_qty}.`);
      return;
    }
    setSuppError("");
    setPendingSuppReturn({
      item_id: selectedOrderItem.item_id,
      itemName: selectedOrderItem.item_name || selectedOrderItem.item_id,
      quantity: parseFloat(suppQty),
      unit_cost: selectedOrderItem.unit_cost,
      supplier_id: selectedOrderItem.supplier_id,
      reason: suppReason,
      notes: suppNotes,
      original_order_id: selectedOrder.order_id,
      original_order_item_id: selectedOrderItem.order_item_id,
      expect_replacement: expectReplacement,
    });
  };

  const confirmSupplierReturn = async () => {
    const fd = pendingSuppReturn;
    setPendingSuppReturn(null);
    setSuppSubmitting(true);
    try {
      const r = await apiFetch(`${API_URL}/returns/supplier`, {
        method: "POST",
        body: JSON.stringify({
          shop_id: shopId,
          item_id: fd.item_id,
          quantity: fd.quantity,
          unit_cost: fd.unit_cost,
          supplier_id: fd.supplier_id,
          reason: fd.reason,
          notes: fd.notes,
          original_order_id: fd.original_order_id,
          original_order_item_id: fd.original_order_item_id,
          expect_replacement: fd.expect_replacement,
        }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setSuppSuccess(d.message || "Supplier return processed.");
      setSuppQuery("");
      setSelectedOrder(null);
      setOrderItems([]);
      setSelectedOrderItem(null);
      setSuppQty(1);
      setSuppNotes("");
      setExpectReplacement(false);
    } catch (e) {
      setSuppError(e.message);
    } finally {
      setSuppSubmitting(false);
    }
  };

  /* ── Replacement modal ──────────────────────────────────────────── */
  const openReplModal = (ret) => {
    setReplModal(ret);
    setReplDot("");
    setReplDr("");
    setReplError("");
  };

  const submitReplacement = async () => {
    const isTire = /^(PCR|SUV|LT|TBR|OTR|MC)/i.test(replModal.sku || "");
    if (!replDr.trim()) { setReplError("DR number is required."); return; }
    if (isTire && !replDot.trim()) { setReplError("DOT number is required for tire items."); return; }
    if (isTire && !/^\d{4}$/.test(replDot.trim())) { setReplError("DOT number must be exactly 4 digits."); return; }
    setReplSubmitting(true);
    setReplError("");
    try {
      const r = await apiFetch(`${API_URL}/returns/${replModal.return_id}/receive-replacement`, {
        method: "POST",
        body: JSON.stringify({ quantity: replModal.quantity, dot_number: replDot.trim() || null, dr_number: replDr.trim() }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setReplModal(null);
      loadHistory();
    } catch (e) {
      setReplError(e.message);
    } finally {
      setReplSubmitting(false);
    }
  };

  /* ─── Render ──────────────────────────────────────────────────────────────── */

  const checkedCount = Object.values(custChecked).filter((c) => c.checked).length;

  return (
    <>
      <style>{`
        .ret-page {
            font-family: 'Inter', sans-serif;
            display: flex;
            flex-direction: column;
            gap: .5rem;
        }
      `}</style>
      <div className="ret-page">
      {/* Header */}
      <div className="ret-header">
        <div>
          <div className="ret-title">
            Returns &amp; <span>Adjustments</span>
            {isShopClosed && (
              <div className="pos-closed-badge" style={{ marginLeft: '1rem', display: 'inline-flex', verticalAlign: 'middle' }}>
                <span className="pulse"></span>
                NEXT DAY MODE
              </div>
            )}
          </div>
          <div className="ret-subtitle">Customer returns · Supplier returns · Replacements — all movements are traced as linked transactions</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="ret-tabs">
        {[
          { id: "customer", label: "↩ Customer Return" },
          { id: "supplier", label: "↪ Supplier Return" },
          { id: "history", label: "≡ History" },
        ].map((t) => (
          <button
            key={t.id}
            className={`ret-tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CUSTOMER RETURN TAB ───────────────────────────────────────── */}
      {tab === "customer" && (
        <div className="ret-panel">
          {custSuccess && (
            <div className="ret-success">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              {custSuccess}
              <button
                style={{ marginLeft: "auto", background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "1rem" }}
                onClick={() => setCustSuccess("")}
              >✕</button>
            </div>
          )}

          {/* Step 1 — Find sale */}
          <div className="ret-card">
            <div className="ret-card-title">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Step 1 — Find the Sale
            </div>
            <label className="ret-label">Search by Sale ID or Invoice #</label>
            <div className="ret-search-wrap">
              <input
                className="ret-input"
                style={{ paddingRight: custQuery ? "2rem" : undefined }}
                placeholder="e.g. SAL-00123, INV-0042…"
                value={custQuery}
                onChange={(e) => { setCustQuery(e.target.value); setSelectedSale(null); setSaleItems([]); setCustChecked({}); }}
                onFocus={() => custQuery && !selectedSale && setShowCustSugs(custSuggestions.length > 0)}
                onBlur={() => setTimeout(() => setShowCustSugs(false), 180)}
                autoComplete="off"
              />
              {custQuery && (
                <button className="ret-search-clear" onClick={() => { setCustQuery(""); setSelectedSale(null); setSaleItems([]); setCustChecked({}); }}>×</button>
              )}
              {showCustSugs && custSuggestions.length > 0 && (
                <div className="ret-suggestions">
                  {custSuggestions.map((s) => (
                    <button key={s.sale_id} className="ret-sug-item" onMouseDown={() => selectSale(s)}>
                      <span className="ret-sug-id">{s.sale_id}</span>
                      {s.invoice_number && <span style={{ fontSize: "0.8rem", color: "var(--th-text-muted)" }}>{s.invoice_number}</span>}
                      <span className="ret-sug-meta">{s.customer_name || "Walk-in"} · {s.sale_datetime ? new Date(s.sale_datetime).toLocaleDateString("en-PH") : ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedSale && (
              <div style={{ marginTop: "0.65rem", display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.5rem 0.8rem", background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.25)", borderRadius: 7 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--th-orange)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span style={{ fontSize: "0.88rem", color: "var(--th-text-primary)", fontWeight: 600 }}>
                  {selectedSale.invoice_number || selectedSale.sale_id}
                </span>
                <span style={{ fontSize: "0.78rem", color: "var(--th-text-muted)" }}>
                  {selectedSale.customer_name || "Walk-in"} · {fmtDate(selectedSale.sale_datetime)}
                </span>
                <button
                  style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--th-text-dim)", fontSize: "0.95rem" }}
                  onClick={() => { setSelectedSale(null); setSaleItems([]); setCustChecked({}); setCustQuery(""); }}
                >✕</button>
              </div>
            )}
          </div>

          {/* Step 2 — Select items */}
          {selectedSale && (
            <div className="ret-card">
              <div className="ret-card-title">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                Step 2 — Select Items to Return
              </div>
              {itemsLoading && <div style={{ fontSize: "0.82rem", color: "var(--th-text-dim)" }}>Loading items…</div>}
              {!itemsLoading && saleItems.length === 0 && (
                <div className="ret-empty">
                  <div className="ret-empty-text">No returnable items found for this sale.</div>
                </div>
              )}
              {saleItems.map((si) => {
                const state = custChecked[si.sale_item_id];
                return (
                  <div key={si.sale_item_id} className={`ret-item-row${state?.checked ? " checked" : ""}`}>
                    <input
                      type="checkbox"
                      className="ret-item-check"
                      checked={!!state?.checked}
                      onChange={() => toggleCustItem(si)}
                    />
                    <div className="ret-item-info">
                      <div className="ret-item-name">{si.item_name}</div>
                      <div className="ret-item-meta">
                        {si.sku && <span>{si.sku} · </span>}
                        Sold qty: {si.quantity}
                        {si.already_returned > 0 && <span style={{ color: "var(--th-rose)" }}> · Already returned: {si.already_returned}</span>}
                        {" · "}Returnable: <strong>{si.returnable_qty}</strong>
                        {" · "}{currency(si.unit_price)} each
                      </div>
                    </div>
                    {state?.checked && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexShrink: 0 }}>
                        <label className="ret-label" style={{ margin: 0 }}>Qty</label>
                        <input
                          className="ret-item-qty-input"
                          type="number"
                          min="1"
                          max={si.returnable_qty}
                          value={state.qty}
                          onChange={(e) => {
                            const v = Math.min(parseFloat(e.target.value) || 1, si.returnable_qty);
                            setCustChecked((prev) => ({ ...prev, [si.sale_item_id]: { ...prev[si.sale_item_id], qty: v } }));
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Step 3 — Reason & Scenario */}
          {selectedSale && saleItems.length > 0 && (
            <div className="ret-card">
              <div className="ret-card-title">Step 3 — Reason &amp; Return Type</div>
              <div className="ret-form-row" style={{ marginBottom: "0.85rem" }}>
                <div className="ret-form-field">
                  <label className="ret-label">Return Reason <span style={{ color: "#38bdf8" }}>*</span></label>
                  <select className="ret-select" value={custReason} onChange={(e) => setCustReason(e.target.value)}>
                    {CUST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="ret-form-field">
                  <label className="ret-label">Notes (optional)</label>
                  <input className="ret-input" placeholder="e.g. Customer complaint details…" value={custNotes} onChange={(e) => setCustNotes(e.target.value)} />
                </div>
              </div>

              <label className="ret-label" style={{ marginBottom: "0.55rem" }}>How are we handling this? <span style={{ color: "var(--th-rose)" }}>*</span></label>
              <div className="ret-scenario-grid">
                {Object.entries(SCENARIO_META).map(([key, meta]) => {
                  const colorMap = { orange: "selected", sky: "sel-sky", violet: "sel-violet", amber: "sel-amber" };
                  const selClass = colorMap[meta.color] || "selected";
                  const tagBg = { orange: "rgba(201,124,80,0.18)", sky: "rgba(56,189,248,0.18)", violet: "rgba(167,139,250,0.18)", amber: "rgba(251,191,36,0.18)" }[meta.color];
                  const tagColor = { orange: "var(--th-orange)", sky: "var(--th-sky)", violet: "var(--th-violet)", amber: "var(--th-amber)" }[meta.color];
                  return (
                    <div
                      key={key}
                      className={`ret-scenario-card${returnScenario === key ? " " + selClass : ""}`}
                      onClick={() => { setReturnScenario(key); setCustError(""); }}
                    >
                      <div className="ret-scenario-icon">{meta.icon}</div>
                      <div className="ret-scenario-name">{meta.label}</div>
                      <div className="ret-scenario-desc">{meta.desc}</div>
                      <span className="ret-scenario-tag" style={{ background: tagBg, color: tagColor }}>{meta.tag}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 4 — Scenario-specific fields */}
          {selectedSale && saleItems.length > 0 && returnScenario && (
            <div className="ret-card">
              <div className="ret-card-title">Step 4 — {SCENARIO_META[returnScenario]?.label} Details</div>

              {returnScenario === "FULL_REFUND" && (
                <div className="ret-form-field" style={{ maxWidth: 260 }}>
                  <label className="ret-label">Refund Method <span style={{ color: "var(--th-rose)" }}>*</span></label>
                  <select className="ret-select" value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}>
                    {REFUND_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <span style={{ fontSize: "0.72rem", color: "var(--th-text-dim)", marginTop: "0.25rem" }}>
                    Item will be restocked and refund issued via selected method.
                  </span>
                </div>
              )}

              {returnScenario === "DEFECTIVE_REPLACE_NOW" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                  {autoStockLoading && (
                    <div style={{ fontSize: "0.82rem", color: "var(--th-text-dim)" }}>Checking stock availability…</div>
                  )}
                  {!autoStockLoading && Object.keys(autoStockCheck).length > 0 && (
                    Object.entries(autoStockCheck).map(([item_id, stock]) => {
                      const checkedEntry = Object.values(custChecked).find(c => c.item?.item_id === item_id);
                      const neededQty = checkedEntry?.qty || 1;
                      const available = (stock.on_hand || 0) >= neededQty;
                      return (
                        <div key={item_id} style={{
                          display: "flex", alignItems: "center", gap: "0.75rem",
                          padding: "0.65rem 0.9rem", borderRadius: 8,
                          border: `1px solid ${available ? "var(--th-emerald)" : "var(--th-rose)"}`,
                          background: available ? "rgba(52,211,153,0.06)" : "rgba(251,113,133,0.06)",
                        }}>
                          <span style={{ fontSize: "1.1rem" }}>{available ? "✅" : "❌"}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: "0.92rem", color: "var(--th-text-primary)" }}>{stock.item_name}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--th-text-muted)", marginTop: "0.1rem" }}>
                              {stock.sku} · In stock: <strong style={{ color: available ? "var(--th-emerald)" : "var(--th-rose)" }}>{stock.on_hand}</strong> · Need: {neededQty}
                            </div>
                          </div>
                          <span style={{
                            fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "0.8rem",
                            textTransform: "uppercase", letterSpacing: "0.04em",
                            padding: "0.15rem 0.55rem", borderRadius: 4,
                            background: available ? "var(--th-emerald-bg)" : "var(--th-rose-bg)",
                            color: available ? "var(--th-emerald)" : "var(--th-rose)",
                          }}>
                            {available ? "Ready to Swap" : "Out of Stock"}
                          </span>
                        </div>
                      );
                    })
                  )}
                  {!autoStockLoading && Object.values(autoStockCheck).some(s => (s.on_hand || 0) === 0) && (
                    <div style={{ fontSize: "0.78rem", color: "var(--th-rose)", padding: "0.4rem 0.6rem", background: "var(--th-rose-bg)", borderRadius: 6 }}>
                      One or more items are out of stock. Choose <strong>Defective → Replace Later</strong> or <strong>Warranty Claim</strong> instead.
                    </div>
                  )}
                  {!autoStockLoading && Object.keys(autoStockCheck).length > 0 && Object.values(autoStockCheck).every(s => (s.on_hand || 0) > 0) && (
                    <div style={{ fontSize: "0.72rem", color: "var(--th-text-dim)" }}>
                      Replacement units will be deducted from current stock. Defective items removed from inventory.
                    </div>
                  )}
                </div>
              )}

              {returnScenario === "DEFECTIVE_REPLACE_LATER" && (
                <div style={{ fontSize: "0.85rem", color: "var(--th-text-muted)", padding: "0.65rem 0.85rem", background: "var(--th-violet-bg)", border: "1px solid var(--th-violet)", borderRadius: 8, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <div><strong style={{ color: "var(--th-violet)" }}>Pending replacement</strong> — no stock deducted now.</div>
                  <div style={{ fontSize: "0.78rem" }}>
                    • The defective item is <strong>not restocked</strong> — it is held out of sellable inventory.<br/>
                    • A supplier return is <strong>auto-created</strong> so you can track sending it back.<br/>
                    • Once the supplier sends a replacement, use <em>Receive Replacement</em> in History to fulfill and restock.
                  </div>
                </div>
              )}

              {returnScenario === "WARRANTY_CLAIM" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                  <div className="ret-form-row">
                    <div className="ret-form-field">
                      <label className="ret-label">Warranty Reference / RMA # (optional)</label>
                      <input className="ret-input" placeholder="e.g. WR-2024-001" value={warrantyRef} onChange={(e) => setWarrantyRef(e.target.value)} />
                    </div>
                    <div className="ret-form-field">
                      <label className="ret-label">Date Sent to Supplier (optional)</label>
                      <input className="ret-input" type="date" value={warrantySentAt} onChange={(e) => setWarrantySentAt(e.target.value)} />
                    </div>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--th-text-dim)" }}>
                    Item will be logged as <strong>WARRANTY_PENDING</strong>. Once you receive the supplier's verdict,
                    use "Record Warranty Result" in History to mark it Covered / Not Covered / Partial.
                  </div>
                </div>
              )}

              {custError && (
                <div className="ret-error" style={{ marginTop: "0.65rem" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {custError}
                </div>
              )}

              <div style={{ marginTop: "0.85rem", display: "flex", gap: "0.5rem" }}>
                <button
                  className="ret-btn ret-btn-emerald"
                  disabled={custSubmitting || checkedCount === 0 || autoStockLoading ||
                    (returnScenario === "DEFECTIVE_REPLACE_NOW" && Object.values(autoStockCheck).some(s => (s.on_hand || 0) === 0))}
                  onClick={submitCustomerReturn}
                  style={{ flex: 1 }}
                >
                  {custSubmitting ? "Processing…" : `↩ Process Return${checkedCount > 0 ? ` (${checkedCount} item${checkedCount > 1 ? "s" : ""})` : ""}`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SUPPLIER RETURN TAB ───────────────────────────────────────── */}
      {tab === "supplier" && (
        <div className="ret-panel">
          {suppSuccess && (
            <div className="ret-success">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              {suppSuccess}
              <button
                style={{ marginLeft: "auto", background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "1rem" }}
                onClick={() => setSuppSuccess("")}
              >✕</button>
            </div>
          )}

          {/* Step 1 — Find order */}
          <div className="ret-card">
            <div className="ret-card-title">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Step 1 — Find the Purchase Order
            </div>
            <label className="ret-label">Search by Order ID (RECEIVED orders only)</label>
            <div className="ret-search-wrap">
              <input
                className="ret-input"
                style={{ paddingRight: suppQuery ? "2rem" : undefined }}
                placeholder="e.g. ORD-1234567890…"
                value={suppQuery}
                onChange={(e) => { setSuppQuery(e.target.value); setSelectedOrder(null); setOrderItems([]); setSelectedOrderItem(null); }}
                onFocus={() => suppQuery && !selectedOrder && setShowSuppSugs(suppSuggestions.length > 0)}
                onBlur={() => setTimeout(() => setShowSuppSugs(false), 180)}
                autoComplete="off"
              />
              {suppQuery && (
                <button className="ret-search-clear" onClick={() => { setSuppQuery(""); setSelectedOrder(null); setOrderItems([]); setSelectedOrderItem(null); }}>×</button>
              )}
              {showSuppSugs && suppSuggestions.length > 0 && (
                <div className="ret-suggestions">
                  {suppSuggestions.map((o) => (
                    <button key={o.order_id} className="ret-sug-item" onMouseDown={() => selectOrder(o)}>
                      <span className="ret-sug-id">{o.order_id}</span>
                      <span className="ret-sug-meta">{o.received_at ? "Received " + new Date(o.received_at).toLocaleDateString("en-PH") : ""} · {currency(o.total_amount)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedOrder && (
              <div style={{ marginTop: "0.65rem", display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.5rem 0.8rem", background: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 7 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span style={{ fontSize: "0.88rem", color: "var(--th-text-primary)", fontWeight: 600 }}>{selectedOrder.order_id}</span>
                <span style={{ fontSize: "0.78rem", color: "var(--th-text-muted)" }}>Received {fmtDate(selectedOrder.received_at)}</span>
                <button
                  style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--th-text-dim)", fontSize: "0.95rem" }}
                  onClick={() => { setSelectedOrder(null); setOrderItems([]); setSelectedOrderItem(null); setSuppQuery(""); }}
                >✕</button>
              </div>
            )}
          </div>

          {/* Step 2 — Select item */}
          {selectedOrder && (
            <div className="ret-card">
              <div className="ret-card-title">Step 2 — Select Item to Return</div>
              {orderItemsLoading && <div style={{ fontSize: "0.82rem", color: "var(--th-text-dim)" }}>Loading items…</div>}
              {!orderItemsLoading && orderItems.length === 0 && (
                <div className="ret-empty"><div className="ret-empty-text">No returnable items in this order.</div></div>
              )}
              <div className="ret-search-results">
                {orderItems.map((oi) => (
                  <div
                    key={oi.order_item_id}
                    className={`ret-supp-item-row${selectedOrderItem?.order_item_id === oi.order_item_id ? " selected" : ""}`}
                    onClick={() => { setSelectedOrderItem(oi); setSuppQty(1); setSuppError(""); }}
                  >
                    <input
                      type="radio"
                      style={{ accentColor: "#38bdf8", flexShrink: 0 }}
                      checked={selectedOrderItem?.order_item_id === oi.order_item_id}
                      onChange={() => {}}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="ret-item-name">{oi.item_name}</div>
                      <div className="ret-item-meta">
                        {oi.sku} · {oi.supplier_name || "No supplier"} · Purchased qty: {oi.quantity}
                        {oi.already_returned > 0 && <span style={{ color: "var(--th-rose)" }}> · Returned: {oi.already_returned}</span>}
                        {" · "}Returnable: <strong>{oi.returnable_qty}</strong>
                        {" · "}{currency(oi.unit_cost)} cost
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 — Details & Submit */}
          {selectedOrderItem && (
            <div className="ret-card">
              <div className="ret-card-title">Step 3 — Return Details</div>
              <div className="ret-form-row" style={{ marginBottom: "0.65rem" }}>
                <div className="ret-form-field">
                  <label className="ret-label">Quantity to Return <span style={{ color: "#38bdf8" }}>*</span></label>
                  <input
                    className="ret-input"
                    type="number"
                    min="1"
                    max={selectedOrderItem.returnable_qty}
                    value={suppQty}
                    onChange={(e) => setSuppQty(e.target.value)}
                  />
                  <span style={{ fontSize: "0.72rem", color: "var(--th-text-dim)", marginTop: "0.2rem" }}>
                    Max: {selectedOrderItem.returnable_qty}
                  </span>
                </div>
                <div className="ret-form-field">
                  <label className="ret-label">Reason <span style={{ color: "#38bdf8" }}>*</span></label>
                  <select className="ret-select" value={suppReason} onChange={(e) => setSuppReason(e.target.value)}>
                    {SUPP_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="ret-form-field" style={{ marginBottom: "0.65rem" }}>
                <label className="ret-label">Notes (optional)</label>
                <input className="ret-input" placeholder="e.g. Warranty claim #, PO reference…" value={suppNotes} onChange={(e) => setSuppNotes(e.target.value)} />
              </div>

              <label className="ret-checkbox-row">
                <input
                  type="checkbox"
                  checked={expectReplacement}
                  onChange={(e) => setExpectReplacement(e.target.checked)}
                />
                Expecting a replacement from supplier
              </label>
              {expectReplacement && (
                <div style={{ fontSize: "0.78rem", color: "#38bdf8", marginTop: "0.25rem", marginLeft: "1.3rem" }}>
                  Return will be marked <strong>REPLACEMENT PENDING</strong> until you receive the replacement in History.
                </div>
              )}

              {suppError && (
                <div className="ret-error" style={{ marginTop: "0.5rem" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {suppError}
                </div>
              )}

              <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
                <button
                  className="ret-btn ret-btn-sky"
                  disabled={suppSubmitting}
                  onClick={submitSupplierReturn}
                  style={{ flex: 1 }}
                >
                  {suppSubmitting ? "Processing…" : "↪ Process Supplier Return"}
                </button>
              </div>
              <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--th-text-dim)" }}>
                Item will be removed from inventory as a <strong>SUPPLIER_RETURN</strong> transaction linked to the original purchase order.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ───────────────────────────────────────────────── */}
      {tab === "history" && (
        <div className="ret-panel">
          <div className="ret-filters">
            <select
              className="ret-filter-select"
              value={histFilter.type}
              onChange={(e) => setHistFilter((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="">All Types</option>
              <option value="CUSTOMER_RETURN">Customer Returns</option>
              <option value="SUPPLIER_RETURN">Supplier Returns</option>
              <option value="SUPPLIER_REPLACEMENT">Replacements In</option>
            </select>
            <select
              className="ret-filter-select"
              value={histFilter.status}
              onChange={(e) => setHistFilter((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">All Statuses</option>
              <option value="PROCESSED">Processed</option>
              <option value="PENDING">Pending</option>
              <option value="REPLACEMENT_PENDING">Replacement Pending</option>
              <option value="WARRANTY_PENDING">Warranty Testing</option>
              <option value="READY_FOR_PICKUP">Ready for Pickup</option>
              <option value="COMPLETED">Completed</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <button className="ret-btn ret-btn-slate ret-btn-sm" onClick={loadHistory}>↺ Refresh</button>
          </div>

          <div className="ret-card" style={{ padding: 0 }}>
            {histLoading ? (
              <div className="ret-empty"><div className="ret-empty-text">Loading…</div></div>
            ) : histReturns.length === 0 ? (
              <div className="ret-empty">
                <svg className="ret-empty-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4.98" />
                </svg>
                <div className="ret-empty-title">No Returns</div>
                <div className="ret-empty-text">No returns found</div>
              </div>
            ) : (
              <div>
              <div className="ret-table-wrap">
                <table className="ret-table">
                  <thead>
                    <tr>
                      <th>Return ID</th>
                      <th>Type / Scenario</th>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Linked To</th>
                      <th>Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Build map: customer return id → linked auto supplier return
                      const autoSuppMap = {};
                      histReturns.forEach(r => {
                        if (r.return_type === "SUPPLIER_RETURN" && r.replacement_return_id?.startsWith("RET-CUST")) {
                          autoSuppMap[r.replacement_return_id] = r;
                        }
                      });
                      // Skip auto-created supplier return rows (they merge into the customer row)
                      const autoSuppIds = new Set(Object.values(autoSuppMap).map(r => r.return_id));

                      return histReturns
                        .filter(r => !autoSuppIds.has(r.return_id))
                        .slice((histPage - 1) * HIST_PAGE_SIZE, histPage * HIST_PAGE_SIZE)
                        .map((r) => {
                          const linkedSupp = autoSuppMap[r.return_id]; // auto supplier return linked to this customer return
                          return (
                            <tr key={r.return_id}>
                              <td>
                                <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "0.85rem" }}>
                                  {r.return_id}
                                </span>
                              </td>
                              <td>
                                <span className={`ret-badge ${r.return_type === "CUSTOMER_RETURN" ? "ret-badge-orange" : r.return_type === "SUPPLIER_REPLACEMENT" ? "ret-badge-green" : "ret-badge-sky"}`}>
                                  {TYPE_LABELS[r.return_type] || r.return_type}
                                </span>
                                {r.return_scenario && SCENARIO_META[r.return_scenario] && (
                                  <div style={{ fontSize: "0.7rem", color: "var(--th-text-faint)", marginTop: "0.2rem" }}>
                                    {SCENARIO_META[r.return_scenario].icon} {SCENARIO_META[r.return_scenario].label}
                                  </div>
                                )}
                                {r.customer_name && (
                                  <div style={{ fontSize: "0.7rem", color: "var(--th-text-muted)", marginTop: "0.1rem" }}>👤 {r.customer_name}</div>
                                )}
                              </td>
                              <td>
                                <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{r.item_name}</div>
                                <div style={{ fontSize: "0.75rem", color: "var(--th-text-muted)" }}>{r.sku}</div>
                              </td>
                              <td style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{r.quantity}</td>
                              <td style={{ fontSize: "0.82rem" }}>{r.reason}</td>
                              <td>
                                <span className={`ret-badge ${STATUS_BADGE[r.status] || "ret-badge-slate"}`}>
                                  {STATUS_LABEL[r.status] || r.status?.replace(/_/g, " ")}
                                </span>
                              </td>
                              <td style={{ fontSize: "0.78rem", color: "var(--th-text-muted)" }}>
                                {r.original_sale_id && <div>Sale: {r.original_sale_id}</div>}
                                {r.original_order_id && <div>Order: {r.original_order_id}</div>}
                                {r.linked_inventory_tx_id && (
                                  <div style={{ color: "var(--th-text-faint)", fontSize: "0.7rem" }}>Tx: {r.linked_inventory_tx_id}</div>
                                )}
                              </td>
                              <td style={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}>{fmtDate(r.created_at)}</td>
                              <td style={{ whiteSpace: "nowrap", display: "flex", flexDirection: "column", gap: "0.35rem", padding: "0.7rem 0.5rem" }}>
                                {/* Standalone supplier return awaiting replacement */}
                                {r.return_type === "SUPPLIER_RETURN" && r.status === "REPLACEMENT_PENDING" && !r.replacement_return_id?.startsWith("RET-CUST") && (
                                  <button className="ret-btn ret-btn-emerald ret-btn-sm" onClick={() => openReplModal(r)}>
                                    Receive Replacement
                                  </button>
                                )}
                                {/* Customer return awaiting warranty verdict */}
                                {r.return_type === "CUSTOMER_RETURN" && r.status === "WARRANTY_PENDING" && (
                                  <button className="ret-btn ret-btn-sky ret-btn-sm" onClick={() => { setWarrantyModal(r); setWarrantyResult("COVERED"); setWarrantyNotes(""); }}>
                                    Record Warranty Result
                                  </button>
                                )}
                                {/* Customer return reserved — replacement arrived, waiting for customer to claim */}
                                {r.return_type === "CUSTOMER_RETURN" && r.status === "READY_FOR_PICKUP" && (
                                  <button className="ret-btn ret-btn-sm" style={{ background: "var(--th-violet)", color: "#fff" }}
                                    onClick={() => submitHandover(r)}>
                                    ✓ Complete Handover
                                  </button>
                                )}
                                {/* Customer return with linked auto-supplier return — show both buttons */}
                                {r.return_type === "CUSTOMER_RETURN" && r.status === "REPLACEMENT_PENDING" && linkedSupp && (
                                  <>
                                    <button className="ret-btn ret-btn-emerald ret-btn-sm" onClick={() => openReplModal(linkedSupp)}>
                                      Receive Replacement
                                    </button>
                                    <button className="ret-btn ret-btn-sm" style={{ background: "var(--th-violet)", color: "#fff" }}
                                      onClick={() => { setFulfillModal(r); setFulfillMode("from_stock"); setSelectedReplItem(null); setReplStockQuery(""); setFulfillDr(""); setFulfillDot(""); }}>
                                      Fulfill Replacement
                                    </button>
                                  </>
                                )}
                                {/* Customer return REPLACEMENT_PENDING with no linked supplier (e.g. warranty covered) */}
                                {r.return_type === "CUSTOMER_RETURN" && r.status === "REPLACEMENT_PENDING" && !linkedSupp && (
                                  <button className="ret-btn ret-btn-sm" style={{ background: "var(--th-violet)", color: "#fff" }}
                                    onClick={() => { setFulfillModal(r); setFulfillMode("from_stock"); setSelectedReplItem(null); setReplStockQuery(""); setFulfillDr(""); setFulfillDot(""); }}>
                                    Fulfill Replacement
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        });
                    })()}
                  </tbody>
                </table>
              </div>
              <Pagination currentPage={histPage} totalPages={Math.ceil(histReturns.length/HIST_PAGE_SIZE)} onPageChange={setHistPage} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CONFIRM CUSTOMER RETURN ───────────────────────────────────── */}
      {pendingCustReturn && (
        <div className="confirm-overlay" onClick={(e) => e.target === e.currentTarget && setPendingCustReturn(null)}>
          <div className="confirm-box">
            <div className="confirm-title">Confirm Return</div>
            <div className="confirm-details">
              <div className="confirm-detail-row">
                <span className="confirm-detail-label">Type</span>
                <span className="confirm-detail-val">{SCENARIO_META[pendingCustReturn.return_scenario]?.label || pendingCustReturn.return_scenario}</span>
              </div>
              <div className="confirm-detail-row">
                <span className="confirm-detail-label">Sale</span>
                <span className="confirm-detail-val">{pendingCustReturn.saleName}</span>
              </div>
              {pendingCustReturn.customer_name && (
                <div className="confirm-detail-row">
                  <span className="confirm-detail-label">Customer</span>
                  <span className="confirm-detail-val">{pendingCustReturn.customer_name}</span>
                </div>
              )}
              <div className="confirm-detail-row">
                <span className="confirm-detail-label">Items</span>
                <span className="confirm-detail-val">{pendingCustReturn.items.length} item(s), total qty {pendingCustReturn.items.reduce((s, i) => s + i.quantity, 0)}</span>
              </div>
              {pendingCustReturn.return_scenario === "FULL_REFUND" && (
                <div className="confirm-detail-row">
                  <span className="confirm-detail-label">Refund Method</span>
                  <span className="confirm-detail-val">{pendingCustReturn.refund_method}</span>
                </div>
              )}
              {pendingCustReturn.return_scenario === "DEFECTIVE_REPLACE_NOW" && (
                <div className="confirm-detail-row">
                  <span className="confirm-detail-label">Replacement</span>
                  <span className="confirm-detail-val">Same item from stock (1:1 swap)</span>
                </div>
              )}
              {pendingCustReturn.warranty_ref && (
                <div className="confirm-detail-row">
                  <span className="confirm-detail-label">Warranty Ref</span>
                  <span className="confirm-detail-val">{pendingCustReturn.warranty_ref}</span>
                </div>
              )}
              <div className="confirm-detail-row">
                <span className="confirm-detail-label">Reason</span>
                <span className="confirm-detail-val">{pendingCustReturn.reason}</span>
              </div>
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => setPendingCustReturn(null)}>Cancel</button>
              <button className="confirm-btn-ok" onClick={confirmCustomerReturn}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* ── WARRANTY RESULT MODAL ──────────────────────────────────────── */}
      {warrantyModal && (
        <div className="ret-overlay" onClick={(e) => e.target === e.currentTarget && setWarrantyModal(null)}>
          <div className="ret-modal">
            <div className="ret-modal-header">
              <div className="ret-modal-title">📋 Warranty Result</div>
              <button className="ret-modal-close" onClick={() => setWarrantyModal(null)}>✕</button>
            </div>
            <div className="ret-modal-body">
              <div style={{ fontSize: "0.86rem", color: "var(--th-text-muted)" }}>
                Recording warranty verdict for return <strong style={{ color: "var(--th-text-primary)" }}>{warrantyModal.return_id}</strong>
                {warrantyModal.item_name && <> — {warrantyModal.item_name}</>}
              </div>
              <div className="ret-form-field">
                <label className="ret-label">Warranty Result <span style={{ color: "var(--th-rose)" }}>*</span></label>
                <select className="ret-select" value={warrantyResult} onChange={(e) => setWarrantyResult(e.target.value)}>
                  <option value="COVERED">✅ Covered — replacement will be issued</option>
                  <option value="NOT_COVERED">❌ Not Covered — claim denied</option>
                  <option value="PARTIAL">⚠️ Partial — supplier covers part of it</option>
                </select>
              </div>
              {warrantyResult === "COVERED" && (
                <div style={{ fontSize: "0.75rem", color: "var(--th-sky)", background: "var(--th-sky-bg)", padding: "0.45rem 0.7rem", borderRadius: 6 }}>
                  Status will be set to <strong>REPLACEMENT_PENDING</strong> — use "Fulfill Replacement" to send a replacement unit to the customer.
                </div>
              )}
              {warrantyResult !== "COVERED" && (
                <div style={{ fontSize: "0.75rem", color: "var(--th-text-dim)", background: "var(--th-bg-card-alt)", padding: "0.45rem 0.7rem", borderRadius: 6 }}>
                  Status will be set to <strong>RESOLVED</strong>.
                </div>
              )}
              <div className="ret-form-field">
                <label className="ret-label">Notes (optional)</label>
                <textarea
                  className="ret-textarea"
                  rows={2}
                  placeholder="Supplier feedback, reference numbers…"
                  value={warrantyNotes}
                  onChange={(e) => setWarrantyNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="ret-modal-footer">
              <button className="ret-btn ret-btn-slate" onClick={() => setWarrantyModal(null)}>Cancel</button>
              <button className="ret-btn ret-btn-sky" style={{ flex: 1 }} disabled={warrantySubmitting} onClick={submitWarrantyResult}>
                {warrantySubmitting ? "Saving…" : "✓ Save Result"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FULFILL REPLACEMENT MODAL ──────────────────────────────────── */}
      {fulfillModal && (() => {
        const isTire = /^(PCR|SUV|LT|TBR|OTR|MC)/i.test(fulfillModal.sku || "");
        const stockOk = fulfillStockInfo && (fulfillStockInfo.on_hand || 0) >= fulfillModal.quantity;
        const canSubmit = fulfillMode === "from_stock"
          ? !fulfillStockLoading && stockOk
          : !!fulfillDr.trim() && (!isTire || /^\d{4}$/.test(fulfillDot.trim()));
        return (
          <div className="ret-overlay" onClick={(e) => e.target === e.currentTarget && setFulfillModal(null)}>
            <div className="ret-modal" style={{ maxWidth: 500 }}>
              <div className="ret-modal-header">
                <div className="ret-modal-title">🔧 Fulfill Replacement</div>
                <button className="ret-modal-close" onClick={() => setFulfillModal(null)}>✕</button>
              </div>
              <div className="ret-modal-body">
                {/* Item info */}
                <div style={{ background: "var(--th-bg-card-alt)", border: "1px solid var(--th-border)", borderRadius: 8, padding: "0.55rem 0.85rem" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--th-text-heading)" }}>{fulfillModal.item_name}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--th-text-muted)", marginTop: "0.1rem" }}>
                    {fulfillModal.sku} · Qty needed: <strong>{fulfillModal.quantity}</strong>
                    {fulfillModal.customer_name && <> · Customer: {fulfillModal.customer_name}</>}
                  </div>
                </div>

                {/* Route picker */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  {[
                    { key: "from_stock", icon: "📦", label: "From Current Stock", desc: "Use item already in inventory" },
                    { key: "new_delivery", icon: "🚚", label: "New Delivery", desc: "Receive incoming tires and use for replacement" },
                  ].map(opt => (
                    <div
                      key={opt.key}
                      onClick={() => { setFulfillMode(opt.key); setSelectedReplItem(null); setReplStockQuery(""); setFulfillDr(""); setFulfillDot(""); }}
                      style={{
                        border: `2px solid ${fulfillMode === opt.key ? "var(--th-emerald)" : "var(--th-border-mid)"}`,
                        background: fulfillMode === opt.key ? "var(--th-emerald-bg)" : "var(--th-bg-card-alt)",
                        borderRadius: 9, padding: "0.65rem 0.8rem", cursor: "pointer", transition: "all 0.15s",
                      }}
                    >
                      <div style={{ fontSize: "1.1rem", marginBottom: "0.2rem" }}>{opt.icon}</div>
                      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "0.9rem", textTransform: "uppercase", color: "var(--th-text-primary)" }}>{opt.label}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--th-text-faint)", marginTop: "0.15rem" }}>{opt.desc}</div>
                    </div>
                  ))}
                </div>

                {/* From stock — auto check same item */}
                {fulfillMode === "from_stock" && (
                  <div>
                    {fulfillStockLoading && (
                      <div style={{ fontSize: "0.82rem", color: "var(--th-text-dim)" }}>Checking stock…</div>
                    )}
                    {!fulfillStockLoading && fulfillStockInfo && (() => {
                      const available = (fulfillStockInfo.on_hand || 0) >= fulfillModal.quantity;
                      return (
                        <div style={{
                          display: "flex", alignItems: "center", gap: "0.75rem",
                          padding: "0.65rem 0.9rem", borderRadius: 8,
                          border: `1px solid ${available ? "var(--th-emerald)" : "var(--th-rose)"}`,
                          background: available ? "rgba(52,211,153,0.06)" : "rgba(251,113,133,0.06)",
                        }}>
                          <span style={{ fontSize: "1.1rem" }}>{available ? "✅" : "❌"}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: "0.92rem", color: "var(--th-text-primary)" }}>{fulfillStockInfo.item_name}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--th-text-muted)", marginTop: "0.1rem" }}>
                              In stock: <strong style={{ color: available ? "var(--th-emerald)" : "var(--th-rose)" }}>{fulfillStockInfo.on_hand}</strong> · Need: {fulfillModal.quantity}
                            </div>
                          </div>
                          <span style={{
                            fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "0.8rem",
                            textTransform: "uppercase", padding: "0.15rem 0.55rem", borderRadius: 4,
                            background: available ? "var(--th-emerald-bg)" : "var(--th-rose-bg)",
                            color: available ? "var(--th-emerald)" : "var(--th-rose)",
                          }}>
                            {available ? "Ready" : "Out of Stock"}
                          </span>
                        </div>
                      );
                    })()}
                    {!fulfillStockLoading && fulfillStockInfo && (fulfillStockInfo.on_hand || 0) < fulfillModal.quantity && (
                      <div style={{ fontSize: "0.75rem", color: "var(--th-rose)" }}>
                        Not enough stock. Switch to <strong>New Delivery</strong> to receive incoming tires and fulfill at the same time.
                      </div>
                    )}
                    <div style={{ fontSize: "0.7rem", color: "var(--th-text-dim)" }}>
                      Unit deducted from current stock. Supplier return stays pending — receive it separately when supplier sends back the defective unit.
                    </div>
                  </div>
                )}

                {/* New delivery */}
                {fulfillMode === "new_delivery" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    <div className="ret-form-row">
                      <div className="ret-form-field">
                        <label className="ret-label">DR Number <span style={{ color: "var(--th-rose)" }}>*</span></label>
                        <input
                          className="ret-input"
                          placeholder="e.g. 202600123"
                          inputMode="numeric"
                          value={fulfillDr}
                          onChange={(e) => setFulfillDr(e.target.value.replace(/\D/g, ""))}
                        />
                      </div>
                      {isTire && (
                        <div className="ret-form-field">
                          <label className="ret-label">DOT / Year <span style={{ color: "var(--th-rose)" }}>*</span></label>
                          <input
                            className="ret-input"
                            placeholder="e.g. 2524"
                            inputMode="numeric"
                            maxLength={4}
                            value={fulfillDot}
                            onChange={(e) => setFulfillDot(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          />
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--th-text-dim)" }}>
                      Incoming tires are received into stock, then <strong>{fulfillModal.quantity}</strong> unit(s) are immediately used for this replacement. Any surplus remains as sellable inventory.<br/>
                      When the supplier later returns the defective unit, receive it separately — it becomes regular sellable stock.
                    </div>
                  </div>
                )}
              </div>
              <div className="ret-modal-footer">
                <button className="ret-btn ret-btn-slate" onClick={() => { setFulfillModal(null); setSelectedReplItem(null); setReplStockQuery(""); setFulfillDr(""); setFulfillDot(""); setFulfillMode("from_stock"); }}>Cancel</button>
                <button
                  className="ret-btn ret-btn-emerald"
                  style={{ flex: 1 }}
                  disabled={fulfillSubmitting || !canSubmit}
                  onClick={submitFulfillReplacement}
                >
                  {fulfillSubmitting ? "Processing…" : fulfillMode === "new_delivery" ? "🚚 Receive & Fulfill" : "✓ Fulfill Replacement"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── REPLACEMENT MODAL ─────────────────────────────────────────── */}
      {replModal && (() => {
        const isTire = /^(PCR|SUV|LT|TBR|OTR|MC)/i.test(replModal.sku || "");
        return (
          <div className="ret-overlay" onClick={(e) => e.target === e.currentTarget && setReplModal(null)}>
            <div className="ret-modal">
              <div className="ret-modal-header">
                <div className="ret-modal-title">Receive Replacement</div>
                <button className="ret-modal-close" onClick={() => setReplModal(null)}>✕</button>
              </div>
              <div className="ret-modal-body">
                <div style={{ background: "var(--th-bg-card-alt)", border: "1px solid var(--th-border)", borderRadius: 8, padding: "0.6rem 0.85rem" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--th-text-heading)" }}>{replModal.item_name}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--th-text-muted)", marginTop: "0.15rem" }}>
                    {replModal.sku} · Return: {replModal.return_id}
                    {replModal.supplier_name && <> · {replModal.supplier_name}</>}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.45rem 0.75rem", background: "var(--th-bg-input)", border: "1px solid var(--th-border)", borderRadius: 7 }}>
                  <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--th-text-faint)", fontWeight: 600 }}>Qty</span>
                  <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: "1.2rem", color: "var(--th-text-heading)" }}>{replModal.quantity}</span>
                  <span style={{ fontSize: "0.78rem", color: "var(--th-text-muted)" }}>unit{replModal.quantity !== 1 ? "s" : ""} to receive</span>
                </div>

                <div className="ret-form-row">
                  <div className="ret-form-field">
                    <label className="ret-label">DR Number <span style={{ color: "var(--th-rose)" }}>*</span></label>
                    <input
                      className="ret-input"
                      placeholder="e.g. 202600123"
                      inputMode="numeric"
                      value={replDr}
                      onChange={(e) => setReplDr(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>
                  {isTire && (
                    <div className="ret-form-field">
                      <label className="ret-label">DOT / Year <span style={{ color: "var(--th-rose)" }}>*</span></label>
                      <input
                        className="ret-input"
                        placeholder="e.g. 2524"
                        inputMode="numeric"
                        maxLength={4}
                        value={replDot}
                        onChange={(e) => setReplDot(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      />
                    </div>
                  )}
                </div>

                {isTire && (
                  <div style={{ fontSize: "0.72rem", color: "var(--th-amber)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span>⚠</span> DOT number is required for all tire replacements.
                  </div>
                )}

                {replError && (
                  <div className="ret-error">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    {replError}
                  </div>
                )}

                <div style={{ fontSize: "0.75rem", color: "var(--th-text-dim)" }}>
                  Replacement will be added directly to inventory as a <strong>SUPPLIER_REPLACEMENT</strong> adjustment. No payment required.
                </div>
              </div>
              <div className="ret-modal-footer">
                <button className="ret-btn ret-btn-slate" onClick={() => setReplModal(null)}>Cancel</button>
                <button className="ret-btn ret-btn-emerald" style={{ flex: 1 }} disabled={replSubmitting} onClick={submitReplacement}>
                  {replSubmitting ? "Receiving…" : "✓ Receive Replacement"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      </div>
    </>
  );
}
