# CoreTrack Design System Rules

This document outlines the design system rules and tokens for the CoreTrack application to ensure consistency between Figma and code.

## 1. Design Tokens

### Colors (Dark Mode - Default)
- **Page Background:** `#111720` (`--th-bg-page`)
- **Card Background:** `#1a2132` (`--th-bg-card`)
- **Input Background:** `#283245` (`--th-bg-input`)
- **Border (Subtle):** `#263040` (`--th-border`)
- **Border (Strong):** `#3d5068` (`--th-border-strong`)
- **Text (Primary):** `#f1f5f9` (`--th-text-primary`)
- **Primary Accent (Orange):** `#c97c50` (`--th-orange`)
- **Sky:** `#38bdf8` (`--th-sky`)
- **Emerald:** `#34d399` (`--th-emerald`)
- **Rose:** `#fb7185` (`--th-rose`)

### Colors (Light Mode)
- **Page Background:** `#f0f4f8`
- **Card Background:** `#ffffff`
- **Text (Primary):** `#1e293b`
- **Primary Accent (Orange):** `#ea580c`

### Typography
- **Body Font:** `Inter`, system-ui, sans-serif
- **Display Font:** `Barlow Condensed`, system-ui, sans-serif (used for titles, KPIs, and badges)
- **Mono Font:** `JetBrains Mono` (used for data/numeric values)

### Spacing & Layout
- **Sidebar Width:** `220px` (Expanded), `52px` (Collapsed)
- **Border Radius:** `7px` (Inputs/Buttons), `10px` (Tables), `12px` (Panels)
- **Gap:** `0.9rem` (Page sections)

## 2. Component Architecture

### App Shell
- **Sidebar:** Fixed left, contains navigation and shop selector.
- **Main:** Scrollable area for page content.

### UI Components (`src/components/`)
- `KpiCard`: Display metrics with an accent left border.
- `DataTable`: Standard table with `Barlow Condensed` headers.
- `FilterHeader`: Shared row for date filters and search.
- `Modal`: Global portal-based overlays.

## 3. Styling Methodology
- **Tailwind CSS 4:** Used for utility classes.
- **CSS Variables:** Custom properties defined in `ThemeProvider.jsx` and `index.css` handle theme switching.
- **Vanilla CSS:** Custom styles for complex components (e.g., the sidebar glow and OLED glass effect).

## 4. Figma Integration
- **Figma File:** [CoreTrack Prototype](https://www.figma.com/design/ac5hy2iu02QEN6lCnhUs7A)
- **Code Connect:** Use `mcp_figma_add_code_connect_map` to link components.
