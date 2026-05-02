const express = require("express");
const router = express.Router();
const { db } = require("../Database");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Tables to export, in dependency order (parents before children)
const EXPORT_TABLES = [
  "shop_master",
  "staff_master",
  "supplier_master",
  "supplier_brands",
  "item_master",
  "services_master",
  "commission_rules",
  "customer_master",
  "vehicle_plates",
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

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])))
  );
}

// ── Core Backup Logic (Exported for Auto-Backup) ───────────────────────────

// Excel cells cannot exceed 32,767 characters — truncate any that do
const EXCEL_MAX_CELL = 32767;
function sanitizeRows(rows) {
  return rows.map(row => {
    const clean = {};
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === 'string' && v.length > EXCEL_MAX_CELL) {
        clean[k] = v.slice(0, EXCEL_MAX_CELL - 3) + '...';
      } else {
        clean[k] = v;
      }
    }
    return clean;
  });
}

async function runBackupToFile(targetPath = null) {
  const excelPath = targetPath || path.join(__dirname, "..", "backup.xlsx");

  let wb;
  if (fs.existsSync(excelPath)) {
    try {
      wb = XLSX.readFile(excelPath);
    } catch (e) {
      wb = XLSX.utils.book_new();
    }
  } else {
    wb = XLSX.utils.book_new();
  }

  for (const table of EXPORT_TABLES) {
    let rows;
    try {
      rows = await dbAll(`SELECT * FROM ${table}`);
    } catch (e) {
      continue;
    }
    const sheetName = table.toUpperCase();
    const idx = wb.SheetNames.indexOf(sheetName);
    if (idx !== -1) wb.SheetNames.splice(idx, 1);
    delete wb.Sheets[sheetName];

    const safeRows = sanitizeRows(rows);
    const ws = safeRows.length > 0
      ? XLSX.utils.json_to_sheet(safeRows)
      : XLSX.utils.aoa_to_sheet([]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  XLSX.writeFile(wb, excelPath);
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
      let rows;
      try { rows = await dbAll(`SELECT * FROM ${table}`); } catch { continue; }
      const safeRows = sanitizeRows(rows);
      const ws = safeRows.length > 0 ? XLSX.utils.json_to_sheet(safeRows) : XLSX.utils.aoa_to_sheet([[]]);
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
const COL_MAP = {
  staff_master: { contacts: "email" },
  supplier_master: { active_status: "is_active" },
};

const IMPORT_ORDER = [
  "shop_master", "staff_master", "supplier_master", "supplier_brands", "item_master", "services_master",
  "commission_rules", "customer_master", "vehicle_plates", "staff_attendance", "inventory_ledger",
  "current_stock", "sale_header", "sale_items", "sales_ledger", "orders", "order_items",
  "recap_job_master", "recap_job_ledger", "recap_price_defaults", "accounts_receivable",
  "receivable_payments", "accounts_payable", "payable_payments", "labor_log",
  "staff_daily_revenue", "expenses", "expense_categories", "cash_ledger", "bale_book",
  "bale_payments", "returns", "payment_ledger", "item_price_history",
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
