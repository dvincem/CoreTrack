const express = require("express");
const router = express.Router();
const { db } = require("../Database");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

// ── Google Cloud Storage (optional off-site backup) ────────────────────────
const GCS_BUCKET  = process.env.GCS_BUCKET_NAME;
const GCS_KEY_FILE = process.env.GCS_KEY_FILE;
let _gcsStorage = null;
if (GCS_BUCKET && GCS_KEY_FILE) {
  try {
    const { Storage } = require('@google-cloud/storage');
    _gcsStorage = new Storage({ keyFilename: GCS_KEY_FILE });
    console.log('[Backup] GCS off-site backup enabled — bucket:', GCS_BUCKET);
  } catch (e) {
    console.warn('[Backup] Failed to init @google-cloud/storage:', e.message);
  }
}

async function uploadToGCS(filePath) {
  if (!_gcsStorage || !GCS_BUCKET) return;
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dest = `backups/CoreTrack_${ts}.xlsx`;
  try {
    await _gcsStorage.bucket(GCS_BUCKET).upload(filePath, { destination: dest });
    console.log(`[Backup] Uploaded to GCS: gs://${GCS_BUCKET}/${dest}`);
  } catch (e) {
    console.error('[Backup] GCS upload failed:', e.message);
  }
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Tables to export, in dependency order (parents before children).
// IMPORTANT: when new tables are added to Database.js, add them here too.
const EXPORT_TABLES = [
  // ── Core shop & auth ─────────────────────────────────────────────────────
  "shop_master",
  "brand_assets",
  "staff_master",
  "user_credentials",
  "user_page_access",
  "user_system_roles",
  // ── Suppliers & inventory ────────────────────────────────────────────────
  "supplier_master",
  "supplier_brands",
  "item_master",
  "current_stock",
  "inventory_ledger",
  "item_price_history",
  // ── Inventory audits ─────────────────────────────────────────────────────
  "inventory_audit_sessions",
  "inventory_audit_items",
  "inventory_audits",
  // ── Customers & services ─────────────────────────────────────────────────
  "services_master",
  "commission_rules",
  "customer_master",
  "vehicle_plates",
  // ── Sales & POS ──────────────────────────────────────────────────────────
  "sale_header",
  "sale_items",
  "sales_ledger",
  "sales_ledger_items",
  "pos_drafts",
  "labor_log",
  // ── Orders & purchases ───────────────────────────────────────────────────
  "orders",
  "order_items",
  "purchase_header",
  "purchase_items",
  // ── Recap jobs ───────────────────────────────────────────────────────────
  "recap_job_master",
  "recap_job_ledger",
  "recap_price_defaults",
  // ── Financials ───────────────────────────────────────────────────────────
  "accounts_receivable",
  "receivable_payments",
  "accounts_payable",
  "payable_payments",
  "payment_ledger",
  "expenses",
  "expense_categories",
  "cash_ledger",
  "bale_book",
  "bale_payments",
  "returns",
  // ── Staff & payroll ──────────────────────────────────────────────────────
  "staff_attendance",
  "staff_daily_revenue",
  // ── Goals & reporting ────────────────────────────────────────────────────
  "revenue_goals",
  "daily_closures",
  // ── Audit trail ──────────────────────────────────────────────────────────
  "system_audit_log",
];

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])))
  );
}

// ── Core Backup Logic (Exported for Auto-Backup) ───────────────────────────

// Excel cells cannot exceed 32,767 characters — truncate any that do.
const EXCEL_MAX_CELL = 32767;

/**
 * Get the authoritative column list for a table directly from the DB schema.
 * This is the source of truth — we never rely on the data rows to discover columns,
 * because all-NULL columns are invisible in the row objects returned by sqlite3.
 */
async function getTableColumns(table) {
  const rows = await dbAll(`PRAGMA table_info(${table})`);
  return rows.map(r => r.name);
}

