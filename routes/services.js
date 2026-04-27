const express = require("express");
const router = express.Router();
const { db } = require("../Database");
const { v4: uuidv4 } = require("uuid");

router.get("/services", (req, res) => {
  db.all("SELECT * FROM services_master WHERE is_active = 1 ORDER BY service_name", (err, rows) => {
    res.json(err ? { error: err.message } : rows);
  });
});

router.post("/services", (req, res) => {
  const { service_name, service_code, base_price, commission_rate, is_commissionable } = req.body;
  if (!service_name || !service_name.trim()) {
    return res.status(400).json({ error: "service_name is required" });
  }
  if (base_price === undefined || base_price === null || isNaN(parseFloat(base_price))) {
    return res.status(400).json({ error: "base_price is required and must be a number" });
  }
  const service_id = `SVC-${uuidv4()}`;
  const namePrefix = service_name.trim().substring(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const auto_code = service_code && service_code.trim()
    ? service_code.trim()
    : `SVC-${namePrefix}-${Date.now().toString().slice(-4)}`;
  db.run(
    `INSERT INTO services_master (service_id, service_code, service_name, base_price, commission_rate, is_commissionable, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
    [service_id, auto_code, service_name.trim(), parseFloat(base_price), parseFloat(commission_rate) || 0, is_commissionable !== undefined ? (is_commissionable ? 1 : 0) : 1],
    function (err) {
      if (err) {
        if (err.message.includes("UNIQUE")) {
          return res.status(400).json({ error: "A service with this code already exists" });
        }
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ service_id, service_code: auto_code, service_name: service_name.trim(), base_price: parseFloat(base_price), is_commissionable: is_commissionable ? 1 : 0, is_active: 1, message: "Service created successfully" });
    },
  );
});

router.put("/services/:service_id", (req, res) => {
  const { service_id } = req.params;
  const { service_name, base_price, commission_rate, is_commissionable } = req.body;
  if (!service_name || !service_name.trim()) {
    return res.status(400).json({ error: "service_name is required" });
  }
  if (base_price === undefined || base_price === null || isNaN(parseFloat(base_price))) {
    return res.status(400).json({ error: "base_price is required and must be a number" });
  }
  db.run(
    `UPDATE services_master SET service_name = ?, base_price = ?, commission_rate = ?, is_commissionable = ? WHERE service_id = ? AND is_active = 1`,
    [service_name.trim(), parseFloat(base_price), parseFloat(commission_rate) || 0, is_commissionable !== undefined ? (is_commissionable ? 1 : 0) : 1, service_id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(422).json({ error: "Service not found" });
      res.json({ service_id, message: "Service updated successfully" });
    },
  );
});

router.delete("/services/:service_id", (req, res) => {
  const { service_id } = req.params;
  db.run(`UPDATE services_master SET is_active = 0 WHERE service_id = ?`, [service_id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(422).json({ error: "Service not found" });
    res.json({ service_id, message: "Service deactivated successfully" });
  });
});

module.exports = router;
