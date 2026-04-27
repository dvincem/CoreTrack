# Database Schema

The project uses SQLite. The schema is defined and initialized in `Database.js`.

## Key Tables

- **Core Master Data**:
  - `shop_master`: Shop locations.
  - `staff_master`: Employees and their roles (owner, sales, tireman, etc.).
  - `item_master`: Products (tires, valves, weights).
  - `services_master`: Services offered (vulcanizing, balancing, etc.).
  - `customer_master`: Customer records.
  - `supplier_master`: Suppliers for items and recapping.

- **Inventory & Stock**:
  - `inventory_ledger`: All stock movements (purchases, sales, adjustments).
  - `current_stock`: View or table tracking immediate availability per shop.
  - `item_price_history`: Tracking cost and price changes.

- **Sales & Transactions**:
  - `sale_header`: Main sale record (invoice, total, staff).
  - `sale_items`: Line items for each sale (products or services).
  - `sales_ledger`: Ledger for financial tracking of sales.

- **Specialized Workflows**:
  - `recap_job_master`: Tracking "recap" (retreaded) tire jobs.
  - `recap_job_ledger`: History of status changes for recap jobs.

- **Financials**:
  - `accounts_receivable`: Tracking customer debt.
  - `accounts_payable`: Tracking debt to suppliers.
  - `payment_ledger`: Record of all payments (in and out).
  - `expenses`: Business expenses.
  - `cash_ledger`: Daily cash flow tracking.

## Triggers
- `update_current_stock`: Automatically updates `current_stock` when `inventory_ledger` is modified.