/**
 * Build a worksheet from rows, always including every DB column in the header
 * even if all values in that column are NULL.
 * 
 * This prevents the xlsx library from silently dropping columns like
 * customer_master.contact_number when no customer has a phone number yet.
 */
function buildSheet(rows, columns) {
  // Normalise every row: ensure all columns present, truncate long strings
  const normalised = rows.map(row => {
    const out = {};
    for (const col of columns) {
      const v = row[col] !== undefined ? row[col] : null;
      out[col] = (typeof v === 'string' && v.length > EXCEL_MAX_CELL)
        ? v.slice(0, EXCEL_MAX_CELL - 3) + '...'
        : v;
    }
    return out;
  });

  if (normalised.length === 0) {
    // Empty table: create a header-only sheet so the column structure is preserved
    const ws = {};
    columns.forEach((col, i) => {
      ws[XLSX.utils.encode_cell({ r: 0, c: i })] = { v: col, t: 's' };
    });
    ws['!ref'] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: 0, c: Math.max(0, columns.length - 1) });
    return ws;
  }

  // Use header option to pin column order and force all columns to appear
  return XLSX.utils.json_to_sheet(normalised, { header: columns });
}

async function runBackupToFile(targetPath = null) {
  const excelPath = targetPath || path.join(__dirname, "..", "backup.xlsx");

  let wb = XLSX.utils.book_new();
  if (fs.existsSync(excelPath)) {
    try { wb = XLSX.readFile(excelPath); } catch { /* start fresh on corrupt file */ }
  }

  for (const table of EXPORT_TABLES) {
    let rows, columns;
    try {
      [rows, columns] = await Promise.all([
        dbAll(`SELECT * FROM ${table}`),
        getTableColumns(table),
      ]);
    } catch {
      continue;
    }
    const sheetName = table.toUpperCase();
    const idx = wb.SheetNames.indexOf(sheetName);
    if (idx !== -1) { wb.SheetNames.splice(idx, 1); delete wb.Sheets[sheetName]; }
    const ws = buildSheet(rows, columns);
    wb.Sheets[sheetName] = ws;
    wb.SheetNames.push(sheetName);
  }

  XLSX.writeFile(wb, excelPath);
  uploadToGCS(excelPath).catch(() => {}); // fire-and-forget; errors logged inside
  return { ok: true, tables: EXPORT_TABLES.length };
}


