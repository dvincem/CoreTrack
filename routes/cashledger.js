const express = require('express');
const router  = express.Router();
const { db }  = require('../Database');
const { v4: uuidv4 } = require('uuid');
const { getEffectiveYYYYMMDD } = require('../lib/businessDate');

const VALID_TYPES = ['CASH_IN', 'CASH_OUT', 'GCASH_IN', 'GCASH_OUT', 'CARD_IN', 'CARD_OUT', 'BANK_IN', 'BANK_OUT'];

function normalizeMethod(m) {
  if (!m) return 'CASH';
  const u = m.toUpperCase();
  if (u.startsWith('BANK')) return 'BANK';
  if (u === 'CHECK') return 'BANK';
  if (['CASH', 'GCASH', 'CARD', 'CREDIT'].includes(u)) return u;
  return 'CASH';
}

function q(sql, params) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
  });
}

// ─── Unified Cash Flow endpoint ───────────────────────────────────────────────
router.get('/cash-flow/:shop_id', async (req, res) => {
  const { shop_id } = req.params;
  const today = await getEffectiveYYYYMMDD(shop_id);
  const startDate = req.query.startDate || today;
  const endDate = req.query.endDate || today;

  try {
    const [manual, sales, expenses, receivables, payables] = await Promise.all([
      // 1. Manual cash_ledger entries
      q(`SELECT * FROM cash_ledger WHERE shop_id = ? AND is_void = 0 AND entry_date BETWEEN ? AND ?
         ORDER BY entry_date, created_at`, [shop_id, startDate, endDate]),

      // 2. Sales (with items summary)
      q(`SELECT sh.sale_id, DATE(sh.sale_datetime) AS sale_date, TIME(sh.sale_datetime) AS sale_time,
            sh.total_amount, sh.payment_method, sh.payment_splits, sh.credit_down_payment,
            sh.invoice_number, sh.created_by,
            GROUP_CONCAT(DISTINCT si.item_name) AS item_names,
            cm.customer_name
         FROM sale_header sh
         LEFT JOIN sale_items si ON sh.sale_id = si.sale_id
         LEFT JOIN customer_master cm ON sh.customer_id = cm.customer_id
         WHERE sh.shop_id = ? AND DATE(sh.sale_datetime) BETWEEN ? AND ? AND sh.is_void = 0
         GROUP BY sh.sale_id`, [shop_id, startDate, endDate]),

      // 3. Expenses
      q(`SELECT e.*, ec.name AS category_name FROM expenses e
         LEFT JOIN expense_categories ec ON e.category_id = ec.category_id
         WHERE e.shop_id = ? AND e.is_void = 0 AND e.expense_date BETWEEN ? AND ?`,
        [shop_id, startDate, endDate]),

      // 4. Receivable payments (credit collections)
      q(`SELECT rp.*, ar.description AS receivable_desc, cm.customer_name
         FROM receivable_payments rp
         JOIN accounts_receivable ar ON rp.receivable_id = ar.receivable_id
         LEFT JOIN customer_master cm ON ar.customer_id = cm.customer_id
         WHERE rp.shop_id = ? AND ar.status != 'VOIDED' AND rp.payment_date BETWEEN ? AND ?`,
        [shop_id, startDate, endDate]),

      // 5. Payable payments (supplier payments)
      q(`SELECT pp.*, ap.description AS payable_desc, ap.payee_name, sm.supplier_name
         FROM payable_payments pp
         JOIN accounts_payable ap ON pp.payable_id = ap.payable_id
         LEFT JOIN supplier_master sm ON ap.supplier_id = sm.supplier_id
         WHERE pp.shop_id = ? AND ap.status != 'VOIDED' AND pp.payment_date BETWEEN ? AND ?`,
        [shop_id, startDate, endDate]),
    ]);

    const unified = [];

    // ── Manual entries ──
    manual.forEach(e => {
      const isIn = e.entry_type.endsWith('_IN');
      let method = 'CASH';
      
      // GCash In/Out manual entries involve physical cash at the shop (Customer gives/receives cash)
      // So they are categorized under the 'CASH' method to affect Cash on Hand correctly.
      if (e.entry_type.startsWith('GCASH')) {
        method = 'CASH';
      } else if (e.entry_type.startsWith('CARD')) {
        method = 'CARD';
      } else if (e.entry_type.startsWith('BANK')) {
        method = 'BANK';
      }

      // Format Source Label specifically from entry_type (e.g. "GCASH_IN" -> "Gcash In")
      const formattedLabel = e.entry_type
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

      unified.push({
        id: e.entry_id, date: e.entry_date, time: e.entry_time || '',
        source: 'MANUAL', source_label: formattedLabel,
        payment_method: method, direction: isIn ? 'IN' : 'OUT',
        amount: e.amount, description: e.description,
        notes: e.notes, recorded_by: e.recorded_by,
        reference_id: e.entry_id, editable: true, original: e,
      });
    });

    // ── Sales ──
    sales.forEach(s => {
      let splits = [];
      if (s.payment_splits) { try { splits = JSON.parse(s.payment_splits); } catch {} }
      const items = s.item_names ? s.item_names.split(',').slice(0, 3).join(', ') : 'Sale';
      const desc = s.invoice_number ? `${s.invoice_number}: ${items}` : items;
      const cust = s.customer_name ? ` · ${s.customer_name}` : '';

      if (splits.length > 0) {
        splits.forEach(sp => {
          if (sp.method === 'CREDIT') return; // deferred — not cash movement
          unified.push({
            id: `${s.sale_id}-${sp.method}`, date: s.sale_date, time: s.sale_time || '',
            source: 'SALE', source_label: 'Sale',
            payment_method: normalizeMethod(sp.method), direction: 'IN',
            amount: parseFloat(sp.amount) || 0, description: desc + cust,
            notes: null, recorded_by: s.created_by,
            reference_id: s.sale_id, editable: false,
          });
        });
        if (s.credit_down_payment > 0) {
          unified.push({
            id: `${s.sale_id}-DP`, date: s.sale_date, time: s.sale_time || '',
            source: 'SALE', source_label: 'Sale (Down Payment)',
            payment_method: 'CASH', direction: 'IN',
            amount: s.credit_down_payment, description: `Down Payment: ${desc}${cust}`,
            notes: null, recorded_by: s.created_by,
            reference_id: s.sale_id, editable: false,
          });
        }
      } else if (s.payment_method === 'CREDIT') {
        if (s.credit_down_payment > 0) {
          unified.push({
            id: `${s.sale_id}-DP`, date: s.sale_date, time: s.sale_time || '',
            source: 'SALE', source_label: 'Sale (Down Payment)',
            payment_method: 'CASH', direction: 'IN',
            amount: s.credit_down_payment, description: `Down Payment: ${desc}${cust}`,
            notes: null, recorded_by: s.created_by,
            reference_id: s.sale_id, editable: false,
          });
        }
      } else {
        unified.push({
          id: s.sale_id, date: s.sale_date, time: s.sale_time || '',
          source: 'SALE', source_label: 'Sale',
          payment_method: normalizeMethod(s.payment_method), direction: 'IN',
          amount: s.total_amount, description: desc + cust,
          notes: null, recorded_by: s.created_by,
          reference_id: s.sale_id, editable: false,
        });
      }
    });

    // ── Expenses ──
    expenses.forEach(e => {
      unified.push({
        id: e.expense_id, date: e.expense_date, time: '',
        source: 'EXPENSE', source_label: 'Expense',
        payment_method: normalizeMethod(e.payment_method), direction: 'OUT',
        amount: e.amount,
        description: e.description + (e.category_name ? ` [${e.category_name}]` : ''),
        notes: e.notes, recorded_by: e.recorded_by,
        reference_id: e.expense_id, editable: false,
      });
    });

    // ── Receivable payments (credit collections from customers) ──
    receivables.forEach(rp => {
      unified.push({
        id: rp.payment_id, date: rp.payment_date, time: '',
        source: 'RECEIVABLE', source_label: 'Credit Collection',
        payment_method: normalizeMethod(rp.payment_method), direction: 'IN',
        amount: rp.amount,
        description: `Collection: ${rp.receivable_desc || 'Payment'}${rp.customer_name ? ' · ' + rp.customer_name : ''}`,
        notes: rp.notes, recorded_by: rp.recorded_by,
        reference_id: rp.payment_id, editable: false,
      });
    });

    // ── Payable payments (supplier payments) ──
    payables.forEach(pp => {
      unified.push({
        id: pp.payment_id, date: pp.payment_date, time: '',
        source: 'PAYABLE', source_label: 'Supplier Payment',
        payment_method: normalizeMethod(pp.payment_method), direction: 'OUT',
        amount: pp.amount,
        description: `Supplier: ${pp.supplier_name || pp.payee_name || pp.payable_desc || 'Payment'}`,
        notes: pp.notes, recorded_by: pp.recorded_by,
        reference_id: pp.payment_id, editable: false,
      });
    });

    // Sort newest first
    unified.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.time || '').localeCompare(a.time || '');
    });

    res.json(unified);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET daily summary for date range (for history view)
