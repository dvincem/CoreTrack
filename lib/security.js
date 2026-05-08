const crypto = require('crypto');

/**
 * Generates a dynamic superadmin password that rotates every 30 minutes.
 * Uses the TH_SUPERADMIN_PASSWORD as a salt.
 * @param {number} offset - Number of 30-minute windows to offset (e.g. -1 for previous window)
 * @returns {string} - A 16-character dynamic password
 */
function getDynamicSuperadminPassword(offset = 0) {
  const masterSecret = process.env.TH_SUPERADMIN_PASSWORD;
  if (!masterSecret) return null;
  
  const windowMs = 30 * 60 * 1000;
  const windowIndex = Math.floor(Date.now() / windowMs) + offset;
  
  return crypto
    .createHmac('sha256', masterSecret)
    .update(String(windowIndex))
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();
}

/**
 * Verifies a dynamic password against the current and previous windows.
 * @param {string} input - The password provided at login
 * @returns {boolean} - True if matches current or previous window
 */
function verifyDynamicSuperadminPassword(input) {
  if (!input) return false;
  const current = getDynamicSuperadminPassword(0);
  const previous = getDynamicSuperadminPassword(-1);
  
  // Use timingSafeEqual to prevent timing attacks
  const compare = (a, b) => {
    if (!a || !b || a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  };

  return compare(input, current) || compare(input, previous);
}

module.exports = {
  getDynamicSuperadminPassword,
  verifyDynamicSuperadminPassword
};
