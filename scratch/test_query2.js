const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('tire_shop.db');

const shop_id = 'SHOP-61c0d5e1-886d-476c-850f-e2d46e91cf8e'; // need to find the correct shop_id or ignore it for test
let where = `WHERE sh.is_void = 0 AND si.sale_type IN ('PRODUCT', 'RECAP')`;
const params = [];

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

db.all(baseSelect, params, (err, rows) => {
  console.log('Results with BETWEEN: ', rows?.length);
});

// Let's also check without BETWEEN
db.all(`SELECT count(*) as count FROM sale_header sh JOIN sale_items si ON si.sale_id = sh.sale_id WHERE sh.business_date = '2026-05-10' AND si.sale_type='PRODUCT'`, [], (err, rows) => {
  console.log('Results with EQUALS: ', rows);
});
