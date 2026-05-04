const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = "tirehub-dev-secret-change-in-production";
const token = jwt.sign({ username: 'admin', shop_id: 'SHOP-A69B56E8' }, JWT_SECRET);

const data = JSON.stringify({
  items: [
    {
      item_name: "Test Bug 2",
      brand: "Bug",
      design: "Test",
      size: "999",
      category: "TIRE",
      quantity: 1,
      unit_cost: 100,
      selling_price: 200,
      itemType: 'TIRE',
      item_type: 'TIRE'
    }
  ],
  created_by: 'admin',
  handled_by: 'STAFF-AA0B5274'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/purchases/SHOP-A69B56E8',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Authorization': `Bearer ${token}`
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (error) => {
  console.error("Request Error:", error);
});

req.write(data);
req.end();
