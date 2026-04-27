const express = require("express");
const router = express.Router();
const { db } = require("../Database");
const { recordFlatServiceLabor } = require("./sales");
const { getEffectiveISO, getEffectiveYYYYMMDD } = require("../lib/businessDate");

function normalizeOwnership(raw) {
  if (!raw) return null;
  const u = raw.toUpperCase();
  if (u === 'CUSTOMER' || u === 'CUSTOMER_OWNED') return 'CUSTOMER_OWNED';
  if (u === 'SHOP' || u === 'SHOP_OWNED') return 'SHOP_OWNED';
  return null;
}

const RECAP_SELECT = `
    SELECT rjm.recap_job_id as job_id, rjm.shop_id, rjm.ownership_type, rjm.customer_id,
      cm.customer_name, rjm.supplier_id, sm.supplier_name, rjm.casing_description,
      rjm.current_status as status, rjm.intake_date, rjm.return_date, rjm.recap_cost,
      rjm.expected_selling_price, rjm.source_item_id, rjm.finished_item_id,
      rjm.claim_deadline_date, rjm.dot_number, rjm.forfeited_flag, rjm.forfeited_date,
      rjm.related_sale_id, rjm.created_at, rjm.created_by,
      im.sku as finished_sku,
      im.brand, im.design, im.size
    FROM recap_job_master rjm
    LEFT JOIN customer_master cm ON rjm.customer_id = cm.customer_id
    LEFT JOIN supplier_master sm ON rjm.supplier_id = sm.supplier_id
    LEFT JOIN item_master im ON rjm.finished_item_id = im.item_id`;

function buildRecapWhere(shop_id, { status, supplier_id, customer_id, ownership_type, q, dateFrom, dateTo }) {
  const parts = ['rjm.shop_id = ?'];
  const params = [shop_id];
  if (status) { parts.push('rjm.current_status = ?'); params.push(status); }
  if (supplier_id) { parts.push('rjm.supplier_id = ?'); params.push(supplier_id); }
  if (customer_id) { parts.push('rjm.customer_id = ?'); params.push(customer_id); }
  const norm = normalizeOwnership(ownership_type);
  if (norm === 'CUSTOMER_OWNED') {
    parts.push(`(rjm.ownership_type = 'CUSTOMER_OWNED' OR rjm.ownership_type = 'CUSTOMER')`);
  } else if (norm === 'SHOP_OWNED') {
    parts.push(`(rjm.ownership_type = 'SHOP_OWNED' OR rjm.ownership_type = 'SHOP')`);
  }
  if (q && String(q).trim()) {
    const like = `%${String(q).trim()}%`;
    parts.push(`(rjm.recap_job_id LIKE ? OR rjm.casing_description LIKE ? OR cm.customer_name LIKE ? OR sm.supplier_name LIKE ? OR im.brand LIKE ? OR im.design LIKE ? OR im.size LIKE ?)`);
    params.push(like, like, like, like, like, like, like);
  }
  if (dateFrom) { parts.push('DATE(rjm.intake_date) >= ?'); params.push(dateFrom); }
  if (dateTo)   { parts.push('DATE(rjm.intake_date) <= ?'); params.push(dateTo); }
  return { where: `WHERE ${parts.join(' AND ')}`, params };
}

