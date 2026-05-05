/**
 * routes/search.js
 *
 * Global search endpoint — fans out across all major entities in parallel.
 * Supports three tiers:
 *   Tier 1 — handled client-side (featureIndex.js), never reaches this file
 *   Tier 2 — generic LIKE fan-out across 10 domains
 *   Tier 3 — NLQ pattern detection (overdue, unpaid, this month, amount filters, etc.)
 *
 * GET /api/search/global/:shop_id?q=<term>
 *
 * Role gate: req.user.power >= 60 (admin, owner, general/operations manager, superadmin)
 * Min query length: 2 characters (enforced here and in the frontend)
 */

const express = require('express');
const router  = express.Router();
const { dbAll } = require('../lib/db');

const LIMIT = 5; // max rows per category

// ── NLQ: month name → zero-padded number ────────────────────────────────────
const MONTH_MAP = {
  january: '01', jan: '01',
  february: '02', feb: '02',
  march: '03', mar: '03',
  april: '04', apr: '04',
  may: '05',
  june: '06', jun: '06',
  july: '07', jul: '07',
  august: '08', aug: '08',
  september: '09', sep: '09', sept: '09',
  october: '10', oct: '10',
  november: '11', nov: '11',
  december: '12', dec: '12',
};

// ── NLQ pattern table ────────────────────────────────────────────────────────
const NLQ_PATTERNS = [
  { regex: /\boverdue\b/i,                                     type: 'overdue'       },
  { regex: /\bunpaid\b/i,                                      type: 'unpaid'        },
  { regex: /\bpaid\b/i,                                        type: 'paid'          },
  { regex: /\btoday\b/i,                                       type: 'today'         },
  { regex: /\bthis\s+week\b/i,                                 type: 'this_week'     },
  { regex: /\bthis\s+month\b/i,                                type: 'this_month'    },
  { regex: /\blast\s+month\b/i,                                type: 'last_month'    },
  { regex: /\bover\s+[₱]?([\d,]+)/i,    capture: 1,           type: 'amount_over'   },
  { regex: /\babove\s+[₱]?([\d,]+)/i,   capture: 1,           type: 'amount_over'   },
  { regex: /\bbelow\s+[₱]?([\d,]+)/i,   capture: 1,           type: 'amount_below'  },
  { regex: /\bunder\s+[₱]?([\d,]+)/i,   capture: 1,           type: 'amount_below'  },
  {
    regex: /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\b/i,
    capture: 1,
    type: 'month_name',
  },
];

function detectNLQIntent(q) {
  for (const pattern of NLQ_PATTERNS) {
    const match = q.match(pattern.regex);
    if (match) {
      return {
        type: pattern.type,
        value: pattern.capture ? match[pattern.capture] : null,
      };
    }
  }
  return null;
}

// ── Tier-2 sub-query helpers ─────────────────────────────────────────────────

async function queryItems(q, shopId) {
  const like = `%${q}%`;
  return dbAll(
    `SELECT im.item_id AS id,
            im.item_name AS label,
            'SKU: ' || im.sku || ' · Stock: ' || COALESCE(CAST(cs.current_quantity AS INTEGER), 0) AS detail,
            'Products' AS category,
            'inventory' AS page
     FROM item_master im
     LEFT JOIN current_stock cs ON im.item_id = cs.item_id AND cs.shop_id = ?
     WHERE im.is_active = 1
       AND (im.sku LIKE ? OR im.item_name LIKE ? OR im.brand LIKE ? OR im.size LIKE ? OR im.design LIKE ?)
     ORDER BY im.item_name
     LIMIT ?`,
    [shopId, like, like, like, like, like, LIMIT],
  );
}

async function queryCustomers(q, shopId) {
  const like = `%${q}%`;
  return dbAll(
    `SELECT customer_id AS id,
            customer_name AS label,
            COALESCE(company, contact_number, customer_code, '') AS detail,
            'Customers' AS category,
            'customers' AS page
     FROM customer_master
     WHERE shop_id = ?
       AND (customer_name LIKE ? OR customer_code LIKE ? OR contact_number LIKE ?
            OR company LIKE ? OR tin_number LIKE ?)
     ORDER BY customer_name
     LIMIT ?`,
    [shopId, like, like, like, like, like, LIMIT],
  );
}

