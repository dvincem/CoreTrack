const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('tire_shop.db');

const query = `
  SELECT
    COUNT(*) AS total,
    COALESCE(SUM(ap.original_amount), 0) AS totalPayables,
    COALESCE(SUM(ap.balance_amount), 0) AS totalBalance,
    SUM(CASE WHEN ap.status = 'PAID' OR ap.balance_amount = 0 THEN 1 ELSE 0 END) AS paidCount,
    SUM(CASE WHEN ap.status != 'PAID' AND ap.balance_amount > 0 AND ap.due_date < date('now') THEN 1 ELSE 0 END) AS overdueCount,
    SUM(CASE WHEN ap.status != 'PAID' AND ap.balance_amount > 0 AND (ap.due_date IS NULL OR ap.due_date >= date('now')) THEN 1 ELSE 0 END) AS openCount,
    COALESCE(SUM(CASE WHEN strftime('%Y-%m', ap.due_date) = strftime('%Y-%m', 'now') AND ap.status != 'PAID' AND ap.balance_amount > 0 THEN ap.balance_amount ELSE 0 END), 0) AS monthBalance,
    COALESCE(SUM(CASE WHEN date(ap.due_date) >= date('now', 'weekday 0', '-8 days') AND date(ap.due_date) <= date('now', 'weekday 0', '-2 days') AND ap.status != 'PAID' AND ap.balance_amount > 0 THEN ap.balance_amount ELSE 0 END), 0) AS weekBalance,
    COALESCE(SUM(CASE WHEN strftime('%Y-%m', ap.due_date) = strftime('%Y-%m', 'now') THEN ap.original_amount ELSE 0 END), 0) AS monthOriginal,
    COALESCE(SUM(CASE WHEN strftime('%Y-%m', ap.due_date) = strftime('%Y-%m', 'now') THEN ap.amount_paid ELSE 0 END), 0) AS monthPaid
  FROM accounts_payable ap WHERE ap.status != 'VOIDED'
`;

db.get(query, [], (err, row) => {
  if (err) {
    console.error("Query Error:", err);
  } else {
    console.log("Query Results:", row);
  }
  db.close();
});
