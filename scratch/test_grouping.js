const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('tire_shop.db');

const shop_id = 'SHOP-A69B56E8'; 
let where = `WHERE sh.is_void = 0 AND si.sale_type IN ('PRODUCT', 'RECAP')`;
const params = [];

where += ` AND sh.business_date BETWEEN ? AND ?`;
params.push('2026-05-10', '2026-05-10');

const baseSelect = `
  SELECT 
    MAX(si.sale_item_id) as sale_item_id, 
    GROUP_CONCAT(si.item_name, ' + ') as item_name, 
    MAX(si.brand) as brand, 
    MAX(si.design) as design, 
    MAX(si.tire_size) as tire_size, 
    MAX(si.category) as category,
    MAX(si.quantity) as quantity, 
    SUM(si.unit_price) as unit_price, 
    SUM(si.line_total) as line_total, 
    MAX(si.sale_type) as sale_type,
    sh.sale_id, sh.invoice_number, sh.sale_datetime, sh.business_date,
    cm.customer_name
  FROM sale_items si
  JOIN sale_header sh ON si.sale_id = sh.sale_id
  LEFT JOIN customer_master cm ON sh.customer_id = cm.customer_id
  ${where}
  GROUP BY sh.sale_id
`;

db.all(baseSelect, params, (err, rows) => {
  if (err) console.error(err);
  console.log("GROUPED RESULTS:", rows);
});
