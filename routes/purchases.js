const express = require("express");
const router = express.Router();
const { db } = require("../Database");
const { v4: uuidv4 } = require("uuid");
const { syncCurrentStock } = require("../lib/db");
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
      ph.is_void, ph.void_reason,
      sm.full_name as handled_by_name, sm2.full_name as created_by_name
    FROM purchase_header ph
    LEFT JOIN staff_master sm ON ph.handled_by = sm.staff_id
    LEFT JOIN staff_master sm2 ON ph.created_by = sm2.staff_id
    WHERE ph.shop_id = ?
      AND DATE(ph.purchase_date) BETWEEN ? AND ?
      AND ph.is_void = 0`;
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

// ── Flat history for UI table ────────────────────────────────────────────────
router.get("/purchases-history/:shop_id", async (req, res) => {
  const { shop_id } = req.params;
  const { startDate, endDate } = req.query;
  const today = await getEffectiveYYYYMMDD(shop_id);
  const start = startDate || today;
  const end   = endDate   || today;

  const sql = `
    SELECT
      pi.*,
      ph.purchase_date,
      ph.created_at as purchase_datetime,
      ph.notes as header_notes,
      ph.is_void,
      im.brand,
      im.design,
      im.size,
      im.dot_number
    FROM purchase_items pi
    JOIN purchase_header ph ON pi.purchase_id = ph.purchase_id
    LEFT JOIN item_master im ON pi.item_master_id = im.item_id
    WHERE ph.shop_id = ?
      AND DATE(ph.purchase_date) BETWEEN ? AND ?
    ORDER BY ph.created_at DESC`;

  db.all(sql, [shop_id, start, end], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
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
    WHERE ph.shop_id = ? AND DATE(ph.purchase_date) BETWEEN ? AND ? AND ph.is_void = 0
    GROUP BY pi.category
    ORDER BY total_cost DESC`,
    [shop_id, start, end],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      db.get(
        `SELECT COALESCE(SUM(total_amount), 0) AS grand_total
         FROM purchase_header
         WHERE shop_id = ? AND DATE(purchase_date) BETWEEN ? AND ? AND is_void = 0`,
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
// ── Create purchase ───────────────────────────────────────────────────────────
router.post("/purchases/:shop_id", async (req, res) => {
  const { shop_id } = req.params;
  const { notes, created_by, handled_by, items } = req.body;

  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: "At least one item is required" });

  const { dbGet, dbRun, dbSerialize, findOrCreateDotVariant } = require("../lib/db");
  const purchase_id = `PUR-${uuidv4().split("-")[0].toUpperCase()}`;
  const total_amount = items.reduce((s, i) => s + (parseFloat(i.unit_cost) * parseFloat(i.quantity) || 0), 0);
  const business_date = await getEffectiveYYYYMMDD(shop_id);
  const now = new Date().toISOString();

  try {
    const result = await dbSerialize(async ({ dbRun, dbGet }) => {
      // 1. Insert header
      await dbRun(
        `INSERT INTO purchase_header (purchase_id, shop_id, purchase_date, total_amount, notes, created_by, handled_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [purchase_id, shop_id, business_date, total_amount, notes || null, created_by || null, handled_by || null, now]
      );

      const insertedItems = [];
      const itemIdsToSync = [];

      // 2. Process items
      for (const item of items) {
        const purchase_item_id = `PITEM-${uuidv4().split("-")[0].toUpperCase()}`;
        const qty = parseFloat(item.quantity) || 1;
        const cost = parseFloat(item.unit_cost) || 0;
        const line = qty * cost;
        const cat = item.category || "OTHER";
        const sellPrice = parseFloat(item.selling_price) || cost * 1.3;
        const itemName = item.item_name || (item.brand + " " + item.design);

        let item_master_id = item.item_master_id || null;

        // If not provided, try to find or create
        if (!item_master_id) {
          const isSupply = ["Consumable", "Maintenance", "Repair Material", "Other Supply"].includes(cat);
          if (!isSupply) {
            let existing = null;
            // Prioritize SKU match
            if (item.sku) {
              existing = await dbGet(`SELECT item_id FROM item_master WHERE sku = ? LIMIT 1`, [item.sku]);
            }
            // Fallback to Name + Category
            if (!existing) {
              existing = await dbGet(`SELECT item_id FROM item_master WHERE item_name = ? AND category = ? LIMIT 1`, [itemName, cat]);
            }

            if (existing) {
              if (item.dot_number) {
                // Use variant logic for any item with a DOT number, regardless of category
                const { item_id: variantId } = await findOrCreateDotVariant(
                  existing.item_id, 
                  item.dot_number, 
                  cost, 
                  sellPrice, 
                  created_by || "PURCHASE"
                );
                item_master_id = variantId;
              } else {
                item_master_id = existing.item_id;
                await dbRun(
                  `UPDATE item_master SET unit_cost = ?, selling_price = ? WHERE item_id = ?`,
                  [cost, sellPrice, item_master_id]
                );
              }
            } else {
              // Create new record
              const new_id = `ITM-${uuidv4().split("-")[0].toUpperCase()}`;
              const sku = item.sku || `SKU-${uuidv4().split("-")[0].toUpperCase()}`;
              const upperBrand = item.brand ? item.brand.toUpperCase() : null;
              const upperDesign = item.design ? item.design.toUpperCase() : null;
              try {
                await dbRun(
                  `INSERT INTO item_master (item_id, sku, item_name, category, brand, design, size, rim_size, unit_cost, selling_price, dot_number, is_active, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
                  [new_id, sku, itemName, cat, upperBrand, upperDesign, item.size || null, item.rim_size || null, cost, sellPrice, item.dot_number || null, now]
                );
                item_master_id = new_id;
              } catch (err) {
                // If insertion failed, it's likely a SKU collision not caught by our initial find (e.g. concurrent request or case diff)
                if (item.sku) {
                  const collided = await dbGet(`SELECT item_id FROM item_master WHERE sku = ? LIMIT 1`, [item.sku]);
                  if (collided) {
                    if (item.dot_number) {
                      const { item_id: variantId } = await findOrCreateDotVariant(
                        collided.item_id, 
                        item.dot_number, 
                        cost, 
                        sellPrice, 
                        created_by || "PURCHASE"
                      );
                      item_master_id = variantId;
                    } else {
                      item_master_id = collided.item_id;
                      await dbRun(
                        `UPDATE item_master SET unit_cost = ?, selling_price = ? WHERE item_id = ?`,
                        [cost, sellPrice, item_master_id]
                      );
                    }
                  }
                }
              }
            }
          }
        }

        // Insert purchase item record
        await dbRun(
          `INSERT INTO purchase_items (purchase_item_id, purchase_id, shop_id, item_name, category, quantity, unit_cost, selling_price, line_total, item_master_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [purchase_item_id, purchase_id, shop_id, itemName, cat, qty, cost, sellPrice, line, item_master_id]
        );

        insertedItems.push({ 
          ...item, 
          purchase_item_id, 
          item_master_id, 
          line_total: line,
          selling_price: sellPrice
        });

        // Add to inventory ledger if it's an inventory item
        if (item_master_id) {
          const inv_id = `INVTXN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          await dbRun(
            `INSERT INTO inventory_ledger (inventory_ledger_id, shop_id, item_id, transaction_type, quantity, unit_cost, reference_id, dot_number, supplier_id, created_by, created_at)
             VALUES (?, ?, ?, 'PURCHASE', ?, ?, ?, ?, ?, ?, ?)`,
            [inv_id, shop_id, item_master_id, qty, cost, purchase_id, item.dot_number || null, item.supplier_id || null, created_by || "PURCHASE", now]
          );
          itemIdsToSync.push(item_master_id);
        }
      }

      // Final stock sync
      if (itemIdsToSync.length > 0) {
        await syncCurrentStock(shop_id, itemIdsToSync);
      }

      return insertedItems;
    });

    res.json({ purchase_id, total_amount, items: result });
  } catch (err) {
    console.error("Purchase creation error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Void purchase ────────────────────────────────────────────────────────────
router.patch("/purchases/:purchase_id/void", async (req, res) => {
  const { purchase_id } = req.params;
  const { void_reason } = req.body;

  db.get(`SELECT is_void, shop_id FROM purchase_header WHERE purchase_id = ?`, [purchase_id], (err, header) => {
    if (err || !header) return res.status(404).json({ error: "Purchase not found" });
    if (header.is_void) return res.status(400).json({ error: "Purchase is already voided" });

    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      db.run(
        `UPDATE purchase_header SET is_void = 1, void_reason = ? WHERE purchase_id = ?`,
        [void_reason || "VOIDED", purchase_id]
      );

      // Revert inventory stock
      db.all(`SELECT item_master_id, quantity, unit_cost FROM purchase_items WHERE purchase_id = ? AND item_master_id IS NOT NULL`, [purchase_id], (err2, items) => {
        if (err2) { db.run("ROLLBACK"); return res.status(500).json({ error: err2.message }); }

        if (items && items.length > 0) {
          const now = new Date().toISOString();
          for (const item of items) {
            const inv_id = `VOID-${uuidv4().split("-")[0].toUpperCase()}`;
            db.run(
              `INSERT INTO inventory_ledger (inventory_ledger_id, shop_id, item_id, transaction_type, quantity, unit_cost, reference_id, created_by, created_at)
               VALUES (?, ?, ?, 'ADJUSTMENT', ?, ?, ?, 'SYSTEM', ?)`,
              [inv_id, header.shop_id, item.item_master_id, -Math.abs(item.quantity), item.unit_cost, `VOID-${purchase_id}`, now]
            );
          }
        }

        db.run("COMMIT", async (err3) => {
          if (err3) return res.status(500).json({ error: err3.message });
          
          // Re-sync current stock for all items involved
          const itemIds = [...new Set(items.map(i => i.item_master_id))];
          try {
            await syncCurrentStock(header.shop_id, itemIds);
          } catch (syncErr) {
            console.error("Stock sync error after void:", syncErr);
          }
          
          res.json({ ok: true, message: "Purchase voided and stock reverted" });
        });
      });
    });
  });
});

