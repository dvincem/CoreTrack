/**
 * Updates backup.xlsx so that EVERY tire-related row in ITEM_MASTER,
 * INVENTORY_LEDGER, and CURRENT_STOCK has a dot_number.
 *
 * Strategy:
 *  - Parent tire items in ITEM_MASTER keep their row but get dot_number = "2025"
 *    (they represent the current/default stock DOT)
 *  - INV-INIT-* ledger entries for tires → dot_number = "2024"  (opening old stock)
 *  - INV-RST-*  ledger entries for tires → dot_number = "2025"  (restock newer)
 *  - SALE entries in ledger for tires   → dot_number = "2024"  (sold oldest first, FIFO)
 *  - INV-DOT-*  entries already have dot_number ✓
 */
const path = require("path");
const XLSX = require("xlsx");

const excelPath = path.join(__dirname, "..", "backup.xlsx");
const wb = XLSX.readFile(excelPath);

function getSheet(name) { return XLSX.utils.sheet_to_json(wb.Sheets[name] || {}); }
function setSheet(name, rows) {
  const idx = wb.SheetNames.indexOf(name);
  if (idx !== -1) wb.SheetNames.splice(idx, 1);
  delete wb.Sheets[name];
  const ws = rows.length > 0 ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([[]]);
  XLSX.utils.book_append_sheet(wb, ws, name);
}

// Tire category names
const TIRE_CATS = new Set(["PCR","SUV","TRUCK","MOTORCYCLE","RECAP","TIRE"]);

// DOT assignment per item (parent item_id → default DOT)
// Used for ITEM_MASTER parent rows and SALE ledger entries
const PARENT_DOT = {
  "ITEM-001":"2025","ITEM-002":"2025","ITEM-003":"2025","ITEM-004":"2025",
  "ITEM-005":"2025","ITEM-006":"2025","ITEM-007":"2025","ITEM-008":"2025",
  "ITEM-009":"2025","ITEM-010":"2025","ITEM-011":"2025","ITEM-012":"2025",
  "ITEM-013":"2025","ITEM-014":"2025","ITEM-015":"2025","ITEM-016":"2025",
  "ITEM-017":"2025",
  "ITEM-RECAP-001":"4521","ITEM-RECAP-002":"1025","ITEM-RECAP-003":"2419",
};
// DOT for INIT (opening) entries — oldest batch
const INIT_DOT = {
  "ITEM-001":"2024","ITEM-002":"2024","ITEM-003":"2024","ITEM-004":"2024",
  "ITEM-005":"2024","ITEM-006":"2024","ITEM-007":"2024","ITEM-008":"2024",
  "ITEM-009":"2024","ITEM-010":"2024","ITEM-011":"2024","ITEM-012":"2024",
  "ITEM-013":"2024","ITEM-014":"2024","ITEM-015":"2024","ITEM-016":"2024",
  "ITEM-017":"2024",
  "ITEM-RECAP-001":"4521","ITEM-RECAP-002":"3820","ITEM-RECAP-003":"2419",
};

// ── 1. ITEM_MASTER ─────────────────────────────────────────────────────────────
const items = getSheet("ITEM_MASTER").map(row => {
  // Parent tire items (no parent_item_id, is a tire category)
  if (!row.parent_item_id && TIRE_CATS.has(row.category) && !row.dot_number) {
    row.dot_number = PARENT_DOT[row.item_id] || "2025";
  }
  return row;
});
setSheet("ITEM_MASTER", items);
console.log("✓ ITEM_MASTER updated");

// ── 2. INVENTORY_LEDGER ────────────────────────────────────────────────────────
// Build a map of item_id → category from item_master
const catMap = {};
for (const row of items) catMap[row.item_id] = row.category;

const ledger = getSheet("INVENTORY_LEDGER").map(row => {
  if (row.dot_number) return row; // already has DOT, skip

  const cat = catMap[row.item_id];
  if (!TIRE_CATS.has(cat)) return row; // not a tire, skip

  const id  = String(row.inventory_ledger_id || "");
  const rid = String(row.reference_id || "");

  if (id.startsWith("INV-INIT-") || rid.startsWith("PO-INIT-")) {
    row.dot_number = INIT_DOT[row.item_id] || "2024";
  } else if (id.startsWith("INV-RST-") || rid.startsWith("PO-RST-")) {
    row.dot_number = PARENT_DOT[row.item_id] || "2025";
  } else if (row.transaction_type === "SALE" || row.transaction_type === "ADJUSTMENT") {
    // FIFO: sold/adjusted oldest DOT first
    row.dot_number = INIT_DOT[row.item_id] || "2024";
  } else {
    row.dot_number = PARENT_DOT[row.item_id] || "2025";
  }
  return row;
});
setSheet("INVENTORY_LEDGER", ledger);
console.log("✓ INVENTORY_LEDGER updated");

// ── 3. SALE_ITEMS ─────────────────────────────────────────────────────────────
// sale_items reference item_id — add dot_number where missing for tires
const saleItems = getSheet("SALE_ITEMS").map(row => {
  if (row.dot_number) return row;
  const cat = catMap[row.item_id];
  if (!TIRE_CATS.has(cat)) return row;
  // FIFO: sold from oldest DOT first
  row.dot_number = INIT_DOT[row.item_id] || "2024";
  return row;
});
setSheet("SALE_ITEMS", saleItems);
console.log("✓ SALE_ITEMS updated");

// ── Write ──────────────────────────────────────────────────────────────────────
const fs = require("fs");
const tmpPath = excelPath.replace(".xlsx", "_tmp.xlsx");
XLSX.writeFile(wb, tmpPath);
if (fs.existsSync(excelPath)) fs.unlinkSync(excelPath);
fs.renameSync(tmpPath, excelPath);

// Summary
const updatedItems  = items.filter(r => TIRE_CATS.has(r.category) && !r.parent_item_id && r.dot_number).length;
const updatedLedger = ledger.filter(r => TIRE_CATS.has(catMap[r.item_id]) && r.dot_number).length;
const updatedSales  = saleItems.filter(r => TIRE_CATS.has(catMap[r.item_id]) && r.dot_number).length;
console.log(`\n✅ Done:`);
console.log(`   ITEM_MASTER parent tire rows with DOT: ${updatedItems}`);
console.log(`   INVENTORY_LEDGER tire rows with DOT:   ${updatedLedger}`);
console.log(`   SALE_ITEMS tire rows with DOT:         ${updatedSales}`);
