const { dbAll } = require("../lib/db");
const shop_id = 'SHOP-A69B56E8';
const date = '2026-05-11';

async function check() {
  try {
    const payables = await dbAll(`SELECT * FROM payable_payments WHERE DATE(payment_date) = ?`, [date]);
    console.log("Payable Payments:", JSON.stringify(payables, null, 2));

    const orders = await dbAll(`SELECT * FROM orders WHERE status = 'RECEIVED' AND DATE(received_at) = ?`, [date]);
    console.log("Received Orders:", JSON.stringify(orders, null, 2));

    const summary = require("../lib/reporting").getDailySummary(shop_id, date);
    summary.then(s => console.log("Daily Summary:", JSON.stringify(s, null, 2)));
  } catch (e) {
    console.error(e);
  }
}

check();
