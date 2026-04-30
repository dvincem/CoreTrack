const express = require("express");
const router = express.Router();
const { db } = require("../Database");
const itemsRouter = require("./items");
const findOrCreateDotVariant = itemsRouter.findOrCreateDotVariant;
const logPriceHistory = itemsRouter.logPriceHistory;

router.post("/orders", (req, res) => {
  const { shop_id, order_notes, items = [], new_items = [] } = req.body;
  if (!shop_id || (items.length === 0 && new_items.length === 0)) {
    return res.status(400).json({ error: "Shop ID and at least one item are required" });
  }

  // Auto-generate SKU for a new item
  function buildSku(ni) {
    const cat = (ni.category || 'MISC').toUpperCase().replace(/\s+/g, '');
    const brand = (ni.brand || '').toUpperCase().replace(/\s+/g, '').substring(0, 4);
    const design = (ni.design || '').toUpperCase().replace(/\s+/g, '').substring(0, 4);
    const size = (ni.size || '').replace(/\s+/g, '');
    return `${cat}-${brand}-${design}-${size}-${Date.now().toString().slice(-4)}`;
  }

  // Create new items in item_master first, then build the full items list
  const createNewItems = (callback) => {
    if (new_items.length === 0) return callback(null, []);
    let created = [];
    let pending = new_items.length;
    for (const ni of new_items) {
      const item_id = `ITEM-NEW-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
      const sku = buildSku(ni);
      const upperBrand = ni.brand ? ni.brand.toUpperCase() : null;
      const upperDesign = ni.design ? ni.design.toUpperCase() : null;
      const item_name = [upperBrand, upperDesign, ni.size].filter(Boolean).join(' ');
      db.run(
        `INSERT INTO item_master (item_id, sku, item_name, category, brand, design, size, unit_cost, selling_price, supplier_id, reorder_point, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
        [item_id, sku, item_name, ni.category || 'MISC', upperBrand, upperDesign, ni.size || null,
         parseFloat(ni.unit_cost) || 0, parseFloat(ni.selling_price) || 0, ni.supplier_id || null,
         parseInt(ni.reorder_point) || 0],
        function(err) {
          if (err) {
            console.error("item_master insert error:", err.message, { item_id, sku, item_name });
          } else {
            created.push({ item_id, sku, item_name, quantity: ni.quantity, unit_cost: ni.unit_cost, selling_price: ni.selling_price, supplier_id: ni.supplier_id, reorder_point: ni.reorder_point || 0, is_new_item: 1 });
          }
          pending--;
          if (pending === 0) callback(null, created);
        }
      );
    }
  };

  createNewItems((err, createdItems) => {
    if (err) return res.status(500).json({ error: err.message });
    const allItems = [...items, ...createdItems];
    const order_id = `ORD-${Date.now()}`;
    const total_amount = allItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);

    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      db.run(
        `INSERT INTO orders (order_id, shop_id, total_amount, order_notes, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [order_id, shop_id, total_amount, order_notes || null, "INVENTORY", new Date().toISOString()]
      );
      for (const item of allItems) {
        const order_item_id = `ORDITEM-${Date.now()}-${Math.random()}`;
        db.run(
          `INSERT INTO order_items (order_item_id, order_id, item_id, quantity, unit_cost, line_total, supplier_id, is_new_item) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [order_item_id, order_id, item.item_id, item.quantity, item.unit_cost, item.quantity * item.unit_cost, item.supplier_id || null, item.is_new_item || 0],
          function(itemErr) {
            if (itemErr) console.error("order_item insert error:", itemErr.message, "item_id:", item.item_id);
          }
        );
      }
      db.run("COMMIT", function(commitErr) {
        if (commitErr) {
          db.run("ROLLBACK");
          return res.status(500).json({ error: commitErr.message });
        }
        res.json({ order_id, shop_id, total_amount, status: "PENDING", items_count: allItems.length, new_items_created: createdItems.length, created_at: new Date().toISOString() });
      });
    });
  });
});

