const express = require("express");
const router = express.Router();
const { db } = require("../Database");
const { v4: uuidv4 } = require("uuid");
const { getEffectiveISO, getEffectiveYYYYMMDD } = require("../lib/businessDate");

function markRecapSold(shop_id, soldItemIds, sale_id) {
  if (!soldItemIds || soldItemIds.length === 0) return;
  soldItemIds.forEach(item_id => {
    db.get(
      `SELECT recap_job_id FROM recap_job_master
       WHERE shop_id = ? AND finished_item_id = ?
         AND ownership_type IN ('SHOP_OWNED','SHOP')
         AND current_status = 'READY_FOR_CLAIM'`,
      [shop_id, item_id],
      (err, job) => {
        if (err || !job) return;
        const now = new Date().toISOString();
        db.run(
          `UPDATE recap_job_master SET current_status = 'CLAIMED', related_sale_id = ?, closed_at = ? WHERE recap_job_id = ?`,
          [sale_id, now, job.recap_job_id],
          () => {
            const ledger_id = `RECAPL-${Date.now()}`;
            db.run(
              `INSERT INTO recap_job_ledger (recap_job_ledger_id, recap_job_id, shop_id, event_type, previous_status, new_status, system_note, event_timestamp)
               VALUES (?, ?, ?, 'STATUS_CHANGE', 'READY_FOR_CLAIM', 'CLAIMED', ?, ?)`,
              [ledger_id, job.recap_job_id, shop_id, `Sold via POS. Sale ID: ${sale_id}`, now]
            );
            // Auto-archive the item — recap tires are single-unit, once sold stock = 0
            db.run(`UPDATE item_master SET is_active = 0 WHERE item_id = ?`, [item_id]);
          }
        );
      }
    );
  });
}

