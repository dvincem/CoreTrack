const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('tire_shop.db');

db.get('SELECT shop_id FROM sale_header LIMIT 1', (err, row) => {
  const shop_id = row.shop_id;
  console.log("Using shop_id:", shop_id);

  let where = `WHERE sh.shop_id = ? AND sh.is_void = 0 AND si.sale_type IN ('PRODUCT', 'RECAP')`;
  const params = [shop_id];

  where += ` AND sh.business_date BETWEEN ? AND ?`;
  params.push('2026-05-10', '2026-05-10');

  const baseSelect = `
    SELECT 
      si.sale_item_id, si.item_name, si.brand, si.design, si.tire_size, si.category,
      si.quantity, si.unit_price, si.line_total, si.sale_type,
      sh.sale_id, sh.invoice_number, sh.sale_datetime, sh.business_date,
      cm.customer_name
    FROM sale_items si
    JOIN sale_header sh ON si.sale_id = sh.sale_id
    LEFT JOIN customer_master cm ON sh.customer_id = cm.customer_id
    ${where}
  `;

  const statsSql = `SELECT COUNT(*) AS total, COALESCE(SUM(quantity), 0) AS totalUnits, COALESCE(SUM(line_total), 0) AS totalRevenue, COUNT(DISTINCT brand) AS uniqueBrands FROM (${baseSelect}) grouped`;
  db.get(statsSql, params, (sErr, sRow) => {
    if (sErr) console.error("STATS ERROR:", sErr);
    console.log("STATS:", sRow);

    const pageSql = `${baseSelect} ORDER BY sh.sale_datetime DESC LIMIT ? OFFSET ?`;
    db.all(pageSql, [...params, 20, 0], (err, rows) => {
      if (err) console.error("PAGE ERROR:", err);
      console.log("PAGE ROWS:", rows?.length);
    });
  });
});
