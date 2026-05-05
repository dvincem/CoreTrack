# Gemini CLI - Project Customizations

This file provides project-specific context and instructions for the Gemini CLI agent to ensure consistent and idiomatic development within the `tire-shop-management` codebase.

## CRITICAL: Production Environment
- **Live Data:** This system is currently used for **real day-to-day shop transactions**. 
- **Database Safety:** Extreme caution is required for any database schema modifications (`Database.js`). Schema changes must be non-breaking and thoroughly validated to prevent data loss or system downtime.
- **Backups:** Rely on the automated 30-minute Excel-based snapshots for recovery.

## Technical Stack
- **Frontend:** React 19, Vite 8, Recharts.
- **Backend:** Node.js, Express.
- **Database:** SQLite 3 (database file: `tire_shop.db`).
- **Styling:** Tailwind CSS 4.
- **Package Manager:** NPM.

## Architectural Patterns

### Backend & Database
- **Entry Point:** `Server.js` is the main Express application.
- **Database Access:** 
  - Use promisified helpers in `lib/db.js` (`dbAll`, `dbGet`, `dbRun`, `dbSerialize`) for all database operations.
  - Avoid using the raw `sqlite3` API directly in route handlers.
  - Database schema and initialization logic are located in `Database.js`.
- **Reporting Logic:** `lib/reporting.js` manages complex aggregations. Recent updates include a "Cash Pool" breakdown that distinguishes between sales-driven cash and manual ledger adjustments.

### Frontend
- **Structure:**
  - Components are in `src/components/`.
  - Pages are in `src/pages/`.
  - Configuration (like KPI settings) is in `src/lib/`.
- **Modals:** Use `ReactDOM.createPortal` for all global-style modals (e.g., in `CashLedgerPage.jsx`) to ensure they render above all other elements without layout interference.
- **State Management:** Local React state and hooks are preferred.
- **Visualization:** Use `recharts` for dashboards and reports.

## Development Workflow
- **Start Development:** Use `npm run dev` to start both the backend (via nodemon) and frontend (via Vite) concurrently.
- **Database Changes:** 
  - Manual schema changes should be reflected in `Database.js`'s `initializeDatabase` function if they are part of the base setup.
  - For data migrations or seeds, check `generate_seed.js` or `scripts/`.
- **Excel Integration:** The project uses the `xlsx` library for importing/exporting data. Refer to `import_xlsx.js` for examples.

## Code Style & Conventions
- **Language:** JavaScript (ES6+).
- **Naming:** CamelCase for variables/functions, PascalCase for React components.
- **Surgical Edits:** When modifying routes or components, maintain existing patterns (e.g., keeping route definitions in `Server.js` and implementations in `routes/`).
- **Safety:** Never expose `tire_shop.db` or `.env` contents in logs or commits.

## Validation
- After backend changes, ensure the server starts without errors: `npm run dev:api`.
- After frontend changes, verify the build: `npm run build`.
- Always check that API endpoints match the expected `/api` prefix and are protected by `authMiddleware` where appropriate.

## System Feature Index (v2.2)

### Core Business Logic
- **Inventory Management:** `routes/items.js`, `src/pages/InventoryPage.jsx`. Handles stock levels, reorder points, and DOT tracking.
- **Point of Sale (POS):** `routes/sales.js`, `src/pages/POSPage.jsx`. Hybrid cart supporting both products and services with **real-time draft persistence**. Header dynamically displays the shop name.
- **Customer Directory:** `routes/customers.js`, `src/pages/CustomerPage.jsx`. CRM with purchase history and vehicle plate tracking.
- **Supplier Relations:** `routes/suppliers.js`, `src/pages/SuppliersPage.jsx`. Vendor management and stock source tracking.
- **Order Management:** `routes/orders.js`, `src/pages/OrdersPage.jsx`. Full CRUD for purchase orders including **order editing** and status tracking.

### Specialty Operations
- **Recap/Retreading:** `routes/recap.js`, `src/pages/RecapPage.jsx`. Full lifecycle tracking for customer-owned and shop-owned casing jobs.
- **Staff & Payroll:** `routes/staff.js`, `src/pages/StaffPage.jsx`, `src/pages/PayrollPage.jsx`. Role-based access, attendance tracking, and commission calculations.
- **Accounts Receivable/Payable:** `routes/financials.js`, `src/pages/ReceivablesPage.jsx`, `src/pages/PayablesPage.jsx`. Debt and credit tracking for clients and suppliers.
- **Cash Ledger:** `routes/cashledger.js`, `src/pages/CashLedgerPage.jsx`. Real-time tracking of physical cash flow with **automatic draft saving**.

### Intelligence & Reliability
- **Profits & Margins:** `routes/financials.js`, `src/pages/ProfitsPage.jsx`. Deep analysis of revenue, COGS, expenses, and net position.
- **Performance Engine:** Server-side pagination and optimized queries (JOINs instead of correlated subqueries) for large datasets.
- **Auto-Backup Engine:** `routes/backup.js`, `server.js`. 30-minute automated Excel-based snapshots of all database tables.
- **Advanced Reporting:** `src/pages/Reportspage.jsx`. Interactive daily activity reports with **Cash Pool breakdown** and improved transaction accuracy.
- **Theme Engine:** Fully reactive OLED Midnight Glass interface supporting dynamic Dark/Light mode transitions.

### Legacy / Removed Features
- **TireHub AI Assistant:** (v2.1) Removed Local Llama 3.2 engine integration to reduce dependency bloat.
- **Financial Health Page:** (v2.1) Consolidated into the more comprehensive Profits & Margins dashboard.
- **Sales Ledger Table:** (v2.1) Audited and marked as dead/deprecated in favor of unified Sale Header/Items structure.
