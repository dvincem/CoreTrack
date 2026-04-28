import React from 'react'
import { API_URL } from './lib/config'
import { ThemeToggle } from './components/ThemeProvider'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import POSPage from './pages/POSPage'
import InventoryPage from './pages/InventoryPage'
import OrdersPage from './pages/OrdersPage'
import RecapPage from './pages/RecapPage'
import SalesPage from './pages/SalesPage'
import CustomerPage from './pages/CustomerPage'
import SuppliersPage from './pages/SuppliersPage'
import StaffManagementPage from './pages/StaffManagementPage'
import PayrollPage from './pages/PayrollPage'
import ReceivablesPage from './pages/ReceivablesPage'
import PayablesPage from './pages/PayablesPage'
import Reportspage from './pages/Reportspage'
import Productspage from './pages/Productspage'
import Servicespage from './pages/Servicespage'
import ProfitsPage from './pages/ProfitsPage'
import ExpensesPage from './pages/ExpensesPage'
import PurchasesPage from './pages/PurchasesPage'
import CashLedgerPage from './pages/CashLedgerPage'
import ReturnsPage from './pages/ReturnsPage'
import ControlPanelPage from './pages/ControlPanelPage'
import FirstLoginPage from './pages/FirstLoginPage'
import ServicesSummaryPage from './pages/ServicesSummaryPage'
import SalesProjectionPage from './pages/SalesProjectionPage'
import DryRunTrackerPage from './pages/DryRunTrackerPage'
import ProfilePage from './pages/ProfilePage'
import TireHubBot from './components/TireHubBot'
import Modal from './components/Modal'

/* ============================================================
   TIREHUB — APP SHELL
   Theme toggle lives in the sidebar. ThemeProvider wraps
   the entire app so dark/light mode applies everywhere.
   ============================================================ */

