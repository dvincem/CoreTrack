/**
 * Reads the live SQLite database and writes ALL tables back to backup.xlsx,
 * including the new dot_number / parent_item_id columns and item_price_history.
 */
const path = require("path");
const XLSX = require("xlsx");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");

const dbPath = path.join(__dirname, "..", "tire_shop.db");
const excelPath = path.join(__dirname, "..", "backup.xlsx");

const EXPORT_TABLES = [
  "shop_master",
  "staff_master",
  "supplier_master",
  "item_master",
  "services_master",
  "commission_rules",
  "customer_master",
  "staff_attendance",
  "inventory_ledger",
  "current_stock",
  "sale_header",
  "sale_items",
  "sales_ledger",
  "orders",
  "order_items",
  "recap_job_master",
  "recap_job_ledger",
  "recap_price_defaults",
  "accounts_receivable",
  "receivable_payments",
  "accounts_payable",
  "payable_payments",
  "labor_log",
  "staff_daily_revenue",
  "expenses",
  "expense_categories",
  "cash_ledger",
  "bale_book",
  "bale_payments",
  "returns",
  "payment_ledger",
  "item_price_history",
];

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) { console.error("Cannot open DB:", err.message); process.exit(1); }
  console.log("Connected to", dbPath);
});

function dbAll(sql) {
  return new Promise((resolve, reject) =>
    db.all(sql, [], (err, rows) => err ? reject(err) : resolve(rows || []))
  );
}

async function main() {
  let wb;
  if (fs.existsSync(excelPath)) {
    wb = XLSX.readFile(excelPath);
    console.log("Loaded existing workbook:", excelPath);
  } else {
    wb = XLSX.utils.book_new();
    console.log("Creating new workbook");
  }

  for (const table of EXPORT_TABLES) {
    let rows;
    try {
      rows = await dbAll(`SELECT * FROM ${table}`);
    } catch (e) {
      console.log(`  ⚠ Skipping ${table}: ${e.message}`);
      continue;
    }

    const sheetName = table.toUpperCase();
    // Remove old sheet
    const idx = wb.SheetNames.indexOf(sheetName);
    if (idx !== -1) wb.SheetNames.splice(idx, 1);
    delete wb.Sheets[sheetName];

    const ws = rows.length > 0
      ? XLSX.utils.json_to_sheet(rows)
      : XLSX.utils.aoa_to_sheet([]);

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    console.log(`  ✓ ${sheetName} — ${rows.length} rows`);
  }

  XLSX.writeFile(wb, excelPath);
  console.log("\n✅ backup.xlsx updated successfully.");
  db.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
