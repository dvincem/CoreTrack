import '../pages_css/ReceivablesPage.css';
import React from 'react'
import { API_URL, currency, compactCurrency, apiFetch, SkeletonRows } from '../lib/config'
import KpiCard from '../components/KpiCard'
import SearchInput from '../components/SearchInput'
import FilterHeader from '../components/FilterHeader'
import { DataTable } from '../components/DataTable'
import usePaginatedResource from '../hooks/usePaginatedResource'

/* ============================================================
   TIREHUB — RECEIVABLES PAGE (with entry form + payments)
   ============================================================ */

;


const rcvCompact = typeof compactCurrency === "function"
  ? compactCurrency
  : (n) => { const v = Number(n||0), a = Math.abs(v), s = v<0?'-':''; if(a>=1e6) return `${s}₱${(a/1e6).toFixed(2)}M`; if(a>=1e3) return `${s}₱${(a/1e3).toFixed(1)}K`; return `₱${v.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`; };
const rcvCurrency = typeof currency === "function"
  ? currency
  : (n) => "₱" + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TYPE_OPTS = ["PRODUCT", "SERVICE", "GENERAL"];
const PAY_METHODS = ["CASH", "GCASH", "BPI", "BDO", "CARD", "CHECK"];
const STATUS_OPTS = ["ALL", "OPEN", "PAID"];

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
function ReceivablesPage({ shopId, businessDate }) {
  const TODAY = businessDate || new Date().toISOString().split('T')[0];

  const [customers, setCustomers] = React.useState([]);
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [kpi, setKpi] = React.useState(null);

  const RCV_PAGE_SIZE = 20;
  const {
    data: receivables,
    page: rcvPage, setPage: setRcvPage,
    totalPages: rcvTotalPages,
    total: rcvTotal,
    search: searchQuery, setSearch: setSearchQuery,
    loading,
  } = usePaginatedResource({
    url: `${API_URL}/receivables/${shopId}`,
    perPage: RCV_PAGE_SIZE,
    extraParams: { status: statusFilter },
    enabled: !!shopId,
    deps: [shopId, statusFilter],
  });
  const [balePage, setBalePage] = React.useState(1);

  // sidebar form
  const [showForm, setShowForm] = React.useState(false);
  const [formError, setFormError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    customer_id: "", receivable_type: "GENERAL", description: "",
    original_amount: "", down_payment: "", due_date: "", notes: ""
  });

  // combined receivable detail modal
  const [rcvDetailTarget, setRcvDetailTarget] = React.useState(null);
  const [payForm, setPayForm] = React.useState({ amount: "", payment_date: TODAY, payment_method: "CASH", notes: "" });
  const [payError, setPayError] = React.useState("");
  const [paying, setPaying] = React.useState(false);
  const [histPayments, setHistPayments] = React.useState([]);
  const [histLoading, setHistLoading] = React.useState(false);

  // toast
  const [toast, setToast] = React.useState(null);

  // page tab
  const [pageTab, setPageTab] = React.useState("receivables");

  // bale book state
  const [bales, setBales] = React.useState([]);
  const [baleLoading, setBaleLoading] = React.useState(false);
  const [staff, setStaff] = React.useState([]);
  const [baleStatusFilter, setBaleStatusFilter] = React.useState("ALL");
  const [baleSearch, setBaleSearch] = React.useState("");
  const [showBaleForm, setShowBaleForm] = React.useState(false);
  const [baleFormError, setBaleFormError] = React.useState("");
  const [baleSaving, setBaleSaving] = React.useState(false);
  const [baleForm, setBaleForm] = React.useState({ staff_id: "", amount: "", bale_date: TODAY, due_date: "", notes: "" });
  const [baleDetailTarget, setBaleDetailTarget] = React.useState(null); // combined detail+pay+history modal
  const [balePayForm, setBalePayForm] = React.useState({ amount: "", payment_date: TODAY, notes: "" });
  const [balePayError, setBalePayError] = React.useState("");
  const [balePaying, setBalePaying] = React.useState(false);
  const [baleHistPayments, setBaleHistPayments] = React.useState([]);
  const [baleHistLoading, setBaleHistLoading] = React.useState(false);

  const [pendingRcv, setPendingRcv] = React.useState(null);
  const [pendingPay, setPendingPay] = React.useState(null);
  const [pendingBale, setPendingBale] = React.useState(null);
  const [pendingBalePay, setPendingBalePay] = React.useState(null);
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  React.useEffect(() => { const obs = new MutationObserver(() => forceUpdate());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const loadReceivables = () => { /* hook owns — kept for call sites that invoke refetch */ };

  const loadBales = React.useCallback(() => {
    setBaleLoading(true);
    apiFetch(`${API_URL}/bale/${shopId}?status=ALL`)
      .then(r => r.json())
      .then(d => { setBales(Array.isArray(d) ? d : []); setBaleLoading(false); })
      .catch(() => { setBales([]); setBaleLoading(false); });
  }, [shopId]);

  React.useEffect(() => {
    apiFetch(`${API_URL}/customers/${shopId}`)
      .then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : [])).catch(() => setCustomers([]));
    apiFetch(`${API_URL}/staff/${shopId}`)
      .then(r => r.json()).then(d => setStaff(Array.isArray(d) ? d : [])).catch(() => setStaff([]));
    apiFetch(`${API_URL}/receivables-kpi/${shopId}`)
      .then(r => r.json()).then(d => { if (!d.error) setKpi(d); }).catch(() => {});
    loadBales();
  }, [shopId, loadBales]);

  // Stats from KPI endpoint
  const totalOrig    = kpi?.totalOrig    || 0;
  const totalBalance = kpi?.totalBalance || 0;
  const totalPaid    = kpi?.totalPaid    || 0;
  const openCount    = kpi?.openCount    || 0;
  const paidCount    = kpi?.paidCount    || 0;
  const paidPct      = totalOrig > 0 ? Math.round((totalPaid / totalOrig) * 100) : 0;
  const progressClass = paidPct >= 80 ? "good" : paidPct >= 50 ? "mid" : "low";

  const statusCounts = { ALL: kpi?.total || 0, OPEN: openCount, PAID: paidCount };

  // Form helpers
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const balancePreview = () => {
    const orig = parseFloat(form.original_amount) || 0;
    const dp = parseFloat(form.down_payment) || 0;
    return Math.max(0, orig - dp);
  };

  const submitForm = () => {
    setFormError("");
    if (!form.customer_id) return setFormError("Please select a customer.");
    if (!form.original_amount || parseFloat(form.original_amount) <= 0)
      return setFormError("Enter a valid original amount.");
    const custName = customers.find(c => String(c.customer_id) === String(form.customer_id))?.customer_name || form.customer_id;
    setPendingRcv({ ...form, original_amount: parseFloat(form.original_amount), custName });
  };

  const confirmSubmitForm = async () => {
    const fd = pendingRcv;
    setPendingRcv(null);
    setSaving(true);
    try {
      const res = await apiFetch(`${API_URL}/receivables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: shopId,
          customer_id: fd.customer_id,
          receivable_type: fd.receivable_type,
          description: fd.description,
          original_amount: fd.original_amount,
          down_payment: parseFloat(fd.down_payment) || 0,
          due_date: fd.due_date || null,
          notes: fd.notes,
          created_by: "POS"
        })
      });
      const data = await res.json();
      if (data.error) { setFormError(data.error); setSaving(false); return; }
      showToast("Receivable saved successfully!");
      setShowForm(false);
      setForm({ customer_id: "", receivable_type: "GENERAL", description: "", original_amount: "", down_payment: "", due_date: "", notes: "" });
      loadReceivables();
    } catch (e) { setFormError(e.message); }
    setSaving(false);
  };

  // Payment helpers
  const openRcvDetail = async (row) => {
    setRcvDetailTarget(row);
    setPayForm({ amount: "", payment_date: TODAY, payment_method: "CASH", notes: "" });
    setPayError("");
    setHistPayments([]);
    setHistLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/receivables/${row.receivable_id}/payments`);
      const data = await res.json();
      setHistPayments(Array.isArray(data) ? data : []);
    } catch (_) {}
    setHistLoading(false);
  };
  const closeRcvDetail = () => setRcvDetailTarget(null);

  const submitPayment = () => {
    setPayError("");
    const amt = parseFloat(payForm.amount);
    if (!amt || amt <= 0) return setPayError("Enter a valid amount.");
    if (amt > (rcvDetailTarget.balance_amount + 0.01)) return setPayError(`Cannot exceed balance of ${rcvCurrency(rcvDetailTarget.balance_amount)}.`);
    setPendingPay({ amt, date: payForm.payment_date, method: payForm.payment_method, notes: payForm.notes });
  };

  const confirmSubmitPayment = async () => {
    const { amt, date: pDate, method, notes: pNotes } = pendingPay;
    setPendingPay(null);
    setPaying(true);
    try {
      const res = await apiFetch(`${API_URL}/receivables/${rcvDetailTarget.receivable_id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: shopId,
          amount: amt,
          payment_date: pDate,
          payment_method: method,
          notes: pNotes,
          recorded_by: "POS"
        })
      });
      const data = await res.json();
      if (data.error) { setPayError(data.error); setPaying(false); return; }
      showToast("Payment recorded!");
      loadReceivables();
      const newPaid = (rcvDetailTarget.amount_paid || 0) + amt;
      setRcvDetailTarget(prev => ({ ...prev, amount_paid: newPaid, balance_amount: data.new_balance, status: data.status }));
      setPayForm({ amount: "", payment_date: TODAY, payment_method: "CASH", notes: "" });
      setHistPayments(prev => [{ payment_id: data.payment_id, amount: amt, payment_date: pDate, payment_method: method, notes: pNotes || null, created_at: new Date().toISOString() }, ...prev]);
    } catch (e) { setPayError(e.message); }
    setPaying(false);
  };

  // Bale derived data
  const filteredBales = bales.filter(b => {
    if (baleStatusFilter !== "ALL" && b.status !== baleStatusFilter) return false;
    if (baleSearch.trim()) {
      const q = baleSearch.toLowerCase();
      return b.staff_name?.toLowerCase().includes(q) || b.staff_code?.toLowerCase().includes(q) || b.notes?.toLowerCase().includes(q);
    }
    return true;
  });
  React.useEffect(() => { setBalePage(1); }, [baleStatusFilter, baleSearch, bales.length]);
  const baleTotal = bales.filter(b => b.status === "ACTIVE").reduce((s, b) => s + (b.amount || 0), 0);
  const baleOutstanding = bales.filter(b => b.status === "ACTIVE").reduce((s, b) => s + (b.balance_amount || 0), 0);
  const baleActiveCount = bales.filter(b => b.status === "ACTIVE").length;
  const balePaidCount = bales.filter(b => b.status === "PAID").length;

  const setBF = (k, v) => setBaleForm(f => ({ ...f, [k]: v }));

  const submitBaleForm = () => {
    setBaleFormError("");
    if (!baleForm.staff_id) return setBaleFormError("Select an employee.");
    if (!baleForm.amount || parseFloat(baleForm.amount) <= 0) return setBaleFormError("Enter a valid amount.");
    const staffMember = staff.find(s => String(s.staff_id) === String(baleForm.staff_id));
    setPendingBale({ ...baleForm, amount: parseFloat(baleForm.amount), staffName: staffMember?.full_name || baleForm.staff_id });
  };

  const confirmSubmitBale = async () => {
    const fd = pendingBale;
    setPendingBale(null);
    setBaleSaving(true);
    try {
      const res = await apiFetch(`${API_URL}/bale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: shopId,
          staff_id: fd.staff_id,
          amount: fd.amount,
          bale_date: fd.bale_date || TODAY,
          due_date: fd.due_date || null,
          notes: fd.notes,
          created_by: "POS"
        })
      });
      const data = await res.json();
      if (data.error) { setBaleFormError(data.error); setBaleSaving(false); return; }
      showToast("Bale recorded!");
      setShowBaleForm(false);
      setBaleForm({ staff_id: "", amount: "", bale_date: TODAY, due_date: "", notes: "" });
      loadBales();
    } catch (e) { setBaleFormError(e.message); }
    setBaleSaving(false);
  };

  const openBaleDetail = (b) => {
    setBaleDetailTarget(b);
    setBalePayForm({ amount: "", payment_date: TODAY, notes: "" });
    setBalePayError("");
    setBaleHistPayments([]);
    setBaleHistLoading(true);
    apiFetch(`${API_URL}/bale/${b.bale_id}/payments`)
      .then(r => r.json())
      .then(d => { setBaleHistPayments(Array.isArray(d) ? d : []); setBaleHistLoading(false); })
      .catch(() => setBaleHistLoading(false));
  };
  const closeBaleDetail = () => setBaleDetailTarget(null);

  const submitBalePayment = () => {
    setBalePayError("");
    const amt = parseFloat(balePayForm.amount);
    if (!amt || amt <= 0) return setBalePayError("Enter a valid amount.");
    if (amt > (baleDetailTarget.balance_amount + 0.01)) return setBalePayError(`Cannot exceed balance of ${rcvCurrency(baleDetailTarget.balance_amount)}.`);
    setPendingBalePay({ amt, date: balePayForm.payment_date, notes: balePayForm.notes });
  };

  const confirmSubmitBalePayment = async () => {
    const { amt, date: pDate, notes: pNotes } = pendingBalePay;
    setPendingBalePay(null);
    setBalePaying(true);
    try {
      const res = await apiFetch(`${API_URL}/bale/${baleDetailTarget.bale_id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: shopId, amount: amt,
          payment_date: pDate,
          payment_method: "CASH",
          notes: pNotes, recorded_by: "POS"
        })
      });
      const data = await res.json();
      if (data.error) { setBalePayError(data.error); setBalePaying(false); return; }
      showToast("Bale payment recorded!");
      loadBales();
      const newPaid = (baleDetailTarget.amount_paid || 0) + amt;
      setBaleDetailTarget(prev => ({ ...prev, amount_paid: newPaid, balance_amount: data.new_balance, status: data.status }));
      setBalePayForm({ amount: "", payment_date: TODAY, notes: "" });
      setBaleHistPayments(prev => [{ payment_id: data.payment_id, amount: amt, payment_date: pDate, payment_method: "CASH", notes: pNotes || null, created_at: new Date().toISOString() }, ...prev]);
    } catch (e) { setBalePayError(e.message); }
    setBalePaying(false);
  };

  const rcvColumns = React.useMemo(() => [
    { key: 'customer_name', label: 'Customer', render: row => (
      <><div className="rcv-cust-name">{row.customer_name || row.customer_id}</div>
      {row.contact_number && <div className="rcv-contact">{row.contact_number}</div>}</>
    )},
    { key: 'type', label: 'Type / Description', render: row => (
      <><span className={`rcv-type-chip rcv-type-${row.receivable_type || 'GENERAL'}`}>{row.receivable_type || 'GENERAL'}</span>
      {row.description && <div className="rcv-desc-cell">{row.description}</div>}</>
    )},
    { key: 'original_amount', label: 'Original', align: 'right', render: row => <div className="rcv-amt orig">{rcvCurrency(row.original_amount)}</div> },
    { key: 'amount_paid', label: 'Paid', align: 'right', render: row => <div className="rcv-amt paid-amt">{rcvCurrency(row.amount_paid || 0)}</div> },
    { key: 'balance_amount', label: 'Balance', align: 'right', render: row => (
      <div className={`rcv-amt ${row.status === 'PAID' ? 'balance-paid' : 'balance-open'}`}>{rcvCurrency(row.balance_amount)}</div>
    )},
    { key: 'due_date', label: 'Due Date', render: row => {
      const isOverdue = row.due_date && row.due_date < TODAY && row.status === "OPEN";
      return row.due_date
        ? <div className={`rcv-due-date${isOverdue ? " rcv-due-overdue" : ""}`}>{row.due_date}{isOverdue ? " ⚠" : ""}</div>
        : <span style={{ color: "var(--th-text-faint)", fontSize: "0.8rem" }}>—</span>;
    }},
    { key: 'progress', label: 'Progress', align: 'center', render: row => {
      const pct = row.original_amount > 0 ? Math.round(((row.amount_paid || 0) / row.original_amount) * 100) : 0;
      const barCls = pct >= 80 ? "good" : pct >= 40 ? "mid" : "low";
      return (
        <div className="rcv-row-progress">
          <div className="rcv-row-pct">{pct}%</div>
          <div className="rcv-row-bar-track"><div className={`rcv-row-bar-fill ${barCls}`} style={{ width: `${pct}%` }} /></div>
        </div>
      );
    }},
    { key: 'status', label: 'Status', render: row => <span className={`rcv-badge rcv-badge-${row.status}`}>{row.status}</span> },
  ], []);

  const baleColumns = React.useMemo(() => [
    { key: 'staff_name', label: 'Employee', render: row => (
      <><div className="bale-staff-name">{row.staff_name || row.staff_id}</div>
      {row.role && <div className="bale-staff-pos">{row.role}</div>}</>
    )},
    { key: 'bale_date', label: 'Date', render: row => <span style={{fontSize:"0.82rem",color:"var(--th-text-muted)"}}>{row.bale_date}</span> },
    { key: 'due_date', label: 'Due Date', render: row => {
      const isOverdue = row.due_date && row.due_date < TODAY && row.status === "ACTIVE";
      return row.due_date
        ? <span style={{fontSize:"0.82rem",color:isOverdue?"var(--th-rose)":"var(--th-text-muted)",fontWeight:isOverdue?600:400}}>{row.due_date}{isOverdue?" ⚠":""}</span>
        : <span style={{fontSize:"0.78rem",color:"var(--th-text-faint)"}}>—</span>;
    }},
    { key: 'amount', label: 'Amount', align: 'right', render: row => <div className="bale-amt orig">{rcvCurrency(row.amount)}</div> },
    { key: 'amount_paid', label: 'Paid', align: 'right', render: row => <div className="bale-amt paid">{rcvCurrency(row.amount_paid||0)}</div> },
    { key: 'balance_amount', label: 'Balance', align: 'right', render: row => (
      <div className={`bale-amt ${row.balance_amount <= 0 ? "zero" : "balance"}`}>{rcvCurrency(row.balance_amount)}</div>
    )},
    { key: 'progress', label: 'Progress', align: 'center', render: row => {
      const pct = row.amount > 0 ? Math.round(((row.amount_paid||0)/row.amount)*100) : 0;
      const barCls = pct >= 80 ? "good" : pct >= 40 ? "mid" : "low";
      return (
        <div className="rcv-row-progress">
          <div className="rcv-row-pct">{pct}%</div>
          <div className="rcv-row-bar-track"><div className={`rcv-row-bar-fill ${barCls}`} style={{ width: `${pct}%` }} /></div>
        </div>
      );
    }},
    { key: 'status', label: 'Status', render: row => <span className={`bale-badge-${row.status}`}>{row.status}</span> },
    { key: 'notes', label: 'Notes', render: row => <span style={{fontSize:"0.78rem",color:"var(--th-text-muted)"}}>{row.notes||"—"}</span> },
  ], []);

  return (
    <div className="rcv-root">
      {/* Header */}
      <div className="rcv-header-row">
        <div className="th-title-format">
          {pageTab === "receivables" ? <>Accounts <span style={{color:"var(--th-emerald)"}}>Receivable</span></> : <>Bale <span style={{color:"var(--th-amber)"}}>Book</span></>}
        </div>
        <div className="rcv-header-btns rcv-header-btns-desktop">
          {pageTab === "receivables" && (
            <button className="rcv-add-btn" onClick={() => { setShowForm(true); setFormError(""); }}>+ New Receivable</button>
          )}
          {pageTab === "bale" && (
            <button className="bale-add-btn" onClick={() => { setShowBaleForm(true); setBaleFormError(""); }}>+ New Bale</button>
          )}
        </div>
      </div>

      {/* Page Tabs */}
      <div className="rcv-page-tabs">
        <button className={`rcv-page-tab${pageTab === "receivables" ? " active-rcv" : ""}`} onClick={() => setPageTab("receivables")}>
          ₱ Accounts Receivable
        </button>
        <button className={`rcv-page-tab${pageTab === "bale" ? " active-bale" : ""}`} onClick={() => setPageTab("bale")}>
          📒 Bale Book
        </button>
      </div>

      {pageTab === "receivables" && <>
      {/* KPI cards */}
      <div className="th-kpi-row">
        <KpiCard label="Total Receivables" value={rcvCompact(totalOrig)} accent="sky" icon="₱" sub={`${receivables.length} records`} />
        <KpiCard label="Balance Due" value={rcvCompact(totalBalance)} accent="rose" icon="⚠" sub="still outstanding" />
        <KpiCard label="Total Collected" value={rcvCompact(totalPaid)} accent="emerald" icon="✓" sub={`${paidPct}% of total`} />
        <KpiCard label="Open" value={openCount} accent="orange" icon="⏳" sub="accounts" />
        <KpiCard label="Paid / Closed" value={paidCount} accent="amber" icon="✓" sub="accounts" />
      </div>

      {/* Collection progress */}
      <div className="rcv-progress-wrap">
        <div className="rcv-progress-top">
          <div className="rcv-progress-label">Collection Progress</div>
          <div className="rcv-progress-pct">{paidPct}%</div>
        </div>
        <div className="rcv-progress-track">
          <div className={`rcv-progress-fill ${progressClass}`} style={{ width: `${paidPct}%` }} />
        </div>
        <div className="rcv-progress-detail">
          <span>Collected: {rcvCurrency(totalPaid)}</span>
          <span>Remaining: {rcvCurrency(totalBalance)}</span>
        </div>
      </div>

      {/* Filter Header Toolbar for Receivables */}
      <div style={{ marginTop: '0', marginBottom: '0' }}>
        <FilterHeader
          searchProps={{
            value: searchQuery,
            onChange: setSearchQuery,
            placeholder: "Search by customer name, description, or contact…",
            resultCount: searchQuery.trim() ? rcvTotal : undefined,
            totalCount: kpi?.total || 0,
            resultLabel: "receivables",
          }}
          filters={STATUS_OPTS.map(s => ({
            label: s,
            value: s,
            active: statusFilter === s,
            count: statusCounts[s]
          }))}
          onFilterChange={setStatusFilter}
          accentColor="var(--th-emerald)"
        />
      </div>
      <div className="rcv-mobile-actions">
        <button className="rcv-add-btn" onClick={() => { setShowForm(true); setFormError(""); }}>+ New Receivable</button>
      </div>

      {/* Table */}
      <DataTable
        columns={rcvColumns}
        rows={receivables}
        rowKey="receivable_id"
        loading={loading}
        skeletonRows={7}
        minWidth={700}
        currentPage={rcvPage}
        totalPages={rcvTotalPages}
        onPageChange={setRcvPage}
        onRowClick={openRcvDetail}
        emptyTitle={searchQuery ? "No Receivables Match" : "No Receivables Yet"}
        emptyMessage={searchQuery ? "Try a different term" : "No receivables recorded. Credit sales will appear here automatically."}
      />

      </>}

      {/* ── BALE BOOK TAB ── */}
      {pageTab === "bale" && <>
        {/* Bale KPIs */}
        <div className="th-kpi-row">
          <KpiCard label="Total Loaned (Active)" value={rcvCompact(baleTotal)} accent="amber" icon="💵" sub={`${baleActiveCount} active bale${baleActiveCount !== 1 ? "s" : ""}`} />
          <KpiCard label="Outstanding Balance" value={rcvCompact(baleOutstanding)} accent="rose" icon="⏳" sub="still to be paid" />
          <KpiCard label="Total Paid" value={rcvCompact(bales.reduce((s,b) => s + (b.amount_paid||0), 0))} accent="emerald" icon="✓" sub="collected" />
          <KpiCard label="Fully Paid" value={balePaidCount} accent="sky" icon="✓" sub="completed" />
        </div>

        {/* Filter Header Toolbar for Bale Book */}
        <div style={{ marginBottom: '1rem' }}>
          <FilterHeader
            searchProps={{
              value: baleSearch,
              onChange: setBaleSearch,
              placeholder: "Search by employee name or code…",
              resultCount: baleSearch.trim() ? filteredBales.length : undefined,
              totalCount: bales.length,
              resultLabel: "records",
            }}
            filters={["ALL","ACTIVE","PAID"].map(s => ({
              label: s,
              value: s,
              active: baleStatusFilter === s,
              count: s === "ALL" ? bales.length : bales.filter(b=>b.status===s).length
            }))}
            onFilterChange={setBaleStatusFilter}
            accentColor="var(--th-emerald)"
          />
        </div>
        <div className="rcv-mobile-actions">
          <button className="bale-add-btn" onClick={() => { setShowBaleForm(true); setBaleFormError(""); }}>+ New Bale</button>
        </div>

        {/* Bale Table */}
        <DataTable
          columns={baleColumns}
          rows={filteredBales.slice((balePage - 1) * RCV_PAGE_SIZE, balePage * RCV_PAGE_SIZE)}
          rowKey="bale_id"
          loading={baleLoading}
          skeletonRows={5}
          minWidth={720}
          currentPage={balePage}
          totalPages={Math.ceil(filteredBales.length / RCV_PAGE_SIZE) || 1}
          onPageChange={setBalePage}
          onRowClick={openBaleDetail}
          emptyTitle={bales.length === 0 ? "No Bale Records" : "No Records Match"}
          emptyMessage='Click "+ New Bale" to record an employee loan'
        />
      </>}

      {/* ── ADD RECEIVABLE SIDEBAR ── */}
      {showForm && (
        <div className="rcv-overlay" onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="rcv-sidebar">
            <div className="rcv-sidebar-head">
              <div className="rcv-sidebar-title">New Receivable / Pautang</div>
              <button className="rcv-sidebar-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <div className="rcv-sidebar-body">
              {formError && <div className="rcv-form-error">{formError}</div>}

              <div className="rcv-form-group">
                <label className="rcv-form-label">Customer <span>*</span></label>
                <select className="rcv-form-select" value={form.customer_id} onChange={e => setF("customer_id", e.target.value)}>
                  <option value="">— Select customer —</option>
                  {customers.map(c => (
                    <option key={c.customer_id} value={c.customer_id}>{c.customer_name}{c.contact_number ? ` (${c.contact_number})` : ""}</option>
                  ))}
                </select>
              </div>

              <div className="rcv-form-group">
                <label className="rcv-form-label">Type</label>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  {TYPE_OPTS.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setF("receivable_type", t)}
                      style={{
                        flex: 1, padding: "0.42rem 0.3rem", borderRadius: "6px", cursor: "pointer",
                        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.82rem",
                        textTransform: "uppercase", letterSpacing: "0.04em",
                        background: form.receivable_type === t ? "var(--th-emerald-bg)" : "var(--th-bg-input)",
                        border: `1px solid ${form.receivable_type === t ? "var(--th-emerald)" : "var(--th-border-strong)"}`,
                        color: form.receivable_type === t ? "var(--th-emerald)" : "var(--th-text-dim)",
                        transition: "all 0.15s"
                      }}
                    >{t}</button>
                  ))}
                </div>
              </div>

              <div className="rcv-form-group">
                <label className="rcv-form-label">Description / Items</label>
                <textarea
                  className="rcv-form-textarea"
                  placeholder="e.g. 2pcs Maxxis 195/65R15, wheel balancing…"
                  value={form.description}
                  onChange={e => setF("description", e.target.value)}
                  rows={3}
                />
              </div>

              <div className="rcv-form-row">
                <div className="rcv-form-group">
                  <label className="rcv-form-label">Total Amount <span>*</span></label>
                  <input
                    type="number" min="0" step="0.01"
                    className="rcv-form-input"
                    placeholder="0.00"
                    value={form.original_amount}
                    onChange={e => setF("original_amount", e.target.value)}
                  />
                </div>
                <div className="rcv-form-group">
                  <label className="rcv-form-label">Down Payment</label>
                  <input
                    type="number" min="0" step="0.01"
                    className="rcv-form-input"
                    placeholder="0.00"
                    value={form.down_payment}
                    onChange={e => setF("down_payment", e.target.value)}
                  />
                </div>
              </div>

              {(form.original_amount || form.down_payment) && (
                <div style={{ background: "var(--th-rose-bg)", border: "1px solid var(--th-rose)", borderRadius: "8px", padding: "0.6rem 0.8rem", fontSize: "0.88rem" }}>
                  <span style={{ color: "var(--th-text-muted)" }}>Balance to collect: </span>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "1.05rem", color: "var(--th-rose)" }}>
                    {rcvCurrency(balancePreview())}
                  </span>
                </div>
              )}

              <div className="rcv-form-group">
                <label className="rcv-form-label">Due Date</label>
                <input
                  type="date"
                  className="rcv-form-input"
                  value={form.due_date}
                  onChange={e => setF("due_date", e.target.value)}
                />
              </div>

              <div className="rcv-form-group">
                <label className="rcv-form-label">Notes</label>
                <textarea
                  className="rcv-form-textarea"
                  placeholder="Any additional notes…"
                  value={form.notes}
                  onChange={e => setF("notes", e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <div className="rcv-sidebar-actions">
              <button className="rcv-btn-cancel" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="rcv-btn-primary" onClick={submitForm} disabled={saving}>
                {saving ? "Saving…" : "Save Receivable"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RECEIVABLE DETAIL MODAL (details + pay + history) ── */}
      {rcvDetailTarget && (
        <div className="rcv-modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeRcvDetail(); }}>
          <div className="rcv-hist-modal" style={{maxWidth:520,width:"94vw"}}>
            <div className="rcv-modal-head">
              <div className="rcv-modal-title">{rcvDetailTarget.customer_name}{rcvDetailTarget.receivable_type ? <span style={{fontWeight:400,fontSize:"0.82rem",marginLeft:"0.5rem",color:"var(--th-text-dim)"}}>— {rcvDetailTarget.receivable_type}</span> : ""}</div>
              <button className="rcv-sidebar-close" onClick={closeRcvDetail}>×</button>
            </div>

            <div style={{flex:1,minHeight:0,overflowY:"auto"}}>
            {/* Summary 2×2 grid */}
            <div className="rcv-detail-grid">
              <div className="rcv-detail-card">
                <div className="rcv-detail-card-label">Original</div>
                <div className="rcv-detail-card-value">{rcvCurrency(rcvDetailTarget.original_amount)}</div>
              </div>
              <div className="rcv-detail-card">
                <div className="rcv-detail-card-label">Paid</div>
                <div className="rcv-detail-card-value" style={{color:"var(--th-emerald)"}}>{rcvCurrency(rcvDetailTarget.amount_paid||0)}</div>
              </div>
              <div className="rcv-detail-card">
                <div className="rcv-detail-card-label">Balance</div>
                <div className="rcv-detail-card-value" style={{color:rcvDetailTarget.balance_amount<=0?"var(--th-emerald)":"var(--th-rose)"}}>{rcvCurrency(rcvDetailTarget.balance_amount)}</div>
              </div>
              <div className="rcv-detail-card">
                <div className="rcv-detail-card-label">Status</div>
                <div className="rcv-detail-card-value"><span className={`rcv-badge rcv-badge-${rcvDetailTarget.status}`}>{rcvDetailTarget.status}</span></div>
              </div>
            </div>
            {(rcvDetailTarget.description || rcvDetailTarget.due_date) && (
              <div style={{padding:"0.5rem 1.1rem",fontSize:"0.82rem",color:"var(--th-text-dim)",borderBottom:"1px solid var(--th-border)",display:"flex",gap:"1rem",flexWrap:"wrap"}}>
                {rcvDetailTarget.description && <span>{rcvDetailTarget.description}</span>}
                {rcvDetailTarget.due_date && <span style={{color: rcvDetailTarget.due_date < TODAY && rcvDetailTarget.status==="OPEN" ? "var(--th-rose)" : "var(--th-text-dim)"}}>Due: {rcvDetailTarget.due_date}</span>}
              </div>
            )}

            {/* Record payment form — only if OPEN */}
            {rcvDetailTarget.status !== "PAID" && (
              <div style={{padding:"0.85rem 1.1rem",borderBottom:"1px solid var(--th-border)"}}>
                <div style={{fontSize:"0.75rem",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"var(--th-sky)",marginBottom:"0.6rem"}}>Record Payment</div>
                {payError && <div className="rcv-form-error" style={{marginBottom:"0.5rem"}}>{payError}</div>}
                <div style={{display:"flex",gap:"0.6rem",flexWrap:"wrap",alignItems:"flex-end"}}>
                  <div className="rcv-form-group" style={{flex:"1 1 110px",marginBottom:0}}>
                    <label className="rcv-form-label" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span>Amount</span>
                      <button type="button" onClick={() => setPayForm(p => ({...p, amount: String(rcvDetailTarget.balance_amount)}))}
                        style={{fontSize:'0.68rem',fontWeight:700,padding:'0.1rem 0.45rem',borderRadius:5,border:'1px solid var(--th-emerald)',background:'var(--th-emerald-bg)',color:'var(--th-emerald)',cursor:'pointer',lineHeight:1.4}}>
                        FULL
                      </button>
                    </label>
                    <input type="number" min="0.01" step="0.01" className="rcv-form-input" placeholder="₱ 0.00"
                      max={rcvDetailTarget?.balance_amount}
                      value={payForm.amount}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        const bal = rcvDetailTarget?.balance_amount || 0;
                        setPayForm(p => ({...p, amount: (!isNaN(val) && val > bal) ? String(bal) : e.target.value}));
                      }} autoFocus />
                  </div>
                  <div className="rcv-form-group" style={{flex:"1 1 130px",marginBottom:0}}>
                    <label className="rcv-form-label">Date</label>
                    <input type="date" className="rcv-form-input" value={payForm.payment_date} onChange={e => setPayForm(p => ({...p, payment_date: e.target.value}))} />
                  </div>
                  <div className="rcv-form-group" style={{flex:"2 1 160px",marginBottom:0}}>
                    <label className="rcv-form-label">Notes</label>
                    <input type="text" className="rcv-form-input" placeholder="Optional" value={payForm.notes} onChange={e => setPayForm(p => ({...p, notes: e.target.value}))} />
                  </div>
                </div>
                <div style={{marginTop:"0.6rem"}}>
                  <label className="rcv-form-label">Method</label>
                  <div className="rcv-pay-methods">
                    {PAY_METHODS.map(m => (
                      <button key={m} className={`rcv-pm-btn${payForm.payment_method===m?" active":""}`} onClick={() => setPayForm(p => ({...p, payment_method: m}))}>{m}</button>
                    ))}
                  </div>
                </div>
                <button className="rcv-btn-primary" style={{marginTop:"0.65rem",width:"100%"}} onClick={submitPayment} disabled={paying}>
                  {paying ? "Saving…" : "✓ Confirm Payment"}
                </button>
              </div>
            )}

            {/* Payment history */}
            <div style={{padding:"0.6rem 1.1rem 0.3rem",fontSize:"0.72rem",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"var(--th-text-faint)"}}>Payment History</div>
            <div className="rcv-hist-body">
              {histLoading ? (
                <div className="rcv-center"><div className="rcv-spinner" /></div>
              ) : histPayments.length === 0 ? (
                <div className="rcv-center"><div style={{fontSize:"0.85rem"}}>No payments recorded yet.</div></div>
              ) : histPayments.map(p => (
                <div key={p.payment_id} className="rcv-hist-item">
                  <div>
                    <div style={{fontWeight:600,color:"var(--th-text-primary)"}}>{new Date(p.created_at || p.payment_date).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}</div>
                    <div style={{fontSize:"0.78rem",color:"var(--th-text-dim)"}}>{p.payment_method}{p.notes ? ` — ${p.notes}` : ""}</div>
                  </div>
                  <div className="rcv-hist-amt">+{rcvCurrency(p.amount)}</div>
                </div>
              ))}
            </div>
            </div>

            <div className="rcv-modal-foot">
              <button className="rcv-btn-cancel" onClick={closeRcvDetail} style={{flex:1}}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── NEW BALE SIDEBAR ── */}
      {showBaleForm && (
        <div className="rcv-overlay" onClick={e => { if (e.target === e.currentTarget) setShowBaleForm(false); }}>
          <div className="rcv-sidebar">
            <div className="rcv-sidebar-head">
              <div className="rcv-sidebar-title">📒 New Bale / Employee Loan</div>
              <button className="rcv-sidebar-close" onClick={() => setShowBaleForm(false)}>×</button>
            </div>
            <div className="rcv-sidebar-body">
              {baleFormError && <div className="rcv-form-error">{baleFormError}</div>}
              <div className="rcv-form-group">
                <label className="rcv-form-label">Employee <span style={{color:"var(--th-rose)"}}>*</span></label>
                <select className="rcv-form-select" value={baleForm.staff_id} onChange={e => setBF("staff_id", e.target.value)}>
                  <option value="">— Select employee —</option>
                  {staff.map(s => (
                    <option key={s.staff_id} value={s.staff_id}>{s.full_name}{s.role ? ` — ${s.role}` : ""}</option>
                  ))}
                </select>
              </div>
              <div className="rcv-form-group">
                <label className="rcv-form-label">Bale Amount <span style={{color:"var(--th-rose)"}}>*</span></label>
                <input
                  type="number" min="0" step="0.01"
                  className="rcv-form-input" placeholder="0.00"
                  value={baleForm.amount}
                  onChange={e => setBF("amount", e.target.value)}
                />
              </div>
              <div className="rcv-form-row">
                <div className="rcv-form-group">
                  <label className="rcv-form-label">Date Given</label>
                  <input type="date" className="rcv-form-input" value={baleForm.bale_date} onChange={e => setBF("bale_date", e.target.value)} />
                </div>
                <div className="rcv-form-group">
                  <label className="rcv-form-label">Expected Payback</label>
                  <input type="date" className="rcv-form-input" value={baleForm.due_date} onChange={e => setBF("due_date", e.target.value)} />
                </div>
              </div>
              {baleForm.amount && (
                <div style={{background:"var(--th-amber-bg)",border:"1px solid var(--th-amber)",borderRadius:8,padding:"0.55rem 0.8rem",fontSize:"0.88rem"}}>
                  <span style={{color:"var(--th-text-muted)"}}>Total to collect: </span>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:"1.05rem",color:"var(--th-amber)"}}>
                    {rcvCurrency(parseFloat(baleForm.amount)||0)}
                  </span>
                </div>
              )}
              <div className="rcv-form-group">
                <label className="rcv-form-label">Notes</label>
                <textarea
                  className="rcv-form-textarea"
                  placeholder="Reason for bale, payment arrangement, etc…"
                  value={baleForm.notes}
                  onChange={e => setBF("notes", e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <div className="rcv-sidebar-actions">
              <button className="rcv-btn-cancel" onClick={() => setShowBaleForm(false)}>Cancel</button>
              <button className="rcv-btn-primary" style={{background:"var(--th-amber)",color:"#1a0f00"}} onClick={submitBaleForm} disabled={baleSaving}>
                {baleSaving ? "Saving…" : "Record Bale"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BALE DETAIL MODAL (details + pay + history) ── */}
      {baleDetailTarget && (
        <div className="rcv-modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeBaleDetail(); }}>
          <div className="rcv-hist-modal" style={{maxWidth:520,width:"94vw"}}>
            <div className="rcv-modal-head">
              <div className="rcv-modal-title">📒 {baleDetailTarget.staff_name}{baleDetailTarget.role ? <span style={{fontWeight:400,fontSize:"0.82rem",marginLeft:"0.5rem",color:"var(--th-text-dim)"}}>— {baleDetailTarget.role}</span> : ""}</div>
              <button className="rcv-sidebar-close" onClick={closeBaleDetail}>×</button>
            </div>

            <div style={{flex:1,minHeight:0,overflowY:"auto"}}>
            {/* Summary 2×2 grid */}
            <div className="rcv-detail-grid">
              <div className="rcv-detail-card">
                <div className="rcv-detail-card-label">Loaned</div>
                <div className="rcv-detail-card-value">{rcvCurrency(baleDetailTarget.amount)}</div>
              </div>
              <div className="rcv-detail-card">
                <div className="rcv-detail-card-label">Paid</div>
                <div className="rcv-detail-card-value" style={{color:"var(--th-emerald)"}}>{rcvCurrency(baleDetailTarget.amount_paid||0)}</div>
              </div>
              <div className="rcv-detail-card">
                <div className="rcv-detail-card-label">Balance</div>
                <div className="rcv-detail-card-value" style={{color:baleDetailTarget.balance_amount<=0?"var(--th-emerald)":"var(--th-amber)"}}>{rcvCurrency(baleDetailTarget.balance_amount)}</div>
              </div>
              <div className="rcv-detail-card">
                <div className="rcv-detail-card-label">Status</div>
                <div className="rcv-detail-card-value"><span className={`bale-badge-${baleDetailTarget.status}`}>{baleDetailTarget.status}</span></div>
              </div>
            </div>
            {baleDetailTarget.notes && (
              <div style={{padding:"0.5rem 1.1rem",fontSize:"0.82rem",color:"var(--th-text-dim)",borderBottom:"1px solid var(--th-border)"}}>{baleDetailTarget.notes}</div>
            )}

            {/* Record payment form — only if ACTIVE */}
            {baleDetailTarget.status !== "PAID" && (
              <div style={{padding:"0.85rem 1.1rem",borderBottom:"1px solid var(--th-border)"}}>
                <div style={{fontSize:"0.75rem",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"var(--th-amber)",marginBottom:"0.6rem"}}>Record Payment (Cash)</div>
                {balePayError && <div className="rcv-form-error" style={{marginBottom:"0.5rem"}}>{balePayError}</div>}
                <div style={{display:"flex",gap:"0.6rem",flexWrap:"wrap",alignItems:"flex-end"}}>
                  <div className="rcv-form-group" style={{flex:"1 1 110px",marginBottom:0}}>
                    <label className="rcv-form-label" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      Amount
                      <button type="button" onClick={() => setBalePayForm(p => ({...p, amount: String(baleDetailTarget.balance_amount)}))}
                        style={{fontSize:"0.68rem",fontWeight:700,padding:"0.1rem 0.45rem",borderRadius:5,border:"1px solid var(--th-emerald)",background:"var(--th-emerald-bg)",color:"var(--th-emerald)",cursor:"pointer",letterSpacing:"0.04em",lineHeight:1.4}}>FULL</button>
                    </label>
                    <input type="number" min="0.01" step="0.01" max={baleDetailTarget?.balance_amount} className="rcv-form-input" placeholder="₱ 0.00"
                      value={balePayForm.amount}
                      onChange={e => { const v = parseFloat(e.target.value); setBalePayForm(p => ({...p, amount: (!isNaN(v) && v > baleDetailTarget.balance_amount) ? String(baleDetailTarget.balance_amount) : e.target.value})); }}
                      autoFocus />
                  </div>
                  <div className="rcv-form-group" style={{flex:"1 1 130px",marginBottom:0}}>
                    <label className="rcv-form-label">Date</label>
                    <input type="date" className="rcv-form-input" value={balePayForm.payment_date} onChange={e => setBalePayForm(p => ({...p, payment_date: e.target.value}))} />
                  </div>
                  <div className="rcv-form-group" style={{flex:"2 1 160px",marginBottom:0}}>
                    <label className="rcv-form-label">Notes</label>
                    <input type="text" className="rcv-form-input" placeholder="Optional" value={balePayForm.notes} onChange={e => setBalePayForm(p => ({...p, notes: e.target.value}))} />
                  </div>
                  <button className="rcv-btn-primary" style={{background:"var(--th-amber)",color:"#1a0f00",whiteSpace:"nowrap",alignSelf:"flex-end"}} onClick={submitBalePayment} disabled={balePaying}>
                    {balePaying ? "Saving…" : "✓ Confirm"}
                  </button>
                </div>
              </div>
            )}

            {/* Payment history */}
            <div style={{padding:"0.6rem 1.1rem 0.3rem",fontSize:"0.72rem",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"var(--th-text-faint)"}}>Payment History</div>
            <div className="rcv-hist-body">
              {baleHistLoading ? (
                <div className="rcv-center"><div className="rcv-spinner" /></div>
              ) : baleHistPayments.length === 0 ? (
                <div className="rcv-center"><div style={{fontSize:"0.85rem"}}>No payments recorded yet.</div></div>
              ) : baleHistPayments.map(p => (
                <div key={p.payment_id} className="rcv-hist-item">
                  <div>
                    <div style={{fontWeight:600,color:"var(--th-text-primary)"}}>{new Date(p.created_at || p.payment_date).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}</div>
                    <div style={{fontSize:"0.78rem",color:"var(--th-text-dim)"}}>Cash{p.notes ? ` — ${p.notes}` : ""}</div>
                  </div>
                  <div className="rcv-hist-amt" style={{color:"var(--th-amber)"}}>+{rcvCurrency(p.amount)}</div>
                </div>
              ))}
            </div>
            </div>

            <div className="rcv-modal-foot">
              <button className="rcv-btn-cancel" onClick={closeBaleDetail} style={{flex:1}}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm: Save Receivable */}
      {pendingRcv && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <div className="confirm-title">Confirm Save Receivable</div>
            <div className="confirm-details">
              <div className="confirm-detail-row"><span className="confirm-detail-label">Customer</span><span className="confirm-detail-val">{pendingRcv.custName}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Type</span><span className="confirm-detail-val">{pendingRcv.receivable_type}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Amount</span><span className="confirm-detail-val">{rcvCurrency(pendingRcv.original_amount)}</span></div>
              {pendingRcv.down_payment && parseFloat(pendingRcv.down_payment) > 0 && <div className="confirm-detail-row"><span className="confirm-detail-label">Down Payment</span><span className="confirm-detail-val">{rcvCurrency(parseFloat(pendingRcv.down_payment))}</span></div>}
              {pendingRcv.due_date && <div className="confirm-detail-row"><span className="confirm-detail-label">Due Date</span><span className="confirm-detail-val">{pendingRcv.due_date}</span></div>}
              {pendingRcv.description && <div className="confirm-detail-row"><span className="confirm-detail-label">Description</span><span className="confirm-detail-val">{pendingRcv.description}</span></div>}
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => setPendingRcv(null)}>Cancel</button>
              <button className="confirm-btn-ok" onClick={confirmSubmitForm} disabled={saving}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm: Record Payment */}
      {pendingPay && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <div className="confirm-title">Confirm Record Payment</div>
            <div className="confirm-details">
              <div className="confirm-detail-row"><span className="confirm-detail-label">Amount</span><span className="confirm-detail-val">{rcvCurrency(pendingPay.amt)}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Date</span><span className="confirm-detail-val">{pendingPay.date}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Method</span><span className="confirm-detail-val">{pendingPay.method}</span></div>
              {pendingPay.notes && <div className="confirm-detail-row"><span className="confirm-detail-label">Notes</span><span className="confirm-detail-val">{pendingPay.notes}</span></div>}
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => setPendingPay(null)}>Cancel</button>
              <button className="confirm-btn-ok" onClick={confirmSubmitPayment} disabled={paying}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm: Save Bale */}
      {pendingBale && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <div className="confirm-title">Confirm Save Bale</div>
            <div className="confirm-details">
              <div className="confirm-detail-row"><span className="confirm-detail-label">Employee</span><span className="confirm-detail-val">{pendingBale.staffName}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Amount</span><span className="confirm-detail-val">{rcvCurrency(pendingBale.amount)}</span></div>
              {pendingBale.due_date && <div className="confirm-detail-row"><span className="confirm-detail-label">Due Date</span><span className="confirm-detail-val">{pendingBale.due_date}</span></div>}
              {pendingBale.notes && <div className="confirm-detail-row"><span className="confirm-detail-label">Notes</span><span className="confirm-detail-val">{pendingBale.notes}</span></div>}
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => setPendingBale(null)}>Cancel</button>
              <button className="confirm-btn-ok" onClick={confirmSubmitBale} disabled={baleSaving}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm: Record Bale Payment */}
      {pendingBalePay && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <div className="confirm-title">Confirm Bale Payment</div>
            <div className="confirm-details">
              <div className="confirm-detail-row"><span className="confirm-detail-label">Amount</span><span className="confirm-detail-val">{rcvCurrency(pendingBalePay.amt)}</span></div>
              <div className="confirm-detail-row"><span className="confirm-detail-label">Date</span><span className="confirm-detail-val">{pendingBalePay.date}</span></div>
              {pendingBalePay.notes && <div className="confirm-detail-row"><span className="confirm-detail-label">Notes</span><span className="confirm-detail-val">{pendingBalePay.notes}</span></div>}
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => setPendingBalePay(null)}>Cancel</button>
              <button className="confirm-btn-ok" onClick={confirmSubmitBalePayment} disabled={balePaying}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className={`rcv-toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}

export default ReceivablesPage
