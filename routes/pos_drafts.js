const express = require("express");
const router = express.Router();
const { dbAll, dbGet, dbRun } = require("../lib/db");
const { v4: uuidv4 } = require("uuid");

// Get all drafts for a shop
router.get("/:shop_id", async (req, res) => {
  const { shop_id } = req.params;
  try {
    const drafts = await dbAll(
      `SELECT * FROM pos_drafts WHERE shop_id = ? ORDER BY created_at DESC`,
      [shop_id]
    );
    res.json(drafts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save a new draft or update existing
router.post("/:shop_id", async (req, res) => {
  const { shop_id } = req.params;
  const {
    draft_id,
    draft_name,
    cart_data,
    customer_id,
    sale_notes,
    invoice_number,
    tireman_ids,
    payment_splits,
    split_mode,
    created_by
  } = req.body;

  if (!cart_data) {
    return res.status(400).json({ error: "cart_data is required" });
  }

  const id = draft_id || `DRAFT-${uuidv4()}`;
  const now = new Date().toISOString();

  try {
    const existing = await dbGet(`SELECT draft_id FROM pos_drafts WHERE draft_id = ?`, [id]);
    
    if (existing) {
      await dbRun(
        `UPDATE pos_drafts SET 
          draft_name = ?, 
          cart_data = ?, 
          customer_id = ?, 
          sale_notes = ?, 
          invoice_number = ?, 
          tireman_ids = ?, 
          payment_splits = ?,
          split_mode = ?
         WHERE draft_id = ?`,
        [
          draft_name,
          JSON.stringify(cart_data),
          customer_id || null,
          sale_notes || null,
          invoice_number || null,
          tireman_ids ? JSON.stringify(tireman_ids) : null,
          payment_splits ? JSON.stringify(payment_splits) : null,
          split_mode ? 1 : 0,
          id
        ]
      );
    } else {
      await dbRun(
        `INSERT INTO pos_drafts (
          draft_id, shop_id, draft_name, cart_data, customer_id, 
          sale_notes, invoice_number, tireman_ids, payment_splits, split_mode, 
          created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          shop_id,
          draft_name,
          JSON.stringify(cart_data),
          customer_id || null,
          sale_notes || null,
          invoice_number || null,
          tireman_ids ? JSON.stringify(tireman_ids) : null,
          payment_splits ? JSON.stringify(payment_splits) : null,
          split_mode ? 1 : 0,
          created_by || "POS",
          now
        ]
      );
    }
    res.json({ draft_id: id, status: "success" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a draft
router.delete("/:shop_id/:draft_id", async (req, res) => {
  const { draft_id } = req.params;
  try {
    await dbRun(`DELETE FROM pos_drafts WHERE draft_id = ?`, [draft_id]);
    res.json({ status: "success" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
