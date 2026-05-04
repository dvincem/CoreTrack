const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = "tirehub-dev-secret-change-in-production";
const token = jwt.sign({ username: 'admin', shop_id: 'SHOP-A69B56E8' }, JWT_SECRET);

async function checkGrouping() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/items/SHOP-A69B56E8?groupByDot=true',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (d) => body += d);
    res.on('end', () => {
      const data = JSON.parse(body);
      const testItems = data.filter(i => i.brand === 'DOTTEST');
      console.log("Grouped Items for DOTTEST:", testItems.length);
      testItems.forEach(i => {
        console.log(`- ${i.brand} ${i.design} ${i.size} | Stock: ${i.current_quantity} | Variants: ${i.variant_count}`);
      });
    });
  });

  req.on('error', console.error);
  req.end();
}

checkGrouping();
