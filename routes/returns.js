const express = require("express");
const router = express.Router();
const { db } = require("../Database");
const { getEffectiveISO } = require("../lib/businessDate");

const dbRun = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, function(e) { e ? rej(e) : res(this) }));
const dbGet = (sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => e ? rej(e) : res(r)));
const dbAll = (sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => e ? rej(e) : res(r || [])));

// ── GET /returns/:shop_id ─────────────────────────────────────────────────────
router.get("/returns/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  const { type, status, scenario, from, to } = req.query;
  let query = `
    SELECT r.*, im.item_name, im.sku, im.brand, im.design, im.size,
      sm.supplier_name,
      ri.item_name AS replacement_item_name
    FROM returns r
    JOIN item_master im ON r.item_id = im.item_id
    LEFT JOIN supplier_master sm ON r.supplier_id = sm.supplier_id
    LEFT JOIN item_master ri ON r.replacement_item_id = ri.item_id
    WHERE r.shop_id = ?
  `;
  const params = [shop_id];
  if (type)     { query += ` AND r.return_type = ?`;     params.push(type); }
  if (status)   { query += ` AND r.status = ?`;          params.push(status); }
  if (scenario) { query += ` AND r.return_scenario = ?`; params.push(scenario); }
  if (from)     { query += ` AND DATE(r.created_at) >= ?`; params.push(from); }
  if (to)       { query += ` AND DATE(r.created_at) <= ?`; params.push(to); }
  query += ` ORDER BY r.created_at DESC`;
  db.all(query, params, (err, rows) => {
    if (err) return res.json({ error: err.message });
    res.json(rows || []);
  });
});

// ── GET /returns/:shop_id/search-sale ─────────────────────────────────────────
router.get("/returns/:shop_id/search-sale", (req, res) => {
  const { shop_id } = req.params;
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  const term = `%${q}%`;
  db.all(
    `SELECT sh.sale_id, sh.sale_datetime, sh.total_amount, sh.invoice_number,
       cm.customer_name
     FROM sale_header sh
     LEFT JOIN customer_master cm ON sh.customer_id = cm.customer_id
     WHERE sh.shop_id = ?
       AND (sh.sale_id LIKE ? OR sh.invoice_number LIKE ? OR cm.customer_name LIKE ?)
     ORDER BY sh.sale_datetime DESC
     LIMIT 15`,
    [shop_id, term, term, term],
    (err, rows) => {
      if (err) return res.json({ error: err.message });
      res.json(rows || []);
    }
  );
});

// ── GET /returns/sale/:sale_id/items ──────────────────────────────────────────
router.get("/returns/sale/:sale_id/items", (req, res) => {
  const { sale_id } = req.params;
  db.all(
    `SELECT si.sale_item_id, si.item_or_service_id AS item_id, si.item_name, si.sku,
       si.quantity, si.unit_price, si.line_total, si.sale_type,
       si.brand, si.design, si.tire_size AS size,
       COALESCE((
         SELECT SUM(r2.quantity) FROM returns r2
         WHERE r2.original_sale_item_id = si.sale_item_id
           AND r2.return_type = 'CUSTOMER_RETURN'
           AND r2.status NOT IN ('CANCELLED')
       ), 0) AS already_returned
     FROM sale_items si
     WHERE si.sale_id = ? AND si.sale_type = 'PRODUCT'`,
    [sale_id],
    (err, rows) => {
      if (err) return res.json({ error: err.message });
      const returnable = (rows || []).map(r => ({
        ...r,
        returnable_qty: r.quantity - r.already_returned
      })).filter(r => r.returnable_qty > 0);
      res.json(returnable);
    }
  );
});

// ── GET /returns/:shop_id/search-order ────────────────────────────────────────
router.get("/returns/:shop_id/search-order", (req, res) => {
  const { shop_id } = req.params;
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  const term = `%${q}%`;
  db.all(
    `SELECT o.order_id, o.created_at, o.total_amount, o.status, o.received_at
     FROM orders o
     WHERE o.shop_id = ? AND o.status = 'RECEIVED'
       AND o.order_id LIKE ?
     ORDER BY o.received_at DESC
     LIMIT 15`,
    [shop_id, term],
    (err, rows) => {
      if (err) return res.json({ error: err.message });
      res.json(rows || []);
    }
  );
});

