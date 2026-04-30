const express = require("express");
const router = express.Router();
const { db } = require("../Database");
const { dbGet, dbAll } = require("../lib/db");
const { v4: uuidv4 } = require("uuid");

// ── Helper: log a price change to item_price_history ─────────────────────────
function logPriceHistory(item_id, price_type, old_price, new_price, changed_by, notes, ts) {
  const history_id = `PH-${uuidv4()}`;
  db.run(
    `INSERT INTO item_price_history (history_id, item_id, price_type, old_price, new_price, changed_at, changed_by, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [history_id, item_id, price_type, old_price ?? null, new_price, ts || new Date().toISOString(), changed_by || null, notes || null]
  );
}

// ── Helper: find or create a DOT variant of a parent item ────────────────────
// DOT format: WWYR — first 2 digits = week, last 2 digits = year (e.g. "2226" = week 22, year 2026)
// Always updates the parent item in place — never creates new items.
// Logs DOT, cost, and price changes to history.
function findOrCreateDotVariant(parent_item_id, dot_number, unit_cost, selling_price, created_by) {
  const dotLabel = dot_number.toString().trim();

  return new Promise((resolve, reject) => {
    // First, resolve to the true parent (in case parent_item_id is itself a child)
    db.get(`SELECT * FROM item_master WHERE item_id = ?`, [parent_item_id], (err, item) => {
      if (err || !item) return reject(err || new Error("Item not found"));

      const trueParentId = item.parent_item_id || parent_item_id;

      // Look for an existing child variant with this DOT number
      db.get(
        `SELECT * FROM item_master WHERE parent_item_id = ? AND dot_number = ? AND is_active = 1`,
        [trueParentId, dotLabel],
        (err2, existingChild) => {
          if (err2) return reject(err2);

          if (existingChild) {
            // Found existing child — update cost/price if needed
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
            // No existing child — fetch the true parent to copy fields and create a new child
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
                    // If duplicate key (variant already exists with different casing etc), try fetching it
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

router.get("/items/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  const { category, q, page, perPage } = req.query;

  const paginated = page !== undefined || perPage !== undefined || q !== undefined;

  const selectCols = `
    im.item_id, im.sku, im.item_name, im.category, im.brand, im.design,
    im.size, im.rim_size, im.unit_cost, im.selling_price, im.is_active,
    im.supplier_id, im.reorder_point, im.dot_number, im.parent_item_id,
    sm.supplier_name,
    COALESCE(cs.current_quantity, 0) as current_quantity,
    COALESCE(cs.last_updated, im.created_at) as last_stock_update`;

  const fromJoin = `FROM item_master im
    LEFT JOIN current_stock cs ON im.item_id = cs.item_id AND cs.shop_id = ?
    LEFT JOIN supplier_master sm ON im.supplier_id = sm.supplier_id
    WHERE im.is_active = 1`;

  const baseParams = [shop_id];
  let whereExtra = '';
  if (category) { whereExtra += ' AND im.category = ?'; baseParams.push(category); }
  if (paginated && q && q.trim()) {
    whereExtra += ` AND (im.sku LIKE ? OR im.item_name LIKE ? OR im.brand LIKE ? OR im.design LIKE ? OR im.size LIKE ?)`;
    const like = `%${q.trim()}%`;
    baseParams.push(like, like, like, like, like);
  }

  const orderBy = `ORDER BY current_quantity ASC, im.brand, im.design, im.size`;

  if (!paginated) {
    db.all(
      `SELECT ${selectCols} ${fromJoin}${whereExtra} ${orderBy}`,
      baseParams,
      (err, rows) => {
        if (err) return res.json({ error: err.message });
        res.json(rows || []);
      },
    );
    return;
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedPerPage = Math.min(200, Math.max(1, parseInt(perPage, 10) || 50));
  const offset = (parsedPage - 1) * parsedPerPage;

  const countSql = `SELECT COUNT(*) as total ${fromJoin}${whereExtra}`;
  db.get(countSql, baseParams, (cErr, cRow) => {
    if (cErr) return res.status(500).json({ error: cErr.message });
    const total = cRow?.total || 0;
    const totalPages = Math.ceil(total / parsedPerPage);
    const dataSql = `SELECT ${selectCols} ${fromJoin}${whereExtra} ${orderBy} LIMIT ? OFFSET ?`;
    db.all(dataSql, [...baseParams, parsedPerPage, offset], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        data: rows || [],
        meta: { page: parsedPage, perPage: parsedPerPage, total, totalCount: total, totalPages },
      });
    });
  });
});

router.post("/items", (req, res) => {
  const { sku, item_name, category, brand, design, size, rim_size, unit_cost, selling_price, supplier_id, reorder_point, dot_number } = req.body;
  if (!sku || !item_name || !category || !unit_cost || !selling_price) {
    return res.status(400).json({ error: "SKU, Item Name, Category, Unit Cost, and Selling Price are required" });
  }
  const item_id = `ITEM-${Date.now()}`;
  const cost = parseFloat(unit_cost);
  const price = parseFloat(selling_price);
  const dot = (dot_number || "").toString().trim() || null;
  const upperBrand = brand ? brand.toUpperCase() : null;
  const upperDesign = design ? design.toUpperCase() : null;
  db.run(
    `INSERT INTO item_master (item_id, sku, item_name, category, brand, design, size, rim_size, unit_cost, selling_price, supplier_id, reorder_point, dot_number, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [item_id, sku, item_name, category, upperBrand, upperDesign, size || null, rim_size || null, cost, price, supplier_id || null, parseInt(reorder_point) || 5, dot],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      logPriceHistory(item_id, 'SELLING_PRICE', null, price, null, 'Item created');
      logPriceHistory(item_id, 'UNIT_COST', null, cost, null, 'Item created');
      res.json({ item_id, sku, item_name, category, brand, design, size, rim_size, unit_cost: cost, selling_price: price, dot_number: dot, is_active: 1, created_at: new Date().toISOString() });
    },
  );
});