const APP_SHELL_STYLE = `
  /* ── Sidebar ── */
  .th-sidebar {
    width: 220px;
    flex-shrink: 0;
    background: var(--th-bg-card);
    border-right: 1px solid var(--th-border);
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    transition: width 0.22s ease;
    /* Subtle inner glow on the right edge */
    box-shadow: inset -1px 0 0 var(--th-border), 1px 0 12px rgba(0,0,0,0.12);
  }
  .th-sidebar.collapsed { width: 52px; }

  /* Mobile overlay backdrop */
  .th-sidebar-backdrop {
    display: none;
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.55);
    z-index: 199;
    backdrop-filter: blur(2px);
  }
  .th-sidebar-backdrop.visible { display: block; }

  /* Hamburger button (mobile only) */
  .th-hamburger {
    display: none;
    position: fixed;
    top: 0.75rem; left: 0.75rem;
    z-index: 201;
    background: var(--th-bg-card);
    border: 1px solid var(--th-border-strong);
    border-radius: 8px;
    width: 38px; height: 38px;
    align-items: center; justify-content: center;
    cursor: pointer;
    color: var(--th-text-primary);
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    transition: transform 0.25s ease, background 0.15s ease;
  }
  .th-hamburger.open {
    transform: translateX(240px);
  }

  @media (max-width: 768px) {
    .th-hamburger { display: flex; }
    .th-collapse-btn { display: none !important; }
    .th-app-root { flex-direction: column; }
    .th-sidebar {
      position: fixed;
      left: 0; top: 0; bottom: 0;
      z-index: 200;
      transform: translateX(-100%);
      transition: transform 0.25s ease, width 0.22s ease;
      width: 240px !important;
      height: 100vh;
      flex-shrink: 0;
    }
    .th-sidebar.mobile-open {
      transform: translateX(0);
    }
    .th-sidebar.collapsed {
      width: 240px !important;
    }
    /* Reset collapsed state visuals on mobile */
    .th-sidebar.mobile-open.collapsed .th-sidebar-logo { opacity: 1; max-height: 2rem; margin-bottom: 0.85rem; }
    .th-sidebar.mobile-open.collapsed .th-shop-select { opacity: 1; max-height: 2rem; padding: 0.45rem 0.65rem; border: 1px solid var(--th-border-strong); pointer-events: auto; }
    .th-sidebar.mobile-open.collapsed .th-nav-section { opacity: 1; max-height: 2rem; padding: 0.75rem 0.5rem 0.3rem; overflow: visible; }
    .th-sidebar.mobile-open.collapsed .th-nav-btn { justify-content: flex-start; padding: 0.5rem 0.65rem; gap: 0.6rem; }
    .th-sidebar.mobile-open.collapsed .th-nav-btn-label { opacity: 1; width: auto; overflow: visible; }

    .th-sidebar.mobile-open.collapsed .th-sidebar-bottom { padding: 0.75rem 1rem; }
    .th-main { padding: 1rem 0.75rem; padding-top: 3.5rem; }
  }


  .th-sidebar-top {
    padding: 0.7rem 0.85rem 0.75rem;
    border-bottom: 1px solid var(--th-border);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    /* Warm orange micro-gradient at top */
    background: linear-gradient(180deg, rgba(249,115,22,0.045) 0%, transparent 100%);
  }
  .th-sidebar.collapsed .th-sidebar-top { padding: 0.5rem 0 0.5rem; align-items: center; gap: 0; }

  /* Row 1: logo + collapse btn */
  .th-sidebar-top-row {
    display: flex; align-items: center; justify-content: space-between;
  }
  .th-sidebar.collapsed .th-sidebar-top-row { justify-content: center; flex-direction: column; align-items: center; gap: 0.35rem; }

  /* Collapse toggle button */
  .th-collapse-btn {
    display: flex; align-items: center; justify-content: center;
    width: 36px; height: 36px; border-radius: 8px; border: none;
    background: none; cursor: pointer; color: var(--th-text-faint);
    transition: background 0.15s, color 0.15s; flex-shrink: 0;
  }
  .th-collapse-btn:hover { background: var(--th-bg-hover); color: var(--th-orange); }
  .th-sidebar.collapsed .th-collapse-btn { display: flex; }

  .th-sidebar-logo {
    font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: 1.6rem;
    letter-spacing: 0.05em; text-transform: uppercase; color: var(--th-text-heading);
    line-height: 1; white-space: nowrap; overflow: hidden;
    transition: opacity 0.15s, max-height 0.22s, width 0.22s;
  }
  .th-sidebar-logo span { color: var(--th-orange); }
  .th-sidebar.collapsed .th-sidebar-logo { opacity: 0; max-height: 0; overflow: hidden; width: 0; margin: 0; }

  /* Collapsed monogram */
  .th-sidebar-monogram {
    display: none;
    flex-direction: column; align-items: center; justify-content: center; gap: 3px;
    font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: 1.3rem;
    letter-spacing: 0.04em; color: var(--th-text-heading); line-height: 1;
    user-select: none;
  }
  .th-sidebar-monogram-dot {
    width: 5px; height: 5px; border-radius: 50%; background: var(--th-orange);
  }
  .th-sidebar.collapsed .th-sidebar-monogram { display: flex; }

  /* Row 2: date (left) + time/day column (right) */
  .th-sidebar-datetime {
    display: flex; align-items: center; gap: 0.5rem;
    white-space: nowrap; overflow: hidden;
    transition: opacity 0.15s, max-height 0.22s;
  }
  .th-sidebar.collapsed .th-sidebar-datetime { opacity: 0; max-height: 0; }
  .th-sidebar-date {
    font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: 1.65rem;
    letter-spacing: 0.04em; color: var(--th-text-primary); line-height: 1;
  }
  .th-sidebar-dt-col {
    display: flex; flex-direction: column; justify-content: center; gap: 0.05rem;
  }
  .th-sidebar-time {
    font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 0.72rem;
    letter-spacing: 0.06em; color: var(--th-orange); line-height: 1;
  }
  .th-sidebar-day {
    font-family: 'Barlow Condensed', sans-serif; font-weight: 600; font-size: 0.72rem;
    text-transform: uppercase; letter-spacing: 0.09em; color: var(--th-text-faint); line-height: 1;
  }

  .th-shop-select {
    width: 100%;
    background: var(--th-bg-input);
    border: 1px solid var(--th-border-strong);
    color: var(--th-text-primary);
    padding: 0.35rem 0.55rem;
    border-radius: 7px;
    font-family: var(--font-body);
    font-size: 0.8rem;
    outline: none;
    cursor: pointer;
    transition: border-color 0.2s, opacity 0.15s, max-height 0.22s;
  }
  .th-shop-select:focus { border-color: var(--th-orange); }
  .th-sidebar.collapsed .th-shop-select { opacity: 0; max-height: 0; padding: 0; border: none; pointer-events: none; }

  .th-sidebar-nav {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 0.65rem 0.6rem;
    transition: padding 0.22s;
  }
  .th-sidebar.collapsed .th-sidebar-nav { padding: 0.5rem 0; }
  .th-sidebar-nav::-webkit-scrollbar { width: 3px; }
  .th-sidebar-nav::-webkit-scrollbar-thumb { background: var(--th-border-strong); border-radius: 2px; }

  .th-nav-section {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 0.68rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--th-text-faint);
    padding: 1rem 0.4rem 0.25rem;
    white-space: nowrap; overflow: hidden;
    transition: opacity 0.15s, max-height 0.22s, padding 0.22s, font-size 0.2s;
    display: flex; align-items: center; justify-content: space-between;
    width: 100%; text-align: left; background: transparent; border: none; cursor: pointer;
  }
  .th-nav-section:hover { color: var(--th-text-muted); }
  .th-nav-section.is-collapsed {
    font-size: 0.9rem;
    color: var(--th-text-dim);
  }
  .th-nav-section-inner {
    display: flex; align-items: center; gap: 0.45rem;
  }
  .th-nav-section-inner::before {
    content: '';
    display: inline-block;
    width: 4px; height: 4px;
    border-radius: 50%;
    background: var(--th-orange);
    opacity: 0.7;
    flex-shrink: 0;
  }
  .th-sidebar.collapsed .th-nav-section {
    opacity: 0; max-height: 0; padding: 0; overflow: hidden; pointer-events: none;
  }

  .th-nav-btn {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    text-align: left;
    padding: 0.42rem 0.6rem;
    border-radius: 8px;
    border: none;
    background: none;
    font-family: var(--font-body);
    font-size: 0.875rem !important;
    font-weight: 500;
    color: var(--th-text-muted);
    cursor: pointer;
    transition: background 0.13s ease, color 0.13s ease, transform 0.1s ease;
    margin-bottom: 1px;
    white-space: nowrap; overflow: hidden;
    position: relative;
  }
  .th-nav-btn:hover {
    background: rgba(255,255,255,0.05);
    color: var(--th-text-primary);
    transform: translateX(1px);
  }
  .th-nav-btn.active {
    background: linear-gradient(135deg, var(--th-orange-bg) 0%, rgba(249,115,22,0.06) 100%);
    color: var(--th-orange);
    font-weight: 600;
  }
  .th-nav-btn.active svg { color: var(--th-orange); }
  .th-nav-btn svg {
    color: var(--th-text-faint);
    flex-shrink: 0;
    transition: color 0.13s ease;
  }
  .th-nav-btn:hover svg { color: var(--th-text-dim); }

  /* Collapsed nav — icon-only centered */
  .th-sidebar.collapsed .th-nav-btn {
    justify-content: center; padding: 0.52rem 0; gap: 0;
    border-radius: 8px;
  }
  .th-sidebar.collapsed .th-nav-btn:hover { transform: none; }
  .th-nav-btn-label { transition: opacity 0.15s, width 0.22s; }
  .th-sidebar.collapsed .th-nav-btn-label { opacity: 0; width: 0; overflow: hidden; }

  /* Tooltip on hover when collapsed */
  .th-sidebar.collapsed .th-nav-btn:hover::after {
    content: attr(data-label);
    position: absolute; left: 52px; top: 50%; transform: translateY(-50%);
    background: var(--th-bg-card); color: var(--th-text-primary);
    padding: 0.32rem 0.7rem; border-radius: 7px; font-size: 0.8rem; font-weight: 600;
    white-space: nowrap; pointer-events: none; z-index: 100;
    border: 1px solid var(--th-border-strong);
    box-shadow: 0 6px 18px rgba(0,0,0,0.3);
  }

  /* ── Sidebar bottom settings button ── */
  .th-sidebar-bottom {
    padding: 0.55rem 0.65rem;
    border-top: 1px solid var(--th-border);
    flex-shrink: 0;
    position: relative;
    background: linear-gradient(0deg, rgba(0,0,0,0.08) 0%, transparent 100%);
  }
  .th-sidebar.collapsed .th-sidebar-bottom { padding: 0.55rem 5px; display: flex; justify-content: center; }
  .th-settings-btn {
    display: flex; align-items: center; gap: 0.55rem;
    width: 100%; padding: 0.48rem 0.6rem;
    background: none; border: none; border-radius: 8px;
    color: var(--th-text-muted); cursor: pointer; font-family: var(--font-body);
    font-size: 0.85rem; font-weight: 500;
    transition: background 0.13s ease, color 0.13s ease;
  }
  .th-settings-btn:hover { background: rgba(255,255,255,0.05); color: var(--th-text-primary); }
  .th-sidebar.collapsed .th-settings-btn { justify-content: center; padding: 0.5rem; }
  .th-settings-btn-label { transition: opacity 0.15s, width 0.22s; white-space: nowrap; overflow: hidden; }
  .th-sidebar.collapsed .th-settings-btn-label { opacity: 0; width: 0; }

  /* Settings popover */
  .th-settings-popover {
    position: absolute; bottom: calc(100% + 8px); left: 0.65rem; right: 0.65rem;
    background: var(--th-bg-card);
    border: 1px solid var(--th-border-strong);
    border-radius: 12px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04);
    padding: 0.45rem; z-index: 200;
    display: flex; flex-direction: column; gap: 2px;
    animation: sidebarPopoverIn 0.16s cubic-bezier(0.34,1.56,0.64,1);
  }
  @keyframes sidebarPopoverIn {
    from { opacity: 0; transform: translateY(6px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .th-sidebar.collapsed .th-settings-popover {
    position: fixed; bottom: 0.6rem; left: 58px; right: auto; width: 215px;
  }
  .th-settings-popover-item {
    display: flex; align-items: center; gap: 0.55rem;
    width: 100%; padding: 0.5rem 0.65rem;
    background: none; border: none; border-radius: 8px;
    color: var(--th-text-muted); cursor: pointer; font-family: var(--font-body);
    font-size: 0.83rem; font-weight: 500; text-align: left;
    transition: background 0.12s ease, color 0.12s ease;
  }
  .th-settings-popover-item:hover { background: rgba(255,255,255,0.05); color: var(--th-text-primary); }
  .th-settings-popover-item.danger { color: var(--th-rose); }
  .th-settings-popover-item.danger:hover { background: rgba(251,113,133,0.08); color: var(--th-rose); }
  .th-settings-popover-item.staff { color: var(--th-orange); }
  .th-settings-popover-item.staff:hover { background: rgba(249,115,22,0.08); color: var(--th-orange); }
  .th-settings-popover-divider { height: 1px; background: var(--th-border); margin: 0.2rem 0; }

  /* ── Main content ── */
  .th-app-root {
    display: flex;
    height: 100vh;
    background: var(--th-bg-page);
    font-family: var(--font-body);
  }

  .th-main {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 1.5rem;
    background: var(--th-bg-page);
    min-width: 0;
  }
  .th-main::-webkit-scrollbar { width: 6px; }
  .th-main::-webkit-scrollbar-thumb { background: var(--th-border-strong); border-radius: 3px; }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Global shimmer skeleton animation ── */
  @keyframes th-shimmer {
    0%   { background-position: -600px 0; }
    100% { background-position: 600px 0; }
  }
  .th-skeleton {
    background: linear-gradient(90deg,
      var(--th-bg-card-alt) 25%,
      var(--th-bg-hover, rgba(255,255,255,0.06)) 50%,
      var(--th-bg-card-alt) 75%
    );
    background-size: 600px 100%;
    animation: th-shimmer 1.4s ease-in-out infinite;
    border-radius: 6px;
  }

  /* ── Global focus indicators (keyboard nav) ── */
  :focus-visible {
    outline: 2px solid var(--th-orange);
    outline-offset: 2px;
    border-radius: 4px;
  }
  button:focus-visible, a:focus-visible {
    outline: 2px solid var(--th-orange);
    outline-offset: 2px;
  }
  input:focus-visible, select:focus-visible, textarea:focus-visible {
    outline: none; /* inputs use border-color instead */
  }

  /* ── Global spinner ── */
  .th-spinner {
    width: 18px; height: 18px;
    border: 2px solid var(--th-border-strong);
    border-top-color: var(--th-orange);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block; flex-shrink: 0;
  }
  .th-spinner-sm { width: 13px; height: 13px; }
  .th-spinner-lg { width: 28px; height: 28px; border-width: 3px; }

  /* ── Global empty state ── */
  .th-empty {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 0.65rem;
    padding: 3rem 1rem; color: var(--th-text-faint);
    text-align: center;
  }
  .th-empty-icon { opacity: 0.2; }
  .th-empty-title { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--th-text-dim); }
  .th-empty-sub { font-size: 0.8rem; color: var(--th-text-faint); }

  /* ── Global toast notification ── */
  @keyframes th-toast-in  { from { opacity:0; transform:translateY(12px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
  @keyframes th-toast-out { from { opacity:1; transform:translateY(0) scale(1); } to { opacity:0; transform:translateY(8px) scale(0.97); } }
  .th-toast-wrap {
    position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 9999;
    display: flex; flex-direction: column; gap: 0.5rem; pointer-events: none;
  }
  .th-toast {
    display: flex; align-items: center; gap: 0.6rem;
    padding: 0.65rem 1rem; border-radius: 10px;
    font-size: 0.86rem; font-weight: 500; pointer-events: auto;
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    border: 1px solid transparent;
    animation: th-toast-in 0.2s cubic-bezier(.22,.61,.36,1);
    min-width: 220px; max-width: 380px;
  }
  .th-toast.success { background: var(--th-bg-card); border-color: var(--th-emerald); color: var(--th-emerald); }
  .th-toast.error   { background: var(--th-bg-card); border-color: var(--th-rose);    color: var(--th-rose);    }
  .th-toast.info    { background: var(--th-bg-card); border-color: var(--th-sky);     color: var(--th-sky);     }

  /* ── Nav active indicator — left accent bar + right dot ── */
  .th-nav-btn.active {
    border-left: 2px solid var(--th-orange);
    padding-left: calc(0.6rem - 2px);
  }
  .th-nav-btn.active::after {
    content: '';
    position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
    width: 5px; height: 5px; border-radius: 50%;
    background: var(--th-orange); opacity: 0.65;
  }
  .th-sidebar.collapsed .th-nav-btn.active { border-left: none; padding-left: 0; }
  .th-sidebar.collapsed .th-nav-btn.active::after { display: none; }

  /* ── Subtle card lift on hover (interactive cards) ── */
  .th-card-lift {
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .th-card-lift:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(0,0,0,0.18);
  }

  /* ── Table row smooth hover ── */
  tr { transition: background 0.1s; }

  /* ── Scrollbar thin global ── */
  * { scrollbar-width: thin; scrollbar-color: var(--th-border-strong) transparent; }
  *::-webkit-scrollbar { width: 4px; height: 4px; }
  *::-webkit-scrollbar-thumb { background: var(--th-border-strong); border-radius: 2px; }
  *::-webkit-scrollbar-track { background: transparent; }

  /* ── Global skeleton table rows ── */
  .th-skel-row td { padding: 0.7rem 0.85rem; }
  .th-skel-cell {
    height: 13px; border-radius: 5px;
    background: linear-gradient(90deg,
      var(--th-bg-card-alt) 25%,
      var(--th-shimmer-b, rgba(255,255,255,0.06)) 50%,
      var(--th-bg-card-alt) 75%
    );
    background-size: 600px 100%;
    animation: th-shimmer 1.4s ease-in-out infinite;
  }
  .th-skel-cell.w20 { width: 20%; }
  .th-skel-cell.w30 { width: 30%; }
  .th-skel-cell.w40 { width: 40%; }
  .th-skel-cell.w60 { width: 60%; }
  .th-skel-cell.w80 { width: 80%; }
  .th-skel-cell.w100 { width: 100%; }
  .th-skel-row:nth-child(odd) { background: var(--th-row-stripe, transparent); }
`;

