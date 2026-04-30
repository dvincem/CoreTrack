const express = require("express");
const router = express.Router();
const { db } = require("../Database");
const { v4: uuidv4 } = require("uuid");

router.get("/suppliers", (req, res) => {
  const { shop_id } = req.query;
  const where = shop_id ? "WHERE active_status = 1 AND (shop_id = ? OR shop_id IS NULL)" : "WHERE active_status = 1";
  const params = shop_id ? [shop_id] : [];
  db.all(`SELECT * FROM supplier_master ${where} ORDER BY supplier_name`, params, async (err, suppliers) => {
    if (err) return res.json({ error: err.message });
    const suppliersWithDetails = await Promise.all(
      (suppliers || []).map((supplier) =>
        new Promise((resolve) => {
          db.all(
            `SELECT * FROM supplier_brands WHERE supplier_id = ? ORDER BY brand_name`,
            [supplier.supplier_id],
            (err, brands) => resolve({ ...supplier, supplier_brands: brands || [] }),
          );
        }),
      ),
    );
    res.json(suppliersWithDetails);
  });
});

router.post("/suppliers", (req, res) => {
  const { supplier_name, contact_person, contact_number, email_address, address, default_payment_terms_days, shop_id } = req.body;
  if (!supplier_name || !supplier_name.trim()) {
    return res.status(400).json({ error: "Supplier name is required" });
  }
  try {
    const supplier_id = `SUPP-${uuidv4()}`;
    const namePrefix = supplier_name.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    const supplier_code = `SUPP-${namePrefix}-${timestamp}`;
    db.run(
      `INSERT INTO supplier_master (supplier_id, shop_id, supplier_code, supplier_name, contact_person, contact_number, email_address, address, default_payment_terms_days, active_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
      [supplier_id, shop_id || null, supplier_code, supplier_name, contact_person || null, contact_number || null, email_address || null, address || null, default_payment_terms_days || 30],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ supplier_id, supplier_code, supplier_name, contact_person, contact_number, email_address, address, default_payment_terms_days, message: "Supplier added successfully" });
      },
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Lightweight supplier list for RecapPage dropdowns
router.get("/suppliers/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  db.all(
    `SELECT supplier_id, supplier_name FROM supplier_master WHERE active_status = 1 AND (shop_id = ? OR shop_id IS NULL) ORDER BY supplier_name`,
    [shop_id],
    (err, rows) => {
      if (err) return res.json({ error: err.message });
      res.json(rows || []);
    },
  );
});

router.put("/suppliers/:supplier_id", (req, res) => {
  const { supplier_id } = req.params;
  const { supplier_name, contact_person, contact_number, email_address, address, default_payment_terms_days } = req.body;
  if (!supplier_name || !supplier_name.trim()) return res.status(400).json({ error: "Supplier name is required" });
  db.run(
    `UPDATE supplier_master SET supplier_name=?, contact_person=?, contact_number=?, email_address=?, address=?, default_payment_terms_days=? WHERE supplier_id=?`,
    [supplier_name.trim(), contact_person||null, contact_number||null, email_address||null, address||null, parseInt(default_payment_terms_days)||30, supplier_id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Supplier not found" });
      res.json({ message: "Supplier updated" });
    }
  );
});

router.get("/supplier-inventory/:supplier_id", (req, res) => {
  const { supplier_id } = req.params;
  const { shop_id } = req.query;
  // Show all items ever received from this supplier via inventory_ledger PURCHASE entries
  const shopFilter = shop_id ? "AND il.shop_id = ?" : "";
  const params = shop_id ? [supplier_id, shop_id] : [supplier_id];
  db.all(
    `SELECT im.item_id, im.sku, im.item_name, im.brand, im.category, im.size,
            SUM(CASE WHEN il.transaction_type='PURCHASE' THEN il.quantity ELSE 0 END) AS total_received,
            MAX(il.unit_cost) AS unit_cost,
            im.selling_price,
            COALESCE(cs.current_quantity, 0) AS current_quantity
     FROM inventory_ledger il
     JOIN item_master im ON il.item_id = im.item_id
     LEFT JOIN current_stock cs ON cs.item_id = im.item_id ${shop_id ? "AND cs.shop_id = il.shop_id" : ""}
     WHERE il.supplier_id = ? ${shopFilter} AND im.is_active = 1
     GROUP BY im.item_id
     ORDER BY im.category, im.brand, im.item_name`,
    params,
    (err, rows) => res.json(err ? { error: err.message } : rows || [])
  );
});

router.get("/supplier-brands/:supplier_id", (req, res) => {
  const { supplier_id } = req.params;
  db.all(`SELECT * FROM supplier_brands WHERE supplier_id = ? ORDER BY brand_name`, [supplier_id], (err, rows) => {
    res.json(err ? { error: err.message } : rows || []);
  });
});

router.post("/supplier-brands", (req, res) => {
  const { supplier_id, brand_name, item_type, brand_origins } = req.body;
  if (!supplier_id || !brand_name || !item_type || !brand_origins) {
    return res.status(400).json({ error: "supplier_id, brand_name, item_type, and brand_origins are required" });
  }
  try {
    const brand_id = `BRAND-${uuidv4()}`;
    const cleanedOrigins = brand_origins.split(",").map((o) => o.trim()).filter((o) => o.length > 0).join(", ");
    if (!cleanedOrigins) return res.status(400).json({ error: "At least one valid origin is required" });
    db.run(
      `INSERT INTO supplier_brands (brand_id, supplier_id, brand_name, item_type, brand_origin, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [brand_id, supplier_id, brand_name.toUpperCase(), item_type, cleanedOrigins],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE")) return res.status(400).json({ error: "This brand-item type combination already exists for this supplier" });
          return res.status(500).json({ error: err.message });
        }
        // Auto-link inventory items matching this brand to the supplier
        db.run(
          `UPDATE item_master SET supplier_id = ? WHERE UPPER(brand) = UPPER(?) AND (supplier_id IS NULL OR supplier_id = '')`,
          [supplier_id, brand_name],
          () => {}
        );
        res.status(201).json({ brand_id, supplier_id, brand_name: brand_name.toUpperCase(), item_type, brand_origins: cleanedOrigins, message: "Brand added successfully" });
      },
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/supplier-brands/:brand_id", (req, res) => {
  const { brand_id } = req.params;
  db.run(`DELETE FROM supplier_brands WHERE brand_id = ?`, [brand_id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Brand not found" });
    res.json({ message: "Brand deleted successfully" });
  });
});

router.delete("/suppliers/:supplier_id", (req, res) => {
  const { supplier_id } = req.params;
  db.run(`UPDATE supplier_master SET active_status = 0 WHERE supplier_id = ?`, [supplier_id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Supplier not found" });
    res.json({ message: "Supplier deleted successfully" });
  });
});

module.exports = router;