router.post("/items-bulk", async (req, res) => {
  const { shop_id, items } = req.body;
  if (!shop_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Shop ID and a non-empty array of items are required" });
  }

  const results = [];
  const errors = [];

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    let completed = 0;
    let failed = false;

    const finalize = () => {
      if (failed) {
        db.run("ROLLBACK");
        return; // Already responded or will respond with error
      }
      db.run("COMMIT", (err) => {
        if (err) return res.status(500).json({ error: "Transaction commit failed" });
        res.json({ results, errors });
      });
    };

    items.forEach((item, index) => {
      const { sku, item_name, category, brand, design, size, rim_size, unit_cost, selling_price, supplier_id, reorder_point, dot_number, quantity } = item;
      
      if (!sku || !item_name || !category || unit_cost == null || selling_price == null) {
        errors.push({ index, error: "Missing required fields" });
        completed++;
        if (completed === items.length) finalize();
        return;
      }

      const item_id = `ITEM-${Date.now()}-${index}`;
      const cost = parseFloat(unit_cost);
      const price = parseFloat(selling_price);
      const dot = (dot_number || "").toString().trim() || null;
      const upperBrand = brand ? brand.toUpperCase() : null;
      const upperDesign = design ? design.toUpperCase() : null;

      db.run(
        `INSERT INTO item_master (item_id, sku, item_name, category, brand, design, size, rim_size, unit_cost, selling_price, supplier_id, reorder_point, dot_number, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [item_id, sku, item_name, category, upperBrand, upperDesign, size || null, rim_size || null, cost, price, supplier_id || null, parseInt(reorder_point) || 5, dot],
        function (err) {
          if (err) {
            errors.push({ index, error: err.message });
            completed++;
            if (completed === items.length) finalize();
            return;
          }

          logPriceHistory(item_id, 'SELLING_PRICE', null, price, null, 'Item created (Bulk)');
          logPriceHistory(item_id, 'UNIT_COST', null, cost, null, 'Item created (Bulk)');

          // Initial stock
          if (quantity && parseInt(quantity) > 0) {
            const inventory_ledger_id = `INVTXN-${Date.now()}-${index}`;
            db.run(
              `INSERT INTO inventory_ledger (inventory_ledger_id, shop_id, item_id, transaction_type, quantity, unit_cost, supplier_id, dot_number, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [inventory_ledger_id, shop_id, item_id, "PURCHASE", parseInt(quantity), cost, supplier_id || null, dot, "BULK_CREATE"],
              (invErr) => {
                if (invErr) {
                  errors.push({ index, error: `Item created but stock failed: ${invErr.message}` });
                } else {
                  results.push({ index, item_id, sku });
                }
                completed++;
                if (completed === items.length) finalize();
              }
            );
          } else {
            results.push({ index, item_id, sku });
            completed++;
            if (completed === items.length) finalize();
          }
        }
      );
    });
  });
});


