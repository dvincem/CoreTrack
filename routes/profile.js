const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { db } = require('../Database');

const SALT_ROUNDS = 10;

function dbGet(sql, p = []) { return new Promise((r, j) => db.get(sql, p, (e, row) => e ? j(e) : r(row))) }
function dbRun(sql, p = []) { return new Promise((r, j) => db.run(sql, p, function(e) { e ? j(e) : r(this) })) }
function dbAll(sql, p = []) { return new Promise((r, j) => db.all(sql, p, (e, rows) => e ? j(e) : r(rows || []))) }

// GET /api/profile
router.get('/profile', async (req, res) => {
  try {
    const { staff_id, username, is_admin, is_superadmin } = req.user;

    if (is_superadmin || (is_admin && !staff_id)) {
      // Hardcoded accounts
      return res.json({
        username: username,
        full_name: is_superadmin ? 'System Superadmin' : 'System Administrator',
        role: is_superadmin ? 'superadmin' : 'admin',
        authority: 'Full System Access',
        profile_picture: null
      });
    }

    const profile = await dbGet(
      `SELECT sm.full_name, sm.role, sm.profile_picture, uc.username
       FROM staff_master sm
       JOIN user_credentials uc ON sm.staff_id = uc.staff_id
       WHERE sm.staff_id = ?`,
      [staff_id]
    );

    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const sysRoles = await dbAll(
      "SELECT role FROM user_system_roles WHERE credential_id = (SELECT credential_id FROM user_credentials WHERE staff_id = ?)",
      [staff_id]
    );

    res.json({
      ...profile,
      authority: sysRoles.map(r => r.role).join(', ') || 'Standard Access'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/profile/picture
router.patch('/profile/picture', async (req, res) => {
  const { profile_picture } = req.body; // Base64 string
  const { staff_id } = req.user;

  if (!staff_id) return res.status(403).json({ error: 'Cannot update picture for system accounts' });

  try {
    await dbRun(
      'UPDATE staff_master SET profile_picture = ? WHERE staff_id = ?',
      [profile_picture, staff_id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/profile/change-password
router.post('/api/profile/change-password', async (req, res) => {
    const { current_password, new_password } = req.body;
    const { username, credential_id, is_admin, is_superadmin } = req.user;

    if (is_superadmin || is_admin) {
        return res.status(403).json({ error: 'System accounts cannot change password via this endpoint. Please use environment variables.' });
    }

    if (!current_password || !new_password) {
        return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    try {
        const cred = await dbGet('SELECT * FROM user_credentials WHERE credential_id = ?', [credential_id]);
        if (!cred) return res.status(404).json({ error: 'Account not found' });

        const match = await bcrypt.compare(String(current_password), cred.pin_hash);
        if (!match) return res.status(401).json({ error: 'Current password/PIN is incorrect' });

        const pin_hash = await bcrypt.hash(String(new_password), SALT_ROUNDS);
        await dbRun(
            'UPDATE user_credentials SET pin_hash = ?, must_change_pin = 0, last_changed_at = CURRENT_TIMESTAMP WHERE credential_id = ?',
            [pin_hash, credential_id]
        );
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
