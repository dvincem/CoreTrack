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
const { v4: uuidv4 } = require('uuid');

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

/**
 * Logs a price change to the item_price_history table.
 */
function logPriceHistory(item_id, price_type, old_price, new_price, changed_by, notes, ts) {
  const history_id = `PH-${uuidv4()}`;
  db.run(
    `INSERT INTO item_price_history (history_id, item_id, price_type, old_price, new_price, changed_at, changed_by, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [history_id, item_id, price_type, old_price ?? null, new_price, ts || new Date().toISOString(), changed_by || null, notes || null]
  );
}

/**
 * Finds or creates a DOT variant of a parent item.
 * Always resolves to the true parent if the provided ID is already a variant.
 */
function findOrCreateDotVariant(parent_item_id, dot_number, unit_cost, selling_price, created_by) {
  const dotLabel = dot_number.toString().trim();

  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM item_master WHERE item_id = ?`, [parent_item_id], (err, item) => {
      if (err || !item) return reject(err || new Error("Item not found"));

      const trueParentId = item.parent_item_id || parent_item_id;

      db.get(
        `SELECT * FROM item_master WHERE parent_item_id = ? AND dot_number = ? AND is_active = 1`,
        [trueParentId, dotLabel],
        (err2, existingChild) => {
          if (err2) return reject(err2);

          if (existingChild) {
            const newCost = unit_cost != null ? parseFloat(unit_cost) : existingChild.unit_cost;
            const costDelta = newCost - (existingChild.unit_cost || 0);
            const newPrice = selling_price != null
              ? parseFloat(selling_price)
              : (Math.abs(costDelta) > 0.001 ? (existingChild.selling_price || 0) + costDelta : existingChild.selling_price);

            const costChanged = Math.abs((existingChild.unit_cost || 0) - newCost) > 0.001;
            const priceChanged = Math.abs((existingChild.selling_price || 0) - newPrice) > 0.001;

            if (costChanged || priceChanged) {
              db.run(
                `UPDATE item_master SET unit_cost = ?, selling_price = ? WHERE item_id = ?`,
                [newCost, newPrice, existingChild.item_id],
                (err3) => {
                  if (err3) return reject(err3);
                  const ts = new Date().toISOString();
                  if (costChanged) logPriceHistory(existingChild.item_id, 'UNIT_COST', existingChild.unit_cost, newCost, created_by, null, ts);
                  if (priceChanged) logPriceHistory(existingChild.item_id, 'SELLING_PRICE', existingChild.selling_price, newPrice, created_by, null, ts);
                  resolve({ item_id: existingChild.item_id, is_new: false });
                }
              );
            } else {
              resolve({ item_id: existingChild.item_id, is_new: false });
            }
          } else {
            db.get(`SELECT * FROM item_master WHERE item_id = ?`, [trueParentId], (err3, parent) => {
              if (err3 || !parent) return reject(err3 || new Error("Parent item not found"));

              const newCost = unit_cost != null ? parseFloat(unit_cost) : parent.unit_cost;
              const costDelta = newCost - (parent.unit_cost || 0);
              const newPrice = selling_price != null
                ? parseFloat(selling_price)
                : (Math.abs(costDelta) > 0.001 ? (parent.selling_price || 0) + costDelta : parent.selling_price);

              const variantId = `${trueParentId}-DOT${dotLabel}`;
              const variantSku = `${parent.sku}-DOT${dotLabel}`;
              const variantName = parent.item_name.replace(/\s*\[DOT\s+\S+\]/i, '') + ` [DOT ${dotLabel}]`;

              db.run(
                `INSERT INTO item_master (item_id, sku, item_name, category, brand, design, size, rim_size, unit_cost, selling_price, unit, supplier_id, reorder_point, dot_number, parent_item_id, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [variantId, variantSku, variantName, parent.category, parent.brand, parent.design, parent.size, parent.rim_size, newCost, newPrice, parent.unit || 'PCS', parent.supplier_id, parent.reorder_point || 5, dotLabel, trueParentId],
                function (err4) {
                  if (err4) {
                    if (err4.message && err4.message.includes('UNIQUE')) {
                      return db.get(`SELECT item_id FROM item_master WHERE item_id = ?`, [variantId], (_, row) => {
                        resolve({ item_id: row ? row.item_id : trueParentId, is_new: false });
                      });
                    }
                    return reject(err4);
                  }
                  const ts = new Date().toISOString();
                  logPriceHistory(variantId, 'UNIT_COST', null, newCost, created_by, `Initial cost — DOT ${dotLabel}`, ts);
                  logPriceHistory(variantId, 'SELLING_PRICE', null, newPrice, created_by, `Initial price — DOT ${dotLabel}`, ts);
                  resolve({ item_id: variantId, is_new: true });
                }
              );
            });
          }
        }
      );
    });
  });
}

module.exports = { dbAll, dbGet, dbRun, dbSerialize, syncCurrentStock, logPriceHistory, findOrCreateDotVariant };
