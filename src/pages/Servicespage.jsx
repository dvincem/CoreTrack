import '../pages_css/Servicespage.css';
import React from 'react'
import { API_URL, apiFetch } from '../lib/config'
import KpiCard from '../components/KpiCard'
import SearchInput from '../components/SearchInput'
import FilterHeader from '../components/FilterHeader'

  /* ============================================================
     TIREHUB — SERVICES PAGE
     Fetches:
       GET    /api/services                  — list all services
       POST   /api/services                  — create service
       PUT    /api/services/:service_id      — update service
       DELETE /api/services/:service_id      — soft-delete
     ============================================================ */

  ;


function svcCurrency(n) {
  try {
    return currency(n);
  } catch {
    return `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

const BLANK_FORM = {
  service_name: "",
  service_code: "",
  base_price: "",
  commission_rate: "",
  is_commissionable: true,
};

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
function Servicespage() {
  const [services, setServices] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [serverCaps, setServerCaps] = React.useState({
    canCreate: true,
    canEdit: true,
    canDelete: true,
    checked: true,
  });

  const [search, setSearch] = React.useState("");
  const [suggestions, setSuggestions] = React.useState([]);
  const [showSug, setShowSug] = React.useState(false);
  const [commFilter, setCommFilter] = React.useState("ALL");
  const [svcPage, setSvcPage] = React.useState(1);
  const SVC_PAGE_SIZE = 10;

  const [formOpen, setFormOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState(null);
  const [form, setForm] = React.useState(BLANK_FORM);
  const [saving, setSaving] = React.useState(false);
  const [isDraftLoaded, setIsDraftLoaded] = React.useState(false);

  const [confirmDelete, setConfirmDelete] = React.useState(null);
  const [deleting, setDeleting] = React.useState(false);
  const [pendingSave, setPendingSave] = React.useState(null);

  const [toasts, setToasts] = React.useState([]);

  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => {
    if (!document.documentElement.getAttribute("data-theme")) {
      document.documentElement.setAttribute(
        "data-theme",
        (() => {
          try {
            return localStorage.getItem("th-theme") || "light";
            } catch {
            return "light";
            }        })(),
      );
    }
    const obs = new MutationObserver(() => forceUpdate());
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    fetchServices();
    return () => obs.disconnect();
  }, []);

  // --- Persistence Logic ---
  React.useEffect(() => {
    // Only persist if NOT editing an existing service
    if (!editTarget) {
      try {
        const draft = localStorage.getItem('th-svc-add-draft');
        if (draft) setForm(JSON.parse(draft));
        const open = localStorage.getItem('th-svc-add-open');
        if (open) setFormOpen(open === "true");
      } catch (e) { console.error("Failed to load Service draft", e); }
    }
    setIsDraftLoaded(true);
  }, [editTarget]);

  React.useEffect(() => {
    if (!isDraftLoaded || editTarget) return;
    localStorage.setItem('th-svc-add-draft', JSON.stringify(form));
    localStorage.setItem('th-svc-add-open', String(formOpen));
  }, [form, formOpen, isDraftLoaded, editTarget]);

  function toast(msg, type = "success") {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }

  async function fetchServices() {
    setLoading(true);
    try {
      const data = await apiFetch(`${API_URL}/services`).then((r) => r.json());
      setServices(Array.isArray(data) ? data : []);
    } catch {
      setServices([]);
    }
    setLoading(false);
  }

  /* Handle suggestion click */

  /* ── Derived ── */
  const filtered = services.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (s.service_name || "").toLowerCase().includes(q) ||
      (s.service_code || "").toLowerCase().includes(q);
    const matchComm =
      commFilter === "ALL" ||
      (commFilter === "YES" ? s.is_commissionable : !s.is_commissionable);
    return matchSearch && matchComm;
  });

  React.useEffect(() => { setSvcPage(1) }, [search, commFilter])

  const prices = services.map((s) => s.base_price).filter(Boolean);
  const avgPrice = prices.length
    ? prices.reduce((a, b) => a + b, 0) / prices.length
    : 0;
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;

  /* ── Form helpers ── */
  function openAdd() {
    setEditTarget(null);
    setForm({ ...BLANK_FORM });
    setFormOpen(true);
  }
  function openEdit(svc) {
    setEditTarget(svc);
    setForm({
      service_name: svc.service_name,
      service_code: svc.service_code,
      base_price: svc.base_price,
      commission_rate: svc.commission_rate != null ? String(svc.commission_rate) : "",
      is_commissionable: !!svc.is_commissionable,
    });
    setFormOpen(true);
  }
  function cancelForm() {
    setFormOpen(false);
    setEditTarget(null);
    setForm(BLANK_FORM);
    localStorage.removeItem('th-svc-add-draft');
    localStorage.removeItem('th-svc-add-open');
  }

  function hideForm() {
    setFormOpen(false);
    setEditTarget(null);
  }

  function autoCode(name) {
    return (
      "SVC-" +
      name
        .trim()
        .substring(0, 6)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "") +
      "-" +
      Date.now().toString().slice(-4)
    );
  }

  function handleSave() {
    if (!form.service_name || !form.base_price) {
      toast("Service name and price are required.", "error");
      return;
    }
    const payload = {
      service_name: form.service_name,
      service_code: form.service_code || autoCode(form.service_name),
      base_price: parseFloat(form.base_price),
      commission_rate: parseFloat(form.commission_rate) || 0,
      is_commissionable: form.is_commissionable ? 1 : 0,
    };
    setPendingSave({ payload, isEdit: !!editTarget });
  }

  async function confirmSave() {
    const { payload, isEdit } = pendingSave;
    setPendingSave(null);
    setSaving(true);
    try {
      let res, data;
      if (isEdit) {
        res = await apiFetch(`${API_URL}/services/${editTarget.service_id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await apiFetch(`${API_URL}/services`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      data = await res.json();
      if (data.error) {
        toast(data.error, "error");
      } else {
        toast(isEdit ? "Service updated!" : "Service added!");
        localStorage.removeItem('th-svc-add-draft');
        localStorage.removeItem('th-svc-add-open');
        cancelForm();
        fetchServices();
      }
    } catch {
      toast("Failed to save service.", "error");
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await apiFetch(
        `${API_URL}/services/${confirmDelete.service_id}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (data.error) toast(data.error, "error");
      else {
        toast("Service removed.");
        setConfirmDelete(null);
        fetchServices();
      }
    } catch {
      toast("Failed to delete.", "error");
    }
    setDeleting(false);
  }

  React.useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) { setSuggestions([]); return; }
    const seen = new Set();
    const sugs = [];
    const add = (text, type, icon) => {
      const key = type + ':' + text;
      if (!seen.has(key) && text.toLowerCase().includes(q)) { seen.add(key); sugs.push({ text, type, icon }); }
    };
    for (const s of services) {
      add(s.service_name || '', 'Service', '🔧');
      add(s.service_code || '', 'Code', '🔢');
    }
    setSuggestions(sugs.slice(0, 10));
  }, [search, services]);

  const crudAvailable =
    serverCaps.canCreate && serverCaps.canEdit && serverCaps.canDelete;

  return (
    <>
      <style>{`
        .svc-root {
            font-family: var(--font-body);
            color: var(--th-text-body);
            display: flex;
            flex-direction: column;
            gap: .5rem;
        }
      `}</style>
      <div className="svc-root">
        {/* Header */}
        <div className="svc-header">
          <div className="svc-title">
            Services <span>Management</span>
          </div>
          {crudAvailable && (
            <button className="svc-btn-primary" onClick={openAdd}>
              + Add Service
            </button>
          )}
        </div>

        {/* Server capability banner */}
        {serverCaps.checked && !crudAvailable && (
          <div className="svc-banner">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <strong>Read-only mode</strong> — The server doesn't have service
              CRUD endpoints yet. You can view services, but can't add, edit, or
              delete. To enable full management, add these to{" "}
              <code>Server.js</code>: <code>POST /api/services</code>,{" "}
              <code>PUT /api/services/:service_id</code>,{" "}
              <code>DELETE /api/services/:service_id</code>. A ready-to-paste
              block is available in the updated Server.js output.
            </div>
          </div>
        )}



        {/* Add / Edit Service Modal */}
        {formOpen && crudAvailable && (
          <div className="svc-form-overlay" onClick={e => { if (e.target === e.currentTarget) hideForm(); }}>
            <div className="svc-form-modal">
              <div className="svc-form-modal-header">
                <div className="svc-form-modal-title">{editTarget ? "Edit Service" : "Add New Service"}</div>
                <button className="svc-form-modal-close" onClick={hideForm}>✕</button>
              </div>
              <div className="svc-form-grid">
                <div className="svc-field" style={{ gridColumn: "span 2" }}>
                  <div className="svc-label">Service Name *</div>
                  <input
                    className="svc-input"
                    value={form.service_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, service_name: e.target.value }))
                    }
                    placeholder="e.g. Wheel Balancing"
                  />
                </div>
                <div className="svc-field">
                  <div className="svc-label">Service Code</div>
                  <input
                    className="svc-input"
                    value={form.service_code}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, service_code: e.target.value }))
                    }
                    placeholder="Auto-generated"
                  />
                </div>
                <div className="svc-field">
                  <div className="svc-label">Base Price *</div>
                  <input
                    className="svc-input"
                    type="number"
                    value={form.base_price}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, base_price: e.target.value }))
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="svc-field">
                  <div className="svc-label">Commission Rate (%)</div>
                  <input
                    className="svc-input"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={form.commission_rate}
                    onChange={(e) => setForm((f) => ({ ...f, commission_rate: e.target.value }))}
                    placeholder="e.g. 10"
                    disabled={!form.is_commissionable}
                  />
                </div>
                <div className="svc-field">
                  <div className="svc-label">Commissionable?</div>
                  <select
                    className="svc-input"
                    value={form.is_commissionable ? "yes" : "no"}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        is_commissionable: e.target.value === "yes",
                      }))
                    }
                  >
                    <option value="yes">Yes — Earns Commission</option>
                    <option value="no">No Commission</option>
                  </select>
                </div>
              </div>
              <div className="svc-form-actions" style={{ marginTop: "1rem" }}>
                <button
                  className="svc-btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving
                    ? "Saving…"
                    : editTarget
                      ? "Update Service"
                      : "Save Service"}
                </button>
                <button className="svc-btn-ghost" onClick={cancelForm}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        {(() => {
          const active = services.filter(s => s.is_active !== 0);
          const commissionable = active.filter(s => s.is_commissionable);
          const avgP = active.length ? active.reduce((s, sv) => s + (sv.base_price || 0), 0) / active.length : 0;
          return (
            <div className="svc-kpi-grid">
              <KpiCard label="Total Services" value={active.length} accent="sky" sub="active services" />
              <KpiCard label="Commissionable" value={commissionable.length} accent="amber" sub="earn commission" />
              <KpiCard label="Non-Commission" value={active.length - commissionable.length} accent="violet" sub="flat fee services" />
              <KpiCard label="Avg Price" value={svcCurrency(avgP)} accent="emerald" sub="per service" />
            </div>
          );
        })()}

        {/* Filter Header */}
        <FilterHeader
          searchProps={{
            value: search,
            onChange: setSearch,
            placeholder: "Search by name or code…",
            suggestions: suggestions,
            onSuggestionSelect: (s) => setSearch(s.text),
          }}
          filters={[
            { label: "All", value: "ALL", active: commFilter === "ALL" },
            { label: "Commissionable", value: "YES", active: commFilter === "YES" },
            { label: "Non-commission", value: "NO", active: commFilter === "NO" },
          ]}
          onFilterChange={setCommFilter}
          accentColor="var(--th-emerald)"
        />

        {crudAvailable && (
          <button className="svc-btn-primary svc-new-btn-mobile" onClick={openAdd}>
            + Add Service
          </button>
        )}

        {/* Card Grid */}
        <div className="th-section-label">Service Directory</div>
        {loading ? (
          <div className="svc-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="svc-card" style={{ gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div className="th-skel-cell w80" style={{ height: '14px' }} />
                    <div className="th-skel-cell w40" style={{ height: '10px' }} />
                  </div>
                  <div className="th-skel-cell w30" style={{ height: '22px', marginLeft: '0.5rem' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div className="th-skel-cell w30" style={{ height: '10px' }} />
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <div className="th-skel-cell w20" style={{ height: '26px', width: '36px' }} />
                    <div className="th-skel-cell w20" style={{ height: '26px', width: '36px' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="svc-empty">
            <svg className="svc-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14" /></svg>
            <span className="svc-empty-title">{services.length === 0 ? "No Services" : "No Matches"}</span>
            {services.length === 0
              ? "No services found in the database."
              : "No services match your search."}
          </div>
        ) : (
          <div className="svc-grid">
            {filtered.slice((svcPage - 1) * SVC_PAGE_SIZE, svcPage * SVC_PAGE_SIZE).map((svc) => (
              <div key={svc.service_id} className="svc-card">
                <div className="svc-card-top">
                  <div>
                    <div className="svc-card-name">{svc.service_name}</div>
                    <div className="svc-card-code">{svc.service_code}</div>
                  </div>
                  <div className="svc-card-price">
                    {svcCurrency(svc.base_price)}
                  </div>
                </div>
                <div className="svc-card-bottom">
                  {crudAvailable && (
                    <div className="svc-card-actions">
                      <button
                        className="svc-icon-btn edit"
                        title="Edit"
                        onClick={() => openEdit(svc)}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        className="svc-icon-btn del"
                        title="Delete"
                        onClick={() => setConfirmDelete(svc)}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {Math.ceil(filtered.length / SVC_PAGE_SIZE) > 1 && (
          <div className="svc-pagination">
            <button className="svc-page-btn" disabled={svcPage === 1} onClick={() => setSvcPage(1)}>«</button>
            <button className="svc-page-btn" disabled={svcPage === 1} onClick={() => setSvcPage(p => p - 1)}>‹</button>
            {Array.from({ length: Math.min(5, Math.ceil(filtered.length / SVC_PAGE_SIZE)) }, (_, i) => {
              const totalPages = Math.ceil(filtered.length / SVC_PAGE_SIZE);
              const start = Math.max(1, Math.min(svcPage - 2, totalPages - 4));
              const p = start + i;
              if (p > totalPages) return null;
              return <button key={p} className={`svc-page-btn${svcPage === p ? ' active' : ''}`} onClick={() => setSvcPage(p)}>{p}</button>;
            })}
            <button className="svc-page-btn" disabled={svcPage === Math.ceil(filtered.length / SVC_PAGE_SIZE)} onClick={() => setSvcPage(p => p + 1)}>›</button>
            <button className="svc-page-btn" disabled={svcPage === Math.ceil(filtered.length / SVC_PAGE_SIZE)} onClick={() => setSvcPage(Math.ceil(filtered.length / SVC_PAGE_SIZE))}>»</button>
          </div>
        )}

        {/* Save Confirm Modal */}
        {pendingSave && (
          <div className="confirm-overlay">
            <div className="confirm-box">
              <div className="confirm-title">{pendingSave.isEdit ? 'Confirm Update Service' : 'Confirm Add Service'}</div>
              <div className="confirm-details">
                <div className="confirm-detail-row"><span className="confirm-detail-label">Name</span><span className="confirm-detail-val">{pendingSave.payload.service_name}</span></div>
                <div className="confirm-detail-row"><span className="confirm-detail-label">Code</span><span className="confirm-detail-val">{pendingSave.payload.service_code}</span></div>
                <div className="confirm-detail-row"><span className="confirm-detail-label">Price</span><span className="confirm-detail-val">₱{Number(pendingSave.payload.base_price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span></div>
                <div className="confirm-detail-row"><span className="confirm-detail-label">Commission Rate</span><span className="confirm-detail-val">{pendingSave.payload.commission_rate}%</span></div>
                <div className="confirm-detail-row"><span className="confirm-detail-label">Commissionable</span><span className="confirm-detail-val">{pendingSave.payload.is_commissionable ? 'Yes' : 'No'}</span></div>
              </div>
              <div className="confirm-actions">
                <button className="confirm-btn-cancel" onClick={() => setPendingSave(null)}>Cancel</button>
                <button className="confirm-btn-ok" onClick={confirmSave}>Confirm</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirm Modal */}
        {confirmDelete && (
          <div className="confirm-overlay">
            <div className="confirm-box">
              <div className="confirm-title">Remove Service?</div>
              <div className="confirm-details">
                <div className="confirm-detail-row"><span className="confirm-detail-label">Service</span><span className="confirm-detail-val">{confirmDelete.service_name}</span></div>
                <div className="confirm-detail-row"><span className="confirm-detail-label">Code</span><span className="confirm-detail-val">{confirmDelete.service_code}</span></div>
                <div className="confirm-detail-row"><span className="confirm-detail-label">Price</span><span className="confirm-detail-val">₱{Number(confirmDelete.base_price || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span></div>
                <div className="confirm-detail-row"><span className="confirm-detail-label">Action</span><span className="confirm-detail-val" style={{ color: 'var(--th-rose)' }}>Permanently remove</span></div>
              </div>
              <div className="confirm-actions">
                <button className="confirm-btn-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
                <button className="confirm-btn-ok danger" onClick={handleDelete} disabled={deleting}>{deleting ? "Removing…" : "Remove"}</button>
              </div>
            </div>
          </div>
        )}

        {/* Toasts */}
        <div className="svc-toast-wrap">
          {toasts.map((t) => (
            <div key={t.id} className={`svc-toast ${t.type}`}>
              {t.msg}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

      export default Servicespage