router.get("/orders/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  const { status, supplier_id, q, page, perPage } = req.query;
  const paginated = page !== undefined || perPage !== undefined || q !== undefined || supplier_id !== undefined;

  const whereParts = [`o.shop_id = ?`];
  const whereParams = [shop_id];
  if (status) { whereParts.push(`o.status = ?`); whereParams.push(status); }
  if (supplier_id) {
    whereParts.push(`EXISTS (SELECT 1 FROM order_items oi2 WHERE oi2.order_id = o.order_id AND oi2.supplier_id = ?)`);
    whereParams.push(supplier_id);
  }
  if (q && String(q).trim()) {
    const needle = `%${String(q).trim()}%`;
    whereParts.push(`(
      o.order_id LIKE ? OR o.order_notes LIKE ? OR o.delivery_receipt LIKE ?
      OR EXISTS (
        SELECT 1 FROM order_items oi3
        LEFT JOIN item_master im3 ON oi3.item_id = im3.item_id
        LEFT JOIN supplier_master sm3 ON oi3.supplier_id = sm3.supplier_id
        WHERE oi3.order_id = o.order_id
          AND (im3.item_name LIKE ? OR im3.sku LIKE ? OR im3.brand LIKE ?
               OR im3.design LIKE ? OR im3.size LIKE ? OR sm3.supplier_name LIKE ?)
      )
    )`);
    whereParams.push(needle, needle, needle, needle, needle, needle, needle, needle, needle);
  }
  const whereSql = `WHERE ${whereParts.join(" AND ")}`;

  const baseSelect = `
    SELECT o.order_id, o.shop_id, o.status,
      COALESCE(SUM(CASE WHEN oi.received_status != 'NOT_RECEIVED' THEN oi.line_total ELSE 0 END), o.total_amount) as total_amount,
      o.order_notes, o.delivery_receipt, o.created_at, o.created_by, COUNT(oi.order_item_id) as items_count
    FROM orders o LEFT JOIN order_items oi ON o.order_id = oi.order_id
    ${whereSql}
    GROUP BY o.order_id ORDER BY o.created_at DESC`;

  const hydrateItems = (orders, cb) => {
    if (!orders || orders.length === 0) return cb(null, orders || []);
    let pending = orders.length;
    orders.forEach((order) => {
      db.all(
        `SELECT oi.order_item_id, oi.item_id, im.item_name, im.sku, im.brand, im.design, im.size,
          oi.quantity, oi.unit_cost, oi.line_total, oi.received_status, oi.not_received_reason,
          oi.supplier_id, oi.is_new_item, oi.dot_number, sm.supplier_name, im.category
         FROM order_items oi LEFT JOIN item_master im ON oi.item_id = im.item_id
         LEFT JOIN supplier_master sm ON oi.supplier_id = sm.supplier_id
         WHERE oi.order_id = ? ORDER BY oi.created_at`,
        [order.order_id],
        (err, items) => {
          order.items = (items || []).map((item) => ({ ...item, displaySize: item.size || item.item_name || item.design || "Unknown" }));
          if (--pending === 0) cb(null, orders);
        },
      );
    });
  };

  if (!paginated) {
    db.all(baseSelect, whereParams, (err, orders) => {
      if (err) return res.json({ error: err.message });
      hydrateItems(orders, (_e, hydrated) => res.json(hydrated));
    });
    return;
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedPerPage = Math.min(200, Math.max(1, parseInt(perPage, 10) || 10));
  const offset = (parsedPage - 1) * parsedPerPage;

  db.get(`SELECT COUNT(DISTINCT o.order_id) as total FROM orders o ${whereSql}`, whereParams, (errC, row) => {
    if (errC) return res.json({ error: errC.message });
    const total = row?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / parsedPerPage));
    const pagedSql = `${baseSelect} LIMIT ? OFFSET ?`;
    db.all(pagedSql, [...whereParams, parsedPerPage, offset], (err, orders) => {
      if (err) return res.json({ error: err.message });
      hydrateItems(orders, (_e, hydrated) => {
        res.json({ data: hydrated, meta: { page: parsedPage, perPage: parsedPerPage, total, totalCount: total, totalPages } });
      });
    });
  });
});

router.get("/orders/:order_id/details", (req, res) => {
  const { order_id } = req.params;
  db.get(`SELECT * FROM orders WHERE order_id = ?`, [order_id], (err, order) => {
    if (err || !order) return res.status(404).json({ error: "Order not found" });
    db.all(
      `SELECT oi.order_item_id, oi.item_id, im.item_name, im.sku, im.brand, im.design, im.size,
              oi.quantity, oi.unit_cost, oi.line_total, oi.received_status, oi.not_received_reason,
              oi.supplier_id, oi.is_new_item, oi.dot_number, sm.supplier_name,
              im.category
       FROM order_items oi
       LEFT JOIN item_master im ON oi.item_id = im.item_id
       LEFT JOIN supplier_master sm ON oi.supplier_id = sm.supplier_id
       WHERE oi.order_id = ? ORDER BY oi.created_at`,
      [order_id],
      (err, items) => {
        if (err) return res.json({ error: err.message });
        res.json({ ...order, items: (items || []).map(i => ({ ...i, displaySize: i.size || i.item_name || i.design || "Unknown" })) });
      },
    );
  });
});

