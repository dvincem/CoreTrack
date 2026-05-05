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
      `SELECT 
        COALESCE(SUM(amount), 0) as totalExpenses,
        COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN amount ELSE 0 END), 0) as cashExpenses
      FROM expenses
      WHERE shop_id = ? AND is_void = 0 AND DATE(expense_date) = ?`,
      [shop_id, date]
    );

    // 4. Purchases Summary (Manual)
    const purchaseData = await dbGet(
      `SELECT COALESCE(SUM(total_amount), 0) as totalPurchases
      FROM purchase_header
      WHERE shop_id = ? AND is_void = 0 AND DATE(purchase_date) = ?`,
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

    // Add receivable collections
    const collections = await dbAll(
      `SELECT amount, payment_method FROM receivable_payments 
       WHERE shop_id = ? AND is_void = 0 AND payment_date = ?`,
      [shop_id, date]
    );

    // Add bale repayments (staff cash advance repayments — cash back into register)
    const baleRepayments = await dbAll(
      `SELECT bp.amount, bp.payment_method
       FROM bale_payments bp
       JOIN bale_book bb ON bp.bale_id = bb.bale_id
       WHERE bb.shop_id = ? AND DATE(bp.payment_date) = ?`,
      [shop_id, date]
    );

    // Add payable payments (outflows)
    const payablePayments = await dbAll(
      `SELECT amount, payment_method FROM payable_payments 
       WHERE shop_id = ? AND is_void = 0 AND payment_date = ?`,
      [shop_id, date]
    );

    // Capture sales-only cash before applying manual entries/collections
    const cashFromSales = breakdown.CASH;
    const digitalFromSales = (breakdown.GCASH || 0) + (breakdown.CARD || 0) + (breakdown.BPI || 0) + (breakdown.BDO || 0);
    let manualCashIn = 0, manualGcashIn = 0, manualCashOut = 0, manualGcashOut = 0;
    let collectionsTotal = 0, collectionsCashTotal = 0;
    let payablePaymentsTotal = 0, payablePaymentsCashTotal = 0;
    let baleRepaymentsTotal = 0, baleRepaymentsCashTotal = 0;

    // Apply manual entries
    manualEntries.forEach(e => {
      const isOut = e.entry_type.endsWith('_OUT');
      const val = isOut ? -e.amount : e.amount;
      
      // Map entry types to methods for breakdown
      let methodKey = 'CASH';
      if (e.entry_type.startsWith('GCASH')) {
        // GCash In/Out are physical cash movements at the shop counter
        methodKey = 'CASH'; 
      } else if (e.entry_type.startsWith('CARD')) {
        methodKey = 'CARD';
      } else if (e.entry_type.startsWith('BANK')) {
        methodKey = 'BANK';
      }

      if (methodKey === 'CASH') {
        breakdown.CASH += val;
        // Track specifically for the UI breakdown rows
        if (e.entry_type.startsWith('GCASH')) {
          if (isOut) manualGcashOut += e.amount; else manualGcashIn += e.amount;
        } else {
          if (isOut) manualCashOut += e.amount; else manualCashIn += e.amount;
        }
      } else if (methodKey === 'CARD') {
        breakdown.CARD += val;
      } else if (methodKey === 'BANK') {
        const desc = (e.description || '').toUpperCase();
        if (desc.includes('BPI')) breakdown.BPI += val; else breakdown.BDO += val;
      }
    });

    // Apply collections (Money In)
    collections.forEach(c => {
      const m = (c.payment_method || 'CASH').toUpperCase().replace('BANK_', '');
      const val = parseFloat(c.amount) || 0;
      collectionsTotal += val;
      if (m === 'CASH') collectionsCashTotal += val;
      
      if (breakdown[m] !== undefined) breakdown[m] += val;
      else breakdown.CASH += val;
    });

    // Apply bale repayments (cash back in from staff)
    baleRepayments.forEach(b => {
      const m = (b.payment_method || 'CASH').toUpperCase().replace('BANK_', '');
      const val = parseFloat(b.amount) || 0;
      baleRepaymentsTotal += val;
      if (m === 'CASH') baleRepaymentsCashTotal += val;

      if (breakdown[m] !== undefined) breakdown[m] += val;
      else breakdown.CASH += val;
    });

    // Apply payable payments (Money Out)
    payablePayments.forEach(p => {
      const m = (p.payment_method || 'CASH').toUpperCase().replace('BANK_', '');
      const val = parseFloat(p.amount) || 0;
      payablePaymentsTotal += val;
      if (m === 'CASH') payablePaymentsCashTotal += val;

      if (breakdown[m] !== undefined) breakdown[m] -= val;
      else breakdown.CASH -= val;
    });

    // Deduct purchases from cash (no payment method tracked — assumed cash out)
    const purchasesDeducted = purchaseData.totalPurchases || 0;
    breakdown.CASH -= purchasesDeducted;

    const netProfit = (productStats.salesProfit || 0) + (serviceStats.serviceIncome || 0) - (expenseData.totalExpenses || 0);

    // Explicit cash-on-hand formula:
    // + Gross Sales + Gross Services (what customers paid)
    // − Digital/non-cash sales (GCash, Card, BPI, BDO — never entered the register)
    // + Manual Cash In + GCash In (ledger) + Cash Collections
    // − GCash Out − Manual Cash Out − Payable Payments − Purchases − Commissions − Expenses
    const cashOnHand = Math.max(0,
      (productStats.grossSales || 0) + (serviceStats.serviceIncome || 0)
      - digitalFromSales
      + manualCashIn + manualGcashIn
      + collectionsCashTotal
      + baleRepaymentsCashTotal
      - manualCashOut - manualGcashOut
      - payablePaymentsCashTotal
      - purchasesDeducted
      - (expenseData.cashExpenses || 0)
      - (commissionsData.totalCommissions || 0)
    );

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
      cashOnHand,
      digitalTotal: breakdown.GCASH + breakdown.BPI + breakdown.BDO + breakdown.CARD,
      paymentBreakdown: breakdown,
      cashPool: {
        cashFromSales,
        digitalFromSales,
        manualCashIn,
        manualGcashIn,
        manualCashOut,
        manualGcashOut,
        collectionsTotal: collectionsCashTotal,
        baleRepaymentsTotal: baleRepaymentsCashTotal,
        payablePaymentsTotal: payablePaymentsCashTotal,
        expensesDeducted: expenseData.cashExpenses || 0,
        commissionsDeducted: commissionsData.totalCommissions || 0,
        purchasesDeducted,
      }
    };
  } catch (error) {
    console.error(`Error calculating daily summary for ${shop_id} on ${date}:`, error);
    throw error;
  }
}

module.exports = {
  getDailySummary
};
