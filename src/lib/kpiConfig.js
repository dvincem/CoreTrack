/**
 * Universal KPI Responsive Settings & Configuration
 * Standardized across all pages for consistent look & feel
 */

export const KPI_CONFIG = {
  // Grid layout configuration
  grid: {
    // Default grid classes for layout
    containerClass: 'th-kpi-grid',
    
    // Responsive columns: auto-fit with 150px minimum width
    // This means: 1 col on mobile, 2 cols on tablet, 3-4 on desktop
    columns: 'repeat(auto-fit, minmax(150px, 1fr))',
    
    // Gap between KPI cards
    gap: '0.75rem',
    
    // Responsive gap for different breakpoints
    gaps: {
      desktop: '0.75rem',    // > 1024px
      tablet: '0.65rem',     // 768px - 1024px
      mobile: '0.55rem',     // <= 768px
    },
  },

  // Breakpoints for responsive design
  breakpoints: {
    MOBILE: 480,    // Extra small screens
    TABLET: 768,    // Tablets and small laptops
    DESKTOP_SM: 860,
    DESKTOP_MD: 1024,
    DESKTOP_LG: 1400,
  },

  // Grid column configurations for different breakpoints
  columnConfig: {
    desktop: 'repeat(auto-fit, minmax(150px, 1fr))',  // 1024px+: 3-4 columns
    tablet: 'repeat(2, 1fr)',                          // 768px-1024px: 2 columns
    mobile: 'repeat(2, 1fr)',                          // <768px: 2 columns
  },

  // Card styling (padding uses clamp for fluid scaling)
  card: {
    padding: 'clamp(0.55rem, 0.4rem + 0.6vw, 1rem) clamp(0.6rem, 0.45rem + 0.65vw, 1.15rem)',
    borderRadius: '10px',
    border: '1px solid var(--th-border)',
  },

  // Typography (all use clamp for responsive scaling)
  typography: {
    label: {
      fontSize: 'clamp(0.55rem, 0.48rem + 0.3vw, 0.72rem)',
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    },
    value: {
      fontSize: 'clamp(1.15rem, 0.85rem + 1vw, 1.85rem)',
      fontWeight: 700,
    },
    sub: {
      fontSize: 'clamp(0.55rem, 0.48rem + 0.3vw, 0.72rem)',
      fontWeight: 500,
      color: 'var(--th-text-muted, var(--th-text-dim))',
    },
    icon: {
      fontSize: '1.4rem',
    },
  },

  // Accent color scheme (matches Dashboard)
  accents: {
    orange: { 
      borderColor: 'var(--th-orange)',
      bgGradient: 'linear-gradient(135deg, var(--th-bg-card) 55%, rgba(249,115,22,0.07))',
    },
    sky: { 
      borderColor: 'var(--th-sky)',
      bgGradient: 'linear-gradient(135deg, var(--th-bg-card) 55%, rgba(56,189,248,0.07))',
    },
    emerald: { 
      borderColor: 'var(--th-emerald)',
      bgGradient: 'linear-gradient(135deg, var(--th-bg-card) 55%, rgba(52,211,153,0.07))',
    },
    violet: { 
      borderColor: 'var(--th-violet)',
      bgGradient: 'linear-gradient(135deg, var(--th-bg-card) 55%, rgba(167,139,250,0.07))',
    },
    amber: { 
      borderColor: 'var(--th-amber)',
      bgGradient: 'linear-gradient(135deg, var(--th-bg-card) 55%, rgba(251,191,36,0.07))',
    },
    rose: { 
      borderColor: 'var(--th-rose)',
      bgGradient: 'linear-gradient(135deg, var(--th-bg-card) 55%, rgba(251,113,133,0.07))',
    },
  },

  // Animation/transition settings
  animation: {
    hoverTransform: 'translateY(-1px)',
    transitionDuration: '0.18s ease',
  },
};

/**
 * Helper function to get responsive grid columns based on viewport width
 * @param {number} width - Current viewport width
 * @returns {string} - Grid template columns CSS value
 */
export function getResponsiveColumns(width) {
  if (width <= KPI_CONFIG.breakpoints.TABLET) {
    return KPI_CONFIG.columnConfig.mobile;
  } else if (width <= KPI_CONFIG.breakpoints.DESKTOP_MD) {
    return KPI_CONFIG.columnConfig.tablet;
  }
  return KPI_CONFIG.columnConfig.desktop;
}

/**
 * Helper function to get responsive gap based on viewport width
 * @param {number} width - Current viewport width
 * @returns {string} - Gap CSS value
 */
export function getResponsiveGap(width) {
  if (width <= KPI_CONFIG.breakpoints.TABLET) {
    return KPI_CONFIG.grid.gaps.mobile;
  } else if (width <= KPI_CONFIG.breakpoints.DESKTOP_MD) {
    return KPI_CONFIG.grid.gaps.tablet;
  }
  return KPI_CONFIG.grid.gaps.desktop;
}

/**
 * Hook to use KPI responsive settings with window resize listener
 * @returns {object} - { columns, gap, appliedAt }
 */
export function useResponsiveKPI() {
  const [width, setWidth] = React.useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  React.useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    columns: getResponsiveColumns(width),
    gap: getResponsiveGap(width),
    width,
    isMobile: width <= KPI_CONFIG.breakpoints.TABLET,
    isTablet: width > KPI_CONFIG.breakpoints.TABLET && width <= KPI_CONFIG.breakpoints.DESKTOP_MD,
    isDesktop: width > KPI_CONFIG.breakpoints.DESKTOP_MD,
  };
}

export default KPI_CONFIG;
