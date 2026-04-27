const express = require("express");
const router = express.Router();
const { db } = require("../Database");
const { dbGet, dbAll, dbRun } = require("../lib/db");
const { getEffectiveISO, getEffectiveYYYYMMDD } = require("../lib/businessDate");
const { getDailySummary } = require("../lib/reporting");
const { runBackupToFile } = require("./backup");
const { generatePayrollInternal } = require("./staff");
const { v4: uuidv4 } = require("uuid");

router.get("/shops", (req, res) => {
  db.all("SELECT * FROM shop_master WHERE is_active = 1", (err, rows) => {
    res.json(err ? { error: err.message } : rows);
  });
});

router.get("/shops/:shop_id/status", (req, res) => {
  const { shop_id } = req.params;
  db.get("SELECT is_closed, last_closed_at, last_opened_at FROM shop_master WHERE shop_id = ?", [shop_id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Shop not found" });
    res.json(row);
  });
});

// Legacy status toggle
router.patch("/shops/:shop_id/status", (req, res) => {
  const { shop_id } = req.params;
  const { is_closed } = req.body;
  const now = new Date().toISOString();
  
  const field = is_closed ? 'last_closed_at' : 'last_opened_at';
  
  db.run(
    `UPDATE shop_master SET is_closed = ?, ${field} = ? WHERE shop_id = ?`,
    [is_closed ? 1 : 0, now, shop_id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, is_closed: !!is_closed, timestamp: now });
    }
  );
});

router.get("/shops/:shop_id/business-date", async (req, res) => {
  try {
    const { shop_id } = req.params;
    const dateStr = await getEffectiveYYYYMMDD(shop_id);
    const isoStr = await getEffectiveISO(shop_id);
    const status = await dbGet("SELECT is_closed FROM shop_master WHERE shop_id = ?", [shop_id]);
    res.json({
      business_date: dateStr,
      business_iso: isoStr,
      is_closed: !!status?.is_closed,
      system_date: new Date().toISOString().split('T')[0]
    });
  } catch (err) {
    console.error("Business Date Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/shops/:shop_id/close-day ────────────────────────────────────────
router.post("/shops/:shop_id/close-day", async (req, res) => {
  const { shop_id } = req.params;
  const { closed_by } = req.body;

  try {
    // 1. Get current business date and check status
    const shop = await dbGet("SELECT is_closed, shop_name FROM shop_master WHERE shop_id = ?", [shop_id]);
    if (!shop) return res.status(404).json({ error: "Shop not found" });
    if (shop.is_closed) return res.status(400).json({ error: "Shop is already closed for the current business day." });

    const businessDate = await getEffectiveYYYYMMDD(shop_id);

    // 2. Calculate daily summary
    const summary = await getDailySummary(shop_id, businessDate);

    // 3. Save or Update snapshot to daily_closures
    const closure_id = `CLS-${uuidv4().split('-')[0].toUpperCase()}`;
    await dbRun(
      `INSERT INTO daily_closures (
        closure_id, shop_id, business_date, gross_sales, gross_services, 
        total_expenses, total_purchases, net_profit, cash_on_hand, digital_total, closed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(shop_id, business_date) DO UPDATE SET
        gross_sales=excluded.gross_sales,
        gross_services=excluded.gross_services,
        total_expenses=excluded.total_expenses,
        total_purchases=excluded.total_purchases,
        net_profit=excluded.net_profit,
        cash_on_hand=excluded.cash_on_hand,
        digital_total=excluded.digital_total,
        closed_by=excluded.closed_by,
        closed_at=CURRENT_TIMESTAMP`,
      [
        closure_id, shop_id, businessDate, summary.grossSales, summary.grossServices,
        summary.totalExpenses, summary.totalPurchases, summary.netProfit, 
        summary.cashOnHand, summary.digitalTotal, closed_by || 'SYSTEM'
      ]
    );

    // 4. Update shop status
    const now = new Date().toISOString();
    await dbRun(
      `UPDATE shop_master SET is_closed = 1, last_closed_at = ? WHERE shop_id = ?`,
      [now, shop_id]
    );

    // 5. Auto-Generate Payroll (Capture daily earnings)
    try {
      await generatePayrollInternal(shop_id, businessDate, closed_by || 'SYSTEM');
    } catch (payErr) {
      console.error("[Closure] Payroll generation failed during close-day:", payErr);
    }

    // 6. Trigger Backup (Immediate safety)
    try {
      await runBackupToFile();
      console.log(`[Closure] Backup successful for ${shop.shop_name} on ${businessDate}`);
    } catch (backupErr) {
      console.error("[Closure] Backup failed during close-day:", backupErr);
    }

    res.json({ 
      success: true, 
      message: `Shop closed for ${businessDate}. Snapshot saved and system backed up.`,
      summary,
      next_business_date: new Date(new Date(businessDate).getTime() + 86400000).toISOString().split('T')[0]
    });

  } catch (err) {
    console.error("Close Day Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/shops/:shop_id/closures ──────────────────────────────────────────
router.get("/shops/:shop_id/closures", async (req, res) => {
  const { shop_id } = req.params;
  const { limit = 30 } = req.query;

  try {
    const rows = await dbAll(
      `SELECT * FROM daily_closures WHERE shop_id = ? ORDER BY business_date DESC LIMIT ?`,
      [shop_id, parseInt(limit)]
    );
    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
