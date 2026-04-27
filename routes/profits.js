const express = require('express')
const router = express.Router()
const { db } = require('../Database')

function dateRange(req) {
  const today = new Date().toISOString().split('T')[0]
  return {
    start: req.query.startDate || today,
    end:   req.query.endDate   || today,
  }
}

// ─── Summary KPIs ─────────────────────────────────────────────────────────────
router.get('/profits/summary/:shop_id', (req, res) => {
  const { shop_id } = req.params
  const { start, end } = dateRange(req)

  const q1 = `
    SELECT
      COALESCE(SUM(si.line_total), 0)                                           AS product_revenue,
      COALESCE(SUM(si.quantity * COALESCE(si.unit_cost, im.unit_cost, 0)), 0)                 AS product_cogs,
      COALESCE(SUM(si.line_total - si.quantity * COALESCE(si.unit_cost, im.unit_cost, 0)), 0) AS product_gross
    FROM sale_items si
    JOIN sale_header sh ON si.sale_id = sh.sale_id
    LEFT JOIN item_master im ON si.item_or_service_id = im.item_id
    WHERE sh.shop_id = ? AND si.sale_type IN ('PRODUCT','RECAP')
      AND sh.is_void = 0
      AND DATE(sh.sale_datetime) BETWEEN ? AND ?`

  const q2 = `
    SELECT COALESCE(SUM(commission_amount), 0) AS total_commission
    FROM labor_log
    WHERE shop_id = ? AND is_void = 0 AND commission_amount > 0
      AND DATE(business_date) BETWEEN ? AND ?`

  const q3 = `
    SELECT
      COALESCE(SUM(total_amount), 0)     AS service_revenue,
      COALESCE(SUM(total_amount / 2), 0) AS service_margin
    FROM labor_log
    WHERE shop_id = ? AND is_void = 0 AND commission_amount = 0
      AND DATE(business_date) BETWEEN ? AND ?`

  const q4 = `
    SELECT COALESCE(SUM(pi.line_total), 0) AS material_costs
    FROM purchase_items pi
    JOIN purchase_header ph ON pi.purchase_id = ph.purchase_id
    WHERE ph.shop_id = ? AND pi.category IN ('MATERIAL','OTHER')
      AND ph.purchase_date BETWEEN ? AND ?`

  const q5 = `
    SELECT
      COALESCE(SUM(e.amount), 0) AS total_expenses,
      COUNT(*) AS expense_count
    FROM expenses e
    WHERE e.shop_id = ? AND e.is_void = 0
      AND DATE(e.expense_date) BETWEEN ? AND ?`

  const q6 = `
    SELECT COALESCE(SUM(ph.total_amount), 0) AS total_purchases,
           COUNT(DISTINCT ph.purchase_id)    AS purchase_orders
    FROM purchase_header ph
    WHERE ph.shop_id = ?
      AND ph.purchase_date BETWEEN ? AND ?`

  db.get(q1, [shop_id, start, end], (e1, r1) => {
    if (e1) return res.json({ error: e1.message })
    db.get(q2, [shop_id, start, end], (e2, r2) => {
      if (e2) return res.json({ error: e2.message })
      db.get(q3, [shop_id, start, end], (e3, r3) => {
        if (e3) return res.json({ error: e3.message })
        db.get(q4, [shop_id, start, end], (e4, r4) => {
          if (e4) return res.json({ error: e4.message })
          db.get(q5, [shop_id, start, end], (e5, r5) => {
            if (e5) return res.json({ error: e5.message })
            db.get(q6, [shop_id, start, end], (e6, r6) => {
              if (e6) return res.json({ error: e6.message })

              const product_revenue  = r1.product_revenue  || 0
              const product_cogs     = r1.product_cogs     || 0
              const product_gross    = r1.product_gross    || 0
              const total_commission = r2.total_commission || 0
              const service_revenue  = r3.service_revenue  || 0
              const service_margin   = r3.service_margin   || 0
              const material_costs   = r4.material_costs   || 0
              const total_expenses   = r5.total_expenses   || 0
              const expense_count    = r5.expense_count    || 0
              const total_purchases  = r6.total_purchases  || 0
              const purchase_orders  = r6.purchase_orders  || 0
              const net_tire_profit  = product_gross - total_commission
              const net_profit       = net_tire_profit + service_margin - material_costs - total_expenses
              const total_revenue    = product_revenue + service_revenue
              const total_deductions = product_cogs + total_commission + material_costs + total_expenses

              res.json({
                product_revenue, product_cogs, product_gross,
                product_margin_pct: product_revenue > 0
                  ? ((product_gross / product_revenue) * 100).toFixed(1) : '0.0',
                total_commission, net_tire_profit,
                service_revenue, service_margin,
                material_costs,
                total_expenses, expense_count,
                total_purchases, purchase_orders,
                total_deductions,
                net_profit,
                overall_margin_pct: total_revenue > 0
                  ? ((net_profit / total_revenue) * 100).toFixed(1) : '0.0',
              })
            })
          })
        })
      })
    })
  })
})

