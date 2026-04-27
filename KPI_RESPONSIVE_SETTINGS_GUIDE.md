# Universal KPI Responsive Settings Guide

## Overview
A standardized, universal KPI system used across all pages for consistent styling, responsiveness, and behavior.

## Files
- **`src/components/KpiCard.jsx`** - Reusable KPI card component
- **`src/lib/kpiConfig.js`** - Configuration, breakpoints, and helper functions

---

## Usage

### Basic Implementation

```jsx
import KpiCard from '../components/KpiCard'

function MyPage() {
  return (
    <div className="th-kpi-grid">
      <KpiCard 
        label="Total Sales" 
        value="₱1,000,000" 
        accent="orange"
        icon={<SalesIcon />}
        sub="Last 30 days"
      />
      <KpiCard 
        label="Transactions" 
        value="426" 
        accent="sky"
        loading={false}
      />
    </div>
  )
}
```

### Using Responsive Hook

```jsx
import KpiCard from '../components/KpiCard'
import { useResponsiveKPI } from '../lib/kpiConfig'

function MyPage() {
  const { columns, gap, isMobile } = useResponsiveKPI()

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: columns,
      gap: gap,
    }}>
      {/* Your KPI cards */}
    </div>
  )
}
```

---

## KpiCard Component Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `label` | string | ✓ | — | KPI title (e.g., "Total Sales") |
| `value` | string/number | ✓ | — | Main value to display |
| `accent` | string | ✗ | 'sky' | Color accent: 'orange', 'sky', 'emerald', 'violet', 'amber', 'rose' |
| `icon` | JSX | ✗ | undefined | Optional icon/SVG element |
| `sub` | string | ✗ | undefined | Optional subtitle/secondary text |
| `loading` | boolean | ✗ | false | Show skeleton loading state |

---

## Configuration Details

### Grid Breakpoints
```javascript
breakpoints: {
  MOBILE: 480,        // Extra small screens
  TABLET: 768,        // Tablets (768-1024px)
  DESKTOP_SM: 860,
  DESKTOP_MD: 1024,   // Desktop threshold
  DESKTOP_LG: 1400,
}
```

### Responsive Columns
- **Mobile** (`≤ 768px`): 2 columns
- **Tablet** (`768px - 1024px`): 2 columns
- **Desktop** (`> 1024px`): Auto-fit (3-4 columns based on space)

### Responsive Sizing (Using CSS `clamp()`)
All text sizes scale fluidly:
```css
Label:   clamp(0.55rem, 0.48rem + 0.3vw, 0.72rem)
Value:   clamp(1.15rem, 0.85rem + 1vw, 1.85rem)
Padding: clamp(0.55rem, 0.4rem + 0.6vw, 1rem)
```

This ensures perfect scaling from mobile to ultra-wide screens without media queries.

---

## Color Accents

### Available Accent Colors
- **orange** - High priority/Primary action
- **sky** - Secondary info/Achievement
- **emerald** - Success/Growth positive
- **violet** - Analytics/Special metrics
- **amber** - Warnings/Caution
- **rose** - Critical/Negative metrics

### Customization
Each accent applies:
1. Left border color indicator (3px bar)
2. Subtle gradient background
3. Responsive hover elevation

---

## Helper Functions

### `getResponsiveColumns(width)`
Returns grid template columns based on viewport width.

```javascript
import { getResponsiveColumns } from '../lib/kpiConfig'

const columns = getResponsiveColumns(window.innerWidth)
// Returns: "repeat(2, 1fr)" on mobile, "repeat(auto-fit, minmax(150px, 1fr))" on desktop
```

### `getResponsiveGap(width)`
Returns appropriate gap size based on viewport width.

```javascript
import { getResponsiveGap } from '../lib/kpiConfig'

const gap = getResponsiveGap(window.innerWidth)
// Returns: "0.55rem" on mobile, "0.75rem" on desktop
```

### `useResponsiveKPI()`
React hook for responsive KPI values.

