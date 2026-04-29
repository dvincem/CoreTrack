import React from 'react'

/* ============================================================
   TIREHUB — THEME PROVIDER
   Injects CSS custom properties for dark/light mode.
   Wrap your app root with <ThemeProvider> and use
   <ThemeToggle /> anywhere to switch modes.

   Usage:
     <ThemeProvider>
       <ThemeToggle />
       <DashboardPage shopId={shopId} />
       <POSPage shopId={shopId} onRefresh={...} />
       <InventoryPage shopId={shopId} onRefresh={...} />
     </ThemeProvider>

   Or standalone toggle (reads/writes window.__thTheme):
     <ThemeToggle />
   ============================================================ */

const THEME_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;900&family=Inter:wght@400;500;600;700&display=swap');

  /* ═══════════════════════════════════════════
     DARK MODE TOKENS  (default)
  ═══════════════════════════════════════════ */
  [data-theme="dark"], :root {
    /* Backgrounds */
    --th-bg-page:      #111720;
    --th-bg-card:      #1a2132;
    --th-bg-card-alt:  #222d3e;
    --th-bg-input:     #283245;
    --th-bg-header:    #0f151e;
    --th-bg-hover:     rgba(248,250,252,0.04);
    --th-bg-selected:  rgba(249,115,22,0.08);

    /* Borders */
    --th-border:       #263040;
    --th-border-mid:   #2e3d52;
    --th-border-strong:#3d5068;

    /* Text */
    --th-text-primary: #f1f5f9;
    --th-text-heading: #f8fafc;
    --th-text-body:    #dde4ed;
    --th-text-muted:   #a8bccf;
    --th-text-dim:     #8fa3b8;
    --th-text-faint:   #5a7080;

    /* Accents — kept vivid on dark */
    --th-orange:       #c97c50;
    --th-orange-bg:    rgba(201,124,80,0.12);
    --th-orange-glow:  rgba(201,124,80,0.25);
    --th-sky:          #38bdf8;
    --th-sky-bg:       rgba(56,189,248,0.12);
    --th-emerald:      #34d399;
    --th-emerald-bg:   rgba(52,211,153,0.12);
    --th-violet:       #a78bfa;
    --th-violet-bg:    rgba(167,139,250,0.12);
    --th-rose:         #fb7185;
    --th-rose-bg:      rgba(251,113,133,0.12);
    --th-amber:        #fbbf24;
    --th-amber-bg:     rgba(251,191,36,0.12);

    /* Table row stripe */
    --th-row-stripe:   rgba(255,255,255,0.015);

    /* Skeleton shimmer */
    --th-shimmer-a:    #1e293b;
    --th-shimmer-b:    #273449;

    /* Shadows */
    --th-shadow-card:  0 4px 20px rgba(0,0,0,0.4);
    --th-shadow-modal: 0 8px 40px rgba(0,0,0,0.6);
    --th-shadow-toast: 0 8px 28px rgba(0,0,0,0.6);

    /* Toggle button */
    --th-toggle-bg:    #1e293b;
    --th-toggle-border:#334155;
    --th-toggle-icon:  #a8bccf;
  }

  /* ═══════════════════════════════════════════
     LIGHT MODE TOKENS
  ═══════════════════════════════════════════ */
  [data-theme="light"] {
    /* Backgrounds */
    --th-bg-page:      #f0f4f8;
    --th-bg-card:      #ffffff;
    --th-bg-card-alt:  #f8fafc;
    --th-bg-input:     #f1f5f9;
    --th-bg-header:    #f8fafc;
    --th-bg-hover:     rgba(15,23,42,0.03);
    --th-bg-selected:  rgba(249,115,22,0.06);

    /* Borders */
    --th-border:       #e2e8f0;
    --th-border-mid:   #cbd5e1;
    --th-border-strong:#94a3b8;

    /* Text */
    --th-text-primary: #1e293b;
    --th-text-heading: #0f172a;
    --th-text-body:    #334155;
    --th-text-muted:   #475569;
    --th-text-dim:     #64748b;
    --th-text-faint:   #94a3b8;

    /* Accents — slightly deeper for contrast on white */
    --th-orange:       #ea580c;
    --th-orange-bg:    rgba(234,88,12,0.09);
    --th-orange-glow:  rgba(234,88,12,0.25);
    --th-sky:          #0284c7;
    --th-sky-bg:       rgba(2,132,199,0.09);
    --th-emerald:      #059669;
    --th-emerald-bg:   rgba(5,150,105,0.09);
    --th-violet:       #7c3aed;
    --th-violet-bg:    rgba(124,58,237,0.09);
    --th-rose:         #e11d48;
    --th-rose-bg:      rgba(225,29,72,0.09);
    --th-amber:        #d97706;
    --th-amber-bg:     rgba(217,119,6,0.09);

    /* Table row stripe */
    --th-row-stripe:   rgba(15,23,42,0.018);

    /* Skeleton shimmer */
    --th-shimmer-a:    #e2e8f0;
    --th-shimmer-b:    #f1f5f9;

    /* Shadows */
    --th-shadow-card:  0 2px 12px rgba(15,23,42,0.08);
    --th-shadow-modal: 0 8px 40px rgba(15,23,42,0.18);
    --th-shadow-toast: 0 8px 28px rgba(15,23,42,0.15);

    /* Toggle button */
    --th-toggle-bg:    #ffffff;
    --th-toggle-border:#cbd5e1;
    --th-toggle-icon:  #475569;
  }

  /* ── Theme transition (smooth swap) ── */
  *, *::before, *::after {
    transition: background-color 0.25s ease, border-color 0.2s ease, color 0.2s ease;
  }
  /* But not animations/transforms */
  *[class*="spin"], *[class*="shimmer"], *[class*="pulse"],
  *[class*="slide"], *[class*="fade"], *[class*="toast"] {
    transition: none !important;
  }

  /* ── Toggle button ── */
  .th-theme-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    width: 100%;
    padding: 0.55rem 0.85rem;
    background: var(--th-bg-input);
    border: 1px solid var(--th-border-strong);
    border-radius: 8px;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--th-text-muted);
    transition: border-color 0.2s, color 0.2s, background 0.2s;
    user-select: none;
    white-space: nowrap;
  }
  .th-theme-toggle:hover {
    border-color: var(--th-orange);
    color: var(--th-orange);
    background: var(--th-orange-bg);
  }
  .th-theme-toggle svg { flex-shrink: 0; }
