const { dbGet, dbAll } = require("./db");

/**
 * Calculates a comprehensive daily summary for a specific shop and business date.
 * Used for both live Reports view and official Daily Closure snapshots.
 * 
 * @param {string} shop_id 
 * @param {string} date - YYYY-MM-DD format
 */
async function getDailySummary(shop_id, date) {
  try {
    // 1. Product Sales & Profit (COGS)
    const productStats = await dbGet(
      `SELECT 
        COALESCE(SUM(si.line_total), 0) as grossSales,
        COALESCE(SUM(si.line_total - (si.quantity * COALESCE(si.unit_cost, im.unit_cost, 0))), 0) as salesProfit
      FROM sale_items si
      JOIN sale_header sh ON si.sale_id = sh.sale_id
      LEFT JOIN item_master im ON si.item_or_service_id = im.item_id
      WHERE sh.shop_id = ? AND sh.is_void = 0 AND si.sale_type IN ('PRODUCT', 'RECAP') 
        AND sh.business_date = ?`,
      [shop_id, date]
    );

    // 2. Services Summary
    const serviceStats = await dbGet(
      `SELECT 
        COALESCE(SUM(total_amount), 0) as grossServices,
        COALESCE(SUM(total_amount / 2), 0) as serviceIncome
      FROM labor_log
      WHERE shop_id = ? AND is_void = 0 AND commission_amount = 0
        AND DATE(business_date) = ?`,
      [shop_id, date]
    );

    // 3. Expenses Summary
    const expenseData = await dbGet(
      `SELECT COALESCE(SUM(amount), 0) as totalExpenses
      FROM expenses
      WHERE shop_id = ? AND is_void = 0 AND DATE(expense_date) = ?`,
      [shop_id, date]
    );

    // 4. Purchases Summary (Manual)
    const purchaseData = await dbGet(
      `SELECT COALESCE(SUM(total_amount), 0) as totalPurchases
      FROM purchase_header
      WHERE shop_id = ? AND DATE(purchase_date) = ?`,
      [shop_id, date]
    );

    // 5. Commissions Summary
    const commissionsData = await dbGet(
      `SELECT COALESCE(SUM(commission_amount), 0) as totalCommissions
      FROM labor_log
      WHERE shop_id = ? AND is_void = 0 AND commission_amount > 0 AND DATE(business_date) = ?`,
      [shop_id, date]
    );

    // 6. Payment Method Breakdown (Full breakdown for reconciliation)
    const transactions = await dbAll(
      `SELECT sh.total_amount as amount, sh.payment_method, sh.payment_splits
       FROM sale_header sh
       WHERE sh.shop_id = ? AND sh.is_void = 0 AND sh.business_date = ?`,
      [shop_id, date]
    );

    const breakdown = {
      CASH: 0,
      GCASH: 0,
      BPI: 0,
      BDO: 0,
      CARD: 0,
      CREDIT: 0
    };

    transactions.forEach(t => {
      if (t.payment_splits) {
        try {
          const splits = JSON.parse(t.payment_splits);
          splits.forEach(sp => {
            const method = (sp.method || 'CASH').toUpperCase().replace('BANK_', '');
            if (breakdown[method] !== undefined) breakdown[method] += parseFloat(sp.amount) || 0;
            else breakdown.CASH += parseFloat(sp.amount) || 0;
          });
        } catch (e) { /* ignore parse error */ }
      } else {
        const method = (t.payment_method || 'CASH').toUpperCase().replace('BANK_', '');
        if (breakdown[method] !== undefined) breakdown[method] += t.amount;
        else breakdown.CASH += t.amount;
      }
    });

    // Add manual cash ledger entries
    const manualEntries = await dbAll(
      `SELECT amount, entry_type, description
       FROM cash_ledger
       WHERE shop_id = ? AND is_void = 0 AND entry_date = ?`,
      [shop_id, date]
    );

    manualEntries.forEach(e => {
      const isOut = e.entry_type.endsWith('_OUT');
      const val = isOut ? -e.amount : e.amount;
      let method = 'CASH';
      if (e.entry_type.startsWith('GCASH')) method = 'GCASH';
      else if (e.entry_type.startsWith('CARD')) method = 'CARD';
      else if (e.entry_type.startsWith('BANK')) {
        const desc = (e.description || '').toUpperCase();
        if (desc.includes('BPI')) method = 'BPI';
        else if (desc.includes('BDO')) method = 'BDO';
        else method = 'BDO'; // Default bank to BDO if not specified
      }
      
      if (breakdown[method] !== undefined) breakdown[method] += val;
      else breakdown.CASH += val;
    });

    const cashOut = (expenseData.totalExpenses || 0) + (commissionsData.totalCommissions || 0);
    const netProfit = (productStats.salesProfit || 0) + (serviceStats.serviceIncome || 0) - (expenseData.totalExpenses || 0);

    return {
      date,
      grossSales: productStats.grossSales || 0,
      salesProfit: productStats.salesProfit || 0,
      grossServices: serviceStats.grossServices || 0,
      serviceIncome: serviceStats.serviceIncome || 0,
      totalExpenses: expenseData.totalExpenses || 0,
      totalPurchases: purchaseData.totalPurchases || 0,
      totalCommissions: commissionsData.totalCommissions || 0,
      netProfit: netProfit,
      cashOnHand: Math.max(0, breakdown.CASH - cashOut),
      digitalTotal: breakdown.GCASH + breakdown.BPI + breakdown.BDO + breakdown.CARD,
      paymentBreakdown: breakdown
    };
  } catch (error) {
    console.error(`Error calculating daily summary for ${shop_id} on ${date}:`, error);
    throw error;
  }
}

module.exports = {
  getDailySummary
};