// ─── By Category ──────────────────────────────────────────────────────────────
router.get('/profits/by-category/:shop_id', (req, res) => {
  const { shop_id } = req.params
  const { start, end } = dateRange(req)

  const commQ = `
    SELECT DATE(business_date) AS day, COALESCE(SUM(commission_amount), 0) AS commission
    FROM labor_log
    WHERE shop_id = ? AND is_void = 0 AND commission_amount > 0
      AND DATE(business_date) BETWEEN ? AND ?
    GROUP BY DATE(business_date)`

  const catQ = `
    SELECT
      si.category,
      DATE(sh.sale_datetime) AS day,
      COUNT(DISTINCT sh.sale_id)                                                AS transactions,
      COALESCE(SUM(si.quantity), 0)                                             AS total_qty,
      COALESCE(SUM(si.line_total), 0)                                           AS revenue,
      COALESCE(SUM(si.quantity * COALESCE(si.unit_cost, im.unit_cost, 0)), 0)                 AS cogs,
      COALESCE(SUM(si.line_total - si.quantity * COALESCE(si.unit_cost, im.unit_cost, 0)), 0) AS gross_profit
    FROM sale_items si
    JOIN sale_header sh ON si.sale_id = sh.sale_id
    LEFT JOIN item_master im ON si.item_or_service_id = im.item_id
    WHERE sh.shop_id = ? AND si.sale_type IN ('PRODUCT','RECAP')
      AND sh.is_void = 0
      AND DATE(sh.sale_datetime) BETWEEN ? AND ?
    GROUP BY si.category, DATE(sh.sale_datetime)`

  db.all(commQ, [shop_id, start, end], (ce, commRows) => {
    if (ce) return res.json({ error: ce.message })
    db.all(catQ, [shop_id, start, end], (err, catRows) => {
      if (err) return res.json({ error: err.message })

      const dayComm = {}
      ;(commRows || []).forEach(r => { dayComm[r.day] = r.commission })

      const dayRev = {}
      ;(catRows || []).forEach(r => { dayRev[r.day] = (dayRev[r.day] || 0) + r.revenue })

      const cats = {}
      ;(catRows || []).forEach(r => {
        const totalDayRev = dayRev[r.day] || 1
        const catShare    = totalDayRev > 0 ? r.revenue / totalDayRev : 0
        const catComm     = (dayComm[r.day] || 0) * catShare

        if (!cats[r.category]) {
          cats[r.category] = { category: r.category, transactions: 0, total_qty: 0, revenue: 0, cogs: 0, gross_profit: 0, commission: 0 }
        }
        const c = cats[r.category]
        c.transactions += r.transactions
        c.total_qty    += r.total_qty
        c.revenue      += r.revenue
        c.cogs         += r.cogs
        c.gross_profit += r.gross_profit
        c.commission   += catComm
      })

      res.json(
        Object.values(cats)
          .sort((a, b) => b.gross_profit - a.gross_profit)
          .map(c => ({
            ...c,
            net_profit:     c.gross_profit - c.commission,
            margin_pct:     c.revenue > 0 ? ((c.gross_profit / c.revenue) * 100).toFixed(1) : '0.0',
            net_margin_pct: c.revenue > 0 ? (((c.gross_profit - c.commission) / c.revenue) * 100).toFixed(1) : '0.0',
          }))
      )
    })
  })
})