function recordCreditReceivable(shop_id, customer_id, sale_id, total_amount, down_payment, due_date, description, created_by) {
  if (!customer_id) return Promise.resolve();
  const dp = parseFloat(down_payment) || 0;
  const balance = Math.max(0, total_amount - dp);
  const receivable_id = `RCV-${uuidv4()}`;
  const now = new Date().toISOString();
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO accounts_receivable (receivable_id, shop_id, customer_id, sale_id, receivable_type, description, original_amount, down_payment, amount_paid, balance_amount, due_date, status, created_by)
       VALUES (?, ?, ?, ?, 'PRODUCT', ?, ?, ?, ?, ?, ?, 'OPEN', ?)`,
      [receivable_id, shop_id, customer_id, sale_id, description || `POS Sale ${sale_id}`, total_amount, dp, dp, balance, due_date || null, created_by || 'POS'],
      (err) => {
        if (err) return reject(err);
        if (dp > 0) {
          const pay_id = `RPAY-${uuidv4()}`;
          db.run(
            `INSERT INTO receivable_payments (payment_id, receivable_id, shop_id, amount, payment_date, payment_method, notes, recorded_by)
             VALUES (?, ?, ?, ?, ?, 'CASH', 'Down payment at POS', ?)`,
            [pay_id, receivable_id, shop_id, dp, now, created_by || 'POS'],
            (err2) => { if (err2) console.error('receivable down-payment insert error:', err2.message); resolve(); }
          );
        } else {
          resolve();
        }
      }
    );
  });
}

function recordTiremanCommission(shop_id, tireman_ids, commission_total, sale_id, encoded_by) {
  if (!tireman_ids || !tireman_ids.length || !commission_total || commission_total <= 0) return;
  const perTireman = commission_total / tireman_ids.length;
  getEffectiveYYYYMMDD(shop_id).then(business_date => {
    for (const staff_id of tireman_ids) {
      const log_id = `LOG-${uuidv4()}`;
      db.run(
        `INSERT INTO labor_log (log_id, shop_id, staff_id, service_id, service_name, quantity, unit_price, total_amount, commission_amount, business_date, encoded_by, sale_id)
         VALUES (?, ?, ?, ?, ?, 1, ?, 0, ?, ?, ?, ?)`,
        [log_id, shop_id, staff_id, 'POS-COMMISSION', `Install Commission (Sale ${sale_id})`, perTireman, perTireman, business_date, encoded_by || 'POS', sale_id],
        (err) => { if (err) console.error('labor_log insert error:', err.message); }
      );
    }
  });
}

function recordBalancingLabor(shop_id, tireman_ids, balancing_total, sale_id, encoded_by) {
  if (!tireman_ids || !tireman_ids.length || !balancing_total || balancing_total <= 0) return;
  const perTireman = balancing_total / tireman_ids.length;
  getEffectiveYYYYMMDD(shop_id).then(business_date => {
    for (const staff_id of tireman_ids) {
      const log_id = `LOG-${uuidv4()}`;
      db.run(
        `INSERT INTO labor_log (log_id, shop_id, staff_id, service_id, service_name, quantity, unit_price, total_amount, commission_amount, business_date, encoded_by, sale_id)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, 0, ?, ?, ?)`,
        [log_id, shop_id, staff_id, 'WB-LABOR', `Wheel Balancing labor (${sale_id})`, perTireman, perTireman, business_date, encoded_by || 'POS', sale_id],
        (err) => { if (err) console.error('balancing labor_log insert error:', err.message); }
      );
    }
  });
}

function recordFlatServiceLabor(shop_id, tireman_ids, service_name, total_amount, sale_id, encoded_by) {
  if (!tireman_ids || !tireman_ids.length || !total_amount || total_amount <= 0) return;
  const perTireman = total_amount / tireman_ids.length;
  getEffectiveYYYYMMDD(shop_id).then(business_date => {
    for (const staff_id of tireman_ids) {
      const log_id = `LOG-${uuidv4()}`;
      db.run(
        `INSERT INTO labor_log (log_id, shop_id, staff_id, service_id, service_name, quantity, unit_price, total_amount, commission_amount, business_date, encoded_by, sale_id)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, 0, ?, ?, ?)`,
        [log_id, shop_id, staff_id, 'RECAP-FITTING', service_name, perTireman, perTireman, business_date, encoded_by || 'RECAP', sale_id],
        (err) => { if (err) console.error('recap fitting labor_log insert error:', err.message); }
      );
    }
  });
}

function recordServiceLabor(shop_id, tireman_ids, service_items, encoded_by) {
  if (!tireman_ids || !tireman_ids.length || !service_items || !service_items.length) return;
  getEffectiveYYYYMMDD(shop_id).then(business_date => {
    for (const item of service_items) {
      if (!item.line_total || item.line_total <= 0) continue;
      const perTireman = item.line_total / tireman_ids.length;
      for (const staff_id of tireman_ids) {
        const log_id = `LOG-${uuidv4()}`;
        db.run(
          `INSERT INTO labor_log (log_id, shop_id, staff_id, service_id, service_name, quantity, unit_price, total_amount, commission_amount, business_date, encoded_by, sale_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
          [log_id, shop_id, staff_id, item.item_or_service_id, item.item_name, item.quantity, item.unit_price, perTireman, business_date, encoded_by || 'POS', item.sale_id || null],
          (err) => { if (err) console.error('service labor_log insert error:', err.message); }
        );
      }
    }
  });
}

function updateCurrentStockForSale(shopId, inventoryTransactions) {
  return new Promise((resolve, reject) => {
    const itemIds = [...new Set(inventoryTransactions.map((t) => t.item_id))];
    if (itemIds.length === 0) { resolve(); return; }
    const stmt = db.prepare(`
      INSERT INTO current_stock (shop_id, item_id, current_quantity, last_updated)
      VALUES (?, ?, (SELECT COALESCE(SUM(quantity),0) FROM inventory_ledger WHERE shop_id = ? AND item_id = ?), CURRENT_TIMESTAMP)
      ON CONFLICT(shop_id,item_id) DO UPDATE SET
        current_quantity = (SELECT COALESCE(SUM(quantity),0) FROM inventory_ledger WHERE shop_id = ? AND item_id = ?),
        last_updated = CURRENT_TIMESTAMP
    `);
    let completed = 0;
    for (const itemId of itemIds) {
      stmt.run([shopId, itemId, shopId, itemId, shopId, itemId], (err) => {
        if (err) return reject(err);
        completed++;
        if (completed === itemIds.length) stmt.finalize(resolve);
      });
    }
  });
}