router.put("/items/:item_id/selling-price", (req, res) => {
  const { item_id } = req.params;
  const { selling_price, changed_by } = req.body;
  if (!selling_price || selling_price <= 0) {
    return res.status(400).json({ error: "Selling price must be greater than 0" });
  }
  const newPrice = parseFloat(selling_price);
  db.get(`SELECT selling_price FROM item_master WHERE item_id = ?`, [item_id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: "Item not found" });
    db.run(`UPDATE item_master SET selling_price = ? WHERE item_id = ?`, [newPrice, item_id], function (err2) {
      if (err2) return res.status(400).json({ error: err2.message });
      logPriceHistory(item_id, 'SELLING_PRICE', row.selling_price, newPrice, changed_by || null, null);
      res.json({ item_id, selling_price: newPrice, message: "Selling price updated successfully" });
    });
  });
});

router.put("/items/:item_id/unit-cost", (req, res) => {
  const { item_id } = req.params;
  const { unit_cost, changed_by } = req.body;
  if (unit_cost == null) {
    return res.status(400).json({ error: "Unit cost is required" });
  }
  const newCost = parseFloat(unit_cost);
  db.get(`SELECT unit_cost, selling_price FROM item_master WHERE item_id = ?`, [item_id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: "Item not found" });
    const costDelta = newCost - (row.unit_cost || 0);
    const newPrice = (row.selling_price || 0) + costDelta;
    db.run(`UPDATE item_master SET unit_cost = ?, selling_price = ? WHERE item_id = ?`, [newCost, newPrice, item_id], function (err2) {
      if (err2) return res.status(400).json({ error: err2.message });
      if (Math.abs(costDelta) > 0.001) {
        const ts = new Date().toISOString();
        logPriceHistory(item_id, 'UNIT_COST', row.unit_cost, newCost, changed_by || null, null, ts);
        logPriceHistory(item_id, 'SELLING_PRICE', row.selling_price, newPrice, changed_by || null, null, ts);
      }
      res.json({ item_id, unit_cost: newCost, selling_price: newPrice, message: "Unit cost updated successfully" });
    });
  });
});

router.put("/items/:item_id/supplier", (req, res) => {
  const { item_id } = req.params;
  const { supplier_id } = req.body;
  if (!supplier_id) {
    return res.status(400).json({ error: "Supplier ID is required" });
  }
  db.run(`UPDATE item_master SET supplier_id = ? WHERE item_id = ?`, [supplier_id, item_id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    // Join to get supplier name to return
    db.get(`SELECT supplier_name FROM supplier_master WHERE supplier_id = ?`, [supplier_id], (err2, row) => {
      res.json({ 
        item_id, 
        supplier_id, 
        supplier_name: row ? row.supplier_name : null,
        message: "Supplier updated successfully" 
      });
    });
  });
});

router.put("/items/:item_id/details", (req, res) => {
  const { item_id } = req.params;
  const { category, brand, design, size } = req.body;
  
  const upperBrand = brand ? brand.toUpperCase().trim() : null;
  const upperDesign = design ? design.toUpperCase().trim() : null;
  const trimmedSize = size ? size.trim() : null;
  const trimmedCat = category ? category.trim() : "MISC";

  // Recalculate item_name
  const item_name = [upperBrand, upperDesign, trimmedSize].filter(Boolean).join(' ');

  db.run(
    `UPDATE item_master 
     SET category = ?, brand = ?, design = ?, size = ?, item_name = ?
     WHERE item_id = ?`,
    [trimmedCat, upperBrand, upperDesign, trimmedSize, item_name, item_id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Item not found" });
      res.json({ 
        item_id, 
        category: trimmedCat, 
        brand: upperBrand, 
        design: upperDesign, 
        size: trimmedSize, 
        item_name,
        message: "Item details updated successfully" 
      });
    }
  );
});

// ── Price history for an item ─────────────────────────────────────────────────
router.get("/item-price-history/:item_id", (req, res) => {
  const { item_id } = req.params;
  db.all(
    `SELECT h.*, im.item_name, im.dot_number
     FROM item_price_history h
     JOIN item_master im ON h.item_id = im.item_id
     WHERE h.item_id = ?
     ORDER BY h.changed_at DESC
     LIMIT 50`,
    [item_id],
    (err, rows) => res.json(err ? { error: err.message } : rows || [])
  );
});

