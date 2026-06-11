const s3 = require('sqlite3');
const db = new s3.Database('./tire_shop.db');

// 1. Check how many customers have contact_number
db.get(
  `SELECT COUNT(*) as total,
          SUM(CASE WHEN contact_number IS NOT NULL AND contact_number != '' THEN 1 ELSE 0 END) as has_phone
   FROM customer_master`,
  [],
  (e, r) => {
    console.log('Total customers:', r ? r.total : e.message);
    console.log('With contact_number set:', r ? r.has_phone : '-');
  }
);

// 2. Audit ALL tables: find any column where every row is NULL (these get dropped by xlsx)
const EXPORT_TABLES = [
  'shop_master','brand_assets','staff_master','user_credentials','user_page_access','user_system_roles',
  'supplier_master','supplier_brands','item_master','current_stock','inventory_ledger','item_price_history',
  'inventory_audit_sessions','inventory_audit_items','inventory_audits',
  'services_master','commission_rules','customer_master','vehicle_plates',
  'sale_header','sale_items','sales_ledger','sales_ledger_items','pos_drafts','labor_log',
  'orders','order_items','purchase_header','purchase_items',
  'recap_job_master','recap_job_ledger','recap_price_defaults',
  'accounts_receivable','receivable_payments','accounts_payable','payable_payments',
  'payment_ledger','expenses','expense_categories','cash_ledger','bale_book','bale_payments','returns',
  'staff_attendance','staff_daily_revenue',
  'revenue_goals','daily_closures','system_audit_log'
];

let done = 0;
const allNullCols = {};

EXPORT_TABLES.forEach(table => {
  // Get columns
  db.all(`PRAGMA table_info(${table})`, [], (e, cols) => {
    if (e || !cols) { if (++done === EXPORT_TABLES.length) finish(); return; }
    const colNames = cols.map(c => c.name);

    // Check row count
    db.get(`SELECT COUNT(*) as cnt FROM ${table}`, [], (e2, row) => {
      const cnt = row ? row.cnt : 0;
      if (cnt === 0) { if (++done === EXPORT_TABLES.length) finish(); return; }

      // For each column, check if ALL values are NULL
      let colDone = 0;
      const nullCols = [];
      colNames.forEach(col => {
        db.get(
          `SELECT COUNT(*) as non_null FROM ${table} WHERE "${col}" IS NOT NULL`,
          [],
          (e3, r3) => {
            if (r3 && r3.non_null === 0) nullCols.push(col);
            if (++colDone === colNames.length) {
              if (nullCols.length > 0) allNullCols[table] = nullCols;
              if (++done === EXPORT_TABLES.length) finish();
            }
          }
        );
      });
    });
  });
});

function finish() {
  console.log('\n=== Columns that are ALL-NULL (will be missing from Excel backup) ===');
  const entries = Object.entries(allNullCols);
  if (entries.length === 0) {
    console.log('None — all columns have at least one non-NULL value across all tables.');
  } else {
    entries.forEach(([table, cols]) => {
      console.log(`  ${table}: ${cols.join(', ')}`);
    });
    console.log('\nThese columns exist in the DB but have no data yet, so xlsx skips them.');
    console.log('Fix: use column-pinning in sanitizeRows() to always include them.');
  }
  db.close();
}