router.post("/sales/complete", async (req, res) => {
  const { shop_id, staff_id, items, created_by, tireman_ids, tireman_commission_total, tireman_balancing_total, customer_id, sale_notes, invoice_number, payment_method, credit_down_payment, credit_due_date, payment_splits } = req.body;
  if (!shop_id || !staff_id || !items || items.length === 0) {
    return res.status(400).json({ error: "Missing required fields: shop_id, staff_id, items" });
  }
  try {
    const sale_id = `SALE-${Date.now()}`;
    const sale_datetime = new Date().toISOString();
    const business_date = await getEffectiveYYYYMMDD(shop_id);
    let total_amount = 0;
    const saleItems = [];
    for (const item of items) {
      const line_total = item.quantity * item.unit_price;
      total_amount += line_total;
      saleItems.push({
        sale_item_id: `ITEM-${uuidv4()}`, sale_id,
        item_or_service_id: item.item_or_service_id, item_name: item.item_name || "Unknown Item",
        sale_type: item.sale_type, quantity: item.quantity, unit_price: item.unit_price, line_total,
        sku: item.sku || null, 
        brand: item.brand ? item.brand.toUpperCase() : null, 
        design: item.design ? item.design.toUpperCase() : null,
        tire_size: item.tire_size || null, category: item.category || null,
        dot_number: item.dot_number || null,
        valve_type: item.valve_type || null, valve_quantity: item.valve_quantity || null,
        wheel_balancing: item.wheel_balancing || false, balancing_quantity: item.balancing_quantity || null,
        wheel_weights_qty: item.wheel_weights_qty || null, commission_amount: 0,
        unit_cost: item.unit_cost != null ? item.unit_cost : null,
        is_custom: item.is_custom ? 1 : 0,
      });
    }
    db.run('BEGIN TRANSACTION', (txErr) => {
      if (txErr) return res.status(500).json({ error: txErr.message });

      const rollback = (msg) => { db.run('ROLLBACK'); res.status(500).json({ error: msg }); };

      db.run(
        `INSERT INTO sale_header (sale_id, shop_id, sale_datetime, business_date, staff_id, total_amount, created_by, tireman_ids, customer_id, sale_notes, invoice_number, payment_method, payment_splits, credit_down_payment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [sale_id, shop_id, sale_datetime, business_date, staff_id, total_amount, created_by, tireman_ids ? JSON.stringify(tireman_ids) : null, customer_id || null, sale_notes || null, invoice_number || null, payment_method || 'CASH', payment_splits ? JSON.stringify(payment_splits) : null, (payment_method === 'CREDIT' || (payment_splits || []).some(s => s.method === 'CREDIT')) ? (parseFloat(credit_down_payment) || 0) : 0],
        (err) => {
          if (err) return rollback(err.message);
          const itemStmt = db.prepare(`
            INSERT INTO sale_items (sale_item_id, sale_id, item_or_service_id, item_name, sale_type, quantity, unit_price, line_total, sku, brand, design, tire_size, category, valve_type, valve_quantity, wheel_balancing, balancing_quantity, wheel_weights_qty, commission_amount, unit_cost, dot_number, is_custom, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `);
          for (const item of saleItems) {
            itemStmt.run([item.sale_item_id, item.sale_id, item.item_or_service_id, item.item_name, item.sale_type, item.quantity, item.unit_price, item.line_total, item.sku, item.brand, item.design, item.tire_size, item.category, item.valve_type, item.valve_quantity, item.wheel_balancing, item.balancing_quantity, item.wheel_weights_qty, item.commission_amount, item.unit_cost, item.dot_number || null, item.is_custom]);
          }
          itemStmt.finalize((err) => {
            if (err) return rollback(err.message);
            const inventoryTransactions = [];
            for (const item of items) {
              if (item.sale_type === "PRODUCT" && !item.is_custom) {
                inventoryTransactions.push({ inventory_ledger_id: `INVTXN-${uuidv4()}`, shop_id, item_id: item.item_or_service_id, transaction_type: "SALE", quantity: -item.quantity, reference_id: sale_id, dot_number: item.dot_number || null });
              }
            }
            if (inventoryTransactions.length > 0) {
              const invStmt = db.prepare(`INSERT INTO inventory_ledger (inventory_ledger_id, shop_id, item_id, transaction_type, quantity, reference_id, dot_number, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`);
              for (const inv of inventoryTransactions) {
                invStmt.run([inv.inventory_ledger_id, inv.shop_id, inv.item_id, inv.transaction_type, inv.quantity, inv.reference_id, inv.dot_number || null, created_by]);
              }
              invStmt.finalize((err) => {
                if (err) return rollback(err.message);
                db.run('COMMIT', (commitErr) => {
                  if (commitErr) return rollback(commitErr.message);
                  updateCurrentStockForSale(shop_id, inventoryTransactions)
                    .then(async () => {
                      recordTiremanCommission(shop_id, tireman_ids, tireman_commission_total, sale_id, created_by);
                      recordBalancingLabor(shop_id, tireman_ids, tireman_balancing_total, sale_id, created_by);
                      recordServiceLabor(shop_id, tireman_ids, saleItems.filter(i => i.sale_type === 'SERVICE'), created_by);
                      markRecapSold(shop_id, inventoryTransactions.map(t => t.item_id), sale_id);
                      const splits = payment_splits || [];
                      const creditSplit = splits.find(s => s.method === 'CREDIT');
                      if (creditSplit || payment_method === 'CREDIT') {
                        const creditAmt = creditSplit ? creditSplit.amount : total_amount;
                        const desc = saleItems.map(i => i.item_name).slice(0, 3).join(', ');
                        try {
                          await recordCreditReceivable(shop_id, customer_id, sale_id, creditAmt, credit_down_payment, credit_due_date, desc, created_by);
                        } catch (rcvErr) {
                          console.error('receivable insert error:', rcvErr.message);
                          return res.status(500).json({ error: `Sale recorded but failed to create credit receivable: ${rcvErr.message}` });
                        }
                      }
                      res.json({ sale_id, total_amount, item_count: saleItems.length, status: "success", message: "Sale completed successfully" });
                    })
                    .catch((err) => res.status(500).json({ error: err.message }));
                });
              });
            } else {
              db.run('COMMIT', (commitErr) => {
                if (commitErr) return rollback(commitErr.message);
                recordTiremanCommission(shop_id, tireman_ids, tireman_commission_total, sale_id, created_by);
                recordBalancingLabor(shop_id, tireman_ids, tireman_balancing_total, sale_id, created_by);
                recordServiceLabor(shop_id, tireman_ids, saleItems.filter(i => i.sale_type === 'SERVICE'), created_by);
                if (payment_method === 'CREDIT') {
                  const desc = saleItems.map(i => i.item_name).slice(0, 3).join(', ');
                  recordCreditReceivable(shop_id, customer_id, sale_id, total_amount, credit_down_payment, credit_due_date, desc, created_by)
                    .then(() => res.json({ sale_id, total_amount, item_count: saleItems.length, status: "success", message: "Sale completed successfully" }))
                    .catch((rcvErr) => {
                      console.error('receivable insert error:', rcvErr.message);
                      res.status(500).json({ error: `Sale recorded but failed to create credit receivable: ${rcvErr.message}` });
                    });
                } else {
                  res.json({ sale_id, total_amount, item_count: saleItems.length, status: "success", message: "Sale completed successfully" });
                }
              });
            }
          });
        },
      );
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/sales-kpi/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  const { startDate, endDate } = req.query;
  let where = `WHERE sh.shop_id = ? AND sh.is_void = 0`;
  const params = [shop_id];
  if (startDate && endDate) {
    where += ` AND DATE(sh.sale_datetime) BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }
  const sql = `
    SELECT 
      COALESCE(SUM(sh.total_amount), 0) AS totalRevenue,
      COALESCE(SUM(CASE WHEN DATE(sh.sale_datetime) = DATE('now','localtime') THEN sh.total_amount ELSE 0 END), 0) AS todayRevenue,
      COALESCE(SUM((SELECT COUNT(*) FROM sale_items WHERE sale_id = sh.sale_id)), 0) AS totalItems,
      COUNT(*) AS totalTransactions
    FROM sale_header sh ${where}`;  db.get(sql, params, (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row || { totalRevenue: 0, todayRevenue: 0, totalItems: 0, totalTransactions: 0 });
  });
});

router.get("/sales/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  const { startDate, endDate, q, page = 1, perPage = 50 } = req.query;

  const parsedPage = Math.max(1, parseInt(page, 10));
  const parsedPerPage = Math.min(200, Math.max(1, parseInt(perPage, 10)));
  const offset = (parsedPage - 1) * parsedPerPage;

  let where = `WHERE sh.shop_id = ?`;
  const params = [shop_id];
  if (startDate && endDate) {
    where += ` AND DATE(sh.sale_datetime) BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }
  if (q && String(q).trim()) {
    const like = `%${String(q).trim()}%`;
    where += ` AND (
      sh.invoice_number LIKE ? OR sh.sale_id LIKE ? OR sh.sale_notes LIKE ?
      OR cm.customer_name LIKE ? OR st.full_name LIKE ?
      OR EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = sh.sale_id AND si.item_name LIKE ?)
    )`;
    params.push(like, like, like, like, like, like);
  }

  const countQuery = `
    SELECT COUNT(*) as total FROM sale_header sh
    LEFT JOIN staff_master st ON sh.staff_id = st.staff_id
    LEFT JOIN customer_master cm ON sh.customer_id = cm.customer_id
    ${where}`;
  db.get(countQuery, params, (countErr, countRow) => {
    if (countErr) return res.status(500).json({ error: countErr.message });
    const total = countRow.total;
    const totalPages = Math.max(1, Math.ceil(total / parsedPerPage));

    const query = `
      SELECT sh.sale_id, sh.shop_id, sh.sale_datetime, sh.staff_id, sh.total_amount, sh.created_by, sh.invoice_number, sh.sale_notes, sh.customer_id, sh.tireman_ids, sh.payment_method, sh.payment_splits, sh.credit_down_payment,
        sh.is_void, sh.void_reason,
        st.full_name as staff_name,
        cm.customer_name,
        COUNT(si.sale_item_id) AS item_count,
        MIN(CASE WHEN si.brand  IS NOT NULL AND si.brand  != '' THEN si.brand  END) AS brand,
        MIN(CASE WHEN si.design IS NOT NULL AND si.design != '' THEN si.design END) AS design,
        MIN(CASE WHEN si.tire_size IS NOT NULL AND si.tire_size != '' THEN si.tire_size END) AS tire_size,
        GROUP_CONCAT(DISTINCT si.item_name) AS item_names
      FROM sale_header sh
      LEFT JOIN staff_master st ON sh.staff_id = st.staff_id
      LEFT JOIN customer_master cm ON sh.customer_id = cm.customer_id
      LEFT JOIN sale_items si ON si.sale_id = sh.sale_id
      ${where}
      GROUP BY sh.sale_id
      ORDER BY sh.sale_datetime DESC
      LIMIT ? OFFSET ?`;
    db.all(query, [...params, parsedPerPage, offset], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        data: rows,
        meta: { page: parsedPage, perPage: parsedPerPage, totalPages, total, totalCount: total }
      });
    });
  });
});

router.get("/sales/:sale_id/details", (req, res) => {
  const { sale_id } = req.params;
  db.all(
    `SELECT sale_item_id, item_or_service_id, item_name, sale_type, quantity, unit_price, line_total,
      sku, brand, design, tire_size, category, valve_type, valve_quantity,
      wheel_balancing, balancing_quantity, wheel_weights_qty, commission_amount, created_at
    FROM sale_items WHERE sale_id = ?
    ORDER BY created_at`,
    [sale_id],
    (err, rows) => res.json(err ? { error: err.message } : rows),
  );
});

router.get("/customer-sales/:customer_id", (req, res) => {
  const { customer_id } = req.params;
  db.all(
    `SELECT sh.sale_id, sh.sale_datetime, sh.total_amount, sh.created_by, sh.sale_notes,
       st.full_name as staff_name,
       (SELECT GROUP_CONCAT(item_name, ', ') FROM sale_items WHERE sale_id = sh.sale_id LIMIT 3) as items_summary
     FROM sale_header sh
     LEFT JOIN staff_master st ON sh.staff_id = st.staff_id
     WHERE sh.customer_id = ?
     ORDER BY sh.sale_datetime DESC`,
    [customer_id],
    (err, rows) => res.json(err ? { error: err.message } : rows)
  );
});

router.patch("/sales/:sale_id", (req, res) => {
  const { sale_id } = req.params;
  const { invoice_number, sale_notes, customer_id } = req.body;
  const targetCustomerId = customer_id === "" ? null : (customer_id ?? null);

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    db.run(
      `UPDATE sale_header SET invoice_number = ?, sale_notes = ?, customer_id = ? WHERE sale_id = ?`,
      [invoice_number ?? null, sale_notes ?? null, targetCustomerId, sale_id],
      function(err) {
        if (err) {
          db.run("ROLLBACK");
          return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
          db.run("ROLLBACK");
          return res.status(404).json({ error: "Sale not found" });
        }

        // Update accounts_receivable if linked
        db.run(
          `UPDATE accounts_receivable SET customer_id = ? WHERE sale_id = ?`,
          [targetCustomerId, sale_id],
          function(err2) {
            if (err2) {
              db.run("ROLLBACK");
              return res.status(500).json({ error: err2.message });
            }

            // Update recap_job_master if linked
            db.run(
              `UPDATE recap_job_master SET customer_id = ? WHERE related_sale_id = ?`,
              [targetCustomerId, sale_id],
              function(err3) {
                if (err3) {
                  db.run("ROLLBACK");
                  return res.status(500).json({ error: err3.message });
                }
                
                db.run("COMMIT", (err4) => {
                  if (err4) return res.status(500).json({ error: err4.message });
                  res.json({ sale_id, message: "Sale and all related records updated successfully" });
                });
              }
            );
          }
        );
      }
    );
  });
});

router.put("/sales/:sale_id/void", async (req, res) => {
  const { sale_id } = req.params;
  const { void_reason } = req.body;

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    // 1. Mark sale_header as voided
    db.run(
      `UPDATE sale_header SET is_void = 1, void_reason = ? WHERE sale_id = ?`,
      [void_reason || "Voided", sale_id],
      function (err) {
        if (err || this.changes === 0) {
          db.run("ROLLBACK");
          return res.status(err ? 500 : 404).json({ error: err ? err.message : "Sale not found" });
        }

        // 2. Void linked labor_log entries
        db.run(
          `UPDATE labor_log SET is_void = 1, void_reason = ? WHERE sale_id = ?`,
          [`Sale Voided: ${void_reason || "No reason"}`, sale_id]
        );

        // 3. Void linked accounts_receivable
        db.run(
          `UPDATE accounts_receivable SET status = 'VOIDED', notes = ? WHERE sale_id = ?`,
          [`Sale Voided: ${void_reason || "No reason"}`, sale_id]
        );

        // 4. Update linked recap jobs (return to INTAKE or mark as voided depending on logic, here we just unlink)
        db.run(
          `UPDATE recap_job_master SET current_status = 'READY_FOR_CLAIM', related_sale_id = NULL WHERE related_sale_id = ?`,
          [sale_id]
        );

        // 5. Restock inventory by reversing entries in inventory_ledger
        // We find all 'SALE' entries for this reference_id and insert reverse rows
        db.all(
          `SELECT * FROM inventory_ledger WHERE reference_id = ? AND transaction_type = 'SALE'`,
          [sale_id],
          (errL, logs) => {
            if (errL) {
              db.run("ROLLBACK");
              return res.status(500).json({ error: errL.message });
            }

            if (logs && logs.length > 0) {
              for (const log of logs) {
                const reversal_id = `VOID-${uuidv4()}`;
                db.run(
                  `INSERT INTO inventory_ledger (inventory_ledger_id, shop_id, item_id, transaction_type, quantity, unit_cost, reference_id, created_by)
                   VALUES (?, ?, ?, 'RETURN', ?, ?, ?, ?)`,
                  [reversal_id, log.shop_id, log.item_id, Math.abs(log.quantity), log.unit_cost, `VOID-${sale_id}`, 'SYSTEM']
                );
              }
            }

            db.run("COMMIT", (errC) => {
              if (errC) return res.status(500).json({ error: errC.message });
              res.json({ sale_id, message: "Transaction voided and inventory restocked." });
            });
          }
        );
      }
    );
  });
});

router.get("/services-history/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  const { startDate, endDate, staff_id, q, type, page, perPage } = req.query;
  const paginated = page !== undefined || perPage !== undefined || q !== undefined;

  let where = `WHERE sh.shop_id = ?`;
  const params = [shop_id];
  if (startDate && endDate) {
    where += ` AND DATE(sh.sale_datetime) BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }
  if (staff_id) {
    where += ` AND sh.staff_id = ?`;
    params.push(staff_id);
  }

  // Filter by type: all, service, commission
  if (type === 'service') {
    where += ` AND EXISTS (SELECT 1 FROM sale_items si2 WHERE si2.sale_id = sh.sale_id AND si2.sale_type = 'SERVICE')`;
  } else if (type === 'commission') {
    where += ` AND EXISTS (SELECT 1 FROM labor_log ll WHERE ll.sale_id = sh.sale_id AND ll.commission_amount > 0 AND ll.is_void = 0)`;
  } else {
    // Default: Show if it has either service items OR labor commissions
    where += ` AND (
      EXISTS (SELECT 1 FROM sale_items si2 WHERE si2.sale_id = sh.sale_id AND si2.sale_type = 'SERVICE')
      OR EXISTS (SELECT 1 FROM labor_log ll WHERE ll.sale_id = sh.sale_id AND ll.commission_amount > 0 AND ll.is_void = 0)
    )`;
  }

  if (paginated && q && q.trim()) {
    where += ` AND (
      sh.invoice_number LIKE ? OR sh.sale_id LIKE ? OR sh.sale_notes LIKE ?
      OR cm.customer_name LIKE ? OR st.full_name LIKE ?
      OR EXISTS (SELECT 1 FROM sale_items si3 WHERE si3.sale_id = sh.sale_id AND si3.item_name LIKE ?)
    )`;
    const like = `%${q.trim()}%`;
    params.push(like, like, like, like, like, like);
  }

  const baseSelect = `
    SELECT sh.sale_id, sh.sale_datetime, sh.invoice_number, sh.sale_notes,
      sh.customer_id, sh.tireman_ids, sh.created_by,
      st.full_name as staff_name,
      cm.customer_name,
      COALESCE(SUM(si.line_total), 0) as total_amount,
      (SELECT COALESCE(SUM(ll.commission_amount), 0) FROM labor_log ll WHERE ll.sale_id = sh.sale_id AND ll.is_void = 0) as total_commission,
      GROUP_CONCAT(DISTINCT si.item_name) as services
    FROM sale_header sh
    LEFT JOIN staff_master st ON sh.staff_id = st.staff_id
    LEFT JOIN customer_master cm ON sh.customer_id = cm.customer_id
    LEFT JOIN sale_items si ON sh.sale_id = si.sale_id AND si.sale_type = 'SERVICE'
    ${where}
    GROUP BY sh.sale_id`;

  const mapRow = (r) => ({
    ...r,
    tireman_ids: (() => { try { return r.tireman_ids ? JSON.parse(r.tireman_ids) : []; } catch { return []; } })(),
  });

  if (!paginated) {
    db.all(`${baseSelect} ORDER BY sh.sale_datetime DESC`, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json((rows || []).map(mapRow));
    });
    return;
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedPerPage = Math.min(200, Math.max(1, parseInt(perPage, 10) || 50));
  const offset = (parsedPage - 1) * parsedPerPage;

  // Revenue stat: aggregate across the filtered (not paginated) set so the KPI stays accurate.
  const statsSql = `
    SELECT COUNT(*) AS total, COALESCE(SUM(total_amount), 0) AS totalRevenue
      FROM (${baseSelect}) grouped`;
  db.get(statsSql, params, (sErr, sRow) => {
    if (sErr) return res.status(500).json({ error: sErr.message });
    const total = sRow?.total || 0;
    const totalRevenue = sRow?.totalRevenue || 0;
    const totalPages = Math.max(1, Math.ceil(total / parsedPerPage));
    const pageSql = `${baseSelect} ORDER BY sh.sale_datetime DESC LIMIT ? OFFSET ?`;
    db.all(pageSql, [...params, parsedPerPage, offset], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        data: (rows || []).map(mapRow),
        meta: { page: parsedPage, perPage: parsedPerPage, total, totalCount: total, totalPages },
        stats: { totalRevenue },
      });
    });
  });
});

module.exports = router;
module.exports.recordTiremanCommission = recordTiremanCommission;
module.exports.recordFlatServiceLabor = recordFlatServiceLabor;
