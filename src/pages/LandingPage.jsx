import React from 'react';
import '../pages_css/LandingPage.css';

function LandingPage({ onEnter }) {
  return (
    <div className="land-wrap">
      <div className="land-content">
        <div className="land-logo">
          <div className="land-logo-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="4"/>
              <line x1="12" y1="2" x2="12" y2="8"/>
              <line x1="12" y1="16" x2="12" y2="22"/>
              <line x1="2" y1="12" x2="8" y2="12"/>
              <line x1="16" y1="12" x2="22" y2="12"/>
            </svg>
          </div>
          <span className="land-logo-text">Core<em>Track</em></span>
        </div>
        
        <h1 className="land-title">The Complete Engine<br/>for Your Tire Shop.</h1>
        <p className="land-sub">
          Take control of inventory, POS, staff payroll, and daily cash ledgers in one secure, local-first platform.
        </p>

        <button className="land-btn" onClick={onEnter}>
          Enter Workspace
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>

        <div className="land-features">
          <div className="land-feat">
            <div className="land-feat-icon">📦</div>
            <span>Smart Inventory</span>
          </div>
          <div className="land-feat">
            <div className="land-feat-icon">💰</div>
            <span>Advanced POS</span>
          </div>
          <div className="land-feat">
            <div className="land-feat-icon">📊</div>
            <span>Live Analytics</span>
          </div>
        </div>
      </div>

      <div className="land-bg">
        <div className="land-mesh" />
        <div className="land-orb land-orb1" />
        <div className="land-orb land-orb2" />
      </div>
    </div>
  );
}

export default LandingPage;
