const fetch = require('node-fetch');

async function test() {
  const shopId = 'SHOP-MAIN'; // Adjust if needed
  const baseUrl = 'http://localhost:5000/api';

  try {
    console.log('--- Testing Grouped Items ---');
    const r1 = await fetch(`${baseUrl}/items/${shopId}?groupByDot=true&page=1&perPage=5`);
    const d1 = await r1.json();
    
    if (d1.data && d1.data.length > 0) {
      const item = d1.data[0];
      console.log('Grouped Item ID:', item.item_id);
      console.log('Real Item ID:', item.real_item_id);
      
      if (!item.real_item_id && item.item_id.includes('||')) {
        console.error('FAIL: real_item_id is missing for grouped item');
      } else {
        console.log('PASS: real_item_id is present');
      }

      console.log('\n--- Testing Order Creation with Real ID ---');
      const orderData = {
        shop_id: shopId,
        order_notes: 'Test Order from Script',
        items: [{
          item_id: item.real_item_id || item.item_id,
          quantity: 2,
          unit_cost: item.unit_cost || 1000,
          supplier_id: 'SUP-001' // Adjust if needed
        }]
      };

      const r2 = await fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      const d2 = await r2.json();
      console.log('Order Creation Response:', d2);

      if (d2.order_id) {
        console.log('\n--- Testing Order Details ---');
        const r3 = await fetch(`${baseUrl}/orders/${d2.order_id}/details`);
        const d3 = await r3.json();
        console.log('Order Items Count:', d3.items?.length);
        if (d3.items && d3.items.length > 0) {
          console.log('PASS: Order items are visible in details');
        } else {
          console.error('FAIL: Order items are empty in details');
        }
      }
    } else {
      console.log('No items found to test with.');
    }
  } catch (err) {
    console.error('Test failed:', err.message);
  }
}

test();
