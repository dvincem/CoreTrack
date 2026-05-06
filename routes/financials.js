const express = require("express");
const router = express.Router();
const { db } = require("../Database");

router.get("/dashboard/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  // Accept ?date=YYYY-MM-DD from frontend so seeded/test data works regardless of system clock
  const today = req.query.date || new Date().toISOString().split('T')[0];
  const yearMonth = today.slice(0, 7); // 'YYYY-MM'
  db.get(
    `SELECT
      (SELECT COUNT(*) FROM item_master WHERE is_active = 1) as total_items,
      (SELECT COALESCE(SUM(current_quantity),0) FROM current_stock WHERE shop_id = ?) as total_stock,
      (SELECT COALESCE(SUM(total_amount),0) FROM sale_header WHERE shop_id = ? AND DATE(sale_datetime) = ? AND is_void = 0) as today_sales,
      (SELECT COUNT(*) FROM sale_header WHERE shop_id = ? AND DATE(sale_datetime) = ? AND is_void = 0) as today_transactions,
      (SELECT COALESCE(SUM(total_amount),0) FROM sale_header WHERE shop_id = ? AND strftime('%Y-%m', sale_datetime) = ? AND is_void = 0) as month_sales,
      (SELECT COUNT(*) FROM sale_header WHERE shop_id = ? AND strftime('%Y-%m', sale_datetime) = ? AND is_void = 0) as month_transactions,
      (SELECT 
         (SELECT COUNT(DISTINCT staff_id) FROM staff_attendance WHERE shop_id = ? AND attendance_date = ? AND status = 'PRESENT')
         +
         (SELECT COUNT(*) FROM staff_master WHERE is_active = 1 AND work_status = 'ALWAYS_PRESENT'
           AND staff_id NOT IN (SELECT staff_id FROM staff_attendance WHERE shop_id = ? AND attendance_date = ?))
       ) as present_staff,
      (SELECT COUNT(*) FROM customer_master WHERE shop_id = ?) as total_customers,
      (SELECT COALESCE(SUM(balance_amount),0) FROM accounts_receivable WHERE shop_id = ? AND status = 'OPEN') as total_receivables,
      (SELECT COALESCE(SUM(balance_amount),0) FROM accounts_payable WHERE shop_id = ? AND status = 'OPEN') as total_payables,
      (SELECT COUNT(*) FROM accounts_receivable WHERE shop_id = ? AND status = 'OPEN') as open_receivables_count,
      (SELECT COALESCE(SUM(commission_amount),0) FROM labor_log WHERE shop_id = ? AND business_date = ? AND is_void = 0) as today_commission,
      (SELECT COALESCE(SUM(total_amount),0) FROM labor_log WHERE shop_id = ? AND business_date = ? AND is_void = 0 AND commission_amount = 0) as today_labor`,
    [shop_id, shop_id, today, shop_id, today, shop_id, yearMonth, shop_id, yearMonth, shop_id, today, shop_id, today, shop_id, shop_id, shop_id, shop_id, today, shop_id, today],
    (err, row) => res.json(err ? { error: err.message } : row || {}),
  );
});

router.get("/dashboard-recent/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  db.all(
    `SELECT sh.sale_id, sh.sale_datetime, sh.total_amount, sh.invoice_number,
       st.full_name as staff_name, cm.customer_name,
       (SELECT MIN(si.brand) FROM sale_items si WHERE si.sale_id = sh.sale_id AND si.brand IS NOT NULL) as brand,
       (SELECT MIN(si.item_name) FROM sale_items si WHERE si.sale_id = sh.sale_id) as item_name
     FROM sale_header sh
     LEFT JOIN staff_master st ON sh.staff_id = st.staff_id
     LEFT JOIN customer_master cm ON sh.customer_id = cm.customer_id
     WHERE sh.shop_id = ? AND sh.is_void = 0
     ORDER BY sh.sale_datetime DESC LIMIT 6`,
    [shop_id],
    (err, rows) => res.json(err ? { error: err.message } : rows)
  );
});

router.get("/dashboard-top-items/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  db.all(
    `SELECT si.item_name, si.brand, si.category,
       SUM(si.quantity) as total_qty,
       SUM(si.line_total) as total_revenue,
       COUNT(DISTINCT si.sale_id) as sale_count
     FROM sale_items si
     JOIN sale_header sh ON si.sale_id = sh.sale_id
     WHERE sh.shop_id = ? AND si.sale_type = 'PRODUCT'
       AND strftime('%Y-%m', sh.sale_datetime) = strftime('%Y-%m', 'now')
     GROUP BY si.item_or_service_id
     ORDER BY total_qty DESC LIMIT 5`,
    [shop_id],
    (err, rows) => res.json(err ? { error: err.message } : rows)
  );
});