// ─── Top Items by Profit ───────────────────────────────────────────────────────
router.get('/profits/top-items/:shop_id', (req, res) => {
  const { shop_id } = req.params
  const { start, end } = dateRange(req)
  const limit = parseInt(req.query.limit) || 10

  const commQ = `
    SELECT DATE(business_date) AS day, COALESCE(SUM(commission_amount), 0) AS commission
    FROM labor_log
    WHERE shop_id = ? AND is_void = 0 AND commission_amount > 0
      AND DATE(business_date) BETWEEN ? AND ?
    GROUP BY DATE(business_date)`

  const itemQ = `
    SELECT
      si.item_or_service_id, si.item_name, si.brand, si.category,
      DATE(sh.sale_datetime) AS day,
      si.quantity, si.line_total,
      si.quantity * COALESCE(si.unit_cost, im.unit_cost, 0)                    AS item_cogs,
      si.line_total - si.quantity * COALESCE(si.unit_cost, im.unit_cost, 0)    AS item_gross,
      im.unit_cost, im.selling_price,
      SUM(si.line_total) OVER (PARTITION BY DATE(sh.sale_datetime)) AS day_revenue
    FROM sale_items si
    JOIN sale_header sh ON si.sale_id = sh.sale_id
    LEFT JOIN item_master im ON si.item_or_service_id = im.item_id
    WHERE sh.shop_id = ? AND si.sale_type IN ('PRODUCT','RECAP')
      AND sh.is_void = 0
      AND DATE(sh.sale_datetime) BETWEEN ? AND ?`

  db.all(commQ, [shop_id, start, end], (ce, commRows) => {
    if (ce) return res.json({ error: ce.message })
    const dayComm = {}
    ;(commRows || []).forEach(r => { dayComm[r.day] = r.commission })

    db.all(itemQ, [shop_id, start, end], (err, rows) => {
      if (err) return res.json({ error: err.message })

      const items = {}
      ;(rows || []).forEach(r => {
        const dayRev   = r.day_revenue || 1
        const itemComm = (dayComm[r.day] || 0) * (r.line_total / dayRev)

        if (!items[r.item_or_service_id]) {
          items[r.item_or_service_id] = {
            item_or_service_id: r.item_or_service_id,
            item_name: r.item_name, brand: r.brand, category: r.category,
            unit_cost: r.unit_cost, selling_price: r.selling_price,
            total_qty: 0, revenue: 0, cogs: 0, gross_profit: 0, commission: 0,
          }
        }
        const it = items[r.item_or_service_id]
        it.total_qty    += r.quantity
        it.revenue      += r.line_total
        it.cogs         += r.item_cogs
        it.gross_profit += r.item_gross
        it.commission   += itemComm
      })

      res.json(
        Object.values(items)
          .sort((a, b) => b.gross_profit - a.gross_profit)
          .slice(0, limit)
          .map(it => ({
            ...it,
            net_profit: it.gross_profit - it.commission,
            margin_pct: it.revenue > 0
              ? ((it.gross_profit / it.revenue) * 100).toFixed(1) : '0.0',
          }))
      )
    })
  })
})

