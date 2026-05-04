const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = "tirehub-dev-secret-change-in-production";
const token = jwt.sign({ username: 'admin', shop_id: 'SHOP-A69B56E8' }, JWT_SECRET);

async function makeRequest(data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/purchases/SHOP-A69B56E8',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (d) => body += d);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body: { error: body } });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTest() {
  const brand = "DOTTEST";
  const design = "VARI";
  const size = "102";
  
  console.log("--- Step 1: Purchase DOT 1111 ---");
  const res1 = await makeRequest(JSON.stringify({
    items: [{
      brand, design, size, category: "TIRE",
      quantity: 1, unit_cost: 100, selling_price: 200, dot_number: "1111"
    }],
    created_by: 'admin'
  }));
  console.log("Res 1:", res1.status, res1.body.items ? res1.body.items[0].item_master_id : res1.body);

  if (res1.status !== 200) return;

  console.log("--- Step 2: Purchase DOT 2222 (Same Item) ---");
  const res2 = await makeRequest(JSON.stringify({
    items: [{
      brand, design, size, category: "TIRE",
      quantity: 1, unit_cost: 110, selling_price: 210, dot_number: "2222"
    }],
    created_by: 'admin'
  }));
  
  console.log("Res 2 status:", res2.status);
  if (res2.status !== 200) {
    console.log("Res 2 error body:", JSON.stringify(res2.body));
    return;
  }
  console.log("Res 2 Item ID:", res2.body.items[0].item_master_id);

  if (res1.body.items[0].item_master_id === res2.body.items[0].item_master_id) {
    console.error("FAIL: Both purchases used the SAME item_master_id! DOT was likely overwritten.");
  } else {
    console.log("SUCCESS: Different item_master_ids used for different DOTs.");
  }
}

runTest();
