import '../pages_css/RecapPage.css';
import React from 'react'
import { API_URL, currency, apiFetch } from '../lib/config'
import Pagination from '../components/Pagination'
import KpiCard from '../components/KpiCard'
import SearchInput from '../components/SearchInput'
import FilterHeader from '../components/FilterHeader'
import { SERVICE_ROLES } from './StaffManagementPage'
import usePaginatedResource from '../hooks/usePaginatedResource'

  /* ============================================================
     TIREHUB — ENHANCED RECAP TIRES PAGE
     Drop-in replacement. Requires API_URL global + currency().
     ============================================================ */

  ;


const rcCurrency =
  typeof currency === "function"
    ? currency
    : (n) =>
      "₱" +
      Number(n || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

/* ── Constants ── */
const STATUS_FLOW = {
  INTAKE: ["SENT_TO_SUPPLIER", "REJECTED"],
  SENT_TO_SUPPLIER: ["READY_FOR_CLAIM", "REJECTED"],
  READY_FOR_CLAIM: ["CLAIMED"],
  CLAIMED: [],
  REJECTED: [],
  FORFEITED: [],
};
const STATUS_LABELS = {
  INTAKE: "Intake",
  SENT_TO_SUPPLIER: "Sent to Supplier",
  READY_FOR_CLAIM: "Ready for Claim",
  CLAIMED: "Claimed",
  REJECTED: "Rejected",
  FORFEITED: "Forfeited",
};
const STATUS_ORDER = [
  "INTAKE",
  "SENT_TO_SUPPLIER",
  "IN_INVENTORY",
  "READY_FOR_CLAIM",
  "CLAIMED",
  "REJECTED",
  "FORFEITED",
];
const STATUS_META = {
  ALL: { label: "All", color: "var(--th-text-muted)" },
  INTAKE: { label: "Intake", color: "var(--th-text-muted)" },
  SENT_TO_SUPPLIER: { label: "Sent to Supplier", color: "var(--th-sky)" },
  IN_INVENTORY: { label: "In Inventory (Shop)", color: "var(--th-emerald)" },
  READY_FOR_CLAIM: { label: "Ready for Claim", color: "var(--th-amber)" },
  CLAIMED: { label: "Claimed", color: "var(--th-violet)" },
  REJECTED: { label: "Rejected", color: "var(--th-rose)" },
  FORFEITED: { label: "Forfeited", color: "var(--th-amber)" },
};
const STATUS_ICONS_RC = {
  ALL: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  INTAKE: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  SENT_TO_SUPPLIER: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  IN_INVENTORY: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  READY_FOR_CLAIM: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  CLAIMED: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  ),
  REJECTED: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  FORFEITED: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

function isCustomerOwned(ownership_type) {
  const t = (ownership_type || "").toUpperCase();
  return t === "CUSTOMER_OWNED" || t === "CUSTOMER";
}

function casingName(job) {
  return (
    job.item_name ||
    job.casing_description ||
    [job.brand, job.design, job.size].filter(Boolean).join(" ") ||
    "—"
  );
}

function histEntryClass(eventType) {
  if (!eventType) return "";
  if (eventType.includes("CREAT")) return "JOB_CREATED";
  if (eventType.includes("SENT")) return "JOB_SENT";
  if (eventType.includes("RETURN") || eventType.includes("READY"))
    return "JOB_RETURNED";
  if (eventType.includes("CLAIM")) return "JOB_CLAIMED";
  if (eventType.includes("REJECT")) return "JOB_REJECTED";
  if (eventType.includes("FORFEIT")) return "JOB_FORFEITED";
  return "";
}

/* ── Toast ── */
function RcToast({ title, sub, onDone }) {
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
    <div className={`rc-toast${out ? " out" : ""}`}>
      <div className="rc-toast-icon">✓</div>
      <div>
        <div className="rc-toast-title">{title}</div>
        {sub && <div className="rc-toast-sub">{sub}</div>}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
function RecapPage({ shopId, onRefresh, currentStaffId, currentStaffName, isShopClosed }) {
  const [suggestions, setSuggestions] = React.useState([])
  const [showSug, setShowSug] = React.useState(false)
  const [statusFilter, setStatusFilter] = React.useState("");
  const [ownershipFilter, setOwnershipFilter] = React.useState("");
  const [dateFilter, setDateFilter] = React.useState("");
  const [showNewJobForm, setShowNewJobForm] = React.useState(false);
  const [error, setError] = React.useState("");
  const [showQuickAddCustomer, setShowQuickAddCustomer] = React.useState(false);
  const [quickCustForm, setQuickCustForm] = React.useState({ customer_name: '', company: '', contact_number: '', address: '' });
  const [quickCustSaving, setQuickCustSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [kpiCounts, setKpiCounts] = React.useState(null);
  const [isDraftLoaded, setIsDraftLoaded] = React.useState(false);

  const JOBS_PER_PAGE = 10;

  // Map virtual status tabs to real DB params
  const recapApiStatus = React.useMemo(() => {
    if (statusFilter === 'IN_INVENTORY') return 'READY_FOR_CLAIM';
    if (statusFilter === 'READY_FOR_CLAIM') return 'READY_FOR_CLAIM';
    if (statusFilter === 'RECAPPING') return '__skip__';
    return statusFilter;
  }, [statusFilter]);

  const recapApiOwnership = React.useMemo(() => {
    if (statusFilter === 'IN_INVENTORY') return 'SHOP_OWNED';
    if (statusFilter === 'READY_FOR_CLAIM') return 'CUSTOMER_OWNED';
    return ownershipFilter;
  }, [statusFilter, ownershipFilter]);

  const {
    data: jobs,
    page: currentPage, setPage: setCurrentPage,
    totalPages: recapTotalPages,
    total: recapTotal,
    search: searchQuery, setSearch: setSearchQuery,
    loading: jobsLoading,
    refetch: refetchJobs,
  } = usePaginatedResource({
    url: `${API_URL}/recap-jobs/${shopId}`,
    perPage: JOBS_PER_PAGE,
    extraParams: {
      status: recapApiStatus !== '__skip__' ? recapApiStatus : '',
      ownership_type: recapApiOwnership || '',
      dateFrom: dateFilter || '',
      dateTo: dateFilter || '',
    },
    enabled: !!shopId && recapApiStatus !== '__skip__',
    deps: [shopId, recapApiStatus, recapApiOwnership, dateFilter],
  });

  const [selectedJob, setSelectedJob] = React.useState(null);
  const [jobHistory, setJobHistory] = React.useState([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);

  const [nextStatus, setNextStatus] = React.useState("");
  const [recapCostInput, setRecapCostInput] = React.useState("");
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [showStatusModal, setShowStatusModal] = React.useState(false);

  const [showClaimModal, setShowClaimModal] = React.useState(false);
  const [claimTarget, setClaimTarget] = React.useState(null);
  const [salePrice, setSalePrice] = React.useState("");
  const [claimInstalled, setClaimInstalled] = React.useState(false);
  const [claimTiremen, setClaimTiremen] = React.useState([]);
  const [claimFittingPrice, setClaimFittingPrice] = React.useState(250);

  const [showForfeitModal, setShowForfeitModal] = React.useState(false);
  const [forfeitTarget, setForfeitTarget] = React.useState(null);
  const [forfeitReason, setForfeitReason] = React.useState("");

  const [selectedIds, setSelectedIds] = React.useState(new Set());
  const [showBatchModal, setShowBatchModal] = React.useState(false);
  const [batchAction, setBatchAction] = React.useState(null); // { ids, newStatus, label, buttonLabel }
  const [batchLoading, setBatchLoading] = React.useState(false);
  const [batchResults, setBatchResults] = React.useState(null);

  const [customers, setCustomers] = React.useState([]);
  const [suppliers, setSuppliers] = React.useState([]);
  const [staff, setStaff] = React.useState([]);
  const [defaultSupplierId, setDefaultSupplierId] = React.useState(
    () => localStorage.getItem(`th-recap-default-supplier-${shopId}`) || ""
  );

  // RECAPPING inventory
  const [recappingItems, setRecappingItems] = React.useState([])
  const [selectedRecapItem, setSelectedRecapItem] = React.useState(null)
  const [recapIntakeForm, setRecapIntakeForm] = React.useState({ design: 'Topcap', supplier_id: '', recap_cost: '', expected_selling_price: '' })
  const [recapIntaking, setRecapIntaking] = React.useState(false)

  React.useEffect(() => {
    apiFetch(`${API_URL}/items/${shopId}?category=RECAPPING`)
      .then(r => r.json())
      .then(d => setRecappingItems(Array.isArray(d) ? d.filter(i => i.current_quantity > 0) : []))
      .catch(() => { })
  }, [shopId])

  // --- Persistence Logic ---
  React.useEffect(() => {
    if (!shopId) return;
    try {
      const jDraft = localStorage.getItem(`th-rcp-job-draft-${shopId}`);
      if (jDraft) setNewJob(JSON.parse(jDraft));
      const cDraft = localStorage.getItem(`th-rcp-casings-draft-${shopId}`);
      if (cDraft) setCasings(JSON.parse(cDraft));
      const jOpen = localStorage.getItem(`th-rcp-job-open-${shopId}`);
      if (jOpen) setShowNewJobForm(jOpen === "true");

      const iDraft = localStorage.getItem(`th-rcp-intake-draft-${shopId}`);
      if (iDraft) setRecapIntakeForm(JSON.parse(iDraft));
      const iItem = localStorage.getItem(`th-rcp-intake-item-${shopId}`);
      if (iItem) setSelectedRecapItem(JSON.parse(iItem));
    } catch (e) { console.error("Failed to load Recap drafts", e); }
    setIsDraftLoaded(true);
  }, [shopId]);

  React.useEffect(() => {
    if (!shopId || !isDraftLoaded) return;
    localStorage.setItem(`th-rcp-job-draft-${shopId}`, JSON.stringify(newJob));
    localStorage.setItem(`th-rcp-casings-draft-${shopId}`, JSON.stringify(casings));
    localStorage.setItem(`th-rcp-job-open-${shopId}`, String(showNewJobForm));
    localStorage.setItem(`th-rcp-intake-draft-${shopId}`, JSON.stringify(recapIntakeForm));
    localStorage.setItem(`th-rcp-intake-item-${shopId}`, JSON.stringify(selectedRecapItem));
  }, [newJob, casings, showNewJobForm, recapIntakeForm, selectedRecapItem, shopId, isDraftLoaded]);

  // Pricing defaults
  const [priceDefaults, setPriceDefaults] = React.useState({}); // key: `${size}|${type}` -> { recap_cost, selling_price }
  const [showPricingModal, setShowPricingModal] = React.useState(false);
  const [pricingDraft, setPricingDraft] = React.useState({});
  const [pricingSaving, setPricingSaving] = React.useState(false);

  const RECAP_SIZES = ['700-15', '750-15', '700-16', '750-16', '825-16'];
  const RECAP_TYPES = ['Fullcap', 'Topcap', 'Cold Process'];

  const blankCasing = () => ({ brand: "", design: "Topcap", size: "", dot_number: "", recap_cost: "", expected_selling_price: "" });
  const [newJob, setNewJob] = React.useState({ ownership_type: "CUSTOMER_OWNED", customer_id: "", supplier_id: "" });
  const [casings, setCasings] = React.useState([blankCasing()]);

  const updateCasing = (idx, patch) => {
    setCasings(prev => prev.map((c, i) => {
      if (i !== idx) return c;
      const updated = { ...c, ...patch };
      if (patch.size !== undefined || patch.design !== undefined) {
        const def = priceDefaults[`${updated.size}|${updated.design}`];
        if (def) {
          updated.recap_cost = def.recap_cost ? String(def.recap_cost) : '';
          updated.expected_selling_price = def.selling_price ? String(def.selling_price) : '';
        }
      }
      return updated;
    }));
  };

  // Theme re-render
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => {
    const obs = new MutationObserver(() => forceUpdate());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    fetchCustomers();
    fetchSuppliers();
    apiFetch(`${API_URL}/staff/${shopId}`).then(r => r.json()).then(d => setStaff(Array.isArray(d) ? d : [])).catch(() => { });
    fetchPriceDefaults();
    return () => obs.disconnect();
  }, [shopId]);

  // KPI: status counts (no status filter — all statuses simultaneously for tab badges)
  React.useEffect(() => {
    if (!shopId) return;
    const qs = new URLSearchParams();
    if (searchQuery.trim()) qs.set('q', searchQuery.trim());
    if (ownershipFilter) qs.set('ownership_type', ownershipFilter);
    if (dateFilter) { qs.set('dateFrom', dateFilter); qs.set('dateTo', dateFilter); }
    apiFetch(`${API_URL}/recap-jobs-kpi/${shopId}?${qs}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setKpiCounts(d); })
      .catch(() => { });
  }, [shopId, searchQuery, ownershipFilter, dateFilter]);

  // Suggestions from current page (search is server-side)
  React.useEffect(() => {
    if (!searchQuery.trim()) { setSuggestions([]); return; }
    const q = searchQuery.toLowerCase();
    const seen = new Set();
    const sug = [];
    jobs.forEach(j => {
      [
        { val: j.customer_name, type: 'Customer' },
        { val: j.supplier_name, type: 'Supplier' },
        { val: j.brand, type: 'Brand' },
        { val: j.size, type: 'Size' },
        { val: j.design, type: 'Design' },
      ].forEach(({ val, type }) => {
        if (val && val.toLowerCase().includes(q) && !seen.has(val)) {
          seen.add(val); sug.push({ text: val, type });
        }
      });
    });
    setSuggestions(sug.slice(0, 8));
  }, [searchQuery, jobs]);

  function fetchJobs() { refetchJobs(); }
  function fetchCustomers() {
    apiFetch(`${API_URL}/customers/${shopId}`)
      .then((r) => r.json())
      .then((d) => setCustomers(Array.isArray(d) ? d : []))
      .catch(() => { });
  }

  async function handleQuickAddCustomer() {
    if (!quickCustForm.customer_name.trim()) return setError('Customer name is required.');
    setQuickCustSaving(true);
    try {
      const res = await apiFetch(`${API_URL}/customers`, {
        method: 'POST',
        body: JSON.stringify({ shop_id: shopId, ...quickCustForm }),
      }).then(r => r.json());
      if (res.error) throw new Error(res.error);
      fetchCustomers();
      setNewJob(j => ({ ...j, customer_id: res.customer_id }));
      setShowQuickAddCustomer(false);
      setQuickCustForm({ customer_name: '', company: '', contact_number: '', address: '' });
    } catch (e) {
      setError(e.message || 'Failed to add customer');
    } finally {
      setQuickCustSaving(false);
    }
  }
  function fetchSuppliers() {
    apiFetch(`${API_URL}/suppliers/${shopId}`)
      .then((r) => r.json())
      .then((d) => setSuppliers(Array.isArray(d) ? d : []))
      .catch(() => { });
  }
  function fetchPriceDefaults() {
    apiFetch(`${API_URL}/recap-price-defaults/${shopId}`)
      .then(r => r.json())
      .then(rows => {
        if (!Array.isArray(rows)) return;
        const map = {};
        rows.forEach(r => {
          // Unified standard pricing — always keyed as CUSTOMER_OWNED (single price set)
          if ((r.ownership_type || 'CUSTOMER_OWNED') === 'CUSTOMER_OWNED') {
            map[`${r.size}|${r.recap_type}`] = { recap_cost: r.recap_cost, selling_price: r.selling_price };
          }
        });
        setPriceDefaults(map);
      })
      .catch(() => { });
  }

  function savePricingDefaults() {
    setPricingSaving(true);
    const prices = [];
    RECAP_SIZES.forEach(size => {
      RECAP_TYPES.forEach(type => {
        const key = `${size}|${type}`;
        const val = pricingDraft[key] || {};
        prices.push({ size, recap_type: type, ownership_type: 'CUSTOMER_OWNED', recap_cost: parseFloat(val.recap_cost) || 0, selling_price: parseFloat(val.selling_price) || 0 });
      });
    });
    apiFetch(`${API_URL}/recap-price-defaults/${shopId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prices }),
    })
      .then(r => r.json())
      .then(() => {
        fetchPriceDefaults();
        setShowPricingModal(false);
        setToast({ title: 'Pricing Saved', sub: 'Default prices updated' });
      })
      .catch(() => setError('Failed to save pricing defaults'))
      .finally(() => setPricingSaving(false));
  }

  function openPricingModal() {
    const draft = {};
    RECAP_SIZES.forEach(size => {
      RECAP_TYPES.forEach(type => {
        const key = `${size}|${type}`;
        draft[key] = { ...(priceDefaults[key] || { recap_cost: '', selling_price: '' }) };
        if (draft[key].recap_cost === 0) draft[key].recap_cost = '';
        if (draft[key].selling_price === 0) draft[key].selling_price = '';
      });
    });
    setPricingDraft(draft);
    setShowPricingModal(true);
  }

  function fetchJobHistory(jobId) {
    setHistoryLoading(true);
    apiFetch(`${API_URL}/recap-jobs/${jobId}/history`)
      .then((r) => r.json())
      .then((d) => setJobHistory(Array.isArray(d) ? d : []))
      .catch(() => setJobHistory([]))
      .finally(() => setHistoryLoading(false));
  }

  function handleJobClick(job) {
    setSelectedJob(job);
    setSelectedRecapItem(null);
    fetchJobHistory(job.job_id);
    setNextStatus("");
    setRecapCostInput("");
    setError("");
  }

  async function handleRecapIntake() {
    if (!recapIntakeForm.supplier_id) return setError('Please select a recap supplier.');
    if (!recapIntakeForm.recap_cost || parseFloat(recapIntakeForm.recap_cost) <= 0) return setError('Recap cost is required.');
    if (!recapIntakeForm.expected_selling_price || parseFloat(recapIntakeForm.expected_selling_price) <= 0) return setError('Selling price is required.');
    setRecapIntaking(true);
    try {
      const item = selectedRecapItem;
      const res = await apiFetch(`${API_URL}/recap-jobs`, {
        method: 'POST',
        body: JSON.stringify({
          shop_id: shopId,
          ownership_type: 'SHOP_OWNED',
          supplier_id: recapIntakeForm.supplier_id,
          brand: item.brand || item.item_name,
          design: recapIntakeForm.design,
          size: item.size || '',
          dot_number: item.dot_number || '',
          recap_cost: parseFloat(recapIntakeForm.recap_cost),
          expected_selling_price: parseFloat(recapIntakeForm.expected_selling_price),
          intake_date: new Date().toISOString().slice(0, 10),
          created_by: 'SYSTEM',
          // Source item info — backend uses these to compute total cost and maintain margin
          source_item_id: item.item_id,
          source_unit_cost: item.unit_cost,
          source_selling_price: item.selling_price,
        })
      }).then(r => r.json());
      if (res.error) throw new Error(res.error);
      setToast({ title: 'Job Created', sub: `${item.item_name} sent for recapping` });
      setSelectedRecapItem(null);
      // Refresh both job list and recapping items list
      refetchJobs();
      apiFetch(`${API_URL}/items/${shopId}?category=RECAPPING`).then(r => r.json()).then(d => {
        if (Array.isArray(d)) setRecappingItems(d.filter(i => (i.current_quantity || 0) > 0));
      });
      localStorage.removeItem(`th-rcp-intake-draft-${shopId}`);
      localStorage.removeItem(`th-rcp-intake-item-${shopId}`);
    } catch (e) {
      setError(e.message || 'Failed to create intake');
    } finally {
      setRecapIntaking(false);
    }
  }

  function generateSKU(brand, design, size) {
    if (!brand || !size) return "";
    const b = brand.trim().substring(0, 5).toUpperCase();
    const d = design ? design.trim().substring(0, 4).toUpperCase() : "RCAP";
    const sz = size.trim().replace(/[\/\-]/g, "");
    return `RECAP-${b}-${d}-${sz}`;
  }

  function resetForm() {
    setNewJob({ ownership_type: "CUSTOMER_OWNED", customer_id: "", supplier_id: "" });
    setCasings([blankCasing()]);
    setShowQuickAddCustomer(false);
    setQuickCustForm({ customer_name: '', company: '', contact_number: '', address: '' });
    localStorage.removeItem(`th-rcp-job-draft-${shopId}`);
    localStorage.removeItem(`th-rcp-casings-draft-${shopId}`);
    localStorage.removeItem(`th-rcp-job-open-${shopId}`);
  }

  function hideNewJobForm() {
    setShowNewJobForm(false);
  }

  async function createJob() {
    if (newJob.ownership_type === "CUSTOMER_OWNED" && !newJob.customer_id) {
      setError("Customer is required for Customer-Owned jobs"); return;
    }
    if (!newJob.supplier_id) { setError("Recap Supplier is required"); return; }
    for (let i = 0; i < casings.length; i++) {
      const c = casings[i];
      if (!c.brand || !c.size) { setError(`Casing ${i + 1}: Brand and Size are required`); return; }
      if (!c.dot_number || c.dot_number.length !== 4) { setError(`Casing ${i + 1}: DOT must be 4 digits`); return; }
    }
    setLoading(true);
    setError("");
    const intakeDate = new Date().toISOString().slice(0, 10);
    const deadlineDate = (() => { const d = new Date(); d.setDate(d.getDate() + 60); return d.toISOString().slice(0, 10); })();
    try {
      for (const c of casings) {
        const res = await apiFetch(`${API_URL}/recap-jobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shop_id: shopId,
            ownership_type: newJob.ownership_type,
            customer_id: newJob.customer_id || null,
            supplier_id: newJob.supplier_id,
            brand: c.brand,
            design: c.design || null,
            size: c.size,
            dot_number: c.dot_number || null,
            recap_cost: parseFloat(c.recap_cost) || 0,
            expected_selling_price: parseFloat(c.expected_selling_price) || 0,
            intake_date: intakeDate,
            claim_deadline_date: deadlineDate,
            created_by: "STAFF",
          }),
        }).then(r => r.json().then(d => ({ ok: r.ok, data: d })));
        if (!res.ok) throw new Error(res.data.error || "Failed to create job");
      }
      localStorage.removeItem(`th-rcp-job-draft-${shopId}`);
      localStorage.removeItem(`th-rcp-casings-draft-${shopId}`);
      localStorage.removeItem(`th-rcp-job-open-${shopId}`);
      resetForm();
      setShowNewJobForm(false);
      setToast({ title: "Jobs Created", sub: `${casings.length} casing${casings.length > 1 ? 's' : ''} added` });
      fetchJobs();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function submitStatusUpdate() {
    if (!nextStatus) {
      setError("Please select a new status");
      return;
    }
    setLoading(true);
    const body = {
      new_status: nextStatus,
      performed_by_staff_id: currentStaffId || null,
      rejection_reason: nextStatus === "REJECTED" ? (rejectionReason.trim() || null) : undefined,
    };
    if (recapCostInput) body.recap_cost = parseFloat(recapCostInput);
    apiFetch(`${API_URL}/recap-jobs/${selectedJob.job_id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then((res) => {
        if (!res.ok)
          throw new Error(res.data.error || "Failed to update status");
        const updated = { ...selectedJob, status: nextStatus };
        if (recapCostInput) updated.recap_cost = parseFloat(recapCostInput);
        setSelectedJob(updated);
        setShowStatusModal(false);
        fetchJobHistory(selectedJob.job_id);
        setNextStatus("");
        setRecapCostInput("");
        setRejectionReason("");
        setError("");
        setToast({
          title: "Status Updated",
          sub: `→ ${STATUS_LABELS[nextStatus]}`,
        });
        fetchJobs();
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  async function batchUpdateStatus(jobIds, newStatus, toastMsg) {
    setBatchLoading(true);
    setBatchResults(null);
    const results = [];
    for (const job_id of jobIds) {
      try {
        const r = await apiFetch(`${API_URL}/recap-jobs/${job_id}/status`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ new_status: newStatus, performed_by_staff_id: null }),
        });
        const d = await r.json();
        results.push({ job_id, ok: r.ok, message: r.ok ? "Done" : (d.error || "Failed") });
      } catch (e) {
        results.push({ job_id, ok: false, message: e.message });
      }
    }
    setBatchResults(results);
    setBatchLoading(false);
    const succeeded = results.filter(r => r.ok).map(r => r.job_id);
    if (succeeded.length) {
      setSelectedIds(prev => { const n = new Set(prev); succeeded.forEach(id => n.delete(id)); return n; });
      setToast({ title: "Batch Updated", sub: `${succeeded.length} job(s) ${toastMsg}` });
      fetchJobs();
      if (selectedJob && succeeded.includes(selectedJob.job_id)) {
        setSelectedJob(prev => ({ ...prev, status: newStatus }));
        fetchJobHistory(selectedJob.job_id);
      }
    }
  }

  const batchSendToSupplier = (ids) => batchUpdateStatus(ids, "SENT_TO_SUPPLIER", "sent to supplier");
  const batchMarkReadyForClaim = (ids) => batchUpdateStatus(ids, "READY_FOR_CLAIM", "marked ready for claim");

  function submitClaim() {
    setLoading(true);
    apiFetch(`${API_URL}/recap-jobs/${claimTarget.job_id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: claimTarget.customer_id || null,
        performed_by_staff_id: currentStaffId || null,
        sale_price: salePrice ? parseFloat(salePrice) : undefined,
        installed: claimInstalled,
        tireman_ids: claimInstalled ? claimTiremen : [],
        tireman_commission_total: claimInstalled ? claimFittingPrice * Math.max(claimTiremen.length, 1) : 0,
      }),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then((res) => {
        if (!res.ok) throw new Error(res.data.error || "Failed to claim job");
        if (selectedJob?.job_id === claimTarget.job_id) {
          setSelectedJob({
            ...selectedJob,
            status: "CLAIMED",
            related_sale_id: res.data.sale_id,
          });
          fetchJobHistory(claimTarget.job_id);
        }
        setShowClaimModal(false);
        setClaimTarget(null);
        setSalePrice("");
        setClaimInstalled(false);
        setClaimTiremen([]);
        setClaimFittingPrice(250);
        setError("");
        setToast({ title: "Job Claimed", sub: `Sale ${res.data.sale_id}` });
        fetchJobs();
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function submitForfeit() {
    setLoading(true);
    apiFetch(`${API_URL}/recap-jobs/${forfeitTarget.job_id}/forfeit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        forfeiture_reason: forfeitReason.trim() || null,
        performed_by_staff_id: currentStaffId || null,
      }),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then((res) => {
        if (!res.ok) throw new Error(res.data.error || "Failed to forfeit job");
        if (selectedJob?.job_id === forfeitTarget.job_id) {
          setSelectedJob({ ...selectedJob, status: "FORFEITED", ownership_type: "SHOP_OWNED" });
          fetchJobHistory(forfeitTarget.job_id);
        }
        setShowForfeitModal(false);
        setForfeitTarget(null);
        setForfeitReason("");
        setError("");
        setToast({ title: "Job Forfeited — Ownership transferred to shop" });
        fetchJobs();
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  /* Derived */
  const statusCounts = kpiCounts?.statusCounts || {};
  const currentJobs = jobs;
  const hasFilters = searchQuery || statusFilter || ownershipFilter || dateFilter;

  function exportExcel() {
    if (statusFilter === 'RECAPPING') {
      if (!recappingItems || recappingItems.length === 0) return;
      import('xlsx').then(XLSX => {
        const rows = recappingItems.map(j => ({
          'SKU': j.sku,
          'Casing Name': j.item_name || '',
          'Size': j.size || '',
          'Brand': j.brand || '',
          'Design': j.design || '',
          'DOT': j.dot_number || '',
          'Stock Quantity': j.current_quantity || 0,
          'Supplier': j.supplier_name || '',
          'Unit Cost (₱)': j.unit_cost || 0,
          'Selling Price (₱)': j.selling_price || 0,
        }))
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'For Recapping')
        XLSX.writeFile(wb, `for-recapping-${new Date().toISOString().slice(0, 10)}.xlsx`)
      })
      return;
    }

    if (!recapTotal) return
    import('xlsx').then(XLSX => {
      const rows = jobs.map(j => ({
        'Job ID': j.job_id,
        'Intake Date': j.intake_date?.slice(0, 10) || '',
        'Customer': j.customer_name || '',
        'Brand': j.brand || '',
        'Design': j.design || '',
        'Size': j.size || '',
        'Description': j.casing_description || '',
        'Ownership': j.ownership_type || '',
        'Status': j.status || '',
        'Supplier': j.supplier_name || '',
        'Recap Cost (₱)': j.recap_cost || 0,
        'Selling Price (₱)': j.expected_selling_price || 0,
      }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Recap Jobs')
      XLSX.writeFile(wb, `recap-jobs-${new Date().toISOString().slice(0, 10)}.xlsx`)
    })
  }

  return (
    <>
      {toast && (
        <RcToast
          title={toast.title}
          sub={toast.sub}
          onDone={() => setToast(null)}
        />
      )}

      {/* ── Claim Modal ── */}
      {showClaimModal && claimTarget && (
        <div
          className="rc-overlay rc-overlay-top"
          onClick={(e) =>
            e.target === e.currentTarget && setShowClaimModal(false)
          }
        >
          <div className="rc-modal">
            <div className="rc-modal-header">
              <div className="rc-modal-title">Claim Recap Job</div>
              <button
                className="rc-modal-close"
                onClick={() => {
                  setShowClaimModal(false);
                  setError("");
                }}
              >
                ✕
              </button>
            </div>
            <div className="rc-modal-body">
              <div className="rc-modal-job-card">
                <div className="rc-modal-job-name">
                  {casingName(claimTarget)}
                </div>
                <div className="rc-modal-job-id">{claimTarget.job_id}</div>
                {claimTarget.customer_name && (
                  <div className="rc-modal-job-meta">
                    Customer: {claimTarget.customer_name}
                  </div>
                )}
              </div>
              {error && (
                <div className="rc-error" style={{ marginBottom: "0.75rem" }}>
                  <span>{error}</span>
                  <button className="rc-error-x" onClick={() => setError("")}>✕</button>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div>
                  <label className="rc-form-label">Sale Price (₱)</label>
                  <input type="number" step="0.01" className="rc-input" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="Leave blank to use expected selling price" />
                </div>
                {/* Installation toggle */}
                <div style={{ background: "var(--th-bg-card-alt)", border: "1px solid var(--th-border)", borderRadius: "8px", padding: "0.75rem" }}>
                  <button
                    type="button"
                    onClick={() => { setClaimInstalled(p => !p); setClaimTiremen([]); }}
                    style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%" }}
                  >
                    <div style={{ width: "2rem", height: "1.1rem", borderRadius: "999px", background: claimInstalled ? "var(--th-emerald)" : "var(--th-border-strong)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                      <div style={{ position: "absolute", top: "0.1rem", left: claimInstalled ? "0.95rem" : "0.1rem", width: "0.9rem", height: "0.9rem", borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                    </div>
                    <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "0.88rem", textTransform: "uppercase", letterSpacing: "0.05em", color: claimInstalled ? "var(--th-emerald)" : "var(--th-text-muted)" }}>
                      {claimInstalled ? "Tire Installed" : "Not Installed (Pickup Only)"}
                    </span>
                  </button>

                  {claimInstalled && (() => {
                    const tiremen = staff.filter(s => SERVICE_ROLES.map(r => r.toLowerCase()).includes((s.role || '').toLowerCase()));
                    return (
                      <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                        <div>
                          <label className="rc-form-label" style={{ color: "var(--th-amber)" }}>Tireman(s) <span style={{ color: "var(--th-rose)" }}>*</span></label>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.35rem" }}>
                            {tiremen.map(s => {
                              const active = claimTiremen.includes(s.staff_id);
                              return (
                                <button key={s.staff_id} type="button"
                                  onClick={() => setClaimTiremen(prev => active ? prev.filter(id => id !== s.staff_id) : [...prev, s.staff_id])}
                                  style={{ padding: "0.3rem 0.75rem", borderRadius: "999px", border: `1.5px solid ${active ? "var(--th-orange)" : "var(--th-border-strong)"}`, background: active ? "var(--th-orange-bg)" : "var(--th-bg-input)", color: active ? "var(--th-orange)" : "var(--th-text-muted)", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: "0.82rem", textTransform: "uppercase", cursor: "pointer", transition: "all 0.15s" }}>
                                  {s.full_name}
                                </button>
                              );
                            })}
                            {tiremen.length === 0 && <span style={{ fontSize: "0.78rem", color: "var(--th-text-faint)" }}>No service staff found</span>}
                          </div>
                        </div>
                        <div>
                          <label className="rc-form-label">Fitting Fee (₱) per tire</label>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <input type="number" step="1" min="0" className="rc-input" value={claimFittingPrice} onChange={e => setClaimFittingPrice(Math.max(0, Number(e.target.value)))} style={{ flex: 1 }} />
                            {claimTiremen.length > 0 && (
                              <span style={{ fontSize: "0.78rem", color: "var(--th-text-dim)", whiteSpace: "nowrap" }}>
                                ÷ {claimTiremen.length} = ₱{(claimFittingPrice / claimTiremen.length).toFixed(0)} each
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
            <div className="rc-modal-footer">
              <button
                className="rc-btn rc-btn-emerald"
                style={{ flex: 1, padding: "0.65rem" }}
                disabled={loading || (claimInstalled && claimTiremen.length === 0)}
                onClick={submitClaim}
              >
                {loading ? "Processing…" : "✓ Confirm Claim"}
              </button>
              <button
                className="rc-btn rc-btn-slate"
                style={{ flex: 1, padding: "0.65rem" }}
                onClick={() => {
                  setShowClaimModal(false);
                  setSalePrice("");
                  setClaimInstalled(false);
                  setClaimTiremen([]);
                  setClaimFittingPrice(250);
                  setError("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Status Confirm Modal ── */}
      {showStatusModal && nextStatus && selectedJob && (
        <div className="rc-overlay rc-overlay-top" onClick={(e) => e.target === e.currentTarget && setShowStatusModal(false)}>
          <div className="rc-modal">
            <div className="rc-modal-header">
              <div className="rc-modal-title">Confirm Status Update</div>
              <button className="rc-modal-close" onClick={() => { setShowStatusModal(false); setError(""); }}>✕</button>
            </div>
            <div className="rc-modal-body">
              <div className="rc-modal-job-card">
                <div className="rc-modal-job-name">{casingName(selectedJob)}</div>
                <div className="rc-modal-job-id">{selectedJob.job_id}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", margin: "0.75rem 0", justifyContent: "center" }}>
                <span className={`rc-badge rc-badge-${selectedJob.status}`}>{STATUS_LABELS[selectedJob.status]}</span>
                <span style={{ color: "var(--th-text-faint)", fontSize: "1rem" }}>→</span>
                <span className={`rc-badge rc-badge-${nextStatus}`}>{STATUS_LABELS[nextStatus]}</span>
              </div>
              {nextStatus === "REJECTED" && (
                <div style={{ marginTop: "0.5rem" }}>
                  <label className="rc-form-label">Rejection Reason <span style={{ color: "var(--th-text-faint)", fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
                  <textarea
                    className="rc-input"
                    rows={3}
                    style={{ resize: "vertical", marginTop: "0.3rem" }}
                    placeholder="e.g. casing too worn, customer cancelled..."
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                  />
                </div>
              )}
              {error && (
                <div className="rc-error" style={{ marginBottom: "0.75rem" }}>
                  <span>{error}</span>
                  <button className="rc-error-x" onClick={() => setError("")}>✕</button>
                </div>
              )}
            </div>
            <div className="rc-modal-footer">
              <button
                className={`rc-btn ${nextStatus === "REJECTED" ? "rc-btn-rose" : "rc-btn-orange"}`}
                style={{ flex: 1, padding: "0.65rem" }}
                disabled={loading}
                onClick={() => { submitStatusUpdate(); setShowStatusModal(false); }}
              >
                {loading ? "Updating…" : nextStatus === "REJECTED" ? "Confirm → Reject Job" : nextStatus === "READY_FOR_CLAIM" && !isCustomerOwned(selectedJob.ownership_type) ? "Confirm → Add to Inventory" : `Confirm → ${STATUS_LABELS[nextStatus]}`}
              </button>
              <button
                className="rc-btn rc-btn-slate"
                style={{ flex: 1, padding: "0.65rem" }}
                onClick={() => { setShowStatusModal(false); setNextStatus(""); setRejectionReason(""); setError(""); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Batch Update Modal ── */}
      {showBatchModal && batchAction && (
        <div className="rc-overlay rc-overlay-top" onClick={e => e.target === e.currentTarget && !batchLoading && setShowBatchModal(false)}>
          <div className="rc-modal">
            <div className="rc-modal-header">
              <div className="rc-modal-title">Batch — {batchAction.label}</div>
              {!batchLoading && <button className="rc-modal-close" onClick={() => { setShowBatchModal(false); setBatchResults(null); setBatchAction(null); }}>✕</button>}
            </div>
            <div className="rc-modal-body">
              {!batchResults ? (
                <>
                  <p style={{ color: "var(--th-text-muted)", fontSize: "0.88rem", marginBottom: "0.75rem" }}>
                    <strong style={{ color: "var(--th-text-primary)" }}>{batchAction.ids.length}</strong> job(s) will be updated to <strong style={{ color: "var(--th-emerald)" }}>{STATUS_LABELS[batchAction.newStatus]}</strong>:
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "240px", overflowY: "auto" }}>
                    {jobs.filter(j => batchAction.ids.includes(j.job_id)).map(j => (
                      <div key={j.job_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.45rem 0.65rem", background: "var(--th-bg-card-alt)", borderRadius: "6px", border: "1px solid var(--th-border)" }}>
                        <span style={{ fontSize: "0.85rem", color: "var(--th-text-primary)", fontWeight: 600 }}>{casingName(j)}</span>
                        <span style={{ fontSize: "0.75rem", color: "var(--th-amber)", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{j.job_id}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "280px", overflowY: "auto" }}>
                  {batchResults.map(r => (
                    <div key={r.job_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.45rem 0.65rem", background: "var(--th-bg-card-alt)", borderRadius: "6px", border: `1px solid ${r.ok ? "var(--th-emerald)" : "var(--th-rose)"}` }}>
                      <span style={{ fontSize: "0.78rem", color: "var(--th-text-muted)", fontFamily: "'Barlow Condensed',sans-serif" }}>{r.job_id}</span>
                      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: r.ok ? "var(--th-emerald)" : "var(--th-rose)" }}>{r.ok ? "✓ Done" : `✕ ${r.message}`}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rc-modal-footer">
              {!batchResults ? (
                <>
                  <button className="rc-btn rc-btn-orange" style={{ flex: 1, padding: "0.65rem" }} disabled={batchLoading}
                    onClick={() => batchUpdateStatus(batchAction.ids, batchAction.newStatus, batchAction.label.toLowerCase())}>
                    {batchLoading ? "Updating…" : batchAction.buttonLabel}
                  </button>
                  <button className="rc-btn rc-btn-slate" style={{ flex: 1, padding: "0.65rem" }} onClick={() => { setShowBatchModal(false); setBatchAction(null); }}>Cancel</button>
                </>
              ) : (
                <button className="rc-btn rc-btn-slate" style={{ flex: 1, padding: "0.65rem" }} onClick={() => { setShowBatchModal(false); setBatchResults(null); setBatchAction(null); }}>Done</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Forfeit / Reject Modal ── */}
      {showForfeitModal && forfeitTarget && (
        <div
          className="rc-overlay rc-overlay-top"
          onClick={(e) =>
            e.target === e.currentTarget && setShowForfeitModal(false)
          }
        >
          <div className="rc-modal">
            <div className="rc-modal-header">
              <div
                className="rc-modal-title"
                style={{ color: "var(--th-rose)" }}
              >
                {forfeitTarget?.status === "READY_FOR_CLAIM" ? "Forfeit Recap Job" : "Reject Recap Job"}
              </div>
              <button
                className="rc-modal-close"
                onClick={() => {
                  setShowForfeitModal(false);
                  setError("");
                }}
              >
                ✕
              </button>
            </div>
            <div className="rc-modal-body">
              <div
                className="rc-modal-job-card"
                style={{ borderLeftColor: "var(--th-rose)" }}
              >
                <div className="rc-modal-job-name">
                  {casingName(forfeitTarget)}
                </div>
                <div className="rc-modal-job-id">{forfeitTarget.job_id}</div>
              </div>
              {error && (
                <div className="rc-error" style={{ marginBottom: "0.75rem" }}>
                  <span>{error}</span>
                  <button className="rc-error-x" onClick={() => setError("")}>
                    ✕
                  </button>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <div>
                  <label className="rc-form-label">
                    {forfeitTarget?.status === "READY_FOR_CLAIM" ? "Forfeiture Reason" : <>Rejection Reason <b>*</b></>}
                  </label>
                  <textarea
                    className="rc-textarea"
                    rows="3"
                    value={forfeitReason}
                    onChange={(e) => setForfeitReason(e.target.value)}
                    placeholder={forfeitTarget?.status === "READY_FOR_CLAIM" ? "Optional — e.g., Customer did not claim within deadline…" : "Reason for rejection (required)…"}
                  />
                </div>
              </div>
            </div>
            <div className="rc-modal-footer">
              <button
                className="rc-btn rc-btn-rose"
                style={{ flex: 1, padding: "0.65rem" }}
                disabled={loading || (forfeitTarget?.status !== "READY_FOR_CLAIM" && !forfeitReason.trim())}
                onClick={submitForfeit}
              >
                {loading ? "Processing…" : forfeitTarget?.status === "READY_FOR_CLAIM" ? "✕ Confirm Forfeit" : "✕ Confirm Reject"}
              </button>
              <button
                className="rc-btn rc-btn-slate"
                style={{ flex: 1, padding: "0.65rem" }}
                onClick={() => {
                  setShowForfeitModal(false);
                  setForfeitReason("");
                  setError("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pricing Settings Modal ── */}
      {showPricingModal && (
        <div className="rc-modal-overlay rc-overlay-top" onClick={(e) => e.target === e.currentTarget && setShowPricingModal(false)}>
          <div className="rc-pricing-modal" onClick={e => e.stopPropagation()}>
            <div className="rc-pricing-head">
              <div className="rc-pricing-title">⚙ Default Recap Prices</div>
              <button className="rc-modal-close" onClick={() => setShowPricingModal(false)}>✕</button>
            </div>
            <div className="rc-pricing-body">
              <div style={{ marginBottom: '0.75rem', fontSize: '0.8rem', color: 'var(--th-text-muted)', background: 'var(--th-bg-input)', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>
                Standard recap prices applied to all jobs. For shop-owned casing intakes, the casing purchase cost is added on top automatically.
              </div>
              <table className="rc-pricing-table">
                <thead>
                  <tr>
                    <th>Size</th>
                    <th>Recap Type</th>
                    <th className="right">Recap Cost (₱)</th>
                    <th className="right">Selling Price (₱)</th>
                  </tr>
                </thead>
                <tbody>
                  {RECAP_SIZES.map(size =>
                    RECAP_TYPES.map((type, ti) => {
                      const key = `${size}|${type}`;
                      const val = pricingDraft[key] || {};
                      return (
                        <tr key={key}>
                          {ti === 0 && <td rowSpan={RECAP_TYPES.length} className="size-label" style={{ borderRight: '1px solid var(--th-border)', paddingRight: '0.75rem' }}>{size}</td>}
                          <td className="type-label">{type}</td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              step="0.01"
                              className="rc-price-input"
                              placeholder="0.00"
                              value={val.recap_cost ?? ''}
                              onChange={e => setPricingDraft(d => ({ ...d, [key]: { ...d[key], recap_cost: e.target.value } }))}
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              step="0.01"
                              className="rc-price-input"
                              placeholder="0.00"
                              value={val.selling_price ?? ''}
                              onChange={e => setPricingDraft(d => ({ ...d, [key]: { ...d[key], selling_price: e.target.value } }))}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="rc-pricing-foot">
              <button
                className="rc-btn rc-btn-sky"
                style={{ flex: 1, padding: '0.65rem', background: 'var(--th-sky)', color: '#fff' }}
                disabled={pricingSaving}
                onClick={savePricingDefaults}
              >{pricingSaving ? 'Saving…' : '✓ Save Prices'}</button>
              <button
                className="rc-btn rc-btn-slate"
                style={{ flex: 1, padding: '0.65rem' }}
                onClick={() => setShowPricingModal(false)}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page layout ── */}
      <div className="rc-root th-page" style={{ background: 'var(--th-bg-page, #060d18)', minHeight: '100vh' }}>
        <div className="rc-main">
          {/* Header */}
          <div className="rc-page-header">
            <h1 className="rc-page-title">
              Recap <span>Tires</span>
              {isShopClosed && (
                <div className="pos-closed-badge" style={{ marginLeft: '1rem', display: 'inline-flex', verticalAlign: 'middle' }}>
                  <span className="pulse"></span>
                  NEXT DAY MODE
                </div>
              )}
            </h1>
            <div className="rc-header-btns">
              {[
                { label: '⬇ Export', cls: 'rc-btn-slate', onClick: exportExcel, disabled: statusFilter === 'RECAPPING' ? recappingItems.length === 0 : !recapTotal },
                { label: '⚙ Pricing', cls: 'rc-btn-sky', onClick: openPricingModal, disabled: false },
                { label: '+ New Job', cls: 'rc-btn-orange', onClick: () => { setShowNewJobForm(true); setError(""); if (defaultSupplierId) setNewJob(j => ({ ...j, supplier_id: defaultSupplierId })); }, disabled: false },
              ].map(({ label, cls, onClick, disabled }) => (
                <button
                  key={label}
                  className={`rc-btn ${cls}`}
                  onClick={onClick}
                  disabled={disabled}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* KPI Cards */}
          {(() => {
            const sc = kpiCounts?.statusCounts || {};
            const active = (sc['INTAKE'] || 0) + (sc['SENT_TO_SUPPLIER'] || 0);
            const ready = sc['READY_FOR_CLAIM_CUSTOMER'] || 0;
            const inInventory = sc['IN_INVENTORY'] || 0;
            const claimed = sc['CLAIMED'] || 0;
            const totalJobs = kpiCounts?.total || 0;
            const totalCost = kpiCounts?.total_recap_cost || 0;
            const fmtP = n => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            return (
              <div className="rc-kpi-grid">
                <KpiCard label="Total Jobs" value={totalJobs} accent="sky" sub="filtered total" />
                <KpiCard label="In Progress" value={active} accent="amber" sub="intake + with supplier" />
                <KpiCard
                  label="In Inventory"
                  value={inInventory}
                  accent="emerald"
                  sub="shop-owned, unsold"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setStatusFilter(f => f === 'IN_INVENTORY' ? '' : 'IN_INVENTORY')}
                />
                <KpiCard label="Ready to Claim" value={ready} accent="amber" sub="customer · awaiting pickup" />
                <KpiCard label="Claimed" value={claimed} accent="violet" sub="completed jobs" />
                <KpiCard label="Total Recap Cost" value={'₱' + Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(totalCost)} accent="rose" sub="filtered total cost" />
              </div>
            )
          })()}

          {/* Top-level error */}
          {error && !showClaimModal && !showForfeitModal && (
            <div className="rc-error">
              <span>{error}</span>
              <button className="rc-error-x" onClick={() => setError("")}>
                ✕
              </button>
            </div>
          )}

          {/* Search + filters consolidated via FilterHeader */}
          <FilterHeader
            searchProps={{
              value: searchQuery,
              onChange: setSearchQuery,
              placeholder: "Search by job ID, casing, customer, supplier…",
              suggestions: suggestions,
              onSuggestionSelect: (s) => setSearchQuery(s.text),
              resultCount: searchQuery.trim() ? recapTotal : undefined,
              resultLabel: "jobs",
            }}
            leftComponent={
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', flexWrap: 'nowrap', width: '100%', height: '100%' }}>
                <select
                  className="fh-select"
                  value={ownershipFilter}
                  onChange={e => {
                    setOwnershipFilter(e.target.value);
                    setSelectedIds(new Set());
                    if (e.target.value === "SHOP_OWNED" && ["READY_FOR_CLAIM", "CLAIMED", "FORFEITED"].includes(statusFilter)) setStatusFilter("");
                    if (e.target.value === "CUSTOMER_OWNED" && statusFilter === "IN_INVENTORY") setStatusFilter("");
                  }}
                  style={{ flex: '0 1 130px', minWidth: '100px' }}
                >
                  <option value="">All Ownership</option>
                  <option value="SHOP_OWNED">Shop Owned</option>
                  <option value="CUSTOMER_OWNED">Customer Owned</option>
                </select>
                <div style={{ height: '100%', width: '1px', background: 'var(--th-border)', margin: '0 0.25rem' }} />
                <input className="fh-date" type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ flex: 1, minWidth: '120px' }} />
              </div>
            }
            filters={[
              { label: 'All', value: '', active: statusFilter === '', count: kpiCounts?.total },
              { label: 'For Recapping', value: 'RECAPPING', active: statusFilter === 'RECAPPING', count: recappingItems.length },
              ...STATUS_ORDER.filter(key => {
                if (ownershipFilter === "SHOP_OWNED") return !["READY_FOR_CLAIM", "CLAIMED", "FORFEITED"].includes(key);
                if (ownershipFilter === "CUSTOMER_OWNED") return key !== "IN_INVENTORY";
                return true;
              }).map(key => ({
                label: key === 'IN_INVENTORY' && ownershipFilter !== 'CUSTOMER_OWNED' ? 'In Inventory' : STATUS_META[key].label,
                value: key,
                active: statusFilter === key,
                count: statusCounts[key]
              }))
            ]}
            onFilterChange={(v) => { setStatusFilter(v); setSelectedIds(new Set()); }}
            accentColor="var(--th-orange)"
          />

          {/* New job modal */}
          {showNewJobForm && (
            <div className="rc-modal-overlay rc-overlay-top" onClick={() => { setShowNewJobForm(false); setError(""); resetForm(); }}>
              <div className="rc-form-panel" onClick={e => e.stopPropagation()}>
                <button className="rc-modal-close" onClick={() => { setShowNewJobForm(false); setError(""); resetForm(); }}>✕</button>
                <div className="rc-form-title">New Recap Job</div>

                <div className="rc-ownership-toggle">
                  <button
                    className={`rc-own-btn${newJob.ownership_type === "SHOP_OWNED" ? " active" : ""}`}
                    onClick={() => setNewJob({ ...newJob, ownership_type: 'SHOP_OWNED', customer_id: "" })}
                  >
                    🏬 Shop Owned
                  </button>
                  <button
                    className={`rc-own-btn${newJob.ownership_type === "CUSTOMER_OWNED" ? " active" : ""}`}
                    onClick={() => setNewJob({ ...newJob, ownership_type: 'CUSTOMER_OWNED' })}
                  >
                    👤 Customer Owned
                  </button>
                </div>

                <div className="rc-form-grid">
                  {newJob.ownership_type === "CUSTOMER_OWNED" && (
                    <div className="span3">
                      <label className="rc-form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Customer <b>*</b></span>
                        <button type="button" onClick={() => { setShowQuickAddCustomer(v => !v); setQuickCustForm({ customer_name: '', company: '', contact_number: '', address: '' }); }}
                          style={{ background: 'none', border: 'none', color: 'var(--th-sky)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                          {showQuickAddCustomer ? '✕ Cancel' : '+ New Customer'}
                        </button>
                      </label>
                      {showQuickAddCustomer ? (
                        <div style={{ background: 'var(--th-bg-card-alt)', border: '1px solid var(--th-border-mid)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <input className="rc-input" placeholder="Customer Name *" value={quickCustForm.customer_name}
                            onChange={e => setQuickCustForm(f => ({ ...f, customer_name: e.target.value }))} autoFocus />
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input className="rc-input" placeholder="Company" value={quickCustForm.company}
                              onChange={e => setQuickCustForm(f => ({ ...f, company: e.target.value }))} style={{ flex: 1 }} />
                            <input className="rc-input" placeholder="Contact Number" value={quickCustForm.contact_number}
                              onChange={e => setQuickCustForm(f => ({ ...f, contact_number: e.target.value }))} style={{ flex: 1 }} />
                          </div>
                          <input className="rc-input" placeholder="Address (optional)" value={quickCustForm.address}
                            onChange={e => setQuickCustForm(f => ({ ...f, address: e.target.value }))} />
                          <button type="button" className="rc-action-btn sky" style={{ justifyContent: 'center' }}
                            onClick={handleQuickAddCustomer} disabled={quickCustSaving}>
                            {quickCustSaving ? 'Adding…' : '✓ Add Customer'}
                          </button>
                        </div>
                      ) : (
                        <select className="rc-input" value={newJob.customer_id}
                          onChange={(e) => setNewJob({ ...newJob, customer_id: e.target.value })}>
                          <option value="">Select Customer</option>
                          {customers.map((c) => (
                            <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                  <div className="span3">
                    <label className="rc-form-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>Recap Supplier <b>*</b></span>
                      {newJob.supplier_id && newJob.supplier_id !== defaultSupplierId && (
                        <button
                          type="button"
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--th-amber)", fontSize: "0.78rem", padding: 0, display: "flex", alignItems: "center", gap: "0.25rem" }}
                          onClick={() => {
                            localStorage.setItem(`th-recap-default-supplier-${shopId}`, newJob.supplier_id);
                            setDefaultSupplierId(newJob.supplier_id);
                            setToast({ title: "Default supplier saved" });
                          }}
                        >
                          ★ Set as Default
                        </button>
                      )}
                      {newJob.supplier_id && newJob.supplier_id === defaultSupplierId && (
                        <span style={{ color: "var(--th-amber)", fontSize: "0.78rem" }}>★ Default</span>
                      )}
                    </label>
                    <select
                      className="rc-input"
                      value={newJob.supplier_id}
                      onChange={(e) =>
                        setNewJob({ ...newJob, supplier_id: e.target.value })
                      }
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map((s) => (
                        <option key={s.supplier_id} value={s.supplier_id}>
                          {s.supplier_name}{s.supplier_id === defaultSupplierId ? " ★" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Casing rows */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: 'var(--th-amber)' }}>Casings</span>
                    <button type="button" onClick={() => setCasings(p => [...p, blankCasing()])}
                      style={{ background: 'none', border: '1px solid var(--th-emerald)', color: 'var(--th-emerald)', borderRadius: 6, padding: '0.2rem 0.65rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                      + Add Casing
                    </button>
                  </div>
                  {casings.map((c, i) => (
                    <div key={i} style={{ background: 'var(--th-bg-card-alt)', border: '1px solid var(--th-border-mid)', borderRadius: 8, padding: '0.65rem 0.75rem', marginBottom: '0.5rem', position: 'relative' }}>
                      {casings.length > 1 && (
                        <button type="button" onClick={() => setCasings(p => p.filter((_, idx) => idx !== i))}
                          style={{ position: 'absolute', top: '0.45rem', right: '0.5rem', background: 'none', border: 'none', color: 'var(--th-rose)', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', lineHeight: 1 }}>✕</button>
                      )}
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'nowrap', alignItems: 'flex-end', overflowX: 'auto', paddingBottom: '0.4rem' }}>
                        <div style={{ flex: '1.2 1 120px', minWidth: '100px' }}>
                          <label className="rc-form-label">Brand *</label>
                          <input className="rc-input" placeholder="e.g., Goodyear" value={c.brand}
                            onChange={e => updateCasing(i, { brand: e.target.value })} />
                        </div>
                        <div style={{ flex: '1 1 110px', minWidth: '90px' }}>
                          <label className="rc-form-label">Recap Type</label>
                          <select className="rc-input" value={c.design} onChange={e => updateCasing(i, { design: e.target.value })}>
                            <option value="">— Type —</option>
                            <option value="Fullcap">Fullcap</option>
                            <option value="Topcap">Topcap (Ordinary)</option>
                            <option value="Cold Process">Cold Process</option>
                          </select>
                        </div>
                        <div style={{ flex: '1 1 110px', minWidth: '90px' }}>
                          <label className="rc-form-label">Size *</label>
                          <input 
                            list={`recap-sizes-${i}`}
                            className="rc-input" 
                            placeholder="e.g., 750-16"
                            value={c.size} 
                            onChange={e => updateCasing(i, { size: e.target.value })} 
                          />
                          <datalist id={`recap-sizes-${i}`}>
                            {RECAP_SIZES.map(s => <option key={s} value={s} />)}
                          </datalist>
                        </div>
                        <div style={{ flex: '0.8 1 80px', minWidth: '70px' }}>
                          <label className="rc-form-label" style={{ color: 'var(--th-amber)' }}>DOT *</label>
                          <input className="rc-input" inputMode="numeric" maxLength={4} placeholder="2425"
                            value={c.dot_number} onChange={e => updateCasing(i, { dot_number: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                            style={c.dot_number.length === 4 ? {} : { borderColor: 'var(--th-rose)' }} />
                        </div>
                        <div style={{ flex: '1 1 100px', minWidth: '80px' }}>
                          <label className="rc-form-label">Cost (₱)</label>
                          <input className="rc-input" type="number" step="0.01" placeholder="0.00"
                            value={c.recap_cost} onChange={e => updateCasing(i, { recap_cost: e.target.value })} />
                        </div>
                        <div style={{ flex: '1 1 100px', minWidth: '80px' }}>
                          <label className="rc-form-label">Price (₱)</label>
                          <input className="rc-input" type="number" step="0.01" placeholder="0.00"
                            value={c.expected_selling_price} onChange={e => updateCasing(i, { expected_selling_price: e.target.value })} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>


                <div className="rc-form-actions">
                  <button
                    className="rc-btn rc-btn-emerald"
                    disabled={loading}
                    onClick={createJob}
                  >
                    {loading ? "Creating…" : "✓ Create Job"}
                  </button>
                  <button
                    className="rc-btn rc-btn-slate"
                    onClick={() => {
                      setShowNewJobForm(false);
                      setError("");
                      resetForm();
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Table + detail panel in a flex row */}
          <div className="th-section-label">Recap Tires</div>
          <div className="rc-layout-row">
            <div className="rc-table-wrap">
              {/* Batch action bar */}
              {(() => {
                // Only consider jobs currently visible in the table (current page, current filter)
                const intakeJobs = currentJobs.filter(j => j.status === "INTAKE");
                const sentJobs = currentJobs.filter(j => j.status === "SENT_TO_SUPPLIER");
                const batchableJobs = [...intakeJobs, ...sentJobs];
                if (batchableJobs.length === 0) return null;
                const allSelected = batchableJobs.length > 0 && batchableJobs.every(j => selectedIds.has(j.job_id));
                const selectedIntake = intakeJobs.filter(j => selectedIds.has(j.job_id));
                const selectedSent = sentJobs.filter(j => selectedIds.has(j.job_id));
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.5rem 0.75rem", background: "var(--th-bg-card-alt)", borderBottom: "1px solid var(--th-border)", flexShrink: 0, flexWrap: "wrap" }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => setSelectedIds(prev => {
                        const n = new Set(prev);
                        if (allSelected) batchableJobs.forEach(j => n.delete(j.job_id));
                        else batchableJobs.forEach(j => n.add(j.job_id));
                        return n;
                      })}
                      style={{ width: "1rem", height: "1rem", accentColor: "var(--th-orange)", cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "0.8rem", color: "var(--th-text-muted)", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {(selectedIntake.length + selectedSent.length) > 0 ? `${selectedIntake.length + selectedSent.length} selected` : "Select jobs to batch update"}
                    </span>
                    {(statusFilter === "INTAKE" || statusFilter === "") && selectedIntake.length > 0 && (
                      <button className="rc-action-btn sky" style={{ flex: "none", padding: "0.3rem 0.8rem", fontSize: "0.8rem" }} disabled={batchLoading}
                        onClick={() => { setBatchResults(null); setBatchAction({ ids: selectedIntake.map(j => j.job_id), newStatus: "SENT_TO_SUPPLIER", label: "Send to Supplier", buttonLabel: `✈ Send ${selectedIntake.length} to Supplier` }); setShowBatchModal(true); }}>
                        ✈ Send {selectedIntake.length} to Supplier
                      </button>
                    )}
                    {(statusFilter === "SENT_TO_SUPPLIER" || statusFilter === "") && selectedSent.length > 0 && (
                      <button className="rc-action-btn emerald" style={{ flex: "none", padding: "0.3rem 0.8rem", fontSize: "0.8rem" }} disabled={batchLoading}
                        onClick={() => { setBatchResults(null); setBatchAction({ ids: selectedSent.map(j => j.job_id), newStatus: "READY_FOR_CLAIM", label: "Mark Ready for Claim", buttonLabel: `✓ Mark ${selectedSent.length} Ready for Claim` }); setShowBatchModal(true); }}>
                        ✓ Mark {selectedSent.length} Ready for Claim
                      </button>
                    )}
                    {selectedIds.size > 0 && (
                      <button style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--th-text-faint)", cursor: "pointer", fontSize: "0.8rem" }} onClick={() => setSelectedIds(new Set())}>
                        Clear
                      </button>
                    )}
                  </div>
                );
              })()}
              <div className="rc-table-scroll">
                <table className="rc-table">
                  <thead>
                    <tr>
                      <th style={{ width: "2rem", padding: "0.5rem 0.5rem" }}></th>
                      <th style={{ minWidth: '130px' }}>Job ID</th>
                      <th style={{ minWidth: '220px' }}>Casing</th>
                      <th>Ownership</th>
                      <th>Customer / Supplier</th>
                      <th className="right" style={{ minWidth: '120px' }}>Recap Cost</th>
                      <th className="right" style={{ minWidth: '120px' }}>Sell Price</th>
                      <th>DOT</th>
                      <th style={{ minWidth: '140px' }}>Intake</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statusFilter === "RECAPPING" ? (
                      recappingItems.length === 0 ? (
                        <tr><td colSpan="10"><div className="rc-table-empty"><svg className="rc-table-empty-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /></svg><div className="rc-table-empty-title">No Recap Tires</div>No tires with category RECAPPING in stock</div></td></tr>
                      ) : recappingItems.map(item => (
                        <tr key={item.item_id} className={selectedRecapItem?.item_id === item.item_id ? "selected" : ""} style={{ cursor: 'pointer' }} onClick={() => {
                          setSelectedRecapItem(item); setSelectedJob(null);
                          const def = priceDefaults[`${item.size}|Topcap`];
                          setRecapIntakeForm({ design: 'Topcap', supplier_id: defaultSupplierId || '', recap_cost: def ? String(def.recap_cost) : '', expected_selling_price: def ? String(def.selling_price) : '' });
                        }}>
                          <td></td>
                          <td><div className="rc-td-jobid" style={{ color: 'var(--th-text-dim)' }}>{item.sku}</div></td>
                          <td>
                            <div className="rc-td-casing">{item.item_name}</div>
                            {item.size && <div className="rc-td-size">{item.size}</div>}
                          </td>
                          <td><span className="rc-own-badge shop">Shop</span></td>
                          <td><div style={{ fontSize: '0.88rem', color: 'var(--th-text-muted)' }}>{item.supplier_name || '—'}</div></td>
                          <td><div className="rc-td-money sky">{item.unit_cost ? rcCurrency(item.unit_cost) : <span style={{ color: 'var(--th-text-faint)' }}>—</span>}</div></td>
                          <td><div className="rc-td-money amber">{item.selling_price ? rcCurrency(item.selling_price) : <span style={{ color: 'var(--th-text-faint)' }}>—</span>}</div></td>
                          <td>{item.dot_number ? <span style={{ fontSize: '0.72rem', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: 4, background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>{item.dot_number}</span> : <span style={{ color: 'var(--th-text-faint)' }}>—</span>}</td>
                          <td><div className="rc-td-date">Qty: {item.current_quantity}</div></td>
                          <td><span className="rc-badge" style={{ background: 'var(--th-amber-bg)', color: 'var(--th-amber)', border: '1px solid var(--th-amber)', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700, padding: '0.18rem 0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>For Recapping</span></td>
                        </tr>
                      ))
                    ) : currentJobs.length === 0 ? (
                      <tr>
                        <td colSpan="10">
                          <div className="rc-table-empty">
                            <svg className="rc-table-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><path d="M9 12h6M12 9v6" /></svg>
                            <div className="rc-table-empty-title">
                              {hasFilters ? "No Jobs Match" : "No Recap Jobs"}
                            </div>
                            <div>
                              {hasFilters
                                ? "Try clearing filters"
                                : "Create your first recap job to get started"}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      currentJobs.map((job) => (
                        <tr
                          key={job.job_id}
                          className={
                            selectedJob?.job_id === job.job_id ? "selected" : ""
                          }
                          onClick={() => handleJobClick(job)}
                        >
                          <td style={{ padding: "0.4rem 0.5rem" }} onClick={e => e.stopPropagation()}>
                            {(job.status === "INTAKE" || job.status === "SENT_TO_SUPPLIER") && (
                              <input
                                type="checkbox"
                                checked={selectedIds.has(job.job_id)}
                                onChange={() => setSelectedIds(prev => { const n = new Set(prev); n.has(job.job_id) ? n.delete(job.job_id) : n.add(job.job_id); return n; })}
                                style={{ width: "1rem", height: "1rem", accentColor: "var(--th-orange)", cursor: "pointer" }}
                              />
                            )}
                          </td>
                          <td>
                            <div className="rc-td-jobid" title={job.job_id}>{job.job_id ? job.job_id.slice(0, 14) + (job.job_id.length > 14 ? '…' : '') : '—'}</div>
                            {job.finished_sku && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--th-text-faint)', fontFamily: "'Barlow Condensed',sans-serif", marginTop: '0.1rem', letterSpacing: '0.02em' }}>{job.finished_sku}</div>
                            )}
                          </td>
                          <td>
                            <div className="rc-td-casing">{casingName(job)}</div>
                            {job.size && (
                              <div className="rc-td-size">{job.size}</div>
                            )}
                          </td>
                          <td>
                            <span
                              className={`rc-own-badge ${isCustomerOwned(job.ownership_type) ? "customer" : "shop"}`}
                            >
                              {isCustomerOwned(job.ownership_type)
                                ? "Customer"
                                : "Shop"}
                            </span>
                          </td>
                          <td>
                            {isCustomerOwned(job.ownership_type) ? (
                              <div>
                                <div
                                  style={{
                                    fontWeight: 600,
                                    fontSize: "0.88rem",
                                    color: "var(--th-violet)",
                                  }}
                                >
                                  {job.customer_name || "—"}
                                </div>
                                <div
                                  style={{
                                    fontSize: "0.78rem",
                                    color: "var(--th-text-dim)",
                                  }}
                                >
                                  {job.supplier_name || "—"}
                                </div>
                              </div>
                            ) : (
                              <div
                                style={{
                                  fontSize: "0.88rem",
                                  color: "var(--th-text-muted)",
                                }}
                              >
                                {job.supplier_name || "—"}
                              </div>
                            )}
                          </td>
                          <td>
                            <div className="rc-td-money sky">
                              {job.recap_cost ? (
                                rcCurrency(job.recap_cost)
                              ) : (
                                <span style={{ color: "var(--th-text-faint)" }}>
                                  —
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="rc-td-money amber">
                              {job.expected_selling_price ? (
                                rcCurrency(job.expected_selling_price)
                              ) : (
                                <span style={{ color: "var(--th-text-faint)" }}>
                                  —
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            {job.dot_number ? (
                              <span style={{ fontSize: "0.72rem", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", padding: "0.1rem 0.4rem", borderRadius: 4, background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)", whiteSpace: "nowrap" }}>
                                {job.dot_number}
                              </span>
                            ) : (
                              <span style={{ color: "var(--th-text-faint)" }}>—</span>
                            )}
                          </td>
                          <td>
                            <div className="rc-td-date">
                              {job.intake_date
                                ? new Date(job.intake_date).toLocaleString(
                                  "en-PH",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true,
                                  },
                                )
                                : "—"}
                            </div>
                          </td>
                          <td>
                            <span className={`rc-badge rc-badge-${job.status}`} style={job.status === 'READY_FOR_CLAIM' && !isCustomerOwned(job.ownership_type) ? { background: 'var(--th-emerald-bg)', color: 'var(--th-emerald)', borderColor: 'var(--th-emerald)' } : {}}>
                              {job.status === 'READY_FOR_CLAIM' && !isCustomerOwned(job.ownership_type) ? 'In Inventory' : (STATUS_LABELS[job.status] || job.status)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <Pagination currentPage={currentPage} totalPages={recapTotalPages} onPageChange={setCurrentPage} />
            </div>

          </div>{/* end rc-layout-row */}

          {/* ── Job Detail Modal ── */}
          {selectedJob && (
            <div className="rc-overlay" onClick={e => { if (e.target === e.currentTarget) { setSelectedJob(null); setJobHistory([]); setNextStatus(''); setError(''); } }}>
              <div className="rc-detail-modal">
                <div className="rc-detail-header">
                  <div>
                    <div className="rc-detail-title">Job Details</div>
                    <div className="rc-detail-jobid">{selectedJob.job_id}</div>
                  </div>
                  <button
                    className="rc-detail-close"
                    onClick={() => {
                      setSelectedJob(null);
                      setJobHistory([]);
                      setNextStatus("");
                      setError("");
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* ── Quick action bar ── */}
                <div className="rc-action-bar">
                  {STATUS_FLOW[selectedJob.status]?.length > 0 && (
                    <>
                      <div className="rc-action-row">
                        {STATUS_FLOW[selectedJob.status].filter((s) => s !== "CLAIMED").map((s) => (
                          <button
                            key={s}
                            className="rc-action-btn orange"
                            onClick={() => { setNextStatus(s); setRecapCostInput(""); setRejectionReason(""); setShowStatusModal(true); setError(""); }}
                          >
                            {STATUS_ICONS_RC[s] && <span style={{ display: 'flex' }}>{STATUS_ICONS_RC[s]}</span>}
                            {s === "READY_FOR_CLAIM" && !isCustomerOwned(selectedJob.ownership_type) ? "Add to Inventory" : STATUS_LABELS[s]}
                          </button>
                        ))}
                        {selectedJob.status === "READY_FOR_CLAIM" && isCustomerOwned(selectedJob.ownership_type) && (
                          <button
                            className="rc-action-btn emerald"
                            disabled={loading}
                            onClick={() => { setClaimTarget(selectedJob); setSalePrice(String(selectedJob.expected_selling_price || "")); setShowClaimModal(true); setError(""); }}
                          >
                            ✓ Claim
                          </button>
                        )}
                        {selectedJob.status === "READY_FOR_CLAIM" && isCustomerOwned(selectedJob.ownership_type) &&
                          selectedJob.claim_deadline_date && new Date(selectedJob.claim_deadline_date) < new Date() && (
                            <button
                              className="rc-action-btn rose"
                              disabled={loading}
                              onClick={() => { setForfeitTarget(selectedJob); setForfeitReason(""); setShowForfeitModal(true); setError(""); }}
                              >                              ✕ Forfeit
                            </button>
                          )}
                      </div>
                    </>
                  )}
                  {selectedJob.status === "READY_FOR_CLAIM" && !isCustomerOwned(selectedJob.ownership_type) && (
                    <div style={{ background: 'var(--th-emerald-bg)', border: '1px solid var(--th-emerald)', borderRadius: '7px', padding: '0.5rem 0.75rem', fontSize: '0.82rem', color: 'var(--th-emerald)', textAlign: 'center' }}>
                      ✓ In Inventory — sell via POS
                    </div>
                  )}
                  {selectedJob.status === "CLAIMED" && <div className="rc-terminal-banner claimed">✓ Job Claimed</div>}
                  {selectedJob.status === "REJECTED" && <div className="rc-terminal-banner rejected">✕ Job Rejected</div>}
                  {selectedJob.status === "FORFEITED" && <div className="rc-terminal-banner forfeited">✕ Job Forfeited</div>}
                </div>

                <div className="rc-detail-body">
                  {/* Casing name + status */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                      marginBottom: "0.85rem",
                    }}
                  >
                    <div className="rc-detail-casing">
                      {casingName(selectedJob)}
                    </div>
                    <span
                      className={`rc-badge rc-badge-${selectedJob.status}`}
                      style={{ flexShrink: 0 }}
                    >
                      {STATUS_LABELS[selectedJob.status]}
                    </span>
                  </div>

                  {/* Meta grid */}
                  <div className="rc-meta-grid">
                    <div className="rc-meta-card">
                      <div className="rc-meta-label">Ownership</div>
                      <div
                        className={`rc-meta-val ${isCustomerOwned(selectedJob.ownership_type) ? "violet" : "sky"}`}
                      >
                        {isCustomerOwned(selectedJob.ownership_type)
                          ? "Customer"
                          : "Shop"}
                      </div>
                    </div>
                    <div className="rc-meta-card">
                      <div className="rc-meta-label">Intake Date</div>
                      <div className="rc-meta-val">
                        {selectedJob.intake_date
                          ? new Date(selectedJob.intake_date).toLocaleString(
                            "en-PH",
                            { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true },
                          )
                          : "—"}
                      </div>
                    </div>
                    {selectedJob.customer_name && (
                      <div className="rc-meta-card">
                        <div className="rc-meta-label">Customer</div>
                        <div className="rc-meta-val violet">
                          {selectedJob.customer_name}
                        </div>
                      </div>
                    )}
                    <div className="rc-meta-card">
                      <div className="rc-meta-label">Supplier</div>
                      <div className="rc-meta-val">
                        {selectedJob.supplier_name || "—"}
                      </div>
                    </div>
                    <div className="rc-meta-card">
                      <div className="rc-meta-label">Recap Cost</div>
                      <div className="rc-meta-val sky">
                        {selectedJob.recap_cost
                          ? rcCurrency(selectedJob.recap_cost)
                          : "—"}
                      </div>
                    </div>
                    <div className="rc-meta-card">
                      <div className="rc-meta-label">Sell Price</div>
                      <div className="rc-meta-val amber">
                        {selectedJob.expected_selling_price
                          ? rcCurrency(selectedJob.expected_selling_price)
                          : "—"}
                      </div>
                    </div>
                    {selectedJob.dot_number && (
                      <div className="rc-meta-card span2">
                        <div className="rc-meta-label">DOT Number</div>
                        <div className="rc-meta-val mono">{selectedJob.dot_number}</div>
                      </div>
                    )}
                    {isCustomerOwned(selectedJob.ownership_type) && (
                      <div className="rc-meta-card span2">
                        <div className="rc-meta-label">Claim Deadline</div>
                        <div className="rc-meta-val" style={selectedJob.claim_deadline_date && new Date(selectedJob.claim_deadline_date) < new Date() ? { color: 'var(--th-rose)', fontWeight: 700 } : {}}>
                          {selectedJob.claim_deadline_date
                            ? new Date(selectedJob.claim_deadline_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
                            : <span style={{ color: 'var(--th-text-faint)' }}>—</span>}
                        </div>
                      </div>
                    )}
                    {selectedJob.related_sale_id && (
                      <div className="rc-meta-card span2">
                        <div className="rc-meta-label">Sale ID</div>
                        <div className="rc-meta-val emerald mono">
                          {selectedJob.related_sale_id}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* History */}
                  <div className="rc-section-title">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Job History
                  </div>

                  {historyLoading ? (
                    <div className="rc-loading">
                      <div className="rc-spinner" /> Loading…
                    </div>
                  ) : jobHistory.length === 0 ? (
                    <div
                      style={{
                        color: "var(--th-text-faint)",
                        fontSize: "0.85rem",
                        textAlign: "center",
                        padding: "1rem 0",
                      }}
                    >
                      No history found
                    </div>
                  ) : (
                    jobHistory.map((entry, idx) => (
                      <div
                        key={idx}
                        className={`rc-hist-entry ${histEntryClass(entry.event_type)}`}
                      >
                        <div className="rc-hist-top">
                          <span className="rc-hist-event">
                            {entry.event_type
                              ? entry.event_type.replace(/_/g, " ")
                              : "—"}
                          </span>
                          <span className="rc-hist-date">
                            {entry.timestamp
                              ? new Date(entry.timestamp).toLocaleString(
                                "en-PH",
                                { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true },
                              )
                              : "—"}
                          </span>
                        </div>
                        {entry.previous_status && entry.new_status && (
                          <div className="rc-hist-flow">
                            <span
                              className={`rc-badge rc-badge-${entry.previous_status}`}
                            >
                              {STATUS_LABELS[entry.previous_status] ||
                                entry.previous_status}
                            </span>
                            <span className="rc-hist-arrow">→</span>
                            <span
                              className={`rc-badge rc-badge-${entry.new_status}`}
                            >
                              {STATUS_LABELS[entry.new_status] || entry.new_status}
                            </span>
                          </div>
                        )}
                        {entry.system_note && (
                          <div className="rc-hist-note">{entry.system_note}</div>
                        )}
                        {entry.performed_by_staff_id && (
                          <div className="rc-hist-by">
                            By: {entry.staff_name || entry.performed_by_staff_id}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

              </div>
            </div>
          )}

          {/* ── Recapping item detail modal ── */}
          {selectedRecapItem && (
            <div className="rc-overlay" onClick={e => { if (e.target === e.currentTarget) { setSelectedRecapItem(null); setError(''); } }}>
              <div className="rc-detail-modal">
                <div className="rc-detail-header">
                  <div>
                    <div className="rc-detail-title">Item Details</div>
                    <div className="rc-detail-jobid">{selectedRecapItem.sku}</div>
                  </div>
                  <button className="rc-detail-close" onClick={() => { setSelectedRecapItem(null); setError(''); }}>✕</button>
                </div>

                <div className="rc-detail-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div className="rc-detail-casing">{selectedRecapItem.item_name}</div>
                    <span className="rc-badge" style={{ background: 'var(--th-amber-bg)', color: 'var(--th-amber)', border: '1px solid var(--th-amber)', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700, padding: '0.18rem 0.5rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>For Recapping</span>
                  </div>

                  <div className="rc-meta-grid">
                    <div className="rc-meta-card">
                      <div className="rc-meta-label">Brand</div>
                      <div className="rc-meta-val">{selectedRecapItem.brand || '—'}</div>
                    </div>
                    <div className="rc-meta-card">
                      <div className="rc-meta-label">Size</div>
                      <div className="rc-meta-val">{selectedRecapItem.size || '—'}</div>
                    </div>
                    {selectedRecapItem.dot_number && (
                      <div className="rc-meta-card">
                        <div className="rc-meta-label">DOT</div>
                        <div className="rc-meta-val mono">{selectedRecapItem.dot_number}</div>
                      </div>
                    )}
                    <div className="rc-meta-card">
                      <div className="rc-meta-label">In Stock</div>
                      <div className="rc-meta-val sky">{selectedRecapItem.current_quantity}</div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--th-border)', paddingTop: '0.85rem', marginTop: '0.25rem' }}>
                    <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--th-orange)', marginBottom: '0.65rem' }}>Create Intake Job</div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                      <div>
                        <label className="rc-form-label">Recap Type</label>
                        <select className="rc-input" value={recapIntakeForm.design} onChange={e => {
                          const design = e.target.value;
                          const def = priceDefaults[`${selectedRecapItem.size}|${design}`];
                          setRecapIntakeForm(f => ({ ...f, design, ...(def ? { recap_cost: String(def.recap_cost), expected_selling_price: String(def.selling_price) } : {}) }));
                        }}>
                          <option value="Fullcap">Fullcap</option>
                          <option value="Topcap">Topcap (Ordinary)</option>
                          <option value="Cold Process">Cold Process</option>
                        </select>
                      </div>
                      <div>
                        <label className="rc-form-label">Recap Supplier</label>
                        <select className="rc-input" value={recapIntakeForm.supplier_id} onChange={e => setRecapIntakeForm(f => ({ ...f, supplier_id: e.target.value }))}>
                          <option value="">— Select Supplier —</option>
                          {suppliers.map(s => (
                            <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}{s.supplier_id === defaultSupplierId ? ' ★' : ''}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div style={{ flex: 1 }}>
                          <label className="rc-form-label">Recap Cost (₱)</label>
                          <input className="rc-input" type="number" placeholder="0.00" value={recapIntakeForm.recap_cost} onChange={e => setRecapIntakeForm(f => ({ ...f, recap_cost: e.target.value }))} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="rc-form-label">Selling Price (₱)</label>
                          <input className="rc-input" type="number" placeholder="0.00" value={recapIntakeForm.expected_selling_price} onChange={e => setRecapIntakeForm(f => ({ ...f, expected_selling_price: e.target.value }))} />
                        </div>
                      </div>
                      {/* Summary of how final cost/selling is built */}
                      {selectedRecapItem && (recapIntakeForm.recap_cost || recapIntakeForm.expected_selling_price) && (() => {
                        const casingCost = selectedRecapItem.unit_cost || 0;
                        const recapC = parseFloat(recapIntakeForm.recap_cost) || 0;
                        const stdSell = parseFloat(recapIntakeForm.expected_selling_price) || 0;
                        const totalCost = casingCost + recapC;
                        const finalSell = casingCost + stdSell;
                        return (
                          <div style={{ background: 'var(--th-bg-input)', borderRadius: '8px', padding: '0.55rem 0.75rem', fontSize: '0.78rem', color: 'var(--th-text-muted)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Casing cost</span><span style={{ color: 'var(--th-text-body)' }}>₱{casingCost.toLocaleString()}</span></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>+ Recap cost</span><span style={{ color: 'var(--th-text-body)' }}>₱{recapC.toLocaleString()}</span></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--th-text-primary)', borderTop: '1px solid var(--th-border)', paddingTop: '0.2rem', marginTop: '0.1rem' }}><span>Total cost</span><span>₱{totalCost.toLocaleString()}</span></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--th-emerald)' }}><span>Final selling</span><span>₱{finalSell.toLocaleString()}</span></div>
                          </div>
                        );
                      })()}
                    </div>

                    {error && <div className="rc-error" style={{ marginTop: '0.5rem' }}><span>{error}</span><button className="rc-error-x" onClick={() => setError('')}>✕</button></div>}

                    <button className="rc-action-btn orange" style={{ width: '100%', marginTop: '0.85rem', justifyContent: 'center' }}
                      onClick={handleRecapIntake} disabled={recapIntaking}>
                      {recapIntaking ? 'Creating…' : '📋 Intake for Recapping'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>{/* end rc-root */}
    </>
  );
}

export default RecapPage