// ── GET /returns/:shop_id/sale-ids ────────────────────────────────────────────
router.get("/returns/:shop_id/sale-ids", (req, res) => {
  const { shop_id } = req.params;
  db.all(
    `SELECT sh.sale_id, sh.invoice_number, sh.sale_datetime, cm.customer_name
     FROM sale_header sh
     LEFT JOIN customer_master cm ON sh.customer_id = cm.customer_id
     WHERE sh.shop_id = ?
     ORDER BY sh.sale_datetime DESC
     LIMIT 500`,
    [shop_id],
    (err, rows) => {
      if (err) return res.json({ error: err.message });
      res.json(rows || []);
    }
  );
});

// ── GET /returns/:shop_id/order-ids ───────────────────────────────────────────
router.get("/returns/:shop_id/order-ids", (req, res) => {
  const { shop_id } = req.params;
  db.all(
    `SELECT o.order_id, o.received_at, o.total_amount
     FROM orders o
     WHERE o.shop_id = ? AND o.status = 'RECEIVED'
     ORDER BY o.received_at DESC
     LIMIT 500`,
    [shop_id],
    (err, rows) => {
      if (err) return res.json({ error: err.message });
      res.json(rows || []);
    }
  );
});

// ── GET /returns/order/:order_id/items ────────────────────────────────────────
router.get("/returns/order/:order_id/items", (req, res) => {
  const { order_id } = req.params;
  db.all(
    `SELECT oi.order_item_id, oi.item_id, im.item_name, im.sku,
       im.brand, im.design, im.size, oi.quantity, oi.unit_cost,
       oi.supplier_id, sm.supplier_name,
       COALESCE((
         SELECT SUM(r2.quantity) FROM returns r2
         WHERE r2.original_order_item_id = oi.order_item_id
           AND r2.return_type = 'SUPPLIER_RETURN'
           AND r2.status NOT IN ('CANCELLED')
       ), 0) AS already_returned
     FROM order_items oi
     JOIN item_master im ON oi.item_id = im.item_id
     LEFT JOIN supplier_master sm ON oi.supplier_id = sm.supplier_id
     WHERE oi.order_id = ? AND oi.received_status = 'RECEIVED'`,
    [order_id],
    (err, rows) => {
      if (err) return res.json({ error: err.message });
      const returnable = (rows || []).map(r => ({
        ...r,
        returnable_qty: r.quantity - r.already_returned
      })).filter(r => r.returnable_qty > 0);
      res.json(returnable);
    }
  );
});

// ── GET /returns/:shop_id/stock-search ── search in-stock items for replacement
router.get("/returns/:shop_id/stock-search", (req, res) => {
  const { shop_id } = req.params;
  const { q } = req.query;
  if (!q || q.length < 1) return res.json([]);
  const term = `%${q}%`;
  db.all(
    `SELECT im.item_id, im.item_name, im.sku, im.brand, im.design, im.size,
       COALESCE(cs.current_quantity, 0) AS on_hand,
       0 AS unit_cost
     FROM item_master im
     LEFT JOIN current_stock cs ON cs.item_id = im.item_id AND cs.shop_id = ?
     WHERE (im.item_name LIKE ? OR im.sku LIKE ? OR im.brand LIKE ? OR im.size LIKE ?)
       AND COALESCE(cs.current_quantity, 0) > 0
     ORDER BY im.item_name ASC
     LIMIT 20`,
    [shop_id, term, term, term, term],
    (err, rows) => {
      if (err) return res.json({ error: err.message });
      res.json(rows || []);
    }
  );
});