router.put("/orders/:order_id/status", (req, res) => {
  const { order_id } = req.params;
  const { status, reason } = req.body;
  if (!status || !["PENDING", "CONFIRMED", "RECEIVED", "CANCELLED"].includes(status)) {
    return res.status(400).json({ error: "Status must be PENDING, CONFIRMED, RECEIVED, or CANCELLED" });
  }
  if (status === "CANCELLED" && !reason) {
    return res.status(400).json({ error: "Cancellation reason is required" });
  }
  const notes = status === "CANCELLED" ? reason : null;
  db.run(
    `UPDATE orders SET status = ?, order_notes = CASE WHEN ? IS NOT NULL THEN ? ELSE order_notes END WHERE order_id = ?`,
    [status, notes, notes, order_id],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      res.json({ order_id, status, message: "Order status updated" });
    },
  );
});

router.post("/orders/:order_id/receive", async (req, res) => {
  const { order_id } = req.params;
  // received_items: [{order_item_id, quantity, unit_cost, dot_number}]
  // not_received_items: [{order_item_id, reason}]
  const { received_by, received_items: receivedItemsInput, not_received_items, delivery_receipt, payment_mode, check_info } = req.body;
  const reference_id = delivery_receipt || order_id;

  const dbGet = (sql, p) => new Promise((resolve, reject) => db.get(sql, p, (e, r) => e ? reject(e) : resolve(r)));
  const dbAll = (sql, p) => new Promise((resolve, reject) => db.all(sql, p, (e, r) => e ? reject(e) : resolve(r || [])));
  const dbRun = (sql, p) => new Promise((resolve, reject) => db.run(sql, p, function(e) { e ? reject(e) : resolve(this); }));

  let order, items;
  try {
    order = await dbGet(`SELECT * FROM orders WHERE order_id = ?`, [order_id]);
    if (!order) return res.status(404).json({ error: "Order not found" });
    items = await dbAll(`SELECT oi.*, im.category FROM order_items oi LEFT JOIN item_master im ON oi.item_id = im.item_id WHERE oi.order_id = ?`, [order_id]);
    if (!items.length) return res.status(400).json({ error: "No items in order" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  // Build received list with overridden qty/unit_cost/dot_number
  const receivedInput = receivedItemsInput || [];
  const receivedIds = receivedInput.map(i => i.order_item_id);
  let receivedItems = receivedInput.map(ri => {
    const original = items.find(i => i.order_item_id === ri.order_item_id) || {};
    return {
      ...original,
      quantity: parseFloat(ri.quantity) || original.quantity,
      unit_cost: !isNaN(parseFloat(ri.unit_cost)) ? parseFloat(ri.unit_cost) : (original.unit_cost || 0),
      dot_number: (ri.dot_number || '').trim() || original.dot_number || null,
    };
  });

  // ── Resolve DOT variants for TIRE items ──────────────────────────────────────
  // For each received tire item that has a dot_number, find-or-create a DOT variant
  // and replace the item_id with the variant's item_id.
  try {
    const TIRE_CATS = ['PCR','SUV','TBR','LT','MOTORCYCLE','TIRE','RECAP','TUBE'];
    for (const item of receivedItems) {
      const isTire = TIRE_CATS.includes((item.category || '').toUpperCase());
      if (isTire && item.dot_number) {
        const parentCheck = await dbGet(`SELECT dot_number, parent_item_id FROM item_master WHERE item_id = ?`, [item.item_id]);
        const parentItemId = (parentCheck && parentCheck.parent_item_id) ? parentCheck.parent_item_id : item.item_id;
        const { item_id: variantId } = await findOrCreateDotVariant(
          parentItemId, item.dot_number, item.unit_cost, null, received_by
        );
        await dbRun(`UPDATE order_items SET item_id = ? WHERE order_item_id = ?`, [variantId, item.order_item_id]);
        item.item_id = variantId;
      } else {
        // No DOT: update cost + apply same delta to selling price, log both
        const current = await dbGet(`SELECT unit_cost, selling_price FROM item_master WHERE item_id = ?`, [item.item_id]);
        if (current) {
          const newCost = parseFloat(item.unit_cost);
          const costDelta = newCost - (current.unit_cost || 0);
          if (Math.abs(costDelta) > 0.001) {
            const newPrice = (current.selling_price || 0) + costDelta;
            await dbRun(`UPDATE item_master SET unit_cost = ?, selling_price = ? WHERE item_id = ?`, [newCost, newPrice, item.item_id]);
            const ts = new Date().toISOString();
            logPriceHistory(item.item_id, 'UNIT_COST', current.unit_cost, newCost, received_by, null, ts);
            logPriceHistory(item.item_id, 'SELLING_PRICE', current.selling_price, newPrice, received_by, null, ts);
          }
        }
      }
    }
  } catch (e) {
    return res.status(500).json({ error: "DOT variant resolution failed: " + e.message });
  }

  db.serialize(() => {
    let operationsCompleted = 0;
    const totalOperations = 2;
    function checkComplete() {
      operationsCompleted++;
      if (operationsCompleted === totalOperations) updateOrderStatus();
    }
    if (not_received_items && not_received_items.length > 0) {
      const updateStmt = db.prepare(`UPDATE order_items SET received_status = ?, not_received_reason = ? WHERE order_item_id = ?`);
      for (const item of not_received_items) updateStmt.run(["NOT_RECEIVED", item.reason || "Not provided", item.order_item_id]);
      updateStmt.finalize(checkComplete);
    } else {
      checkComplete();
    }
    if (receivedItems.length > 0) {
      // Update order_items with actual received qty/unit_cost/dot_number
      const updateReceivedStmt = db.prepare(`UPDATE order_items SET received_status = ?, quantity = ?, unit_cost = ?, line_total = ?, dot_number = ? WHERE order_item_id = ?`);
      for (const item of receivedItems) {
        updateReceivedStmt.run(["RECEIVED", item.quantity, item.unit_cost, item.quantity * item.unit_cost, item.dot_number || null, item.order_item_id]);
      }
      updateReceivedStmt.finalize(() => {
        // Insert inventory ledger entries (item_id already resolved to DOT variant above)
        const stmt = db.prepare(`INSERT INTO inventory_ledger (inventory_ledger_id, shop_id, item_id, transaction_type, quantity, unit_cost, reference_id, supplier_id, dot_number, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        for (const item of receivedItems) {
          stmt.run([`INVTXN-${Date.now()}-${Math.random()}`, order.shop_id, item.item_id, "PURCHASE", item.quantity, item.unit_cost, reference_id, item.supplier_id || null, item.dot_number || null, received_by || "SYSTEM"]);
        }
        stmt.finalize(checkComplete);
      });
    } else {
      checkComplete();
    }
        // Auto-create payable entries grouped by supplier for all received items
        function createPayablesFromReceive(onDone) {
          db.all(
            `SELECT oi.order_item_id, oi.item_id,
                    COALESCE(im.item_name, '') as item_name,
                    COALESCE(im.brand, '') as brand,
                    COALESCE(im.design, '') as design,
                    COALESCE(im.size, '') as size,
                    oi.quantity, oi.unit_cost, oi.line_total,
                    oi.supplier_id,
                    COALESCE(sm.supplier_name, 'Unknown Supplier') as supplier_name,
                    sm.default_payment_terms_days
             FROM order_items oi
             LEFT JOIN item_master im ON oi.item_id = im.item_id
             LEFT JOIN supplier_master sm ON oi.supplier_id = sm.supplier_id
             WHERE oi.order_id = ? AND oi.received_status = 'RECEIVED'`,
            [order_id],
            (err, receivedRows) => {
              if (err || !receivedRows || receivedRows.length === 0) return onDone();
              // Group by supplier_id
              const bySupplier = {};
              for (const row of receivedRows) {
                const key = row.supplier_id || '__NOSUPPLIER__';
                if (!bySupplier[key]) bySupplier[key] = { supplier_id: row.supplier_id, supplier_name: row.supplier_name, payment_terms: row.default_payment_terms_days, rows: [] };
                bySupplier[key].rows.push(row);
              }
              const groups = Object.values(bySupplier);
              let pending = groups.length;
              if (pending === 0) return onDone();
              const drLabel = delivery_receipt ? `DR# ${delivery_receipt}` : '';
              for (const grp of groups) {
                const total = grp.rows.reduce((s, r) => s + (r.line_total || 0), 0);
                if (total <= 0) { pending--; if (pending === 0) onDone(); continue; }
                // Build due date from payment terms
                let due_date = null;
                if (grp.payment_terms && grp.payment_terms > 0) {
                  const d = new Date();
                  d.setDate(d.getDate() + grp.payment_terms);
                  due_date = d.toISOString().split('T')[0];
                }
                // Short description for the payable title
                const description = [`Order ${order_id}`, drLabel, grp.supplier_name].filter(Boolean).join(' — ');
                // Detailed notes: one line per item
                const itemLines = grp.rows.map(r => {
                  const label = [r.brand, r.design, r.size].filter(Boolean).join(' ') || r.item_name || r.item_id;
                  return `${label} | Qty: ${r.quantity} | Unit: ₱${Number(r.unit_cost).toFixed(2)} | Total: ₱${Number(r.line_total).toFixed(2)}`;
                });
                const notes = [
                  `Order: ${order_id}`,
                  drLabel ? `DR: ${delivery_receipt}` : null,
                  grp.payment_terms ? `Terms: ${grp.payment_terms} days` : null,
                  `---`,
                  ...itemLines,
                  `---`,
                  `Grand Total: ₱${Number(total).toFixed(2)}`
                ].filter(Boolean).join('\n');

                const payable_id = `PAY-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
                const mode = payment_mode || 'TERMS';
                // CASH → PAID immediately; CHECK → CHECK_RELEASED; TERMS → OPEN
                const initStatus = mode === 'CASH' ? 'PAID' : mode === 'CHECK' ? 'CHECK_RELEASED' : 'OPEN';
                const initPaid   = mode === 'CASH' ? total : 0;
                const initBal    = mode === 'CASH' ? 0 : total;
                const closedAt   = mode === 'CASH' ? new Date().toISOString() : null;
                db.run(
                  `INSERT INTO accounts_payable
                     (payable_id, shop_id, payable_type, supplier_id, reference_id, description, notes,
                      original_amount, amount_paid, balance_amount, status, due_date, created_by, closed_at)
                   VALUES (?, ?, 'SUPPLIER', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [payable_id, order.shop_id, grp.supplier_id || null,
                   `${order_id}${delivery_receipt ? '/' + delivery_receipt : ''}`,
                   description, notes, total, initPaid, initBal, initStatus, due_date,
                   received_by || 'SYSTEM', closedAt],
                  (pErr) => {
                    if (pErr) { console.error('Auto-payable insert error:', pErr.message); pending--; if (pending === 0) onDone(); return; }
                    // For CASH mode: insert a payment row as CASH on receipt
                    if (mode === 'CASH') {
                      const pay_id = `PAYPMT-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
                      db.run(
                        `INSERT INTO payable_payments
                           (payment_id, payable_id, shop_id, amount, payment_date, payment_method,
                            check_status, notes, recorded_by)
                         VALUES (?, ?, ?, ?, ?, 'CASH', 'CLEARED', ?, ?)`,
                        [pay_id, payable_id, order.shop_id, total,
                         new Date().toISOString(),
                         `Cash on receipt — DR# ${delivery_receipt || order_id}`,
                         received_by || 'SYSTEM'],
                        (pmtErr) => {
                          if (pmtErr) console.error('Auto-cash payment insert error:', pmtErr.message);
                          pending--;
                          if (pending === 0) onDone();
                        }
                      );
                    }
                    // For CHECK mode: immediately insert the payment row as RELEASED
                    else if (mode === 'CHECK' && check_info) {
                      const pay_id = `PAYPMT-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
                      db.run(
                        `INSERT INTO payable_payments
                           (payment_id, payable_id, shop_id, amount, payment_date, payment_method,
                            check_number, bank, check_date, release_date, check_status, notes, recorded_by)
                         VALUES (?, ?, ?, ?, ?, 'CHECK', ?, ?, ?, ?, 'RELEASED', ?, ?)`,
                        [pay_id, payable_id, order.shop_id, total,
                         new Date().toISOString(),
                         check_info.check_number || null, check_info.bank || null,
                         check_info.check_date || null, check_info.check_date || null,
                         `Check #${check_info.check_number} — ${check_info.bank}`,
                         received_by || 'SYSTEM'],
                        (pmtErr) => {
                          if (pmtErr) console.error('Auto-payable payment insert error:', pmtErr.message);
                          pending--;
                          if (pending === 0) onDone();
                        }
                      );
                    } else {
                      pending--;
                      if (pending === 0) onDone();
                    }
                  }
                );
              }
            }
          );
        }

        function updateOrderStatus() {
          db.run(
            `UPDATE orders SET status = ?, received_at = ?, received_by = ?, delivery_receipt = COALESCE(?, delivery_receipt), payment_mode = ? WHERE order_id = ?`,
            ["RECEIVED", new Date().toISOString(), received_by || "SYSTEM", delivery_receipt || null, payment_mode || "TERMS", order_id],
            function (err) {
              if (err) return res.status(400).json({ error: err.message });
              // Auto-create payables then handle restock / respond
              createPayablesFromReceive(() => {
                if (not_received_items && not_received_items.length > 0) {
                  const newOrderId = `${order_id}-RS`;
                  db.run(
                    `INSERT INTO orders (order_id, shop_id, status, total_amount, order_notes, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
                    [newOrderId, order.shop_id, "PENDING", 0, `Restock order for items not delivered from ${order_id}. Reasons: ${not_received_items.map((item) => item.reason || "Not provided").join("; ")}`, new Date().toISOString()],
                    function (err) {
                      if (err) {
                        return res.json({ order_id, status: "RECEIVED", items_received: receivedIds.length, items_not_received: not_received_items.length, total_amount: order.total_amount, message: "Items received. Failed to create restock order." });
                      }
                      let totalAmount = 0;
                      const itemStmt = db.prepare(`INSERT INTO order_items (order_item_id, order_id, item_id, quantity, unit_cost, line_total, received_status) VALUES (?, ?, ?, ?, ?, ?, ?)`);
                      for (const unreceivedItem of not_received_items) {
                        const originalItem = items.find((i) => i.order_item_id === unreceivedItem.order_item_id);
                        if (originalItem) {
                          const lineTotal = originalItem.quantity * originalItem.unit_cost;
                          totalAmount += lineTotal;
                          itemStmt.run([`OI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, newOrderId, originalItem.item_id, originalItem.quantity, originalItem.unit_cost, lineTotal, "PENDING"]);
                        }
                      }
                      itemStmt.finalize(() => {
                        db.run(`UPDATE orders SET total_amount = ? WHERE order_id = ?`, [totalAmount, newOrderId], () => {
                          res.json({ order_id, status: "RECEIVED", items_received: receivedIds.length, items_not_received: not_received_items.length, new_order_id: newOrderId, total_amount: order.total_amount, message: `Original order RECEIVED. Restock order ${newOrderId} created for unreceived items.` });
                        });
                      });
                    },
                  );
                } else {
                  res.json({ order_id, status: "RECEIVED", items_received: receivedIds.length, items_not_received: 0, total_amount: order.total_amount, message: "All items received and added to inventory." });
                }
              });
            },
          );
        }
      });
});

