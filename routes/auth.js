const express    = require("express");
const router     = express.Router();
const jwt        = require("jsonwebtoken");
const bcrypt     = require("bcrypt");
const { JWT_SECRET } = require("../middleware/auth");
const { db }     = require("../Database");

const ADMIN_USERNAME      = process.env.TH_USERNAME           || "admin";
const ADMIN_PASSWORD      = process.env.TH_PASSWORD           || "tirehub123";
const SUPERADMIN_USERNAME = process.env.TH_SUPERADMIN_USERNAME || "superadmin";
const SUPERADMIN_PASSWORD = process.env.TH_SUPERADMIN_PASSWORD || "th-super-2025!";

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
  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }

  // 1. Superadmin (absolute power, secret account)
  if (username === SUPERADMIN_USERNAME && password === SUPERADMIN_PASSWORD) {
    const token = jwt.sign(
      { username, power: 100, is_superadmin: true },
      JWT_SECRET,
      { expiresIn: "12h" }
    );
    return res.json({ token, username, power: 100, is_superadmin: true, is_admin: true, system_roles: ["superadmin"], allowed_pages: null, expiresIn: "12h" });
  }

  // 2. Hardcoded admin
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign(
      { username, power: 60, is_admin: true },
      JWT_SECRET,
      { expiresIn: "12h" }
    );
    return res.json({ token, username, power: 60, is_admin: true, system_roles: ["admin"], allowed_pages: null, expiresIn: "12h" });
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
      { expiresIn: "12h" }
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
      expiresIn: "12h",
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
