const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('tire_shop.db');

db.all("SELECT order_id, shop_id, status FROM orders", (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log(rows);
  }
  db.close();
});
