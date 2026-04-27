const express = require('express');
const router = express.Router();
const { db } = require('../Database');
const { v4: uuidv4 } = require('uuid');
const { getEffectiveYYYYMMDD } = require('../lib/businessDate');

// ── Expense Categories ────────────────────────────────────────────────────────

router.get('/expense-categories/:shop_id', (req, res) => {
  const { shop_id } = req.params;
  db.all(
    `SELECT * FROM expense_categories WHERE shop_id = ? AND is_active = 1 ORDER BY name`,
    [shop_id],
    (err, rows) => res.json(err ? { error: err.message } : rows || [])
  );
});

router.post('/expense-categories', (req, res) => {
  const { shop_id, name, color } = req.body;
  if (!shop_id || !name?.trim()) return res.status(400).json({ error: 'shop_id and name are required' });
  const category_id = `CAT-${uuidv4()}`;
  db.run(
    `INSERT INTO expense_categories (category_id, shop_id, name, color) VALUES (?, ?, ?, ?)`,
    [category_id, shop_id, name.trim(), color || '#f97316'],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ category_id, shop_id, name: name.trim(), color: color || '#f97316' });
    }
  );
});

router.put('/expense-categories/:category_id', (req, res) => {
  const { category_id } = req.params;
  const { name, color } = req.body;
  db.run(
    `UPDATE expense_categories SET name = ?, color = ? WHERE category_id = ?`,
    [name, color, category_id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Category not found' });
      res.json({ category_id, name, color });
    }
  );
});

router.delete('/expense-categories/:category_id', (req, res) => {
  const { category_id } = req.params;
  db.run(
    `UPDATE expense_categories SET is_active = 0 WHERE category_id = ?`,
    [category_id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Category not found' });
      res.json({ message: 'Category deleted' });
    }
  );
});

// ── Expenses ──────────────────────────────────────────────────────────────────

router.get('/expenses/:shop_id', async (req, res) => {
  const { shop_id } = req.params;
  const { startDate, endDate, category_id, q, page, perPage } = req.query;
  const paginated = page !== undefined || perPage !== undefined || q !== undefined;
  const today = await getEffectiveYYYYMMDD(shop_id);
  const start = startDate || today;
  const end = endDate || today;

  let where = `WHERE e.shop_id = ? AND e.is_void = 0 AND e.expense_date BETWEEN ? AND ?`;
  const params = [shop_id, start, end];
  if (category_id) { where += ` AND e.category_id = ?`; params.push(category_id); }
  if (paginated && q && String(q).trim()) {
    const like = `%${String(q).trim()}%`;
    where += ` AND (e.description LIKE ? OR e.reference_no LIKE ? OR ec.name LIKE ? OR e.notes LIKE ?)`;
    params.push(like, like, like, like);
  }

  const baseSql = `SELECT e.*, ec.name AS category_name, ec.color AS category_color
     FROM expenses e
     LEFT JOIN expense_categories ec ON e.category_id = ec.category_id
     ${where} ORDER BY e.expense_date DESC, e.created_at DESC`;

  if (!paginated) {
    db.all(baseSql, params, (err, rows) => res.json(err ? { error: err.message } : rows || []));
    return;
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedPerPage = Math.min(200, Math.max(1, parseInt(perPage, 10) || 20));
  const offset = (parsedPage - 1) * parsedPerPage;

  db.get(`SELECT COUNT(*) AS total FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.category_id ${where}`, params, (cErr, cRow) => {
    if (cErr) return res.status(500).json({ error: cErr.message });
    const total = cRow?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / parsedPerPage));
    db.all(`${baseSql} LIMIT ? OFFSET ?`, [...params, parsedPerPage, offset], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ data: rows || [], meta: { page: parsedPage, perPage: parsedPerPage, total, totalCount: total, totalPages } });
    });
  });
});