// Expose findOrCreateDotVariant for orders route
router.findOrCreateDotVariant = findOrCreateDotVariant;

router.get("/items-search/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  const { q, category, page, perPage } = req.query;
  const paginated = page !== undefined || perPage !== undefined;

  const fromWhere = `FROM item_master i
    LEFT JOIN current_stock cs ON i.item_id = cs.item_id AND cs.shop_id = ?
    WHERE i.is_active = 1
      AND NOT (
        i.parent_item_id IS NULL
        AND EXISTS (
          SELECT 1 FROM item_master child
          WHERE child.parent_item_id = i.item_id AND child.is_active = 1
        )
      )`;
  const params = [shop_id];
  let whereExtra = '';
  if (q) {
    whereExtra += ` AND (i.sku LIKE ? OR i.size LIKE ? OR i.brand LIKE ? OR i.item_name LIKE ?)`;
    const searchTerm = `%${q}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }
  if (category) {
    whereExtra += ` AND i.category = ?`;
    params.push(category);
  }
  // FIFO: for tires, show oldest DOT first; non-DOT items (parent) last within same group
  const orderBy = ` ORDER BY i.brand, i.design, i.size,
             CASE WHEN i.dot_number IS NULL THEN 1 ELSE 0 END,
             i.dot_number ASC, i.item_name`;

  if (!paginated) {
    const query = `SELECT i.*, cs.current_quantity ${fromWhere}${whereExtra}${orderBy}`;
    db.all(query, params, (err, rows) => {
      res.json(err ? { error: err.message } : rows);
    });
    return;
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedPerPage = Math.min(200, Math.max(1, parseInt(perPage, 10) || 50));
  const offset = (parsedPage - 1) * parsedPerPage;

  const countSql = `SELECT COUNT(*) as total ${fromWhere}${whereExtra}`;
  db.get(countSql, params, (cErr, cRow) => {
    if (cErr) return res.status(500).json({ error: cErr.message });
    const total = cRow?.total || 0;
    const totalPages = Math.ceil(total / parsedPerPage);
    const dataSql = `SELECT i.*, cs.current_quantity ${fromWhere}${whereExtra}${orderBy} LIMIT ? OFFSET ?`;
    db.all(dataSql, [...params, parsedPerPage, offset], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        data: rows || [],
        meta: { page: parsedPage, perPage: parsedPerPage, total, totalCount: total, totalPages },
      });
    });
  });
});

// ── Inventory endpoints ──────────────────────────────────────────────────────

router.post("/inventory/purchase", (req, res) => {
  const { shop_id, item_id, quantity, unit_cost, reference_id, created_by, supplier_id, dot_number } = req.body;
  if (!shop_id || !item_id || !quantity || quantity <= 0) {
    return res.status(400).json({ error: "Shop ID, Item ID, and Quantity > 0 are required" });
  }
  const inventory_ledger_id = `INVTXN-${Date.now()}`;
  db.run(
    `INSERT INTO inventory_ledger (inventory_ledger_id, shop_id, item_id, transaction_type, quantity, unit_cost, reference_id, supplier_id, dot_number, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [inventory_ledger_id, shop_id, item_id, "PURCHASE", parseInt(quantity), parseFloat(unit_cost) || 0, reference_id || null, supplier_id || null, dot_number || null, created_by || "SYSTEM"],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      res.json({ inventory_ledger_id, shop_id, item_id, transaction_type: "PURCHASE", quantity: parseInt(quantity), unit_cost: parseFloat(unit_cost) || 0, reference_id, supplier_id, created_by, created_at: new Date().toISOString() });
    },
  );
});

