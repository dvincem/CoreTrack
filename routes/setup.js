/**
 * routes/setup.js — CoreTrack First-Run Setup
 * ============================================
 * Public endpoints (no auth required) for the initial shop setup wizard.
 * These routes MUST be registered in server.js BEFORE the authMiddleware.
 */

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { db }  = require('../Database');

function dbGet(sql, p = []) {
  return new Promise((res, rej) => db.get(sql, p, (e, row) => e ? rej(e) : res(row)));
}
function dbRun(sql, p = []) {
  return new Promise((res, rej) => db.run(sql, p, (e) => e ? rej(e) : res()));
}
function dbAll(sql, p = []) {
  return new Promise((res, rej) => db.all(sql, p, (e, rows) => e ? rej(e) : res(rows || [])));
}

// ── GET /api/system/status ────────────────────────────────────────────────────
// Public. Called by the frontend on every app mount to determine if the
// system has been initialized (i.e., at least one shop exists).
router.get('/system/status', async (req, res) => {
  try {
    const row = await dbGet('SELECT COUNT(*) as cnt FROM shop_master');
    const staffRow = await dbGet('SELECT COUNT(*) as cnt FROM staff_master');
    res.json({
      initialized: (row?.cnt || 0) > 0 && (staffRow?.cnt || 0) > 0,
      shop_count: row?.cnt || 0,
      staff_count: staffRow?.cnt || 0,
    });
  } catch (err) {
    // If the table doesn't exist yet, db is not ready — report as uninitialized
    res.json({ initialized: false, shop_count: 0, staff_count: 0 });
  }
});

// ── POST /api/system/setup ────────────────────────────────────────────────────
// Public. One-shot initialization call from the Setup Wizard.
// Creates: shop_master, staff_master, user_credentials, system role + page access.
router.post('/system/setup', async (req, res) => {
  const { shop_name, address, contact_number, full_name, username, pin } = req.body;

  // Validation
  if (!shop_name?.trim())   return res.status(400).json({ error: 'Shop name is required.' });
  if (!full_name?.trim())   return res.status(400).json({ error: 'Owner full name is required.' });
  if (!username?.trim())    return res.status(400).json({ error: 'Username is required.' });
  if (!pin || !/^\d{4,8}$/.test(pin)) {
    return res.status(400).json({ error: 'PIN must be 4–8 digits.' });
  }
  if (!/^[a-z0-9._]{3,30}$/.test(username)) {
    return res.status(400).json({ error: 'Username: 3–30 chars, lowercase letters, numbers, dots, or underscores.' });
  }

  try {
    // Guard: prevent re-initialization if shop already exists
    const existing = await dbGet('SELECT COUNT(*) as cnt FROM shop_master');
    if ((existing?.cnt || 0) > 0) {
      return res.status(409).json({ error: 'System is already initialized.' });
    }

    // ── 1. Create Shop ──────────────────────────────────────────────────────
    const shop_id   = `SHOP-${uuidv4().split('-')[0].toUpperCase()}`;
    const shop_code = 'MAIN';
    await dbRun(
      `INSERT INTO shop_master (shop_id, shop_code, shop_name, address, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [shop_id, shop_code, shop_name.trim(), (address || '').trim()]
    );

    // ── 2. Create Owner Staff Record ────────────────────────────────────────
    const staff_id   = `STAFF-${uuidv4().split('-')[0].toUpperCase()}`;
    const staff_code = `OWN-${Date.now().toString().slice(-4)}`;
    await dbRun(
      `INSERT INTO staff_master (staff_id, staff_code, full_name, role, is_active, work_status)
       VALUES (?, ?, ?, 'Owner', 1, 'ACTIVE')`,
      [staff_id, staff_code, full_name.trim()]
    );

    // ── 3. Create User Credentials ──────────────────────────────────────────
    const credential_id = `CRED-${uuidv4().split('-')[0].toUpperCase()}`;
    const pin_hash = await bcrypt.hash(String(pin), 12);
    await dbRun(
      `INSERT INTO user_credentials (credential_id, staff_id, username, pin_hash, must_change_pin, is_active)
       VALUES (?, ?, ?, ?, 0, 1)`,
      [credential_id, staff_id, username.trim(), pin_hash]
    );

    // ── 4. Grant Owner System Role ──────────────────────────────────────────
    await dbRun(
      `INSERT INTO user_system_roles (credential_id, role, granted_by)
       VALUES (?, 'owner', 'setup_wizard')`,
      [credential_id]
    );

    // ── 5. Grant Full Page Access (all pages) ───────────────────────────────
    const ALL_PAGES = [
      'dashboard', 'pos', 'orders', 'inventory', 'products', 'purchases',
      'recap', 'returns', 'sales', 'services', 'services-summary', 'customers',
      'suppliers', 'staff', 'attendance', 'payroll', 'profits', 'expenses',
      'cashledger', 'receivables', 'payables', 'reports',
    ];
    for (const page_id of ALL_PAGES) {
      await dbRun(
        `INSERT OR IGNORE INTO user_page_access (credential_id, page_id) VALUES (?, ?)`,
        [credential_id, page_id]
      );
    }

    // ── 6. Seed default expense categories ─────────────────────────────────
    const DEFAULT_CATEGORIES = [
      { name: 'Utilities',  color: '#3b82f6' },
      { name: 'Salaries',   color: '#10b981' },
      { name: 'Supplies',   color: '#f59e0b' },
      { name: 'Rent',       color: '#8b5cf6' },
      { name: 'Maintenance',color: '#ef4444' },
      { name: 'Other',      color: '#6b7280' },
    ];
    for (const cat of DEFAULT_CATEGORIES) {
      const cat_id = `CAT-${uuidv4().split('-')[0].toUpperCase()}`;
      await dbRun(
        `INSERT OR IGNORE INTO expense_categories (category_id, shop_id, name, color, is_active)
         VALUES (?, ?, ?, ?, 1)`,
        [cat_id, shop_id, cat.name, cat.color]
      );
    }

    res.json({
      success: true,
      message: `CoreTrack initialized! Welcome, ${full_name.trim()}.`,
      shop_id,
      staff_id,
      credential_id,
      username: username.trim(),
    });

  } catch (err) {
    console.error('[Setup] Error:', err);
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'That username is already taken. Please choose another.' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
