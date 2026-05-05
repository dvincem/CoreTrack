import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../lib/config';
import { searchFeatures } from '../lib/featureIndex';

/* ============================================================
   GlobalSearch — Sidebar search component
   Tiers:
     1. Feature/navigation discovery (client-side, instant)
     2. Data entity LIKE fan-out (server, debounced 300ms)
     3. NLQ intent detection (server, handled in routes/search.js)

   Props:
     shopId       string   — current shop_id
     onNavigate   fn(id)   — calls App.jsx setPage()
     collapsed    boolean  — sidebar collapsed state

   Role gate is enforced by the parent (App.jsx) — this component
   is only rendered when userPower >= 60.
   ============================================================ */

// ── Styles (injected once into <head>) ──────────────────────────────────────
const STYLES = `
.gs-wrap {
  position: relative;
  padding: 0 8px 6px 8px;
}
.gs-input-row {
  position: relative;
  display: flex;
  align-items: center;
  margin-top: .5rem;
}
.gs-search-icon {
  position: absolute;
  left: 9px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--th-text-dim);
  pointer-events: none;
  display: flex;
  align-items: center;
  z-index: 1;
}
.gs-input {
  width: 100%;
  height: 32px;
  box-sizing: border-box;
  padding: 0 26px 0 30px;
  background: var(--th-bg-input, rgba(255,255,255,0.06));
  border: 1px solid var(--th-border, rgba(255,255,255,0.08));
  border-radius: 8px;
  color: var(--th-text-primary);
  font-size: 0.8rem;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  font-family: inherit;
}
.gs-input:focus {
  border-color: var(--th-orange, #f97316);
  box-shadow: 0 0 0 2px rgba(249,115,22,0.13);
}
.gs-input::placeholder { color: var(--th-text-faint, #64748b); }
.gs-clear-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: var(--th-text-dim);
  display: flex;
  align-items: center;
  padding: 3px;
  border-radius: 4px;
  transition: color 0.12s;
}
.gs-clear-btn:hover { color: var(--th-text-primary); }

/* ── Dropdown ── */
.gs-dropdown {
  position: absolute;
  top: calc(100% + 2px);
  left: 8px;
  right: 8px;
  background: var(--th-bg-card);
  border: 1px solid var(--th-border-strong, rgba(255,255,255,0.14));
  border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.42), 0 2px 6px rgba(0,0,0,0.2);
  z-index: 500;
  max-height: 400px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--th-border, rgba(255,255,255,0.1)) transparent;
}
.gs-section-header {
  padding: 7px 10px 3px;
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--th-orange, #f97316);
  opacity: 0.8;
  user-select: none;
}
.gs-result-btn {
  display: block;
  width: calc(100% - 8px);
  margin: 1px 4px;
  padding: 6px 10px;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
  font-family: inherit;
}
.gs-result-btn:hover,
.gs-result-btn.gs-focused {
  background: rgba(249,115,22,0.1);
}
.gs-result-label {
  font-size: 0.81rem;
  font-weight: 500;
  color: var(--th-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}
.gs-result-detail {
  font-size: 0.7rem;
  color: var(--th-text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
  margin-top: 1px;
}
.gs-badge {
  display: inline-block;
  font-size: 0.6rem;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(249,115,22,0.15);
  color: var(--th-orange, #f97316);
  margin-right: 5px;
  font-weight: 700;
  vertical-align: middle;
  letter-spacing: 0.03em;
}
.gs-divider {
  height: 1px;
  background: var(--th-border, rgba(255,255,255,0.06));
  margin: 3px 10px;
}
.gs-empty-msg {
  padding: 14px 12px;
  font-size: 0.78rem;
  color: var(--th-text-faint, #64748b);
  text-align: center;
}
.gs-loading-row {
  padding: 9px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.76rem;
  color: var(--th-text-dim);
}
.gs-spinner {
  width: 13px;
  height: 13px;
  border: 2px solid rgba(249,115,22,0.18);
  border-top-color: var(--th-orange, #f97316);
  border-radius: 50%;
  animation: gs-spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes gs-spin { to { transform: rotate(360deg); } }
.gs-nlq-hint {
  padding: 4px 10px 2px;
  font-size: 0.68rem;
  color: var(--th-text-faint, #64748b);
  display: flex;
  align-items: center;
  gap: 5px;
}

/* ── Collapsed: icon button ── */
.gs-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 32px;
  border-radius: 8px;
  background: none;
  border: 1px solid transparent;
  cursor: pointer;
  color: var(--th-text-dim);
  margin: 0 auto 6px auto;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  font-family: inherit;
}
.gs-icon-btn:hover {
  background: rgba(249,115,22,0.1);
  color: var(--th-orange, #f97316);
  border-color: var(--th-border, rgba(255,255,255,0.1));
}

/* ── Overlay modal (collapsed mode) ── */
.gs-overlay-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.55);
  z-index: 600;
  backdrop-filter: blur(2px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 70px;
}
.gs-overlay-modal {
  width: 460px;
  max-width: calc(100vw - 24px);
  background: var(--th-bg-card);
  border: 1px solid var(--th-border-strong, rgba(255,255,255,0.14));
  border-radius: 14px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.3);
  overflow: hidden;
}
.gs-overlay-top {
  display: flex;
  align-items: center;
  padding: 12px 14px;
  gap: 10px;
  border-bottom: 1px solid var(--th-border, rgba(255,255,255,0.07));
}
.gs-overlay-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  font-size: 0.92rem;
  color: var(--th-text-primary);
  caret-color: var(--th-orange, #f97316);
  font-family: inherit;
}
.gs-overlay-input::placeholder { color: var(--th-text-faint, #64748b); }
.gs-overlay-body {
  max-height: 400px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--th-border, rgba(255,255,255,0.1)) transparent;
}
.gs-overlay-hint {
  padding: 18px 14px;
  font-size: 0.78rem;
  color: var(--th-text-faint, #64748b);
  text-align: center;
  line-height: 1.5;
}
`;

