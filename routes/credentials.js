const express = require('express')
const router  = express.Router()
const bcrypt  = require('bcrypt')
const { db }  = require('../Database')

const SUPERADMIN_USERNAME = process.env.TH_SUPERADMIN_USERNAME || "superadmin";
const SUPERADMIN_PASSWORD = process.env.TH_SUPERADMIN_PASSWORD || "th-super-2025!";

// GET /api/superadmin-info — owner-level only (defined early, function body uses hoisted helpers)
router.get('/superadmin-info', async (req, res) => {
  const callerPower = await getCallerPower(req);
  if (callerPower < 80 && !req.user?.is_superadmin) return res.status(403).json({ error: 'Forbidden' });
  res.json({ username: SUPERADMIN_USERNAME, password: SUPERADMIN_PASSWORD });
});

const SALT_ROUNDS = 10

function dbGet(sql, p = []) { return new Promise((r, j) => db.get(sql, p, (e, row) => e ? j(e) : r(row))) }
function dbAll(sql, p = []) { return new Promise((r, j) => db.all(sql, p, (e, rows) => e ? j(e) : r(rows || []))) }
function dbRun(sql, p = []) { return new Promise((r, j) => db.run(sql, p, function(e) { e ? j(e) : r(this) })) }

function genId() { return 'CRED-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase() }
function genPin() { return String(Math.floor(100000 + Math.random() * 900000)) }

// Default page access per role
const ROLE_DEFAULT_PAGES = {
  'owner':             ['dashboard','pos','orders','inventory','products','purchases','recap','returns','sales','services','services-summary','customers','suppliers','staff','attendance','payroll','profits','expenses','cashledger','receivables','payables','financial-health','sales-projection','reports','credentials','dryrun'],
  'general manager':   ['dashboard','pos','orders','inventory','products','purchases','recap','returns','sales','services','services-summary','customers','suppliers','staff','attendance','payroll','profits','expenses','cashledger','receivables','payables','financial-health','sales-projection','reports'],
  'operations manager':['dashboard','pos','orders','inventory','products','purchases','recap','returns','sales','services','services-summary','customers','suppliers','staff','attendance','payroll','profits','expenses','cashledger','receivables','payables','financial-health','sales-projection','reports'],
  'sales':             ['dashboard','pos','orders','inventory','recap','returns','sales','services-summary','customers'],
  'tireman':           ['services-summary'],
  'technician':        ['services-summary'],
  'mechanic':          ['services-summary'],
  'vulcanizer':        ['services-summary'],
  'helper':            ['services-summary'],
  'service staff':     ['services-summary'],
}

async function setDefaultPages(credentialId, role) {
  const pages = ROLE_DEFAULT_PAGES[(role || '').toLowerCase()] || ['dashboard']
  for (const page_id of pages) {
    await dbRun('INSERT OR IGNORE INTO user_page_access (credential_id, page_id) VALUES (?, ?)', [credentialId, page_id])
  }
}

// Build username from full name: "Maria Santos" → "maria.santos", handle duplicates
async function buildUsername(fullName) {
  const parts = fullName.trim().toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean)
  const base = parts.length >= 2 ? parts[0] + '.' + parts[parts.length - 1] : parts[0] || 'user'
  let username = base
  let i = 1
  while (true) {
    const existing = await dbGet('SELECT 1 FROM user_credentials WHERE username = ?', [username])
    if (!existing) break
    username = base + i++
  }
  return username
}

