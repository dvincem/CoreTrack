import '../pages_css/SetupPage.css';
import React from 'react';
import { API_URL } from '../lib/config';

/* ============================================================
   CORETRACK — FIRST-RUN SETUP WIZARD
   3-step initialization: Shop Identity → Branding → Owner Account
   ============================================================ */

const TOTAL_STEPS = 3;

// ── Step indicators ───────────────────────────────────────────────────────────
function StepIndicator({ current, total }) {
  const labels = ['Shop Identity', 'Branding', 'Owner Account'];
  return (
    <div className="sw-steps">
      {Array.from({ length: total }, (_, i) => {
        const idx = i + 1;
        const done = current > idx;
        const active = current === idx;
        return (
          <React.Fragment key={idx}>
            <div className={`sw-step ${active ? 'active' : ''} ${done ? 'done' : ''}`}>
              <div className="sw-step-circle">
                {done
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                  : <span>{idx}</span>
                }
              </div>
              <span className="sw-step-label">{labels[i]}</span>
            </div>
            {idx < total && <div className={`sw-step-line ${done ? 'done' : ''}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Step 1: Shop Identity ─────────────────────────────────────────────────────
function StepShopIdentity({ data, onChange, onNext }) {
  const [err, setErr] = React.useState('');

  function validate(e) {
    e.preventDefault();
    if (!data.shop_name?.trim()) { setErr('Shop name is required.'); return; }
    setErr('');
    onNext();
  }

  return (
    <form className="sw-form" onSubmit={validate}>
      <div className="sw-step-hero">
        <div className="sw-step-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <div>
          <div className="sw-step-title">Your Shop Details</div>
          <div className="sw-step-sub">Let's start with some basic information about your shop.</div>
        </div>
      </div>

      {err && <div className="sw-error">{err}</div>}

      <div className="sw-field">
        <label className="sw-label">Shop Name <span className="sw-required">*</span></label>
        <input
          className="sw-input"
          type="text"
          placeholder="e.g. Jonde Tire Trading"
          value={data.shop_name || ''}
          onChange={e => onChange('shop_name', e.target.value)}
          autoFocus
        />
        <div className="sw-hint">This will appear on all reports, receipts, and dashboards.</div>
      </div>

      <div className="sw-field">
        <label className="sw-label">Address</label>
        <input
          className="sw-input"
          type="text"
          placeholder="e.g. 123 Main St, Cebu City"
          value={data.address || ''}
          onChange={e => onChange('address', e.target.value)}
        />
      </div>

      <div className="sw-field">
        <label className="sw-label">Contact Number</label>
        <input
          className="sw-input"
          type="text"
          placeholder="e.g. +63 917 123 4567"
          value={data.contact_number || ''}
          onChange={e => onChange('contact_number', e.target.value)}
        />
      </div>

      <button className="sw-btn-primary" type="submit">
        Continue
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
      </button>
    </form>
  );
}

// ── Step 2: Branding ──────────────────────────────────────────────────────────
function StepBranding({ data, onChange, onNext, onBack }) {
  const [dragging, setDragging] = React.useState(false);
  const fileRef = React.useRef();

  function handleFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) { alert('File must be under 5MB.'); return; }
    const reader = new FileReader();
    reader.onloadend = () => onChange('logo_data_url', reader.result);
    reader.readAsDataURL(file);
    onChange('logo_file', file);
  }

  function onDrop(e) {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  function removeLogo() {
    onChange('logo_data_url', null);
    onChange('logo_file', null);
  }

  return (
    <div className="sw-form">
      <div className="sw-step-hero">
        <div className="sw-step-icon sw-step-icon--violet">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" />
            <line x1="12" y1="2" x2="12" y2="8" /><line x1="12" y1="16" x2="12" y2="22" />
            <line x1="2" y1="12" x2="8" y2="12" /><line x1="16" y1="12" x2="22" y2="12" />
          </svg>
        </div>
        <div>
          <div className="sw-step-title">Brand Your Shop</div>
          <div className="sw-step-sub">Upload your shop logo. It appears on reports and the dashboard.</div>
        </div>
      </div>

      <div className="sw-branding-grid">
        {/* Drop Zone */}
        <div
          className={`sw-drop-zone ${dragging ? 'drag' : ''} ${data.logo_data_url ? 'has-logo' : ''}`}
          onClick={() => fileRef.current.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])}
          />
          {data.logo_data_url ? (
            <div className="sw-logo-preview">
              <img src={data.logo_data_url} alt="Shop logo preview" />
              <button
                className="sw-logo-remove"
                type="button"
                onClick={e => { e.stopPropagation(); removeLogo(); }}
                title="Remove logo"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          ) : (
            <div className="sw-drop-inner">
              <div className="sw-drop-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
              <div className="sw-drop-text">Drop your logo here</div>
              <div className="sw-drop-hint">or click to browse · PNG, JPG, SVG up to 5MB</div>
            </div>
          )}
        </div>

        {/* Live preview card */}
        <div className="sw-preview-card">
          <div className="sw-preview-label">Live Preview</div>
          <div className="sw-preview-mock">
            <div className="sw-preview-sidebar">
              <div className="sw-preview-logo-area">
                {data.logo_data_url
                  ? <img className="sw-preview-logo-img" src={data.logo_data_url} alt="Preview" />
                  : <div className="sw-preview-logo-placeholder">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /></svg>
                  </div>
                }
                <div className="sw-preview-shop-name">{data.shop_name || 'Shop Name'}</div>
              </div>
              <div className="sw-preview-nav">
                {['Dashboard', 'POS', 'Inventory', 'Sales'].map(n => (
                  <div key={n} className="sw-preview-nav-item">{n}</div>
                ))}
              </div>
            </div>
            <div className="sw-preview-content">
              <div className="sw-preview-bar" style={{ width: '60%' }} />
              <div className="sw-preview-bar" style={{ width: '40%' }} />
              <div className="sw-preview-bar" style={{ width: '80%' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="sw-optional-badge">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
        Logo upload is optional — you can add it later in the Control Panel.
      </div>

      <div className="sw-btn-row">
        <button className="sw-btn-secondary" type="button" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
          Back
        </button>
        <button className="sw-btn-primary" type="button" onClick={onNext}>
          Continue
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Owner Account ─────────────────────────────────────────────────────
function StepOwnerAccount({ data, onChange, onBack, onSubmit, loading }) {
  const [err, setErr] = React.useState('');
  const [showPin, setShowPin] = React.useState(false);

  function validate(e) {
    e.preventDefault();
    if (!data.full_name?.trim()) { setErr('Full name is required.'); return; }
    if (!data.username?.trim()) { setErr('Username is required.'); return; }
    if (!/^[a-z0-9._]{3,30}$/.test(data.username)) {
      setErr('Username: 3–30 chars, lowercase letters, numbers, dots or underscores.'); return;
    }
    if (!data.pin || !/^\d{4,8}$/.test(data.pin)) {
      setErr('PIN must be 4–8 digits (numbers only).'); return;
    }
    if (data.pin !== data.confirm_pin) { setErr('PINs do not match.'); return; }
    setErr('');
    onSubmit();
  }

  const pinStrength = !data.pin ? '' : data.pin.length >= 8 ? 'strong' : data.pin.length >= 6 ? 'medium' : 'weak';

  return (
    <form className="sw-form" onSubmit={validate}>
      <div className="sw-step-hero">
        <div className="sw-step-icon sw-step-icon--emerald">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div>
          <div className="sw-step-title">Create Owner Account</div>
          <div className="sw-step-sub">This will be your primary administrator login for CoreTrack.</div>
        </div>
      </div>

      {err && <div className="sw-error">{err}</div>}

      <div className="sw-field">
        <label className="sw-label">Full Name <span className="sw-required">*</span></label>
        <input
          className="sw-input"
          type="text"
          placeholder="e.g. Juan dela Cruz"
          value={data.full_name || ''}
          onChange={e => onChange('full_name', e.target.value)}
          autoFocus
        />
      </div>

      <div className="sw-field">
        <label className="sw-label">Username <span className="sw-required">*</span></label>
        <input
          className="sw-input"
          type="text"
          placeholder="e.g. juan.delacruz"
          value={data.username || ''}
          onChange={e => onChange('username', e.target.value.toLowerCase())}
          autoComplete="off"
        />
        <div className="sw-hint">3–30 chars · lowercase letters, numbers, dots, underscores</div>
      </div>

      <div className="sw-field-row">
        <div className="sw-field">
          <label className="sw-label">PIN <span className="sw-required">*</span></label>
          <div className="sw-input-wrap">
            <input
              className="sw-input"
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              placeholder="4–8 digits"
              value={data.pin || ''}
              onChange={e => onChange('pin', e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="sw-eye-btn"
              onClick={() => setShowPin(v => !v)}
              tabIndex={-1}
            >
              {showPin
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
              }
            </button>
          </div>
          {pinStrength && (
            <div className={`sw-pin-strength sw-pin-strength--${pinStrength}`}>
              <div className="sw-pin-strength-bar" />
              <span>{pinStrength === 'strong' ? 'Strong PIN' : pinStrength === 'medium' ? 'Good PIN' : 'Weak — use 6+ digits'}</span>
            </div>
          )}
        </div>

        <div className="sw-field">
          <label className="sw-label">Confirm PIN <span className="sw-required">*</span></label>
          <input
            className={`sw-input ${data.pin && data.confirm_pin && data.pin !== data.confirm_pin ? 'sw-input--error' : ''}`}
            type={showPin ? 'text' : 'password'}
            inputMode="numeric"
            placeholder="Re-enter PIN"
            value={data.confirm_pin || ''}
            onChange={e => onChange('confirm_pin', e.target.value)}
            autoComplete="new-password"
          />
          {data.pin && data.confirm_pin && data.pin === data.confirm_pin && (
            <div className="sw-match-ok">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              PINs match
            </div>
          )}
        </div>
      </div>

      <div className="sw-owner-info-box">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
        <span>This account will have <strong>full Owner access</strong> to all CoreTrack modules. You can add more staff later.</span>
      </div>

      <div className="sw-btn-row">
        <button className="sw-btn-secondary" type="button" onClick={onBack} disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
          Back
        </button>
        <button className="sw-btn-primary sw-btn-launch" type="submit" disabled={loading}>
          {loading
            ? <><div className="sw-spinner" />Initializing…</>
            : <>Launch CoreTrack <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M22 2L11 13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg></>
          }
        </button>
      </div>
    </form>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────
function SuccessScreen({ shopName, onGoToLogin }) {
  return (
    <div className="sw-success">
      <div className="sw-success-ring">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div className="sw-success-title">CoreTrack is Ready!</div>
      <div className="sw-success-sub">
        <strong>{shopName}</strong> has been successfully initialized.
        Your owner account is set up and ready to use.
      </div>
      <div className="sw-success-features">
        {[
          ['Inventory Management', 'Track stock, DOT numbers, and reorder points'],
          ['Point of Sale', 'Hybrid cart for products and services'],
          ['Staff & Payroll', 'Roles, attendance, and commission tracking'],
          ['Financial Health', 'Revenue, expenses, receivables, and payables'],
        ].map(([title, desc]) => (
          <div key={title} className="sw-success-feature">
            <div className="sw-success-check">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div>
              <div className="sw-success-feature-title">{title}</div>
              <div className="sw-success-feature-desc">{desc}</div>
            </div>
          </div>
        ))}
      </div>
      <button className="sw-btn-primary sw-btn-launch" onClick={onGoToLogin}>
        Sign In Now
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
      </button>
    </div>
  );
}

// ── Main SetupPage component ──────────────────────────────────────────────────
export default function SetupPage({ onSetupComplete }) {
  const [step, setStep] = React.useState(1);
  const [done, setDone] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [globalErr, setGlobalErr] = React.useState('');
  const [formData, setFormData] = React.useState({
    // Step 1
    shop_name: '',
    address: '',
    contact_number: '',
    // Step 2
    logo_file: null,
    logo_data_url: null,
    // Step 3
    full_name: '',
    username: '',
    pin: '',
    confirm_pin: '',
  });

  function onChange(key, value) {
    setFormData(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setLoading(true);
    setGlobalErr('');
    try {
      const res = await fetch(`${API_URL}/system/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_name: formData.shop_name,
          address: formData.address,
          contact_number: formData.contact_number,
          full_name: formData.full_name,
          username: formData.username,
          pin: formData.pin,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGlobalErr(data.error || 'Setup failed. Please try again.');
        setLoading(false);
        return;
      }

      // If logo was provided, upload it using the brands API
      if (formData.logo_file && data.success) {
        try {
          const form = new FormData();
          form.append('brand', formData.shop_name);
          form.append('logo', formData.logo_file);
          // We don't have auth yet; skip if it fails silently
          await fetch(`${API_URL}/brands/upload-logo`, { method: 'POST', body: form });
        } catch (_) { /* non-critical */ }
      }

      setDone(true);
    } catch (err) {
      setGlobalErr('Cannot connect to server. Please ensure the server is running.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="sw-root">
        <div className="sw-bg" />
        <div className="sw-card sw-card--wide">
          <SuccessScreen shopName={formData.shop_name} onGoToLogin={onSetupComplete} />
        </div>
      </div>
    );
  }

  return (
    <div className="sw-root">
      <div className="sw-bg" />
      <div className="sw-card">
        {/* Header */}
        <div className="sw-header">
          <div className="sw-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" />
              <line x1="12" y1="2" x2="12" y2="8" /><line x1="12" y1="16" x2="12" y2="22" />
              <line x1="2" y1="12" x2="8" y2="12" /><line x1="16" y1="12" x2="22" y2="12" />
            </svg>
            <span>Core<em>Track</em></span>
          </div>
          <div className="sw-header-badge">Setup Wizard</div>
        </div>

        <div className="sw-headline">
          Welcome to <span>CoreTrack</span>
        </div>
        <div className="sw-subline">
          Complete the {TOTAL_STEPS} quick steps below to get your shop management system running.
        </div>

        <StepIndicator current={step} total={TOTAL_STEPS} />

        {globalErr && step === 3 && <div className="sw-error sw-error--global">{globalErr}</div>}

        <div className="sw-body">
          {step === 1 && (
            <StepShopIdentity data={formData} onChange={onChange} onNext={() => setStep(2)} />
          )}
          {step === 2 && (
            <StepBranding data={formData} onChange={onChange} onNext={() => setStep(3)} onBack={() => setStep(1)} />
          )}
          {step === 3 && (
            <StepOwnerAccount
              data={formData}
              onChange={onChange}
              onBack={() => setStep(2)}
              onSubmit={handleSubmit}
              loading={loading}
            />
          )}
        </div>

        <div className="sw-footer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
          All data is stored locally on your server. Nothing is sent to the cloud.
        </div>
      </div>
    </div>
  );
}
