import React, { useState, useEffect } from 'react';
import { API_URL, apiFetch } from '../lib/config';
import Modal from '../components/Modal';

/* ============================================================
   TIREHUB — USER PROFILE PAGE
   Clean, modern profile management with Glassmorphism.
   Supports profile picture, role display, and security.
   ============================================================ */

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passForm, setPassForm] = useState({ current: '', next: '', confirm: '' });
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState(null);
  const [passSuccess, setPassSuccess] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

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
      alert("Image is too large. Please select a file smaller than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result;
      try {
        const res = await apiFetch(`${API_URL}/profile/picture`, {
          method: 'PATCH',
          body: JSON.stringify({ profile_picture: base64String })
        });
        const data = await res.json();
        if (data.ok) {
          setProfile(prev => ({ ...prev, profile_picture: base64String }));
        }
      } catch (err) {
        alert("Failed to update profile picture.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(false);

    if (passForm.next !== passForm.confirm) {
      setPassError("New passwords do not match.");
      return;
    }

    setPassLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/profile/change-password`, {
        method: 'POST',
        body: JSON.stringify({
          current_password: passForm.current,
          new_password: passForm.next
        })
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

  if (loading) return <div className="pm-loading">Loading Profile...</div>;
  if (error) return <div className="pm-error">Error: {error}</div>;

  const isSystemAccount = profile.role === 'admin' || profile.role === 'superadmin';

  return (
    <div className="pm-root" style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto' }}>
      <div className="th-title-format" style={{ marginBottom: '1.5rem' }}>User <span style={{ color: 'var(--th-amber)' }}>Profile</span></div>

      <div className="profile-container" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        
        {/* Header Card */}
        <div className="pm-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1rem' }}>
          <div className="profile-pic-wrap" style={{ position: 'relative', width: '120px', height: '120px' }}>
            {profile.profile_picture ? (
              <img src={profile.profile_picture} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--th-amber)' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--th-bg-input)', display: 'flex', alignItems: 'center', justifyCenter: 'center', fontSize: '2.5rem', color: 'var(--th-text-dim)', border: '3px solid var(--th-border)' }}>
                {profile.full_name?.charAt(0)}
              </div>
            )}
            {!isSystemAccount && (
              <label style={{ position: 'absolute', bottom: '0', right: '0', background: 'var(--th-amber)', color: '#000', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <input type="file" hidden accept="image/*" onChange={handleFileChange} />
              </label>
            )}
          </div>

          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--th-text-body)' }}>{profile.full_name}</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--th-text-dim)', marginTop: '0.2rem' }}>@{profile.username}</div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ padding: '0.25rem 0.75rem', borderRadius: '20px', background: 'var(--th-amber-bg)', color: 'var(--th-amber)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
              {profile.role}
            </span>
            <span style={{ padding: '0.25rem 0.75rem', borderRadius: '20px', background: 'var(--th-sky-bg)', color: 'var(--th-sky)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>
              {profile.authority}
            </span>
          </div>
        </div>

        {/* Info Grid */}
        <div className="pm-card" style={{ padding: '1.5rem' }}>
          <div className="th-section-label" style={{ marginBottom: '1rem' }}>Account Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--th-text-faint)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Full Name</div>
              <div style={{ color: 'var(--th-text-body)' }}>{profile.full_name}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--th-text-faint)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Username</div>
              <div style={{ color: 'var(--th-text-body)' }}>{profile.username}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--th-text-faint)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Primary Role</div>
              <div style={{ color: 'var(--th-text-body)', textTransform: 'capitalize' }}>{profile.role}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--th-text-faint)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Access Level</div>
              <div style={{ color: 'var(--th-text-body)' }}>{profile.authority}</div>
            </div>
          </div>
        </div>

        {/* Actions Card */}
        {!isSystemAccount && (
          <div className="pm-card" style={{ padding: '1.5rem' }}>
            <div className="th-section-label" style={{ marginBottom: '1rem' }}>Security & Settings</div>
            <button 
              className="inv-btn" 
              style={{ width: '100%', justifyContent: 'center', gap: '0.75rem', padding: '0.75rem' }}
              onClick={() => setShowPasswordModal(true)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Change Security PIN / Password
            </button>
          </div>
        )}

      </div>

      <Modal
        isOpen={showPasswordModal}
        onClose={() => !passLoading && setShowPasswordModal(false)}
        title="Change Security PIN"
        maxWidth="400px"
      >
        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {passError && <div style={{ color: 'var(--th-rose)', fontSize: '0.85rem', background: 'var(--th-rose-bg)', padding: '0.5rem', borderRadius: '4px' }}>{passError}</div>}
          {passSuccess && <div style={{ color: 'var(--th-emerald)', fontSize: '0.85rem', background: 'var(--th-emerald-bg)', padding: '0.5rem', borderRadius: '4px' }}>Success! PIN has been updated.</div>}
          
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--th-text-faint)', marginBottom: '0.25rem' }}>Current Password/PIN</label>
            <input 
              className="inv-input" 
              type="password" 
              value={passForm.current}
              onChange={e => setPassForm(f => ({ ...f, current: e.target.value }))}
              required 
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--th-text-faint)', marginBottom: '0.25rem' }}>New Password/PIN</label>
            <input 
              className="inv-input" 
              type="password" 
              value={passForm.next}
              onChange={e => setPassForm(f => ({ ...f, next: e.target.value }))}
              required 
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--th-text-faint)', marginBottom: '0.25rem' }}>Confirm New Password</label>
            <input 
              className="inv-input" 
              type="password" 
              value={passForm.confirm}
              onChange={e => setPassForm(f => ({ ...f, confirm: e.target.value }))}
              required 
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" className="inv-btn-secondary" style={{ flex: 1 }} onClick={() => setShowPasswordModal(false)} disabled={passLoading}>Cancel</button>
            <button type="submit" className="inv-btn-sky" style={{ flex: 1 }} disabled={passLoading}>
              {passLoading ? 'Updating...' : 'Update PIN'}
            </button>
          </div>
        </form>
      </Modal>

      <style>{`
        .profile-pic-wrap:hover label {
          transform: scale(1.1);
        }
        .profile-pic-wrap label {
          transition: transform 0.2s ease;
        }
      `}</style>
    </div>
  );
}
