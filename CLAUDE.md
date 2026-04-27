# TireHub Project Guide

## Overview
TireHub is a management system for tire shops, covering inventory, POS, financials, and specialized recap workflows.

## Getting Started
1. **Environment**: Copy `.env.example` to `.env` and configure variables.
2. **Database**: The database is SQLite (`tire_shop.db`). It initializes automatically on server start.
3. **Seeding**: Use `node generate_seed.js` followed by `node import_xlsx.js` to seed the database with test data.
4. **Development**:
   - `npm run dev`: Starts both backend and frontend.
   - `npm run dev:api`: Starts only the backend.
   - `npm run dev:ui`: Starts only the frontend.

## Reference Documentation
- [Architecture](./ref/architecture.md)
- [Database Schema](./ref/database_schema.md)

## Tech Stack
- **Frontend**: React 19, Vite, Tailwind CSS, Recharts.
- **Backend**: Node.js, Express, SQLite3.
- **Tools**: Excel (XLSX) for data import/export.

## Pagination Migration Status

`usePaginatedResource` hook (`src/hooks/usePaginatedResource.js`) — debounced server-side fetch, 300ms, AbortController, parses both `{ data, meta }` and plain-array responses.

### ✅ Migrated — server-side pagination active

| Page | Hook url | Notes |
|---|---|---|
| `ServicesSummaryPage.jsx` | `/services-history/:shopId` | History tab; `stats.totalRevenue` from server |
| `InventoryPage.jsx` | `/items/:shopId` | Main list only; order-modal still manual |
| `OrdersPage.jsx` | `/orders/:shopId` | q search + status/supplier_id filters |
| `StaffPage.jsx` | `/staff/:shopId` | KPIs from `/staff-kpi/:shopId`; roleFilter still client-side |
| `CustomerPage.jsx` | `/customers/:shopId` | KPIs from `/customers-kpi/:shopId`; filter param |
| `SalesPage.jsx` | `/sales/:shopId` | KPIs from `/sales-kpi/:shopId`; startDate/endDate params |
| `ExpensesPage.jsx` | `/expenses/:shopId` | KPI summary from `/expenses-summary/:shopId`; category_id param |
| `RecapPage.jsx` | `/recap-jobs/:shopId` | KPIs from `/recap-jobs-kpi/:shopId`; virtual status tabs (IN_INVENTORY/READY_FOR_CLAIM) via ownership_type mapping |
| `ProfitsPage.jsx` | `/profits/transactions/:shopId` | Transactions list only; summary/byCategory/topItems stay as parallel full fetches |
| `PayablesPage.jsx` | `/payables/:shopId` | KPIs from `/payables-kpi/:shopId`; calendar uses separate month-bounded fetch; status computed server-side |
| `ReceivablesPage.jsx` | `/receivables/:shopId` | KPIs from `/receivables-kpi/:shopId`; status/q filter server-side |

### ⛔ Reviewed — kept as full-array fetch (correct for these pages)

| Page | Reason |
|---|---|
| `CashLedgerPage.jsx` | Unified 5-table join assembled in app code; per-source/method counts need full set |
| `PayrollPage.jsx` | Single-date bounded dataset (~10–30 entries/day); complex bale + form state |
| `AttendancePage.jsx` | Calendar month-view requires full month attendance records |
| `SuppliersPage.jsx` | Low cardinality — handful of suppliers; hook unnecessary |
| `Servicespage.jsx` | Low cardinality — handful of services; hook unnecessary |
| `PurchasesPage.jsx` | Nested items-per-header response shape incompatible with hook; already date-bounded with client PAGE_SIZE=15 |

### Backend endpoints added

- `GET /staff-kpi/:shop_id` — totalStaff, mgmtCount, serviceCount, onLeave
- `GET /customers-kpi/:shop_id` — totalCustomers, companies, newThisMonth, withVehicles
- `GET /sales-kpi/:shop_id` — totalRevenue, todayRevenue, totalItems, totalTransactions (supports startDate/endDate)
- `GET /sales/:shop_id` — added `q` LIKE search
- `GET /expenses/:shop_id` — added opt-in `q`/`page`/`perPage` pagination
- `GET /recap-jobs/:shop_id` — added opt-in `q`/`page`/`perPage`/`dateFrom`/`dateTo`/`ownership_type` pagination
- `GET /recap-jobs-kpi/:shop_id` — statusCounts + total (no status filter, for tab badges)
- `GET /profits/transactions/:shop_id` — added opt-in `q`/`page`/`perPage` pagination
- `GET /payables/:shop_id` — added opt-in `q`/`page`/`perPage`/`startDate`/`endDate`; server-side PAID/OVERDUE/OPEN status
- `GET /payables-kpi/:shop_id` — totalPayables, totalBalance, paidCount, overdueCount, openCount
- `GET /receivables/:shop_id` — added opt-in `q`/`page`/`perPage` pagination
- `GET /receivables-kpi/:shop_id` — totalOrig, totalBalance, totalPaid, openCount, paidCount

### Completed additional fixes

- `InventoryPage.jsx` — verified correct: hook wired, `/items-kpi` KPI endpoint exists
- `Productspage.jsx` — already uses dual `usePaginatedResource` (active + archived lists) + `/items-kpi`
- `POSPage.jsx` — already has custom server-side pagination via `fetchPosItems` / `/pos-items`
- **Bug fix**: `/items-kpi` returned `tireItemsCount`/`otherItemsCount` but `Productspage.jsx` read `tireItems`/`otherItems` — renamed to match

### Pagination migration: COMPLETE

All applicable pages are migrated. No further pagination work required.

## Performance Optimization Tasks

### ✅ Task 1 — Sales list correlated subqueries → JOIN + GROUP BY (`routes/sales.js`)
5 correlated subqueries per row replaced with single `LEFT JOIN sale_items si` + `GROUP BY sh.sale_id`. Build passes.

### ✅ Task 2 — Financial Health serial queries → Promise.all() (`routes/financials.js`)
10 nested callbacks in `/financial-health/:shop_id` replaced with `Promise.all([...])`. Build passes.

### ✅ Task 3 — `sales_ledger` redundancy audit (no action taken — confirmed dead table)
`sales_ledger` and `sales_ledger_items` are defined in Database.js and included in backup.js exports, but **no route writes to them and no frontend reads them**. They duplicate `sale_header`+`sale_items`. Safe to drop in a future migration, but left intact to avoid data loss on live DBs.

### ✅ Task 4 — Sale creation wrapped in BEGIN/COMMIT/ROLLBACK (`routes/sales.js`)
`db.serialize` replaced with `db.run('BEGIN TRANSACTION', ...)`. `rollback()` helper called on every error path. COMMIT fires after all three inserts (sale_header, sale_items, inventory_ledger) succeed. Side-effect helpers (commissions, labor) run post-commit. Build passes.

## Key Business Logic
- **Inventory**: Stocks are tracked per shop. Triggers in SQLite maintain `current_stock`.
- **POS**: Handles sales of both products and services. Calculates commissions for staff.
- **Recap**: Specialized lifecycle for retreading customer or shop tires.
- **Financials**: Integrated tracking of AR, AP, and daily cash ledgers.
