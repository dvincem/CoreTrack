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


// --- Commission Rules ---
const DEFAULT_RULES = [
  { id: 'CR-PCR', category: 'PCR', valve_type: null, amount: 60 },
  { id: 'CR-MOTORCYCLE', category: 'MOTORCYCLE', valve_type: null, amount: 60 },
  { id: 'CR-SUV', category: 'SUV', valve_type: null, amount: 100 },
  { id: 'CR-LT', category: 'LT', valve_type: null, amount: 100 },
  { id: 'CR-LTB', category: 'LTB', valve_type: null, amount: 150 },
  { id: 'CR-TBR', category: 'TBR', valve_type: null, amount: 100 },
  { id: 'CR-TRUCK', category: 'TRUCK', valve_type: null, amount: 100 },
  { id: 'CR-RECAP', category: 'RECAP', valve_type: null, amount: 70 },
  { id: 'CR-TIRE', category: 'TIRE', valve_type: null, amount: 60 },
  { id: 'CR-VALVE-RUBBER', category: 'VALVE', valve_type: 'RUBBER', amount: 40 },
  { id: 'CR-VALVE-STEEL', category: 'VALVE', valve_type: 'STEEL', amount: 50 },
  { id: 'CR-SEALANT', category: 'SEALANT', valve_type: null, amount: 400 }
];

router.get("/commission-rules", (req, res) => {
  db.all("SELECT * FROM commission_rules WHERE is_active = 1", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Auto-seed if empty
    if (!rows || rows.length === 0) {
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmt = db.prepare(
          `INSERT INTO commission_rules (rule_id, category, valve_type, commission_amount, is_active) VALUES (?, ?, ?, ?, 1)`
        );
        DEFAULT_RULES.forEach(r => {
          stmt.run([r.id, r.category, r.valve_type, r.amount]);
        });
        stmt.finalize();
        db.run("COMMIT", (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });
          db.all("SELECT * FROM commission_rules WHERE is_active = 1", (err3, newRows) => {
            res.json(err3 ? { error: err3.message } : newRows);
          });
        });
      });
    } else {
      res.json(rows);
    }
  });
});

router.put("/commission-rules/:rule_id", (req, res) => {
  const { rule_id } = req.params;
  const { commission_amount } = req.body;
  if (commission_amount === undefined || isNaN(parseFloat(commission_amount))) {
    return res.status(400).json({ error: "Valid commission_amount is required" });
  }
  db.run(
    "UPDATE commission_rules SET commission_amount = ? WHERE rule_id = ?",
    [parseFloat(commission_amount), rule_id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Rule not found" });
      res.json({ message: "Rule updated successfully" });
    }
  );
});

module.exports = router;
