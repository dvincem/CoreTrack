const { apiFetch, API_URL } = require('../lib/config');

async function test() {
  const shopId = 'SHOP-A69B56E8'; // From previous checks
  
  // 1. Create a purchase for a new item
  const itemData = {
    brand: 'REPRO',
    design: 'TEST',
    size: '123',
    dot_number: '2025',
    category: 'TIRE',
    unit_cost: 1000,
    selling_price: 1500,
    quantity: 10,
    itemType: 'TIRE',
    item_type: 'TIRE'
  };

  console.log("Recording first purchase...");
  const res1 = await fetch(`http://localhost:5173/api/purchases/${shopId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [itemData]
    })
  });
  const data1 = await res1.json();
  console.log("First Purchase Result:", JSON.stringify(data1, null, 2));

  // 2. Record second purchase with DIFFERENT category but SAME sku attributes
  const itemData2 = { ...itemData, category: 'SUV', quantity: 5 };
  console.log("\nRecording second purchase (different category)...");
  const res2 = await fetch(`http://localhost:5173/api/purchases/${shopId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [itemData2]
    })
  });
  const data2 = await res2.json();
  console.log("Second Purchase Result:", JSON.stringify(data2, null, 2));
}

// Note: I don't have 'fetch' in node unless I use an older version or a polyfill.
// I'll use http module instead.
