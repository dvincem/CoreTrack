// Quick verification: simulate what reporting.js now does for the June 3 credit sale
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./tire_shop.db');

// Simulate the forEach logic for the 24k credit sale
const sale = {
  sale_id: 'SALE-1780459592733',
  amount: 24000,
  payment_method: 'CREDIT',
  payment_splits: null,
  credit_down_payment: 20000,
};

const breakdown = { CASH: 0, CREDIT: 0 };
const method = sale.payment_method.toUpperCase();
const totalAmt = sale.amount;

if (method === 'CREDIT' && sale.credit_down_payment > 0) {
  const dpAmt = Math.min(sale.credit_down_payment, totalAmt);
  const creditPortion = Math.max(0, totalAmt - dpAmt);
  breakdown.CASH += dpAmt;
  breakdown.CREDIT += creditPortion;
}

console.log('Sale amount:        ₱', totalAmt);
console.log('Down payment:       ₱', sale.credit_down_payment);
console.log('→ breakdown.CASH:   ₱', breakdown.CASH,  '(collected in register)');
console.log('→ breakdown.CREDIT: ₱', breakdown.CREDIT, '(outstanding balance)');
console.log('');

// Check the receivable payment note
db.all(
  "SELECT amount, payment_method, notes FROM receivable_payments WHERE amount = 20000 AND notes = 'Down payment at POS'",
  [],
  (e, r) => {
    if (e) { console.log('DB Error:', e.message); } 
    else {
      console.log('RP rows with "Down payment at POS" note (will be EXCLUDED from collections):');
      console.log(JSON.stringify(r, null, 2));
    }
    db.close();
  }
);
