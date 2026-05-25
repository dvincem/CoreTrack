const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('tire_shop.db');

db.all("SELECT DISTINCT shop_id FROM inventory_ledger", (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log("shop_ids in inventory_ledger:", rows);
  }
  db.close();
});
