const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('tire_shop.db');
const today = '2026-05-09';
const histStart = '2026-04-09';
const shopId = 'SHOP-A69B56E8';

const sql = `
  WITH trading_days AS (
    SELECT COUNT(DISTINCT DATE(sh.sale_datetime)) AS n
    FROM sale_header sh
    WHERE sh.shop_id = ?
      AND sh.is_void = 0
      AND DATE(sh.sale_datetime) BETWEEN ? AND ?
  )
  SELECT
    im.brand, im.design, im.size,
    SUM(si.line_total) AS total_revenue,
    CAST(SUM(si.line_total) AS REAL) / MAX((SELECT MAX(n,1) FROM trading_days)) AS avg_daily_revenue,
    (SELECT n FROM trading_days) AS trading_days_used
  FROM sale_items si
  JOIN sale_header sh ON si.sale_id = sh.sale_id
  JOIN item_master im ON si.item_or_service_id = im.item_id
  WHERE sh.shop_id = ?
    AND sh.is_void = 0
    AND si.sale_type = 'PRODUCT'
    AND (si.is_custom IS NULL OR si.is_custom = 0)
    AND DATE(sh.sale_datetime) BETWEEN ? AND ?
  GROUP BY im.brand, im.design, im.size
  ORDER BY total_revenue DESC
  LIMIT 5
`;

db.all(sql, [shopId, histStart, today, shopId, histStart, today], (err, rows) => {
  if (err) { console.error('SQL ERROR:', err.message); db.close(); return; }

  const totalRev   = rows.reduce((s, r) => s + (r.total_revenue || 0), 0);
  const totalDaily = rows.reduce((s, r) => s + (r.avg_daily_revenue || 0), 0);

  console.log('Trading days used as denominator:', rows[0]?.trading_days_used, '(was 30 before fix)');
  console.log('\nTop 5 items by product revenue:');
  rows.forEach(r => {
    console.log(`  ${(r.brand+' '+r.design+' '+r.size).padEnd(35)}  rev: ${Number(r.total_revenue).toFixed(0).padStart(8)}  avg_daily: ${Number(r.avg_daily_revenue).toFixed(0).padStart(7)}`);
  });

  // Get all items total for full projection
  const allSql = `
    WITH trading_days AS (
      SELECT COUNT(DISTINCT DATE(sh.sale_datetime)) AS n
      FROM sale_header sh
      WHERE sh.shop_id = ? AND sh.is_void = 0
        AND DATE(sh.sale_datetime) BETWEEN ? AND ?
    )
    SELECT
      SUM(si.line_total) AS total_product_rev,
      CAST(SUM(si.line_total) AS REAL) / MAX((SELECT MAX(n,1) FROM trading_days)) AS total_avg_daily
    FROM sale_items si
    JOIN sale_header sh ON si.sale_id = sh.sale_id
    WHERE sh.shop_id = ? AND sh.is_void = 0
      AND si.sale_type = 'PRODUCT'
      AND (si.is_custom IS NULL OR si.is_custom = 0)
      AND DATE(sh.sale_datetime) BETWEEN ? AND ?
  `;

  db.get(allSql, [shopId, histStart, today, shopId, histStart, today], (e, r) => {
    if (e) { console.error(e); db.close(); return; }
    const avgDaily = r.total_avg_daily || 0;
    const projected30 = avgDaily * 30;

    console.log('\n--- BEFORE FIX ---');
    console.log(`  Denominator: 30 calendar days`);
    console.log(`  Avg daily (product): ₱${(r.total_product_rev/30).toFixed(0)}`);
    console.log(`  Projected 30d: ₱${(r.total_product_rev).toFixed(0)}  (=historical, not a real forecast)`);

    console.log('\n--- AFTER FIX ---');
    console.log(`  Denominator: ${rows[0]?.trading_days_used} actual trading days`);
    console.log(`  Avg daily (product): ₱${avgDaily.toFixed(0)}`);
    console.log(`  Projected 30d: ₱${projected30.toFixed(0)}`);

    console.log('\n--- PROFITS PAGE (all sales May 1-9) ---');
    console.log(`  Total (tires+labor): ₱268,564  (9 days, ₱29,840/day)`);
    console.log(`  Product only: ₱196,744  (9 days, ₱21,860/day)`);
    db.close();
  });
});
