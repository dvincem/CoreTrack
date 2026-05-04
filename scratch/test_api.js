const http = require('http');

const data = JSON.stringify({
  items: [
    {
      item_name: "Test Bug",
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
  ]
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/purchases/SHOP-A69B56E8',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.write(data);
req.end();