let _stylesInjected = false;
function ensureStyles() {
  if (_stylesInjected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.setAttribute('data-gs', '1');
  el.textContent = STYLES;
  document.head.appendChild(el);
  _stylesInjected = true;
}

// ── Search icon SVG ──────────────────────────────────────────────────────────
const SearchIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <line x1="16.5" y1="16.5" x2="21" y2="21" />
  </svg>
);

const CloseIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ── Component ────────────────────────────────────────────────────────────────
export default function GlobalSearch({ shopId, onNavigate, collapsed }) {
  ensureStyles();

  const [query, setQuery]               = useState('');
  const [featureResults, setFeatureResults] = useState([]);
  const [dataResults, setDataResults]   = useState({});
  const [loading, setLoading]           = useState(false);
  const [isNlq, setIsNlq]               = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [overlayOpen, setOverlayOpen]   = useState(false);
  const [focusedIdx, setFocusedIdx]     = useState(-1);

  const wrapRef         = useRef(null);
  const inputRef        = useRef(null);
  const overlayInputRef = useRef(null);
  const abortRef        = useRef(null);
  const debounceRef     = useRef(null);

  // Flat list of all result rows for keyboard navigation
  const allRows = useMemo(() => {
    const rows = [];
    featureResults.forEach((r) => rows.push({ ...r, _tier: 'feature' }));
    Object.values(dataResults).forEach((items) =>
      items.forEach((r) => rows.push({ ...r, _tier: 'data' }))
    );
    return rows;
  }, [featureResults, dataResults]);

  // Close dropdown when clicking outside (expanded mode only)
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  // Global Escape key — close dropdown or overlay
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        setOverlayOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Core API fetch — called after debounce
  const doFetch = useCallback(async (q, sid) => {
    if (!q || q.length < 2 || !sid) {
      setDataResults({});
      setLoading(false);
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/search/global/${encodeURIComponent(sid)}?q=${encodeURIComponent(q)}`,
        { signal: abortRef.current.signal }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setDataResults(json.results || {});
      setIsNlq(Boolean(json.nlq));
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[GlobalSearch] fetch error:', err.message);
        setDataResults({});
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle query change — Tier 1 instant + Tier 2/3 debounced
  const handleQueryChange = useCallback((value) => {
    setQuery(value);
    setFocusedIdx(-1);

    // Tier 1: instant feature/navigation results
    const fRes = value.length >= 2 ? searchFeatures(value) : [];
    setFeatureResults(fRes);

    if (value.length >= 2) {
      setDropdownOpen(true);
    } else {
      setDropdownOpen(false);
      setDataResults({});
      setLoading(false);
    }

    // Tier 2/3: debounced API call
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length >= 2) {
      debounceRef.current = setTimeout(() => doFetch(value, shopId), 300);
    } else {
      setDataResults({});
      setLoading(false);
    }
  }, [doFetch, shopId]);

  // Navigate to result and store prefill for destination page
  const handleSelect = useCallback((result) => {
    const targetPage = result.page;
    if (!targetPage) return;

    // Store prefill so the destination page can auto-fill its search bar
    try {
      sessionStorage.setItem('th-search-prefill', JSON.stringify({
        page: targetPage,
        q: result.label || '',
      }));
    } catch (_) { /* ignore sessionStorage errors */ }

    onNavigate(targetPage);
    localStorage.setItem('th-page', targetPage);

    // Reset state
    setQuery('');
    setDropdownOpen(false);
    setOverlayOpen(false);
    setFeatureResults([]);
    setDataResults({});
    setFocusedIdx(-1);
  }, [onNavigate]);

  // Keyboard navigation inside search results
  const handleKeyDown = useCallback((e) => {
    if (!dropdownOpen && !overlayOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIdx((i) => Math.min(i + 1, allRows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && focusedIdx >= 0 && allRows[focusedIdx]) {
      e.preventDefault();
      handleSelect(allRows[focusedIdx]);
    }
  }, [dropdownOpen, overlayOpen, allRows, focusedIdx, handleSelect]);

  const hasResults = featureResults.length > 0 || Object.keys(dataResults).length > 0;
  const hasMinQuery = query.length >= 2;

  // ── Shared result list renderer (used in both inline + overlay) ──────────
  const renderResultList = () => {
    const sections = [];
    let rowIdx = 0;

    // Feature/navigation results
    if (featureResults.length > 0) {
      sections.push(
        <div key="_features">
          <div className="gs-section-header">Features &amp; Navigation</div>
          {featureResults.map((item) => {
            const idx = rowIdx++;
            return (
              <button
                key={`f-${item.page}-${item.label}`}
                className={`gs-result-btn${focusedIdx === idx ? ' gs-focused' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
                onMouseEnter={() => setFocusedIdx(idx)}
                type="button"
              >
                <span className="gs-result-label">
                  <span className="gs-badge">{item.category}</span>
                  {item.label}
                </span>
                <span className="gs-result-detail">{item.description}</span>
              </button>
            );
          })}
          {Object.keys(dataResults).length > 0 && <div className="gs-divider" />}
        </div>
      );
    }

    // NLQ hint badge
    if (isNlq && Object.keys(dataResults).length > 0) {
      sections.push(
        <div key="_nlq" className="gs-nlq-hint">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Smart filter applied
        </div>
      );
    }

    // Data results grouped by category
    Object.entries(dataResults).forEach(([category, items]) => {
      sections.push(
        <div key={`cat-${category}`}>
          <div className="gs-section-header">{category}</div>
          {items.map((item) => {
            const idx = rowIdx++;
            return (
              <button
                key={item.id || `${category}-${idx}`}
                className={`gs-result-btn${focusedIdx === idx ? ' gs-focused' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
                onMouseEnter={() => setFocusedIdx(idx)}
                type="button"
              >
                <span className="gs-result-label">{item.label}</span>
                {item.detail && (
                  <span className="gs-result-detail">{item.detail}</span>
                )}
              </button>
            );
          })}
        </div>
      );
    });

    // Loading indicator
    if (loading) {
      sections.push(
        <div key="_loading" className="gs-loading-row">
          <div className="gs-spinner" />
          Searching database…
        </div>
      );
    }

    // Empty state
    if (!loading && hasMinQuery && !hasResults) {
      sections.push(
        <div key="_empty" className="gs-empty-msg">
          No results for &ldquo;{query}&rdquo;
        </div>
      );
    }

    return sections;
  };

  // ── Collapsed: icon button + floating overlay ────────────────────────────
  if (collapsed) {
    return (
      <>
        <button
          className="gs-icon-btn"
          title="Global Search (Ctrl+/)"
          type="button"
          onClick={() => {
            setOverlayOpen(true);
            // Focus overlay input after mount
            requestAnimationFrame(() => overlayInputRef.current?.focus());
          }}
        >
          <SearchIcon size={17} />
        </button>

        {overlayOpen && (
          <div
            className="gs-overlay-backdrop"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setOverlayOpen(false);
                setQuery('');
                setFeatureResults([]);
                setDataResults({});
              }
            }}
          >
            <div
              className="gs-overlay-modal"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Input row */}
              <div className="gs-overlay-top">
                <span style={{ color: 'var(--th-text-dim)', display: 'flex' }}>
                  <SearchIcon size={17} />
                </span>
                <input
                  ref={overlayInputRef}
                  className="gs-overlay-input"
                  placeholder="Search products, customers, staff, sales, features…"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                  spellCheck={false}
                />
                {query && (
                  <button
                    className="gs-clear-btn"
                    style={{ position: 'static', transform: 'none' }}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleQueryChange('');
                      overlayInputRef.current?.focus();
                    }}
                    title="Clear"
                  >
                    <CloseIcon />
                  </button>
                )}
              </div>

              {/* Results body */}
              <div className="gs-overlay-body">
                {!hasMinQuery && (
                  <div className="gs-overlay-hint">
                    Search items, customers, staff, orders, expenses…
                    <br />
                    <span style={{ fontSize: '0.7rem', opacity: 0.65 }}>
                      Try "overdue", "unpaid", "this month", or any name / SKU
                    </span>
                  </div>
                )}
                {hasMinQuery && renderResultList()}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Expanded: inline search bar with dropdown ────────────────────────────
  return (
    <div className="gs-wrap" ref={wrapRef}>
      <div className="gs-input-row">
        <span className="gs-search-icon">
          <SearchIcon size={13} />
        </span>

        <input
          ref={inputRef}
          className="gs-input"
          placeholder="Search system…"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (hasMinQuery) setDropdownOpen(true); }}
          autoComplete="off"
          spellCheck={false}
        />

        {query && (
          <button
            className="gs-clear-btn"
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              handleQueryChange('');
              inputRef.current?.focus();
            }}
            title="Clear"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Dropdown — only shown when open and has something to display */}
      {dropdownOpen && (hasResults || loading || (hasMinQuery && !loading && !hasResults)) && (
        <div className="gs-dropdown">
          {renderResultList()}
        </div>
      )}
    </div>
  );
}
