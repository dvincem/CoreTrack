import '../pages_css/StaffManagementPage.css';
import React, { useState, useEffect, useMemo } from 'react'

import { API_URL, apiFetch, SkeletonRows } from '../lib/config'
import KpiCard from '../components/KpiCard'
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

const BLANK_FORM = { full_name: '', email: '', role: '' }

/* ════════════ UNIFIED STAFF DETAIL & CALENDAR MODAL ════════════ */
function StaffDetailModal({ staff, shopId, onClose, onEdit, onRemove, onStatusToggle, businessDate }) {
  const today = businessDate ? new Date(businessDate) : new Date();
  const todayStr = businessDate || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
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
        <div className="sm-modal-title-group">
          <span>{staff.full_name}</span>
          <span className="sm-modal-subtitle">
            {staff.staff_code} · {staff.role || 'Staff Member'}
          </span>
        </div>
      }
      maxWidth="600px"
      headerActions={
        <button className="sm-btn-edit th-text-xs" onClick={onEdit}>Edit Profile</button>
      }
    >
      <div className="staff-detail-content">
        {/* Staff Info Grid */}
        <div className="inv-hist-item-card sm-info-grid">
          <div className="sm-info-stat">
            <div className="inv-hist-stat-label">Contact</div>
            <div className="sm-info-val-sky">{staff.email || 'None'}</div>
          </div>
          <div className="sm-info-stat">
            <div className="inv-hist-stat-label">Work Status</div>
            <div className="inv-hist-stat-val">
              <button className={`sm-status-badge ${WORK_STATUS_CLASS[staff.work_status] || 'active'}`} onClick={onStatusToggle}>
                {WS_ICONS[staff.work_status] || '✓'} {WORK_STATUS_LABELS[staff.work_status] || 'Active'}
              </button>
            </div>
          </div>
        </div>

        {/* Attendance History Section */}
        <div className="sm-section-divider">
          <div className="th-section-label">Attendance History</div>

          <div className="att-cal-nav">
            <button className="att-cal-nav-btn" onClick={() => setViewDate(new Date(year, month - 1, 1))}>‹</button>
            <span className="att-cal-month-label">{viewDate.toLocaleString('default', { month: 'long' })} {year}</span>
            <button className="att-cal-nav-btn" onClick={() => setViewDate(new Date(year, month + 1, 1))} disabled={year === today.getFullYear() && month >= today.getMonth()}>›</button>
          </div>

          <div className="att-cal-legend">
            <span className="att-cal-leg-dot present" /> <span className="th-text-xs">Present ({presentDays})</span>
            <span className="att-cal-leg-dot absent" /> <span className="th-text-xs">Absent ({absentDays})</span>
          </div>

          {calLoading ? <div className="th-table-empty">Loading Calendar...</div> : (
            <div className="att-cal-grid sm-table-card-alt">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="att-cal-day-label">{d}</div>)}
              {cells.map((dayNum, i) => {
                if (!dayNum) return <div key={i} className="att-cal-cell empty" />;
                const dateStr = `${monthStr}-${String(dayNum).padStart(2, '0')}`;
                const status = statusMap[dateStr];
                const isToday = dateStr === todayStr;
                return (
                  <div key={i} className={`att-cal-cell ${status === 'PRESENT' ? 'present' : status === 'ABSENT' ? 'absent' : ''} ${isToday ? 'today' : ''}`}>
                    {dayNum}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="sm-footer-action-row">
          <button className="sm-btn-link-rose" onClick={onRemove}>
            Manage Status / Remove Member
          </button>
        </div>
      </div>
      <style>{`
        .sm-table-card-alt { padding: 0.5rem; background: var(--th-bg-card-alt); border-radius: 10px; }
      `}</style>
    </Modal>
  );
}

/* ════════════ MAIN COMPONENT ════════════ */
export default function StaffManagementPage({ shopId, setPageContext, userRole, userPower, businessDate }) {
  const TODAY = businessDate || new Date().toISOString().split('T')[0];
  const getTodayStr = () => TODAY;

  const [attendanceDate, setAttendanceDate] = useState(TODAY);
  const [attendance, setAttendance] = useState([]);
  const [statsRange] = useState("month");
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
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

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
    <div className="sm-root animate-slide-in-right">
      {/* Header */}
      <div className="sm-header-row">
        <div className="th-title-format">Staff <span className="th-text-orange">Management</span></div>
        <div className="sm-header-actions">
          {/* PC Add Button */}
          <button className="sm-btn-add sm-add-desktop" onClick={() => { setShowAdd(true); setAddForm(BLANK_FORM); }}>+ Add Staff</button>

          {selectedIds.size > 0 ? (
            <>
              <span className="th-text-xs th-text-dim">{selectedIds.size} Selected</span>
              <button className="sm-btn-add sm-add-desktop th-bg-emerald" onClick={() => setPendingBulkMark({ status: 'PRESENT', ids: [...selectedIds], count: selectedIds.size })}>✓ Present</button>
              <button className="sm-btn-add sm-add-desktop th-bg-rose" onClick={() => setPendingBulkMark({ status: 'ABSENT', ids: [...selectedIds], count: selectedIds.size })}>✕ Absent</button>
              <button className="th-btn th-btn-ghost th-btn-xs-padding" onClick={() => setSelectedIds(new Set())}>Clear</button>
            </>
          ) : (
            <button className="sm-btn-add sm-add-desktop th-bg-emerald" onClick={() => setPendingMarkAll({ date: attendanceDate, count: filteredStaff.length })}>Mark All Present</button>
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
            max={getTodayStr()}
            onChange={e => setAttendanceDate(e.target.value)}
          />
        }
        accentColor="var(--th-orange)"
      />

      {/* Mobile-only Action Row */}
      <div className="sm-mobile-actions-row">
        <button className="sm-btn-add th-btn-full" onClick={() => { setShowAdd(true); setAddForm(BLANK_FORM); }}>+ Add Staff</button>
        {selectedIds.size > 0 ? (
          <button className="sm-btn-add th-btn-full th-bg-emerald" onClick={() => setPendingBulkMark({ status: 'PRESENT', ids: [...selectedIds], count: selectedIds.size })}>✓ Present</button>
        ) : (
          <button className="sm-btn-add th-btn-full th-bg-emerald" onClick={() => setPendingMarkAll({ date: attendanceDate, count: filteredStaff.length })}>Mark Present</button>
        )}
      </div>

      {/* Unified Table */}
      <div className="th-section-label">Staff Roster & Attendance</div>
      <div className="sm-table-card">
        <div className="sm-table-scroll">
          <table className="sm-table">
            <thead>
              <tr>
                <th className="th-w-40">
                  <input type="checkbox" checked={filteredStaff.length > 0 && filteredStaff.every(s => selectedIds.has(s.staff_id))}
                    onChange={e => setSelectedIds(e.target.checked ? new Set(filteredStaff.map(s => s.staff_id)) : new Set())} />
                </th>
                <th className="th-no-wrap">Staff Member</th>
                <th className="th-no-wrap">Today's Status</th>
                <th className="th-no-wrap">Consistency</th>
                <th className="th-no-wrap">Work Status</th>
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
                    <tr key={s.staff_id} onClick={() => setDetailTarget(s)} className="th-pointer">
                      <td onClick={e => e.stopPropagation()} className="th-no-wrap">
                        <input type="checkbox" checked={selectedIds.has(s.staff_id)}
                          onChange={e => {
                            const next = new Set(selectedIds);
                            e.target.checked ? next.add(s.staff_id) : next.delete(s.staff_id);
                            setSelectedIds(next);
                          }} />
                      </td>
                      <td className="th-no-wrap">
                        <div className="sm-name">{s.full_name}</div>
                        <div className="sm-code">
                          {s.staff_code} · {s.role || 'Staff Member'}
                        </div>
                      </td>
                      <td onClick={e => e.stopPropagation()} className="th-no-wrap">
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
                      <td className="th-no-wrap">
                        {st ? (
                          <div className="sm-consistency-bar-wrap">
                            <div className="sm-consistency-label">
                              <span>{pct}%</span>
                            </div>
                            <div className="sm-consistency-track">
                              <div className="sm-consistency-fill" style={{ width: `${pct}%`, background: pct >= 85 ? 'var(--th-emerald)' : pct >= 65 ? 'var(--th-amber)' : 'var(--th-rose)' }} />
                            </div>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="th-no-wrap">
                        <div className="sm-ws-container">
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
        <div className="sm-pagination-wrap">
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
          businessDate={businessDate}
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
        <div className="sm-modal-grid">
          <div className="sm-modal-field">
            <label className="sm-modal-label">Full Name *</label>
            <input className="sm-modal-input" placeholder="e.g. Juan Dela Cruz" value={addForm.full_name} onChange={e => setAddForm({ ...addForm, full_name: e.target.value })} autoFocus />
          </div>
          <div className="sm-modal-field">
            <label className="sm-modal-label">Role *</label>
            <select className="sm-modal-input" value={addForm.role} onChange={e => setAddForm({ ...addForm, role: e.target.value })}>
              <option value="">— Select Role —</option>
              <optgroup label="Management / Sales">
                {MANAGEMENT_ROLES.filter(r => r !== 'Owner' || isSuperAdmin).map(r => <option key={r} value={r}>{r}</option>)}
              </optgroup>
              <optgroup label="Service / Labor">{SERVICE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}</optgroup>
            </select>
          </div>
        </div>
        <div className="sm-modal-field th-mt-1rem">
          <label className="sm-modal-label">Contact (Email/Phone)</label>
          <input className="sm-modal-input" placeholder="Optional" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} />
        </div>
        {addError && <div className="sm-modal-error th-text-rose th-text-xs th-mt-05rem">{addError}</div>}
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
        <div className="sm-modal-grid">
          <div className="sm-modal-field">
            <label className="sm-modal-label">Full Name *</label>
            <input className="sm-modal-input" value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} autoFocus />
          </div>
          <div className="sm-modal-field">
            <label className="sm-modal-label">Role *</label>
            <select className="sm-modal-input" value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
              <optgroup label="Management / Sales">
                {MANAGEMENT_ROLES.filter(r => r !== 'Owner' || isSuperAdmin || editForm.role === 'Owner').map(r => <option key={r} value={r}>{r}</option>)}
              </optgroup>
              <optgroup label="Service / Labor">{SERVICE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}</optgroup>
            </select>
          </div>
        </div>
        <div className="sm-modal-field th-mt-1rem">
          <label className="sm-modal-label">Contact</label>
          <input className="sm-modal-input" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
        </div>
        {editError && <div className="sm-modal-error th-text-rose th-text-xs th-mt-05rem">{editError}</div>}
      </Modal>

      {/* Remove / Status Management Modal */}
      <Modal
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title="Manage Staff Status"
        maxWidth="450px"
      >
        <div className="th-mb-125rem">
          <div className="th-text-bold th-text-lg th-text-heading">{removeTarget?.full_name}</div>
          <div className="th-text-xs">Current Status: <span className={`sm-status-badge ${WORK_STATUS_CLASS[removeTarget?.work_status]}`}>{WORK_STATUS_LABELS[removeTarget?.work_status]}</span></div>
        </div>

        <div className="th-flex-col th-gap-065rem">
          <button className="th-btn th-btn-emerald th-btn-full" onClick={() => updateWorkStatus(removeTarget, 'ACTIVE')}>
            Activate / Set Active
          </button>
          <div className="th-grid-2col th-gap-065rem">
            <button className="th-btn th-btn-amber" onClick={() => updateWorkStatus(removeTarget, 'SUSPENDED')}>
              Suspend Staff
            </button>
            <button className="th-btn th-btn-rose" onClick={() => updateWorkStatus(removeTarget, 'TERMINATED')}>
              Terminate Staff
            </button>
          </div>
        </div>

        <div className="sm-footer-action-row th-flex th-justify-between th-items-center">
          <button className="sm-btn-link-rose th-text-xxs" onClick={handleRemove}>
            Permanent Remove from Database
          </button>
          <button className="th-btn th-btn-ghost th-text-xs" onClick={() => setRemoveTarget(null)}>Cancel</button>
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

      <style>{`
        .th-w-40 { width: 40px; }
        .th-no-wrap { white-space: nowrap; }
        .th-pointer { cursor: pointer; }
        .th-text-bold { fontWeight: 600; }
        .th-text-orange { color: var(--th-orange); }
        .th-text-dim { color: var(--th-text-dim); }
        .th-bg-emerald { background: var(--th-emerald); }
        .th-bg-rose { background: var(--th-rose); }
        .th-btn-xs-padding { padding: 0.5rem 1rem; }
        .th-btn-full { flex: 1; padding: 0.65rem; fontSize: 0.9rem; }
        .th-mt-1rem { margin-top: 1rem; }
        .th-mt-05rem { margin-top: 0.5rem; }
        .th-mb-125rem { margin-bottom: 1.25rem; }
        .th-text-lg { fontSize: 1.1rem; }
        .th-flex-col { display: flex; flex-direction: column; }
        .th-gap-065rem { gap: 0.65rem; }
        .th-grid-2col { display: grid; grid-template-columns: 1fr 1fr; }
        .th-text-xxs { fontSize: 0.72rem; }
        .th-text-xs { fontSize: 0.8rem; }
      `}</style>
    </div>
  );
}