async function queryStaff(q) {
  // staff_master has no shop_id — staff is system-wide
  const like = `%${q}%`;
  return dbAll(
    `SELECT staff_id AS id,
            full_name AS label,
            COALESCE(role, '') || CASE WHEN email IS NOT NULL THEN ' · ' || email ELSE '' END AS detail,
            'Staff' AS category,
            'staff-management' AS page
     FROM staff_master
     WHERE is_active = 1
       AND (full_name LIKE ? OR email LIKE ? OR staff_code LIKE ? OR role LIKE ?)
     LIMIT ?`,
    [like, like, like, like, LIMIT],
  );
}

async function querySales(q, shopId) {
  const like = `%${q}%`;
  return dbAll(
    `SELECT DISTINCT sh.sale_id AS id,
            COALESCE(sh.invoice_number, sh.sale_id) AS label,
            COALESCE(cm.customer_name, 'Walk-in') || ' · ₱' || printf('%.2f', sh.total_amount) AS detail,
            'Sales' AS category,
            'sales' AS page
     FROM sale_header sh
     LEFT JOIN customer_master cm ON sh.customer_id = cm.customer_id
     LEFT JOIN sale_items si      ON sh.sale_id     = si.sale_id
     WHERE sh.shop_id = ? AND sh.is_void = 0
       AND (sh.invoice_number LIKE ? OR cm.customer_name LIKE ? OR si.item_name LIKE ?)
     ORDER BY sh.sale_datetime DESC
     LIMIT ?`,
    [shopId, like, like, like, LIMIT],
  );
}

async function queryOrders(q, shopId) {
  const like = `%${q}%`;
  return dbAll(
    `SELECT DISTINCT o.order_id AS id,
            o.order_id AS label,
            o.status || CASE WHEN o.order_notes IS NOT NULL THEN ' · ' || SUBSTR(o.order_notes, 1, 50) ELSE '' END AS detail,
            'Orders' AS category,
            'orders' AS page
     FROM orders o
     LEFT JOIN order_items oi ON o.order_id = oi.order_id
     LEFT JOIN item_master im  ON oi.item_id  = im.item_id
     LEFT JOIN supplier_master sm ON oi.supplier_id = sm.supplier_id
     WHERE o.shop_id = ?
       AND (o.order_id LIKE ? OR o.order_notes LIKE ? OR o.delivery_receipt LIKE ?
            OR im.item_name LIKE ? OR im.sku LIKE ? OR sm.supplier_name LIKE ?)
     ORDER BY o.created_at DESC
     LIMIT ?`,
    [shopId, like, like, like, like, like, like, LIMIT],
  );
}

async function queryExpenses(q, shopId) {
  const like = `%${q}%`;
  return dbAll(
    `SELECT e.expense_id AS id,
            e.description AS label,
            COALESCE(ec.name, 'Uncategorized') || ' · ₱' || printf('%.2f', e.amount) AS detail,
            'Expenses' AS category,
            'expenses' AS page
     FROM expenses e
     LEFT JOIN expense_categories ec ON e.category_id = ec.category_id
     WHERE e.shop_id = ? AND e.is_void = 0
       AND (e.description LIKE ? OR e.reference_no LIKE ? OR ec.name LIKE ? OR e.notes LIKE ?)
     ORDER BY e.created_at DESC
     LIMIT ?`,
    [shopId, like, like, like, like, LIMIT],
  );
}

