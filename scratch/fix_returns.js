const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('tire_shop.db');
db.serialize(() => {
  // Fix the inventory_ledger rows for SUPPLIER_RETURN that are positive
  db.run("UPDATE inventory_ledger SET quantity = -ABS(quantity) WHERE transaction_type = 'SUPPLIER_RETURN' AND quantity > 0;", function(err) {
    if (err) console.error("Error updating ledger:", err);
    else console.log(`Fixed ${this.changes} rows in inventory_ledger`);
    
    // Now get all item_ids that had a SUPPLIER_RETURN
    db.all("SELECT item_id FROM inventory_ledger WHERE transaction_type = 'SUPPLIER_RETURN';", (err, rows) => {
      if (err) {
        console.error("Error fetching items:", err);
        return;
      }
      if (rows && rows.length > 0) {
        const items = [...new Set(rows.map(r => r.item_id))];
        let processed = 0;
        for (const id of items) {
          db.run(`
            UPDATE current_stock 
            SET current_quantity = (SELECT COALESCE(SUM(quantity), 0) FROM inventory_ledger WHERE item_id = ? AND shop_id = current_stock.shop_id), 
                last_updated = CURRENT_TIMESTAMP 
            WHERE item_id = ?;
          `, [id, id], (err) => {
            if (err) console.error("Error updating stock for", id, ":", err);
            processed++;
            if (processed === items.length) {
              console.log('Fixed stock for items:', items);
            }
          });
        }
      } else {
        console.log('No SUPPLIER_RETURN rows found to fix.');
      }
    });
  });
});
