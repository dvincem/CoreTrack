const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { dbAll, dbGet, dbRun } = require('../lib/db');

// ── Storage Config ────────────────────────────────────────────────────────────
const LOGOS_DIR = path.join(__dirname, '..', 'public', 'uploads', 'logos');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(LOGOS_DIR)) fs.mkdirSync(LOGOS_DIR, { recursive: true });
    cb(null, LOGOS_DIR);
  },
  filename: (req, file, cb) => {
    // Sanitize brand name for filesystem safety.
    // Note: brand should be in req.body because we send it before 'logo' in FormData
    const brand = (req.body.brand || 'unknown').toUpperCase().replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const timestamp = Date.now();
    cb(null, `brand_${brand}_${timestamp}${ext}`);
  },});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|svg|webp/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase()) &&
               allowed.test(file.mimetype);
    ok ? cb(null, true) : cb(new Error('Only image files are allowed'));
  },
});

// ── GET /api/brands?shop_id=xxx ───────────────────────────────────────────────
// Returns all unique brands from item_master, merged with any saved logos
router.get('/brands', async (req, res) => {
  try {
    const { shop_id } = req.query;

    // Get distinct brands from inventory
    let brandsQuery = `SELECT DISTINCT brand FROM item_master WHERE brand IS NOT NULL AND brand != '' ORDER BY brand ASC`;
    const params = [];
    if (shop_id) {
      // Filter to brands in this shop's inventory via current_stock
      brandsQuery = `
        SELECT DISTINCT im.brand 
        FROM item_master im
        INNER JOIN current_stock cs ON im.item_id = cs.item_id AND cs.shop_id = ?
        WHERE im.brand IS NOT NULL AND im.brand != ''
        ORDER BY im.brand ASC
      `;
      params.push(shop_id);
    }

    const brandRows = await dbAll(brandsQuery, params);

    // Get all saved logos
    const logoRows = await dbAll(`SELECT brand_name, logo_url FROM brand_assets`);
    const logoMap = {};
    for (const row of logoRows) logoMap[row.brand_name] = row.logo_url;

    const result = brandRows.map(r => ({
      brandName: r.brand,
      logoUrl: logoMap[r.brand] || null,
    }));

    res.json(result);
  } catch (err) {
    console.error('GET /brands error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/brand-assets ─────────────────────────────────────────────────────
// Returns all brand_assets as a flat list (used by POS for logo map)
router.get('/brand-assets', async (req, res) => {
  try {
    const rows = await dbAll(`SELECT brand_name, logo_url FROM brand_assets`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/brands/upload-logo ──────────────────────────────────────────────
// Handles logo file upload and upserts brand_assets
router.post('/brands/upload-logo', upload.single('logo'), async (req, res) => {
  try {
    const brand = req.body.brand ? req.body.brand.toUpperCase() : null;
    if (!brand) return res.status(400).json({ error: 'Brand name is required' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const logoUrl = `/uploads/logos/${req.file.filename}`;

    // Remove any old file for this brand (different extension)
    try {
      const existing = await dbGet(`SELECT logo_url FROM brand_assets WHERE brand_name = ?`, [brand]);
      if (existing && existing.logo_url) {
        const oldPath = path.join(__dirname, '..', 'public', existing.logo_url);
        if (fs.existsSync(oldPath) && oldPath !== path.join(__dirname, '..', 'public', logoUrl)) {
          fs.unlinkSync(oldPath);
        }
      }
    } catch (_) {}

    await dbRun(
      `INSERT INTO brand_assets (brand_name, logo_url) VALUES (?, ?)
       ON CONFLICT(brand_name) DO UPDATE SET logo_url = excluded.logo_url`,
      [brand, logoUrl]
    );

    res.json({ brandName: brand, logoUrl });
  } catch (err) {
    console.error('POST /brands/upload-logo error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/brands/logo?brand=xxx ────────────────────────────────────────
// Removes a brand logo
router.delete('/brands/logo', async (req, res) => {
  try {
    const brand = req.query.brand ? req.query.brand.toUpperCase() : null;
    if (!brand) return res.status(400).json({ error: 'Brand name is required' });

    const existing = await dbGet(`SELECT logo_url FROM brand_assets WHERE brand_name = ?`, [brand]);
    if (existing && existing.logo_url) {
      const filePath = path.join(__dirname, '..', 'public', existing.logo_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await dbRun(`DELETE FROM brand_assets WHERE brand_name = ?`, [brand]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