router.get("/receivables-kpi/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  db.get(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(ar.original_amount), 0) AS totalOrig,
       COALESCE(SUM(ar.balance_amount), 0) AS totalBalance,
       COALESCE(SUM(ar.amount_paid), 0) AS totalPaid,
       SUM(CASE WHEN ar.status = 'OPEN' THEN 1 ELSE 0 END) AS openCount,
       SUM(CASE WHEN ar.status = 'PAID' THEN 1 ELSE 0 END) AS paidCount
     FROM accounts_receivable ar WHERE ar.shop_id = ? AND ar.status != 'VOIDED' `,
    [shop_id],
    (err, row) => res.json(err ? { error: err.message } : (row || {}))
  );
});

router.get("/receivables/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  const { status, q, page, perPage } = req.query;
  const paginated = page !== undefined || perPage !== undefined || q !== undefined;

  let where = `ar.shop_id = ?`;
  const params = [shop_id];
  if (status && status !== 'ALL') { where += ` AND ar.status = ?`; params.push(status); }
  if (paginated && q && String(q).trim()) {
    const like = `%${String(q).trim()}%`;
    where += ` AND (c.customer_name LIKE ? OR ar.description LIKE ? OR c.contact_number LIKE ?)`;
    params.push(like, like, like);
  }

  const baseSql = `SELECT ar.*, c.customer_name, c.contact_number
     FROM accounts_receivable ar
     LEFT JOIN customer_master c ON ar.customer_id = c.customer_id
     WHERE ${where} ORDER BY ar.created_at DESC`;

  if (!paginated) {
    db.all(baseSql, params, (err, rows) => res.json(err ? { error: err.message } : rows));
    return;
  }

  const parsedPage    = Math.max(1, parseInt(page, 10) || 1);
  const parsedPerPage = Math.min(200, Math.max(1, parseInt(perPage, 10) || 20));
  const offset        = (parsedPage - 1) * parsedPerPage;

  db.get(`SELECT COUNT(*) AS total FROM accounts_receivable ar LEFT JOIN customer_master c ON ar.customer_id = c.customer_id WHERE ${where}`, params, (cErr, cRow) => {
    if (cErr) return res.status(500).json({ error: cErr.message });
    const total      = cRow?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / parsedPerPage));
    db.all(`${baseSql} LIMIT ? OFFSET ?`, [...params, parsedPerPage, offset], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ data: rows || [], meta: { page: parsedPage, perPage: parsedPerPage, total, totalCount: total, totalPages } });
    });
  });
});

router.post("/receivables", (req, res) => {
  const { v4: uuidv4 } = require("uuid");
  const { shop_id, customer_id, receivable_type, description, original_amount, down_payment, due_date, notes, created_by, is_opening_balance } = req.body;
  if (!shop_id || !customer_id || !original_amount) {
    return res.status(400).json({ error: "shop_id, customer_id, original_amount required" });
  }
  const dp = parseFloat(down_payment) || 0;
  const orig = parseFloat(original_amount);
  const balance = orig - dp;
  const receivable_id = `RCV-${uuidv4()}`;
  const now = new Date().toISOString();
  const isOpening = is_opening_balance ? 1 : 0;
  db.run(
    `INSERT INTO accounts_receivable (receivable_id, shop_id, customer_id, receivable_type, description, original_amount, down_payment, amount_paid, balance_amount, due_date, notes, status, created_by, is_opening_balance)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)`,
    [receivable_id, shop_id, customer_id, receivable_type || 'GENERAL', description || null, orig, dp, dp, balance, due_date || null, notes || null, created_by || null, isOpening],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      // record down payment if any
      if (dp > 0) {
        const pay_id = `RPAY-${uuidv4()}`;
        db.run(
          `INSERT INTO receivable_payments (payment_id, receivable_id, shop_id, amount, payment_date, payment_method, notes, recorded_by, created_at, is_opening_balance)
           VALUES (?, ?, ?, ?, ?, 'CASH', 'Down payment', ?, ?, ?)`,
          [pay_id, receivable_id, shop_id, dp, now, created_by || null, new Date().toISOString(), isOpening]
        );
      }
      res.json({ receivable_id, message: "Receivable created" });
    }
  );
});

router.post("/receivables/:receivable_id/payment", (req, res) => {
  const { v4: uuidv4 } = require("uuid");
  const { receivable_id } = req.params;
  const { shop_id, amount, payment_date, payment_method, notes, recorded_by } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: "Valid amount required" });
  const pay_id = `RPAY-${uuidv4()}`;
  const pdate = payment_date || new Date().toISOString();
  db.run(
    `INSERT INTO receivable_payments (payment_id, receivable_id, shop_id, amount, payment_date, payment_method, notes, recorded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [pay_id, receivable_id, shop_id, amount, pdate, payment_method || 'CASH', notes || null, recorded_by || null, new Date().toISOString()],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      // update amounts
      db.get(`SELECT original_amount, amount_paid, balance_amount FROM accounts_receivable WHERE receivable_id = ?`, [receivable_id], (err2, row) => {
        if (err2 || !row) return res.status(404).json({ error: "Receivable not found" });
        const newPaid = (row.amount_paid || 0) + parseFloat(amount);
        const newBalance = Math.max(0, row.original_amount - newPaid);
        const newStatus = newBalance <= 0 ? 'PAID' : 'OPEN';
        const closedAt = newBalance <= 0 ? new Date().toISOString() : null;
        db.run(
          `UPDATE accounts_receivable SET amount_paid = ?, balance_amount = ?, status = ?, closed_at = COALESCE(?, closed_at) WHERE receivable_id = ?`,
          [newPaid, newBalance, newStatus, closedAt, receivable_id],
          (err3) => {
            if (err3) return res.status(500).json({ error: err3.message });
            res.json({ payment_id: pay_id, new_balance: newBalance, status: newStatus });
          }
        );
      });
    }
  );
});

router.get("/receivables/:receivable_id/payments", (req, res) => {
  const { receivable_id } = req.params;
  db.all(
    `SELECT * FROM receivable_payments WHERE receivable_id = ? AND is_void = 0 ORDER BY payment_date DESC, created_at DESC`,
    [receivable_id],
    (err, rows) => res.json(err ? { error: err.message } : rows)
  );
});

router.put("/receivables/:receivable_id/void", (req, res) => {
  const { receivable_id } = req.params;
  const { void_reason } = req.body;
  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    db.run(
      `UPDATE accounts_receivable SET status = 'VOIDED', notes = COALESCE(notes || '\n', '') || ? WHERE receivable_id = ?`,
      [`VOIDED: ${void_reason || 'No reason'}`, receivable_id],
      function(err) {
        if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }
        db.run(
          `UPDATE receivable_payments SET is_void = 1, void_reason = ? WHERE receivable_id = ?`,
          [void_reason || null, receivable_id],
          (err2) => {
            if (err2) { db.run("ROLLBACK"); return res.status(500).json({ error: err2.message }); }
            db.run("COMMIT", (errC) => {
              if (errC) return res.status(500).json({ error: errC.message });
              res.json({ message: "Receivable voided successfully" });
            });
          }
        );
      }
    );
  });
});

/* ── BALE BOOK ─────────────────────────────────────────────────── */