router.get("/recap-jobs-kpi/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  const { q, ownership_type, dateFrom, dateTo } = req.query;
  const { where, params } = buildRecapWhere(shop_id, { q, ownership_type, dateFrom, dateTo });
  db.all(
    `SELECT rjm.current_status as status, rjm.ownership_type,
       COUNT(*) as cnt,
       SUM(rjm.recap_cost) as cost
     FROM recap_job_master rjm
     LEFT JOIN customer_master cm ON rjm.customer_id = cm.customer_id
     LEFT JOIN supplier_master sm ON rjm.supplier_id = sm.supplier_id
     LEFT JOIN item_master im ON rjm.finished_item_id = im.item_id
     ${where} GROUP BY rjm.current_status, rjm.ownership_type`,
    params,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const counts = {};
      let total = 0;
      let totalCost = 0;
      (rows || []).forEach(r => {
        counts[r.status] = (counts[r.status] || 0) + r.cnt;
        total += r.cnt;
        totalCost += (r.cost || 0);
        if (r.status === 'READY_FOR_CLAIM') {
          const norm = normalizeOwnership(r.ownership_type);
          if (norm === 'SHOP_OWNED')     counts['IN_INVENTORY'] = (counts['IN_INVENTORY'] || 0) + r.cnt;
          if (norm === 'CUSTOMER_OWNED') counts['READY_FOR_CLAIM_CUSTOMER'] = (counts['READY_FOR_CLAIM_CUSTOMER'] || 0) + r.cnt;
        }
      });
      // READY_FOR_CLAIM tab = customer-owned only
      counts['READY_FOR_CLAIM'] = counts['READY_FOR_CLAIM_CUSTOMER'] || 0;
      res.json({ statusCounts: counts, total, total_recap_cost: totalCost });
    }
  );
});

router.get("/recap-jobs/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  const { status, supplier_id, customer_id, ownership_type, q, dateFrom, dateTo, page, perPage } = req.query;
  const paginated = page !== undefined || perPage !== undefined || q !== undefined;
  const { where, params } = buildRecapWhere(shop_id, { status, supplier_id, customer_id, ownership_type, q, dateFrom, dateTo });
  const orderBy = `ORDER BY rjm.intake_date DESC`;

  if (!paginated) {
    db.all(`${RECAP_SELECT} ${where} ${orderBy}`, params, (err, rows) => {
      if (err) return res.json({ error: err.message });
      res.json(rows || []);
    });
    return;
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedPerPage = Math.min(200, Math.max(1, parseInt(perPage, 10) || 20));
  const offset = (parsedPage - 1) * parsedPerPage;

  const countSql = `SELECT COUNT(*) as total FROM recap_job_master rjm
    LEFT JOIN customer_master cm ON rjm.customer_id = cm.customer_id
    LEFT JOIN supplier_master sm ON rjm.supplier_id = sm.supplier_id
    LEFT JOIN item_master im ON rjm.finished_item_id = im.item_id
    ${where}`;
  db.get(countSql, params, (cErr, cRow) => {
    if (cErr) return res.status(500).json({ error: cErr.message });
    const total = cRow?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / parsedPerPage));
    db.all(`${RECAP_SELECT} ${where} ${orderBy} LIMIT ? OFFSET ?`, [...params, parsedPerPage, offset], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ data: rows || [], meta: { page: parsedPage, perPage: parsedPerPage, total, totalCount: total, totalPages } });
    });
  });
});

router.get("/recap-jobs/:job_id/details", (req, res) => {
  const { job_id } = req.params;
  db.get(
    `SELECT rjm.recap_job_id as job_id, rjm.shop_id, rjm.ownership_type, rjm.customer_id,
      cm.customer_name, cm.phone as customer_phone, rjm.supplier_id, sm.supplier_name, sm.phone as supplier_phone,
      rjm.casing_description, rjm.current_status as status, rjm.intake_date, rjm.return_date,
      rjm.recap_cost, rjm.expected_selling_price, rjm.source_item_id, rjm.finished_item_id,
      rjm.claim_deadline_date, rjm.dot_number, rjm.forfeited_flag, rjm.forfeited_date, rjm.forfeited_by_staff_id,
      rjm.forfeiture_reason, rjm.related_sale_id, rjm.created_at, rjm.created_by
    FROM recap_job_master rjm
    LEFT JOIN customer_master cm ON rjm.customer_id = cm.customer_id
    LEFT JOIN supplier_master sm ON rjm.supplier_id = sm.supplier_id
    WHERE rjm.recap_job_id = ?`,
    [job_id],
    (err, job) => {
      if (err || !job) return res.status(404).json({ error: "Job not found" });
      db.all(
        `SELECT rjl.recap_job_ledger_id as ledger_id, rjl.recap_job_id as job_id, rjl.event_type,
          rjl.previous_status, rjl.new_status, rjl.performed_by_staff_id, sm.full_name AS staff_name,
          rjl.system_note, rjl.event_timestamp as timestamp
         FROM recap_job_ledger rjl
         LEFT JOIN staff_master sm ON rjl.performed_by_staff_id = sm.staff_id
         WHERE rjl.recap_job_id = ? ORDER BY rjl.event_timestamp DESC`,
        [job_id],
        (err, history) => {
          res.json({ ...job, history: history || [] });
        },
      );
    },
  );
});

