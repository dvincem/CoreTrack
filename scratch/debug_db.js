const { dbAll } = require('../lib/db');

async function check() {
  try {
    const items = await dbAll("SELECT item_id, item_name, category, sku FROM item_master WHERE item_name LIKE '%Test Tire%';");
    console.log("Items matching Test Tire:");
    console.log(JSON.stringify(items, null, 2));

    const stock = await dbAll("SELECT * FROM current_stock WHERE item_id IN (SELECT item_id FROM item_master WHERE item_name LIKE '%Test Tire%');");
    console.log("\nStock for these items:");
    console.log(JSON.stringify(stock, null, 2));

    const ledger = await dbAll("SELECT * FROM inventory_ledger WHERE item_id IN (SELECT item_id FROM item_master WHERE item_name LIKE '%Test Tire%') ORDER BY created_at DESC LIMIT 10;");
    console.log("\nLast 10 ledger entries for these items:");
    console.log(JSON.stringify(ledger, null, 2));

  } catch (err) {
    console.error(err);
  }
}

check();