router.get("/bale/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  const { status } = req.query;
  let q = `SELECT b.*, sm.full_name AS staff_name, sm.role
           FROM bale_book b
           LEFT JOIN staff_master sm ON b.staff_id = sm.staff_id
           WHERE b.shop_id = ?`;
  const params = [shop_id];
  if (status && status !== "ALL") { q += ` AND b.status = ?`; params.push(status); }
  q += ` ORDER BY b.created_at DESC`;
  db.all(q, params, (err, rows) => res.json(err ? { error: err.message } : (rows || [])));
});

router.post("/bale", (req, res) => {
  const { shop_id, staff_id, amount, bale_date, due_date, notes, created_by } = req.body;
  if (!shop_id || !staff_id || !amount || amount <= 0)
    return res.status(400).json({ error: "shop_id, staff_id, and a positive amount are required." });
  const bale_id = `BALE-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  const date = bale_date || new Date().toISOString();
  db.run(
    `INSERT INTO bale_book (bale_id, shop_id, staff_id, amount, balance_amount, amount_paid, bale_date, due_date, status, notes, created_by)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, 'ACTIVE', ?, ?)`,
    [bale_id, shop_id, staff_id, amount, amount, date, due_date || null, notes || null, created_by || null],
    function(err) {
      if (err) return res.status(400).json({ error: err.message });
      res.json({ bale_id, message: "Bale recorded" });
    }
  );
});

router.post("/bale/:bale_id/payment", (req, res) => {
  const { bale_id } = req.params;
  const { shop_id, amount, payment_date, payment_method, notes, recorded_by } = req.body;
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: "Enter a valid payment amount." });
  const pay_id = `BPAY-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  const pdate = payment_date || new Date().toISOString();
  db.run(
    `INSERT INTO bale_payments (payment_id, bale_id, shop_id, amount, payment_date, payment_method, notes, recorded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [pay_id, bale_id, shop_id, amt, pdate, payment_method || "CASH", notes || null, recorded_by || null, new Date().toISOString()],
    function(err) {
      if (err) return res.status(400).json({ error: err.message });
      db.get(`SELECT amount, balance_amount, amount_paid FROM bale_book WHERE bale_id = ?`, [bale_id], (err2, row) => {
        if (err2 || !row) return res.status(400).json({ error: "Bale not found" });
        const newPaid = (row.amount_paid || 0) + amt;
        const newBalance = Math.max(0, (row.balance_amount || 0) - amt);
        const newStatus = newBalance <= 0 ? "PAID" : "ACTIVE";
        const closedAt = newStatus === "PAID" ? new Date().toISOString() : null;
        db.run(
          `UPDATE bale_book SET amount_paid = ?, balance_amount = ?, status = ?, closed_at = COALESCE(?, closed_at) WHERE bale_id = ?`,
          [newPaid, newBalance, newStatus, closedAt, bale_id],
          (err3) => {
            if (err3) return res.status(400).json({ error: err3.message });
            res.json({ payment_id: pay_id, new_balance: newBalance, status: newStatus, message: "Payment recorded" });
          }
        );
      });
    }
  );
});

router.get("/bale/:bale_id/payments", (req, res) => {
  const { bale_id } = req.params;
  db.all(
    `SELECT * FROM bale_payments WHERE bale_id = ? ORDER BY payment_date DESC, created_at DESC`,
    [bale_id],
    (err, rows) => res.json(err ? { error: err.message } : (rows || []))
  );
});

router.get("/payables-kpi/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  db.get(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(ap.original_amount), 0) AS totalPayables,
       COALESCE(SUM(ap.balance_amount), 0) AS totalBalance,
       SUM(CASE WHEN ap.status = 'PAID' OR ap.balance_amount = 0 THEN 1 ELSE 0 END) AS paidCount,
       SUM(CASE WHEN ap.status != 'PAID' AND ap.balance_amount > 0 AND ap.due_date < date('now') THEN 1 ELSE 0 END) AS overdueCount,
       SUM(CASE WHEN ap.status != 'PAID' AND ap.balance_amount > 0 AND (ap.due_date IS NULL OR ap.due_date >= date('now')) THEN 1 ELSE 0 END) AS openCount,
       COALESCE(SUM(CASE WHEN strftime('%Y-%m', ap.due_date) = strftime('%Y-%m', 'now') AND ap.status != 'PAID' AND ap.balance_amount > 0 THEN ap.balance_amount ELSE 0 END), 0) AS monthBalance,
       COALESCE(SUM(CASE WHEN date(ap.due_date) >= date('now', 'weekday 0', '-7 days') AND date(ap.due_date) <= date('now', 'weekday 0', '-1 days') AND ap.status != 'PAID' AND ap.balance_amount > 0 THEN ap.balance_amount ELSE 0 END), 0) AS weekBalance,
       COALESCE(SUM(CASE WHEN strftime('%Y-%m', ap.due_date) = strftime('%Y-%m', 'now') THEN ap.original_amount ELSE 0 END), 0) AS monthOriginal,
       COALESCE(SUM(CASE WHEN strftime('%Y-%m', ap.due_date) = strftime('%Y-%m', 'now') THEN ap.amount_paid ELSE 0 END), 0) AS monthPaid
     FROM accounts_payable ap WHERE ap.shop_id = ? AND ap.status != 'VOIDED'`,
    [shop_id],
    (err, row) => res.json(err ? { error: err.message } : (row || {}))
  );
});

