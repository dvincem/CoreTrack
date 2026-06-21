const { dbGet, dbAll } = require("./db");
const { toLocalYYYYMMDD } = require("./businessDate");

/**
 * Calculates a comprehensive daily summary for a specific shop and business date.
 * Used for both live Reports view and official Daily Closure snapshots.
 *
 * Down-payment rule:
 *   When a credit sale has credit_down_payment > 0 on sale_header, the down payment
 *   was physically collected as CASH at the counter. Only the remaining balance
 *   (total_amount - credit_down_payment) is the true "on credit" portion.
 *   We split it here so Cash on Hand reflects actual cash held and Credit Sales
 *   shows only the outstanding balance.
 *
 *   The matching receivable_payment row (notes = 'Down payment at POS') is excluded
 *   from the collections query to prevent double-counting.
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
        AND business_date = ?`,
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

    // 4. Purchases Summary (Manual + RECEIVED Orders NOT paid in cash)
    const purchaseData = await dbGet(
      `SELECT
        (SELECT COALESCE(SUM(total_amount), 0) FROM purchase_header WHERE shop_id = ? AND is_void = 0 AND purchase_date = ?)
        as manualPurchases,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE shop_id = ? AND status = 'RECEIVED' AND DATE(received_at, 'localtime') = ? AND payment_mode != 'CASH')
        as orderPurchases`,
      [shop_id, date, shop_id, date]
    );

    // 5. Commissions Summary
    const commissionsData = await dbGet(
      `SELECT COALESCE(SUM(commission_amount), 0) as totalCommissions
      FROM labor_log
      WHERE shop_id = ? AND is_void = 0 AND commission_amount > 0 AND business_date = ?`,
      [shop_id, date]
    );

    // 6. Payment Method Breakdown
    // Fetch credit_down_payment directly from sale_header — no JOIN needed.
    const transactions = await dbAll(
      `SELECT sh.sale_id, sh.total_amount as amount, sh.payment_method,
              sh.payment_splits, sh.sale_datetime,
              COALESCE(sh.credit_down_payment, 0) as credit_down_payment
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
      CREDIT: 0,
      BANK: 0,
      CHECK: 0
    };

    let salesCashToday = 0;
    let salesCashAfterHours = 0;
    let salesDigitalToday = 0;
    let salesDigitalAfterHours = 0;
    let salesCreditToday = 0;
    let salesCreditAfterHours = 0;

    transactions.forEach(t => {
      const isAfterHours = t.sale_datetime ? (toLocalYYYYMMDD(t.sale_datetime) < date) : false;

      if (t.payment_splits) {
        // --- Split payment: process each split method ---
        try {
          const splits = JSON.parse(t.payment_splits);
          splits.forEach(sp => {
            const method = (sp.method || 'CASH').toUpperCase().replace('BANK_', '');
            const amt = parseFloat(sp.amount) || 0;
            if (breakdown[method] !== undefined) breakdown[method] += amt;
            else breakdown.CASH += amt;

            if (method === 'CASH') {
              if (isAfterHours) salesCashAfterHours += amt; else salesCashToday += amt;
            } else if (method === 'CREDIT') {
              if (isAfterHours) salesCreditAfterHours += amt; else salesCreditToday += amt;
            } else {
              if (isAfterHours) salesDigitalAfterHours += amt; else salesDigitalToday += amt;
            }
          });
        } catch (e) { /* ignore parse error */ }
      } else {
        // --- Single-method payment ---
        const method = (t.payment_method || 'CASH').toUpperCase().replace('BANK_', '');
        const totalAmt = parseFloat(t.amount) || 0;

        if (method === 'CREDIT' && t.credit_down_payment > 0) {
          // ── Credit sale WITH down payment ──────────────────────────────────
          // The down payment was physically collected as CASH at the counter.
          // Route it to CASH, put only the remaining balance in CREDIT.
          const dpAmt = Math.min(parseFloat(t.credit_down_payment), totalAmt);
          const creditPortion = Math.max(0, totalAmt - dpAmt);

          // Down payment → CASH
          breakdown.CASH += dpAmt;
          if (isAfterHours) salesCashAfterHours += dpAmt; else salesCashToday += dpAmt;

          // Remaining balance → CREDIT
          breakdown.CREDIT += creditPortion;
          if (isAfterHours) salesCreditAfterHours += creditPortion; else salesCreditToday += creditPortion;
        } else {
          // ── Regular single-method payment ──────────────────────────────────
          if (breakdown[method] !== undefined) breakdown[method] += totalAmt;
          else breakdown.CASH += totalAmt;

          if (method === 'CASH') {
            if (isAfterHours) salesCashAfterHours += totalAmt; else salesCashToday += totalAmt;
          } else if (method === 'CREDIT') {
            if (isAfterHours) salesCreditAfterHours += totalAmt; else salesCreditToday += totalAmt;
          } else {
            if (isAfterHours) salesDigitalAfterHours += totalAmt; else salesDigitalToday += totalAmt;
          }
        }
      }
    });

    // 7. Manual cash ledger entries
    const manualEntries = await dbAll(
      `SELECT amount, entry_type, description
       FROM cash_ledger
       WHERE shop_id = ? AND is_void = 0 AND entry_date = ?`,
      [shop_id, date]
    );

    // 8. Receivable collections (Money In from customers paying their credit balances).
    //    EXCLUDE "Down payment at POS" rows — those are already counted above via
    //    credit_down_payment on sale_header and would double-count if included here.
    const collections = await dbAll(
      `SELECT rp.amount, rp.payment_method
       FROM receivable_payments rp
       WHERE rp.shop_id = ? AND rp.is_void = 0 AND DATE(rp.payment_date, 'localtime') = ?
         AND (rp.is_opening_balance IS NULL OR rp.is_opening_balance = 0)
         AND COALESCE(rp.notes, '') != 'Down payment at POS'`,
      [shop_id, date]
    );

    // 9. Bale repayments (staff cash advance repayments — cash back into register)
    const baleRepayments = await dbAll(
      `SELECT bp.amount, bp.payment_method
       FROM bale_payments bp
       JOIN bale_book bb ON bp.bale_id = bb.bale_id
       WHERE bb.shop_id = ? AND DATE(bp.payment_date, 'localtime') = ? AND COALESCE(bp.is_void, 0) = 0`,
      [shop_id, date]
    );

    // 10. Payable payments (outflows)
    const payablePayments = await dbAll(
      `SELECT amount, payment_method FROM payable_payments
       WHERE shop_id = ? AND is_void = 0 AND DATE(payment_date, 'localtime') = ?`,
      [shop_id, date]
    );

    // Capture sales-only totals before applying adjustments
    const cashFromSales = breakdown.CASH;
    const digitalFromSales = (breakdown.GCASH || 0) + (breakdown.CARD || 0) + (breakdown.BPI || 0) + (breakdown.BDO || 0) + (breakdown.BANK || 0) + (breakdown.CHECK || 0);
    const creditFromSales = breakdown.CREDIT || 0;
    let manualCashIn = 0, manualGcashIn = 0, manualCashOut = 0, manualGcashOut = 0;
    let collectionsTotal = 0, collectionsCashTotal = 0;
    let payablePaymentsTotal = 0, payablePaymentsCashTotal = 0;
    let baleRepaymentsTotal = 0, baleRepaymentsCashTotal = 0;

    // Apply manual entries
    manualEntries.forEach(e => {
      const isOut = e.entry_type.endsWith('_OUT');
      const val = isOut ? -e.amount : e.amount;

      let methodKey = 'CASH';
      if (e.entry_type.startsWith('GCASH')) {
        methodKey = 'CASH';
      } else if (e.entry_type.startsWith('CARD')) {
        methodKey = 'CARD';
      } else if (e.entry_type.startsWith('BANK')) {
        methodKey = 'BANK';
      }

      if (methodKey === 'CASH') {
        breakdown.CASH += val;
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
      if (m === 'CASH') {
        payablePaymentsCashTotal += val;
        breakdown.CASH -= val;
      }
    });

    // Total purchases for KPI (Manual only)
    const totalPurchasesKpi = purchaseData.manualPurchases || 0;

    // Deduct only manual purchases from cash pool (Orders handled via payable_payments)
    const manualPurchasesDeducted = purchaseData.manualPurchases || 0;
    breakdown.CASH -= manualPurchasesDeducted;

    const netProfit = (productStats.salesProfit || 0) + (serviceStats.serviceIncome || 0) - (expenseData.totalExpenses || 0);

    // ── Explicit Cash-on-Hand formula ─────────────────────────────────────────
    // + Gross Sales (product items sold — full invoice value)
    // + Service Income (50% of service revenue — other 50% paid out as tiremen daily wage)
    // − Digital sales (GCash/Card/BPI/BDO — never physically in the register)
    // − Credit sales NET of down payments (only the true outstanding portion)
    //   (credit_down_payment portion stays in cash because it was physically collected)
    // + Cash collections from receivables (excluding POS down payments — already counted above)
    // + Bale repayments + Manual Cash In + GCash In
    // − Commissions − Expenses − Payable payments − Manual purchases − Manual Cash Out
    const cashOnHand = Math.max(0,
      (productStats.grossSales || 0) + (serviceStats.serviceIncome || 0)
      - digitalFromSales
      - creditFromSales          // already net of down payments via the forEach logic above
      + manualCashIn + manualGcashIn
      + collectionsCashTotal     // real collections, excluding same-day POS down payments
      + baleRepaymentsCashTotal
      - manualCashOut - manualGcashOut
      - payablePaymentsCashTotal
      - manualPurchasesDeducted
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
      totalPurchases: totalPurchasesKpi,
      totalCommissions: commissionsData.totalCommissions || 0,
      netProfit: netProfit,
      cashOnHand,
      digitalTotal: breakdown.GCASH + breakdown.BPI + breakdown.BDO + breakdown.CARD + breakdown.BANK + breakdown.CHECK,
      paymentBreakdown: breakdown,
      cashPool: {
        cashFromSales,
        digitalFromSales,
        creditFromSales,
        salesCashToday,
        salesCashAfterHours,
        salesDigitalToday,
        salesDigitalAfterHours,
        salesCreditToday,
        salesCreditAfterHours,
        manualCashIn,
        manualGcashIn,
        manualCashOut,
        manualGcashOut,
        collectionsTotal: collectionsCashTotal,
        baleRepaymentsTotal: baleRepaymentsCashTotal,
        payablePaymentsTotal: payablePaymentsCashTotal,
        expensesDeducted: expenseData.cashExpenses || 0,
        commissionsDeducted: commissionsData.totalCommissions || 0,
        purchasesDeducted: manualPurchasesDeducted,
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