// ── Edit purchase header ──────────────────────────────────────────────────────
router.patch("/purchases/:purchase_id", (req, res) => {
  const { purchase_id } = req.params;
  const { notes, purchase_date, handled_by } = req.body;

  const updates = [];
  const params = [];
  if (notes !== undefined) { updates.push("notes = ?"); params.push(notes); }
  if (purchase_date !== undefined) { updates.push("purchase_date = ?"); params.push(purchase_date); }
  if (handled_by !== undefined) { updates.push("handled_by = ?"); params.push(handled_by); }

  if (updates.length === 0) return res.json({ ok: true, message: "No changes" });

  params.push(purchase_id);
  db.run(
    `UPDATE purchase_header SET ${updates.join(", ")} WHERE purchase_id = ?`,
    params,
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, message: "Purchase updated" });
    }
  );
});

// ── Edit purchase item (Full Edit) ──────────────────────────────────────────────
router.put("/purchase-items/:purchase_item_id", (req, res) => {
  const { purchase_item_id } = req.params;
  const {
    item_name,
    category,
    quantity,
    unit_cost,
    selling_price,
    notes,
    brand,
    design,
    size,
    dot_number
  } = req.body;

  const newQty = parseFloat(quantity) || 1;
  const newCost = parseFloat(unit_cost) || 0;
  const newSelling = parseFloat(selling_price) || 0;
  const newLineTotal = newQty * newCost;

  db.get(`SELECT * FROM purchase_items WHERE purchase_item_id = ?`, [purchase_item_id], (err, oldItem) => {
    if (err || !oldItem) return res.status(404).json({ error: "Item not found" });

    db.serialize(() => {
      db.run("BEGIN TRANSACTION");

      // 1. Update purchase_items
      db.run(
        `UPDATE purchase_items
         SET item_name = ?, category = ?, quantity = ?, unit_cost = ?, selling_price = ?, line_total = ?
         WHERE purchase_item_id = ?`,
        [item_name, category, newQty, newCost, newSelling, newLineTotal, purchase_item_id],
        (err2) => {
          if (err2) { db.run("ROLLBACK"); return res.status(500).json({ error: err2.message }); }

          // 2. Recalculate purchase_header total
          db.get(`SELECT SUM(line_total) as new_total FROM purchase_items WHERE purchase_id = ?`, [oldItem.purchase_id], (err3, sumRow) => {
            if (err3) { db.run("ROLLBACK"); return res.status(500).json({ error: err3.message }); }

            db.run(
              `UPDATE purchase_header SET total_amount = ?, notes = ? WHERE purchase_id = ?`,
              [sumRow.new_total || 0, notes || null, oldItem.purchase_id]
            );

            // 3. Inventory updates if applicable
            if (oldItem.item_master_id) {
              const qtyDelta = newQty - oldItem.quantity;
              
              // Update item_master
              const upperBrand = brand ? brand.toUpperCase() : null;
              const upperDesign = design ? design.toUpperCase() : null;
              db.run(
                `UPDATE item_master
                 SET item_name = ?, category = ?, brand = ?, design = ?, size = ?, unit_cost = ?, selling_price = ?, dot_number = ?
                 WHERE item_id = ?`,
                [item_name, category, upperBrand, upperDesign, size || null, newCost, newSelling, dot_number || null, oldItem.item_master_id]
              );

              // Add adjustment to ledger if qty changed
              if (qtyDelta !== 0) {
                const inv_id = `ADJ-${uuidv4().split("-")[0].toUpperCase()}`;
                const now = new Date().toISOString();
                db.run(
                  `INSERT INTO inventory_ledger (inventory_ledger_id, shop_id, item_id, transaction_type, quantity, unit_cost, reference_id, created_by, created_at)
                   VALUES (?, ?, ?, 'ADJUSTMENT', ?, ?, ?, 'SYSTEM', ?)`,
                  [inv_id, oldItem.shop_id, oldItem.item_master_id, qtyDelta, newCost, `EDIT-${oldItem.purchase_id}`, now]
                );
              }
            }

            db.run("COMMIT", async (err4) => {
              if (err4) return res.status(500).json({ error: err4.message });
              
              // Re-sync current stock if it's an inventory item
              if (oldItem.item_master_id) {
                try {
                  await syncCurrentStock(oldItem.shop_id, [oldItem.item_master_id]);
                } catch (syncErr) {
                  console.error("Stock sync error after edit:", syncErr);
                }
              }
              
              res.json({ ok: true, message: "Purchase updated successfully" });
            });
          });
        }
      );
    });
  });
});

module.exports = router;
