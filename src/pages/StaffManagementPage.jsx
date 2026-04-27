import React, { useState, useEffect, useMemo } from 'react'
import { API_URL, apiFetch, SkeletonRows } from '../lib/config'
import KpiCard from '../components/KpiCard'
import SearchInput from '../components/SearchInput'
import FilterHeader from '../components/FilterHeader'
import Pagination from '../components/Pagination'
import Modal from '../components/Modal'
import usePaginatedResource from '../hooks/usePaginatedResource'

/* ============================================================
   TIREHUB — STAFF MANAGEMENT PAGE (UNIFIED)
   A single-view dashboard for staff details & attendance.
   Optimized for PC and Mobile with unified modal & roster.
   ============================================================ */

export const MANAGEMENT_ROLES = ['Owner', 'Manager', 'Sales', 'Cashier', 'Admin']
export const SERVICE_ROLES = ['Tireman', 'Technician', 'Mechanic', 'Vulcanizer', 'Helper', 'Service Staff']

const WORK_STATUS_LABELS = { ACTIVE: 'Active', VACATION: 'On Leave', SUSPENDED: 'Suspended', ALWAYS_PRESENT: 'Always Present', TERMINATED: 'Terminated' }
const WORK_STATUS_CLASS = { ACTIVE: 'active', VACATION: 'leave', SUSPENDED: 'suspended', ALWAYS_PRESENT: 'active', TERMINATED: 'suspended' }
const WS_ICONS = { ACTIVE: '●', ALWAYS_PRESENT: '★', VACATION: '✈', SUSPENDED: '⛔', TERMINATED: '✖' }

function roleBadgeStyle(role) {
  const isMgmt = MANAGEMENT_ROLES.map(r => r.toLowerCase()).includes((role || '').toLowerCase())
  return {
    background: isMgmt ? 'var(--th-orange-bg)' : 'var(--th-sky-bg)',
    color: isMgmt ? 'var(--th-orange)' : 'var(--th-sky)',
  }
}

const BLANK_FORM = { full_name: '', email: '', role: '' }