router.get('/cash-ledger-summary/:shop_id', async (req, res) => {
  const { shop_id } = req.params;
  const today = await getEffectiveYYYYMMDD(shop_id);
  const { startDate, endDate } = req.query;
  const start = startDate || today;
  const end   = endDate   || today;

  db.all(
    `SELECT
       entry_date,
       COALESCE(SUM(CASE WHEN entry_type='CASH_IN'   THEN amount ELSE 0 END), 0) AS cash_in,
       COALESCE(SUM(CASE WHEN entry_type='CASH_OUT'  THEN amount ELSE 0 END), 0) AS cash_out,
       COALESCE(SUM(CASE WHEN entry_type='GCASH_IN'  THEN amount ELSE 0 END), 0) AS gcash_in,
       COALESCE(SUM(CASE WHEN entry_type='GCASH_OUT' THEN amount ELSE 0 END), 0) AS gcash_out,
       COUNT(*) AS entry_count
     FROM cash_ledger
     WHERE shop_id = ? AND is_void = 0 AND entry_date BETWEEN ? AND ?
     GROUP BY entry_date
     ORDER BY entry_date DESC`,
    [shop_id, start, end],
    (err, rows) => res.json(err ? { error: err.message } : rows || [])
  );
});

// POST new entry
router.post('/cash-ledger', async (req, res) => {
  const { shop_id, entry_type, amount, description, entry_date, entry_time, notes, recorded_by } = req.body;
  if (!shop_id || !entry_type || !amount || !description || !entry_date) {
    return res.status(400).json({ error: 'shop_id, entry_type, amount, description, and entry_date are required' });
  }

  // Only shift if the entry_date is "today"
  const systemToday = new Date().toISOString().split('T')[0];
  let final_entry_date = entry_date;
  if (entry_date === systemToday) {
    final_entry_date = await getEffectiveYYYYMMDD(shop_id);
  }
  if (!VALID_TYPES.includes(entry_type)) {
    return res.status(400).json({ error: `entry_type must be one of: ${VALID_TYPES.join(', ')}` });
  }
  const entry_id = `CL-${uuidv4()}`;
  const time = entry_time || new Date().toTimeString().slice(0, 5);
  db.run(
    `INSERT INTO cash_ledger (entry_id, shop_id, entry_type, amount, description, entry_date, entry_time, notes, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [entry_id, shop_id, entry_type, parseFloat(amount), description.trim(), final_entry_date, time, notes || null, recorded_by || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ entry_id, message: 'Entry recorded' });
    }
  );
});

// PUT edit entry
router.put('/cash-ledger/:entry_id', (req, res) => {
  const { entry_id } = req.params;
  const { entry_type, amount, description, entry_date, entry_time, notes } = req.body;
  if (!VALID_TYPES.includes(entry_type)) {
    return res.status(400).json({ error: 'Invalid entry_type' });
  }
  db.run(
    `UPDATE cash_ledger SET entry_type=?, amount=?, description=?, entry_date=?, entry_time=?, notes=?
     WHERE entry_id=? AND is_void=0`,
    [entry_type, parseFloat(amount), description.trim(), entry_date, entry_time, notes || null, entry_id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Entry not found or already voided' });
      res.json({ entry_id, message: 'Entry updated' });
    }
  );
});

// PATCH void
router.patch('/cash-ledger/:entry_id/void', (req, res) => {
  const { entry_id } = req.params;
  const { void_reason } = req.body;
  db.run(
    `UPDATE cash_ledger SET is_void=1, void_reason=? WHERE entry_id=?`,
    [void_reason || null, entry_id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Entry not found' });
      res.json({ message: 'Entry voided' });
    }
  );
});

module.exports = router;