router.post("/backup", async (req, res) => {
  try {
    const result = await runBackupToFile();
    res.json({ ok: true, message: `Backup saved to backup.xlsx (${result.tables} tables)` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/backup-status", (req, res) => {
  const excelPath = path.join(__dirname, "..", "backup.xlsx");
  if (!fs.existsSync(excelPath)) {
    return res.json({ lastBackup: null });
  }
  const stats = fs.statSync(excelPath);
  res.json({ lastBackup: stats.mtime });
});

// ── Export: build xlsx and send as download ────────────────────────────────
router.get("/backup/download", async (req, res) => {
  try {
    const wb = XLSX.utils.book_new();
    for (const table of EXPORT_TABLES) {
      let rows, columns;
      try {
        [rows, columns] = await Promise.all([
          dbAll(`SELECT * FROM ${table}`),
          getTableColumns(table),
        ]);
      } catch { continue; }
      const ws = buildSheet(rows, columns);
      XLSX.utils.book_append_sheet(wb, ws, table.toUpperCase());
    }
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Disposition", `attachment; filename="CoreTrack_${date}.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Import: receive xlsx upload, wipe & reload tables ─────────────────────
// COL_MAP: rename old/mismatched column names from xlsx → current DB column name.
// Only add entries here if an exported column name differs from the live DB column.
const COL_MAP = {
  staff_master: { contacts: "email" },
  // supplier_master: active_status IS the correct DB column name — no mapping needed
};

// IMPORT_ORDER must mirror EXPORT_TABLES (parents before children)
const IMPORT_ORDER = [
  // ── Core shop & auth ─────────────────────────────────────────────────────
  "shop_master",
  "brand_assets",
  "staff_master",
  "user_credentials",
  "user_page_access",
  "user_system_roles",
  // ── Suppliers & inventory ────────────────────────────────────────────────
  "supplier_master",
  "supplier_brands",
  "item_master",
  "current_stock",
  "inventory_ledger",
  "item_price_history",
  // ── Inventory audits ─────────────────────────────────────────────────────
  "inventory_audit_sessions",
  "inventory_audit_items",
  "inventory_audits",
  // ── Customers & services ─────────────────────────────────────────────────
  "services_master",
  "commission_rules",
  "customer_master",
  "vehicle_plates",
  // ── Sales & POS ──────────────────────────────────────────────────────────
  "sale_header",
  "sale_items",
  "sales_ledger",
  "sales_ledger_items",
  "pos_drafts",
  "labor_log",
  // ── Orders & purchases ───────────────────────────────────────────────────
  "orders",
  "order_items",
  "purchase_header",
  "purchase_items",
  // ── Recap jobs ───────────────────────────────────────────────────────────
  "recap_job_master",
  "recap_job_ledger",
  "recap_price_defaults",
  // ── Financials ───────────────────────────────────────────────────────────
  "accounts_receivable",
  "receivable_payments",
  "accounts_payable",
  "payable_payments",
  "payment_ledger",
  "expenses",
  "expense_categories",
  "cash_ledger",
  "bale_book",
  "bale_payments",
  "returns",
  // ── Staff & payroll ──────────────────────────────────────────────────────
  "staff_attendance",
  "staff_daily_revenue",
  // ── Goals & reporting ────────────────────────────────────────────────────
  "revenue_goals",
  "daily_closures",
  // ── Audit trail (restore last — no FK deps) ──────────────────────────────
  "system_audit_log",
];

function dbRunP(sql, p = []) {
  return new Promise((r, j) => db.run(sql, p, function (e) { e ? j(e) : r(this) }));
}
function dbAllCols(table) {
  return new Promise((r, j) => db.all(`PRAGMA table_info(${table})`, [], (e, rows) => e ? j(e) : r((rows || []).map(x => x.name))));
}

router.post("/import", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  try {
    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheets = {};
    for (const name of wb.SheetNames) {
      sheets[name.toUpperCase()] = XLSX.utils.sheet_to_json(wb.Sheets[name]);
    }

    await dbRunP("PRAGMA foreign_keys = OFF");

    const results = [];
    for (const table of IMPORT_ORDER) {
      const rows = sheets[table.toUpperCase()];
      if (rows === undefined) { results.push({ table, status: "skipped" }); continue; }

      let dbCols;
      try { dbCols = await dbAllCols(table); } catch { results.push({ table, status: "no table" }); continue; }

      const map = COL_MAP[table] || {};
      const mapped = rows.map(row => {
        const out = {};
        for (const [k, v] of Object.entries(row)) out[map[k] || k] = v;
        return out;
      });

      await dbRunP(`DELETE FROM ${table}`);

      if (mapped.length === 0) { results.push({ table, count: 0, status: "cleared" }); continue; }

      const useCols = Object.keys(mapped[0]).filter(c => dbCols.includes(c));
      const colList = useCols.map(c => `"${c}"`).join(", ");
      const placeholders = useCols.map(() => "?").join(", ");
      const sql = `INSERT OR REPLACE INTO ${table} (${colList}) VALUES (${placeholders})`;

      let count = 0;
      for (const row of mapped) {
        try {
          await dbRunP(sql, useCols.map(c => row[c] !== undefined ? row[c] : null));
          count++;
        } catch { }
      }
      results.push({ table, count, status: "ok" });
    }

    await dbRunP("PRAGMA foreign_keys = ON");
    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, runBackupToFile };
