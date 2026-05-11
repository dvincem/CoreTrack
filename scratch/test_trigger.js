const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('tire_shop.db');
db.get("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='update_current_stock';", (err, row) => console.log(row ? row.sql : 'No trigger found'));