// GET /api/credentials — list all staff with credential status + page access
router.get('/credentials', async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT sm.staff_id, sm.full_name, sm.role, sm.staff_code,
             uc.credential_id, uc.username, uc.must_change_pin, uc.is_active,
             uc.created_at AS cred_created_at, uc.last_changed_at
      FROM staff_master sm
      LEFT JOIN user_credentials uc ON sm.staff_id = uc.staff_id
      WHERE sm.is_active = 1
      ORDER BY sm.full_name ASC
    `)
    // Attach page list and system roles per credential
    for (const row of rows) {
      if (row.credential_id) {
        const pages = await dbAll('SELECT page_id FROM user_page_access WHERE credential_id = ?', [row.credential_id])
        row.allowed_pages = pages.map(p => p.page_id)
        const sysRoles = await dbAll('SELECT role FROM user_system_roles WHERE credential_id = ?', [row.credential_id])
        row.system_roles = sysRoles.map(r => r.role)
      } else {
        row.allowed_pages = []
        row.system_roles = []
      }
    }
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/credentials — create credentials for a staff member
router.post('/credentials', async (req, res) => {
  const { staff_id } = req.body
  if (!staff_id) return res.status(400).json({ error: 'staff_id required' })
  try {
    const staff = await dbGet('SELECT * FROM staff_master WHERE staff_id = ?', [staff_id])
    if (!staff) return res.status(404).json({ error: 'Staff not found' })

    const existing = await dbGet('SELECT credential_id FROM user_credentials WHERE staff_id = ?', [staff_id])
    if (existing) return res.status(409).json({ error: 'Credentials already exist for this staff member' })

    const username = await buildUsername(staff.full_name)
    const pin      = genPin()
    const pin_hash = await bcrypt.hash(pin, SALT_ROUNDS)
    const id       = genId()

    await dbRun(
      `INSERT INTO user_credentials (credential_id, staff_id, username, pin_hash, must_change_pin, is_active, created_at)
       VALUES (?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP)`,
      [id, staff_id, username, pin_hash]
    )
    await setDefaultPages(id, staff.role)

    res.json({ credential_id: id, username, pin, must_change_pin: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/credentials/:credential_id/pages — get page access for a credential
router.get('/credentials/:credential_id/pages', async (req, res) => {
  try {
    const pages = await dbAll('SELECT page_id FROM user_page_access WHERE credential_id = ?', [req.params.credential_id])
    res.json(pages.map(p => p.page_id))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/credentials/:credential_id/pages — replace page access for a credential
router.put('/credentials/:credential_id/pages', async (req, res) => {
  const { pages } = req.body // array of page_id strings
  if (!Array.isArray(pages)) return res.status(400).json({ error: 'pages must be an array' })
  const { credential_id } = req.params
  try {
    await dbRun('DELETE FROM user_page_access WHERE credential_id = ?', [credential_id])
    for (const page_id of pages) {
      await dbRun('INSERT OR IGNORE INTO user_page_access (credential_id, page_id) VALUES (?, ?)', [credential_id, page_id])
    }
    res.json({ ok: true, pages })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/credentials/:credential_id/reset — reset PIN (admin)
router.post('/credentials/:credential_id/reset', async (req, res) => {
  const { credential_id } = req.params
  try {
    const cred = await dbGet('SELECT * FROM user_credentials WHERE credential_id = ?', [credential_id])
    if (!cred) return res.status(404).json({ error: 'Credentials not found' })

    const pin      = genPin()
    const pin_hash = await bcrypt.hash(pin, SALT_ROUNDS)

    await dbRun(
      `UPDATE user_credentials SET pin_hash = ?, must_change_pin = 1, last_changed_at = CURRENT_TIMESTAMP WHERE credential_id = ?`,
      [pin_hash, credential_id]
    )
    res.json({ pin })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/credentials/:credential_id/toggle — enable/disable
router.put('/credentials/:credential_id/toggle', async (req, res) => {
  const { credential_id } = req.params
  try {
    const cred = await dbGet('SELECT * FROM user_credentials WHERE credential_id = ?', [credential_id])
    if (!cred) return res.status(404).json({ error: 'Credentials not found' })
    const next = cred.is_active ? 0 : 1
    await dbRun('UPDATE user_credentials SET is_active = ? WHERE credential_id = ?', [next, credential_id])
    res.json({ is_active: next })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/credentials/:credential_id — remove credentials
router.delete('/credentials/:credential_id', async (req, res) => {
  const { credential_id } = req.params
  try {
    await dbRun('DELETE FROM user_credentials WHERE credential_id = ?', [credential_id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── System role management ─────────────────────────────────────────────────

const POWER_MAP = { owner: 80, admin: 60 }
function computePower(systemRoles) {
  return Math.max(0, ...(systemRoles || []).map(r => POWER_MAP[r] || 0))
}
async function getCallerPower(req) {
  if (req.user?.is_superadmin) return 100
  if (req.user?.is_admin) return 60  // hardcoded admin account
  if (req.user?.credential_id) {
    const rows = await dbAll('SELECT role FROM user_system_roles WHERE credential_id = ?', [req.user.credential_id])
    return computePower(rows.map(r => r.role))
  }
  return req.user?.power || 0
}
async function getTargetPower(credential_id) {
  const rows = await dbAll('SELECT role FROM user_system_roles WHERE credential_id = ?', [credential_id])
  return computePower(rows.map(r => r.role))
}

// GET /api/credentials/:credential_id/system-roles
router.get('/credentials/:credential_id/system-roles', async (req, res) => {
  try {
    const rows = await dbAll('SELECT role FROM user_system_roles WHERE credential_id = ?', [req.params.credential_id])
    res.json(rows.map(r => r.role))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/credentials/:credential_id/system-roles — replace system roles (power-gated)
router.put('/credentials/:credential_id/system-roles', async (req, res) => {
  const { roles } = req.body  // array of role strings e.g. ['admin']
  if (!Array.isArray(roles)) return res.status(400).json({ error: 'roles must be an array' })

  const callerPower = await getCallerPower(req)
  const targetPower = await getTargetPower(req.params.credential_id)

  // Cannot manage someone at same or higher power level
  if (targetPower >= callerPower && targetPower > 0) {
    return res.status(403).json({ error: 'Cannot modify a user with equal or higher access level' })
  }
  // Cannot grant a role at or above your own power
  const GRANTABLE = Object.entries(POWER_MAP)
    .filter(([, p]) => p < callerPower)
    .map(([r]) => r)
  const invalid = roles.filter(r => !GRANTABLE.includes(r))
  if (invalid.length) {
    return res.status(403).json({ error: `Cannot grant role(s): ${invalid.join(', ')}` })
  }

  try {
    await dbRun('DELETE FROM user_system_roles WHERE credential_id = ?', [req.params.credential_id])
    for (const role of roles) {
      await dbRun(
        'INSERT OR IGNORE INTO user_system_roles (credential_id, role, granted_by) VALUES (?, ?, ?)',
        [req.params.credential_id, role, req.user?.username || 'unknown']
      )
    }
    // If owner role granted, ensure credentials page access is added
    if (roles.includes('owner')) {
      await dbRun('INSERT OR IGNORE INTO user_page_access (credential_id, page_id) VALUES (?, ?)',
        [req.params.credential_id, 'credentials'])
    } else {
      // Strip credentials page if owner role removed
      await dbRun('DELETE FROM user_page_access WHERE credential_id = ? AND page_id = ?',
        [req.params.credential_id, 'credentials'])
    }
    res.json({ ok: true, roles })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/auth/change-credentials — staff changes their own username and/or PIN on first login
router.post('/auth/change-credentials', async (req, res) => {
  const { username, current_pin, new_username, new_pin } = req.body
  if (!username || !current_pin) return res.status(400).json({ error: 'username and current_pin required' })
  if (!new_username && !new_pin) return res.status(400).json({ error: 'Provide new_username or new_pin' })
  if (new_pin && !/^\d{4,8}$/.test(new_pin)) return res.status(400).json({ error: 'PIN must be 4–8 digits' })
  if (new_username && !/^[a-z0-9._]{3,30}$/.test(new_username)) return res.status(400).json({ error: 'Username must be 3–30 lowercase alphanumeric characters, dots, or underscores' })
  try {
    const cred = await dbGet('SELECT * FROM user_credentials WHERE username = ? AND is_active = 1', [username])
    if (!cred) return res.status(404).json({ error: 'Account not found' })

    const match = await bcrypt.compare(String(current_pin), cred.pin_hash)
    if (!match) return res.status(401).json({ error: 'Current PIN is incorrect' })

    if (new_username && new_username !== username) {
      const taken = await dbGet('SELECT 1 FROM user_credentials WHERE username = ? AND credential_id != ?', [new_username, cred.credential_id])
      if (taken) return res.status(409).json({ error: 'Username already taken' })
    }

    const updates = []
    const params = []
    if (new_username) { updates.push('username = ?'); params.push(new_username) }
    if (new_pin) {
      const pin_hash = await bcrypt.hash(String(new_pin), SALT_ROUNDS)
      updates.push('pin_hash = ?'); params.push(pin_hash)
    }
    updates.push('must_change_pin = 0', 'last_changed_at = CURRENT_TIMESTAMP')
    params.push(cred.credential_id)

    await dbRun(`UPDATE user_credentials SET ${updates.join(', ')} WHERE credential_id = ?`, params)
    res.json({ ok: true, username: new_username || username })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/auth/change-pin — staff changes their own PIN
router.post('/auth/change-pin', async (req, res) => {
  const { username, current_pin, new_pin } = req.body
  if (!username || !current_pin || !new_pin) return res.status(400).json({ error: 'username, current_pin, new_pin required' })
  if (!/^\d{4,8}$/.test(new_pin)) return res.status(400).json({ error: 'PIN must be 4–8 digits' })
  try {
    const cred = await dbGet('SELECT * FROM user_credentials WHERE username = ? AND is_active = 1', [username])
    if (!cred) return res.status(404).json({ error: 'Account not found' })

    const match = await bcrypt.compare(String(current_pin), cred.pin_hash)
    if (!match) return res.status(401).json({ error: 'Current PIN is incorrect' })

    const pin_hash = await bcrypt.hash(String(new_pin), SALT_ROUNDS)
    await dbRun(
      'UPDATE user_credentials SET pin_hash = ?, must_change_pin = 0, last_changed_at = CURRENT_TIMESTAMP WHERE credential_id = ?',
      [pin_hash, cred.credential_id]
    )
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
module.exports.setDefaultPages = setDefaultPages