router.post("/recap-jobs", async (req, res) => {
  const { shop_id, ownership_type, customer_id, supplier_id, brand, design, size, dot_number, recap_cost, expected_selling_price, intake_date, claim_deadline_date, created_by, source_item_id, source_unit_cost, source_selling_price } = req.body;
  if (!shop_id || !ownership_type || !supplier_id || !brand || !size) {
    return res.status(400).json({ error: "Missing required fields: shop_id, ownership_type, supplier_id, brand, size" });
  }
  if (ownership_type === "CUSTOMER_OWNED" && !customer_id) {
    return res.status(400).json({ error: "Customer ID required for CUSTOMER_OWNED jobs" });
  }
  const isShopOwned = ownership_type !== "CUSTOMER_OWNED" && ownership_type !== "CUSTOMER";
  const b = brand.trim().substring(0, 5).toUpperCase();
  const d = design ? design.trim().substring(0, 4).toUpperCase() : "RCAP";
  const sz = size.trim().replace(/[\/\-]/g, "");
  const rimMatch = size.match(/R(\d+)/i);
  const dashMatch = size.match(/-(\d+)$/);
  const rim_size = rimMatch ? parseInt(rimMatch[1]) : dashMatch ? parseInt(dashMatch[1]) : null;
  const dot_suffix = dot_number ? `-${dot_number.trim().toUpperCase()}` : '';
  const auto_sku = `RECAP-${b}-${d}-${sz}${dot_suffix}-${Date.now()}`;
  const item_name = [brand.trim(), design ? design.trim() : null, size.trim()].filter(Boolean).join(" ");
  const job_id = `JOB-${Date.now()}`;
  const created_at = await getEffectiveISO(shop_id);
  const item_id = `ITEM-RECAP-${Date.now()}`;
  // Customer-owned tires are NOT for sale in POS (is_active=0); shop-owned start active
  const item_active = isShopOwned ? 1 : 0;

  // Compute costs — standard recap_cost and expected_selling_price are the base (labour/material)
  // If sourced from a RECAPPING inventory item, casing purchase cost is added on top of both
  const recapCostNum = parseFloat(recap_cost) || 0;
  const stdSellingNum = parseFloat(expected_selling_price) || 0;
  const sourceCostNum = source_item_id ? (parseFloat(source_unit_cost) || 0) : 0;
  const totalCost = sourceCostNum + recapCostNum;
  // Absolute margin preserved: selling = casing_cost + standard_selling
  const finalSellingPrice = source_item_id ? (sourceCostNum + stdSellingNum) : stdSellingNum;

  db.run(
    `INSERT INTO item_master (item_id, sku, item_name, category, brand, design, size, rim_size, unit_cost, selling_price, is_active, dot_number, parent_item_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [item_id, auto_sku, item_name, "RECAP", brand.trim(), design ? design.trim() : null, size.trim(), rim_size, totalCost, finalSellingPrice, item_active, dot_number || null, source_item_id || null],
    function (err) {
      if (err) return res.status(500).json({ error: "Failed to register recap tire in item master: " + err.message });
      db.run(
        `INSERT INTO recap_job_master (recap_job_id, shop_id, ownership_type, customer_id, supplier_id, casing_description, current_status, intake_date, recap_cost, expected_selling_price, finished_item_id, claim_deadline_date, dot_number, forfeited_flag, created_at, created_by, source_item_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [job_id, shop_id, ownership_type, customer_id || null, supplier_id, item_name, "INTAKE", intake_date ? (intake_date.length === 10 ? intake_date + 'T' + new Date().toTimeString().slice(0,8) : intake_date) : created_at, recapCostNum, finalSellingPrice, item_id, claim_deadline_date || null, dot_number || null, 0, created_at, created_by || "SYSTEM", source_item_id || null],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          const ledger_id = `RECAPL-${Date.now()}`;
          const finishWithLedger = () => {
            db.run(
              `INSERT INTO recap_job_ledger (recap_job_ledger_id, recap_job_id, shop_id, event_type, previous_status, new_status, performed_by_staff_id, system_note, event_timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [ledger_id, job_id, shop_id, "JOB_CREATED", null, "INTAKE", null, `Recap job created: ${item_name}${source_item_id ? ` (from inventory item ${source_item_id})` : ''}`, created_at],
              () => {
                res.status(201).json({ job_id, item_id, sku: auto_sku, item_name, status: "INTAKE", total_cost: totalCost, selling_price: finalSellingPrice, message: "Recap job and item created successfully" });
              },
            );
          };

          // If sourced from a RECAPPING inventory item, deduct its stock and archive if qty=0
          if (source_item_id) {
            const inv_id = `INVTXN-${Date.now()}`;
            db.run(
              `INSERT INTO inventory_ledger (inventory_ledger_id, shop_id, item_id, transaction_type, quantity, unit_cost, reference_id, created_by, created_at)
               VALUES (?, ?, ?, 'RECAP_INTAKE', -1, ?, ?, ?, ?)`,
              [inv_id, shop_id, source_item_id, sourceCostNum, job_id, created_by || "SYSTEM", created_at],
              (err) => {
                if (err) console.error("Failed to deduct source item stock:", err.message);
                // Check remaining quantity and archive if 0
                db.get(
                  `SELECT COALESCE(SUM(quantity), 0) as qty FROM inventory_ledger WHERE shop_id = ? AND item_id = ?`,
                  [shop_id, source_item_id],
                  (err, row) => {
                    if (!err && row && row.qty <= 0) {
                      db.run(`UPDATE item_master SET is_active = 0 WHERE item_id = ?`, [source_item_id]);
                    }
                    finishWithLedger();
                  }
                );
              }
            );
          } else {
            finishWithLedger();
          }
        },
      );
    },
  );
});

router.put("/recap-jobs/:job_id/status", async (req, res) => {
  const { job_id } = req.params;
  const { new_status, return_date, recap_cost, performed_by_staff_id, rejection_reason } = req.body;
  db.get(`SELECT current_status, shop_id, ownership_type, finished_item_id, recap_cost as current_recap_cost, dot_number FROM recap_job_master WHERE recap_job_id = ?`, [job_id], async (err, job) => {
    if (err || !job) return res.status(404).json({ error: "Job not found" });
    const previous_status = job.current_status;
    const validTransitions = { INTAKE: ["SENT_TO_SUPPLIER", "REJECTED"], SENT_TO_SUPPLIER: ["READY_FOR_CLAIM", "REJECTED"], READY_FOR_CLAIM: ["CLAIMED"], CLAIMED: [], REJECTED: [], FORFEITED: [] };
    if (!validTransitions[previous_status]?.includes(new_status)) {
      return res.status(400).json({ error: `Invalid status transition from ${previous_status} to ${new_status}` });
    }
    const isShopOwned = job.ownership_type !== "CUSTOMER_OWNED" && job.ownership_type !== "CUSTOMER";
    const updateFields = ["current_status = ?"];
    const updateParams = [new_status];
    if (new_status === "RETURNED_TO_SHOP" && return_date) { updateFields.push("return_date = ?"); updateParams.push(return_date); }
    if (recap_cost !== undefined && recap_cost !== null) { updateFields.push("recap_cost = ?"); updateParams.push(recap_cost); }
    if (["CLAIMED", "FORFEITED", "REJECTED"].includes(new_status)) { updateFields.push("closed_at = ?"); updateParams.push(await getEffectiveISO(job.shop_id)); }
    updateParams.push(job_id);
      db.run(`UPDATE recap_job_master SET ${updateFields.join(", ")} WHERE recap_job_id = ?`, updateParams, async function (err) {
        if (err) return res.status(500).json({ error: err.message });
        const now = await getEffectiveISO(job.shop_id);
      const ledger_id = `RECAPL-${Date.now()}`;
      const finishLedger = (extraNote) => {
        db.run(
          `INSERT INTO recap_job_ledger (recap_job_ledger_id, recap_job_id, shop_id, event_type, previous_status, new_status, performed_by_staff_id, system_note, event_timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [ledger_id, job_id, job.shop_id, "STATUS_CHANGE", previous_status, new_status, performed_by_staff_id || null, extraNote || (new_status === "REJECTED" && rejection_reason ? `Reason: ${rejection_reason}` : null), now],
          () => res.json({ job_id, previous_status, new_status, message: `Job status updated from ${previous_status} to ${new_status}` }),
        );
      };
      // When shop-owned tire is returned by supplier (→ READY_FOR_CLAIM), add to inventory
      if (isShopOwned && new_status === "READY_FOR_CLAIM" && job.finished_item_id) {
        const inv_id = `INVTXN-${Date.now()}`;
        const finalCost = recap_cost !== undefined && recap_cost !== null ? parseFloat(recap_cost) : (job.current_recap_cost || 0);
        db.run(
          `INSERT INTO inventory_ledger (inventory_ledger_id, shop_id, item_id, transaction_type, quantity, unit_cost, reference_id, dot_number, created_by, created_at)
           VALUES (?, ?, ?, 'PURCHASE', 1, ?, ?, ?, ?, ?)`,
          [inv_id, job.shop_id, job.finished_item_id, finalCost, job_id, job.dot_number || null, performed_by_staff_id || "RECAP", now],
          (err) => {
            if (err) return res.status(500).json({ error: "Status updated but failed to add to inventory: " + err.message });
            finishLedger("Added to inventory (shop-owned recap returned by supplier)");
          }
        );
      } else {
        finishLedger(null);
      }
    });
  });
});