`;

/* ── Inject theme styles once ── */
function injectThemeStyle() {
  if (document.getElementById("th-theme-tokens")) return;
  const s = document.createElement("style");
  s.id = "th-theme-tokens";
  s.textContent = THEME_STYLE;
  document.head.appendChild(s);
}

// Inject immediately at module load
injectThemeStyle();

/* ── ThemeProvider ── */
function ThemeProvider({ children, defaultTheme = "light" }) {
  const [theme, setTheme] = React.useState(() => {
    try {
      return localStorage.getItem("th-theme") || defaultTheme;
    } catch {
      return defaultTheme;
    }
  });

  React.useEffect(() => {
    injectThemeStyle();
  }, []);

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("th-theme", theme);
    } catch {}
    window.__thTheme = theme;
    window.__thSetTheme = setTheme;
  }, [theme]);

  return (
    <div style={{ minHeight: "100%", background: "var(--th-bg-page)" }}>
      {children}
    </div>
  );
}

/* ── Standalone ThemeToggle ── */
function ThemeToggle({ collapsed = false, asMenuItem = false }) {
  const [theme, setTheme] = React.useState(() => {
    try {
      return localStorage.getItem("th-theme") || "light";
    } catch {
      return "light";
    }
  });

  React.useEffect(() => {
    injectThemeStyle();
    // Sync with ThemeProvider if present
    const sync = () => {
      if (window.__thTheme && window.__thTheme !== theme) {
        setTheme(window.__thTheme);
      }
    };
    const id = setInterval(sync, 200);
    return () => clearInterval(id);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    if (window.__thSetTheme) window.__thSetTheme(next);
    try {
      localStorage.setItem("th-theme", next);
    } catch {}
    window.__thTheme = next;
  }

  const isDark = theme === "dark";

  const sunIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
  const moonIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ flexShrink: 0 }}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );

  if (asMenuItem) {
    return (
      <button className="th-settings-popover-item" onClick={toggle} title={`Switch to ${isDark ? "light" : "dark"} mode`}>
        {isDark ? sunIcon : moonIcon}
        {isDark ? "Light Mode" : "Dark Mode"}
      </button>
    );
  }

  return (
    <button
      className="th-theme-toggle"
      onClick={toggle}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      style={collapsed ? { padding: "0.55rem 0", justifyContent: "center" } : undefined}
    >
      {isDark ? <>{sunIcon}{!collapsed && "Light Mode"}</> : <>{moonIcon}{!collapsed && "Dark Mode"}</>}
    </button>
  );
}

export { ThemeProvider, ThemeToggle }