async function queryReceivables(q, shopId) {
  const like = `%${q}%`;
  return dbAll(
    `SELECT ar.receivable_id AS id,
            COALESCE(cm.customer_name, 'Unknown') AS label,
            COALESCE(ar.description, '') || ' · ₱' || printf('%.2f', ar.balance_amount) AS detail,
            'Receivables' AS category,
            'receivables' AS page
     FROM accounts_receivable ar
     LEFT JOIN customer_master cm ON ar.customer_id = cm.customer_id
     WHERE ar.shop_id = ?
       AND (cm.customer_name LIKE ? OR ar.description LIKE ?)
     ORDER BY ar.created_at DESC
     LIMIT ?`,
    [shopId, like, like, LIMIT],
  );
}

async function queryPayables(q, shopId) {
  const like = `%${q}%`;
  return dbAll(
    `SELECT ap.payable_id AS id,
            COALESCE(sm.supplier_name, ap.payee_name, 'Unknown') AS label,
            COALESCE(ap.description, '') || ' · ₱' || printf('%.2f', ap.balance_amount) AS detail,
            'Payables' AS category,
            'payables' AS page
     FROM accounts_payable ap
     LEFT JOIN supplier_master sm ON ap.supplier_id = sm.supplier_id
     WHERE ap.shop_id = ?
       AND (sm.supplier_name LIKE ? OR ap.payee_name LIKE ? OR ap.description LIKE ? OR ap.reference_id LIKE ?)
     ORDER BY ap.created_at DESC
     LIMIT ?`,
    [shopId, like, like, like, like, LIMIT],
  );
}

async function queryRecap(q, shopId) {
  const like = `%${q}%`;
  return dbAll(
    `SELECT rj.recap_job_id AS id,
            COALESCE(cm.customer_name, 'Shop-owned') AS label,
            COALESCE(rj.casing_description, rj.current_status) ||
              CASE WHEN rj.dot_number IS NOT NULL THEN ' · DOT: ' || rj.dot_number ELSE '' END AS detail,
            'Recap Jobs' AS category,
            'recap' AS page
     FROM recap_job_master rj
     LEFT JOIN customer_master cm ON rj.customer_id = cm.customer_id
     WHERE rj.shop_id = ?
       AND (cm.customer_name LIKE ? OR rj.casing_description LIKE ? OR rj.dot_number LIKE ?)
     ORDER BY rj.created_at DESC
     LIMIT ?`,
    [shopId, like, like, like, LIMIT],
  );
}

async function querySettings(q) {
  // These tables are system-wide (no shop_id filter needed for settings)
  const like = `%${q}%`;
  const [serviceRows, supplierRows] = await Promise.all([
    dbAll(
      `SELECT service_id AS id,
              service_name AS label,
              'Service · ₱' || printf('%.2f', base_price) AS detail,
              'Services' AS category,
              'services' AS page
       FROM services_master
       WHERE is_active = 1 AND (service_name LIKE ? OR service_code LIKE ?)
       LIMIT 3`,
      [like, like],
    ),
    dbAll(
      `SELECT supplier_id AS id,
              supplier_name AS label,
              COALESCE(contact_person, contact_number, '') AS detail,
              'Suppliers' AS category,
              'suppliers' AS page
       FROM supplier_master
       WHERE active_status = 1
         AND (supplier_name LIKE ? OR contact_person LIKE ? OR supplier_code LIKE ?)
       LIMIT 3`,
      [like, like, like],
    ),
  ]);
  return [...serviceRows, ...supplierRows];
}

// ── Tier-3 NLQ targeted queries ──────────────────────────────────────────────