// ─── Per-Transaction Drilldown ────────────────────────────────────────────────
router.get('/profits/transactions/:shop_id', (req, res) => {
  const { shop_id } = req.params
  const { start, end } = dateRange(req)
  const { q, page, perPage } = req.query
  const paginated = page !== undefined || perPage !== undefined || q !== undefined

  const baseSql = `
    SELECT
      sh.sale_id, sh.invoice_number, sh.sale_datetime, sh.total_amount,
      cm.customer_name, sm.full_name AS staff_name,
      COALESCE(SUM(CASE WHEN si.sale_type IN ('PRODUCT','RECAP') THEN si.line_total ELSE 0 END), 0)                                       AS product_revenue,
      COALESCE(SUM(CASE WHEN si.sale_type IN ('PRODUCT','RECAP') THEN si.quantity * COALESCE(si.unit_cost, im.unit_cost, 0) ELSE 0 END), 0) AS product_cogs,
      COALESCE(SUM(CASE WHEN si.sale_type IN ('PRODUCT','RECAP') THEN si.line_total - si.quantity*COALESCE(si.unit_cost, im.unit_cost, 0) ELSE 0 END), 0) AS gross_profit,
      COALESCE(SUM(CASE WHEN si.sale_type='SERVICE' THEN si.line_total ELSE 0 END), 0)                                       AS service_revenue,
      COALESCE((SELECT SUM(ll.commission_amount) FROM labor_log ll
                WHERE ll.sale_id = sh.sale_id AND ll.is_void = 0 AND ll.commission_amount > 0), 0) AS commission
    FROM sale_header sh
    LEFT JOIN sale_items si ON sh.sale_id = si.sale_id
    LEFT JOIN item_master im ON si.item_or_service_id = im.item_id
    LEFT JOIN customer_master cm ON sh.customer_id = cm.customer_id
    LEFT JOIN staff_master sm ON sh.staff_id = sm.staff_id`

  let where = ` WHERE sh.shop_id = ? AND sh.is_void = 0 AND DATE(sh.sale_datetime) BETWEEN ? AND ?`
  const params = [shop_id, start, end]
  if (paginated && q && String(q).trim()) {
    const like = `%${String(q).trim()}%`
    where += ` AND (sh.invoice_number LIKE ? OR cm.customer_name LIKE ? OR sm.full_name LIKE ?)`
    params.push(like, like, like)
  }

  const groupOrder = ` GROUP BY sh.sale_id ORDER BY sh.sale_datetime DESC`

  function mapRow(r) {
    const net_tire_profit = (r.gross_profit || 0) - (r.commission || 0)
    const service_margin  = (r.service_revenue || 0) / 2
    const net_profit      = net_tire_profit + service_margin
    return {
      ...r, net_tire_profit, service_margin, net_profit,
      margin_pct: r.product_revenue > 0
        ? (((r.gross_profit || 0) / r.product_revenue) * 100).toFixed(1) : '0.0',
    }
  }

  if (!paginated) {
    db.all(baseSql + where + groupOrder, params, (err, rows) => {
      if (err) return res.json({ error: err.message })
      res.json((rows || []).map(mapRow))
    })
    return
  }

  const parsedPage    = Math.max(1, parseInt(page, 10) || 1)
  const parsedPerPage = Math.min(200, Math.max(1, parseInt(perPage, 10) || 20))
  const offset        = (parsedPage - 1) * parsedPerPage

  const countSql = `SELECT COUNT(*) AS total FROM (${baseSql + where + groupOrder})`
  db.get(countSql, params, (cErr, cRow) => {
    if (cErr) return res.status(500).json({ error: cErr.message })
    const total      = cRow?.total || 0
    const totalPages = Math.max(1, Math.ceil(total / parsedPerPage))
    db.all(baseSql + where + groupOrder + ` LIMIT ? OFFSET ?`, [...params, parsedPerPage, offset], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ data: (rows || []).map(mapRow), meta: { page: parsedPage, perPage: parsedPerPage, total, totalCount: total, totalPages } })
    })
  })
})

module.exports = router
