/**
 * Promisified SQLite helpers.
 *
 * Import these instead of calling db.all/get/run directly so that
 * route handlers can use async/await instead of nested callbacks.
 *
 * Usage:
 *   const { dbAll, dbGet, dbRun } = require('../lib/db');
 *
 *   const rows = await dbAll('SELECT * FROM shop_master');
 *   const row  = await dbGet('SELECT * FROM orders WHERE order_id = ?', [id]);
 *   const meta = await dbRun('INSERT INTO ...', [...]);
 *   // meta.lastID and meta.changes are available on the resolved value
 */

const { db } = require('../Database');

/**
 * Runs a SELECT that returns multiple rows.
 * @param {string} sql
 * @param {any[]} [params=[]]
 * @returns {Promise<any[]>}
 */
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])))
  );
}

/**
 * Runs a SELECT that returns a single row (or undefined).
 * @param {string} sql
 * @param {any[]} [params=[]]
 * @returns {Promise<any|undefined>}
 */
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
  );
}

/**
 * Runs an INSERT / UPDATE / DELETE.
 * Resolves with `this` from the sqlite3 callback, giving access to
 * `lastID` and `changes`.
 * @param {string} sql
 * @param {any[]} [params=[]]
 * @returns {Promise<{ lastID: number, changes: number }>}
 */
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) =>
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    })
  );
}

/**
 * Runs multiple statements inside a db.serialize block.
 * The callback receives { dbAll, dbGet, dbRun } already bound so
 * callers can run sequential statements without extra imports.
 * @param {(helpers: { dbAll, dbGet, dbRun }) => Promise<any>} fn
 * @returns {Promise<any>}
 */
function dbSerialize(fn) {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        resolve(await fn({ dbAll, dbGet, dbRun }));
      } catch (err) {
        reject(err);
      }
    });
  });
}

/**
 * Synchronizes the current_stock table for specific item(s) by summing
 * the inventory_ledger. Skips items that are identified as services.
 * @param {string} shop_id
 * @param {string[]} item_ids
 */
async function syncCurrentStock(shop_id, item_ids) {
  if (!shop_id || !item_ids || item_ids.length === 0) return;
  const uniqueIds = [...new Set(item_ids.filter(Boolean))];
  
  for (const item_id of uniqueIds) {
    // Check if it's a service (services don't have stock)
    const isService = await dbGet(`SELECT 1 FROM services_master WHERE service_id = ?`, [item_id]);
    if (isService) continue;

    await dbRun(`
      INSERT INTO current_stock (shop_id, item_id, current_quantity, last_updated)
      VALUES (?, ?, (SELECT COALESCE(SUM(quantity), 0) FROM inventory_ledger WHERE shop_id = ? AND item_id = ?), CURRENT_TIMESTAMP)
      ON CONFLICT(shop_id, item_id) DO UPDATE SET
        current_quantity = (SELECT COALESCE(SUM(quantity), 0) FROM inventory_ledger WHERE shop_id = ? AND item_id = ?),
        last_updated = CURRENT_TIMESTAMP
    `, [shop_id, item_id, shop_id, item_id, shop_id, item_id]);
  }
}

module.exports = { dbAll, dbGet, dbRun, dbSerialize, syncCurrentStock };
