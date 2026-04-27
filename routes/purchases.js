const express = require("express");
const router = express.Router();
const { db } = require("../Database");
const { v4: uuidv4 } = require("uuid");
const { getEffectiveISO, getEffectiveYYYYMMDD } = require("../lib/businessDate");

// ── List purchases ────────────────────────────────────────────────────────────
router.get("/purchases/:shop_id", async (req, res) => {
  const { shop_id } = req.params;
  const { startDate, endDate, category } = req.query;
  const today = await getEffectiveYYYYMMDD(shop_id);
  const start = startDate || today;
  const end   = endDate   || today;

  let sql = `
    SELECT
      ph.purchase_id, ph.shop_id,
      ph.purchase_date, ph.total_amount,
      ph.notes, ph.created_by, ph.handled_by, ph.created_at,
      sm.full_name as handled_by_name, sm2.full_name as created_by_name
    FROM purchase_header ph
    LEFT JOIN staff_master sm ON ph.handled_by = sm.staff_id
    LEFT JOIN staff_master sm2 ON ph.created_by = sm2.staff_id
    WHERE ph.shop_id = ?
      AND DATE(ph.purchase_date) BETWEEN ? AND ?`;
  const params = [shop_id, start, end];

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows || rows.length === 0) return res.json([]);

    // Attach line items to each purchase
    const ids = rows.map(r => r.purchase_id);
    db.all(
      `SELECT * FROM purchase_items WHERE purchase_id IN (${ids.map(() => "?").join(",")})`,
      ids,
      (err2, items) => {
        if (err2) return res.status(500).json({ error: err2.message });
        const itemMap = {};
        (items || []).forEach(i => {
          if (!itemMap[i.purchase_id]) itemMap[i.purchase_id] = [];
          itemMap[i.purchase_id].push(i);
        });
        res.json(rows.map(r => ({ ...r, items: itemMap[r.purchase_id] || [] })));
      }
    );
  });
});

// ── Summary KPIs ──────────────────────────────────────────────────────────────
router.get("/purchases/:shop_id/summary", async (req, res) => {
  const { shop_id } = req.params;
  const { startDate, endDate } = req.query;
  const today = await getEffectiveYYYYMMDD(shop_id);
  const start = startDate || today;
  const end   = endDate   || today;

  db.all(`
    SELECT
      pi.category,
      COUNT(DISTINCT ph.purchase_id) AS purchase_count,
      SUM(pi.quantity)               AS total_qty,
      SUM(pi.line_total)             AS total_cost
    FROM purchase_items pi
    JOIN purchase_header ph ON pi.purchase_id = ph.purchase_id
    WHERE ph.shop_id = ? AND DATE(ph.purchase_date) BETWEEN ? AND ?
    GROUP BY pi.category
    ORDER BY total_cost DESC`,
    [shop_id, start, end],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      db.get(
        `SELECT COALESCE(SUM(total_amount), 0) AS grand_total
         FROM purchase_header
         WHERE shop_id = ? AND DATE(purchase_date) BETWEEN ? AND ?`,
        [shop_id, start, end],
        (err2, totals) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ categories: rows || [], grand_total: totals?.grand_total || 0 });
        }
      );
    }
  );
});