/* ════════════ UNIFIED STAFF DETAIL & CALENDAR MODAL ════════════ */
function StaffDetailModal({ staff, shopId, onClose, onEdit, onRemove, onStatusToggle }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [records, setRecords] = useState([]);
  const [calLoading, setCalLoading] = useState(false);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  useEffect(() => {
    async function load() {
      setCalLoading(true);
      try {
        const from = `${monthStr}-01`;
        const lastDay = new Date(year, month + 1, 0).getDate();
        const to = `${monthStr}-${String(lastDay).padStart(2, '0')}`;
        const r = await apiFetch(`${API_URL}/attendance-history/${shopId}/${staff.staff_id}?from=${from}&to=${to}`);
        const data = await r.json();
        setRecords(Array.isArray(data) ? data : []);
      } catch {
        setRecords([]);
      }
      setCalLoading(false);
    }
    load();
  }, [staff.staff_id, shopId, monthStr, year, month]);

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const statusMap = {};
  records.forEach(r => {
    if (r.attendance_date) {
      const d = r.attendance_date.split('T')[0];
      statusMap[d] = r.status;
    }
  });

  const cells = [];
  const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - firstDow + 1;
    cells.push(dayNum >= 1 && dayNum <= daysInMonth ? dayNum : null);
  }

  const presentDays = records.filter(r => r.status === 'PRESENT').length;
  const absentDays = records.filter(r => r.status === 'ABSENT').length;

  return (
    <Modal
      isOpen={!!staff}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span>{staff.full_name}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--th-text-faint)', textTransform: 'none', letterSpacing: 'normal', fontWeight: 500, fontFamily: 'Inter, system-ui, sans-serif', marginTop: '0.15rem' }}>
            {staff.staff_code} · {staff.role || 'Staff Member'}
          </span>
        </div>
      }
      maxWidth="600px"
      headerActions={
        <button className="sp-btn-edit" onClick={onEdit} style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}>Edit Profile</button>
      }
    >
      <div className="staff-detail-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Staff Info Grid */}
        <div className="inv-hist-item-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', padding: '0.5rem' }}>
          <div className="inv-hist-stat" style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="inv-hist-stat-label" style={{ margin: 0 }}>Contact</div>
            <div className="inv-hist-stat-val" style={{ fontSize: '0.85rem', color: 'var(--th-sky)' }}>{staff.email || 'None'}</div>
          </div>
          <div className="inv-hist-stat" style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="inv-hist-stat-label" style={{ margin: 0 }}>Work Status</div>
            <div className="inv-hist-stat-val">
              <button className={`sp-status-badge ${WORK_STATUS_CLASS[staff.work_status] || 'active'}`} onClick={onStatusToggle} style={{ margin: 0, padding: '0.2rem 0.5rem' }}>
                {WS_ICONS[staff.work_status] || '✓'} {WORK_STATUS_LABELS[staff.work_status] || 'Active'}
              </button>
            </div>
          </div>
        </div>

        {/* Attendance History Section */}
        <div style={{ borderTop: '1px solid var(--th-border)', paddingTop: '1rem' }}>
          <div className="th-section-label" style={{ marginTop: 0, marginBottom: '0.75rem' }}>Attendance History</div>

          <div className="att-cal-nav" style={{ marginBottom: '1rem' }}>
            <button className="att-cal-nav-btn" onClick={() => setViewDate(new Date(year, month - 1, 1))}>‹</button>
            <span className="att-cal-month-label">{viewDate.toLocaleString('default', { month: 'long' })} {year}</span>
            <button className="att-cal-nav-btn" onClick={() => setViewDate(new Date(year, month + 1, 1))} disabled={year === today.getFullYear() && month >= today.getMonth()}>›</button>
          </div>

          <div className="att-cal-legend" style={{ marginBottom: '1rem' }}>
            <span className="att-cal-leg-dot present" /> <span className="th-text-xs" style={{ marginRight: '1rem' }}>Present ({presentDays})</span>
            <span className="att-cal-leg-dot absent" /> <span className="th-text-xs">Absent ({absentDays})</span>
          </div>

          {calLoading ? <div className="th-table-empty">Loading Calendar...</div> : (
            <div className="att-cal-grid" style={{ padding: '0.5rem', background: 'var(--th-bg-card-alt)', borderRadius: '10px' }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="att-cal-day-label">{d}</div>)}
              {cells.map((dayNum, i) => {
                if (!dayNum) return <div key={i} className="att-cal-cell empty" />;
                const dateStr = `${monthStr}-${String(dayNum).padStart(2, '0')}`;
                const status = statusMap[dateStr];
                const isToday = dateStr === today.toISOString().split('T')[0];
                return (
                  <div key={i} className={`att-cal-cell ${status === 'PRESENT' ? 'present' : status === 'ABSENT' ? 'absent' : ''} ${isToday ? 'today' : ''}`}>
                    {dayNum}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-start', borderTop: '1px solid var(--th-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
          <button
            style={{ background: 'none', border: 'none', color: 'var(--th-rose)', fontSize: '0.75rem', cursor: 'pointer', padding: '0', textDecoration: 'underline', textUnderlineOffset: '3px', opacity: 0.7 }}
            onClick={onRemove}
          >
            Manage Status / Remove Member
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ════════════ MAIN COMPONENT ════════════ */
export default function StaffManagementPage({ shopId, setPageContext, userRole, userPower }) {
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendance, setAttendance] = useState([]);
  const [statsRange, setStatsRange] = useState("month");
  const [staffStats, setStaffStats] = useState({});
  const [kpiData, setKpiData] = useState(null);

  const isSuperAdmin = (userPower && userPower >= 80) || userRole === 'admin' || userRole === 'owner';

  const STAFF_PER_PAGE = 20;
  const {
    data: staff, page, setPage, totalPages, total, loading,
    search, setSearch, refetch: fetchStaff
  } = usePaginatedResource({
    url: `${API_URL}/staff/${shopId}`,
    perPage: STAFF_PER_PAGE,
    enabled: !!shopId,
    deps: [shopId],
  });

  // Modal States
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(BLANK_FORM);
  const [addError, setAddError] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(BLANK_FORM);
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [pendingBulkMark, setPendingBulkMark] = useState(null);
  const [pendingMarkAll, setPendingMarkAll] = useState(null);

  // Selection & UI
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [successMsg, setSuccessMsg] = useState('');
  const [wsMenu, setWsMenu] = useState(null);

  useEffect(() => {
    if (!shopId) return;
    apiFetch(`${API_URL}/staff-kpi/${shopId}`).then(r => r.json()).then(d => !d.error && setKpiData(d));

    const closeMenu = () => setWsMenu(null);
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, [shopId]);

  useEffect(() => {
    fetchAttendance();
    fetchAttendanceStats();
  }, [attendanceDate, shopId, statsRange]);

  async function fetchAttendance() {
    try {
      const r = await apiFetch(`${API_URL}/attendance/${shopId}?attendance_date=${attendanceDate}`);
      setAttendance((await r.json()) || []);
    } catch { }
  }

  async function fetchAttendanceStats() {
    const now = new Date(attendanceDate);
    let from;
    if (statsRange === "week") {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      from = d.toISOString().split("T")[0];
    } else if (statsRange === "month") {
      from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    } else from = `${now.getFullYear()}-01-01`;

    try {
      const r = await apiFetch(`${API_URL}/attendance-stats/${shopId}?from=${from}&to=${attendanceDate}`);
      const rows = await r.json();
      if (Array.isArray(rows)) {
        const map = {};
        rows.forEach(row => { map[row.staff_id] = row; });
        setStaffStats(map);
      }
    } catch { }
  }

  // Action Handlers
  async function handleAdd() {
    if (!addForm.full_name.trim() || !addForm.role) { setAddError('Name and Role are required.'); return; }
    setAddSaving(true); setAddError('');
    try {
      const res = await apiFetch(`${API_URL}/staff`, {
        method: 'POST',
        body: JSON.stringify({ ...addForm, full_name: addForm.full_name.trim(), email: addForm.email.trim() || undefined, role: addForm.role }),
      });
      if (!res.ok) { setAddError('Failed to add staff'); return; }
      fetchStaff(); setShowAdd(false);
    } catch { setAddError('Connection error'); }
    finally { setAddSaving(false); }
  }

  async function handleEdit() {
    if (!editForm.full_name.trim() || !editForm.role) { setEditError('Name and Role are required.'); return; }
    setEditSaving(true); setEditError('');
    try {
      const res = await apiFetch(`${API_URL}/staff/${editTarget.staff_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...editForm, full_name: editForm.full_name.trim(), email: editForm.email.trim() || null, role: editForm.role }),
      });
      if (!res.ok) { setEditError('Failed to update'); return; }
      fetchStaff(); setEditTarget(null);
      if (detailTarget?.staff_id === editTarget.staff_id) {
        setDetailTarget({ ...detailTarget, ...editForm });
      }
    } catch { setEditError('Connection error'); }
    finally { setEditSaving(false); }
  }

  async function handleRemove() {
    try {
      await apiFetch(`${API_URL}/staff/${removeTarget.staff_id}`, { method: 'DELETE' });
      fetchStaff(); setDetailTarget(null);
    } catch { }
    finally { setRemoveTarget(null); }
  }

  async function updateWorkStatus(s, next) {
    try {
      await apiFetch(`${API_URL}/staff/${s.staff_id}/work-status`, {
        method: 'PATCH', body: JSON.stringify({ work_status: next }),
      });
      fetchStaff();
      if (detailTarget?.staff_id === s.staff_id) setDetailTarget({ ...detailTarget, work_status: next });
      if (removeTarget?.staff_id === s.staff_id) setRemoveTarget(null);
      setSuccessMsg(`Status updated to ${WORK_STATUS_LABELS[next]}`);
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch { }
  }

  const toggleStatus = (s) => {
    const next = s.work_status === 'VACATION' ? 'ACTIVE' : 'VACATION';
    updateWorkStatus(s, next);
  };

  async function updateAttendance(sid, status) {
    try {
      await apiFetch(`${API_URL}/attendance`, {
        method: "POST",
        body: JSON.stringify({ staff_id: sid, shop_id: shopId, attendance_date: attendanceDate, status }),
      });
      fetchAttendance();
    } catch { }
  }

  async function confirmBulkMark() {
    const { status, ids } = pendingBulkMark;
    setPendingBulkMark(null);
    try {
      await Promise.all(ids.map(sid => updateAttendance(sid, status)));
      fetchAttendance();
      setSelectedIds(new Set());
      setSuccessMsg(`Marked ${ids.length} staff as ${status}`);
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch { }
  }

  // Memoized Filters & Stats
  const filteredStaff = staff;

  const presentCount = attendance.filter(a => a.status === "PRESENT").length;
  const attRate = staff.length > 0 ? Math.round((presentCount / staff.length) * 100) : 0;

  const mgmtCount = kpiData?.mgmtCount ?? staff.filter(s => MANAGEMENT_ROLES.includes(s.role)).length;
  const serviceCount = kpiData?.serviceCount ?? staff.filter(s => SERVICE_ROLES.includes(s.role)).length;
  const onLeave = kpiData?.onLeave ?? staff.filter(s => s.work_status === 'VACATION' || s.work_status === 'SUSPENDED').length;

  // ── AI Context ────────────────────────────────────────────────────────────
  useEffect(() => {
    setPageContext({
      view: "Staff Management",
      date: attendanceDate,
      metrics: {
        total_staff: total,
        present_today: presentCount,
        attendance_rate: `${attRate}%`,
        on_leave: onLeave,
        management_count: mgmtCount,
        service_count: serviceCount
      }
    });
  }, [total, presentCount, attRate, onLeave, mgmtCount, serviceCount, attendanceDate, setPageContext]);

  return (
    <div className="sp-root animate-slide-in-right">
      {/* Header */}
      <div className="sp-header-row">
        <div className="th-title-format">Staff <span style={{ color: 'var(--th-orange)' }}>Management</span></div>
        <div className="att-header-actions" style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
          {/* PC Add Button */}
          <button className="sp-btn-add sp-add-desktop" onClick={() => { setShowAdd(true); setAddForm(BLANK_FORM); }}>+ Add Staff</button>

          {selectedIds.size > 0 ? (
            <>
              <span className="th-text-xs" style={{ color: 'var(--th-text-dim)' }}>{selectedIds.size} Selected</span>
              <button className="sp-btn-add sp-add-desktop" style={{ background: 'var(--th-emerald)' }} onClick={() => setPendingBulkMark({ status: 'PRESENT', ids: [...selectedIds], count: selectedIds.size })}>✓ Present</button>
              <button className="sp-btn-add sp-add-desktop" style={{ background: 'var(--th-rose)' }} onClick={() => setPendingBulkMark({ status: 'ABSENT', ids: [...selectedIds], count: selectedIds.size })}>✕ Absent</button>
              <button className="th-btn th-btn-ghost" style={{ padding: '0.5rem 1rem' }} onClick={() => setSelectedIds(new Set())}>Clear</button>
            </>
          ) : (
            <button className="sp-btn-add sp-add-desktop" style={{ background: 'var(--th-emerald)' }} onClick={() => setPendingMarkAll({ date: attendanceDate, count: filteredStaff.length })}>Mark All Present</button>
          )}
        </div>
      </div>

      {successMsg && <div className="att-success">✓ {successMsg}</div>}

      {/* Shared KPIs */}
      <div className="th-kpi-row">
        <KpiCard label="Total Staff" value={total} accent="sky" loading={loading} />
        <KpiCard label="Management" value={mgmtCount} accent="orange" loading={loading} />
        <KpiCard label="Service Staff" value={serviceCount} accent="violet" loading={loading} />
        <KpiCard label="Present (Today)" value={`${presentCount} / ${staff.length}`} accent="emerald" sub={`${attRate}% Rate`} loading={loading} />
      </div>

      {/* Filter Header */}
      <FilterHeader
        searchProps={{
          value: search,
          onChange: setSearch,
          placeholder: "Search staff name or code...",
          resultCount: search.trim() ? filteredStaff.length : undefined,
          resultLabel: "staff",
        }}
        leftComponent={
          <input
            type="date"
            className="fh-date"
            value={attendanceDate}
            max={new Date().toISOString().split("T")[0]}
            onChange={e => setAttendanceDate(e.target.value)}
          />
        }
        accentColor="var(--th-orange)"
      />

      <style>{`
        .sp-btn-add { background: var(--th-orange); color: #fff !important; }
        .sp-mobile-actions-row { display: none; gap: 0.5rem; margin-bottom: 1rem; }
        @media (max-width: 640px) {
          .sp-mobile-actions-row { display: flex; }
          .sp-add-mobile { display: none !important; }
        }
      `}</style>

      {/* Mobile-only Action Row */}
      <div className="sp-mobile-actions-row">
        <button className="sp-btn-add" style={{ flex: 1, padding: '0.65rem', fontSize: '0.9rem' }} onClick={() => { setShowAdd(true); setAddForm(BLANK_FORM); }}>+ Add Staff</button>
        {selectedIds.size > 0 ? (
          <button className="sp-btn-add" style={{ flex: 1, background: 'var(--th-emerald)', padding: '0.65rem', fontSize: '0.9rem' }} onClick={() => setPendingBulkMark({ status: 'PRESENT', ids: [...selectedIds], count: selectedIds.size })}>✓ Present</button>
        ) : (
          <button className="sp-btn-add" style={{ flex: 1, background: 'var(--th-emerald)', padding: '0.65rem', fontSize: '0.9rem' }} onClick={() => setPendingMarkAll({ date: attendanceDate, count: filteredStaff.length })}>Mark Present</button>
        )}
      </div>

      {/* Unified Table */}
      <div className="th-section-label">Staff Roster & Attendance</div>
      <div className="sp-table-card">
        <div className="sp-table-scroll">
          <table className="sp-table">
            <thead>
              <tr>
                <th style={{ width: 40, whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={filteredStaff.length > 0 && filteredStaff.every(s => selectedIds.has(s.staff_id))}
                    onChange={e => setSelectedIds(e.target.checked ? new Set(filteredStaff.map(s => s.staff_id)) : new Set())} />
                </th>
                <th style={{ whiteSpace: 'nowrap' }}>Staff Member</th>
                <th style={{ whiteSpace: 'nowrap' }}>Today's Status</th>
                <th style={{ whiteSpace: 'nowrap' }}>Consistency</th>
                <th style={{ whiteSpace: 'nowrap' }}>Work Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows rows={8} cols={5} />
              ) : filteredStaff.length === 0 ? (
                <tr><td colSpan="10" className="th-table-empty">No staff found matching filters.</td></tr>
              ) : (
                filteredStaff.map(s => {
                  const att = attendance.find(a => a.staff_id === s.staff_id);
                  const st = staffStats[s.staff_id];
                  const pct = st && st.total_days > 0 ? Math.round((st.present_days / st.total_days) * 100) : 0;

                  return (
                    <tr key={s.staff_id} onClick={() => setDetailTarget(s)} style={{ cursor: 'pointer' }}>
                      <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                        <input type="checkbox" checked={selectedIds.has(s.staff_id)}
                          onChange={e => {
                            const next = new Set(selectedIds);
                            e.target.checked ? next.add(s.staff_id) : next.delete(s.staff_id);
                            setSelectedIds(next);
                          }} />
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div className="sp-name" style={{ fontWeight: 600 }}>{s.full_name}</div>
                        <div className="sp-code" style={{ fontSize: '0.75rem', color: 'var(--th-text-faint)', marginTop: '0.15rem' }}>
                          {s.staff_code} · {s.role || 'Staff Member'}
                        </div>
                      </td>
                      <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                        <button
                          className={`att-badge att-badge-${(att?.status || (s.work_status === 'ALWAYS_PRESENT' ? 'PRESENT' : 'none'))} att-badge-btn`}
                          onClick={() => {
                            const next = att?.status === 'PRESENT' || (s.work_status === 'ALWAYS_PRESENT' && !att?.status) ? 'ABSENT' : 'PRESENT';
                            updateAttendance(s.staff_id, next);
                          }}
                        >
                          {att?.status === 'PRESENT' ? '✓ Present' : att?.status === 'ABSENT' ? '✕ Absent' : (s.work_status === 'ALWAYS_PRESENT' ? '★ Always Present' : '— Not Set')}
                        </button>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {st ? (
                          <div style={{ width: 80 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: 2 }}>
                              <span>{pct}%</span>
                            </div>
                            <div style={{ height: 4, borderRadius: 4, background: 'var(--th-bg-input)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: pct >= 85 ? 'var(--th-emerald)' : pct >= 65 ? 'var(--th-amber)' : 'var(--th-rose)' }} />
                            </div>
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ position: 'relative' }}>
                          <button
                            className={`att-ws-badge att-ws-${s.work_status || "ACTIVE"}`}
                            onClick={e => {
                              e.stopPropagation();
                              setWsMenu(wsMenu === s.staff_id ? null : s.staff_id);
                            }}
                          >
                            {WS_ICONS[s.work_status || "ACTIVE"]} {WORK_STATUS_LABELS[s.work_status || "ACTIVE"]}
                          </button>
                          {wsMenu === s.staff_id && (
                            <div className="att-ws-menu" onClick={e => e.stopPropagation()}>
                              {Object.entries(WORK_STATUS_LABELS).map(([val, label]) => (
                                <button key={val} className={`att-ws-opt${s.work_status === val ? ' active' : ''}`}
                                  onClick={() => {
                                    updateWorkStatus(s, val);
                                    setWsMenu(null);
                                  }}>
                                  {WS_ICONS[val]} {label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0.75rem 0' }}>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* Unified Detail & Calendar Modal */}
      {detailTarget && (
        <StaffDetailModal
          staff={detailTarget}
          shopId={shopId}
          onClose={() => setDetailTarget(null)}
          onEdit={() => { setEditTarget(detailTarget); setEditForm(detailTarget); setDetailTarget(null); }}
          onRemove={() => { setRemoveTarget(detailTarget); setDetailTarget(null); }}
          onStatusToggle={() => toggleStatus(detailTarget)}
        />
      )}

      {/* Add Staff Modal */}
      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add New Staff"
        footer={
          <>
            <button className="th-btn th-btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="th-btn th-btn-orange" onClick={handleAdd} disabled={addSaving}>{addSaving ? 'Adding...' : '✓ Add Staff'}</button>
          </>
        }
      >
        <div className="sp-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="sp-modal-field">
            <label className="sp-modal-label">Full Name *</label>
            <input className="sp-modal-input" placeholder="e.g. Juan Dela Cruz" value={addForm.full_name} onChange={e => setAddForm({ ...addForm, full_name: e.target.value })} autoFocus />
          </div>
          <div className="sp-modal-field">
            <label className="sp-modal-label">Role *</label>
            <select className="sp-modal-input" value={addForm.role} onChange={e => setAddForm({ ...addForm, role: e.target.value })}>
              <option value="">— Select Role —</option>
              <optgroup label="Management / Sales">
                {MANAGEMENT_ROLES.filter(r => r !== 'Owner' || isSuperAdmin).map(r => <option key={r} value={r}>{r}</option>)}
              </optgroup>
              <optgroup label="Service / Labor">{SERVICE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}</optgroup>
            </select>
          </div>
        </div>
        <div className="sp-modal-field" style={{ marginTop: '1rem' }}>
          <label className="sp-modal-label">Contact (Email/Phone)</label>
          <input className="sp-modal-input" placeholder="Optional" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} />
        </div>
        {addError && <div className="sp-modal-error" style={{ color: 'var(--th-rose)', fontSize: '0.8rem', marginTop: '0.5rem' }}>{addError}</div>}
      </Modal>

      {/* Edit Staff Modal */}
      <Modal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Staff Profile"
        footer={
          <>
            <button className="th-btn th-btn-ghost" onClick={() => setEditTarget(null)}>Cancel</button>
            <button className="th-btn th-btn-orange" onClick={handleEdit} disabled={editSaving}>{editSaving ? 'Saving...' : '✓ Save Changes'}</button>
          </>
        }
      >
        <div className="sp-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="sp-modal-field">
            <label className="sp-modal-label">Full Name *</label>
            <input className="sp-modal-input" value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} autoFocus />
          </div>
          <div className="sp-modal-field">
            <label className="sp-modal-label">Role *</label>
            <select className="sp-modal-input" value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
              <optgroup label="Management / Sales">
                {MANAGEMENT_ROLES.filter(r => r !== 'Owner' || isSuperAdmin || editForm.role === 'Owner').map(r => <option key={r} value={r}>{r}</option>)}
              </optgroup>
              <optgroup label="Service / Labor">{SERVICE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}</optgroup>
            </select>
          </div>
        </div>
        <div className="sp-modal-field" style={{ marginTop: '1rem' }}>
          <label className="sp-modal-label">Contact</label>
          <input className="sp-modal-input" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
        </div>
        {editError && <div className="sp-modal-error" style={{ color: 'var(--th-rose)', fontSize: '0.8rem', marginTop: '0.5rem' }}>{editError}</div>}
      </Modal>

      {/* Remove / Status Management Modal */}
      <Modal
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title="Manage Staff Status"
        maxWidth="450px"
      >
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--th-text-heading)' }}>{removeTarget?.full_name}</div>
          <div className="th-text-xs">Current Status: <span className={`sp-status-badge ${WORK_STATUS_CLASS[removeTarget?.work_status]}`}>{WORK_STATUS_LABELS[removeTarget?.work_status]}</span></div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <button className="th-btn th-btn-emerald th-btn-full" onClick={() => updateWorkStatus(removeTarget, 'ACTIVE')}>
            Activate / Set Active
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
            <button className="th-btn th-btn-amber" onClick={() => updateWorkStatus(removeTarget, 'SUSPENDED')}>
              Suspend Staff
            </button>
            <button className="th-btn th-btn-rose" onClick={() => updateWorkStatus(removeTarget, 'TERMINATED')}>
              Terminate Staff
            </button>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--th-border)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            style={{ background: 'none', border: 'none', color: 'var(--th-rose)', fontSize: '0.72rem', cursor: 'pointer', opacity: 0.7, textDecoration: 'underline' }}
            onClick={handleRemove}
          >
            Permanent Remove from Database
          </button>
          <button className="th-btn th-btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => setRemoveTarget(null)}>Cancel</button>
        </div>
      </Modal>

      {/* Bulk Marking Confirmation */}
      <Modal
        isOpen={!!pendingBulkMark}
        onClose={() => setPendingBulkMark(null)}
        title="Bulk Update"
        maxWidth="400px"
        footer={
          <>
            <button className="th-btn th-btn-ghost" onClick={() => setPendingBulkMark(null)}>Cancel</button>
            <button className={`th-btn ${pendingBulkMark?.status === 'ABSENT' ? 'th-btn-rose' : 'th-btn-emerald'}`} onClick={confirmBulkMark}>Confirm</button>
          </>
        }
      >
        <p className="th-text-sm">Mark {pendingBulkMark?.count} staff members as <b>{pendingBulkMark?.status}</b> for {attendanceDate}?</p>
      </Modal>

      <Modal
        isOpen={!!pendingMarkAll}
        onClose={() => setPendingMarkAll(null)}
        title="Mark All Present"
        maxWidth="400px"
        footer={
          <>
            <button className="th-btn th-btn-ghost" onClick={() => setPendingMarkAll(null)}>Cancel</button>
            <button className="th-btn th-btn-emerald" onClick={() => { setPendingBulkMark({ status: 'PRESENT', ids: filteredStaff.map(s => s.staff_id), count: filteredStaff.length }); setPendingMarkAll(null); }}>Confirm</button>
          </>
        }
      >
        <p className="th-text-sm">Mark all {pendingMarkAll?.count} staff as <b>PRESENT</b> for {pendingMarkAll?.date}?</p>
      </Modal>
    </div>
  );
}