router.post('/expenses', async (req, res) => {
  const { shop_id, category_id, description, amount, expense_date, payment_method, reference_no, notes, recorded_by } = req.body;
  if (!shop_id || !description?.trim() || !amount || !expense_date) {
    return res.status(400).json({ error: 'shop_id, description, amount, and expense_date are required' });
  }

  // Only shift if the expense_date is "today" (prevent accidental shift of historical entries)
  const systemToday = new Date().toISOString().split('T')[0];
  let final_expense_date = expense_date;
  if (expense_date === systemToday) {
    final_expense_date = await getEffectiveYYYYMMDD(shop_id);
  }

  const expense_id = `EXP-${uuidv4()}`;
  db.run(
    `INSERT INTO expenses (expense_id, shop_id, category_id, description, amount, expense_date, payment_method, reference_no, notes, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [expense_id, shop_id, category_id || null, description.trim(), parseFloat(amount), final_expense_date, payment_method || 'CASH', reference_no || null, notes || null, recorded_by || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ expense_id, message: 'Expense recorded' });
    }
  );
});

router.put('/expenses/:expense_id', (req, res) => {
  const { expense_id } = req.params;
  const { category_id, description, amount, expense_date, payment_method, reference_no, notes } = req.body;
  db.run(
    `UPDATE expenses SET category_id=?, description=?, amount=?, expense_date=?, payment_method=?, reference_no=?, notes=? WHERE expense_id=? AND is_void=0`,
    [category_id || null, description, parseFloat(amount), expense_date, payment_method || 'CASH', reference_no || null, notes || null, expense_id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Expense not found or already voided' });
      res.json({ expense_id, message: 'Expense updated' });
    }
  );
});

router.patch('/expenses/:expense_id/void', (req, res) => {
  const { expense_id } = req.params;
  const { void_reason } = req.body;
  db.run(
    `UPDATE expenses SET is_void = 1, void_reason = ? WHERE expense_id = ?`,
    [void_reason || null, expense_id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Expense not found' });
      res.json({ message: 'Expense voided' });
    }
  );
});

// ── Summary / Analytics ───────────────────────────────────────────────────────

router.get('/expenses-summary/:shop_id', async (req, res) => {
  const { shop_id } = req.params;
  const today = await getEffectiveYYYYMMDD(shop_id);
  const { startDate, endDate } = req.query;
  const start = startDate || today;
  const end = endDate || today;

  const totalQ = `SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE shop_id=? AND is_void=0 AND expense_date BETWEEN ? AND ?`;
  const byMethodQ = `SELECT payment_method, COALESCE(SUM(amount),0) AS total FROM expenses WHERE shop_id=? AND is_void=0 AND expense_date BETWEEN ? AND ? GROUP BY payment_method`;
  const byCatQ = `
    SELECT ec.name AS category_name, ec.color AS category_color, COALESCE(SUM(e.amount),0) AS total, COUNT(*) AS count
    FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.category_id
    WHERE e.shop_id=? AND e.is_void=0 AND e.expense_date BETWEEN ? AND ?
    GROUP BY e.category_id ORDER BY total DESC`;
  const dailyQ = `SELECT expense_date, COALESCE(SUM(amount),0) AS total FROM expenses WHERE shop_id=? AND is_void=0 AND expense_date BETWEEN ? AND ? GROUP BY expense_date ORDER BY expense_date`;

  db.get(totalQ, [shop_id, start, end], (e1, r1) => {
    if (e1) return res.json({ error: e1.message });
    db.all(byMethodQ, [shop_id, start, end], (e2, r2) => {
      if (e2) return res.json({ error: e2.message });
      db.all(byCatQ, [shop_id, start, end], (e3, r3) => {
        if (e3) return res.json({ error: e3.message });
        db.all(dailyQ, [shop_id, start, end], (e4, r4) => {
          if (e4) return res.json({ error: e4.message });
          res.json({
            total: r1.total || 0,
            by_method: r2 || [],
            by_category: r3 || [],
            daily: r4 || [],
          });
        });
      });
    });
  });
});

module.exports = router;
