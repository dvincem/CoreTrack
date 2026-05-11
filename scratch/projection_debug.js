const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('tire_shop.db');

const today    = new Date().toISOString().split('T')[0];
const hist30   = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

console.log('Today:', today);
console.log('30-day window start:', hist30);
console.log('');

db.get('SELECT shop_id FROM shop_master LIMIT 1', [], (err, shop) => {
  const shopId = shop.shop_id;
  console.log('Shop:', shopId);

  // 1) Day-by-day breakdown in the 30d window
  db.all(`
    SELECT DATE(sh.sale_datetime) as sale_date,
           SUM(sh.total_amount)   as day_total_all,
           COUNT(*)               as tx_count
    FROM sale_header sh
    WHERE sh.shop_id = ? AND sh.is_void = 0
      AND DATE(sh.sale_datetime) BETWEEN ? AND ?
    GROUP BY DATE(sh.sale_datetime)
    ORDER BY sale_date
  `, [shopId, hist30, today], (err, rows) => {
    let grandTotal = 0;
    console.log('Days with sales in 30d window:');
    rows.forEach(r => {
      console.log(`  ${r.sale_date}  total: ${Number(r.day_total_all).toFixed(0).padStart(8)}  txns: ${r.tx_count}`);
      grandTotal += r.day_total_all || 0;
    });
    console.log(`\nActive sale days: ${rows.length} / 30`);
    console.log(`Grand total (all sales incl services): ${grandTotal.toFixed(0)}`);
    console.log(`  Avg/day over 30d calendar: ${(grandTotal/30).toFixed(0)}`);
    console.log(`  Avg/day over active days only: ${rows.length ? (grandTotal/rows.length).toFixed(0) : 'N/A'}`);

    // 2) Product-only revenue (what projection uses)
    db.get(`
      SELECT SUM(si.line_total) as product_rev,
             COUNT(DISTINCT si.sale_id) as tx_count
      FROM sale_items si
      JOIN sale_header sh ON si.sale_id = sh.sale_id
      WHERE sh.shop_id = ? AND sh.is_void = 0
        AND si.sale_type = 'PRODUCT'
        AND (si.is_custom IS NULL OR si.is_custom = 0)
        AND DATE(sh.sale_datetime) BETWEEN ? AND ?
    `, [shopId, hist30, today], (e, r) => {
      const prodRev = r.product_rev || 0;
      console.log(`\nProduct-only revenue in 30d: ${prodRev.toFixed(0)}`);
      console.log(`Avg daily product rev / 30 calendar days: ${(prodRev/30).toFixed(0)}`);
      console.log(`Projected 30d forward (projection shows): ${prodRev.toFixed(0)}`);

      // 3) What the profits page shows for the overlap period (May 1-9)
      db.get(`
        SELECT SUM(sh.total_amount) as total_all
        FROM sale_header sh
        WHERE sh.shop_id = ? AND sh.is_void = 0
          AND DATE(sh.sale_datetime) BETWEEN '2026-05-01' AND '2026-05-09'
      `, [shopId], (e2, r2) => {
        console.log(`\nProfits page May 1-9 total (all): ${Number(r2.total_all||0).toFixed(0)}`);

        db.get(`
          SELECT SUM(si.line_total) as product_rev
          FROM sale_items si
          JOIN sale_header sh ON si.sale_id = sh.sale_id
          WHERE sh.shop_id = ? AND sh.is_void = 0
            AND si.sale_type = 'PRODUCT'
            AND DATE(sh.sale_datetime) BETWEEN '2026-05-01' AND '2026-05-09'
        `, [shopId], (e3, r3) => {
          const may19Prod = r3.product_rev || 0;
          console.log(`Profits page May 1-9 product-only: ${may19Prod.toFixed(0)}`);
          console.log(`\n--- DIAGNOSIS ---`);
          console.log(`Projection avg daily = ${(prodRev/30).toFixed(0)} because it spreads ${prodRev.toFixed(0)} over 30 calendar days`);
          console.log(`Profits page shows ${rows.filter(r=>r.sale_date>='2026-05-01').length} sale days in May, concentrated revenue`);
          console.log(`If the 30d window has ${rows.length} active days but divides by 30, the avg is diluted by ${30 - rows.length} zero-sale days`);
          db.close();
        });
      });
    });
  });
});