router.post("/inventory/sale", (req, res) => {
  const { shop_id, item_id, quantity, reference_id, created_by, dot_number } = req.body;
  if (!shop_id || !item_id || !quantity || quantity <= 0) {
    return res.status(400).json({ error: "Shop ID, Item ID, and Quantity > 0 are required" });
  }
  const inventory_ledger_id = `INVTXN-${Date.now()}`;
  db.run(
    `INSERT INTO inventory_ledger (inventory_ledger_id, shop_id, item_id, transaction_type, quantity, unit_cost, reference_id, dot_number, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [inventory_ledger_id, shop_id, item_id, "SALE", -Math.abs(parseInt(quantity)), 0, reference_id || null, dot_number || null, created_by || "SYSTEM"],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      res.json({ inventory_ledger_id, shop_id, item_id, transaction_type: "SALE", quantity: parseInt(quantity), reference_id, created_by, created_at: new Date().toISOString() });
    },
  );
});

router.post("/inventory/adjustment", (req, res) => {
  const { shop_id, item_id, quantity, reference_id, created_by, dot_number } = req.body;
  if (!shop_id || !item_id || quantity === undefined || quantity === null) {
    return res.status(400).json({ error: "Shop ID, Item ID, and Quantity are required" });
  }
  const inventory_ledger_id = `INVTXN-${Date.now()}`;
  db.run(
    `INSERT INTO inventory_ledger (inventory_ledger_id, shop_id, item_id, transaction_type, quantity, unit_cost, reference_id, dot_number, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [inventory_ledger_id, shop_id, item_id, "ADJUSTMENT", parseInt(quantity), 0, reference_id || null, dot_number || null, created_by || "SYSTEM"],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      res.json({ inventory_ledger_id, shop_id, item_id, transaction_type: "ADJUSTMENT", quantity: parseInt(quantity), reference_id, created_by, created_at: new Date().toISOString() });
    },
  );
});

router.get("/inventory-ledger/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  const { item_id, page, perPage } = req.query;
  const paginated = page !== undefined || perPage !== undefined;

  const selectCols = `il.inventory_ledger_id, il.shop_id, il.item_id, im.item_name, im.sku,
      im.dot_number, im.parent_item_id,
      il.transaction_type, il.quantity, il.unit_cost, il.reference_id, il.supplier_id,
      il.dot_number as ledger_dot_number, sm.supplier_name, il.created_at, il.created_by`;
  const fromJoin = `FROM inventory_ledger il
    JOIN item_master im ON il.item_id = im.item_id
    LEFT JOIN supplier_master sm ON il.supplier_id = sm.supplier_id
    WHERE il.shop_id = ?`;
  const params = [shop_id];
  let whereExtra = '';
  if (item_id) {
    whereExtra += ` AND il.item_id = ?`;
    params.push(item_id);
  }
  const orderBy = ` ORDER BY il.created_at DESC`;

  if (!paginated) {
    db.all(`SELECT ${selectCols} ${fromJoin}${whereExtra}${orderBy}`, params, (err, rows) => {
      if (err) return res.json({ error: err.message });
      res.json(rows || []);
    });
    return;
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedPerPage = Math.min(200, Math.max(1, parseInt(perPage, 10) || 50));
  const offset = (parsedPage - 1) * parsedPerPage;

  const countSql = `SELECT COUNT(*) as total FROM inventory_ledger il WHERE il.shop_id = ?${item_id ? ' AND il.item_id = ?' : ''}`;
  db.get(countSql, params, (cErr, cRow) => {
    if (cErr) return res.status(500).json({ error: cErr.message });
    const total = cRow?.total || 0;
    const totalPages = Math.ceil(total / parsedPerPage);
    const dataSql = `SELECT ${selectCols} ${fromJoin}${whereExtra}${orderBy} LIMIT ? OFFSET ?`;
    db.all(dataSql, [...params, parsedPerPage, offset], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        data: rows || [],
        meta: { page: parsedPage, perPage: parsedPerPage, total, totalCount: total, totalPages },
      });
    });
  });
});

router.get("/current-stock/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  db.all(
    `SELECT cs.shop_id, cs.item_id, im.sku, im.item_name, im.category,
      im.dot_number, im.parent_item_id,
      cs.current_quantity, im.unit_cost, im.selling_price,
      (im.selling_price - im.unit_cost) as profit_per_unit,
      cs.current_quantity * (im.selling_price - im.unit_cost) as total_profit_potential,
      cs.last_updated
    FROM current_stock cs
    JOIN item_master im ON cs.item_id = im.item_id
    WHERE cs.shop_id = ?
    ORDER BY im.item_name, im.dot_number ASC`,
    [shop_id],
    (err, rows) => {
      if (err) return res.json({ error: err.message });
      res.json(rows || []);
    },
  );
});

