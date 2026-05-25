const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('tire_shop.db');

db.all(`
  SELECT oi.*, o.status, o.created_at, im.item_id, im.item_name, im.brand, im.design, im.size, im.dot_number
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.order_id
  JOIN item_master im ON oi.item_id = im.item_id
  WHERE o.status IN ('PENDING', 'CONFIRMED')
    AND (im.brand LIKE '%PRINX%' OR im.item_name LIKE '%PRINX%')
`, (err, rows) => {
  if (err) {
    console.error("Error querying order_items:", err);
  } else {
    console.log("=== Active Incoming Orders for PRINX ===");
    console.log(JSON.stringify(rows, null, 2));
  }
  db.close();
});
