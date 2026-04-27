import React from 'react'
import { API_URL, currency, compactCurrency, apiFetch, SkeletonRows } from '../lib/config'
import KpiCard from '../components/KpiCard'
import SearchInput from '../components/SearchInput'
import FilterHeader from '../components/FilterHeader'
import { DataTable } from '../components/DataTable'
import Modal from '../components/Modal'
import usePaginatedResource from '../hooks/usePaginatedResource'

/* ============================================================
   TIREHUB — ENHANCED PAYABLES PAGE
   Drop-in replacement. Requires API_URL global + currency().
   ============================================================ */

;


const payCompact =
  typeof compactCurrency === "function"
    ? compactCurrency
    : (n) => { const v = Number(n||0), a = Math.abs(v), s = v<0?'-':''; if(a>=1e6) return `${s}₱${(a/1e6).toFixed(2)}M`; if(a>=1e3) return `${s}₱${(a/1e3).toFixed(1)}K`; return `₱${v.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`; };

const payCurrency =
  typeof currency === "function"
    ? currency
    : (n) =>
        "₱" +
        Number(n || 0).toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

const STATUS_OPTS = ["ALL", "OPEN", "OVERDUE", "PAID"];
const PAY_METHODS = ["CASH", "GCASH", "BPI", "BDO", "CARD", "CHECK"];
const TODAY = new Date().toISOString().split("T")[0];