function injectAppStyle() {
  if (document.getElementById("th-app-style")) return;
  const s = document.createElement("style");
  s.id = "th-app-style";
  s.textContent = APP_SHELL_STYLE;
  document.head.appendChild(s);
}

// Inject styles and theme immediately at module load (prevents FOUC on hard refresh)
injectAppStyle();
; (() => {
  try {
    const saved = localStorage.getItem("th-theme");
    document.documentElement.setAttribute("data-theme", saved || "dark");
    window.__thTheme = saved || "dark";
  } catch { }
})();

/* ── Nav icon SVGs ── */
const NAV_ICONS = {
  dashboard: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  pos: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  'closing-day': (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  inventory: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  ),
  orders: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="15" y2="17" />
      <line x1="9" y1="9" x2="12" y2="9" />
    </svg>
  ),
  sales: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  recap: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4l3 3" />
    </svg>
  ),
  staff: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  customers: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  suppliers: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  attendance: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <polyline points="9 16 11 18 15 14" />
    </svg>
  ),
  payroll: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <line x1="12" y1="12" x2="12" y2="16" />
      <line x1="10" y1="14" x2="14" y2="14" />
    </svg>
  ),
  profits: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  receivables: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  payables: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  ),
  expenses: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="12" y2="17" />
    </svg>
  ),
  cashledger: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  ),
  reports: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  ),
  products: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  services: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  returns: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4.98" />
    </svg>
  ),
  purchases: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  ),
  credentials: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  "services-summary": (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  "sales-projection": (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="3" x2="3" y2="21" />
      <line x1="3" y1="21" x2="21" y2="21" />
      <polyline points="7 16 11 10 15 14 20 7" />
      <polyline points="17 7 20 7 20 10" />
    </svg>
  ),
  dryrun: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  ),
  "staff-management": (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      <path d="M12 12v6m-3-3h6" />
    </svg>
  ),
};

// Role constants — matches role values from staff_master / JWT
const ROLES = {
  OWNER: "owner",
  GM: "general manager",
  OPS: "operations manager",
  SALES: "sales",
  TIREMAN: "tireman",
  ADMIN: "admin", // hardcoded admin login
};

