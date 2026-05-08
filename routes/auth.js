const express    = require("express");
const router     = express.Router();
const jwt        = require("jsonwebtoken");
const bcrypt     = require("bcrypt");
const { JWT_SECRET } = require("../middleware/auth");
const { db }     = require("../Database");
const { verifyDynamicSuperadminPassword } = require("../lib/security");

const ADMIN_USERNAME      = process.env.TH_USERNAME;
const ADMIN_PASSWORD      = process.env.TH_PASSWORD;
const SUPERADMIN_USERNAME = process.env.TH_SUPERADMIN_USERNAME;
const SUPERADMIN_PASSWORD = process.env.TH_SUPERADMIN_PASSWORD;

// Pre-compute bcrypt hashes for env-var credentials at startup.
// Promises start resolving in the background immediately; awaited in the login handler.
const SALT_ROUNDS_ADMIN = 12;
const _adminHashP      = ADMIN_PASSWORD      ? bcrypt.hash(ADMIN_PASSWORD,      SALT_ROUNDS_ADMIN) : Promise.resolve(null);
const _superadminHashP = SUPERADMIN_PASSWORD ? bcrypt.hash(SUPERADMIN_PASSWORD, SALT_ROUNDS_ADMIN) : Promise.resolve(null);

function dbGet(sql, p = []) {
  return new Promise((r, j) => db.get(sql, p, (e, row) => e ? j(e) : r(row)));
}
function dbAll(sql, p = []) {
  return new Promise((r, j) => db.all(sql, p, (e, rows) => e ? j(e) : r(rows || [])));
}

/**
 * POST /api/auth/login
 * Accepts superadmin, admin, or staff PIN login.
 */
router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string' ||
      username.length === 0 || password.length === 0 ||
      username.length > 200 || password.length > 200) {
    return res.status(400).json({ error: "Invalid credentials format" });
  }

  // 1. Superadmin (absolute power, rotating dynamic password)
  if (SUPERADMIN_USERNAME && username === SUPERADMIN_USERNAME && verifyDynamicSuperadminPassword(password)) {
    const token = jwt.sign(
      { username, power: 100, is_superadmin: true },
      JWT_SECRET,
      { expiresIn: "8h" }
    );
    return res.json({ token, username, power: 100, is_superadmin: true, is_admin: true, system_roles: ["superadmin"], allowed_pages: null, expiresIn: "8h" });
  }

  // 2. Hardcoded admin
  const adminHash = await _adminHashP;
  if (ADMIN_USERNAME && adminHash &&
      username === ADMIN_USERNAME && await bcrypt.compare(password, adminHash)) {
    const token = jwt.sign(
      { username, power: 60, is_admin: true },
      JWT_SECRET,
      { expiresIn: "8h" }
    );
    return res.json({ token, username, power: 60, is_admin: true, system_roles: ["admin"], allowed_pages: null, expiresIn: "8h" });
  }

  // 3. Staff PIN login
  try {
    const cred = await dbGet(
      `SELECT uc.*, sm.full_name, sm.role AS staff_role, sm.staff_id
       FROM user_credentials uc
       JOIN staff_master sm ON uc.staff_id = sm.staff_id
       WHERE uc.username = ? AND uc.is_active = 1`,
      [username]
    );

    if (!cred) return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(String(password), cred.pin_hash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    // Fetch system roles — auto-seed from staff role if none exist
    let sysRoleRows = await dbAll(
      "SELECT role FROM user_system_roles WHERE credential_id = ?",
      [cred.credential_id]
    );
    if (sysRoleRows.length === 0) {
      const roleMap = { 'owner': 'owner', 'general manager': 'admin', 'operations manager': 'admin' };
      const autoRole = roleMap[(cred.staff_role || '').toLowerCase()];
      if (autoRole) {
        await new Promise((res, rej) => db.run(
          "INSERT OR IGNORE INTO user_system_roles (credential_id, role, granted_by) VALUES (?, ?, ?)",
          [cred.credential_id, autoRole, 'system'],
          e => e ? rej(e) : res()
        ));
        sysRoleRows = [{ role: autoRole }];
      }
    }
    const system_roles = sysRoleRows.map(r => r.role);
    const power = computePower(system_roles);

    const token = jwt.sign(
      { username, staff_id: cred.staff_id, credential_id: cred.credential_id, power, is_admin: false },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    let pageRows = await dbAll(
      "SELECT page_id FROM user_page_access WHERE credential_id = ?",
      [cred.credential_id]
    );
    // First login with no page access rows — seed defaults based on staff role
    if (pageRows.length === 0) {
      const { setDefaultPages } = require('./credentials');
      await setDefaultPages(cred.credential_id, cred.staff_role);
      pageRows = await dbAll(
        "SELECT page_id FROM user_page_access WHERE credential_id = ?",
        [cred.credential_id]
      );
    }
    const allowed_pages = pageRows.map(p => p.page_id);

    return res.json({
      token,
      username,
      full_name: cred.full_name,
      role: cred.staff_role,
      staff_id: cred.staff_id,
      credential_id: cred.credential_id,
      is_admin: false,
      must_change_pin: cred.must_change_pin === 1,
      system_roles,
      power,
      allowed_pages,
      expiresIn: "8h",
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});


function computePower(systemRoles) {
  const POWER_MAP = { owner: 80, admin: 60 };
  return Math.max(0, ...systemRoles.map(r => POWER_MAP[r] || 0));
}

module.exports = router;
module.exports.computePower = computePower;
module.exports.SUPERADMIN_USERNAME = SUPERADMIN_USERNAME;
module.exports.SUPERADMIN_PASSWORD = SUPERADMIN_PASSWORD;