// ── Create purchase ───────────────────────────────────────────────────────────
router.post("/purchases/:shop_id", async (req, res) => {
  const { shop_id } = req.params;
  const { notes, created_by, handled_by, items } = req.body;

  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: "At least one item is required" });

  const purchase_id = `PUR-${uuidv4().split("-")[0].toUpperCase()}`;
  const total_amount = items.reduce((s, i) => s + (parseFloat(i.unit_cost) * parseFloat(i.quantity) || 0), 0);
  const business_date = await getEffectiveYYYYMMDD(shop_id);
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO purchase_header (purchase_id, shop_id, purchase_date, total_amount, notes, created_by, handled_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [purchase_id, shop_id, business_date, total_amount, notes || null, created_by || null, handled_by || null, now],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      let pending = items.length;
      let hasError = null;
      const insertedItems = [];

      items.forEach((item) => {
        const purchase_item_id = `PITEM-${uuidv4().split("-")[0].toUpperCase()}`;
        const qty    = parseFloat(item.quantity) || 1;
        const cost   = parseFloat(item.unit_cost) || 0;
        const line   = qty * cost;
        const cat    = item.category || "OTHER";

        // Optionally create/update item_master for resellable items
        const doInsertItem = (item_master_id) => {
          db.run(
            `INSERT INTO purchase_items (purchase_item_id, purchase_id, shop_id, item_name, category, quantity, unit_cost, line_total, item_master_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [purchase_item_id, purchase_id, shop_id, item.item_name, cat, qty, cost, line, item_master_id || null],
            (err2) => {
              if (err2) hasError = err2.message;
              else insertedItems.push({ purchase_item_id, item_name: item.item_name, category: cat, quantity: qty, unit_cost: cost, line_total: line, item_master_id });
              pending--;
              if (pending === 0) {
                if (hasError) return res.status(500).json({ error: hasError });

                // Also add to inventory_ledger if resellable
                insertedItems
                  .filter(i => i.item_master_id && ["USED_TIRE","USED_MAGWHEEL","OTHER_INVENTORY"].includes(i.category))
                  .forEach(i => {
                    const inv_id = `INVTXN-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
                    db.run(
                      `INSERT INTO inventory_ledger (inventory_ledger_id, shop_id, item_id, transaction_type, quantity, unit_cost, reference_id, created_by, created_at)
                       VALUES (?, ?, ?, 'PURCHASE', ?, ?, ?, ?, ?)`,
                      [inv_id, shop_id, i.item_master_id, i.quantity, i.unit_cost, purchase_id, created_by || "PURCHASE", now]
                    );
                  });

                res.json({ purchase_id, total_amount, items: insertedItems });
              }
            }
          );
        };

        // If item_master_id was passed in from frontend (already created), use it directly
        if (item.item_master_id) {
          doInsertItem(item.item_master_id);
          return;
        }

        // For resellable categories, find or create item_master entry
        if (["USED_TIRE", "USED_MAGWHEEL", "OTHER_INVENTORY"].includes(cat)) {
          const imCat = cat === "USED_TIRE" ? "Used Tires" : cat === "USED_MAGWHEEL" ? "Mag Wheels" : "Other";
          const sellPrice = parseFloat(item.selling_price) || cost * 1.3;
          // Try to find existing item with same name in this shop
          db.get(
            `SELECT item_id FROM item_master WHERE shop_id = ? AND item_name = ? AND category = ? LIMIT 1`,
            [shop_id, item.item_name, imCat],
            (findErr, existing) => {
              if (existing) {
                // Update selling price if provided, then reuse
                db.run(
                  `UPDATE item_master SET unit_cost = ?, selling_price = ? WHERE item_id = ?`,
                  [cost, sellPrice, existing.item_id],
                  () => doInsertItem(existing.item_id)
                );
              } else {
                const item_id = `ITM-${uuidv4().split("-")[0].toUpperCase()}`;
                db.run(
                  `INSERT INTO item_master (item_id, shop_id, item_name, category, unit_cost, selling_price, is_active, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
                  [item_id, shop_id, item.item_name, imCat, cost, sellPrice, now],
                  (err2) => {
                    if (err2) doInsertItem(null);
                    else doInsertItem(item_id);
                  }
                );
              }
            }
          );
        } else {
          doInsertItem(null);
        }
      });
    }
  );
});

// ── Delete purchase ───────────────────────────────────────────────────────────
router.delete("/purchases/:purchase_id", (req, res) => {
  const { purchase_id } = req.params;
  db.run(`DELETE FROM purchase_items WHERE purchase_id = ?`, [purchase_id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run(`DELETE FROM purchase_header WHERE purchase_id = ?`, [purchase_id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ ok: true });
    });
  });
});

module.exports = router;