// Shorthand sets
const ALL = null; // null = no restriction
const MGR_UP = [ROLES.ADMIN, ROLES.OWNER, ROLES.GM, ROLES.OPS];
const OWNER_ADM = [ROLES.ADMIN, ROLES.OWNER];

const NAV_SECTIONS = [
  {
    label: "Main",
    items: [
      { id: "dashboard", label: "Dashboard", roles: [ROLES.ADMIN, ROLES.OWNER, ROLES.GM, ROLES.OPS, ROLES.SALES] },
      { id: "pos", label: "Point of Sale", roles: [ROLES.ADMIN, ROLES.OWNER, ROLES.GM, ROLES.OPS, ROLES.SALES] },
    ],
  },
  {
    label: "Operations",
    items: [
      { id: "orders", label: "Orders", roles: [ROLES.ADMIN, ROLES.OWNER, ROLES.GM, ROLES.OPS, ROLES.SALES] },
      { id: "inventory", label: "Inventory", roles: [ROLES.ADMIN, ROLES.OWNER, ROLES.GM, ROLES.OPS, ROLES.SALES] },
      { id: "products", label: "Products", roles: MGR_UP },
      { id: "purchases", label: "Purchases", roles: MGR_UP },
      { id: "recap", label: "Recap Tires", roles: [ROLES.ADMIN, ROLES.OWNER, ROLES.GM, ROLES.OPS, ROLES.SALES] },
      { id: "returns", label: "Returns", roles: [ROLES.ADMIN, ROLES.OWNER, ROLES.GM, ROLES.OPS, ROLES.SALES] },
    ],
  },
  {
    label: "Sales & Service",
    items: [
      { id: "sales", label: "Sales History", roles: [ROLES.ADMIN, ROLES.OWNER, ROLES.GM, ROLES.OPS, ROLES.SALES] },
      { id: "services", label: "Services", roles: MGR_UP },
      { id: "services-summary", label: "Services Summary", roles: ALL }, // everyone
    ],
  },
  {
    label: "People",
    items: [
      { id: "customers", label: "Customers", roles: [ROLES.ADMIN, ROLES.OWNER, ROLES.GM, ROLES.OPS, ROLES.SALES] },
      { id: "suppliers", label: "Suppliers", roles: MGR_UP },
      { id: "staff-management", label: "Staff Management", roles: MGR_UP },
      { id: "payroll", label: "Payroll", roles: MGR_UP },
    ],
  },
  {
    label: "Finance",
    items: [
      { id: "profits", label: "Profit & Margins", roles: MGR_UP },
      { id: "expenses", label: "Expenses", roles: MGR_UP },
      { id: "cashledger", label: "Cash Ledger", roles: MGR_UP },
      { id: "receivables", label: "Receivables", roles: MGR_UP },
      { id: "payables", label: "Payables", roles: MGR_UP },
      { id: "sales-projection", label: "Sales Projection", roles: MGR_UP },
    ],
  },
  {
    label: "Reports",
    items: [
      { id: "reports", label: "Reports", roles: MGR_UP },
    ],
  },
  {
    label: "Admin",
    items: [
      { id: "credentials", label: "Control Panel", roles: OWNER_ADM },
      { id: "dryrun", label: "System Feedback", roles: MGR_UP },
    ],
  },

];

