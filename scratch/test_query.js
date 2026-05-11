const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('tire_shop.db');

db.all(`SELECT sh.sale_id, sh.business_date, si.item_name, si.sale_type 
        FROM sale_items si 
        JOIN sale_header sh ON si.sale_id = sh.sale_id 
        WHERE si.sale_type = 'PRODUCT' 
        ORDER BY sh.sale_datetime DESC 
        LIMIT 10`, (err, rows) => {
  console.log(err || rows);
});
