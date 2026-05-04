const express = require("express");
const router = express.Router();
const { dbAll, dbGet } = require("../lib/db");
const { getDailySummary } = require("../lib/reporting");

// Endpoint: GET /api/reports/daily-activity/:shop_id
router.get("/daily-activity/:shop_id", async (req, res) => {
  const { shop_id } = req.params;
  let { date } = req.query;

  try {
    let targetDate = date;
    if (!targetDate) {
      const now = new Date();
      if (now.getHours() < 4) {
        now.setDate(now.getDate() - 1);
      }
      targetDate = now.toISOString().split("T")[0];
    }

    const summary = await getDailySummary(shop_id, targetDate);

    // Fetch transactions list for the report (not part of simple summary object)
    const salesTransactions = await dbAll(
      `SELECT
        sh.sale_id as id,
        sh.invoice_number as invoiceNumber,
        cm.customer_name as customerName,
        sh.total_amount as amount,
        sh.payment_method as paymentMethod,
        sh.sale_datetime as timestamp,
        CASE 
          WHEN EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = sh.sale_id AND si.sale_type = 'PRODUCT') THEN 'SALE'
          ELSE 'SERVICE'
        END as type
      FROM sale_header sh
      LEFT JOIN customer_master cm ON sh.customer_id = cm.customer_id
      WHERE sh.shop_id = ? AND sh.is_void = 0 AND sh.business_date = ?`,
      [shop_id, targetDate]
    );

    const expenseTransactions = await dbAll(
      `SELECT
        expense_id as id,
        reference_no as invoiceNumber,
        description as customerName,
        amount,
        payment_method as paymentMethod,
        expense_date as timestamp,
        'EXPENSE' as type
      FROM expenses
      WHERE shop_id = ? AND is_void = 0 AND DATE(expense_date) = ?`,
      [shop_id, targetDate]
    );

    const purchaseTransactions = await dbAll(
      `SELECT
        ph.purchase_id as id,
        ph.purchase_id as invoiceNumber,
        COALESCE(sm.supplier_name, ph.notes, 'Manual Purchase') as customerName,
        ph.total_amount as amount,
        'CASH' as paymentMethod,
        ph.purchase_date as timestamp,
        'PURCHASE' as type
      FROM purchase_header ph
      LEFT JOIN supplier_master sm ON ph.supplier_id = sm.supplier_id
      WHERE ph.shop_id = ? AND ph.is_void = 0 AND DATE(ph.purchase_date) = ?`,
      [shop_id, targetDate]
    );

    const commissionTransactions = await dbAll(
      `SELECT
        ll.log_id as id,
        sh.invoice_number as invoiceNumber,
        st.full_name as customerName,
        ll.commission_amount as amount,
        'CASH' as paymentMethod,
        ll.created_at as timestamp,
        'COMMISSION' as type
      FROM labor_log ll
      JOIN staff_master st ON ll.staff_id = st.staff_id
      LEFT JOIN sale_header sh ON ll.sale_id = sh.sale_id
      WHERE ll.shop_id = ? 
        AND ll.is_void = 0 
        AND DATE(ll.business_date) = ?
        AND ll.commission_amount > 0`,
      [shop_id, targetDate]
    );

    const receivableTransactions = await dbAll(
      `SELECT
        rp.payment_id as id,
        COALESCE(ar.sale_id, 'Manual AR') as invoiceNumber,
        cm.customer_name as customerName,
        rp.amount as amount,
        rp.payment_method as paymentMethod,
        rp.payment_date as timestamp,
        'COLLECTION' as type
      FROM receivable_payments rp
      JOIN accounts_receivable ar ON rp.receivable_id = ar.receivable_id
      JOIN customer_master cm ON ar.customer_id = cm.customer_id
      WHERE rp.shop_id = ? AND rp.is_void = 0 AND rp.payment_date = ?`,
      [shop_id, targetDate]
    );

    const payableTransactions = await dbAll(
      `SELECT
        pp.payment_id as id,
        ap.payable_id as invoiceNumber,
        COALESCE(ap.payee_name, sm.supplier_name, 'General') as customerName,
        pp.amount as amount,
        pp.payment_method as paymentMethod,
        pp.payment_date as timestamp,
        'PAYMENT' as type
      FROM payable_payments pp
      JOIN accounts_payable ap ON pp.payable_id = ap.payable_id
      LEFT JOIN supplier_master sm ON ap.supplier_id = sm.supplier_id
      WHERE pp.shop_id = ? AND pp.is_void = 0 AND pp.payment_date = ?`,
      [shop_id, targetDate]
    );

    const manualCashTransactions = await dbAll(
      `SELECT
        entry_id as id,
        entry_id as invoiceNumber,
        description as customerName,
        amount as amount,
        entry_type as paymentMethod,
        created_at as timestamp,
        entry_type as type
      FROM cash_ledger
      WHERE shop_id = ? AND is_void = 0 AND entry_date = ?`,
      [shop_id, targetDate]
    );

    const formattedManualCash = manualCashTransactions.map(t => {
      let method = 'CASH';
      // GCash In/Out in this shop are physical cash services (Customer gives/receives cash)
      if (t.paymentMethod.startsWith('GCASH')) method = 'CASH';
      else if (t.paymentMethod.startsWith('CARD')) method = 'CARD';
      else if (t.paymentMethod.startsWith('BANK')) {
        const desc = (t.customerName || '').toUpperCase();
        if (desc.includes('BPI')) method = 'BPI';
        else if (desc.includes('BDO')) method = 'BDO';
        else method = 'BDO';
      }
      return { ...t, paymentMethod: method };
    });

    const transactions = [
      ...salesTransactions, 
      ...expenseTransactions, 
      ...purchaseTransactions, 
      ...commissionTransactions,
      ...receivableTransactions,
      ...payableTransactions,
      ...formattedManualCash
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      date: targetDate,
      kpis: {
        grossSales: summary.grossSales,
        salesProfit: summary.salesProfit,
        grossServices: summary.grossServices,
        serviceIncome: summary.serviceIncome,
        expenses: summary.totalExpenses,
        purchases: summary.totalPurchases,
        commissions: summary.totalCommissions,
        netProfit: summary.netProfit
      },
      paymentSummary: [
        { method: 'CASH', total: summary.cashOnHand },
        { method: 'DIGITAL', total: summary.digitalTotal },
        { method: 'GCASH', total: summary.paymentBreakdown.GCASH },
        { method: 'BPI', total: summary.paymentBreakdown.BPI },
        { method: 'BDO', total: summary.paymentBreakdown.BDO },
        { method: 'CARD', total: summary.paymentBreakdown.CARD },
        { method: 'CREDIT', total: summary.paymentBreakdown.CREDIT }
      ],
      cashPool: summary.cashPool,
      transactions,
    });

  } catch (error) {
    console.error("[Daily Activity Error]:", error);
    res.status(500).json({ error: "Failed to generate daily activity report." });
  }
});

router.get("/monthly-revenue/:shop_id", async (req, res) => {
  const { shop_id } = req.params;
  const { start, end } = req.query;

  const sql = `
    SELECT 
      business_date as date,
      SUM(total_amount) as revenue
    FROM sale_header
    WHERE shop_id = ? AND is_void = 0 AND business_date BETWEEN ? AND ?
    GROUP BY date
    ORDER BY date ASC`;

  try {
    const rows = await dbAll(sql, [shop_id, start, end]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
