const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('tire_shop.db');

const today    = '2026-05-09';
const histStart = '2026-04-09'; // 30-day window
const shopId   = 'SHOP-A69B56E8';

// Count actual trading days in the window
db.get(`
  SELECT COUNT(DISTINCT DATE(sh.sale_datetime)) AS trading_days
  FROM sale_header sh
  WHERE sh.shop_id = ? AND sh.is_void = 0
    AND DATE(sh.sale_datetime) BETWEEN ? AND ?
`, [shopId, histStart, today], (err, tdRow) => {
  const tradingDays = tdRow.trading_days || 1;
  console.log(`Trading days in 30d window: ${tradingDays}`);

  // --- Exact same formula as profits page ---
  const q1 = `
    SELECT
      COALESCE(SUM(si.line_total), 0) AS product_revenue,
      COALESCE(SUM(si.quantity * COALESCE(si.unit_cost, im.unit_cost, 0)), 0) AS product_cogs,
      COALESCE(SUM(si.line_total - si.quantity * COALESCE(si.unit_cost, im.unit_cost, 0)), 0) AS product_gross
    FROM sale_items si
    JOIN sale_header sh ON si.sale_id = sh.sale_id
    LEFT JOIN item_master im ON si.item_or_service_id = im.item_id
    WHERE sh.shop_id = ? AND si.sale_type IN ('PRODUCT','RECAP')
      AND sh.is_void = 0 AND DATE(sh.sale_datetime) BETWEEN ? AND ?`;

  const q2 = `
    SELECT COALESCE(SUM(commission_amount), 0) AS total_commission
    FROM labor_log
    WHERE shop_id = ? AND is_void = 0 AND commission_amount > 0
      AND DATE(business_date) BETWEEN ? AND ?`;

  const q3 = `
    SELECT
      COALESCE(SUM(total_amount), 0)     AS service_revenue,
      COALESCE(SUM(total_amount / 2), 0) AS service_margin
    FROM labor_log
    WHERE shop_id = ? AND is_void = 0 AND commission_amount = 0
      AND DATE(business_date) BETWEEN ? AND ?`;

  const q5 = `
    SELECT COALESCE(SUM(e.amount), 0) AS total_expenses
    FROM expenses e
    WHERE e.shop_id = ? AND e.is_void = 0
      AND DATE(e.expense_date) BETWEEN ? AND ?`;

  db.get(q1, [shopId, histStart, today], (e1, r1) => {
    db.get(q2, [shopId, histStart, today], (e2, r2) => {
      db.get(q3, [shopId, histStart, today], (e3, r3) => {
        db.get(q5, [shopId, histStart, today], (e5, r5) => {
          const product_revenue  = r1.product_revenue  || 0;
          const product_cogs     = r1.product_cogs     || 0;
          const product_gross    = r1.product_gross    || 0;
          const total_commission = r2.total_commission || 0;
          const service_revenue  = r3.service_revenue  || 0;
          const service_margin   = r3.service_margin   || 0;
          const total_expenses   = r5.total_expenses   || 0;

          const net_tire_profit = product_gross - total_commission;
          const net_profit      = net_tire_profit + service_margin - total_expenses;
          const total_revenue   = product_revenue + service_revenue;

          console.log('\n=== HISTORICAL (30d window) — same formula as Profits page ===');
          console.log(`  Total Revenue (tires + labor):  ₱${total_revenue.toFixed(0)}`);
          console.log(`  Product COGS:                  -₱${product_cogs.toFixed(0)}`);
          console.log(`  Gross Tire Profit:               ₱${product_gross.toFixed(0)}`);
          console.log(`  Commission:                     -₱${total_commission.toFixed(0)}`);
          console.log(`  Net Tire Profit:                 ₱${net_tire_profit.toFixed(0)}`);
          console.log(`  Service Margin:                 +₱${service_margin.toFixed(0)}`);
          console.log(`  Expenses:                       -₱${total_expenses.toFixed(0)}`);
          console.log(`  NET PROFIT:                      ₱${net_profit.toFixed(0)}`);

          console.log('\n=== PROPOSED FORMULA ===');
          const avg_daily_net  = net_profit / tradingDays;
          const projected_net  = avg_daily_net * 30;
          const avg_daily_rev  = total_revenue / tradingDays;
          const projected_rev  = avg_daily_rev * 30;

          console.log(`  Net Profit ₱${net_profit.toFixed(0)} / ${tradingDays} trading days = ₱${avg_daily_net.toFixed(0)} avg daily net profit`);
          console.log(`  Projected NET PROFIT (×30):   ₱${projected_net.toFixed(0)}`);
          console.log('');
          console.log(`  Total Revenue ₱${total_revenue.toFixed(0)} / ${tradingDays} trading days = ₱${avg_daily_rev.toFixed(0)} avg daily revenue`);
          console.log(`  Projected REVENUE (×30):      ₱${projected_rev.toFixed(0)}`);

          console.log('\n=== PROFITS PAGE (May 1-9) for cross-check ===');
          console.log(`  Shows Total Sales: ₱269.6k, Net Profit: ₱71.5k`);
          console.log(`  Our 30d calc Total Revenue: ₱${total_revenue.toFixed(0)} (same data, wider window)`);

          db.close();
        });
      });
    });
  });
});