async function queryNLQ(intent, shopId) {
  const results = [];

  if (intent.type === 'overdue') {
    const [payRows, rcvRows] = await Promise.all([
      dbAll(
        `SELECT ap.payable_id AS id,
                COALESCE(sm.supplier_name, ap.payee_name, 'Unknown') AS label,
                'OVERDUE · ₱' || printf('%.2f', ap.balance_amount) || ' — due ' || COALESCE(ap.due_date, 'N/A') AS detail,
                'Payables' AS category, 'payables' AS page
         FROM accounts_payable ap
         LEFT JOIN supplier_master sm ON ap.supplier_id = sm.supplier_id
         WHERE ap.shop_id = ? AND ap.status != 'PAID'
           AND ap.due_date IS NOT NULL AND ap.due_date < date('now')
         ORDER BY ap.due_date ASC LIMIT ?`,
        [shopId, LIMIT],
      ),
      dbAll(
        `SELECT ar.receivable_id AS id,
                COALESCE(cm.customer_name, 'Unknown') AS label,
                'OVERDUE · ₱' || printf('%.2f', ar.balance_amount) || ' — due ' || COALESCE(ar.due_date, 'N/A') AS detail,
                'Receivables' AS category, 'receivables' AS page
         FROM accounts_receivable ar
         LEFT JOIN customer_master cm ON ar.customer_id = cm.customer_id
         WHERE ar.shop_id = ? AND ar.status = 'OPEN'
           AND ar.due_date IS NOT NULL AND ar.due_date < date('now')
         ORDER BY ar.due_date ASC LIMIT ?`,
        [shopId, LIMIT],
      ),
    ]);
    results.push(...payRows, ...rcvRows);
  }

  if (intent.type === 'unpaid') {
    const rows = await dbAll(
      `SELECT ar.receivable_id AS id,
              COALESCE(cm.customer_name, 'Unknown') AS label,
              'OPEN · ₱' || printf('%.2f', ar.balance_amount) AS detail,
              'Receivables' AS category, 'receivables' AS page
       FROM accounts_receivable ar
       LEFT JOIN customer_master cm ON ar.customer_id = cm.customer_id
       WHERE ar.shop_id = ? AND ar.status = 'OPEN'
       ORDER BY ar.created_at DESC LIMIT ?`,
      [shopId, LIMIT],
    );
    results.push(...rows);
  }

  if (intent.type === 'paid') {
    const rows = await dbAll(
      `SELECT ar.receivable_id AS id,
              COALESCE(cm.customer_name, 'Unknown') AS label,
              'PAID · ₱' || printf('%.2f', ar.original_amount) AS detail,
              'Receivables' AS category, 'receivables' AS page
       FROM accounts_receivable ar
       LEFT JOIN customer_master cm ON ar.customer_id = cm.customer_id
       WHERE ar.shop_id = ? AND ar.status = 'PAID'
       ORDER BY ar.closed_at DESC LIMIT ?`,
      [shopId, LIMIT],
    );
    results.push(...rows);
  }

  if (intent.type === 'today') {
    const [saleRows, expRows] = await Promise.all([
      dbAll(
        `SELECT sh.sale_id AS id,
                COALESCE(sh.invoice_number, sh.sale_id) AS label,
                'TODAY · ₱' || printf('%.2f', sh.total_amount) AS detail,
                'Sales' AS category, 'sales' AS page
         FROM sale_header sh
         WHERE sh.shop_id = ? AND sh.is_void = 0
           AND date(sh.sale_datetime) = date('now')
         ORDER BY sh.sale_datetime DESC LIMIT ?`,
        [shopId, LIMIT],
      ),
      dbAll(
        `SELECT expense_id AS id, description AS label,
                'TODAY · ₱' || printf('%.2f', amount) AS detail,
                'Expenses' AS category, 'expenses' AS page
         FROM expenses
         WHERE shop_id = ? AND is_void = 0 AND date(created_at) = date('now')
         ORDER BY created_at DESC LIMIT ?`,
        [shopId, LIMIT],
      ),
    ]);
    results.push(...saleRows, ...expRows);
  }

  if (intent.type === 'this_week') {
    const rows = await dbAll(
      `SELECT sh.sale_id AS id,
              COALESCE(sh.invoice_number, sh.sale_id) AS label,
              'THIS WEEK · ₱' || printf('%.2f', sh.total_amount) AS detail,
              'Sales' AS category, 'sales' AS page
       FROM sale_header sh
       WHERE sh.shop_id = ? AND sh.is_void = 0
         AND sh.sale_datetime >= datetime('now', '-7 days')
       ORDER BY sh.sale_datetime DESC LIMIT ?`,
      [shopId, LIMIT],
    );
    results.push(...rows);
  }

  if (intent.type === 'this_month') {
    const [saleRows, expRows] = await Promise.all([
      dbAll(
        `SELECT sh.sale_id AS id,
                COALESCE(sh.invoice_number, sh.sale_id) AS label,
                'THIS MONTH · ₱' || printf('%.2f', sh.total_amount) AS detail,
                'Sales' AS category, 'sales' AS page
         FROM sale_header sh
         WHERE sh.shop_id = ? AND sh.is_void = 0
           AND strftime('%Y-%m', sh.sale_datetime) = strftime('%Y-%m', 'now')
         ORDER BY sh.sale_datetime DESC LIMIT ?`,
        [shopId, LIMIT],
      ),
      dbAll(
        `SELECT expense_id AS id, description AS label,
                'THIS MONTH · ₱' || printf('%.2f', amount) AS detail,
                'Expenses' AS category, 'expenses' AS page
         FROM expenses
         WHERE shop_id = ? AND is_void = 0
           AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
         ORDER BY created_at DESC LIMIT ?`,
        [shopId, LIMIT],
      ),
    ]);
    results.push(...saleRows, ...expRows);
  }

  if (intent.type === 'last_month') {
    const [saleRows, expRows] = await Promise.all([
      dbAll(
        `SELECT sh.sale_id AS id,
                COALESCE(sh.invoice_number, sh.sale_id) AS label,
                'LAST MONTH · ₱' || printf('%.2f', sh.total_amount) AS detail,
                'Sales' AS category, 'sales' AS page
         FROM sale_header sh
         WHERE sh.shop_id = ? AND sh.is_void = 0
           AND strftime('%Y-%m', sh.sale_datetime) = strftime('%Y-%m', date('now', '-1 month'))
         ORDER BY sh.sale_datetime DESC LIMIT ?`,
        [shopId, LIMIT],
      ),
      dbAll(
        `SELECT expense_id AS id, description AS label,
                'LAST MONTH · ₱' || printf('%.2f', amount) AS detail,
                'Expenses' AS category, 'expenses' AS page
         FROM expenses
         WHERE shop_id = ? AND is_void = 0
           AND strftime('%Y-%m', created_at) = strftime('%Y-%m', date('now', '-1 month'))
         ORDER BY created_at DESC LIMIT ?`,
        [shopId, LIMIT],
      ),
    ]);
    results.push(...saleRows, ...expRows);
  }

  if (intent.type === 'month_name' && intent.value) {
    const mm = MONTH_MAP[intent.value.toLowerCase()];
    if (mm) {
      const [saleRows, expRows] = await Promise.all([
        dbAll(
          `SELECT sh.sale_id AS id,
                  COALESCE(sh.invoice_number, sh.sale_id) AS label,
                  strftime('%Y-%m', sh.sale_datetime) || ' · ₱' || printf('%.2f', sh.total_amount) AS detail,
                  'Sales' AS category, 'sales' AS page
           FROM sale_header sh
           WHERE sh.shop_id = ? AND sh.is_void = 0
             AND strftime('%m', sh.sale_datetime) = ?
           ORDER BY sh.sale_datetime DESC LIMIT ?`,
          [shopId, mm, LIMIT],
        ),
        dbAll(
          `SELECT expense_id AS id, description AS label,
                  strftime('%Y-%m', expense_date) || ' · ₱' || printf('%.2f', amount) AS detail,
                  'Expenses' AS category, 'expenses' AS page
           FROM expenses
           WHERE shop_id = ? AND is_void = 0
             AND strftime('%m', expense_date) = ?
           ORDER BY expense_date DESC LIMIT ?`,
          [shopId, mm, LIMIT],
        ),
      ]);
      results.push(...saleRows, ...expRows);
    }
  }

  if (intent.type === 'amount_over' && intent.value) {
    const amount = parseFloat(String(intent.value).replace(/,/g, ''));
    if (!isNaN(amount) && amount >= 0) {
      const [expRows, saleRows] = await Promise.all([
        dbAll(
          `SELECT expense_id AS id, description AS label,
                  '₱' || printf('%.2f', amount) || ' (over ₱' || ? || ')' AS detail,
                  'Expenses' AS category, 'expenses' AS page
           FROM expenses
           WHERE shop_id = ? AND is_void = 0 AND amount > ?
           ORDER BY amount DESC LIMIT ?`,
          [amount, shopId, amount, LIMIT],
        ),
        dbAll(
          `SELECT sh.sale_id AS id,
                  COALESCE(sh.invoice_number, sh.sale_id) AS label,
                  '₱' || printf('%.2f', sh.total_amount) || ' (over ₱' || ? || ')' AS detail,
                  'Sales' AS category, 'sales' AS page
           FROM sale_header sh
           WHERE sh.shop_id = ? AND sh.is_void = 0 AND sh.total_amount > ?
           ORDER BY sh.total_amount DESC LIMIT ?`,
          [amount, shopId, amount, LIMIT],
        ),
      ]);
      results.push(...expRows, ...saleRows);
    }
  }

  if (intent.type === 'amount_below' && intent.value) {
    const amount = parseFloat(String(intent.value).replace(/,/g, ''));
    if (!isNaN(amount) && amount > 0) {
      const rows = await dbAll(
        `SELECT expense_id AS id, description AS label,
                '₱' || printf('%.2f', amount) || ' (under ₱' || ? || ')' AS detail,
                'Expenses' AS category, 'expenses' AS page
         FROM expenses
         WHERE shop_id = ? AND is_void = 0 AND amount < ? AND amount > 0
         ORDER BY amount DESC LIMIT ?`,
        [amount, shopId, amount, LIMIT],
      );
      results.push(...rows);
    }
  }

  return results;
}

