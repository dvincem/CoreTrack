const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');

const db = new sqlite3.Database('tire_shop.db');
const JWT_SECRET = "coretrack-dev-secret-change-in-production";

db.all("SELECT shop_id FROM shop_master LIMIT 5", async (err, shops) => {
  if (err) {
    console.error(err);
    db.close();
    return;
  }
  
  const shopId = shops[0].shop_id;
  const token = jwt.sign({ username: 'admin', shop_id: shopId }, JWT_SECRET);
  
  try {
    const res = await fetch(`http://localhost:3000/api/items/${shopId}?q=215/70R16`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    console.log("Items list response:");
    console.log(JSON.stringify(data.data || data, null, 2));
  } catch (fetchErr) {
    console.error("Fetch error:", fetchErr);
  }
  
  db.close();
});