router.get("/payables/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  const { status, q, page, perPage, startDate, endDate } = req.query;
  const paginated = page !== undefined || perPage !== undefined || q !== undefined;

  let where = `ap.shop_id = ?`;
  const params = [shop_id];
  if (status && status === 'PAID')    { where += ` AND (ap.status = 'PAID' OR ap.balance_amount = 0)`; }
  else if (status === 'OVERDUE') { where += ` AND ap.status != 'PAID' AND ap.balance_amount > 0 AND ap.due_date < date('now')`; }
  else if (status === 'OPEN')    { where += ` AND ap.status != 'PAID' AND ap.balance_amount > 0 AND (ap.due_date IS NULL OR ap.due_date >= date('now'))`; }
  if (startDate) { where += ` AND ap.due_date >= ?`; params.push(startDate); }
  if (endDate)   { where += ` AND ap.due_date <= ?`; params.push(endDate); }
  if (paginated && q && String(q).trim()) {
    const like = `%${String(q).trim()}%`;
    where += ` AND (s.supplier_name LIKE ? OR s.contact_person LIKE ? OR ap.description LIKE ? OR ap.payee_name LIKE ?)`;
    params.push(like, like, like, like);
  }

  const baseSql = `SELECT ap.*, s.supplier_name, s.contact_person
     FROM accounts_payable ap
     LEFT JOIN supplier_master s ON ap.supplier_id = s.supplier_id
     WHERE ${where} ORDER BY ap.due_date ASC`;

  if (!paginated) {
    db.all(baseSql, params, (err, rows) => res.json(err ? { error: err.message } : rows));
    return;
  }

  const parsedPage    = Math.max(1, parseInt(page, 10) || 1);
  const parsedPerPage = Math.min(200, Math.max(1, parseInt(perPage, 10) || 20));
  const offset        = (parsedPage - 1) * parsedPerPage;

  db.get(`SELECT COUNT(*) AS total FROM accounts_payable ap LEFT JOIN supplier_master s ON ap.supplier_id = s.supplier_id WHERE ${where}`, params, (cErr, cRow) => {
    if (cErr) return res.status(500).json({ error: cErr.message });
    const total      = cRow?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / parsedPerPage));
    db.all(`${baseSql} LIMIT ? OFFSET ?`, [...params, parsedPerPage, offset], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ data: rows || [], meta: { page: parsedPage, perPage: parsedPerPage, total, totalCount: total, totalPages } });
    });
  });
});

router.post("/payables", (req, res) => {
  const { v4: uuidv4 } = require("uuid");
  const { shop_id, payable_type, supplier_id, payee_name, description, original_amount, due_date, notes, created_by,
          is_recurring, recurring_day, recurring_months, recurring_start_year, recurring_start_month,
          recurring_end_mode, recurring_until_date } = req.body;
  if (!shop_id || !original_amount)
    return res.status(400).json({ error: "shop_id and original_amount required" });
  const type = payable_type || "GENERAL";
  if (type === "SUPPLIER" && !supplier_id)
    return res.status(400).json({ error: "supplier_id required for supplier payables" });
  if (type === "GENERAL" && !payee_name)
    return res.status(400).json({ error: "payee_name required for general payables" });
  const orig = parseFloat(original_amount);

  if (is_recurring && recurring_day) {
    const group_id = `REC-${uuidv4()}`;
    const startYear = parseInt(recurring_start_year) || new Date().getFullYear();
    const startMonth = parseInt(recurring_start_month) ?? new Date().getMonth();
    const day = parseInt(recurring_day);
    const isIndefinite = recurring_end_mode === "never";

    // Compute total months
    let total;
    if (isIndefinite) {
      total = 120; // 10 years pre-generated
    } else if (recurring_end_mode === "until" && recurring_until_date) {
      const until = new Date(recurring_until_date);
      const start = new Date(startYear, startMonth, 1);
      total = Math.max(1, (until.getFullYear() - start.getFullYear()) * 12 + (until.getMonth() - start.getMonth()) + 1);
    } else {
      total = Math.max(1, parseInt(recurring_months) || 12);
    }

    const totalLabel = isIndefinite ? "∞" : String(total);
    const stmt = db.prepare(
      `INSERT INTO accounts_payable (payable_id, shop_id, payable_type, supplier_id, payee_name, description, notes,
        original_amount, amount_paid, balance_amount, status, due_date, recurring_group_id, recurring_installment, recurring_total, recurring_indefinite, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'OPEN', ?, ?, ?, ?, ?, ?)`
    );
    for (let i = 0; i < total; i++) {
      const d = new Date(startYear, startMonth + i, day);
      if (d.getMonth() !== (startMonth + i) % 12) d.setDate(0);
      const dueStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const pid = `PAY-${uuidv4()}`;
      const installDesc = `${description || payee_name} — Installment ${i + 1}${isIndefinite ? "" : ` of ${total}`}`;
      stmt.run([pid, shop_id, type, supplier_id || null, payee_name || null, installDesc, notes || null,
                orig, orig, dueStr, group_id, i + 1, isIndefinite ? null : total, isIndefinite ? 1 : 0, created_by || null]);
    }
    stmt.finalize((err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ recurring_group_id: group_id, count: total, indefinite: isIndefinite, message: `${total} recurring payables created` });
    });
  } else {
    const payable_id = `PAY-${uuidv4()}`;
    db.run(
      `INSERT INTO accounts_payable (payable_id, shop_id, payable_type, supplier_id, payee_name, description, notes, original_amount, amount_paid, balance_amount, status, due_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'OPEN', ?, ?)`,
      [payable_id, shop_id, type, supplier_id || null, payee_name || null, description || null, notes || null, orig, orig, due_date || null, created_by || null],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ payable_id, message: "Payable created" });
      }
    );
  }
});

// Edit a single payable
router.put("/payables/:payable_id", (req, res) => {
  const { payable_id } = req.params;
  const { description, original_amount, due_date, notes, payee_name } = req.body;
  const orig = parseFloat(original_amount);
  if (isNaN(orig) || orig <= 0) return res.status(400).json({ error: "Valid amount required" });
  // Recalculate balance: keep amount_paid, adjust balance
  db.get(`SELECT amount_paid FROM accounts_payable WHERE payable_id = ?`, [payable_id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: "Payable not found" });
    const paid = row.amount_paid || 0;
    const newBalance = Math.max(0, orig - paid);
    const newStatus = newBalance <= 0 ? "PAID" : "OPEN";
    db.run(
      `UPDATE accounts_payable SET description = ?, original_amount = ?, balance_amount = ?, status = CASE WHEN status = 'CHECK_RELEASED' THEN 'CHECK_RELEASED' ELSE ? END, due_date = ?, notes = ?, payee_name = COALESCE(?, payee_name) WHERE payable_id = ?`,
      [description || null, orig, newBalance, newStatus, due_date || null, notes || null, payee_name || null, payable_id],
      function(err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ payable_id, original_amount: orig, balance_amount: newBalance, status: newStatus });
      }
    );
  });
});