// ── GET /returns/:shop_id/stock-check/:item_id ── check stock for a specific item
router.get("/returns/:shop_id/stock-check/:item_id", (req, res) => {
  const { shop_id, item_id } = req.params;
  db.get(
    `SELECT im.item_id, im.item_name, im.sku, im.brand, im.design, im.size,
       COALESCE(cs.current_quantity, 0) AS on_hand
     FROM item_master im
     LEFT JOIN current_stock cs ON cs.item_id = im.item_id AND cs.shop_id = ?
     WHERE im.item_id = ?`,
    [shop_id, item_id],
    (err, row) => {
      if (err) return res.json({ error: err.message });
      res.json(row || null);
    }
  );
});

// ── POST /returns/customer ────────────────────────────────────────────────────
// Scenarios: FULL_REFUND | DEFECTIVE_REPLACE_NOW | DEFECTIVE_REPLACE_LATER | WARRANTY_CLAIM
router.post("/returns/customer", async (req, res) => {
  const {
    shop_id, items, reason, return_scenario = 'FULL_REFUND',
    refund_method, notes, created_by,
    // DEFECTIVE_REPLACE_NOW
    replacement_item_id, replacement_qty,
    // WARRANTY_CLAIM
    supplier_id, warranty_ref, warranty_sent_at,
    // customer info
    customer_name,
  } = req.body;

  if (!shop_id || !items || items.length === 0 || !reason) {
    return res.status(400).json({ error: "shop_id, items, and reason are required" });
  }

  try {
    const saleItemIds = items.map(i => i.sale_item_id).filter(Boolean);
    const saleItemInfo = saleItemIds.length > 0 
      ? await dbAll(`SELECT sale_item_id, is_custom FROM sale_items WHERE sale_item_id IN (${saleItemIds.map(() => '?').join(',')})`, saleItemIds)
      : [];
    const customMap = {};
    saleItemInfo.forEach(si => { customMap[si.sale_item_id] = si.is_custom; });

    await dbRun("BEGIN TRANSACTION");
    const ts = Date.now();
    const returnIds = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const return_id = `RET-CUST-${ts}-${i}`;
      const isCustom = customMap[item.sale_item_id] || (item.item_id && item.item_id.startsWith('MISC-'));
      returnIds.push(return_id);

      let status = 'PROCESSED';
      let inv_tx_id = null;

      if (return_scenario === 'FULL_REFUND') {
        // Restock the item only if NOT custom
        if (!isCustom) {
          inv_tx_id = `INVTXN-${ts}-CRET-${i}`;
          await dbRun(
            `INSERT INTO inventory_ledger
              (inventory_ledger_id, shop_id, item_id, transaction_type, quantity, unit_cost, reference_id, created_by, linked_return_id)
             VALUES (?, ?, ?, 'CUSTOMER_RETURN', ?, ?, ?, ?, ?)`,
            [inv_tx_id, shop_id, item.item_id, item.quantity, item.unit_price || 0, item.original_sale_id || null, created_by || 'SYSTEM', return_id]
          );
        }
        status = 'PROCESSED';
      } else if (return_scenario === 'DEFECTIVE_REPLACE_LATER') {
        // Don't restock — tire is defective, awaiting replacement
        status = 'REPLACEMENT_PENDING';
      } else if (return_scenario === 'WARRANTY_CLAIM') {
        // Don't restock — sent to supplier
        status = 'WARRANTY_PENDING';
      } else if (return_scenario === 'DEFECTIVE_REPLACE_NOW') {
        // Don't restock defective, but deduct replacement from stock (Replacements are always from master catalog)
        status = 'COMPLETED';
        if (replacement_item_id && String(replacement_item_id).trim() !== "") {
          const repl_inv_id = `INVTXN-${ts}-DREPL-${i}`;
          await dbRun(
            `INSERT INTO inventory_ledger
              (inventory_ledger_id, shop_id, item_id, transaction_type, quantity, unit_cost, reference_id, created_by, linked_return_id)
             VALUES (?, ?, ?, 'DEFECTIVE_REPLACEMENT', ?, ?, ?, ?, ?)`,
            [repl_inv_id, shop_id, replacement_item_id, -(replacement_qty || item.quantity), 0, return_id, created_by || 'SYSTEM', return_id]
          );
        } else {
          throw new Error("Replacement item ID is required for 'Replace from Stock' scenario.");
        }
      }

      const now = new Date().toISOString();
      await dbRun(
        `INSERT INTO returns
          (return_id, shop_id, return_type, return_scenario, reason, status,
           item_id, quantity, unit_cost,
           original_sale_id, original_sale_item_id,
           linked_inventory_tx_id,
           refund_method, replacement_item_id,
           supplier_id, warranty_ref, warranty_sent_at,
           customer_name, notes, created_by, processed_at)
         VALUES (?, ?, 'CUSTOMER_RETURN', ?, ?, ?,
                 ?, ?, ?,
                 ?, ?,
                 ?,
                 ?, ?,
                 ?, ?, ?,
                 ?, ?, ?, ?)`,
        [
          return_id, shop_id, return_scenario, reason, status,
          item.item_id, item.quantity, item.unit_price || 0,
          item.original_sale_id || null, item.sale_item_id || null,
          inv_tx_id,
          refund_method || null, replacement_item_id || null,
          supplier_id || null, warranty_ref || null, warranty_sent_at || null,
          customer_name || null, notes || null, created_by || 'SYSTEM', now
        ]
      );

      // For DEFECTIVE_REPLACE_NOW and DEFECTIVE_REPLACE_LATER:
      // auto-create a supplier return for the defective item.
      // The defective unit is NOT restocked — it's reserved to be sent back to supplier.
      // SKIP for custom items as they don't have a linked supplier in the catalog.
      if (!isCustom && (return_scenario === 'DEFECTIVE_REPLACE_NOW' || return_scenario === 'DEFECTIVE_REPLACE_LATER')) {
        const itemInfo = await dbGet(
          `SELECT item_id, item_name, supplier_id
           FROM item_master WHERE item_id = ?`,
          [item.item_id]
        );
        
        if (itemInfo) {
          const supp_return_id = `RET-SUPP-${ts}-${i}`;
          const suppNote = return_scenario === 'DEFECTIVE_REPLACE_NOW'
            ? `Auto-created: defective item from customer return ${return_id}. Replacement already dispatched from stock. Send defective unit to supplier for replenishment.`
            : `Auto-created: defective item from customer return ${return_id}. Item held — NOT restocked. Reserved to be returned to supplier. Replacement to be fulfilled when supplier sends stock.`;
          
          await dbRun(
            `INSERT INTO returns
              (return_id, shop_id, return_type, reason, status,
               item_id, quantity, unit_cost,
               supplier_id, replacement_return_id,
               notes, created_by, processed_at)
             VALUES (?, ?, 'SUPPLIER_RETURN', ?, 'REPLACEMENT_PENDING',
                     ?, ?, ?,
                     ?, ?,
                     ?, ?, CURRENT_TIMESTAMP)`,
            [
              supp_return_id, shop_id, 'DEFECTIVE',
              item.item_id, item.quantity, item.unit_price || 0,
              itemInfo.supplier_id || null, return_id,
              suppNote, created_by || 'SYSTEM'
            ]
          );
          returnIds.push(supp_return_id);
        }
      }
    }

    // Append return note to the original sale(s)
    const saleIds = [...new Set(items.map(i => i.original_sale_id).filter(Boolean))];
    const scenarioLabel = {
      FULL_REFUND: 'Full Refund',
      DEFECTIVE_REPLACE_NOW: 'Defective — Replaced from Stock',
      DEFECTIVE_REPLACE_LATER: 'Defective — Replacement Pending',
      WARRANTY_CLAIM: 'Warranty Claim',
    }[return_scenario] || return_scenario;

    const itemSummary = items.map(i => `${i.item_name} (x${i.quantity})`).join(', ');
    const dateStr = new Date().toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    const noteLines = [
      `[RETURN ${dateStr}]`,
      `Type: ${scenarioLabel}`,
      `Items: ${itemSummary}`,
      `Reason: ${reason}`,
      refund_method ? `Refund: ${refund_method}` : null,
      replacement_item_id ? `Replacement Item ID: ${replacement_item_id}` : null,
      warranty_ref ? `Warranty Ref: ${warranty_ref}` : null,
      notes ? `Notes: ${notes}` : null,
      `Ref: ${returnIds.join(', ')}`,
    ].filter(Boolean).join('\n');

    for (const sale_id of saleIds) {
      try {
        const existing = await dbGet(`SELECT sale_notes FROM sale_header WHERE sale_id = ?`, [sale_id]);
        if (existing) {
          const prev = existing.sale_notes ? existing.sale_notes + '\n\n' : '';
          await dbRun(`UPDATE sale_header SET sale_notes = ? WHERE sale_id = ?`, [prev + noteLines, sale_id]);
        }
      } catch (noteErr) {
        console.warn(`Failed to update sale notes for ${sale_id}:`, noteErr.message);
        // Continue — don't crash the whole return because of a note failure
      }
    }

    await dbRun("COMMIT");

    const messages = {
      FULL_REFUND: `${items.length} item(s) returned and restocked. Refund issued.`,
      DEFECTIVE_REPLACE_NOW: `Defective item(s) replaced from stock. Supplier return(s) auto-created — send defective unit(s) back to supplier for replenishment.`,
      DEFECTIVE_REPLACE_LATER: `Defective return logged. Item held out of sellable inventory. Supplier return created — send defective unit back to supplier and receive replacement when available.`,
      WARRANTY_CLAIM: `Warranty claim filed. Item(s) sent to supplier for testing.`,
    };

    res.json({ success: true, return_ids: returnIds, message: messages[return_scenario] || 'Return processed.' });
  } catch (e) {
    await dbRun("ROLLBACK").catch(() => {});
    res.status(500).json({ error: e.message });
  }
});