// GET archived items
router.get("/items-archived/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  db.all(
    `SELECT im.item_id, im.sku, im.item_name, im.category, im.brand, im.design,
      im.size, im.rim_size, im.unit_cost, im.selling_price, im.is_active,
      im.supplier_id, im.dot_number, im.parent_item_id, sm.supplier_name,
      COALESCE(cs.current_quantity, 0) as current_quantity
    FROM item_master im
    LEFT JOIN current_stock cs ON im.item_id = cs.item_id AND cs.shop_id = ?
    LEFT JOIN supplier_master sm ON im.supplier_id = sm.supplier_id
    WHERE im.is_active = 0
    ORDER BY im.item_name`,
    [shop_id],
    (err, rows) => {
      if (err) return res.json({ error: err.message });
      res.json(rows || []);
    }
  );
});

// Archive (deactivate) an item
router.put("/items/:item_id/archive", (req, res) => {
  const { item_id } = req.params;
  db.run(`UPDATE item_master SET is_active = 0 WHERE item_id = ?`, [item_id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ item_id, is_active: 0, message: "Item archived" });
  });
});

// Restore (reactivate) an item
router.put("/items/:item_id/restore", (req, res) => {
  const { item_id } = req.params;
  db.run(`UPDATE item_master SET is_active = 1 WHERE item_id = ?`, [item_id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ item_id, is_active: 1, message: "Item restored" });
  });
});

