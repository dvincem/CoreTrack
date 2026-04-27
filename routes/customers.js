const express = require("express");
const router = express.Router();
const { db } = require("../Database");
const { v4: uuidv4 } = require("uuid");

router.get("/customers-kpi/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  db.get(`
    SELECT
      COUNT(*) AS totalCustomers,
      COUNT(CASE WHEN company IS NOT NULL AND company != '' THEN 1 END) AS companies,
      COUNT(CASE WHEN strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now') THEN 1 END) AS newThisMonth
    FROM customer_master WHERE shop_id = ?`, [shop_id],
    (err, row) => {
      if (err) return res.json({ error: err.message });
      db.get(`SELECT COUNT(DISTINCT customer_id) AS withVehicles FROM vehicle_plates vp
              INNER JOIN customer_master cm ON vp.customer_id = cm.customer_id WHERE cm.shop_id = ?`, [shop_id],
        (err2, vRow) => res.json(err2 ? { error: err2.message } : { ...row, withVehicles: vRow?.withVehicles || 0 }));
    });
});

router.get("/customers/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  const { q, filter, page, perPage } = req.query;
  const paginated = page !== undefined || perPage !== undefined || q !== undefined;

  const whereParts = [`cm.shop_id = ?`];
  const params = [shop_id];
  if (filter === 'With Plates') {
    whereParts.push(`EXISTS (SELECT 1 FROM vehicle_plates vp WHERE vp.customer_id = cm.customer_id)`);
  } else if (filter === 'Companies') {
    whereParts.push(`(cm.company IS NOT NULL AND cm.company != '')`);
  }
  if (q && String(q).trim()) {
    const needle = `%${String(q).trim()}%`;
    whereParts.push(`(cm.customer_name LIKE ? OR cm.contact_number LIKE ? OR cm.company LIKE ? OR cm.customer_code LIKE ?)`);
    params.push(needle, needle, needle, needle);
  }
  const whereSql = `WHERE ${whereParts.join(" AND ")}`;
  const baseSql = `SELECT cm.customer_id, cm.customer_code, cm.customer_name, cm.company,
    cm.contact_number, cm.address, cm.created_at, cm.updated_at
    FROM customer_master cm ${whereSql} ORDER BY cm.created_at DESC`;

  const hydrateCustomers = (customers, cb) => {
    if (!customers || customers.length === 0) return cb(null, []);
    let pending = customers.length;
    customers.forEach(customer => {
      db.all(`SELECT * FROM vehicle_plates WHERE customer_id = ? ORDER BY created_at DESC`,
        [customer.customer_id],
        (err, plates) => {
          customer.vehicle_plates = plates || [];
          if (--pending === 0) cb(null, customers);
        });
    });
  };

  if (!paginated) {
    db.all(baseSql, params, (err, rows) => {
      if (err) return res.json({ error: err.message });
      hydrateCustomers(rows, (_e, hydrated) => res.json(hydrated));
    });
    return;
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedPerPage = Math.min(200, Math.max(1, parseInt(perPage, 10) || 20));
  const offset = (parsedPage - 1) * parsedPerPage;

  db.get(`SELECT COUNT(*) as total FROM customer_master cm ${whereSql}`, params, (errC, row) => {
    if (errC) return res.json({ error: errC.message });
    const total = row?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / parsedPerPage));
    db.all(`${baseSql} LIMIT ? OFFSET ?`, [...params, parsedPerPage, offset], (err, rows) => {
      if (err) return res.json({ error: err.message });
      hydrateCustomers(rows, (_e, hydrated) => {
        res.json({ data: hydrated, meta: { page: parsedPage, perPage: parsedPerPage, total, totalCount: total, totalPages } });
      });
    });
  });
});

router.get("/customers/:shop_id/:customer_id", (req, res) => {
  const { shop_id, customer_id } = req.params;
  db.get(`SELECT * FROM customer_master WHERE shop_id = ? AND customer_id = ?`, [shop_id, customer_id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Customer not found" });
    res.json(row);
  });
});

router.post("/customers", (req, res) => {
  const { shop_id, customer_name, company, contact_number, address } = req.body;
  if (!shop_id || !customer_name) {
    return res.status(400).json({ error: "shop_id and customer_name are required" });
  }
  try {
    const namePrefix = customer_name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, "");
    const timestamp = Date.now().toString().slice(-6);
    const customer_code = `CUST-${namePrefix}-${timestamp}`;
    const customer_id = `CUST-${uuidv4()}`;
    db.run(
      `INSERT INTO customer_master (customer_id, shop_id, customer_code, customer_name, company, contact_number, address, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [customer_id, shop_id, customer_code, customer_name, company || null, contact_number || null, address || null],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ customer_id, customer_code, customer_name, message: "Customer created successfully" });
      },
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/customers/:customer_id", (req, res) => {
  const { customer_id } = req.params;
  const { customer_name, company, contact_number, address } = req.body;
  if (!customer_name) return res.status(400).json({ error: "customer_name is required" });
  db.run(
    `UPDATE customer_master SET customer_name = ?, company = ?, contact_number = ?, address = ?, updated_at = CURRENT_TIMESTAMP WHERE customer_id = ?`,
    [customer_name, company || null, contact_number || null, address || null, customer_id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Customer not found" });
      res.json({ message: "Customer updated successfully" });
    },
  );
});

router.delete("/customers/:customer_id", (req, res) => {
  const { customer_id } = req.params;
  db.run(`DELETE FROM customer_master WHERE customer_id = ?`, [customer_id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Customer not found" });
    res.json({ message: "Customer deleted successfully" });
  });
});

router.get("/vehicle-plates/:customer_id", (req, res) => {
  const { customer_id } = req.params;
  db.all(`SELECT * FROM vehicle_plates WHERE customer_id = ? ORDER BY created_at DESC`, [customer_id], (err, rows) => {
    res.json(err ? { error: err.message } : rows || []);
  });
});

router.post("/vehicle-plates", (req, res) => {
  const { customer_id, plate_number } = req.body;
  if (!customer_id || !plate_number) {
    return res.status(400).json({ error: "customer_id and plate_number are required" });
  }
  try {
    const plate_id = `PLATE-${uuidv4()}`;
    db.run(
      `INSERT INTO vehicle_plates (plate_id, customer_id, plate_number, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [plate_id, customer_id, plate_number.toUpperCase()],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE")) return res.status(400).json({ error: "This plate already exists for this customer" });
          return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ plate_id, customer_id, plate_number: plate_number.toUpperCase(), message: "Vehicle plate added successfully" });
      },
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/vehicle-plates/:plate_id", (req, res) => {
  const { plate_id } = req.params;
  db.run(`DELETE FROM vehicle_plates WHERE plate_id = ?`, [plate_id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Plate not found" });
    res.json({ message: "Vehicle plate deleted successfully" });
  });
});

module.exports = router;