// ── Main route ───────────────────────────────────────────────────────────────

router.get('/search/global/:shop_id', async (req, res) => {
  const { shop_id } = req.params;
  const q = String(req.query.q || '').trim();

  // Role gate — power 60+ (admin, owner, general/operations manager, superadmin)
  if ((req.user.power || 0) < 60) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!shop_id) {
    return res.status(400).json({ error: 'shop_id is required' });
  }

  // Minimum 2 chars — defend against accidental single-char queries
  if (q.length < 2) {
    return res.json({ results: {}, nlq: false });
  }

  try {
    // ── Tier 3: check for NLQ intent first ──────────────────────────────────
    const intent = detectNLQIntent(q);
    if (intent) {
      const nlqRows = await queryNLQ(intent, shop_id);
      const grouped = {};
      for (const row of nlqRows) {
        if (!grouped[row.category]) grouped[row.category] = [];
        grouped[row.category].push(row);
      }
      return res.json({ results: grouped, nlq: true, intent: intent.type });
    }

    // ── Tier 2: generic LIKE fan-out ─────────────────────────────────────────
    const [items, customers, staff, sales, orders, expenses, receivables, payables, recap, settings] =
      await Promise.all([
        queryItems(q, shop_id),
        queryCustomers(q, shop_id),
        queryStaff(q),
        querySales(q, shop_id),
        queryOrders(q, shop_id),
        queryExpenses(q, shop_id),
        queryReceivables(q, shop_id),
        queryPayables(q, shop_id),
        queryRecap(q, shop_id),
        querySettings(q),
      ]);

    const results = {};
    if (items.length)       results['Products']    = items;
    if (customers.length)   results['Customers']   = customers;
    if (staff.length)       results['Staff']       = staff;
    if (sales.length)       results['Sales']       = sales;
    if (orders.length)      results['Orders']      = orders;
    if (expenses.length)    results['Expenses']    = expenses;
    if (receivables.length) results['Receivables'] = receivables;
    if (payables.length)    results['Payables']    = payables;
    if (recap.length)       results['Recap Jobs']  = recap;
    if (settings.length)    results['Settings']    = settings;

    return res.json({ results, nlq: false });

  } catch (err) {
    console.error('[search/global] error:', err.message);
    return res.status(500).json({ error: 'Search failed: ' + err.message });
  }
});

module.exports = router;
