const { db } = require("../Database");

// Ordered from child to parent to satisfy FK constraints if PRAGMA fails
const tablesToReset = [
  // Payments & History (Children)
  "receivable_payments",
  "payable_payments",
  "bale_payments",
  "payment_ledger",
  "item_price_history",
  "recap_job_ledger",
  "sales_ledger_items",
  "sales_ledger",
  "sale_items",
  "order_items",
  "purchase_items",
  "inventory_ledger",
  "labor_log",
  "staff_attendance",
  "staff_daily_revenue",
  "vehicle_plates",
  "daily_closures",

  // Main Transaction Headers (Parents of above)
  "recap_job_master",
  "accounts_receivable",
  "accounts_payable",
  "bale_book",
  "sale_header",
  "orders",
  "purchase_header",
  "returns",
  "expenses",
  "cash_ledger",

  // Masters (Parents of Headers)
  "item_master",
  "current_stock",
  "customer_master",
  "supplier_brands",
  "supplier_master",
  "services_master",
  "expense_categories",
  "commission_rules",
  "recap_price_defaults"
];

db.serialize(() => {
  console.log("Starting forced database reset...");
  
  // Explicitly disable FKs for this connection
  db.run("PRAGMA foreign_keys = OFF");

  db.run("BEGIN TRANSACTION");

  for (const table of tablesToReset) {
    db.run(`DELETE FROM ${table}`, (err) => {
      if (err) {
        console.error(`✕ Error resetting ${table}:`, err.message);
      } else {
        console.log(`✓ Table ${table} reset.`);
      }
    });
  }

  db.run("COMMIT", (err) => {
    if (err) {
      console.error("!!! Transaction failed:", err.message);
      db.run("ROLLBACK");
      process.exit(1);
    } else {
      // Re-enable for safety
      db.run("PRAGMA foreign_keys = ON");
      console.log("\n✅ FINAL: Database reset complete (preserved staff/account details).");
      process.exit(0);
    }
  });
});