// Edit this installment + all future ones in a recurring group
router.put("/payables/recurring-group/:group_id/from/:installment", (req, res) => {
  const { group_id, installment } = req.params;
  const { description, original_amount, notes } = req.body;
  const orig = parseFloat(original_amount);
  if (isNaN(orig) || orig <= 0) return res.status(400).json({ error: "Valid amount required" });
  const fromInst = parseInt(installment);
  // Only update OPEN entries (don't touch already paid ones)
  db.all(
    `SELECT payable_id, amount_paid, recurring_installment FROM accounts_payable WHERE recurring_group_id = ? AND recurring_installment >= ? AND status = 'OPEN'`,
    [group_id, fromInst],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows.length) return res.json({ updated: 0, message: "No open future installments to update" });
      const stmt = db.prepare(
        `UPDATE accounts_payable SET original_amount = ?, balance_amount = ?, notes = ?, description = ? WHERE payable_id = ?`
      );
      rows.forEach(r => {
        const newBalance = Math.max(0, orig - (r.amount_paid || 0));
        const instNum = r.recurring_installment;
        const newDesc = description ? description.replace(/ — Installment \d+.*$/, "") + ` — Installment ${instNum}` : null;
        stmt.run([orig, newBalance, notes || null, newDesc, r.payable_id]);
      });
      stmt.finalize((e) => {
        if (e) return res.status(500).json({ error: e.message });
        res.json({ updated: rows.length, message: `Updated ${rows.length} installments` });
      });
    }
  );
});