router.post("/recap-jobs/:job_id/claim", async (req, res) => {
  const { job_id } = req.params;
  const { performed_by_staff_id, sale_price, installed, tireman_ids, tireman_commission_total } = req.body;
  db.get(`SELECT * FROM recap_job_master WHERE recap_job_id = ?`, [job_id], async (err, job) => {
    if (err || !job) return res.status(404).json({ error: "Job not found" });
    if (job.current_status !== "READY_FOR_CLAIM") return res.status(400).json({ error: `Cannot claim job with status: ${job.current_status}` });
    if (job.ownership_type !== "CUSTOMER_OWNED" && job.ownership_type !== "CUSTOMER") return res.status(400).json({ error: "Shop-owned recap tires cannot be claimed here — sell via POS" });
    const sale_id = `SALE-${Date.now()}`;
    const sale_datetime = await getEffectiveISO(job.shop_id);
    const tire_price = parseFloat(sale_price) || parseFloat(job.expected_selling_price) || 0;
    const fitting_fee = (installed && tireman_commission_total > 0) ? parseFloat(tireman_commission_total) : 0;
    const total_amount = tire_price + fitting_fee;
    const recap_cost = parseFloat(job.recap_cost) || 0;
    const doCreateSale = (resolved_staff_id) => {
      db.run(
        `INSERT INTO sale_header (sale_id, shop_id, sale_datetime, staff_id, total_amount, created_by, tireman_ids, tireman_commission_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [sale_id, job.shop_id, sale_datetime, resolved_staff_id, total_amount, "RECAP",
          installed && tireman_ids?.length ? JSON.stringify(tireman_ids) : null,
          fitting_fee > 0 ? fitting_fee : null],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          // Insert recap tire sale item with cost for profit tracking
          db.run(
            `INSERT INTO sale_items (sale_item_id, sale_id, item_or_service_id, item_name, sale_type, quantity, unit_price, line_total, unit_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [`SALEITEM-${Date.now()}`, sale_id, job.finished_item_id, job.casing_description || "Recap Tire", "RECAP", 1, tire_price, tire_price, recap_cost],
            () => {
              const insertLaborAndFinish = () => {
                const note = installed && tireman_ids?.length
                  ? `Job claimed and installed. Sale ID: ${sale_id}. Tiremen: ${tireman_ids.join(', ')}`
                  : `Job claimed and sold. Sale ID: ${sale_id}`;
                db.run(
                  `UPDATE recap_job_master SET current_status = ?, related_sale_id = ?, closed_at = ? WHERE recap_job_id = ?`,
                  ["CLAIMED", sale_id, sale_datetime, job_id],
                  function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    const ledger_id = `RECAPL-${Date.now()}`;
                    db.run(
                      `INSERT INTO recap_job_ledger (recap_job_ledger_id, recap_job_id, shop_id, event_type, previous_status, new_status, performed_by_staff_id, related_sale_id, system_note, event_timestamp)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [ledger_id, job_id, job.shop_id, "JOB_CLAIMED", "READY_FOR_CLAIM", "CLAIMED", resolved_staff_id || null, sale_id, note, sale_datetime],
                      () => {
                        if (installed && tireman_ids?.length && fitting_fee > 0) {
                          recordFlatServiceLabor(job.shop_id, tireman_ids, `Recap Tire Fitting (${job_id})`, fitting_fee, sale_id, resolved_staff_id || "RECAP");
                        }
                        res.json({ job_id, sale_id, status: "CLAIMED", total_amount, message: "Job claimed and sale created successfully" });
                      },
                    );
                  },
                );
              };
              // If installed, also insert the fitting fee as a sale line item
              if (fitting_fee > 0) {
                db.run(
                  `INSERT INTO sale_items (sale_item_id, sale_id, item_or_service_id, item_name, sale_type, quantity, unit_price, line_total, unit_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [`SALEITEM-SVC-${Date.now()}`, sale_id, `RECAP-FIT-${job_id}`, "Recap Tire Installation", "SERVICE", 1, fitting_fee, fitting_fee, 0],
                  insertLaborAndFinish
                );
              } else {
                insertLaborAndFinish();
              }
            },
          );
        },
      );
    };
    if (performed_by_staff_id) {
      doCreateSale(performed_by_staff_id);
    } else if (job.created_by && job.created_by !== "STAFF" && job.created_by !== "SYSTEM") {
      doCreateSale(job.created_by);
    } else {
      db.get(`SELECT staff_id FROM staff_master WHERE is_active = 1 LIMIT 1`, (err, row) => {
        if (err || !row) return res.status(500).json({ error: "No valid staff found to record sale" });
        doCreateSale(row.staff_id);
      });
    }
  });
});

router.post("/recap-jobs/:job_id/forfeit", async (req, res) => {
  const { job_id } = req.params;
  const { forfeiture_reason, performed_by_staff_id } = req.body;
  db.get(`SELECT * FROM recap_job_master WHERE recap_job_id = ?`, [job_id], async (err, job) => {
    if (err || !job) return res.status(404).json({ error: "Job not found" });
    const forfeited_date = await getEffectiveISO(job.shop_id);
    db.run(
      `UPDATE recap_job_master SET current_status = 'FORFEITED', ownership_type = 'SHOP_OWNED', forfeited_flag = 1, forfeited_date = ?, forfeited_by_staff_id = ?, forfeiture_reason = ?, closed_at = ? WHERE recap_job_id = ?`,
      [forfeited_date, performed_by_staff_id || null, forfeiture_reason || null, forfeited_date, job_id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        // Activate the finished item in item_master and add inventory stock so it appears in POS
        if (job.finished_item_id) {
          db.run(`UPDATE item_master SET is_active = 1 WHERE item_id = ?`, [job.finished_item_id]);
          const inv_id = `INVTXN-${Date.now()}`;
          db.run(
            `INSERT INTO inventory_ledger (inventory_ledger_id, shop_id, item_id, transaction_type, quantity, unit_cost, reference_id, dot_number, created_by, created_at)
             VALUES (?, ?, ?, 'PURCHASE', 1, ?, ?, ?, ?, ?)`,
            [inv_id, job.shop_id, job.finished_item_id, job.recap_cost || 0, job_id, job.dot_number || null, performed_by_staff_id || "FORFEIT", forfeited_date]
          );
        }
        const ledger_id = `RECAPL-${Date.now()}`;
        db.run(
          `INSERT INTO recap_job_ledger (recap_job_ledger_id, recap_job_id, shop_id, event_type, previous_status, new_status, performed_by_staff_id, system_note, event_timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [ledger_id, job_id, job.shop_id, "JOB_FORFEITED", job.current_status, "FORFEITED", performed_by_staff_id || null, forfeiture_reason ? `Forfeiture reason: ${forfeiture_reason}` : "Customer forfeited — ownership transferred to shop", forfeited_date],
          () => res.json({ job_id, status: "FORFEITED", message: "Job forfeited — ownership transferred to shop" }),
        );
      },
    );
  });
});

router.get("/recap-jobs/:job_id/history", (req, res) => {
  const { job_id } = req.params;
  db.all(
    `SELECT rjl.recap_job_ledger_id as ledger_id, rjl.recap_job_id as job_id, rjl.event_type,
      rjl.previous_status, rjl.new_status, rjl.performed_by_staff_id, sm.full_name AS staff_name,
      rjl.system_note, rjl.event_timestamp as timestamp
     FROM recap_job_ledger rjl
     LEFT JOIN staff_master sm ON rjl.performed_by_staff_id = sm.staff_id
     WHERE rjl.recap_job_id = ? ORDER BY rjl.event_timestamp DESC`,
    [job_id],
    (err, rows) => {
      if (err) return res.json({ error: err.message });
      res.json(rows || []);
    },
  );
});

/* ── Recap Price Defaults ── */
router.get("/recap-price-defaults/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  db.all(
    `SELECT size, recap_type, ownership_type, recap_cost, selling_price FROM recap_price_defaults WHERE shop_id = ?`,
    [shop_id],
    (err, rows) => {
      if (err) return res.json({ error: err.message });
      res.json(rows || []);
    }
  );
});

router.post("/recap-price-defaults/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  const { prices } = req.body; // array of { size, recap_type, ownership_type, recap_cost, selling_price }
  if (!Array.isArray(prices) || prices.length === 0) {
    return res.status(400).json({ error: "prices array required" });
  }
  const now = new Date().toISOString();
  let pending = prices.length;
  let hasError = null;
  prices.forEach(({ size, recap_type, ownership_type, recap_cost, selling_price }) => {
    const ot = ownership_type || 'SHOP_OWNED';
    db.run(
      `INSERT INTO recap_price_defaults (shop_id, size, recap_type, ownership_type, recap_cost, selling_price, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(shop_id, size, recap_type, ownership_type) DO UPDATE SET
         recap_cost = excluded.recap_cost,
         selling_price = excluded.selling_price,
         updated_at = excluded.updated_at`,
      [shop_id, size, recap_type, ot, parseFloat(recap_cost) || 0, parseFloat(selling_price) || 0, now],
      (err) => {
        if (err) hasError = err.message;
        pending--;
        if (pending === 0) {
          if (hasError) return res.status(500).json({ error: hasError });
          res.json({ ok: true });
        }
      }
    );
  });
});

module.exports = router;