```javascript
const { 
  columns,      // Grid template columns
  gap,          // Gap between cards
  width,        // Current viewport width
  isMobile,     // boolean: width ≤ 768px
  isTablet,     // boolean: 768px < width ≤ 1024px
  isDesktop,    // boolean: width > 1024px
} = useResponsiveKPI()
```

---

## CSS Classes

### Main Classes
- **`.th-kpi-grid`** - Container for KPI cards (uses grid layout)
- **`.th-kpi`** - Individual KPI card
- **`.th-kpi-label`** - Label text styling
- **`.th-kpi-value`** - Main value text styling
- **`.th-kpi-sub`** - Subtitle/secondary text styling
- **`.th-kpi-icon`** - Icon container styling

### Accent Classes
- **`.accent-orange`**, `.accent-sky`, `.accent-emerald`, `.accent-violet`, `.accent-amber`, `.accent-rose`

---

## Implementation Examples

### Example 1: Dashboard Page (Already Implemented)
```jsx
import KpiCard from '../components/KpiCard'

<div className="th-kpi-grid">
  <KpiCard label="Today's Sales" value={fmt(data.today_sales)} accent="orange" icon={...} />
  <KpiCard label="Transactions" value={data.today_transactions} accent="sky" />
  <KpiCard label="Customers" value={data.total_customers} accent="emerald" />
</div>
```

### Example 2: Custom Page with Hook
```jsx
import KpiCard from '../components/KpiCard'
import { useResponsiveKPI } from '../lib/kpiConfig'

function SalesPage() {
  const { columns, gap } = useResponsiveKPI()
  const [stats, setStats] = React.useState(null)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: columns, gap }}>
      <KpiCard 
        label="Monthly Sales" 
        value="₱2.5M" 
        accent="emerald"
        sub="↑ 12% vs last month"
      />
      <KpiCard 
        label="Pending Orders" 
        value="23" 
        accent="amber"
      />
    </div>
  )
}
```

---

## Migration Guide for Existing Pages

### Before (Old Pattern)
```jsx
function MyCard({ label, value }) {
  return (
    <div className={`my-kpi accent-${accent}`}>
      <div>{label}</div>
      <div>{value}</div>
    </div>
  )
}
```

### After (New Pattern)
```jsx
import KpiCard from '../components/KpiCard'

// Just use the shared component directly
<div className="th-kpi-grid">
  <KpiCard label={label} value={value} accent={accent} />
</div>
```

---

## Best Practices

## ✅ DO:
- Use `KpiCard` component for all KPI displays
- Use `.th-kpi-grid` class for KPI containers
- Apply appropriate accent color for context
- Use semantic labels that explain the metric
- Format values (currency, percentages, etc.) before passing
- Use loading state for async data

## ❌ DON'T:
- Create custom KPI card components
- Override `.th-kpi` styles inline
- Mix KPI styles with page-specific styles
- Use hardcoded breakpoints instead of config
- Skip the `accent` prop (defaults to sky)

---

## Customization

### Override Gap for Specific Section
```jsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
  {/* Custom gap: 1rem instead of default 0.75rem */}
</div>
```

### Custom Colors (Extend in CSS)
```css
.th-kpi.accent-custom::before {
  background: var(--my-custom-color);
}
.th-kpi.accent-custom {
  background: linear-gradient(135deg, var(--th-bg-card) 55%, rgba(...custom color...));
}
```

---

## Browser Support
- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ iOS Safari 14+
- **Uses:** CSS Grid, CSS Custom Properties, clamp()

---

## Performance Notes
- KPI cards use CSS Grid (hardware accelerated)
- `useResponsiveKPI()` debounces resize events
- No unnecessary re-renders with proper memoization
- Lightweight: ~2KB minified (config + component)

---

## Support & Questions
For integration questions or issues, refer to:
- Dashboard page implementation (reference)
- DashboardPage.jsx - existing working example
- This guide for configuration details
