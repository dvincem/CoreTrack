const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('tire_shop.db');
db.all("SELECT transaction_type, quantity FROM inventory_ledger WHERE transaction_type = 'SALE' LIMIT 10;", (err, rows) => {
  console.log(rows);
});