/* ══════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════ */
function TireHub() {
  const [page, setPage] = React.useState(() => localStorage.getItem("th-page") || "dashboard");
  const [pageContext, setPageContext] = React.useState({ view: "Dashboard" });
  const [shop, setShop] = React.useState("SHOP-001");
  const [shops, setShops] = React.useState([]);
  const [refresh, setRefresh] = React.useState(0);
  const [token, setToken] = React.useState(() => localStorage.getItem("th-token") || "");
  const [authUser, setAuthUser] = React.useState(() => localStorage.getItem("th-user") || "");
  const [currentStaffId, setCurrentStaffId] = React.useState(() => localStorage.getItem("th-staff-id") || "");
  const [currentStaffName, setCurrentStaffName] = React.useState(() => localStorage.getItem("th-staff-name") || "");
  const [userRole, setUserRole] = React.useState(() => (localStorage.getItem("th-role") || "").toLowerCase());
  const [allowedPages, setAllowedPages] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("th-allowed-pages") || "null"); } catch { return null; }
  }); // null means admin (all pages)
  const [userPower, setUserPower] = React.useState(() => Number(localStorage.getItem("th-power") || "0"));
  const [userSystemRoles, setUserSystemRoles] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("th-system-roles") || "[]"); } catch { return []; }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => localStorage.getItem("th-sidebar-collapsed") === "1");
  const [collapsedNavSections, setCollapsedNavSections] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("th-collapsed-nav") || "{}"); } catch { return {}; }
  });
  const [backupState, setBackupState] = React.useState("idle"); // idle | saving | ok | error
  const [pendingFirstLogin, setPendingFirstLogin] = React.useState(null); // loginData when must_change_pin
  const [showSettings, setShowSettings] = React.useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const [isShopClosed, setIsShopClosed] = React.useState(false);
  const [businessDate, setBusinessDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);

  // Re-render when theme changes (MutationObserver on <html>)
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  function applyLoginData(data) {
    setShowSettings(false);
    setPage("dashboard");
    localStorage.setItem("th-page", "dashboard");
    setToken(data.token);
    setAuthUser(data.username);
    const role = (data.role || "admin").toLowerCase();
    localStorage.setItem("th-role", role);
    setUserRole(role);
    const power = data.power ?? (data.is_admin ? 60 : 0);
    localStorage.setItem("th-power", String(power));
    setUserPower(power);
    const sysRoles = data.system_roles || [];
    localStorage.setItem("th-system-roles", JSON.stringify(sysRoles));
    setUserSystemRoles(sysRoles);
    // allowed_pages: null = unrestricted (admin/superadmin), array = specific pages
    const pages = data.allowed_pages === null || data.is_admin ? null : (data.allowed_pages || []);
    localStorage.setItem("th-allowed-pages", pages === null ? "null" : JSON.stringify(pages));
    setAllowedPages(pages);
    if (data.staff_id) {
      const name = data.full_name || data.username;
      localStorage.setItem("th-staff-id", data.staff_id);
      localStorage.setItem("th-staff-name", name);
      setCurrentStaffId(data.staff_id);
      setCurrentStaffName(name);
    }
    // Land on first allowed page
    const currentPg = localStorage.getItem("th-page") || "dashboard";
    const isOwnerOrAdmin = power >= 80 || role === "admin" || role === "owner" || pages === null;
    const isManager = role.includes("manager");
    
    if (!isOwnerOrAdmin && !isManager && pages !== null && !pages.includes(currentPg)) {
      const first = pages[0] || "services-summary";
      setPage(first);
      localStorage.setItem("th-page", first);
    } else if (isManager && ["credentials"].includes(currentPg)) {
      setPage("dashboard");
      localStorage.setItem("th-page", "dashboard");
    }
  }

  const [lastBackupTime, setLastBackupTime] = React.useState(null);

  // Fetch backup status
  const fetchBackupStatus = React.useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${API_URL}/backup-status`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.lastBackup) setLastBackupTime(new Date(d.lastBackup));
    } catch { }
  }, [token]);

  React.useEffect(() => {
    fetchBackupStatus();
    const id = setInterval(fetchBackupStatus, 60000); // refresh every minute
    return () => clearInterval(id);
  }, [fetchBackupStatus]);

  function getRelativeTime(date) {
    if (!date) return "";
    const diff = Math.floor((new Date() - date) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} mins. ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hrs. ago`;
    return date.toLocaleDateString();
  }

  function handleLogin(data) {
    if (data.must_change_pin) {
      setPendingFirstLogin(data);
      return;
    }
    applyLoginData(data);
  }

  function handleFirstLoginDone(data) {
    setPendingFirstLogin(null);
    applyLoginData(data);
  }

  function handleLogout() {
    localStorage.removeItem("th-token");
    localStorage.removeItem("th-user");
    localStorage.removeItem("th-staff-id");
    localStorage.removeItem("th-staff-name");
    localStorage.removeItem("th-role");
    localStorage.removeItem("th-power");
    localStorage.removeItem("th-system-roles");
    localStorage.removeItem("th-allowed-pages");
    setToken("");
    setAuthUser("");
    setCurrentStaffId("");
    setCurrentStaffName("");
    setShowSettings(false);
    setUserRole("");
    setUserPower(0);
    setUserSystemRoles([]);
    setAllowedPages(null);
  }

  React.useEffect(() => {
    // Watch for theme changes so sidebar re-renders
    const obs = new MutationObserver(() => forceUpdate());
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    // Load shops (only when authenticated)
    if (token) {
      fetch(`${API_URL}/shops`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((d) => {
          setShops(Array.isArray(d) ? d : []);
          if (Array.isArray(d) && d.length) setShop(d[0].shop_id);
        })
        .catch(() => { });
    }

    return () => obs.disconnect();
  }, [token]);

  // Fetch shop status when shop changes
  React.useEffect(() => {
    if (token && shop) {
      fetch(`${API_URL}/shops/${shop}/business-date`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.is_closed !== undefined) setIsShopClosed(!!d.is_closed);
          if (d.business_date) setBusinessDate(d.business_date);
        })
        .catch(() => { });
    }
  }, [token, shop]);

  const [showGlobalCloseModal, setShowGlobalCloseModal] = React.useState(false);
  const [showGlobalOpenModal, setShowGlobalOpenModal] = React.useState(false);
  const [globalSummaryData, setGlobalSummaryData] = React.useState(null);
  const [isClosingOrOpening, setIsClosingOrOpening] = React.useState(false);

  async function handleGlobalToggleClick() {
    const isAdminOrManager = userPower >= 80 || userRole?.includes('manager') || userRole === 'admin' || userRole === 'owner';
    if (!isAdminOrManager) {
      alert("You do not have permission to change shop status.");
      return;
    }
    setShowSettings(false);
    if (isShopClosed) {
      setShowGlobalOpenModal(true);
    } else {
      setIsClosingOrOpening(true);
      try {
        const date = businessDate || new Date().toISOString().split('T')[0];
        const r = await fetch(`${API_URL}/reports/daily-activity/${shop}?date=${date}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const d = await r.json();
        if (!d.error) {
          setGlobalSummaryData(d);
          setShowGlobalCloseModal(true);
        } else {
          alert(d.error);
        }
      } catch (err) {
        alert("Failed to fetch summary: " + err.message);
      }
      setIsClosingOrOpening(false);
    }
  }

  async function confirmOpenShop() {
    setIsClosingOrOpening(true);
    try {
      const r = await fetch(`${API_URL}/shops/${shop}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_closed: false }),
      });
      const d = await r.json();
      if (d.success) {
        setIsShopClosed(false);
        setShowGlobalOpenModal(false);
        
        // Re-fetch business date
        const r2 = await fetch(`${API_URL}/shops/${shop}/business-date`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d2 = await r2.json();
        if (d2.business_date) setBusinessDate(d2.business_date);
      } else {
         alert(d.error);
      }
    } catch (err) {
      alert("Failed to open shop: " + err.message);
    }
    setIsClosingOrOpening(false);
  }

  async function confirmCloseShop() {
    setIsClosingOrOpening(true);
    try {
      const r = await fetch(`${API_URL}/shops/${shop}/close-day`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ closed_by: localStorage.getItem("th-user") || "USER" })
      });
      const d = await r.json();
      if (d.success || !d.error) {
        setIsShopClosed(true);
        setShowGlobalCloseModal(false);
        
        // Re-fetch business date
        const r2 = await fetch(`${API_URL}/shops/${shop}/business-date`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d2 = await r2.json();
        if (d2.business_date) setBusinessDate(d2.business_date);
      } else {
        alert(d.error);
      }
    } catch (err) {
      alert("Failed to close shop: " + err.message);
    }
    setIsClosingOrOpening(false);
  }


  const doRefresh = () => setRefresh((r) => r + 1);

  // Redirect to first allowed page if current page is restricted
  React.useEffect(() => {
    const isOwnerOrAdmin = userPower >= 80 || userRole === "admin" || userRole === "owner" || allowedPages === null;
    const isManager = userRole.includes("manager");
    
    if (isOwnerOrAdmin) return;
    if (isManager && page !== "credentials") return;

    const allItems = NAV_SECTIONS.flatMap(s => s.items);
    const item = allItems.find(i => i.id === page);
    if (item && allowedPages !== null && !allowedPages.includes(item.id) 
        && !(['staff-management', 'staff-new'].includes(item.id) && allowedPages.includes('staff')) 
        && !(item.id === 'services-summary' && allowedPages.includes('services'))) {
      const first = allowedPages[0];
      if (first) { setPage(first); localStorage.setItem("th-page", first); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedPages, userRole, userPower, page]);

  if (!token) {
    if (pendingFirstLogin) {
      return <FirstLoginPage loginData={pendingFirstLogin} onDone={handleFirstLoginDone} />;
    }
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="th-app-root">
      {/* ── Mobile hamburger ── */}
      <button className={`th-hamburger${mobileSidebarOpen ? " open" : ""}`} onClick={() => setMobileSidebarOpen(v => !v)} aria-label="Toggle menu">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          {mobileSidebarOpen
            ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
            : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
        </svg>
      </button>
      {/* ── Mobile backdrop ── */}
      <div className={`th-sidebar-backdrop${mobileSidebarOpen ? " visible" : ""}`} onClick={() => setMobileSidebarOpen(false)} />
      {/* ── Sidebar ── */}
      <aside className={`th-sidebar${sidebarCollapsed ? " collapsed" : ""}${mobileSidebarOpen ? " mobile-open" : ""}`}>
        {/* Logo + shop selector */}
        <div className="th-sidebar-top">
          {/* Row 1: Logo + collapse toggle */}
          <div className="th-sidebar-top-row">
            <div className="th-sidebar-logo">Core<span>Track</span></div>
            <div className="th-sidebar-monogram">C<div className="th-sidebar-monogram-dot" /></div>
            <button
              className="th-collapse-btn"
              onClick={() => { const next = !sidebarCollapsed; setSidebarCollapsed(next); localStorage.setItem("th-sidebar-collapsed", next ? "1" : "0"); }}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {sidebarCollapsed ? (<>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                  <polyline points="13 9 17 12 13 15" />
                </>) : (<>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                  <polyline points="5 9 1 12 5 15" transform="translate(10,0)" />
                </>)}
              </svg>
            </button>
          </div>
          {/* Row 2: Date (left) + time/day stacked (right) */}
          <div className="th-sidebar-datetime">
            <div className="th-sidebar-date">{now.toLocaleDateString('en-PH', { month: '2-digit', day: '2-digit', year: '2-digit' })}</div>
            <div className="th-sidebar-dt-col">
              <div className="th-sidebar-time">{now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
              <div className="th-sidebar-day">{now.toLocaleDateString('en-PH', { weekday: 'long' })}</div>
            </div>
          </div>
          {/* Row 3: Shop selector */}
          <select
            className="th-shop-select"
            value={shop}
            onChange={(e) => setShop(e.target.value)}
          >
            {shops.map((s) => (
              <option key={s.shop_id} value={s.shop_id}>{s.shop_name}</option>
            ))}
          </select>
        </div>

        {/* Navigation */}
        <nav className="th-sidebar-nav">
          {NAV_SECTIONS.map((section) => {
            const ADMIN_ONLY_PAGES = ["credentials"];
            const isOwnerOrAdmin = userPower >= 80 || userRole === "admin" || userRole === "owner" || allowedPages === null;
            const isManager = userRole.includes("manager");
            
            const visibleItems = section.items.filter(item => {
              if (ADMIN_ONLY_PAGES.includes(item.id)) return isOwnerOrAdmin;
              if (isOwnerOrAdmin || isManager) return true;
              return allowedPages === null ||
                allowedPages.includes(item.id) ||
                (['staff-management', 'staff-new'].includes(item.id) && allowedPages.includes('staff')) ||
                (item.id === 'services-summary' && allowedPages.includes('services'));
            });
            if (!visibleItems.length) return null;
            const isCollapsed = !!collapsedNavSections[section.label];
            return (
              <div key={section.label}>
                <button 
                  className={`th-nav-section${isCollapsed ? ' is-collapsed' : ''}`}
                  onClick={() => {
                    const next = { ...collapsedNavSections, [section.label]: !isCollapsed };
                    setCollapsedNavSections(next);
                    localStorage.setItem("th-collapsed-nav", JSON.stringify(next));
                  }}
                  title={sidebarCollapsed ? section.label : `Toggle ${section.label}`}
                >
                  <div className="th-nav-section-inner">{section.label}</div>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', opacity: 0.5 }}>
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                {!isCollapsed && visibleItems.map((item) => (
                  <button
                    key={item.id}
                    className={`th-nav-btn${page === item.id ? " active" : ""}`}
                    data-label={item.label}
                    onClick={() => { setPage(item.id); localStorage.setItem("th-page", item.id); setMobileSidebarOpen(false); }}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    {NAV_ICONS[item.id]}
                    <span className="th-nav-btn-label" style={{ fontSize: "0.97rem" }}>{item.label}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        {/* Settings button + popover */}
        <div className="th-sidebar-bottom">
          {showSettings && (
            <div className="th-settings-popover">
              {/* Dark mode */}
              <ThemeToggle collapsed={false} asMenuItem />
              <div className="th-settings-popover-divider" />
              {/* Backup */}
              <button
                className="th-settings-popover-item"
                onClick={async () => {
                  if (backupState === "saving") return;
                  setBackupState("saving");
                  try {
                    const r = await fetch(`${API_URL}/backup`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
                    const d = await r.json();
                    setBackupState(d.ok ? "ok" : "error");
                    if (d.ok) fetchBackupStatus();
                  } catch { setBackupState("error"); }
                  setTimeout(() => setBackupState("idle"), 3000);
                }}
              >
                {backupState === "saving"
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, animation: "spin 1s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                  : backupState === "ok"
                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, color: "var(--th-emerald)" }}><polyline points="20 6 9 17 4 12" /></svg>
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                }
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span>{backupState === "saving" ? "Saving…" : backupState === "ok" ? "Backup saved!" : backupState === "error" ? "Backup failed" : "Backup data"}</span>
                  {lastBackupTime && <span style={{ fontSize: '0.65rem', opacity: 0.5, fontWeight: 500, marginTop: '-2px' }}>Last: {getRelativeTime(lastBackupTime)}</span>}
                </div>
              </button>

              <div className="th-settings-popover-divider" />
              {/* Shop Status Toggle */}
              <button
                className={`th-settings-popover-item ${isShopClosed ? 'danger' : 'staff'}`}
                onClick={handleGlobalToggleClick}
                style={{ 
                  border: 'none',
                  background: isShopClosed ? 'rgba(239, 68, 68, 0.05)' : 'rgba(249, 115, 22, 0.05)'
                }}
              >
                {isShopClosed ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 700 }}>{isShopClosed ? "SHOP CLOSED" : "SHOP OPEN"}</span>
                  <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>{isShopClosed ? "Next Day Mode" : "Current Day Mode"}</span>
                </div>
              </button>

              {/* Current user display */}
              {currentStaffName && (<>
                <div className="th-settings-popover-divider" />
                <button
                  className="th-settings-popover-item"
                  onClick={() => { setPage('profile'); setShowSettings(false); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
                  {currentStaffName}
                </button>
              </>)}
              <div className="th-settings-popover-divider" />
              {/* Sign out */}
              <button className="th-settings-popover-item danger" onClick={handleLogout}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                Sign out ({authUser})
              </button>
            </div>
          )}

          <button className="th-settings-btn" onClick={() => setShowSettings(s => !s)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span className="th-settings-btn-label" style={{ fontSize: "0.97rem" }}>Settings</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="th-main">
        {(() => {
          const ADMIN_ONLY = ["credentials"];
          const isOwnerOrAdmin = userPower >= 80 || userRole === "admin" || userRole === "owner" || allowedPages === null;
          const isManager = userRole.includes("manager");
          
          let isRestricted = false;
          if (ADMIN_ONLY.includes(page)) {
            isRestricted = !isOwnerOrAdmin;
          } else if (!isOwnerOrAdmin && !isManager) {
            isRestricted = allowedPages !== null && !allowedPages.includes(page)
              && !(page === 'services-summary' && allowedPages.includes('services'))
              && !(['staff-management', 'staff-new'].includes(page) && allowedPages.includes('staff'));
          }

          if (isRestricted) {
            return (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: "0.75rem", color: "var(--th-text-faint)", textAlign: "center" }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
                <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--th-text-muted)" }}>Access Restricted</div>
                <div style={{ fontSize: "0.83rem" }}>You don't have permission to view this page.</div>
              </div>
            );
          }

          const currentShopObj = shops.find(s => s.shop_id === shop);
          const currentShopName = currentShopObj ? currentShopObj.shop_name : "CoreTrack";

          switch (page) {
            case "dashboard": return <DashboardPage key={refresh} shopId={shop} shopName={currentShopName} businessDate={businessDate} setPageContext={setPageContext} />;
            case "pos": return <POSPage key={refresh} shopId={shop} onRefresh={doRefresh} authUser={authUser} currentStaffId={currentStaffId} currentStaffName={currentStaffName} isShopClosed={isShopClosed} setPageContext={setPageContext} />;
            case "inventory": return <InventoryPage key={refresh} shopId={shop} onRefresh={doRefresh} setPageContext={setPageContext} />;
            case "orders": return <OrdersPage key={refresh} shopId={shop} onRefresh={doRefresh} setPageContext={setPageContext} />;
            case "recap": return <RecapPage key={refresh} shopId={shop} onRefresh={doRefresh} currentStaffId={currentStaffId} currentStaffName={currentStaffName} setPageContext={setPageContext} />;
            case "returns": return <ReturnsPage key={refresh} shopId={shop} setPageContext={setPageContext} />;
            case "sales": return <SalesPage key={refresh} shopId={shop} setPageContext={setPageContext} />;
            case "reports": return <Reportspage key={refresh} shopId={shop} setPageContext={setPageContext} />;
            case "products": return <Productspage key={refresh} shopId={shop} setPageContext={setPageContext} />;
            case "services": return <Servicespage key={refresh} shopId={shop} setPageContext={setPageContext} />;
            case "services-summary": return <ServicesSummaryPage key={refresh} shopId={shop} setPageContext={setPageContext} />;
            case "staff": return <StaffManagementPage key={refresh} shopId={shop} setPageContext={setPageContext} userRole={userRole} userPower={userPower} />;
            case "customers": return <CustomerPage key={refresh} shopId={shop} setPageContext={setPageContext} />;
            case "suppliers": return <SuppliersPage key={refresh} shopId={shop} setPageContext={setPageContext} />;
            case "attendance": return <StaffManagementPage key={refresh} shopId={shop} setPageContext={setPageContext} userRole={userRole} userPower={userPower} />;
            case "staff-management": return <StaffManagementPage key={refresh} shopId={shop} setPageContext={setPageContext} userRole={userRole} userPower={userPower} />;
            case "payroll": return <PayrollPage key={refresh} shopId={shop} setPageContext={setPageContext} />;
            case "profits": return <ProfitsPage key={refresh} shopId={shop} setPageContext={setPageContext} />;
            case "purchases": return <PurchasesPage key={refresh} shopId={shop} currentStaffId={currentStaffId} currentStaffName={currentStaffName} isShopClosed={isShopClosed} setPageContext={setPageContext} />;
            case "expenses": return <ExpensesPage key={refresh} shopId={shop} isShopClosed={isShopClosed} setPageContext={setPageContext} />;
            case "cashledger": return <CashLedgerPage key={refresh} shopId={shop} isShopClosed={isShopClosed} setPageContext={setPageContext} />;
            case "receivables": return <ReceivablesPage key={refresh} shopId={shop} setPageContext={setPageContext} />;
            case "payables": return <PayablesPage key={refresh} shopId={shop} setPageContext={setPageContext} />;
            case "sales-projection": return <SalesProjectionPage key={refresh} shopId={shop} setPageContext={setPageContext} />;
            case "dryrun": return <DryRunTrackerPage key={refresh} setPageContext={setPageContext} />;
            case "profile": return <ProfilePage key={refresh} />;
            case "credentials": return <ControlPanelPage key={refresh} callerPower={userPower} callerSystemRoles={userSystemRoles} shopId={shop} setPageContext={setPageContext} />;
            default: return null;
          }
        })()}
      </main>

      {/* ── Open Business Day Modal ── */}
      {showGlobalOpenModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            padding: '1rem',
          }}
          onClick={() => !isClosingOrOpening && setShowGlobalOpenModal(false)}
        >
          <style>{`
            @keyframes openDaySlideUp {
              from { opacity: 0; transform: translateY(18px) scale(0.97); }
              to   { opacity: 1; transform: translateY(0)    scale(1);    }
            }
            @keyframes openDayPulseRing {
              0%   { box-shadow: 0 0 0 0  rgba(16,185,129,0.5); }
              70%  { box-shadow: 0 0 0 12px rgba(16,185,129,0); }
              100% { box-shadow: 0 0 0 0  rgba(16,185,129,0); }
            }
            .open-day-confirm-btn {
              transition: filter 0.18s ease, transform 0.15s ease, box-shadow 0.18s ease;
            }
            .open-day-confirm-btn:hover:not(:disabled) {
              filter: brightness(1.12);
              transform: translateY(-1px);
              box-shadow: 0 6px 22px rgba(16,185,129,0.38);
            }
            .open-day-confirm-btn:active:not(:disabled) {
              transform: translateY(0);
            }
            .open-day-cancel-btn {
              transition: background 0.15s ease, color 0.15s ease;
            }
            .open-day-cancel-btn:hover:not(:disabled) {
              background: var(--th-bg-input) !important;
              color: var(--th-text-primary) !important;
            }
          `}</style>
          <div
            style={{
              width: '100%', maxWidth: '420px',
              borderRadius: '20px',
              background: 'var(--th-bg-card, #1a1d2e)',
              border: '1px solid rgba(255,255,255,0.09)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(16,185,129,0.12)',
              overflow: 'hidden',
              animation: 'openDaySlideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── Gradient header ── */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(5,150,105,0.07) 100%)',
              borderBottom: '1px solid rgba(16,185,129,0.15)',
              padding: '1.5rem 1.5rem 1.25rem',
              display: 'flex', alignItems: 'center', gap: '1rem',
            }}>
              {/* Pulsing unlock icon */}
              <div style={{
                width: 48, height: 48, borderRadius: '14px', flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(16,185,129,0.25) 0%, rgba(5,150,105,0.12) 100%)',
                border: '1px solid rgba(16,185,129,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'openDayPulseRing 2s ease infinite',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--th-text-primary)', letterSpacing: '-0.01em' }}>
                  Open Business Day?
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--th-text-faint)', marginTop: '0.18rem' }}>
                  Resume recording under{' '}
                  <span style={{ color: '#10b981', fontWeight: 700 }}>Current Day Mode</span>
                </div>
              </div>
              {/* Close X */}
              <button
                onClick={() => !isClosingOrOpening && setShowGlobalOpenModal(false)}
                disabled={isClosingOrOpening}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--th-text-faint)', padding: '0.3rem',
                  borderRadius: 8, lineHeight: 1, flexShrink: 0,
                  transition: 'color 0.15s ease, background 0.15s ease',
                }}
                onMouseOver={e => { e.currentTarget.style.color = 'var(--th-text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseOut={e => { e.currentTarget.style.color = 'var(--th-text-faint)'; e.currentTarget.style.background = 'none'; }}
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* ── Body ── */}
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

              {/* Info blurb */}
              <p style={{ fontSize: '0.88rem', color: 'var(--th-text-muted)', lineHeight: 1.65, margin: 0 }}>
                Opening the shop will resume recording all new transactions under today's date in{' '}
                <strong style={{ color: 'var(--th-text-dim)', fontWeight: 700 }}>Current Day Mode</strong>.
                The next-day buffer will be deactivated.
              </p>

              {/* Mode info card */}
              <div style={{
                display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                background: 'rgba(16,185,129,0.06)',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: '12px', padding: '0.85rem 1rem',
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '8px', flexShrink: 0,
                  background: 'rgba(16,185,129,0.15)',
                  border: '1px solid rgba(16,185,129,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#10b981', marginBottom: '0.2rem', letterSpacing: '0.01em' }}>
                    Real-Time Mode Active
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--th-text-muted)', lineHeight: 1.5 }}>
                    Sales, expenses, and purchases will be logged to{' '}
                    <strong style={{ color: 'var(--th-text-dim)', fontWeight: 700 }}>today's date</strong> going forward.
                  </div>
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div style={{
              padding: '1rem 1.5rem 1.25rem',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', gap: '0.6rem',
            }}>
              <button
                className="open-day-cancel-btn"
                onClick={() => setShowGlobalOpenModal(false)}
                disabled={isClosingOrOpening}
                style={{
                  flex: 1, padding: '0.65rem 1rem',
                  borderRadius: '10px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'var(--th-text-muted)',
                  fontWeight: 700, fontSize: '0.85rem',
                  cursor: 'pointer', letterSpacing: '0.03em',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Cancel
              </button>
              <button
                className="open-day-confirm-btn"
                onClick={confirmOpenShop}
                disabled={isClosingOrOpening}
                style={{
                  flex: 2, padding: '0.65rem 1rem',
                  borderRadius: '10px',
                  background: isClosingOrOpening
                    ? 'rgba(16,185,129,0.35)'
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 800, fontSize: '0.88rem',
                  cursor: isClosingOrOpening ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.04em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {isClosingOrOpening ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    Opening…
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                    </svg>
                    Confirm &amp; Open Day
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Close Business Day Modal ── */}
      {showGlobalCloseModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            padding: '1rem',
            animation: 'fadeIn 0.18s ease',
          }}
          onClick={() => !isClosingOrOpening && setShowGlobalCloseModal(false)}
        >
          <style>{`
            @keyframes closeDaySlideUp {
              from { opacity: 0; transform: translateY(18px) scale(0.97); }
              to   { opacity: 1; transform: translateY(0)    scale(1);    }
            }
            @keyframes closeDayPulseRing {
              0%   { box-shadow: 0 0 0 0 rgba(249,115,22,0.45); }
              70%  { box-shadow: 0 0 0 12px rgba(249,115,22,0); }
              100% { box-shadow: 0 0 0 0   rgba(249,115,22,0); }
            }
            .close-day-confirm-btn {
              transition: filter 0.18s ease, transform 0.15s ease, box-shadow 0.18s ease;
            }
            .close-day-confirm-btn:hover:not(:disabled) {
              filter: brightness(1.12);
              transform: translateY(-1px);
              box-shadow: 0 6px 20px rgba(249,115,22,0.35);
            }
            .close-day-confirm-btn:active:not(:disabled) {
              transform: translateY(0);
            }
            .close-day-cancel-btn {
              transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
            }
            .close-day-cancel-btn:hover:not(:disabled) {
              background: var(--th-bg-input) !important;
              color: var(--th-text-primary) !important;
            }
            .close-day-stat-tile {
              transition: transform 0.15s ease, box-shadow 0.15s ease;
            }
            .close-day-stat-tile:hover {
              transform: translateY(-2px);
              box-shadow: 0 6px 18px rgba(0,0,0,0.25);
            }
          `}</style>
          <div
            style={{
              width: '100%', maxWidth: '460px',
              borderRadius: '20px',
              background: 'var(--th-bg-card, #1a1d2e)',
              border: '1px solid rgba(255,255,255,0.09)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(249,115,22,0.12)',
              overflow: 'hidden',
              animation: 'closeDaySlideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── Gradient header strip ── */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(249,115,22,0.18) 0%, rgba(234,88,12,0.08) 100%)',
              borderBottom: '1px solid rgba(249,115,22,0.15)',
              padding: '1.5rem 1.5rem 1.25rem',
              display: 'flex', alignItems: 'center', gap: '1rem',
            }}>
              {/* Pulsing icon badge */}
              <div style={{
                width: 48, height: 48, borderRadius: '14px', flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(249,115,22,0.25) 0%, rgba(234,88,12,0.15) 100%)',
                border: '1px solid rgba(249,115,22,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'closeDayPulseRing 2s ease infinite',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                  <line x1="12" y1="14" x2="12" y2="18"/>
                  <line x1="10" y1="16" x2="14" y2="16"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--th-text-primary)', letterSpacing: '-0.01em' }}>
                  Close Business Day?
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--th-text-faint)', marginTop: '0.18rem' }}>
                  Finalizing record for{' '}
                  <span style={{ color: '#f97316', fontWeight: 700 }}>{businessDate || '—'}</span>
                </div>
              </div>
              {/* Close X */}
              <button
                onClick={() => !isClosingOrOpening && setShowGlobalCloseModal(false)}
                disabled={isClosingOrOpening}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--th-text-faint)', padding: '0.3rem',
                  borderRadius: 8, lineHeight: 1, flexShrink: 0,
                  transition: 'color 0.15s ease, background 0.15s ease',
                }}
                onMouseOver={e => { e.currentTarget.style.color = 'var(--th-text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseOut={e => { e.currentTarget.style.color = 'var(--th-text-faint)'; e.currentTarget.style.background = 'none'; }}
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* ── Body ── */}
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* ── 3-stat summary row ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
                {/* Cash */}
                <div className="close-day-stat-tile" style={{
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(5,150,105,0.05) 100%)',
                  border: '1px solid rgba(16,185,129,0.2)',
                  borderRadius: '14px', padding: '0.85rem 0.75rem',
                  display: 'flex', flexDirection: 'column', gap: '0.35rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                      <line x1="1" y1="10" x2="23" y2="10"/>
                    </svg>
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#10b981' }}>Cash</span>
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--th-text-primary)', lineHeight: 1 }}>
                    {globalSummaryData?.paymentSummary
                      ? `₱${Number(globalSummaryData.paymentSummary.find(p => p.method === 'CASH')?.total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                      : <span style={{ opacity: 0.4 }}>···</span>}
                  </div>
                </div>

                {/* Digital */}
                <div className="close-day-stat-tile" style={{
                  background: 'linear-gradient(135deg, rgba(14,165,233,0.1) 0%, rgba(2,132,199,0.05) 100%)',
                  border: '1px solid rgba(14,165,233,0.2)',
                  borderRadius: '14px', padding: '0.85rem 0.75rem',
                  display: 'flex', flexDirection: 'column', gap: '0.35rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2.5">
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                      <line x1="12" y1="18" x2="12.01" y2="18"/>
                    </svg>
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0ea5e9' }}>Digital</span>
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--th-text-primary)', lineHeight: 1 }}>
                    {globalSummaryData?.paymentSummary
                      ? `₱${Number(globalSummaryData.paymentSummary.find(p => p.method === 'DIGITAL')?.total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                      : <span style={{ opacity: 0.4 }}>···</span>}
                  </div>
                </div>

                {/* Total Revenue */}
                <div className="close-day-stat-tile" style={{
                  background: 'linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(234,88,12,0.05) 100%)',
                  border: '1px solid rgba(249,115,22,0.22)',
                  borderRadius: '14px', padding: '0.85rem 0.75rem',
                  display: 'flex', flexDirection: 'column', gap: '0.35rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                      <polyline points="17 6 23 6 23 12"/>
                    </svg>
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#f97316' }}>Total</span>
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--th-text-primary)', lineHeight: 1 }}>
                    {globalSummaryData?.paymentSummary
                      ? `₱${globalSummaryData.paymentSummary.reduce((s, p) => s + Number(p.total || 0), 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                      : <span style={{ opacity: 0.4 }}>···</span>}
                  </div>
                </div>
              </div>

              {/* ── Warning banner ── */}
              <div style={{
                display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                background: 'rgba(249,115,22,0.06)',
                border: '1px solid rgba(249,115,22,0.22)',
                borderRadius: '12px', padding: '0.85rem 1rem',
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '8px', flexShrink: 0,
                  background: 'rgba(249,115,22,0.15)',
                  border: '1px solid rgba(249,115,22,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f97316', marginBottom: '0.2rem', letterSpacing: '0.01em' }}>
                    Final Action — Cannot Be Undone
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--th-text-muted)', lineHeight: 1.5 }}>
                    This triggers an immediate system backup and <strong style={{ color: 'var(--th-text-dim)', fontWeight: 700 }}>locks today's reports</strong>. New transactions will be logged under the next business day.
                  </div>
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div style={{
              padding: '1rem 1.5rem 1.25rem',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', gap: '0.6rem',
            }}>
              <button
                className="close-day-cancel-btn"
                onClick={() => setShowGlobalCloseModal(false)}
                disabled={isClosingOrOpening}
                style={{
                  flex: 1, padding: '0.65rem 1rem',
                  borderRadius: '10px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'var(--th-text-muted)',
                  fontWeight: 700, fontSize: '0.85rem',
                  cursor: 'pointer', letterSpacing: '0.03em',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Cancel
              </button>
              <button
                className="close-day-confirm-btn"
                onClick={confirmCloseShop}
                disabled={isClosingOrOpening}
                style={{
                  flex: 2, padding: '0.65rem 1rem',
                  borderRadius: '10px',
                  background: isClosingOrOpening
                    ? 'rgba(249,115,22,0.4)'
                    : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 800, fontSize: '0.88rem',
                  cursor: isClosingOrOpening ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.04em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {isClosingOrOpening ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    Closing Day…
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    Confirm &amp; Close Day
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <TireHubBot pageContext={pageContext} />
    </div>
  );
}


export default TireHub