router.post("/payables/:payable_id/payment", (req, res) => {
  const { v4: uuidv4 } = require("uuid");
  const { payable_id } = req.params;
  const { shop_id, amount, payment_date, payment_method, notes, recorded_by,
          check_number, bank, check_date, release_date } = req.body;
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: "Valid amount required" });
  const pay_id = `PPAY-${uuidv4()}`;
  const pdate = payment_date || new Date().toISOString();
  db.run(
    `INSERT INTO payable_payments (payment_id, payable_id, shop_id, amount, payment_date, payment_method,
      check_number, bank, check_date, release_date, check_status, notes, recorded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [pay_id, payable_id, shop_id, amt, pdate, payment_method || 'CHECK',
     check_number || null, bank || null, check_date || null, release_date || null,
     'CLEARED', notes || null, recorded_by || null, new Date().toISOString()],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get(`SELECT original_amount, amount_paid, balance_amount FROM accounts_payable WHERE payable_id = ?`, [payable_id], (err2, row) => {
        if (err2 || !row) return res.status(404).json({ error: "Payable not found" });
        const newPaid = (row.amount_paid || 0) + amt;
        const newBalance = Math.max(0, row.original_amount - newPaid);
        const newStatus = newBalance <= 0 ? 'PAID' : 'OPEN';
        const closedAt = newBalance <= 0 ? new Date().toISOString() : null;
        db.run(
          `UPDATE accounts_payable SET amount_paid = ?, balance_amount = ?, status = ?, closed_at = COALESCE(?, closed_at) WHERE payable_id = ?`,
          [newPaid, newBalance, newStatus, closedAt, payable_id],
          (err3) => {
            if (err3) return res.status(500).json({ error: err3.message });
            // Also log in payment_ledger for unified reporting
            const { v4: uuidv4l } = require("uuid");
            db.run(
              `INSERT INTO payment_ledger (payment_id, shop_id, reference_type, reference_id, payment_method, amount, payment_date, recorded_by)
               VALUES (?, ?, 'PAYABLE', ?, ?, ?, ?, ?)`,
              [`PL-${uuidv4l()}`, shop_id, payable_id, payment_method || 'CHECK', amt, pdate, recorded_by || null],
              () => res.json({ payment_id: pay_id, new_balance: newBalance, status: newStatus, check_status: 'CLEARED' })
            );
          }
        );
      });
    }
  );
});

// Mark a released check as funded (money transferred to bank ~1 week before due)
router.post("/payables/:payable_id/payments/:payment_id/fund", (req, res) => {
  const { payment_id } = req.params;
  const funded_date = req.body.funded_date || new Date().toISOString();
  db.run(
    `UPDATE payable_payments SET check_status = 'FUNDED', funded_date = ? WHERE payment_id = ? AND check_status = 'RELEASED'`,
    [funded_date, payment_id],
    function(err) {
      if (err || this.changes === 0) return res.status(400).json({ error: err ? err.message : "Payment not found or not in RELEASED status" });
      res.json({ payment_id, check_status: 'FUNDED', funded_date });
    }
  );
});

// Mark a released check as cleared → reduces payable balance
router.post("/payables/:payable_id/payments/:payment_id/clear", (req, res) => {
  const { payable_id, payment_id } = req.params;
  db.run(
    `UPDATE payable_payments SET check_status = 'CLEARED' WHERE payment_id = ? AND (check_status = 'RELEASED' OR check_status = 'FUNDED')`,
    [payment_id],
    function(err) {
      if (err || this.changes === 0) return res.status(400).json({ error: err ? err.message : "Payment not found or already cleared" });
      db.get(`SELECT amount FROM payable_payments WHERE payment_id = ?`, [payment_id], (e, pmnt) => {
        if (!pmnt) return res.status(404).json({ error: "Payment not found" });
        db.get(`SELECT original_amount, amount_paid, balance_amount FROM accounts_payable WHERE payable_id = ?`, [payable_id], (e2, row) => {
          if (!row) return res.status(404).json({ error: "Payable not found" });
          const newPaid = (row.amount_paid || 0) + pmnt.amount;
          const newBalance = Math.max(0, row.original_amount - newPaid);
          const newStatus = newBalance <= 0 ? 'PAID' : 'OPEN';
          const closedAt = newBalance <= 0 ? new Date().toISOString() : null;
          db.run(
            `UPDATE accounts_payable SET amount_paid = ?, balance_amount = ?, status = ?, closed_at = COALESCE(?, closed_at) WHERE payable_id = ?`,
            [newPaid, newBalance, newStatus, closedAt, payable_id],
            (e3) => {
              if (e3) return res.status(500).json({ error: e3.message });
              res.json({ new_balance: newBalance, status: newStatus });
            }
          );
        });
      });
    }
  );
});

// Mark a released check as bounced
router.post("/payables/:payable_id/payments/:payment_id/bounce", (req, res) => {
  const { payable_id, payment_id } = req.params;
  db.run(
    `UPDATE payable_payments SET check_status = 'BOUNCED' WHERE payment_id = ? AND (check_status = 'RELEASED' OR check_status = 'FUNDED')`,
    [payment_id],
    function(err) {
      if (err || this.changes === 0) return res.status(400).json({ error: err ? err.message : "Not found or already processed" });
      // Revert payable status back to OPEN
      db.run(`UPDATE accounts_payable SET status = 'OPEN' WHERE payable_id = ? AND status = 'CHECK_RELEASED'`, [payable_id], () => {
        res.json({ message: "Check marked as bounced, payable reopened" });
      });
    }
  );
});

router.get("/payables/:payable_id/payments", (req, res) => {
  const { payable_id } = req.params;
  db.all(
    `SELECT * FROM payable_payments WHERE payable_id = ? AND is_void = 0 ORDER BY payment_date DESC, created_at DESC`,
    [payable_id],
    (err, rows) => res.json(err ? { error: err.message } : rows)
  );
});

router.put("/payables/:payable_id/void", (req, res) => {
  const { payable_id } = req.params;
  const { void_reason } = req.body;
  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    db.run(
      `UPDATE accounts_payable SET status = 'VOIDED', notes = COALESCE(notes || '\n', '') || ? WHERE payable_id = ?`,
      [`VOIDED: ${void_reason || 'No reason'}`, payable_id],
      function(err) {
        if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }
        db.run(
          `UPDATE payable_payments SET is_void = 1, void_reason = ? WHERE payable_id = ?`,
          [void_reason || null, payable_id],
          (err2) => {
            if (err2) { db.run("ROLLBACK"); return res.status(500).json({ error: err2.message }); }
            db.run(
              `UPDATE payment_ledger SET is_void = 1, void_reason = ? WHERE reference_type = 'PAYABLE' AND reference_id = ?`,
              [void_reason || null, payable_id],
              (err3) => {
                if (err3) { db.run("ROLLBACK"); return res.status(500).json({ error: err3.message }); }
                db.run("COMMIT", (errC) => {
                  if (errC) return res.status(500).json({ error: errC.message });
                  res.json({ message: "Payable voided successfully" });
                });
              }
            );
          }
        );
      }
    );
  });
});

router.delete("/payables/:payable_id", (req, res) => {
  const { payable_id } = req.params;
  // Only allow deletion of GENERAL type payables
  db.get("SELECT payable_type FROM accounts_payable WHERE payable_id = ?", [payable_id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Payable not found" });
    if (row.payable_type !== "GENERAL") return res.status(403).json({ error: "Only GENERAL payables can be deleted." });
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      db.run("DELETE FROM payable_payments WHERE payable_id = ?", [payable_id], (err1) => {
        if (err1) { db.run("ROLLBACK"); return res.status(500).json({ error: err1.message }); }
        db.run("DELETE FROM accounts_payable WHERE payable_id = ?", [payable_id], (err2) => {
          if (err2) { db.run("ROLLBACK"); return res.status(500).json({ error: err2.message }); }
          db.run("COMMIT", (errC) => {
            if (errC) return res.status(500).json({ error: errC.message });
            res.json({ message: "Payable deleted successfully" });
          });
        });
      });
    });
  });
});

/* ── FINANCIAL HEALTH ──────────────────────────────────────────── */
router.get("/financial-health/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: "start and end dates required" });

  // 1. Total sales revenue in period
  const qSales = `
    SELECT COALESCE(SUM(total_amount), 0) AS sales_revenue,
           COUNT(*) AS sales_count
    FROM sale_header
    WHERE shop_id = ? AND DATE(sale_datetime) BETWEEN ? AND ?`;

  // 2. Total payables DUE in period — both paid and unpaid
  const qPayables = `
    SELECT COALESCE(SUM(original_amount), 0) AS payables_created,
           COUNT(*) AS payables_count
    FROM accounts_payable
    WHERE shop_id = ? AND status != 'VOIDED'
      AND DATE(due_date) BETWEEN ? AND ?`;

  // 3. Open payables BALANCE at end of period (running total still owed)
  const qOpenPayables = `
    SELECT COALESCE(SUM(balance_amount), 0) AS open_payables_balance,
           COUNT(*) AS open_payables_count
    FROM accounts_payable
    WHERE shop_id = ? AND status NOT IN ('PAID','VOIDED')`;

  // 4. Expenses paid in period
  const qExpenses = `
    SELECT COALESCE(SUM(amount), 0) AS expenses_total,
           COUNT(*) AS expenses_count
    FROM expenses
    WHERE shop_id = ? AND is_void = 0 AND DATE(expense_date) BETWEEN ? AND ?`;

  // 5. Payables PAID in period (cash actually going out)
  const qPayablesPaid = `
    SELECT COALESCE(SUM(amount), 0) AS payables_paid
    FROM payable_payments pp
    JOIN accounts_payable ap ON pp.payable_id = ap.payable_id
    WHERE ap.shop_id = ? AND DATE(pp.payment_date) BETWEEN ? AND ?`;

  // 6b. Receivables collected in period (cash actually coming in from credit customers)
  // Excludes opening balance down payment rows — those are pre-existing amounts, not new cash
  const qRcvCollected = `
    SELECT COALESCE(SUM(rp.amount), 0) AS receivables_collected,
           COUNT(*) AS receivables_collected_count
    FROM receivable_payments rp
    WHERE rp.shop_id = ? AND DATE(rp.payment_date) BETWEEN ? AND ?
      AND (rp.is_opening_balance IS NULL OR rp.is_opening_balance = 0)`;

  // 7. Open accounts receivable (customers still owe us)
  const qOpenReceivables = `
    SELECT COALESCE(SUM(balance_amount), 0) AS open_receivables,
           COUNT(*) AS open_receivables_count
    FROM accounts_receivable
    WHERE shop_id = ? AND status = 'OPEN'`;

  // 8. Overdue payables (past due, not paid)
  const qOverduePayables = `
    SELECT COALESCE(SUM(balance_amount), 0) AS overdue_payables,
           COUNT(*) AS overdue_payables_count
    FROM accounts_payable
    WHERE shop_id = ? AND status NOT IN ('PAID','VOIDED')
      AND DATE(due_date) < DATE('now')`;

  // 9. Upcoming payables (due in next 14 days, not paid)
  const qUpcoming = `
    SELECT ap.payable_id, ap.description, ap.balance_amount, ap.due_date,
           ap.payable_type, ap.payee_name, sm.supplier_name
    FROM accounts_payable ap
    LEFT JOIN supplier_master sm ON ap.supplier_id = sm.supplier_id
    WHERE ap.shop_id = ? AND ap.status NOT IN ('PAID','VOIDED')
      AND DATE(ap.due_date) BETWEEN DATE('now') AND DATE('now', '+14 days')
    ORDER BY ap.due_date ASC LIMIT 8`;

  // 10. Period Payables (due in filtered period)
  const qPeriodPayables = `
    SELECT COALESCE(SUM(balance_amount), 0) AS period_payables_balance,
           COUNT(*) AS period_payables_count
    FROM accounts_payable
    WHERE shop_id = ? AND status NOT IN ('PAID','VOIDED')
      AND DATE(due_date) BETWEEN ? AND ?`;

  // 11. Top Expense Category
  const qTopExpenseCategory = `
    SELECT ec.name AS category_name, SUM(e.amount) AS total
    FROM expenses e
    JOIN expense_categories ec ON e.category_id = ec.category_id
    WHERE e.shop_id = ? AND e.is_void = 0 AND DATE(e.expense_date) BETWEEN ? AND ?
    GROUP BY ec.name
    ORDER BY total DESC LIMIT 1`;

  // 6. Previous period comparison (same length, before start)
  const msStart = new Date(start).getTime();
  const msEnd   = new Date(end).getTime();
  const len     = msEnd - msStart;
  const prevEnd   = new Date(msStart - 86400000).toISOString().split('T')[0];
  const prevStart = new Date(msStart - len - 86400000).toISOString().split('T')[0];

  const qPrevSales = `
    SELECT COALESCE(SUM(total_amount), 0) AS prev_sales
    FROM sale_header
    WHERE shop_id = ? AND DATE(sale_datetime) BETWEEN ? AND ?`;

  const run = (q, p, multi = false) => new Promise((resolve, reject) => {
    const method = multi ? db.all.bind(db) : db.get.bind(db);
    method(q, p, (err, row) => err ? reject(err) : resolve(row));
  });

  Promise.all([
    run(qSales,              [shop_id, start, end]),
    run(qPayables,           [shop_id, start, end]),
    run(qOpenPayables,       [shop_id]),
    run(qExpenses,           [shop_id, start, end]),
    run(qPayablesPaid,       [shop_id, start, end]),
    run(qPrevSales,          [shop_id, prevStart, prevEnd]),
    run(qRcvCollected,       [shop_id, start, end]),
    run(qOpenReceivables,    [shop_id]),
    run(qOverduePayables,    [shop_id]),
    run(qUpcoming,           [shop_id], true),
    run(qPeriodPayables,     [shop_id, start, end]),
    run(qTopExpenseCategory, [shop_id, start, end]),
  ]).then(([r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12]) => {
    const sales_revenue               = r1.sales_revenue               || 0;
    const sales_count                 = r1.sales_count                 || 0;
    const payables_created            = r2.payables_created            || 0;
    const payables_count              = r2.payables_count              || 0;
    const open_payables               = r3.open_payables_balance       || 0;
    const open_payables_count         = r3.open_payables_count         || 0;
    const expenses_total              = r4.expenses_total              || 0;
    const expenses_count              = r4.expenses_count              || 0;
    const payables_paid               = r5.payables_paid               || 0;
    const prev_sales                  = r6.prev_sales                  || 0;
    const receivables_collected       = r7.receivables_collected       || 0;
    const receivables_collected_count = r7.receivables_collected_count || 0;
    const open_receivables            = r8.open_receivables            || 0;
    const open_receivables_count      = r8.open_receivables_count      || 0;
    const overdue_payables            = r9.overdue_payables            || 0;
    const overdue_payables_count      = r9.overdue_payables_count      || 0;
    const upcoming_payables           = r10 || [];
    const period_payables_balance     = r11.period_payables_balance     || 0;
    const period_payables_count       = r11.period_payables_count       || 0;
    const top_category_name           = r12?.category_name              || '—';
    const top_category_amount         = r12?.total                      || 0;

    const cash_out     = payables_paid + expenses_total;
    const net_position = sales_revenue + receivables_collected - payables_created - expenses_total;
    const accrual_net  = net_position;

    const prev_pct = prev_sales > 0
      ? ((sales_revenue - prev_sales) / prev_sales) * 100
      : null;

    const total_in        = sales_revenue + receivables_collected;
    const collection_rate = total_in > 0
      ? Math.round((receivables_collected / total_in) * 100)
      : 0;

    res.json({
      period: { start, end },
      sales_revenue, sales_count,
      payables_created, payables_count,
      payables_paid,
      open_payables, open_payables_count,
      period_payables_balance, period_payables_count,
      expenses_total, expenses_count,
      top_category_name, top_category_amount,
      receivables_collected, receivables_collected_count,
      open_receivables, open_receivables_count,
      overdue_payables, overdue_payables_count,
      upcoming_payables,
      collection_rate,
      cash_out,
      net_position,
      accrual_net,
      prev_sales,
      prev_pct,
    });
  }).catch(err => res.status(500).json({ error: err.message }));
});

/* ══════════════════════════════════════════
   GET /sales-projection/:shop_id
   Query params:
     history=30|60|90  (days of history to base velocity on, default 30)
     horizon=7|14|30|60|90  (days to project forward, default 30)
     lead_time=N  (reorder lead time in days, default 14)
══════════════════════════════════════════ */
router.get('/sales-projection/:shop_id', (req, res) => {
  const { shop_id } = req.params;
  const history   = Math.max(1, parseInt(req.query.history  || 30));
  const horizon   = Math.max(1, parseInt(req.query.horizon  || 30));
  const lead_time = Math.max(1, parseInt(req.query.lead_time || 14));

  const today    = new Date().toISOString().split('T')[0];
  const histStart = new Date(Date.now() - history * 86400000).toISOString().split('T')[0];

  // 1. Sales velocity grouped by brand/design/size (DOT-agnostic)
  const velocitySQL = `
    SELECT
      im.brand                AS brand,
      im.design               AS design,
      im.size                 AS size,
      MAX(si.category)        AS category,
      SUM(si.quantity)        AS total_qty_sold,
      SUM(si.line_total)      AS total_revenue,
      AVG(si.unit_price)      AS avg_unit_price,
      COUNT(DISTINCT si.sale_id) AS tx_count,
      CAST(SUM(si.quantity) AS REAL) / ? AS avg_daily_qty,
      CAST(SUM(si.line_total) AS REAL) / ? AS avg_daily_revenue
    FROM sale_items si
    JOIN sale_header sh ON si.sale_id = sh.sale_id
    JOIN item_master im ON si.item_or_service_id = im.item_id
    WHERE sh.shop_id = ?
      AND si.sale_type = 'PRODUCT'
      AND (si.is_custom IS NULL OR si.is_custom = 0)
      AND DATE(sh.sale_datetime) BETWEEN ? AND ?
    GROUP BY im.brand, im.design, im.size
    HAVING SUM(si.quantity) > 0
    ORDER BY avg_daily_qty DESC
  `;

  // 2. Current stock summed across all DOT variants per brand/design/size
  const stockSQL = `
    SELECT im.brand, im.design, im.size, SUM(cs.current_quantity) AS total_stock
    FROM current_stock cs
    JOIN item_master im ON cs.item_id = im.item_id
    WHERE cs.shop_id = ?
    GROUP BY im.brand, im.design, im.size
  `;

  // 3. Reorder point — max across all DOT variants per brand/design/size
  const reorderSQL = `
    SELECT brand, design, size, MAX(reorder_point) AS reorder_point
    FROM item_master
    GROUP BY brand, design, size
  `;

  db.all(velocitySQL, [history, history, shop_id, histStart, today], (err, velocityRows) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all(stockSQL, [shop_id], (err2, stockRows) => {
      if (err2) return res.status(500).json({ error: err2.message });

      db.all(reorderSQL, [], (err3, reorderRows) => {
        if (err3) return res.status(500).json({ error: err3.message });

        const stockMap   = Object.fromEntries(stockRows.map(r => [`${r.brand}|${r.design}|${r.size}`, r.total_stock]));
        const reorderMap = Object.fromEntries(reorderRows.map(r => [`${r.brand}|${r.design}|${r.size}`, r]));

        const items = velocityRows.map(v => {
          const key        = `${v.brand}|${v.design}|${v.size}`;
          const stock      = stockMap[key] || 0;
          const dailyQty   = v.avg_daily_qty || 0;
          const dailyRev   = v.avg_daily_revenue || 0;
          const reorderPt  = reorderMap[key]?.reorder_point || 5;

          // Days of stock remaining at current sales pace
          const days_remaining = dailyQty > 0 ? Math.floor(stock / dailyQty) : 9999;

          // Projected depletion date
          const depletion_date = dailyQty > 0
            ? new Date(Date.now() + days_remaining * 86400000).toISOString().split('T')[0]
            : null;

          // Suggested reorder: cover lead_time + horizon demand, minus current stock
          const demand_in_horizon  = Math.ceil(dailyQty * (lead_time + horizon));
          const suggested_reorder  = Math.max(0, demand_in_horizon - stock);

          // Projected revenue for the horizon
          const projected_revenue = Math.round(dailyRev * horizon * 100) / 100;

          // Status — based on current stock quantity
          let status = 'OK';
          if (stock <= 0)       status = 'OUT_OF_STOCK';
          else if (stock <= 2)  status = 'CRITICAL';
          else if (stock <= 3)  status = 'WARNING';

          return {
            item_key:          key,
            item_name:         [v.brand, v.design, v.size].filter(Boolean).join(' '),
            brand:             v.brand,
            design:            v.design,
            size:              v.size,
            category:          v.category,
            current_stock:     stock,
            total_qty_sold:    Math.round(v.total_qty_sold * 10) / 10,
            total_revenue:     Math.round(v.total_revenue * 100) / 100,
            avg_unit_price:    Math.round(v.avg_unit_price * 100) / 100,
            tx_count:          v.tx_count,
            avg_daily_qty:     Math.round(dailyQty * 100) / 100,
            avg_daily_revenue: Math.round(dailyRev * 100) / 100,
            days_remaining:    days_remaining === 9999 ? null : days_remaining,
            depletion_date,
            suggested_reorder,
            projected_revenue,
            reorder_point:     reorderPt,
            status,
          };
        });

        // Summary stats
        const summary = {
          history_days:        history,
          horizon_days:        horizon,
          lead_time_days:      lead_time,
          total_items_tracked: items.length,
          out_of_stock:        items.filter(i => i.status === 'OUT_OF_STOCK').length,
          critical:            items.filter(i => i.status === 'CRITICAL').length,
          warning:             items.filter(i => i.status === 'WARNING').length,
          ok:                  items.filter(i => i.status === 'OK').length,
          total_projected_revenue: Math.round(items.reduce((s, i) => s + i.projected_revenue, 0) * 100) / 100,
          avg_daily_revenue_total: Math.round(items.reduce((s, i) => s + i.avg_daily_revenue, 0) * 100) / 100,
          items_needing_reorder:   items.filter(i => i.suggested_reorder > 0).length,
        };

        res.json({ summary, items });
      });
    });
  });
});

module.exports = router;
