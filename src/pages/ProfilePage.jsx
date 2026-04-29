import '../pages_css/ProfilePage.css';
import React, { useState, useEffect } from 'react';

import { API_URL, apiFetch } from '../lib/config';
import Modal from '../components/Modal';

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passForm, setPassForm] = useState({ current: '', next: '', confirm: '' });
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState(null);
  const [passSuccess, setPassSuccess] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/profile`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setProfile(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image is too large. Please select a file smaller than 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result;
      try {
        const res = await apiFetch(`${API_URL}/profile/picture`, {
          method: 'PATCH',
          body: JSON.stringify({ profile_picture: base64String }),
        });
        const data = await res.json();
        if (data.ok) setProfile(prev => ({ ...prev, profile_picture: base64String }));
      } catch {
        alert('Failed to update profile picture.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(false);
    if (passForm.next !== passForm.confirm) {
      setPassError('New passwords do not match.');
      return;
    }
    setPassLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/profile/change-password`, {
        method: 'POST',
        body: JSON.stringify({ current_password: passForm.current, new_password: passForm.next }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPassSuccess(true);
      setPassForm({ current: '', next: '', confirm: '' });
      setTimeout(() => setShowPasswordModal(false), 2000);
    } catch (e) {
      setPassError(e.message);
    }
    setPassLoading(false);
  };

  if (loading) return (
    <div className="pm-loading">
      <span className="th-spinner" />
      Loading profile…
    </div>
  );
  if (error) return <div className="pm-error">Error: {error}</div>;

  const isSystemAccount = profile.role === 'admin' || profile.role === 'superadmin';

  return (
    <div className="pm-root">

      {/* Page Header */}
      <div className="pm-page-header">
        <div className="pm-page-title">User <span>Profile</span></div>
        <div className="pm-page-sub">Manage your identity, access, and security settings.</div>
      </div>

      {/* Avatar / Identity Card */}
      <div className="pm-card pm-avatar-card">
        <div className="pm-avatar-wrap">
          {profile.profile_picture ? (
            <img src={profile.profile_picture} alt="Profile" className="pm-avatar-img" />
          ) : (
            <div className="pm-avatar-initials">
              {profile.full_name?.charAt(0)?.toUpperCase()}
            </div>
          )}
          {!isSystemAccount && (
            <label className="pm-avatar-upload-btn" title="Change photo">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <input type="file" hidden accept="image/*" onChange={handleFileChange} />
            </label>
          )}
        </div>

        <div className="pm-identity">
          <div className="pm-name">{profile.full_name}</div>
          <div className="pm-username">@{profile.username}</div>
        </div>

        <div className="pm-badges">
          <span className="pm-badge-role">{profile.role}</span>
          <span className="pm-badge-auth">{profile.authority}</span>
        </div>
      </div>

      {/* Account Details */}
      <div className="pm-card pm-details-card">
        <div className="th-section-label">Account Details</div>
        <div className="pm-details-grid">
          <div className="pm-detail-item">
            <div className="pm-detail-label">Full Name</div>
            <div className="pm-detail-value">{profile.full_name}</div>
          </div>
          <div className="pm-detail-item">
            <div className="pm-detail-label">Username</div>
            <div className="pm-detail-value">@{profile.username}</div>
          </div>
          <div className="pm-detail-item">
            <div className="pm-detail-label">Primary Role</div>
            <div className="pm-detail-value" style={{ textTransform: 'capitalize' }}>{profile.role}</div>
          </div>
          <div className="pm-detail-item">
            <div className="pm-detail-label">Access Level</div>
            <div className="pm-detail-value">{profile.authority}</div>
          </div>
        </div>
      </div>

      {/* Security */}
      {!isSystemAccount && (
        <div className="pm-card pm-security-card">
          <div className="th-section-label">Security &amp; Settings</div>
          <button className="pm-security-btn" onClick={() => setShowPasswordModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Change Security PIN / Password
          </button>
        </div>
      )}

      {/* Change Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => !passLoading && setShowPasswordModal(false)}
        title="Change Security PIN"
        maxWidth="400px"
      >
        <form onSubmit={handleChangePassword} className="pm-modal-form">
          {passError && <div className="pm-modal-alert error">{passError}</div>}
          {passSuccess && <div className="pm-modal-alert success">✓ PIN has been updated successfully.</div>}

          <div className="pm-modal-field">
            <label className="pm-modal-label">Current Password / PIN</label>
            <input
              className="pm-modal-input"
              type="password"
              value={passForm.current}
              onChange={e => setPassForm(f => ({ ...f, current: e.target.value }))}
              required
              autoComplete="current-password"
            />
          </div>
          <div className="pm-modal-field">
            <label className="pm-modal-label">New Password / PIN</label>
            <input
              className="pm-modal-input"
              type="password"
              value={passForm.next}
              onChange={e => setPassForm(f => ({ ...f, next: e.target.value }))}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="pm-modal-field">
            <label className="pm-modal-label">Confirm New Password</label>
            <input
              className="pm-modal-input"
              type="password"
              value={passForm.confirm}
              onChange={e => setPassForm(f => ({ ...f, confirm: e.target.value }))}
              required
              autoComplete="new-password"
            />
          </div>

          <div className="pm-modal-footer">
            <button
              type="button"
              className="th-btn th-btn-ghost"
              style={{ flex: 1 }}
              onClick={() => setShowPasswordModal(false)}
              disabled={passLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="th-btn th-btn-amber"
              style={{ flex: 2, background: 'var(--th-amber)', color: '#000' }}
              disabled={passLoading}
            >
              {passLoading ? <><span className="th-spinner th-spinner-sm" />Updating…</> : 'Update PIN'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