// ── Inventory KPI aggregation (single round-trip) ────────────────────────────
router.get("/items-kpi/:shop_id", async (req, res) => {
  const { shop_id } = req.params;
  const { category } = req.query;
  const params = [shop_id];
  let categoryClause = '';
  if (category) { categoryClause = ' AND im.category = ?'; params.push(category); }
  try {
    const row = await dbGet(
      `SELECT
         COUNT(DISTINCT im.item_id) AS totalItems,
         COALESCE(SUM(cs.current_quantity), 0) AS totalStockUnits,
         COALESCE(SUM(cs.current_quantity * im.unit_cost), 0) AS stockValueCost,
         COALESCE(SUM(cs.current_quantity * im.selling_price), 0) AS stockValueRetail,
         COALESCE(SUM(CASE
             WHEN COALESCE(cs.current_quantity, 0) > 0
              AND COALESCE(cs.current_quantity, 0) <= COALESCE(im.reorder_point, 5)
             THEN 1 ELSE 0 END), 0) AS lowStockCount,
         COALESCE(SUM(CASE WHEN im.category IN ('TIRE','PCR','SUV','TBR','LT','MOTORCYCLE','TUBE','RECAP') OR im.sku LIKE 'TIRE-%' THEN 1 ELSE 0 END), 0) AS tireItems,
         COALESCE(SUM(CASE WHEN NOT (im.category IN ('TIRE','PCR','SUV','TBR','LT','MOTORCYCLE','TUBE','RECAP') OR im.sku LIKE 'TIRE-%') THEN 1 ELSE 0 END), 0) AS otherItems,
         COALESCE(AVG(CASE WHEN im.unit_cost > 0 AND im.selling_price > 0 THEN ((im.selling_price - im.unit_cost) / im.selling_price) * 100 ELSE NULL END), 0) AS avgMargin
       FROM item_master im
       LEFT JOIN current_stock cs ON cs.item_id = im.item_id AND cs.shop_id = ?
       WHERE im.is_active = 1${categoryClause}`,
      params
    );
    res.json(row || { totalItems: 0, totalStockUnits: 0, stockValueCost: 0, stockValueRetail: 0, lowStockCount: 0, tireItems: 0, otherItems: 0, avgMargin: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POS item picker with server-side DOT grouping ────────────────────────────
router.get("/pos-items/:shop_id", async (req, res) => {
  const { shop_id } = req.params;
  const { q, category, page, perPage, inStockOnly } = req.query;
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedPerPage = Math.min(200, Math.max(1, parseInt(perPage, 10) || 50));
  const offset = (parsedPage - 1) * parsedPerPage;
  const stockOnly = inStockOnly === undefined ? true : (inStockOnly === 'true' || inStockOnly === true);

  const filterParams = [shop_id];
  let filters = 'im.is_active = 1';
  if (category && category !== 'All') { filters += ' AND im.category = ?'; filterParams.push(category); }
  if (q && q.trim()) {
    filters += ' AND (im.sku LIKE ? OR im.item_name LIKE ? OR im.brand LIKE ? OR im.size LIKE ? OR im.design LIKE ?)';
    const like = `%${q.trim()}%`;
    filterParams.push(like, like, like, like, like);
  }

  const stockCte = `WITH stock AS (
    SELECT im.item_id, im.sku, im.item_name, im.category, im.brand, im.design, im.size,
           im.unit_cost, im.selling_price, im.dot_number, im.parent_item_id,
           COALESCE(cs.current_quantity, 0) AS qty
      FROM item_master im
      LEFT JOIN current_stock cs ON cs.item_id = im.item_id AND cs.shop_id = ?
     WHERE ${filters}
  ),
  grouped AS (
    SELECT
      CASE WHEN brand IS NOT NULL AND dot_number IS NOT NULL
           THEN brand || '||' || COALESCE(design,'') || '||' || COALESCE(size,'')
           ELSE item_id END AS group_key,
      MAX(brand) AS brand, MAX(design) AS design, MAX(size) AS size,
      MAX(category) AS category,
      MIN(item_id) AS representative_item_id,
      AVG(unit_cost) AS unit_cost, AVG(selling_price) AS selling_price,
      SUM(qty) AS total_quantity
    FROM stock
    GROUP BY group_key
    ${stockOnly ? 'HAVING SUM(qty) > 0' : ''}
  )`;

  try {
    const countRow = await dbGet(`${stockCte} SELECT COUNT(*) AS total FROM grouped`, filterParams);
    const total = countRow?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / parsedPerPage));

    const groups = await dbAll(
      `${stockCte}
       SELECT * FROM grouped
       ORDER BY brand, design, size, group_key
       LIMIT ? OFFSET ?`,
      [...filterParams, parsedPerPage, offset]
    );

    if (groups.length === 0) {
      return res.json({ data: [], meta: { page: parsedPage, perPage: parsedPerPage, total, totalCount: total, totalPages } });
    }

    const keys = groups.map(g => g.group_key);
    const placeholders = keys.map(() => '?').join(',');
    const variants = await dbAll(
      `${stockCte}
       SELECT item_id, dot_number, qty AS current_quantity, unit_cost, selling_price, sku, item_name,
              category, brand, design, size,
              CASE WHEN brand IS NOT NULL AND dot_number IS NOT NULL
                   THEN brand || '||' || COALESCE(design,'') || '||' || COALESCE(size,'')
                   ELSE item_id END AS group_key
         FROM stock        WHERE CASE WHEN brand IS NOT NULL AND dot_number IS NOT NULL
                   THEN brand || '||' || COALESCE(design,'') || '||' || COALESCE(size,'')
                   ELSE item_id END IN (${placeholders})
        ORDER BY CASE WHEN dot_number IS NULL THEN 1 ELSE 0 END, dot_number ASC`,
      [...filterParams, ...keys]
    );

    const variantsByKey = new Map();
    for (const v of variants) {
      if (!variantsByKey.has(v.group_key)) variantsByKey.set(v.group_key, []);
      variantsByKey.get(v.group_key).push(v);
    }
    const data = groups.map(g => {
      const vs = variantsByKey.get(g.group_key) || [];
      const isMulti = vs.length > 1 || (vs[0] && vs[0].dot_number);
      return { ...g, variants: isMulti ? vs : null };
    });

    res.json({ data, meta: { page: parsedPage, perPage: parsedPerPage, total, totalCount: total, totalPages } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET unique categories
router.get("/item-categories/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  db.all(
    `SELECT DISTINCT category FROM item_master WHERE is_active = 1 AND category IS NOT NULL ORDER BY category ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(r => r.category));
    }
  );
});

// GET unique sizes
router.get("/item-sizes/:shop_id", (req, res) => {
  db.all(
    `SELECT DISTINCT size FROM item_master WHERE is_active = 1 AND size IS NOT NULL AND size != '' ORDER BY size ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(r => r.size));
    }
  );
});

// GET unique brands
router.get("/item-brands/:shop_id", (req, res) => {
  db.all(
    `SELECT DISTINCT brand FROM item_master WHERE is_active = 1 AND brand IS NOT NULL AND brand != '' ORDER BY brand ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(r => r.brand));
    }
  );
});

// GET unique designs
router.get("/item-designs/:shop_id", (req, res) => {
  db.all(
    `SELECT DISTINCT design, brand, category FROM item_master WHERE is_active = 1 AND design IS NOT NULL AND design != '' ORDER BY brand, design ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});


module.exports = router;
module.exports.logPriceHistory = logPriceHistory;