const ICONS = {
  total: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  balance: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  ),
  paid: (
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
  overdue: (
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
  ),
  pending: (
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
  supplier: (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  contact: (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  calendar: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
};

function getPaymentStatus(p) {
  if (p.status === "PAID" || !p.balance_amount || p.balance_amount === 0) return "PAID";
  if (p.due_date && new Date(p.due_date) < new Date()) return "OVERDUE";
  return "OPEN";
}

function getDueDateInfo(p) {
  if (!p.due_date) return { label: "N/A", cls: "ok", badge: null };
  const due = new Date(p.due_date);
  const today = new Date();
  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  const label = due.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  if (diffDays < 0) return { label, cls: "overdue", badge: "Overdue" };
  if (diffDays <= 7) return { label, cls: "soon", badge: `${diffDays}d` };
  return { label, cls: "ok", badge: null };
}

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
function PayablesPage({ shopId }) {
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [kpi, setKpi] = React.useState(null);
  const [calPayables, setCalPayables] = React.useState([]);

  const PAY_PAGE_SIZE = 20;
  const {
    data: payables,
    page: payPage, setPage: setPayPage,
    totalPages: payTotalPages,
    total: payTotal,
    search: searchQuery, setSearch: setSearchQuery,
    loading,
  } = usePaginatedResource({
    url: `${API_URL}/payables/${shopId}`,
    perPage: PAY_PAGE_SIZE,
    extraParams: { status: statusFilter },
    enabled: !!shopId,
    deps: [shopId, statusFilter],
  });

  const [searchSuggestions, setSuggestions] = React.useState([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [suppliers, setSuppliers] = React.useState([]);

  // Add payable form
  const [showForm, setShowForm] = React.useState(false);
  const [formError, setFormError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({ payable_type: "GENERAL", supplier_id: "", payee_name: "", description: "", original_amount: "", due_date: "", notes: "" });
  const [recurringOn, setRecurringOn] = React.useState(false);
  const [recurringDay, setRecurringDay] = React.useState("1");
  const [recurringMonths, setRecurringMonths] = React.useState("12");
  const [recurringStartYear, setRecurringStartYear] = React.useState(() => String(new Date().getFullYear()));
  const [recurringStartMonth, setRecurringStartMonth] = React.useState(() => String(new Date().getMonth()));
  const [recurringEndMode, setRecurringEndMode] = React.useState("months"); // "months" | "until" | "never"
  const [recurringUntilDate, setRecurringUntilDate] = React.useState("");

  // Edit payable
  const [editTarget, setEditTarget] = React.useState(null); // the payable being edited
  const [editForm, setEditForm] = React.useState({ description: "", original_amount: "", due_date: "", notes: "", payee_name: "" });
  const [editScope, setEditScope] = React.useState("one"); // "one" | "future"
  const [editError, setEditError] = React.useState("");
  const [editSaving, setEditSaving] = React.useState(false);

  // Detail modal
  const [detailTarget, setDetailTarget] = React.useState(null);
  const [payForm, setPayForm] = React.useState({ amount: "", payment_date: TODAY, payment_method: "CHECK", notes: "" });
  const [payError, setPayError] = React.useState("");
  const [paying, setPaying] = React.useState(false);
  const [histPayments, setHistPayments] = React.useState([]);
  const [histLoading, setHistLoading] = React.useState(false);
  const [histRefresh, setHistRefresh] = React.useState(0);

  // View toggle
  const [viewMode, setViewMode] = React.useState("list"); // "list" | "calendar"
  const [expandedCell, setExpandedCell] = React.useState(null); // dateStr of expanded cell
  const [selectedWeek, setSelectedWeek] = React.useState(null); // { start, end, amount }
  const [calMonth, setCalMonth] = React.useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() };
  });

  // Confirm pending states
  const [pendingPayable, setPendingPayable] = React.useState(null);
  const [pendingEditPayable, setPendingEditPayable] = React.useState(null);
  const [pendingPayment, setPendingPayment] = React.useState(null);
  const [pendingMarkPaid, setPendingMarkPaid] = React.useState(null);

  // Toast
  const [toast, setToast] = React.useState(null);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2800); };

  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => { const obs = new MutationObserver(() => forceUpdate());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const loadPayables = () => { /* hook owns data — kept as refetch stub if needed */ };

  React.useEffect(() => {
    apiFetch(`${API_URL}/suppliers?shop_id=${shopId}`).then(r => r.json()).then(d => setSuppliers(Array.isArray(d) ? d : [])).catch(() => {});
    // KPI counts
    apiFetch(`${API_URL}/payables-kpi/${shopId}`).then(r => r.json()).then(d => { if (!d.error) setKpi(d); }).catch(() => {});
  }, [shopId]);

  // Calendar: bounded fetch for visible month only
  React.useEffect(() => {
    const { year, month } = calMonth;
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    apiFetch(`${API_URL}/payables/${shopId}?startDate=${start}&endDate=${end}`)
      .then(r => r.json()).then(d => setCalPayables(Array.isArray(d) ? d : [])).catch(() => {});
  }, [shopId, calMonth]);

  /* Suggestions from current page */
  React.useEffect(() => {
    if (!searchQuery.trim()) { setSuggestions([]); setShowSuggestions(false); return; }
    const q = searchQuery.toLowerCase();
    const seen = new Set();
    const sugs = [];
    for (const p of payables) {
      if (p.supplier_name && p.supplier_name.toLowerCase().startsWith(q) && !seen.has(p.supplier_name)) {
        seen.add(p.supplier_name); sugs.push({ text: p.supplier_name, type: "Supplier" });
      }
      if (p.contact_person && p.contact_person.toLowerCase().startsWith(q) && !seen.has(p.contact_person)) {
        seen.add(p.contact_person); sugs.push({ text: p.contact_person, type: "Contact" });
      }
      if (sugs.length >= 8) break;
    }
    setSuggestions(sugs);
    setShowSuggestions(sugs.length > 0);
  }, [searchQuery, payables]);

  /* Add payable */
  const submitForm = () => {
    setFormError("");
    if (form.payable_type === "SUPPLIER" && !form.supplier_id) return setFormError("Select a supplier.");
    if (form.payable_type === "GENERAL" && !form.payee_name.trim()) return setFormError("Enter payee name.");
    if (!form.original_amount || parseFloat(form.original_amount) <= 0) return setFormError("Enter a valid amount.");
    if (recurringOn) {
      if (!recurringDay || parseInt(recurringDay) < 1 || parseInt(recurringDay) > 31) return setFormError("Enter a valid day of month (1–31).");
      if (recurringEndMode === "months" && (!recurringMonths || parseInt(recurringMonths) < 1)) return setFormError("Enter number of months.");
      if (recurringEndMode === "until" && !recurringUntilDate) return setFormError("Select an end date.");
    } else {
      if (!form.due_date) return setFormError("Select a due date.");
    }
    const supplierName = form.payable_type === "SUPPLIER" ? (suppliers.find(s => String(s.supplier_id) === String(form.supplier_id))?.supplier_name || form.supplier_id) : null;
    setPendingPayable({ ...form, original_amount: parseFloat(form.original_amount), supplierName, recurringOn, recurringDay, recurringMonths, recurringStartYear, recurringStartMonth, recurringEndMode, recurringUntilDate });
  };

  const confirmSubmitForm = async () => {
    const fd = pendingPayable;
    setPendingPayable(null);
    setSaving(true);
    try {
      const body = {
        shop_id: shopId, payable_type: fd.payable_type,
        description: fd.description, original_amount: fd.original_amount,
        notes: fd.notes, created_by: "POS"
      };
      if (fd.payable_type === "SUPPLIER") body.supplier_id = fd.supplier_id;
      else body.payee_name = fd.payee_name;
      if (fd.recurringOn) {
        body.is_recurring = true;
        body.recurring_day = parseInt(fd.recurringDay);
        body.recurring_months = parseInt(fd.recurringMonths);
        body.recurring_start_year = parseInt(fd.recurringStartYear);
        body.recurring_start_month = parseInt(fd.recurringStartMonth);
        body.recurring_end_mode = fd.recurringEndMode;
        body.recurring_until_date = fd.recurringUntilDate || null;
      } else {
        body.due_date = fd.due_date || null;
      }
      const res = await apiFetch(`${API_URL}/payables`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.error) { setFormError(data.error); setSaving(false); return; }
      showToast(fd.recurringOn ? `✓ ${data.count} recurring payables created!` : "✓ Payable recorded!");
      setShowForm(false);
      setRecurringOn(false);
      setForm({ payable_type: "GENERAL", supplier_id: "", payee_name: "", description: "", original_amount: "", due_date: "", notes: "" });
      loadPayables();
    } catch (e) { setFormError(e.message); }
    setSaving(false);
  };

  /* Edit payable */
  const openEdit = (p) => {
    setEditTarget(p);
    setEditForm({
      description: (p.recurring_group_id ? p.description.replace(/ — Installment \d+.*$/, "") : p.description) || "",
      original_amount: String(p.original_amount),
      due_date: p.due_date || "",
      notes: p.notes || "",
      payee_name: p.payee_name || "",
    });
    setEditScope("one");
    setEditError("");
  };

  const submitEdit = () => {
    setEditError("");
    if (!editForm.original_amount || parseFloat(editForm.original_amount) <= 0) return setEditError("Enter a valid amount.");
    setPendingEditPayable({ ...editForm, original_amount: parseFloat(editForm.original_amount), scope: editScope, targetId: editTarget.payable_id, recurringGroupId: editTarget.recurring_group_id, recurringInstallment: editTarget.recurring_installment });
  };

  const confirmSubmitEdit = async () => {
    const fd = pendingEditPayable;
    setPendingEditPayable(null);
    setEditSaving(true);
    try {
      let res, data;
      if (fd.scope === "future" && fd.recurringGroupId) {
        res = await apiFetch(`${API_URL}/payables/recurring-group/${fd.recurringGroupId}/from/${fd.recurringInstallment}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: fd.description, original_amount: fd.original_amount, notes: fd.notes }),
        });
      } else {
        res = await apiFetch(`${API_URL}/payables/${fd.targetId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: fd.description, original_amount: fd.original_amount, due_date: fd.due_date, notes: fd.notes, payee_name: fd.payee_name }),
        });
      }
      data = await res.json();
      if (data.error) { setEditError(data.error); setEditSaving(false); return; }
      showToast(fd.scope === "future" ? `✓ Updated ${data.updated} installments!` : "✓ Payable updated!");
      setEditTarget(null);
      loadPayables();
      if (fd.scope === "one") {
        setDetailTarget(prev => prev ? { ...prev, description: fd.description, original_amount: fd.original_amount, balance_amount: data.balance_amount ?? prev.balance_amount, notes: fd.notes, due_date: fd.due_date, payee_name: fd.payee_name || prev.payee_name } : prev);
      }
    } catch (e) { setEditError(e.message); }
    setEditSaving(false);
  };

  /* Detail modal */
  React.useEffect(() => {
    if (!detailTarget) { setHistPayments([]); return; }
    let cancelled = false;
    setHistPayments([]);
    setHistLoading(true);
    apiFetch(`${API_URL}/payables/${detailTarget.payable_id}/payments`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setHistPayments(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setHistLoading(false); });
    return () => { cancelled = true; };
  }, [detailTarget?.payable_id, histRefresh]);

  const openDetail = (p) => {
    setDetailTarget(p);
    setPayForm({ amount: "", payment_date: TODAY, payment_method: "CHECK", notes: "" });
    const dueDate = p.due_date || TODAY;
    setCheckForm({ check_number: "", bank: "", check_date: dueDate, release_date: TODAY });
    setPayError("");
  };
  const closeDetail = () => setDetailTarget(null);

  const submitPayment = () => {
    setPayError("");
    const amt = parseFloat(payForm.amount);
    if (!amt || amt <= 0) return setPayError("Enter a valid amount.");
    if (amt > (detailTarget.balance_amount + 0.01)) return setPayError(`Cannot exceed balance of ${payCurrency(detailTarget.balance_amount)}.`);
    setPendingPayment({ amt, date: payForm.payment_date, method: payForm.payment_method, notes: payForm.notes, payableId: detailTarget.payable_id });
  };

  const confirmSubmitPayment = async () => {
    const { amt, date: pDate, method, notes: pNotes, payableId } = pendingPayment;
    setPendingPayment(null);
    setPaying(true);
    try {
      const res = await apiFetch(`${API_URL}/payables/${payableId}/payment`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_id: shopId, amount: amt, payment_date: pDate, payment_method: method, notes: pNotes, recorded_by: "POS" })
      });
      const data = await res.json();
      if (data.error) { setPayError(data.error); setPaying(false); return; }
      showToast("✓ Payment recorded!");
      loadPayables();
      const newPaid = (detailTarget.amount_paid || 0) + amt;
      setDetailTarget(prev => ({ ...prev, amount_paid: newPaid, balance_amount: data.new_balance, status: data.status }));
      setPayForm({ amount: "", payment_date: TODAY, payment_method: "CHECK", notes: "" });
      setHistRefresh(r => r + 1);
    } catch (e) { setPayError(e.message); }
    setPaying(false);
  };

  const markPaidFull = () => {
    const amt = detailTarget.balance_amount;
    if (!amt || amt <= 0) return;
    setPendingMarkPaid({ amt, payableId: detailTarget.payable_id, method: payForm.payment_method || "CASH" });
  };

  const confirmMarkPaidFull = async () => {
    const { amt, payableId, method } = pendingMarkPaid;
    setPendingMarkPaid(null);
    setPaying(true);
    try {
      const res = await apiFetch(`${API_URL}/payables/${payableId}/payment`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_id: shopId, amount: amt, payment_date: TODAY, payment_method: method, notes: "Quick paid in full", recorded_by: "POS" })
      });
      const data = await res.json();
      if (data.error) { setPayError(data.error); setPaying(false); return; }
      showToast("✓ Marked as paid in full!");
      loadPayables();
      setDetailTarget(prev => ({ ...prev, amount_paid: prev.original_amount, balance_amount: 0, status: "PAID" }));
      setHistRefresh(r => r + 1);
    } catch (e) { setPayError(e.message); }
    setPaying(false);
  };


  /* Stats — from KPI endpoint */
  const totalPayables = kpi?.totalPayables || 0;
  const totalBalance  = kpi?.totalBalance || 0;
  const totalPaid     = totalPayables - totalBalance;
  const paidPct       = totalPayables > 0 ? Math.round((totalPaid / totalPayables) * 100) : 0;
  const overdueCount  = kpi?.overdueCount || 0;
  const pendingCount  = kpi?.openCount || 0;
  const paidCount     = kpi?.paidCount || 0;

  const progressClass = paidPct >= 80 ? "good" : paidPct >= 50 ? "mid" : "low";
  const statusCounts = {
    ALL: (kpi?.total) || 0,
    OPEN: pendingCount,
    OVERDUE: overdueCount,
    PAID: paidCount,
  };

  const payColumns = React.useMemo(() => [
    { key: 'payee', label: 'Payee / Supplier', render: p => (
      <>
        <div className="pay-supplier-name">{p.payable_type === "GENERAL" ? (p.payee_name || "—") : (p.supplier_name || "—")}</div>
        <div className="pay-contact" style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.65rem", fontWeight: 700, padding: "0 4px", borderRadius: 3, background: p.payable_type === "SUPPLIER" ? "var(--th-violet-bg)" : "var(--th-sky-bg)", color: p.payable_type === "SUPPLIER" ? "var(--th-violet)" : "var(--th-sky)" }}>{p.payable_type || "SUPPLIER"}</span>
          {p.recurring_group_id && <span style={{ fontSize: "0.63rem", fontWeight: 800, padding: "0 4px", borderRadius: 3, background: "var(--th-amber-bg)", color: "var(--th-amber)" }}>🔁 {p.recurring_installment}/{p.recurring_total}</span>}
          {p.contact_person && <span style={{ fontSize: "0.78rem", color: "var(--th-text-dim)" }}>{p.contact_person}</span>}
        </div>
      </>
    )},
    { key: 'description', label: 'Description', render: p => (
      <span style={{ fontSize: "0.82rem", color: "var(--th-text-muted)" }}>{p.description || <span style={{ color: "var(--th-text-faint)" }}>—</span>}</span>
    )},
    { key: 'reference_id', label: 'Reference', render: p => (
      p.reference_id
        ? <span style={{ fontFamily: "monospace", background: "var(--th-bg-input)", padding: "1px 5px", borderRadius: 4, fontSize: "0.8rem", color: "var(--th-text-dim)", whiteSpace: "nowrap" }}>{p.reference_id}</span>
        : <span style={{ color: "var(--th-text-faint)", fontSize: "0.8rem" }}>—</span>
    )},
    { key: 'original_amount', label: 'Original', align: 'right', render: p => <div className="pay-amt orig">{payCurrency(p.original_amount)}</div> },
    { key: 'balance_amount', label: 'Balance', align: 'right', render: p => {
      const status = getPaymentStatus(p);
      const balCls = p.balance_amount > 0 ? (status === "OVERDUE" ? "balance-overdue" : "balance-pending") : "balance-paid";
      return <div className={`pay-amt ${balCls}`}>{payCurrency(p.balance_amount)}</div>;
    }},
    { key: 'amount_paid', label: 'Paid', align: 'right', render: p => <div className="pay-amt paid-col">{payCurrency((p.original_amount || 0) - (p.balance_amount || 0))}</div> },
    { key: 'progress', label: 'Progress', align: 'center', render: p => {
      const paid = (p.original_amount || 0) - (p.balance_amount || 0);
      const pct = p.original_amount > 0 ? Math.round((paid / p.original_amount) * 100) : 0;
      const barCls = pct >= 80 ? "good" : pct >= 40 ? "mid" : "low";
      return (
        <div className="pay-row-progress">
          <div className="pay-row-pct">{pct}%</div>
          <div className="pay-row-bar-track"><div className={`pay-row-bar-fill ${barCls}`} style={{ width: `${pct}%` }} /></div>
        </div>
      );
    }},
    { key: 'due_date', label: 'Due Date', render: p => {
      const dueInfo = getDueDateInfo(p);
      return (
        <span className={`pay-due-date ${dueInfo.cls}`}>
          {dueInfo.label}
          {dueInfo.badge && <span className={`pay-due-badge ${dueInfo.cls}`}>{dueInfo.badge}</span>}
        </span>
      );
    }},
    { key: 'status', label: 'Status', render: p => {
      const status = getPaymentStatus(p);
      return <span className={`pay-badge pay-badge-${status}`}>{status}</span>;
    }},
  ], []);

  return (
    <div className="pay-root">
      {toast && <div className="pay-toast">{toast}</div>}

      {/* Title + view toggle + add button */}
      <div className="pay-header-row">
        <div className="th-title-format">Accounts <span style={{ color: 'var(--th-rose)' }}>Payable</span></div>
        <div className="pay-header-btns pay-header-btns-desktop">
          <div className="pay-view-toggle">
            <button className={`pay-view-btn${viewMode === "list" ? " active" : ""}`} onClick={() => setViewMode("list")}>≡ List</button>
            <button className={`pay-view-btn${viewMode === "calendar" ? " active" : ""}`} onClick={() => setViewMode("calendar")}>▦ Calendar</button>
          </div>
          <button className="pay-add-btn" onClick={() => { setShowForm(true); setFormError(""); }}>+ Add Payable</button>
        </div>
      </div>
      <div className="pay-mobile-actions">
        <div className="pay-view-toggle">
          <button className={`pay-view-btn${viewMode === "list" ? " active" : ""}`} onClick={() => setViewMode("list")}>≡ List</button>
          <button className={`pay-view-btn${viewMode === "calendar" ? " active" : ""}`} onClick={() => setViewMode("calendar")}>▦ Calendar</button>
        </div>
        <button className="pay-add-btn" onClick={() => { setShowForm(true); setFormError(""); }}>+ Add Payable</button>
      </div>

      {/* KPI cards */}
      <div className="th-kpi-row">
        <KpiCard label="Total Payables" value={payCompact(totalPayables)} accent="sky" icon={ICONS.total} sub={`${kpi?.total || 0} total`} />
        <KpiCard label="Amount Due" value={payCompact(totalBalance)} accent="rose" icon={ICONS.balance} sub="still outstanding" />
        <KpiCard label="Total Paid" value={payCompact(totalPaid)} accent="emerald" icon={ICONS.paid} sub={`${paidPct}% of total`} />
        <KpiCard label="Overdue" value={overdueCount} accent="orange" icon={ICONS.overdue} sub="suppliers" />
        <KpiCard label="Pending" value={pendingCount} accent="amber" icon={ICONS.pending} sub="suppliers" />
      </div>

      {/* Payment progress */}
      <div className="pay-progress-wrap">
        <div className="pay-progress-top">
          <div className="pay-progress-label">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Payment Progress
          </div>
          <div className="pay-progress-pct">{paidPct}%</div>
        </div>
        <div className="pay-progress-track">
          <div
            className={`pay-progress-fill ${progressClass}`}
            style={{ width: `${paidPct}%` }}
          />
        </div>
        <div className="pay-progress-detail">
          <span>Paid: {payCurrency(totalPaid)}</span>
          <span>Remaining: {payCurrency(totalBalance)}</span>
        </div>
      </div>

      {/* Filter Header Toolbar */}
      <div style={{ marginTop: '0', marginBottom: '0' }}>
        <FilterHeader
          searchProps={{
            value: searchQuery,
            onChange: setSearchQuery,
            placeholder: "Search by supplier name or contact person…",
            suggestions: searchSuggestions,
            onSuggestionSelect: () => setShowSuggestions(false),
            resultCount: searchQuery.trim() ? payTotal : undefined,
            totalCount: kpi?.total || 0,
            resultLabel: "payables",
          }}
          filters={STATUS_OPTS.map(s => ({
            label: s,
            value: s,
            active: statusFilter === s,
            count: statusCounts[s]
          }))}
          onFilterChange={setStatusFilter}
          accentColor="var(--th-rose)"
        />
      </div>

      {/* Calendar view */}
      {viewMode === "calendar" && (() => {
        const { year, month } = calMonth;
        const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const todayStr = new Date().toISOString().split("T")[0];
        // Map payables by due_date day string
        const byDate = {};
        calPayables.forEach(p => {
          if (!p.due_date) return;
          const d = p.due_date.slice(0, 10);
          if (!byDate[d]) byDate[d] = [];
          byDate[d].push(p);
        });
        const cells = [];
        for (let i = 0; i < firstDay; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
        // pad to full rows
        while (cells.length % 7 !== 0) cells.push(null);
        return (
          <div className="pay-cal-wrap">
          <div className="pay-cal-inner">
            <div className="pay-cal-legend">
              <span className="pay-cal-legend-label">Legend:</span>
              {[
                { key: "OPEN",    label: "Open / Pending" },
                { key: "OVERDUE", label: "Overdue" },
                { key: "PAID",    label: "Paid" },
              ].map(({ key, label }) => (
                <span key={key} className={`pay-cal-leg leg-${key}`}>
                  <span className={`pay-cal-leg-dot leg-${key}`} />
                  {label}
                </span>
              ))}
            </div>
            <div className="pay-cal-nav">
              <button className="pay-cal-nav-btn" onClick={() => setCalMonth(({ year: y, month: m }) => m === 0 ? { year: y - 1, month: 11 } : { year: y, month: m - 1 })}>‹</button>
              <div className="pay-cal-month-label">{MONTHS[month]} {year}</div>
              <button className="pay-cal-nav-btn" onClick={() => setCalMonth(({ year: y, month: m }) => m === 11 ? { year: y + 1, month: 0 } : { year: y, month: m + 1 })}>›</button>
            </div>
            <div className="pay-cal-grid">
              {/* DOW header row — same grid, columns stay in sync */}
              <div className={`pay-cal-dow pay-cal-dow-header-due`}>Due</div>
              {DAYS.map(d => <div key={d} className="pay-cal-dow pay-cal-dow-header">{d}</div>)}
              {Array.from({ length: cells.length / 7 }, (_, rowIdx) => {
                const rowCells = cells.slice(rowIdx * 7, rowIdx * 7 + 7);
                // Compute actual date strings for every cell in this row (incl. null cells)
                // Use local date parts to avoid UTC timezone shift
                const rowDates = rowCells.map((day, i) => {
                  const cellIdx = rowIdx * 7 + i;
                  const d = new Date(year, month, 1 - firstDay + cellIdx);
                  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                });
                // Sum balance of all OPEN/OVERDUE payables due this week (spans any month)
                const weekTotal = payables.reduce((sum, p) => {
                  if (!p.due_date) return sum;
                  const ds = p.due_date.slice(0, 10);
                  if (ds >= rowDates[0] && ds <= rowDates[6] && getPaymentStatus(p) !== "PAID") {
                    return sum + (p.balance_amount || 0);
                  }
                  return sum;
                }, 0);

                const openWeekPayables = () => {
                  if (weekTotal <= 0) return;
                  const items = payables.filter(p => {
                    if (!p.due_date) return false;
                    const ds = p.due_date.slice(0, 10);
                    return ds >= rowDates[0] && ds <= rowDates[6] && getPaymentStatus(p) !== "PAID";
                  });
                  setSelectedWeek({
                    start: rowDates[0],
                    end: rowDates[6],
                    amount: weekTotal,
                    items
                  });
                };

                return (
                  <React.Fragment key={rowIdx}>
                    {/* Week total sidebar */}
                    <div className="pay-cal-week-total" onClick={openWeekPayables} style={{ cursor: weekTotal > 0 ? 'pointer' : 'default' }}>
                      <div className={`pay-cal-week-amt ${weekTotal > 0 ? "has-due" : "no-due"}`}>
                        {weekTotal > 0 ? payCurrency(weekTotal) : "—"}
                      </div>
                    </div>
                    {/* 7 day cells */}
                    {rowCells.map((day, i) => {
                      const dateStr = rowDates[i];
                      const isCurrentMonth = day !== null;
                      const displayDay = isCurrentMonth ? day : parseInt(dateStr.split("-")[2]);
                      const isToday = dateStr === todayStr;
                      const items = byDate[dateStr] || [];
                      const visible = items.slice(0, 3);
                      const extra = items.length - visible.length;
                      return (
                        <div key={i} className={`pay-cal-cell${!isCurrentMonth ? " other-month" : ""}${isToday ? " today" : ""}`}
                          onClick={() => setExpandedCell(dateStr)}
                          style={{ cursor: "pointer" }}>
                          <div className="pay-cal-day-num">{displayDay}</div>
                          {visible.map(p => {
                            const st = getPaymentStatus(p);
                            const name = p.payable_type === "GENERAL" ? (p.payee_name || "General") : (p.supplier_name || "Supplier");
                            return (
                              <button key={p.payable_id} className={`pay-cal-item status-${st}`} onClick={e => { e.stopPropagation(); openDetail(p); }} title={`${name} — ${payCurrency(p.balance_amount)}`}>
                                <span style={{ display: "block" }}>{name}</span>
                                <span style={{ display: "block", opacity: 0.8, fontWeight: 900 }}>{payCurrency(p.original_amount)}</span>
                              </button>
                            );
                          })}
                          {extra > 0 && <div className="pay-cal-more" onClick={e => { e.stopPropagation(); setExpandedCell(dateStr); }}>+{extra} more</div>}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
          </div>
        );
      })()}

      {/* Table */}
      {viewMode === "list" && (
        <DataTable
          columns={payColumns}
          rows={payables}
          rowKey="payable_id"
          loading={loading}
          skeletonRows={7}
          minWidth={800}
          currentPage={payPage}
          totalPages={payTotalPages}
          onPageChange={setPayPage}
          onRowClick={openDetail}
          emptyTitle={searchQuery ? "No Payables Match" : "No Payables Found"}
          emptyMessage={searchQuery ? "Try a different search term" : "Supplier payables will appear here"}
        />
      )}

      {/* ── ADD PAYABLE SIDEBAR ── */}
      {showForm && (
        <div className="confirm-overlay" onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="pay-sidebar">
            <div className="pay-sidebar-head">
              <div className="pay-sidebar-title">+ New Payable</div>
              <button className="pay-sidebar-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <div className="pay-sidebar-body">
              {formError && <div className="pay-form-error">{formError}</div>}
              <div>
                <label className="pay-form-label">Type <span style={{ color: "var(--th-rose)" }}>*</span></label>
                <div className="pay-type-toggle">
                  <button className={`pay-type-btn${form.payable_type === "SUPPLIER" ? " active-SUPPLIER" : ""}`} onClick={() => setForm(f => ({ ...f, payable_type: "SUPPLIER" }))}>Supplier (Check)</button>
                  <button className={`pay-type-btn${form.payable_type === "GENERAL" ? " active-GENERAL" : ""}`} onClick={() => setForm(f => ({ ...f, payable_type: "GENERAL" }))}>General (Cash/Transfer)</button>
                </div>
              </div>
              {form.payable_type === "SUPPLIER" ? (
                <div>
                  <label className="pay-form-label">Supplier <span style={{ color: "var(--th-rose)" }}>*</span></label>
                  <select className="pay-form-input" value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
                    <option value="">— Select supplier —</option>
                    {suppliers.map(s => <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="pay-form-label">Payee Name <span style={{ color: "var(--th-rose)" }}>*</span></label>
                  <input className="pay-form-input" placeholder="e.g. Meralco, PLDT, Landlord…" value={form.payee_name} onChange={e => setForm(f => ({ ...f, payee_name: e.target.value }))} />
                </div>
              )}
              <div>
                <label className="pay-form-label">Description</label>
                <input className="pay-form-input" placeholder="e.g. Invoice #2026-001, electricity bill…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="pay-form-label">Amount <span style={{ color: "var(--th-rose)" }}>*</span></label>
                <input className="pay-form-input" type="number" min="0.01" step="0.01" placeholder="₱ 0.00" value={form.original_amount} onChange={e => setForm(f => ({ ...f, original_amount: e.target.value }))} />
              </div>
              {/* Recurring toggle */}
              <div>
                <label className="pay-form-label">Schedule</label>
                <div className={`pay-rec-toggle${recurringOn ? " active" : ""}`} onClick={() => setRecurringOn(v => !v)}>
                  <div className={`pay-rec-switch${recurringOn ? " on" : ""}`} />
                  <span className="pay-rec-label">{recurringOn ? "🔁 Recurring Monthly" : "One-time payment"}</span>
                </div>
              </div>
              {!recurringOn && (
                <div>
                  <label className="pay-form-label">Due Date <span style={{ color: "var(--th-rose)" }}>*</span></label>
                  <input className="pay-form-input" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
              )}
              {recurringOn && (
                <div className="pay-rec-fields">
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--th-amber)", marginBottom: "0.1rem" }}>🔁 Recurring Monthly Settings</div>
                  <div className="pay-rec-row">
                    <div>
                      <label className="pay-form-label">Day of Month <span style={{ color: "var(--th-rose)" }}>*</span></label>
                      <input className="pay-form-input" type="number" min="1" max="31" placeholder="e.g. 15" value={recurringDay} onChange={e => setRecurringDay(e.target.value)} />
                    </div>
                    <div>
                      <label className="pay-form-label">Start Month / Year</label>
                      <div style={{ display: "flex", gap: "0.3rem" }}>
                        <select className="pay-form-input" style={{ flex: 2 }} value={recurringStartMonth} onChange={e => setRecurringStartMonth(e.target.value)}>
                          {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
                            <option key={i} value={i}>{m}</option>
                          ))}
                        </select>
                        <input className="pay-form-input" style={{ flex: 1, minWidth: 0 }} type="number" min="2020" max="2100" value={recurringStartYear} onChange={e => setRecurringStartYear(e.target.value)} />
                      </div>
                    </div>
                  </div>
                  {/* End mode */}
                  <div>
                    <label className="pay-form-label">Ends</label>
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      {[["months","# of Months"],["until","Until Date"],["never","Never"]].map(([val, lbl]) => (
                        <button key={val} type="button" onClick={() => setRecurringEndMode(val)}
                          style={{ flex: 1, padding: "0.35rem 0.4rem", borderRadius: 6, border: "1.5px solid", cursor: "pointer", fontSize: "0.72rem", fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: "0.04em",
                            background: recurringEndMode === val ? "var(--th-amber-bg)" : "var(--th-bg-input)",
                            borderColor: recurringEndMode === val ? "var(--th-amber)" : "var(--th-border-strong)",
                            color: recurringEndMode === val ? "var(--th-amber)" : "var(--th-text-dim)" }}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                  {recurringEndMode === "months" && (
                    <div>
                      <label className="pay-form-label">Number of Months <span style={{ color: "var(--th-rose)" }}>*</span></label>
                      <input className="pay-form-input" type="number" min="1" max="360" placeholder="e.g. 36" value={recurringMonths} onChange={e => setRecurringMonths(e.target.value)} />
                    </div>
                  )}
                  {recurringEndMode === "until" && (
                    <div>
                      <label className="pay-form-label">End Date <span style={{ color: "var(--th-rose)" }}>*</span></label>
                      <input className="pay-form-input" type="date" value={recurringUntilDate} onChange={e => setRecurringUntilDate(e.target.value)} />
                    </div>
                  )}
                  {recurringEndMode === "never" && (
                    <div style={{ fontSize: "0.72rem", color: "var(--th-amber)", padding: "0.3rem 0" }}>
                      ∞ Will generate 10 years of entries (120 months). You can edit the amount any time.
                    </div>
                  )}
                  {/* Summary line */}
                  {recurringDay && (
                    <div style={{ fontSize: "0.72rem", color: "var(--th-amber)", opacity: 0.85 }}>
                      {recurringEndMode === "never"
                        ? `∞ Ongoing — ₱${form.original_amount ? parseFloat(form.original_amount).toLocaleString() : "—"} due on the ${recurringDay}${["st","nd","rd"][((recurringDay%100-11)%10<3)?(recurringDay%10-1):-1]||"th"} of each month`
                        : recurringEndMode === "until" && recurringUntilDate
                          ? `Due on the ${recurringDay}${["st","nd","rd"][((recurringDay%100-11)%10<3)?(recurringDay%10-1):-1]||"th"} until ${new Date(recurringUntilDate).toLocaleDateString("en-PH",{month:"short",year:"numeric"})}`
                          : recurringMonths
                            ? `${recurringMonths} entries of ₱${form.original_amount ? parseFloat(form.original_amount).toLocaleString() : "—"} each`
                            : ""}
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="pay-form-label">Notes</label>
                <input className="pay-form-input" placeholder="Optional notes…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="pay-sidebar-foot">
              <button className="pay-btn-cancel" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="pay-btn-primary" disabled={saving} onClick={submitForm}>{saving ? "Saving…" : "✓ Record Payable"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DAY DETAIL MODAL ── */}
      {expandedCell && (() => {
        const items = payables.filter(p => (p.due_date || '').slice(0, 10) === expandedCell);
        const label = new Date(expandedCell + 'T12:00:00').toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        
        return (
          <Modal
            isOpen={!!expandedCell}
            onClose={() => setExpandedCell(null)}
            title={label}
            maxWidth="450px"
            footer={
              <button 
                className="th-btn th-btn-rose" 
                style={{ width: '100%' }}
                onClick={() => {
                  setExpandedCell(null);
                  setForm(f => ({ ...f, due_date: expandedCell }));
                  setRecurringOn(false); setFormError(""); setShowForm(true);
                }}
              >
                + Add New Payable for this Day
              </button>
            }
          >
            <div style={{ padding: '0.2rem' }}>
              {items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--th-text-faint)' }}>
                   <div style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.5 }}>📅</div>
                   <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>No payables scheduled</div>
                   <div style={{ fontSize: '0.8rem' }}>Click the button below to add one.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {items.map(p => {
                    const st = getPaymentStatus(p);
                    const name = p.payable_type === "GENERAL" ? (p.payee_name || "General") : (p.supplier_name || "Supplier");
                    return (
                      <button key={p.payable_id} className={`pay-cal-item status-${st}`}
                        style={{ 
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '0.75rem 1rem', width: '100%', textAlign: 'left',
                          border: '1px solid var(--th-border)', background: 'rgba(255,255,255,0.02)',
                          borderRadius: '10px'
                        }}
                        onClick={() => { setExpandedCell(null); openDetail(p); }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--th-text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description || 'No description'}</div>
                        </div>
                        <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
                          <div style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--th-rose)' }}>{payCurrency(p.balance_amount)}</div>
                          <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.6 }}>Balance</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* ── DETAIL MODAL ── */}
      {detailTarget && (
        <div className="confirm-overlay" onClick={e => { if (e.target === e.currentTarget) closeDetail(); }}>
          <div className="pay-detail-modal">
            <div className="pay-modal-head" style={{ padding: "1rem 1.2rem 0.85rem", gap: "0.75rem" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                  <span className={`pay-chk-badge pay-chk-${detailTarget.payable_type === "SUPPLIER" ? "RELEASED" : "CLEARED"}`} style={{ marginLeft: 0, fontSize: "0.72rem" }}>{detailTarget.payable_type === "SUPPLIER" ? "Supplier" : "General"}</span>
                  {detailTarget.recurring_group_id && (
                    <span style={{ fontSize: "0.72rem", fontWeight: 800, padding: "2px 8px", borderRadius: 4, background: "var(--th-amber-bg)", color: "var(--th-amber)", border: "1px solid var(--th-amber)" }}>
                      🔁 Installment {detailTarget.recurring_installment}{detailTarget.recurring_indefinite ? "+" : detailTarget.recurring_total ? ` of ${detailTarget.recurring_total}` : ""}
                    </span>
                  )}
                  <span className={`pay-badge pay-badge-${getPaymentStatus(detailTarget)}`} style={{ fontSize: "0.72rem" }}>{getPaymentStatus(detailTarget)}</span>
                </div>
                <div className="pay-modal-title" style={{ fontSize: "1.35rem", lineHeight: 1.2 }}>
                  {detailTarget.payable_type === "GENERAL" ? (detailTarget.payee_name || "General Payable") : (detailTarget.supplier_name || "Supplier Payable")}
                </div>
                {detailTarget.description && (
                  <div style={{ fontSize: "0.9rem", color: "var(--th-text-dim)", marginTop: "0.2rem" }}>{detailTarget.description}</div>
                )}
              </div>
              <div style={{ display: "flex", gap: "0.4rem", alignItems: "flex-start" }}>
                {detailTarget.status !== "PAID" && (
                  <button className="pay-edit-btn" onClick={() => openEdit(detailTarget)}>✏ Edit</button>
                )}
                <button className="pay-sidebar-close" onClick={closeDetail}>×</button>
              </div>
            </div>

            {/* Inline edit form */}
            {editTarget && editTarget.payable_id === detailTarget.payable_id && (
              <div style={{ padding: "0.85rem 1.1rem", borderBottom: "1px solid var(--th-border)", background: "var(--th-sky-bg)", borderLeft: "3px solid var(--th-sky)" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--th-sky)", marginBottom: "0.6rem" }}>✏ Edit Payable</div>
                {editError && <div className="pay-form-error" style={{ marginBottom: "0.5rem" }}>{editError}</div>}
                {detailTarget.recurring_group_id && (
                  <div className="pay-edit-scope">
                    <button className={`pay-edit-scope-btn${editScope === "one" ? " active" : ""}`} onClick={() => setEditScope("one")}>This installment only</button>
                    <button className={`pay-edit-scope-btn${editScope === "future" ? " active" : ""}`} onClick={() => setEditScope("future")}>This + all future installments</button>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {detailTarget.payable_type === "GENERAL" && (
                    <div>
                      <label className="pay-form-label">Payee Name</label>
                      <input className="pay-form-input" value={editForm.payee_name} onChange={e => setEditForm(f => ({ ...f, payee_name: e.target.value }))} />
                    </div>
                  )}
                  <div>
                    <label className="pay-form-label">Description</label>
                    <input className="pay-form-input" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <div style={{ flex: 1 }}>
                      <label className="pay-form-label">Amount <span style={{ color: "var(--th-rose)" }}>*</span></label>
                      <input className="pay-form-input" type="number" min="0.01" step="0.01" value={editForm.original_amount} onChange={e => setEditForm(f => ({ ...f, original_amount: e.target.value }))} />
                    </div>
                    {editScope === "one" && (
                      <div style={{ flex: 1 }}>
                        <label className="pay-form-label">Due Date</label>
                        <input className="pay-form-input" type="date" value={editForm.due_date} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))} />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="pay-form-label">Notes</label>
                    <input className="pay-form-input" value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.2rem" }}>
                    <button className="pay-btn-cancel" style={{ flex: 1 }} onClick={() => setEditTarget(null)}>Cancel</button>
                    <button className="pay-btn-primary" style={{ flex: 2 }} disabled={editSaving} onClick={submitEdit}>{editSaving ? "Saving…" : "✓ Save Changes"}</button>
                  </div>
                </div>
              </div>
            )}

            {/* Summary strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: "1px solid var(--th-border)", background: "var(--th-bg-card)" }}>
              <div style={{ padding: "0.9rem 1.1rem", borderRight: "1px solid var(--th-border)" }}>
                <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--th-text-faint)", marginBottom: "0.25rem" }}>Total Due</div>
                <div style={{ fontWeight: 800, fontSize: "1.25rem", color: "var(--th-text-primary)", fontFamily: "var(--font-body)" }}>{payCurrency(detailTarget.original_amount)}</div>
              </div>
              <div style={{ padding: "0.9rem 1.1rem", borderRight: "1px solid var(--th-border)" }}>
                <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--th-text-faint)", marginBottom: "0.25rem" }}>Paid</div>
                <div style={{ fontWeight: 800, fontSize: "1.25rem", color: "var(--th-emerald)", fontFamily: "var(--font-body)" }}>{payCurrency(detailTarget.amount_paid || 0)}</div>
              </div>
              <div style={{ padding: "0.9rem 1.1rem" }}>
                <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--th-text-faint)", marginBottom: "0.25rem" }}>Balance</div>
                <div style={{ fontWeight: 800, fontSize: "1.25rem", fontFamily: "var(--font-body)", color: detailTarget.balance_amount <= 0 ? "var(--th-emerald)" : getPaymentStatus(detailTarget) === "OVERDUE" ? "var(--th-rose)" : "var(--th-orange)" }}>{payCurrency(detailTarget.balance_amount)}</div>
              </div>
            </div>
            <div style={{ padding: "0.6rem 1.2rem", fontSize: "0.88rem", color: "var(--th-text-dim)", borderBottom: "1px solid var(--th-border)", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
              {detailTarget.reference_id && <span style={{ fontFamily: "monospace", fontSize: "0.82rem", background: "var(--th-bg-input)", padding: "2px 8px", borderRadius: 4, color: "var(--th-sky)" }}>Ref: {detailTarget.reference_id}</span>}
              {detailTarget.due_date && <span style={{ fontWeight: 600, color: getPaymentStatus(detailTarget) === "OVERDUE" ? "var(--th-rose)" : "var(--th-text-dim)" }}>📅 Due: {detailTarget.due_date}</span>}
              {detailTarget.contact_person && <span style={{ color: "var(--th-text-dim)" }}>👤 {detailTarget.contact_person}</span>}
            </div>
            {detailTarget.notes && (
              <div className="pay-notes-block">{detailTarget.notes}</div>
            )}

            {/* Record payment — all types */}
            {getPaymentStatus(detailTarget) !== "PAID" && (
              <div style={{ padding: "1rem 1.2rem", borderBottom: "1px solid var(--th-border)" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--th-rose)", marginBottom: "0.75rem" }}>Record Payment</div>
                {payError && <div className="pay-form-error" style={{ marginBottom: "0.5rem" }}>{payError}</div>}
                <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ flex: "1 1 110px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                      <label className="pay-form-label" style={{ marginBottom: 0 }}>Amount</label>
                      <button onClick={() => setPayForm(p => ({ ...p, amount: String(detailTarget.balance_amount) }))}
                        style={{ background: "var(--th-emerald-bg)", border: "1px solid var(--th-emerald)", color: "var(--th-emerald)", borderRadius: "5px", padding: "0.1rem 0.45rem", fontSize: "0.68rem", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer", lineHeight: 1.4 }}>
                        FULL
                      </button>
                    </div>
                    <input type="number" min="0.01" step="0.01" className="pay-form-input" placeholder="₱ 0.00"
                      max={detailTarget?.balance_amount}
                      value={payForm.amount}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        const bal = detailTarget?.balance_amount || 0;
                        setPayForm(p => ({ ...p, amount: (!isNaN(val) && val > bal) ? String(bal) : e.target.value }));
                      }} autoFocus />
                  </div>
                  <div style={{ flex: "1 1 130px" }}>
                    <label className="pay-form-label">Date</label>
                    <input type="date" className="pay-form-input" value={payForm.payment_date} onChange={e => setPayForm(p => ({ ...p, payment_date: e.target.value }))} />
                  </div>
                  <div style={{ flex: "2 1 160px" }}>
                    <label className="pay-form-label">Notes</label>
                    <input type="text" className="pay-form-input" placeholder="Optional" value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))} />
                  </div>
                </div>
                <div style={{ marginTop: "0.6rem" }}>
                  <label className="pay-form-label">Method</label>
                  <div className="pay-methods">
                    {PAY_METHODS.map(m => (
                      <button key={m} className={`pay-pm-btn${payForm.payment_method === m ? " active" : ""}`} onClick={() => setPayForm(p => ({ ...p, payment_method: m }))}>{m}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.65rem" }}>
                  <button className="pay-btn-primary" style={{ flex: 1 }} onClick={submitPayment} disabled={paying}>
                    {paying ? "Saving…" : "✓ Confirm Payment"}
                  </button>
                </div>
              </div>
            )}

            {/* Payment history */}
            <div style={{ padding: "0.75rem 1.2rem 0.35rem", fontSize: "0.82rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--th-text-faint)" }}>Payment History</div>
            <div className="pay-hist-body">
              {histLoading ? (
                <div style={{ padding: "1.5rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", color: "var(--th-text-faint)", fontSize: "0.84rem" }}><div className="th-spinner th-spinner-sm" />Loading…</div>
              ) : histPayments.length === 0 ? (
                <div style={{ padding: "1.2rem", textAlign: "center", fontSize: "0.9rem", color: "var(--th-text-faint)" }}>No payments recorded yet.</div>
              ) : histPayments.map(hp => (
                <div key={hp.payment_id} className="pay-hist-item" style={{ padding: "0.6rem 1.2rem" }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--th-text-primary)" }}>{new Date(hp.created_at || hp.payment_date).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}</span>
                    <span style={{ fontSize: "0.82rem", color: "var(--th-text-dim)", marginLeft: "0.6rem" }}>{hp.payment_method}{hp.notes ? ` — ${hp.notes}` : ""}</span>
                  </div>
                  <div className="pay-hist-amt" style={{ fontSize: "1rem" }}>+{payCurrency(hp.amount)}</div>
                </div>
              ))}
            </div>
            <div className="pay-modal-foot">
              <button className="pay-btn-cancel" onClick={closeDetail} style={{ flex: 1 }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── WEEKLY SUMMARY MODAL ── */}
      {selectedWeek && (() => {
        // Group items by date
        const grouped = {};
        selectedWeek.items.forEach(p => {
          const d = p.due_date.slice(0, 10);
          if (!grouped[d]) grouped[d] = [];
          grouped[d].push(p);
        });
        // Sort dates ascending
        const sortedDates = Object.keys(grouped).sort();

        return (
          <Modal
            isOpen={!!selectedWeek}
            onClose={() => setSelectedWeek(null)}
            title={`Weekly Schedule: ${new Date(selectedWeek.start).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – ${new Date(selectedWeek.end).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`}
            maxWidth="650px"
          >
            <div style={{ padding: '0.2rem' }}>
              <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'var(--th-rose-bg)', border: '1px solid var(--th-rose)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                   <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--th-rose)', opacity: 0.8 }}>Total Weekly Balance</div>
                   <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--th-rose)', fontFamily: 'Barlow Condensed', lineHeight: 1 }}>{payCurrency(selectedWeek.amount)}</div>
                </div>
                <div style={{ textAlign: 'right', opacity: 0.7 }}>
                   <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Items Due</div>
                   <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{selectedWeek.items.length}</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {sortedDates.map(dateStr => {
                  const items = grouped[dateStr];
                  const dayLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-PH', { weekday: 'long', month: 'short', day: 'numeric' });
                  const dayTotal = items.reduce((s, i) => s + (i.balance_amount || 0), 0);

                  return (
                    <div key={dateStr} className="pay-day-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', padding: '0 0.5rem' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--th-text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{dayLabel}</div>
                        <div style={{ fontWeight: 900, fontSize: '0.9rem', color: 'var(--th-rose)' }}>{payCurrency(dayTotal)}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {items.map(p => {
                          const name = p.payable_type === 'GENERAL' ? (p.payee_name || 'General') : (p.supplier_name || 'Supplier');
                          return (
                            <button 
                              key={p.payable_id} 
                              className={`pay-cal-item status-${getPaymentStatus(p)}`}
                              style={{ 
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '0.65rem 1rem', width: '100%', textAlign: 'left',
                                border: '1px solid var(--th-border)', background: 'rgba(255,255,255,0.02)'
                              }}
                              onClick={() => { setSelectedWeek(null); openDetail(p); }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--th-text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description || 'No description'}</div>
                              </div>
                              <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
                                <div style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--th-rose)' }}>{payCurrency(p.balance_amount)}</div>
                                <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.6 }}>Balance</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Confirm: Add Payable */}
      {pendingPayable && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <div className="confirm-title">Confirm Add Payable</div>
            <div className="confirm-details">
              <div className="confirm-detail-row"><span className="confirm-detail-label">Type</span><span className="confirm-detail-val">{pendingPayable.payable_type}</span></div>
              {pendingPayable.payable_type === "SUPPLIER" && <div className="confirm-detail-row"><span className="confirm-detail-label">Supplier</span><span className="confirm-detail-val">{pendingPayable.supplierName}</span></div>}
              {pendingPayable.payable_type === "GENERAL" && <div className="confirm-detail-row"><span className="confirm-detail-label">Payee</span><span className="confirm-detail-val">{pendingPayable.payee_name}</span></div>}
              {pendingPayable.description && <div className="confirm-detail-row"><span className="confirm-detail-label">Description</span><span className="confirm-detail-val">{pendingPayable.description}</span></div>}
              <div className="confirm-detail-row"><span className="confirm-detail-label">Amount</span><span className="confirm-detail-val">{payCurrency(pendingPayable.original_amount)}</span></div>
              {!pendingPayable.recurringOn && pendingPayable.due_date && <div className="confirm-detail-row"><span className="confirm-detail-label">Due Date</span><span className="confirm-detail-val">{pendingPayable.due_date}</span></div>}
              {pendingPayable.recurringOn && <div className="confirm-detail-row"><span className="confirm-detail-label">Recurring</span><span className="confirm-detail-val">Day {pendingPayable.recurringDay}, {pendingPayable.recurringMonths} months</span></div>}
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => setPendingPayable(null)}>Cancel</button>
              <button className="confirm-btn-ok" onClick={confirmSubmitForm} disabled={saving}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm: Edit Payable */}
      {pendingEditPayable && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <div className="confirm-title">Confirm Update Payable</div>
            <div className="confirm-details">
              {pendingEditPayable.description && <div className="confirm-detail-row"><span className="confirm-detail-label">Description</span><span className="confirm-detail-val">{pendingEditPayable.description}</span></div>}
              <div className="confirm-detail-row"><span className="confirm-detail-label">Amount</span><span className="confirm-detail-val">{payCurrency(pendingEditPayable.original_amount)}</span></div>
              {pendingEditPayable.due_date && <div className="confirm-detail-row"><span className="confirm-detail-label">Due Date</span><span className="confirm-detail-val">{pendingEditPayable.due_date}</span></div>}
              <div className="confirm-detail-row"><span className="confirm-detail-label">Scope</span><span className="confirm-detail-val">{pendingEditPayable.scope === "future" ? "This & future installments" : "This payable only"}</span></div>
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => setPendingEditPayable(null)}>Cancel</button>
              <button className="confirm-btn-ok" onClick={confirmSubmitEdit} disabled={editSaving}>Update</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm: Record Payment */}
      {pendingPayment && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <div className="confirm-title">Confirm Record Payment</div>
            <div className="confirm-details">
              <div className="confirm-detail-row"><span className="confirm-detail-label">Amount</span><span className="confirm-detail-val">{payCurrency(pendingPayment.amt)}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Date</span><span className="confirm-detail-val">{pendingPayment.date}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Method</span><span className="confirm-detail-val">{pendingPayment.method}</span></div>
              {pendingPayment.notes && <div className="confirm-detail-row"><span className="confirm-detail-label">Notes</span><span className="confirm-detail-val">{pendingPayment.notes}</span></div>}
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => setPendingPayment(null)}>Cancel</button>
              <button className="confirm-btn-ok" onClick={confirmSubmitPayment} disabled={paying}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm: Mark Paid Full */}
      {pendingMarkPaid && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <div className="confirm-title">Confirm Mark Paid in Full</div>
            <div className="confirm-details">
              <div className="confirm-detail-row"><span className="confirm-detail-label">Amount</span><span className="confirm-detail-val">{payCurrency(pendingMarkPaid.amt)}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Method</span><span className="confirm-detail-val">{pendingMarkPaid.method}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Date</span><span className="confirm-detail-val">{TODAY}</span></div>
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => setPendingMarkPaid(null)}>Cancel</button>
              <button className="confirm-btn-ok" onClick={confirmMarkPaidFull} disabled={paying}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PayablesPage