// ── POST /returns/supplier ────────────────────────────────────────────────────
router.post("/returns/supplier", async (req, res) => {
  const {
    shop_id, item_id, quantity, unit_cost, supplier_id, reason, notes,
    original_order_id, original_order_item_id, expect_replacement, created_by
  } = req.body;
  if (!shop_id || !item_id || !quantity || !reason) {
    return res.status(400).json({ error: "shop_id, item_id, quantity, and reason are required" });
  }

  const ts = Date.now();
  const return_id = `RET-SUPP-${ts}`;
  const inv_tx_id = `INVTXN-${ts}-SRET`;
  const status = expect_replacement ? "REPLACEMENT_PENDING" : "PROCESSED";

  try {
    await dbRun("BEGIN TRANSACTION");

    // Verify item exists to avoid foreign key failure
    const itemExists = await dbGet("SELECT item_id FROM item_master WHERE item_id = ?", [item_id]);
    if (!itemExists) throw new Error(`Item ${item_id} not found.`);

    await dbRun(
      `INSERT INTO inventory_ledger
        (inventory_ledger_id, shop_id, item_id, transaction_type, quantity, unit_cost, reference_id, supplier_id, created_by, linked_return_id)
       VALUES (?, ?, ?, 'SUPPLIER_RETURN', ?, ?, ?, ?, ?, ?)`,
      [inv_tx_id, shop_id, item_id, parseFloat(quantity), parseFloat(unit_cost) || 0, original_order_id || null, supplier_id || null, created_by || 'SYSTEM', return_id]
    );

    await dbRun(
      `INSERT INTO returns
        (return_id, shop_id, return_type, return_scenario, reason, status, item_id, quantity, unit_cost,
         original_order_id, original_order_item_id, supplier_id, linked_inventory_tx_id, notes, created_by, processed_at)
       VALUES (?, ?, 'SUPPLIER_RETURN', 'SUPPLIER_RETURN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        return_id, shop_id, reason, status, item_id, parseFloat(quantity), parseFloat(unit_cost) || 0,
        original_order_id || null, original_order_item_id || null, supplier_id || null, inv_tx_id, notes || null, created_by || 'SYSTEM'
      ]
    );

    await dbRun("COMMIT");
    res.json({
      success: true, return_id, status,
      message: expect_replacement ? "Item sent to supplier. Awaiting replacement." : "Supplier return processed."
    });
  } catch (e) {
    await dbRun("ROLLBACK").catch(() => {});
    res.status(500).json({ error: e.message });
  }
});

// ── POST /returns/:return_id/receive-replacement ── supplier replacement arrives
router.post("/returns/:return_id/receive-replacement", async (req, res) => {
  const { return_id } = req.params;
  const { quantity, dot_number, dr_number, created_by } = req.body;
  if (!dr_number) return res.status(400).json({ error: "DR number is required." });

  try {
    const ret = await dbGet("SELECT * FROM returns WHERE return_id = ?", [return_id]);
    if (!ret) return res.status(404).json({ error: "Return not found" });
    if (ret.status === "COMPLETED") return res.status(400).json({ error: "Already completed" });

    // Check if item is a tire (has dot_number requirement)
    const itemInfo = await dbGet(`SELECT item_name, sku FROM item_master WHERE item_id = ?`, [ret.item_id]);
    const isTire = itemInfo?.sku && /^(PCR|SUV|LT|TBR|OTR|MC)/i.test(itemInfo.sku);
    if (isTire && !dot_number) {
      return res.status(400).json({ error: "DOT number is required for tire items." });
    }

    const ts = Date.now();
    const repl_id = `RET-REPL-${ts}`;
    const inv_tx_id = `INVTXN-${ts}-REPL`;
    const qty = parseFloat(quantity) || ret.quantity;
    // Use original unit_cost from the return record — no reprice on warranty replacement
    const cost = ret.unit_cost || 0;

    // Build the new SKU with DOT if provided
    const dotSuffix = dot_number ? `-DOT${dot_number}` : '';
    const newSku = dot_number && itemInfo?.sku
      ? itemInfo.sku.replace(/-DOT\d+/i, '') + dotSuffix
      : itemInfo?.sku || null;

    // Check if this supplier return is linked to a DEFECTIVE_REPLACE_LATER customer return
    const linkedCustReturn = ret.replacement_return_id
      ? await dbGet(
          `SELECT return_id, return_scenario FROM returns WHERE return_id = ?`,
          [ret.replacement_return_id]
        )
      : null;
    const isReserved = linkedCustReturn?.return_scenario === 'DEFECTIVE_REPLACE_LATER';

    await dbRun("BEGIN TRANSACTION");

    if (isReserved) {
      // Reserved mode: item arrives but does NOT enter sellable inventory.
      // It is held for the customer to claim. Update SKU with new DOT only.
      if (dot_number && newSku) {
        await dbRun(`UPDATE item_master SET sku = ? WHERE item_id = ?`, [newSku, ret.item_id]);
      }
      // Mark supplier return COMPLETED (received from supplier)
      await dbRun(
        `UPDATE returns SET status='COMPLETED',
           notes=COALESCE(notes,'') || ' | DR: ' || ? || CASE WHEN ? IS NOT NULL THEN ' DOT: ' || ? ELSE '' END,
           processed_at=CURRENT_TIMESTAMP WHERE return_id=?`,
        [dr_number, dot_number || null, dot_number || null, return_id]
      );
      // Move linked customer return to READY_FOR_PICKUP
      await dbRun(
        `UPDATE returns SET status='READY_FOR_PICKUP', processed_at=CURRENT_TIMESTAMP WHERE return_id=?`,
        [linkedCustReturn.return_id]
      );
      await dbRun("COMMIT");
      return res.json({ success: true, reserved: true, message: "Replacement received and reserved for customer pickup. No inventory change — item is held until customer claims it." });
    }

    // Normal mode: add to sellable inventory
    await dbRun(
      `INSERT INTO inventory_ledger
        (inventory_ledger_id, shop_id, item_id, transaction_type, quantity, unit_cost, reference_id, supplier_id, created_by, linked_return_id, dot_number)
       VALUES (?, ?, ?, 'SUPPLIER_REPLACEMENT', ?, ?, ?, ?, ?, ?, ?)`,
      [inv_tx_id, ret.shop_id, ret.item_id, qty, cost, return_id, ret.supplier_id || null, created_by || 'SYSTEM', repl_id, dot_number || null]
    );
    if (dot_number && newSku) {
      await dbRun(`UPDATE item_master SET sku = ? WHERE item_id = ?`, [newSku, ret.item_id]);
    }
    await dbRun(
      `INSERT INTO returns
        (return_id, shop_id, return_type, return_scenario, reason, status, item_id, quantity, unit_cost,
         original_order_id, supplier_id, linked_inventory_tx_id, replacement_return_id, notes, created_by, processed_at)
       VALUES (?, ?, 'SUPPLIER_REPLACEMENT', 'SUPPLIER_RETURN', ?, 'PROCESSED', ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [repl_id, ret.shop_id, ret.reason, ret.item_id, qty, cost,
       ret.original_order_id || null, ret.supplier_id || null, inv_tx_id, return_id,
       `DR: ${dr_number}${dot_number ? ` — DOT ${dot_number}` : ''} — Replacement received for ${return_id}`, created_by || 'SYSTEM']
    );
    await dbRun(
      `UPDATE returns SET status='COMPLETED', replacement_return_id=?, processed_at=CURRENT_TIMESTAMP WHERE return_id=?`,
      [repl_id, return_id]
    );
    await dbRun("COMMIT");
    res.json({ success: true, repl_return_id: repl_id, message: "Replacement received and added to inventory." });
  } catch (e) {
    await dbRun("ROLLBACK").catch(() => {});
    res.status(500).json({ error: e.message });
  }
});

// ── POST /returns/:return_id/complete-handover ── customer arrives to claim reserved replacement
router.post("/returns/:return_id/complete-handover", async (req, res) => {
  const { return_id } = req.params;
  const { notes, created_by } = req.body;
  try {
    const ret = await dbGet("SELECT * FROM returns WHERE return_id = ?", [return_id]);
    if (!ret) return res.status(404).json({ error: "Return not found" });
    if (ret.status !== 'READY_FOR_PICKUP') return res.status(400).json({ error: "Return is not ready for pickup" });
    await dbRun(
      `UPDATE returns SET status='COMPLETED', notes=COALESCE(notes||' | ','') || ?, processed_at=CURRENT_TIMESTAMP WHERE return_id=?`,
      [`Handed over to customer${notes ? ': ' + notes : ''}`, return_id]
    );
    res.json({ success: true, message: "Replacement handed over to customer. Return marked completed." });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /returns/:return_id/warranty-result ── record supplier warranty testing result
router.post("/returns/:return_id/warranty-result", async (req, res) => {
  const { return_id } = req.params;
  const { warranty_result, notes, created_by } = req.body;
  // warranty_result: COVERED | NOT_COVERED | PARTIAL
  if (!['COVERED', 'NOT_COVERED', 'PARTIAL'].includes(warranty_result)) {
    return res.status(400).json({ error: "warranty_result must be COVERED, NOT_COVERED, or PARTIAL" });
  }

  try {
    const ret = await dbGet("SELECT * FROM returns WHERE return_id = ?", [return_id]);
    if (!ret) return res.status(404).json({ error: "Return not found" });

    const newStatus = warranty_result === 'COVERED' ? 'REPLACEMENT_PENDING' : 'RESOLVED';

    await dbRun(
      `UPDATE returns SET warranty_result=?, status=?, notes=COALESCE(?,notes), processed_at=CURRENT_TIMESTAMP WHERE return_id=?`,
      [warranty_result, newStatus, notes || null, return_id]
    );

    res.json({
      success: true,
      warranty_result,
      status: newStatus,
      message: warranty_result === 'COVERED'
        ? 'Warranty approved. Now awaiting replacement from supplier.'
        : warranty_result === 'PARTIAL'
        ? 'Partial warranty approved. Please handle refund manually.'
        : 'Warranty claim rejected by supplier.'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /returns/:return_id/fulfill-replacement ── replacement ready for pending customer return
// mode: 'from_stock'   — deduct existing stock item for customer
// mode: 'new_delivery' — receive new delivery (adds to stock) then deduct for customer
router.post("/returns/:return_id/fulfill-replacement", async (req, res) => {
  const { return_id } = req.params;
  const { mode = 'from_stock', replacement_item_id, dr_number, dot_number, notes, created_by } = req.body;

  try {
    const ret = await dbGet("SELECT * FROM returns WHERE return_id = ?", [return_id]);
    if (!ret) return res.status(404).json({ error: "Return not found" });
    if (ret.status !== 'REPLACEMENT_PENDING') {
      return res.status(400).json({ error: "Return is not pending replacement" });
    }

    if (mode === 'new_delivery' && !dr_number) {
      return res.status(400).json({ error: "DR number is required for new delivery." });
    }
    const itemInfo = mode === 'new_delivery'
      ? await dbGet(`SELECT sku FROM item_master WHERE item_id = ?`, [ret.item_id])
      : null;
    const isTire = /^(PCR|SUV|LT|TBR|OTR|MC)/i.test(itemInfo?.sku || '');
    if (mode === 'new_delivery' && isTire && !dot_number) {
      return res.status(400).json({ error: "DOT number is required for tire items." });
    }
    if (mode === 'new_delivery' && isTire && !/^\d{4}$/.test(dot_number)) {
      return res.status(400).json({ error: "DOT number must be exactly 4 digits." });
    }

    const itemId = replacement_item_id || ret.item_id;
    const ts = Date.now();

    await dbRun("BEGIN TRANSACTION");

    if (mode === 'new_delivery') {
      // Step 1: Receive incoming delivery into stock
      const recv_tx_id = `INVTXN-${ts}-RECV`;
      await dbRun(
        `INSERT INTO inventory_ledger
          (inventory_ledger_id, shop_id, item_id, transaction_type, quantity, unit_cost, reference_id, created_by, linked_return_id, dot_number)
         VALUES (?, ?, ?, 'SUPPLIER_REPLACEMENT', ?, 0, ?, ?, ?, ?)`,
        [recv_tx_id, ret.shop_id, itemId, ret.quantity, `DR-${dr_number}`, created_by || 'SYSTEM', return_id, dot_number || null]
      );
      // Update SKU with new DOT if provided
      if (dot_number && itemInfo?.sku) {
        const newSku = itemInfo.sku.replace(/-DOT\d+/i, '') + `-DOT${dot_number}`;
        await dbRun(`UPDATE item_master SET sku = ? WHERE item_id = ?`, [newSku, itemId]);
      }
    }

    // Deduct replacement from stock (from_stock uses existing; new_delivery uses just-received)
    const inv_tx_id = `INVTXN-${ts}-FULFIL`;
    await dbRun(
      `INSERT INTO inventory_ledger
        (inventory_ledger_id, shop_id, item_id, transaction_type, quantity, unit_cost, reference_id, created_by, linked_return_id)
       VALUES (?, ?, ?, 'DEFECTIVE_REPLACEMENT', ?, 0, ?, ?, ?)`,
      [inv_tx_id, ret.shop_id, itemId, -ret.quantity, return_id, created_by || 'SYSTEM', return_id]
    );
    await dbRun(
      `UPDATE returns SET status='COMPLETED', replacement_item_id=?, notes=COALESCE(?,notes), processed_at=CURRENT_TIMESTAMP WHERE return_id=?`,
      [itemId, notes || null, return_id]
    );
    await dbRun("COMMIT");

    res.json({ success: true, message: "Replacement fulfilled. Stock adjusted." });
  } catch (e) {
    await dbRun("ROLLBACK").catch(() => {});
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /returns/:return_id/cancel ────────────────────────────────────────────
router.put("/returns/:return_id/cancel", (req, res) => {
  const { return_id } = req.params;
  const { reason } = req.body;
  db.run(
    `UPDATE returns SET status='CANCELLED', notes=COALESCE(?,notes)
     WHERE return_id=? AND status NOT IN ('COMPLETED','CANCELLED')`,
    [reason || null, return_id],
    function(err) {
      if (err) return res.status(400).json({ error: err.message });
      if (this.changes === 0) return res.status(400).json({ error: "Cannot cancel this return" });
      res.json({ return_id, status: "CANCELLED" });
    }
  );
});

module.exports = router;
