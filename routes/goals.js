const express = require('express')
const router  = express.Router()
const { dbAll, dbGet, dbRun } = require('../lib/db')

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert period_type + period_key to ISO date range { start, end } */
function periodRange(period_type, period_key) {
  if (period_type === 'monthly') {
    const [y, m] = period_key.split('-').map(Number)
    const start  = `${y}-${String(m).padStart(2, '0')}-01`
    const lastDay = new Date(y, m, 0).getDate()
    const end    = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return { start, end }
  }
  if (period_type === 'quarterly') {
    const [ys, qs] = period_key.split('-Q')
    const y = parseInt(ys, 10)
    const q = parseInt(qs, 10)
    const startMonth = (q - 1) * 3 + 1
    const endMonth   = q * 3
    const start  = `${y}-${String(startMonth).padStart(2, '0')}-01`
    const lastDay = new Date(y, endMonth, 0).getDate()
    const end    = `${y}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return { start, end }
  }
  if (period_type === 'annual') {
    return { start: `${period_key}-01-01`, end: `${period_key}-12-31` }
  }
  return null
}

/** Current period keys for all 3 types */
function currentKeys() {
  const now = new Date()
  const y   = now.getFullYear()
  const m   = now.getMonth() + 1
  return {
    monthly:   `${y}-${String(m).padStart(2, '0')}`,
    quarterly: `${y}-Q${Math.ceil(m / 3)}`,
    annual:    `${y}`,
  }
}

/** Compute pace fields for one metric (target may be null) */
function paceFields(target, actual, range) {
  if (target == null) {
    return { pace_target: null, on_pace: null, pace_gap: null, pace_pct: null }
  }
  const startDate = new Date(range.start + 'T00:00:00')
  const endDate   = new Date(range.end   + 'T00:00:00')
  const today     = new Date(); today.setHours(0, 0, 0, 0)

  const msPerDay      = 86400000
  const daysInPeriod  = Math.round((endDate - startDate) / msPerDay) + 1
  const effectiveToday = today <= endDate ? today : endDate
  const daysElapsed   = Math.max(1, Math.round((effectiveToday - startDate) / msPerDay) + 1)
  const daysRemaining = Math.max(0, Math.round((endDate - today) / msPerDay))

  const pace_target = (daysElapsed / daysInPeriod) * target
  const on_pace     = actual >= pace_target
  const pace_gap    = pace_target - actual   // positive = behind pace
  const pace_pct    = pace_target > 0 ? Math.round((pace_gap / pace_target) * 100) : 0

  return { pace_target, on_pace, pace_gap, pace_pct, daysElapsed, daysInPeriod, daysRemaining }
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /goals-progress/:shop_id
 * Returns current monthly/quarterly/annual goals with actuals + pace fields.
 */
router.get('/goals-progress/:shop_id', async (req, res) => {
  try {
    const { shop_id } = req.params
    const keys  = currentKeys()
    const types = ['monthly', 'quarterly', 'annual']

    // Fetch all 3 goal rows in one query
    const goalsRows = await dbAll(
      `SELECT * FROM revenue_goals WHERE shop_id = ? AND period_key IN (?, ?, ?)`,
      [shop_id, keys.monthly, keys.quarterly, keys.annual]
    )
    const goalsMap = {}
    for (const g of goalsRows) goalsMap[g.period_type] = g

    const result = {}

    for (const type of types) {
      const key   = keys[type]
      const goal  = goalsMap[type] || null
      const range = periodRange(type, key)

      // Compute actuals in parallel — same formula as Sales Projection / Profits page
      const [prodRow, commRow, svcRow, expRow] = await Promise.all([
        // Gross sales revenue + COGS → product_gross
        dbGet(
          `SELECT COALESCE(SUM(si.line_total), 0) AS revenue,
                  COALESCE(SUM(si.line_total - si.quantity * COALESCE(si.unit_cost, im.unit_cost, 0)), 0) AS product_gross
           FROM sale_items si
           JOIN sale_header sh ON si.sale_id = sh.sale_id
           LEFT JOIN item_master im ON si.item_or_service_id = im.item_id
           WHERE sh.shop_id = ? AND si.sale_type IN ('PRODUCT','RECAP')
             AND sh.is_void = 0 AND DATE(sh.sale_datetime) BETWEEN ? AND ?`,
          [shop_id, range.start, range.end]
        ),
        // Staff commissions from labor_log (product sales commission)
        dbGet(
          `SELECT COALESCE(SUM(commission_amount), 0) AS total_commission
           FROM labor_log
           WHERE shop_id = ? AND is_void = 0 AND commission_amount > 0
             AND DATE(business_date) BETWEEN ? AND ?`,
          [shop_id, range.start, range.end]
        ),
        // Service revenue + margin (shop keeps half of flat-fee services)
        dbGet(
          `SELECT COALESCE(SUM(total_amount), 0)       AS service_revenue,
                  COALESCE(SUM(total_amount / 2), 0)   AS service_margin
           FROM labor_log
           WHERE shop_id = ? AND is_void = 0 AND commission_amount = 0
             AND DATE(business_date) BETWEEN ? AND ?`,
          [shop_id, range.start, range.end]
        ),
        // Operating expenses
        dbGet(
          `SELECT COALESCE(SUM(amount), 0) AS expenses
           FROM expenses
           WHERE shop_id = ? AND is_void = 0 AND DATE(expense_date) BETWEEN ? AND ?`,
          [shop_id, range.start, range.end]
        ),
      ])

      const product_revenue  = prodRow?.revenue          || 0
      const product_gross    = prodRow?.product_gross    || 0
      const total_commission = commRow?.total_commission || 0
      const service_revenue  = svcRow?.service_revenue   || 0
      const service_margin   = svcRow?.service_margin    || 0
      const expenses         = expRow?.expenses          || 0

      const actual_revenue = product_revenue + service_revenue
      const actual_profit  = (product_gross - total_commission) + service_margin - expenses

      const revenue_target = goal?.revenue_target ?? null
      const profit_target  = goal?.profit_target  ?? null

      // Pace for revenue
      const revPace = paceFields(revenue_target, actual_revenue, range)
      // Pace for profit
      const prfPace = paceFields(profit_target,  actual_profit,  range)

      // Day counts come from whichever pace object has them (revenue always has, profit has same)
      const daysElapsed   = revPace.daysElapsed   ?? prfPace.daysElapsed   ?? null
      const daysInPeriod  = revPace.daysInPeriod  ?? prfPace.daysInPeriod  ?? null
      const daysRemaining = revPace.daysRemaining ?? prfPace.daysRemaining ?? null

      result[type] = {
        period_key:      key,
        period_start:    range.start,
        period_end:      range.end,
        days_elapsed:    daysElapsed,
        days_in_period:  daysInPeriod,
        days_remaining:  daysRemaining,
        revenue_target,
        profit_target,
        actual_revenue,
        actual_profit,
        // Revenue pace
        pace_revenue_target: revPace.pace_target,
        revenue_on_pace:     revPace.on_pace,
        revenue_pace_gap:    revPace.pace_gap,
        revenue_pace_pct:    revPace.pace_pct,
        // Profit pace
        pace_profit_target:  prfPace.pace_target,
        profit_on_pace:      prfPace.on_pace,
        profit_pace_gap:     prfPace.pace_gap,
        profit_pace_pct:     prfPace.pace_pct,
      }
    }

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * PUT /goals/:shop_id
 * Upsert a goal for a given period_type + period_key.
 * Body: { period_type, period_key, revenue_target, profit_target }
 */
router.put('/goals/:shop_id', async (req, res) => {
  try {
    const { shop_id } = req.params
    const { period_type, period_key, revenue_target, profit_target } = req.body || {}

    if (!period_type || !period_key) {
      return res.status(400).json({ error: 'period_type and period_key are required' })
    }
    if (!['monthly', 'quarterly', 'annual'].includes(period_type)) {
      return res.status(400).json({ error: 'period_type must be monthly, quarterly, or annual' })
    }

    const revTarget = revenue_target != null ? Number(revenue_target) : null
    const prfTarget = profit_target  != null ? Number(profit_target)  : null

    await dbRun(
      `INSERT INTO revenue_goals (shop_id, period_type, period_key, revenue_target, profit_target, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(shop_id, period_type, period_key) DO UPDATE SET
         revenue_target = excluded.revenue_target,
         profit_target  = excluded.profit_target,
         updated_at     = datetime('now')`,
      [shop_id, period_type, period_key, revTarget, prfTarget]
    )

    const row = await dbGet(
      `SELECT * FROM revenue_goals WHERE shop_id = ? AND period_type = ? AND period_key = ?`,
      [shop_id, period_type, period_key]
    )
    res.json(row)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /goals-history/:shop_id
 * All historical goals for a shop, newest first, paginated.
 */
router.get('/goals-history/:shop_id', async (req, res) => {
  try {
    const { shop_id } = req.params
    const page    = Math.max(1, parseInt(req.query.page    || '1',  10))
    const perPage = Math.min(100, parseInt(req.query.perPage || '20', 10))
    const offset  = (page - 1) * perPage

    const [countRow, rows] = await Promise.all([
      dbGet(`SELECT COUNT(*) AS total FROM revenue_goals WHERE shop_id = ?`, [shop_id]),
      dbAll(
        `SELECT * FROM revenue_goals WHERE shop_id = ? ORDER BY period_type, period_key DESC LIMIT ? OFFSET ?`,
        [shop_id, perPage, offset]
      ),
    ])

    const total = countRow?.total || 0
    res.json({
      data: rows,
      meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
