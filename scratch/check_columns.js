const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('tire_shop.db');

db.all("SELECT * FROM item_master WHERE item_id = 'ITEM-1777724021171-64-DOT2025'", (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log(rows);
  }
  db.close();
});
