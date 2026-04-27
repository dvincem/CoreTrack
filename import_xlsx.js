/**
 * Import backup.xlsx → tire_shop.db
 * Clears and reloads each table from the spreadsheet.
 */
const path  = require('path')
const XLSX  = require('xlsx')
const sqlite3 = require('sqlite3').verbose()

const DB_PATH   = path.join(__dirname, 'tire_shop.db')
const XLSX_PATH = path.join(__dirname, 'backup.xlsx')

// Import order (parents before children to satisfy FK constraints)
const IMPORT_ORDER = [
  'shop_master',
  'staff_master',
  'supplier_master',
  'item_master',
  'services_master',
  'commission_rules',
  'customer_master',
  'staff_attendance',
  'inventory_ledger',
  'current_stock',
  'sale_header',
  'sale_items',
  'sales_ledger',
  'orders',
  'order_items',
  'recap_job_master',
  'recap_job_ledger',
  'recap_price_defaults',
  'accounts_receivable',
  'receivable_payments',
  'accounts_payable',
  'payable_payments',
  'labor_log',
  'staff_daily_revenue',
  'expenses',
  'expense_categories',
  'cash_ledger',
  'bale_book',
  'bale_payments',
  'returns',
  'payment_ledger',
  'item_price_history',
]

// Column name mappings: xlsx_col → db_col (per table)
const COL_MAP = {
  staff_master:    { contacts: 'email' },
  supplier_master: { active_status: 'is_active' },
}

const db = new sqlite3.Database(DB_PATH)

function run(sql, params = []) {
  return new Promise((res, rej) => db.run(sql, params, err => err ? rej(err) : res()))
}

function all(sql, params = []) {
  return new Promise((res, rej) => db.all(sql, params, (err, rows) => err ? rej(err) : res(rows || [])))
}

async function getDbColumns(table) {
  const rows = await all(`PRAGMA table_info(${table})`)
  return rows.map(r => r.name)
}

async function importTable(table, rows) {
  const map = COL_MAP[table] || {}

  // Remap column names
  const mapped = rows.map(row => {
    const out = {}
    for (const [k, v] of Object.entries(row)) {
      const col = map[k] || k
      out[col] = v
    }
    return out
  })

  // Get actual DB columns to filter out xlsx columns that don't exist
  let dbCols
  try {
    dbCols = await getDbColumns(table)
  } catch {
    console.log(`  ⚠️  Table "${table}" not found in DB — skipping`)
    return
  }

  if (dbCols.length === 0) {
    console.log(`  ⚠️  Table "${table}" has no columns — skipping`)
    return
  }

  // Clear table
  await run(`DELETE FROM ${table}`)

  if (mapped.length === 0) {
    console.log(`  ✓  ${table}: cleared (0 rows in xlsx)`)
    return
  }

  // Filter to only columns that exist in DB
  const useCols = Object.keys(mapped[0]).filter(c => dbCols.includes(c))
  if (useCols.length === 0) {
    console.log(`  ⚠️  ${table}: no matching columns — skipping`)
    return
  }

  const placeholders = useCols.map(() => '?').join(', ')
  const colList = useCols.map(c => `"${c}"`).join(', ')
  const sql = `INSERT OR REPLACE INTO ${table} (${colList}) VALUES (${placeholders})`

  let inserted = 0
  for (const row of mapped) {
    const vals = useCols.map(c => row[c] !== undefined ? row[c] : null)
    try {
      await run(sql, vals)
      inserted++
    } catch (e) {
      console.log(`  ⚠️  ${table} row error: ${e.message}`, vals)
    }
  }

  console.log(`  ✓  ${table}: ${inserted} rows imported`)
}

async function main() {
  console.log(`\n📥  Reading ${XLSX_PATH}`)
  const wb = XLSX.readFile(XLSX_PATH)

  // Build sheet lookup (uppercase sheet name → rows)
  const sheets = {}
  for (const name of wb.SheetNames) {
    sheets[name.toUpperCase()] = XLSX.utils.sheet_to_json(wb.Sheets[name])
  }

  console.log(`\n🗄️  Importing into ${DB_PATH}\n`)

  await run('PRAGMA foreign_keys = OFF')

  for (const table of IMPORT_ORDER) {
    const sheetName = table.toUpperCase()
    const rows = sheets[sheetName]
    if (rows === undefined) {
      console.log(`  –  ${table}: no sheet found, skipping`)
      continue
    }
    await importTable(table, rows)
  }

  await run('PRAGMA foreign_keys = ON')

  console.log('\n✅  Import complete.\n')
  db.close()
}

main().catch(err => {
  console.error('❌  Import failed:', err.message)
  db.close()
  process.exit(1)
})