router.delete("/orders/:order_id/items/:order_item_id", (req, res) => {
  const { order_id, order_item_id } = req.params;
  db.run(`DELETE FROM order_items WHERE order_item_id = ?`, [order_item_id], function (err) {
    if (err) return res.status(400).json({ error: err.message });
    db.all(`SELECT SUM(line_total) as new_total FROM order_items WHERE order_id = ?`, [order_id], (err, result) => {
      const new_total = result && result[0] ? result[0].new_total || 0 : 0;
      db.run(`UPDATE orders SET total_amount = ? WHERE order_id = ?`, [new_total, order_id], () => {
        res.json({ order_item_id, message: "Item removed from order", new_order_total: new_total });
      });
    });
  });
});

router.delete("/orders/:order_id", (req, res) => {
  const { order_id } = req.params;
  db.get(`SELECT status FROM orders WHERE order_id = ?`, [order_id], (err, order) => {
    if (err || !order) return res.status(404).json({ error: "Order not found" });
    if (order.status !== "PENDING") return res.status(400).json({ error: "Can only delete PENDING orders" });
    db.serialize(() => {
      db.run(`DELETE FROM order_items WHERE order_id = ?`, [order_id]);
      db.run(`DELETE FROM orders WHERE order_id = ?`, [order_id], function (err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ order_id, message: "Order deleted successfully" });
      });
    });
  });
});

module.exports = router;
