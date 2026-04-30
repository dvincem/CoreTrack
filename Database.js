const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");
const { v4: uuidv4 } = require("uuid");

// ─── Connection ───────────────────────────────────────────────────────────────
const dbPath = path.join(__dirname, "tire_shop.db");

// Only wipe DB if RESET_DB=1 env var is set (e.g. `RESET_DB=1 node server.js`)
if (process.env.RESET_DB === '1') {
  try {
    require("fs").unlinkSync(dbPath);
    console.log("🗑️  Cleared old database — rebuilding from Excel...");
  } catch (_) { }
} else {
  console.log("♻️  Reusing existing database — data will be preserved.");
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("Database connection error:", err);
  else console.log("Connected to SQLite database");
});

// Performance & concurrency settings — must run before any writes
db.run("PRAGMA journal_mode = WAL");      // concurrent reads during writes
db.run("PRAGMA synchronous = NORMAL");    // safe + faster than FULL
db.run("PRAGMA cache_size = -16000");     // 16 MB page cache
db.run("PRAGMA temp_store = MEMORY");     // temp tables stay in RAM
db.run("PRAGMA foreign_keys = ON");

// ── Always-run migrations (safe: errors silently ignored if column exists) ────

// Migrate cash_ledger: remove strict CHECK constraint to allow CARD_IN/OUT, BANK_IN/OUT
db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='cash_ledger'", (err, row) => {
  if (!err && row && row.sql && row.sql.includes("CHECK(entry_type IN ('CASH_IN','CASH_OUT','GCASH_IN','GCASH_OUT'))")) {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS cash_ledger_v2 (
        entry_id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        entry_type TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT NOT NULL,
        entry_date DATE NOT NULL,
        entry_time TEXT,
        notes TEXT,
        recorded_by TEXT,
        is_void BOOLEAN DEFAULT 0,
        void_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (shop_id) REFERENCES shop_master(shop_id)
      )`);
      db.run(`INSERT OR IGNORE INTO cash_ledger_v2 SELECT * FROM cash_ledger`);
      db.run(`DROP TABLE IF EXISTS cash_ledger`);
      db.run(`ALTER TABLE cash_ledger_v2 RENAME TO cash_ledger`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_cash_ledger_shop_date ON cash_ledger(shop_id, entry_date)`);
    });
  }
});

// Migrate returns: remove item_id foreign key to allow custom/misc item returns
db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='returns'", (err, row) => {
  if (!err && row && row.sql && row.sql.includes("FOREIGN KEY (item_id) REFERENCES item_master(item_id)")) {
    console.log("🛠️  Migrating returns table to remove item_id Foreign Key (supporting custom items)...");
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      // 1. Create a temporary table with the correct schema (no item_id FK)
      db.run(`CREATE TABLE returns_new (
        return_id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        return_type TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        item_id TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit_cost REAL DEFAULT 0,
        original_sale_id TEXT,
        original_sale_item_id TEXT,
        original_order_id TEXT,
        original_order_item_id TEXT,
        supplier_id TEXT,
        linked_inventory_tx_id TEXT,
        replacement_return_id TEXT,
        dot_number TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        processed_at DATETIME,
        processed_by TEXT,
        return_scenario TEXT DEFAULT 'FULL_REFUND',
        refund_method TEXT,
        replacement_item_id TEXT,
        warranty_sent_at DATETIME,
        warranty_result TEXT,
        warranty_ref TEXT,
        customer_name TEXT,
        FOREIGN KEY (shop_id) REFERENCES shop_master(shop_id)
      )`);
      // 2. Copy data from old to new
      db.run(`INSERT INTO returns_new SELECT 
        return_id, shop_id, return_type, reason, status, item_id, quantity, unit_cost,
        original_sale_id, original_sale_item_id, original_order_id, original_order_item_id,
        supplier_id, linked_inventory_tx_id, replacement_return_id, dot_number, notes,
        created_at, created_by, processed_at, processed_by,
        COALESCE(return_scenario, 'FULL_REFUND'), refund_method, replacement_item_id,
        warranty_sent_at, warranty_result, warranty_ref, customer_name
        FROM returns`);
      // 3. Swap tables
      db.run(`DROP TABLE returns`);
      db.run(`ALTER TABLE returns_new RENAME TO returns`);
      // 4. Re-create index
      db.run(`CREATE INDEX IF NOT EXISTS idx_returns_shop ON returns(shop_id, created_at)`);
      db.run("COMMIT");
      console.log("✅ Returns table migration complete.");
    });
  }
});

db.serialize(() => {
  db.run(`ALTER TABLE labor_log ADD COLUMN sale_id TEXT`, () => { });
  db.run(`ALTER TABLE item_master ADD COLUMN reorder_point INTEGER DEFAULT 5`, () => { });
  db.run(`ALTER TABLE item_master ADD COLUMN supplier_id TEXT`, () => { });
  db.run(`ALTER TABLE item_master ADD COLUMN dot_number TEXT`, () => { });
  db.run(`ALTER TABLE item_master ADD COLUMN parent_item_id TEXT`, () => { });
  db.run(`ALTER TABLE inventory_ledger ADD COLUMN supplier_id TEXT`, () => { });
  db.run(`ALTER TABLE order_items ADD COLUMN supplier_id TEXT`, () => { });
  db.run(`ALTER TABLE order_items ADD COLUMN is_new_item INTEGER DEFAULT 0`, () => { });
  db.run(`ALTER TABLE recap_job_master ADD COLUMN dot_number TEXT`, () => { });
  db.run(`ALTER TABLE services_master ADD COLUMN commission_rate REAL DEFAULT 0`, () => { });
  db.run(`ALTER TABLE sale_header ADD COLUMN payment_method TEXT DEFAULT 'CASH'`, () => { });
  db.run(`ALTER TABLE sale_header ADD COLUMN payment_splits TEXT`, () => { });
  db.run(`ALTER TABLE accounts_receivable ADD COLUMN receivable_type TEXT`, () => { });
  db.run(`ALTER TABLE accounts_receivable ADD COLUMN description TEXT`, () => { });
  db.run(`ALTER TABLE accounts_receivable ADD COLUMN down_payment REAL DEFAULT 0`, () => { });
  db.run(`ALTER TABLE accounts_receivable ADD COLUMN due_date TEXT`, () => { });
  db.run(`ALTER TABLE accounts_receivable ADD COLUMN notes TEXT`, () => { });
  db.run(`ALTER TABLE inventory_ledger ADD COLUMN dot_number TEXT`, () => { });
  db.run(`ALTER TABLE order_items ADD COLUMN dot_number TEXT`, () => { });
  db.run(`ALTER TABLE sale_header ADD COLUMN is_void INTEGER DEFAULT 0`, () => { });
  db.run(`ALTER TABLE sale_header ADD COLUMN void_reason TEXT`, () => { });
  db.run(`ALTER TABLE purchase_header ADD COLUMN handled_by TEXT`, () => { });
  db.run(`ALTER TABLE purchase_header ADD COLUMN supplier_id TEXT`, () => { });
  db.run(`ALTER TABLE sale_header ADD COLUMN credit_down_payment REAL DEFAULT 0`, () => { });
  db.run(`ALTER TABLE sale_header ADD COLUMN business_date DATE`, () => {
    // Set default business_date to DATE(sale_datetime) for existing records
    db.run(`UPDATE sale_header SET business_date = DATE(sale_datetime) WHERE business_date IS NULL`, () => { });
  });
  db.run(`ALTER TABLE staff_master ADD COLUMN profile_picture TEXT`, () => { });
});

// Add brand_assets table if it doesn't exist (safe migration)
db.run(`CREATE TABLE IF NOT EXISTS brand_assets (
  brand_name TEXT PRIMARY KEY,
  logo_url TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`, () => {});

// ─── Schema ───────────────────────────────────────────────────────────────────
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS shop_master (
        shop_id TEXT PRIMARY KEY,
        shop_code TEXT UNIQUE NOT NULL,
        shop_name TEXT NOT NULL,
        address TEXT,
        is_active BOOLEAN DEFAULT 1,
        is_closed BOOLEAN DEFAULT 0,
        last_closed_at DATETIME,
        last_opened_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      db.run(`ALTER TABLE shop_master ADD COLUMN is_closed BOOLEAN DEFAULT 0`, () => { });
      db.run(`ALTER TABLE shop_master ADD COLUMN last_closed_at DATETIME`, () => { });
      db.run(`ALTER TABLE shop_master ADD COLUMN last_opened_at DATETIME`, () => { });

      db.run(`CREATE TABLE IF NOT EXISTS daily_closures (
        closure_id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        business_date DATE NOT NULL,
        gross_sales REAL DEFAULT 0,
        gross_services REAL DEFAULT 0,
        total_expenses REAL DEFAULT 0,
        total_purchases REAL DEFAULT 0,
        net_profit REAL DEFAULT 0,
        cash_on_hand REAL DEFAULT 0,
        digital_total REAL DEFAULT 0,
        closed_by TEXT,
        closed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(shop_id, business_date),
        FOREIGN KEY (shop_id) REFERENCES shop_master(shop_id)
      )`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_daily_closures_shop ON daily_closures(shop_id, business_date DESC)`);

      db.run(`CREATE TABLE IF NOT EXISTS item_master (
        item_id TEXT PRIMARY KEY,
        sku TEXT UNIQUE NOT NULL,
        item_name TEXT NOT NULL,
        category TEXT,
        brand TEXT,
        design TEXT,
        size TEXT,
        rim_size REAL,
        unit_cost REAL,
        selling_price REAL NOT NULL DEFAULT 0,
        unit TEXT DEFAULT 'PCS',
        supplier_id TEXT,
        reorder_point INTEGER DEFAULT 5,
        dot_number TEXT,
        parent_item_id TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS item_price_history (
        history_id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        price_type TEXT NOT NULL,
        old_price REAL,
        new_price REAL NOT NULL,
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        changed_by TEXT,
        notes TEXT,
        FOREIGN KEY (item_id) REFERENCES item_master(item_id)
      )`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_price_history_item ON item_price_history(item_id, changed_at DESC)`);

      db.run(`CREATE TABLE IF NOT EXISTS services_master (
        service_id TEXT PRIMARY KEY,
        service_code TEXT UNIQUE NOT NULL,
        service_name TEXT NOT NULL,
        base_price REAL NOT NULL,
        is_commissionable BOOLEAN DEFAULT 1,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS staff_master (
        staff_id TEXT PRIMARY KEY,
        staff_code TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT,
        role TEXT,
        is_active BOOLEAN DEFAULT 1,
        work_status TEXT DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      db.run(`ALTER TABLE staff_master ADD COLUMN work_status TEXT DEFAULT 'ACTIVE'`, () => { });

      db.run(`CREATE TABLE IF NOT EXISTS user_credentials (
        credential_id TEXT PRIMARY KEY,
        staff_id TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        pin_hash TEXT NOT NULL,
        must_change_pin BOOLEAN DEFAULT 1,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_changed_at DATETIME,
        FOREIGN KEY (staff_id) REFERENCES staff_master(staff_id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS user_page_access (
        credential_id TEXT NOT NULL,
        page_id TEXT NOT NULL,
        PRIMARY KEY (credential_id, page_id),
        FOREIGN KEY (credential_id) REFERENCES user_credentials(credential_id) ON DELETE CASCADE
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS user_system_roles (
        credential_id TEXT NOT NULL,
        role TEXT NOT NULL,
        granted_by TEXT,
        granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (credential_id, role),
        FOREIGN KEY (credential_id) REFERENCES user_credentials(credential_id) ON DELETE CASCADE
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS supplier_master (
        supplier_id TEXT PRIMARY KEY,
        shop_id TEXT,
        supplier_code TEXT UNIQUE NOT NULL,
        supplier_name TEXT NOT NULL,
        supplier_type TEXT,
        contact_person TEXT,
        contact_number TEXT,
        email_address TEXT,
        address TEXT,
        default_payment_terms_days INTEGER,
        active_status BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        updated_at DATETIME,
        updated_by TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS supplier_brands (
        brand_id TEXT PRIMARY KEY,
        supplier_id TEXT NOT NULL,
        brand_name TEXT NOT NULL,
        item_type TEXT NOT NULL,
        brand_origin TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES supplier_master(supplier_id),
        UNIQUE(supplier_id, brand_name, item_type)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS commission_rules (
        rule_id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        min_rim_size REAL,
        max_rim_size REAL,
        valve_type TEXT,
        commission_amount REAL NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS staff_attendance (
        attendance_id TEXT PRIMARY KEY,
        staff_id TEXT NOT NULL,
        shop_id TEXT NOT NULL,
        attendance_date DATE NOT NULL,
        status TEXT DEFAULT 'PRESENT',
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_id) REFERENCES staff_master(staff_id),
        FOREIGN KEY (shop_id) REFERENCES shop_master(shop_id),
        UNIQUE(staff_id, attendance_date)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS sale_header (
        sale_id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        sale_datetime DATETIME NOT NULL,
        staff_id TEXT NOT NULL,
        total_amount REAL NOT NULL,
        payment_status TEXT DEFAULT 'PENDING',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        tireman_ids TEXT,
        tireman_commission_total REAL,
        customer_id TEXT,
        sale_notes TEXT,
        invoice_number TEXT,
        payment_method TEXT DEFAULT 'CASH',
        payment_splits TEXT,
        credit_down_payment REAL DEFAULT 0,
        FOREIGN KEY (shop_id) REFERENCES shop_master(shop_id),
        FOREIGN KEY (staff_id) REFERENCES staff_master(staff_id)
      )`);
      db.run(`ALTER TABLE sale_header ADD COLUMN tireman_ids TEXT`, () => { });
      db.run(`ALTER TABLE sale_header ADD COLUMN tireman_commission_total REAL`, () => { });
      db.run(`ALTER TABLE sale_header ADD COLUMN customer_id TEXT`, () => { });
      db.run(`ALTER TABLE sale_header ADD COLUMN sale_notes TEXT`, () => { });
      db.run(`ALTER TABLE sale_header ADD COLUMN invoice_number TEXT`, () => { });

      db.run(`CREATE TABLE IF NOT EXISTS sale_items (
        sale_item_id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL,
        item_or_service_id TEXT NOT NULL,
        item_name TEXT NOT NULL,
        sale_type TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        line_total REAL NOT NULL,
        sku TEXT,
        brand TEXT,
        design TEXT,
        tire_size TEXT,
        category TEXT,
        valve_type TEXT,
        valve_quantity REAL,
        wheel_balancing BOOLEAN,
        balancing_quantity REAL,
        wheel_weights_qty REAL,
        commission_amount REAL DEFAULT 0,
        unit_cost REAL,
        dot_number TEXT,
        is_custom BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES sale_header(sale_id)
      )`);
      db.run(`ALTER TABLE sale_items ADD COLUMN dot_number TEXT`, () => { });

      db.run(`CREATE TABLE IF NOT EXISTS sales_ledger (
        sales_ledger_id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL UNIQUE,
        shop_id TEXT NOT NULL,
        staff_id TEXT NOT NULL,
        sale_datetime DATETIME NOT NULL,
        total_amount REAL NOT NULL,
        payment_status TEXT DEFAULT 'PENDING',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT DEFAULT 'POS',
        FOREIGN KEY (sale_id) REFERENCES sale_header(sale_id),
        FOREIGN KEY (shop_id) REFERENCES shop_master(shop_id),
        FOREIGN KEY (staff_id) REFERENCES staff_master(staff_id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS sales_ledger_items (
        sales_ledger_item_id TEXT PRIMARY KEY,
        sales_ledger_id TEXT NOT NULL,
        sale_id TEXT NOT NULL,
        item_or_service_id TEXT NOT NULL,
        item_name TEXT NOT NULL,
        sale_type TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        line_total REAL NOT NULL,
        sku TEXT,
        brand TEXT,
        design TEXT,
        tire_size TEXT,
        category TEXT,
        valve_type TEXT,
        valve_quantity REAL,
        wheel_balancing BOOLEAN,
        balancing_quantity REAL,
        wheel_weights_qty REAL,
        commission_amount REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sales_ledger_id) REFERENCES sales_ledger(sales_ledger_id),
        FOREIGN KEY (sale_id) REFERENCES sale_header(sale_id),
        FOREIGN KEY (item_or_service_id) REFERENCES item_master(item_id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS inventory_ledger (
        inventory_ledger_id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        transaction_type TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit_cost REAL,
        reference_id TEXT,
        supplier_id TEXT,
        dot_number TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        FOREIGN KEY (shop_id) REFERENCES shop_master(shop_id),
        FOREIGN KEY (item_id) REFERENCES item_master(item_id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS current_stock (
        shop_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        current_quantity REAL DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (shop_id, item_id),
        FOREIGN KEY (shop_id) REFERENCES shop_master(shop_id),
        FOREIGN KEY (item_id) REFERENCES item_master(item_id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS customer_master (
        customer_id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        customer_code TEXT NOT NULL UNIQUE,
        customer_name TEXT NOT NULL,
        company TEXT,
        contact_number TEXT,
        tin_number TEXT,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (shop_id) REFERENCES shop_master(shop_id)
      )`);
      db.run(`ALTER TABLE customer_master ADD COLUMN tin_number TEXT`, () => { });

      db.run(`CREATE TABLE IF NOT EXISTS vehicle_plates (
        plate_id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        plate_number TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customer_master(customer_id),
        UNIQUE(customer_id, plate_number)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS recap_job_master (
        recap_job_id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        ownership_type TEXT,
        customer_id TEXT,
        source_item_id TEXT,
        finished_item_id TEXT,
        casing_description TEXT,
        intake_date TEXT,
        supplier_id TEXT,
        recap_cost REAL,
        expected_selling_price REAL,
        current_status TEXT DEFAULT 'INTAKE',
        return_date TEXT,
        claim_deadline_date TEXT,
        forfeited_flag BOOLEAN DEFAULT 0,
        forfeited_date TEXT,
        forfeited_by_staff_id TEXT,
        forfeiture_reason TEXT,
        related_sale_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        closed_at DATETIME,
        dot_number TEXT,
        FOREIGN KEY (shop_id) REFERENCES shop_master(shop_id),
        FOREIGN KEY (customer_id) REFERENCES customer_master(customer_id),
        FOREIGN KEY (supplier_id) REFERENCES supplier_master(supplier_id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS recap_job_ledger (
        recap_job_ledger_id TEXT PRIMARY KEY,
        recap_job_id TEXT NOT NULL,
        shop_id TEXT NOT NULL,
        event_type TEXT,
        previous_status TEXT,
        new_status TEXT,
        ownership_before TEXT,
        ownership_after TEXT,
        event_reason TEXT,
        related_inventory_ledger_id TEXT,
        related_sale_id TEXT,
        performed_by_staff_id TEXT,
        performer_role TEXT,
        event_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        system_note TEXT,
        FOREIGN KEY (recap_job_id) REFERENCES recap_job_master(recap_job_id),
        FOREIGN KEY (shop_id) REFERENCES shop_master(shop_id),
        FOREIGN KEY (performed_by_staff_id) REFERENCES staff_master(staff_id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS accounts_receivable (
        receivable_id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        sale_id TEXT,
        receivable_type TEXT DEFAULT 'GENERAL',
        description TEXT,
        original_amount REAL NOT NULL,
        down_payment REAL DEFAULT 0,
        amount_paid REAL DEFAULT 0,
        balance_amount REAL NOT NULL,
        due_date TEXT,
        notes TEXT,
        status TEXT DEFAULT 'OPEN',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        closed_at DATETIME,
        FOREIGN KEY (shop_id) REFERENCES shop_master(shop_id),
        FOREIGN KEY (customer_id) REFERENCES customer_master(customer_id),
        FOREIGN KEY (sale_id) REFERENCES sale_header(sale_id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS receivable_payments (
        payment_id TEXT PRIMARY KEY,
        receivable_id TEXT NOT NULL,
        shop_id TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_date TEXT NOT NULL,
        payment_method TEXT DEFAULT 'CASH',
        notes TEXT,
        recorded_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (receivable_id) REFERENCES accounts_receivable(receivable_id)
      )`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_rcv_shop ON accounts_receivable(shop_id, status)`);

      db.run(`CREATE TABLE IF NOT EXISTS accounts_payable (
        payable_id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        payable_type TEXT DEFAULT 'GENERAL',
        supplier_id TEXT,
        payee_name TEXT,
        reference_id TEXT,
        description TEXT,
        notes TEXT,
        original_amount REAL NOT NULL,
        amount_paid REAL DEFAULT 0,
        balance_amount REAL NOT NULL,
        status TEXT DEFAULT 'OPEN',
        due_date DATE,
        recurring_group_id TEXT,
        recurring_installment INTEGER,
        recurring_total INTEGER,
        recurring_indefinite INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        closed_at DATETIME,
        FOREIGN KEY (shop_id) REFERENCES shop_master(shop_id),
        FOREIGN KEY (supplier_id) REFERENCES supplier_master(supplier_id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS payable_payments (
        payment_id TEXT PRIMARY KEY,
        payable_id TEXT NOT NULL,
        shop_id TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_date TEXT NOT NULL,
        payment_method TEXT DEFAULT 'CASH',
        check_number TEXT,
        bank TEXT,
        check_date TEXT,
        release_date TEXT,
        check_status TEXT DEFAULT 'CLEARED',
        funded_date TEXT,
        notes TEXT,
        recorded_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (payable_id) REFERENCES accounts_payable(payable_id)
      )`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_payable_shop ON accounts_payable(shop_id, status)`);

      db.run(`CREATE TABLE IF NOT EXISTS payment_ledger (
        payment_id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        reference_type TEXT,
        reference_id TEXT,
        payer_type TEXT,
        payer_id TEXT,
        payment_method TEXT,
        amount REAL NOT NULL,
        payment_date TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        recorded_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (shop_id) REFERENCES shop_master(shop_id)
      )`);

      db.run(
        `CREATE TABLE IF NOT EXISTS staff_daily_revenue (
        payout_id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        staff_id TEXT NOT NULL,
        business_date DATE NOT NULL,
        service_total REAL DEFAULT 0,
        commission_total REAL DEFAULT 0,
        final_payout REAL DEFAULT 0,
        approved_by TEXT,
        approved_at DATETIME,
        generated_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (shop_id) REFERENCES shop_master(shop_id),
        FOREIGN KEY (staff_id) REFERENCES staff_master(staff_id),
        UNIQUE(shop_id, staff_id, business_date)
      )`,
        (err) => {
          if (err) {
            reject(err);
            return;
          }

          db.run(`CREATE TABLE IF NOT EXISTS orders (
            order_id TEXT PRIMARY KEY,
            shop_id TEXT NOT NULL,
            status TEXT DEFAULT 'PENDING',
            total_amount REAL DEFAULT 0,
            order_notes TEXT,
            delivery_receipt TEXT,
            payment_mode TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT,
            received_at DATETIME,
            received_by TEXT,
            FOREIGN KEY (shop_id) REFERENCES shop_master(shop_id)
          )`);

          db.run(`CREATE TABLE IF NOT EXISTS order_items (
            order_item_id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            item_id TEXT NOT NULL,
            quantity REAL NOT NULL,
            unit_cost REAL NOT NULL,
            line_total REAL NOT NULL,
            received_status TEXT DEFAULT 'PENDING',
            not_received_reason TEXT,
            supplier_id TEXT,
            is_new_item INTEGER DEFAULT 0,
            dot_number TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(order_id),
            FOREIGN KEY (item_id) REFERENCES item_master(item_id)
          )`);

          db.run(`ALTER TABLE services_master ADD COLUMN commission_rate REAL DEFAULT 0`, () => { });
          db.run(`ALTER TABLE sale_header ADD COLUMN payment_method TEXT DEFAULT 'CASH'`, () => { });
          db.run(`ALTER TABLE sale_header ADD COLUMN payment_splits TEXT`, () => { });

          db.run(`CREATE TABLE IF NOT EXISTS expense_categories (
            category_id TEXT PRIMARY KEY,
            shop_id TEXT NOT NULL,
            name TEXT NOT NULL,
            color TEXT DEFAULT '#f97316',
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (shop_id) REFERENCES shop_master(shop_id)
          )`);

          db.run(`CREATE TABLE IF NOT EXISTS expenses (
            expense_id TEXT PRIMARY KEY,
            shop_id TEXT NOT NULL,
            category_id TEXT,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            expense_date DATE NOT NULL,
            payment_method TEXT DEFAULT 'CASH',
            reference_no TEXT,
            notes TEXT,
            recorded_by TEXT,
            is_void BOOLEAN DEFAULT 0,
            void_reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (shop_id) REFERENCES shop_master(shop_id),
            FOREIGN KEY (category_id) REFERENCES expense_categories(category_id)
          )`);

          db.run(`CREATE INDEX IF NOT EXISTS idx_expenses_shop_date ON expenses(shop_id, expense_date)`, () => { });

          db.run(`CREATE TABLE IF NOT EXISTS cash_ledger (
            entry_id TEXT PRIMARY KEY,
            shop_id TEXT NOT NULL,
            entry_type TEXT NOT NULL CHECK(entry_type IN ('CASH_IN','CASH_OUT','GCASH_IN','GCASH_OUT')),
            amount REAL NOT NULL,
            description TEXT NOT NULL,
            entry_date DATE NOT NULL,
            entry_time TEXT,
            notes TEXT,
            recorded_by TEXT,
            is_void BOOLEAN DEFAULT 0,
            void_reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (shop_id) REFERENCES shop_master(shop_id)
          )`);

          db.run(`CREATE INDEX IF NOT EXISTS idx_cash_ledger_shop_date ON cash_ledger(shop_id, entry_date)`, () => { });

          db.run(`CREATE TABLE IF NOT EXISTS labor_log (
  log_id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  quantity REAL DEFAULT 1,
  unit_price REAL NOT NULL,
  total_amount REAL NOT NULL,
  commission_amount REAL DEFAULT 0,
  business_date DATE NOT NULL,
  log_datetime DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_void BOOLEAN DEFAULT 0,
  void_reason TEXT,
  encoded_by TEXT,
  sale_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_id) REFERENCES shop_master(shop_id),
  FOREIGN KEY (staff_id) REFERENCES staff_master(staff_id)
)`);

          // ── Performance indexes ──────────────────────────────────
          db.run(`ALTER TABLE labor_log ADD COLUMN sale_id TEXT`, () => { });
          db.run(`ALTER TABLE item_master ADD COLUMN reorder_point INTEGER DEFAULT 5`, () => { });
          db.run(`ALTER TABLE item_master ADD COLUMN supplier_id TEXT`, () => { });
          db.run(`ALTER TABLE inventory_ledger ADD COLUMN supplier_id TEXT`, () => { });
          db.run(`ALTER TABLE order_items ADD COLUMN supplier_id TEXT`, () => { });
          db.run(`ALTER TABLE order_items ADD COLUMN is_new_item INTEGER DEFAULT 0`, () => { });
          db.run(`ALTER TABLE inventory_ledger ADD COLUMN linked_return_id TEXT`, () => { });
          db.run(`ALTER TABLE orders ADD COLUMN delivery_receipt TEXT`, () => { });

          db.run(`CREATE TABLE IF NOT EXISTS bale_book (
            bale_id TEXT PRIMARY KEY,
            shop_id TEXT NOT NULL,
            staff_id TEXT NOT NULL,
            amount REAL NOT NULL,
            balance_amount REAL NOT NULL,
            amount_paid REAL DEFAULT 0,
            bale_date TEXT NOT NULL,
            due_date DATE,
            status TEXT DEFAULT 'ACTIVE',
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT,
            closed_at DATETIME,
            FOREIGN KEY (shop_id) REFERENCES shop_master(shop_id),
            FOREIGN KEY (staff_id) REFERENCES staff_master(staff_id)
          )`, () => { });

          db.run(`CREATE TABLE IF NOT EXISTS bale_payments (
            payment_id TEXT PRIMARY KEY,
            bale_id TEXT NOT NULL,
            shop_id TEXT NOT NULL,
            amount REAL NOT NULL,
            payment_date TEXT NOT NULL,
            payment_method TEXT DEFAULT 'CASH',
            notes TEXT,
            recorded_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (bale_id) REFERENCES bale_book(bale_id)
          )`, () => { });

          db.run(`CREATE INDEX IF NOT EXISTS idx_bale_shop ON bale_book(shop_id, status)`, () => { });

          db.run(`CREATE TABLE IF NOT EXISTS returns (
            return_id TEXT PRIMARY KEY,
            shop_id TEXT NOT NULL,
            return_type TEXT NOT NULL,
            reason TEXT NOT NULL,
            status TEXT DEFAULT 'PENDING',
            item_id TEXT NOT NULL,
            quantity REAL NOT NULL,
            unit_cost REAL DEFAULT 0,
            original_sale_id TEXT,
            original_sale_item_id TEXT,
            original_order_id TEXT,
            original_order_item_id TEXT,
            supplier_id TEXT,
            linked_inventory_tx_id TEXT,
            replacement_return_id TEXT,
            dot_number TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT,
            processed_at DATETIME,
            processed_by TEXT,
            FOREIGN KEY (shop_id) REFERENCES shop_master(shop_id)
          )`);
          db.run(`ALTER TABLE returns ADD COLUMN dot_number TEXT`, () => { });
          db.run(`ALTER TABLE returns ADD COLUMN return_scenario TEXT DEFAULT 'FULL_REFUND'`, () => { });
          db.run(`ALTER TABLE returns ADD COLUMN refund_method TEXT`, () => { });
          db.run(`ALTER TABLE returns ADD COLUMN replacement_item_id TEXT`, () => { });
          db.run(`ALTER TABLE returns ADD COLUMN warranty_sent_at DATETIME`, () => { });
          db.run(`ALTER TABLE returns ADD COLUMN warranty_result TEXT`, () => { });
          db.run(`ALTER TABLE returns ADD COLUMN warranty_ref TEXT`, () => { });
          db.run(`ALTER TABLE returns ADD COLUMN customer_name TEXT`, () => { });
          db.run(`CREATE INDEX IF NOT EXISTS idx_returns_shop ON returns(shop_id, created_at)`, () => { });

          db.run(`CREATE INDEX IF NOT EXISTS idx_sale_header_shop_date ON sale_header(shop_id, sale_datetime)`, () => { });
          db.run(`CREATE INDEX IF NOT EXISTS idx_sale_header_datetime ON sale_header(shop_id, sale_datetime DESC)`, () => { });
          db.run(`CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id)`, () => { });
          db.run(`CREATE INDEX IF NOT EXISTS idx_sale_items_type ON sale_items(sale_id, sale_type)`, () => { });
          db.run(`CREATE INDEX IF NOT EXISTS idx_labor_log_shop_date ON labor_log(shop_id, business_date)`, () => { });
          db.run(`CREATE INDEX IF NOT EXISTS idx_labor_log_staff ON labor_log(staff_id)`, () => { });
          db.run(`CREATE INDEX IF NOT EXISTS idx_inventory_ledger_shop_item ON inventory_ledger(shop_id, item_id)`, () => { });
          db.run(`CREATE INDEX IF NOT EXISTS idx_current_stock_shop ON current_stock(shop_id, item_id)`, () => { });
          db.run(`CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance(shop_id, attendance_date)`, () => { });
          db.run(`CREATE INDEX IF NOT EXISTS idx_recap_job_shop ON recap_job_master(shop_id, status)`, () => { });
          db.run(`CREATE TABLE IF NOT EXISTS recap_price_defaults (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shop_id TEXT NOT NULL,
            size TEXT NOT NULL,
            recap_type TEXT NOT NULL,
            ownership_type TEXT NOT NULL DEFAULT 'CUSTOMER_OWNED',
            recap_cost REAL DEFAULT 0,
            selling_price REAL DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(shop_id, size, recap_type, ownership_type)
          )`, () => { });
          db.run(`ALTER TABLE recap_price_defaults ADD COLUMN ownership_type TEXT NOT NULL DEFAULT 'CUSTOMER_OWNED'`, () => { });

          db.run(`CREATE TABLE IF NOT EXISTS purchase_header (
            purchase_id TEXT PRIMARY KEY,
            shop_id TEXT NOT NULL,
            purchase_date TEXT NOT NULL,
            total_amount REAL DEFAULT 0,
            notes TEXT,
            supplier_id TEXT,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (shop_id) REFERENCES shop_master(shop_id)
          )`);
          db.run(`ALTER TABLE purchase_header ADD COLUMN is_void BOOLEAN DEFAULT 0`, () => { });
          db.run(`ALTER TABLE purchase_header ADD COLUMN void_reason TEXT`, () => { });

          db.run(`CREATE TABLE IF NOT EXISTS purchase_items (
            purchase_item_id TEXT PRIMARY KEY,
            purchase_id TEXT NOT NULL,
            shop_id TEXT NOT NULL,
            item_name TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'OTHER',
            quantity REAL NOT NULL DEFAULT 1,
            unit_cost REAL NOT NULL DEFAULT 0,
            selling_price REAL DEFAULT 0,
            line_total REAL NOT NULL DEFAULT 0,
            item_master_id TEXT,
            FOREIGN KEY (purchase_id) REFERENCES purchase_header(purchase_id)
          )`, () => { });

          // Additional performance indexes for common JOIN/WHERE patterns
          db.run(`CREATE INDEX IF NOT EXISTS idx_item_master_supplier ON item_master(supplier_id)`, () => { });
          db.run(`CREATE INDEX IF NOT EXISTS idx_item_master_active ON item_master(is_active, category, brand)`, () => { });
          db.run(`CREATE INDEX IF NOT EXISTS idx_sale_header_customer ON sale_header(customer_id)`, () => { });
          db.run(`CREATE INDEX IF NOT EXISTS idx_accounts_payable_shop ON accounts_payable(shop_id, status)`, () => { });
          db.run(`CREATE INDEX IF NOT EXISTS idx_accounts_payable_due ON accounts_payable(due_date)`, () => { });
          db.run(`CREATE INDEX IF NOT EXISTS idx_accounts_receivable_shop ON accounts_receivable(shop_id, status)`, () => { });
          db.run(`CREATE INDEX IF NOT EXISTS idx_payable_payments_payable ON payable_payments(payable_id)`, () => { });
          db.run(`CREATE INDEX IF NOT EXISTS idx_receivable_payments_recv ON receivable_payments(receivable_id)`, () => { });
          db.run(`CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(shop_id, status)`, () => { });
          db.run(`CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`, () => { });
          db.run(`CREATE INDEX IF NOT EXISTS idx_expenses_shop_date ON expenses(shop_id, expense_date)`, () => { });
          db.run(`CREATE INDEX IF NOT EXISTS idx_vehicle_plates_customer ON vehicle_plates(customer_id)`, () => { });

          // ── Phase 3: composite indexes for profit / financial-health aggregations & paginated lookups ──
          // sale_items join + aggregation by type/item
          db.run(`CREATE INDEX IF NOT EXISTS idx_sale_items_sale_type_item ON sale_items(sale_id, sale_type, item_or_service_id)`, () => { });
          db.run(`CREATE INDEX IF NOT EXISTS idx_sale_items_item ON sale_items(item_or_service_id)`, () => { });
          // inventory_ledger time-ordered per shop/item (supports ORDER BY created_at DESC + pagination)
          db.run(`CREATE INDEX IF NOT EXISTS idx_inventory_ledger_shop_item_created ON inventory_ledger(shop_id, item_id, created_at DESC)`, () => { });
          db.run(`CREATE INDEX IF NOT EXISTS idx_inventory_ledger_shop_created ON inventory_ledger(shop_id, created_at DESC)`, () => { });
          // item_master catalog filters (active + category/brand) for Inventory list & POS picker
          db.run(`CREATE INDEX IF NOT EXISTS idx_item_master_active_category ON item_master(is_active, category, brand)`, () => { });
          db.run(`CREATE INDEX IF NOT EXISTS idx_item_master_parent ON item_master(parent_item_id, is_active)`, () => { });
          // labor_log grouping for services-summary (shop + date range + staff)
          db.run(`CREATE INDEX IF NOT EXISTS idx_labor_log_shop_date_staff ON labor_log(shop_id, business_date, staff_id)`, () => { });
          // current_stock JOIN covering index
          db.run(`CREATE INDEX IF NOT EXISTS idx_current_stock_shop_item ON current_stock(shop_id, item_id)`, () => { });

          db.run(`DROP TRIGGER IF EXISTS update_current_stock`, () => { });

          // Enforce: any unit_cost change automatically adjusts selling_price by the same delta
          db.run(`DROP TRIGGER IF EXISTS sync_selling_price_on_cost_change`, () => { });
          db.run(`CREATE TRIGGER IF NOT EXISTS sync_selling_price_on_cost_change
            AFTER UPDATE OF unit_cost ON item_master
            FOR EACH ROW
            WHEN NEW.unit_cost != OLD.unit_cost AND NEW.selling_price = OLD.selling_price
            BEGIN
              UPDATE item_master
              SET selling_price = OLD.selling_price + (NEW.unit_cost - OLD.unit_cost)
              WHERE item_id = NEW.item_id;
            END;`);

          db.run(
            `CREATE TRIGGER IF NOT EXISTS update_current_stock
            AFTER INSERT ON inventory_ledger
            FOR EACH ROW
            BEGIN
              INSERT OR IGNORE INTO current_stock (shop_id, item_id, current_quantity, last_updated)
              VALUES (NEW.shop_id, NEW.item_id, 0, DATETIME('now'));

              UPDATE current_stock
              SET current_quantity = current_quantity + CASE
                WHEN NEW.transaction_type IN ('PURCHASE', 'RETURN', 'CUSTOMER_RETURN', 'SUPPLIER_REPLACEMENT') THEN ABS(NEW.quantity)
                WHEN NEW.transaction_type = 'ADJUSTMENT' THEN NEW.quantity
                WHEN NEW.transaction_type IN ('SALE', 'SUPPLIER_RETURN') THEN -ABS(NEW.quantity)
                ELSE 0
              END,
              last_updated = DATETIME('now')
              WHERE item_id = NEW.item_id
              AND shop_id = NEW.shop_id;
            END;`,
            (triggerErr) => {
              if (triggerErr)
                console.log("Trigger creation note:", triggerErr.message);
              resolve();
            },
          );
        },
      );
    });
  });
}

// ─── Seed / Data Loading ──────────────────────────────────────────────────────
async function loadExcelData() {
  try {
    const excelPath = path.join(__dirname, "backup.xlsx");
    if (!fs.existsSync(excelPath)) {
      console.log("Excel file not found. Database initialized empty.");
      return;
    }

    const workbook = XLSX.readFile(excelPath);

    const sheets = [
      ["SHOP_MASTER", "shop_master"],
      ["STAFF_MASTER", "staff_master"],
      ["ITEM_MASTER", "item_master"],
      ["SERVICES_MASTER", "services_master"],
      ["CUSTOMER_MASTER", "customer_master"],
      ["SUPPLIER_MASTER", "supplier_master"],
      ["COMMISSION_RULES", "commission_rules"],
      ["STAFF_ATTENDANCE", "staff_attendance"],
      ["INVENTORY_LEDGER", "inventory_ledger"],
      ["SALE_HEADER", "sale_header"],
      ["SALE_ITEMS", "sale_items"],
      ["SALES_LEDGER", "sales_ledger"],
      ["RECAP_JOB_MASTER", "recap_job_master"],
      ["RECAP_JOB_LEDGER", "recap_job_ledger"],
      ["ACCOUNTS_RECEIVABLE", "accounts_receivable"],
      ["ACCOUNTS_PAYABLE", "accounts_payable"],
      ["PAYMENT_LEDGER", "payment_ledger"],
      ["RECAP_PRICE_DEFAULTS", "recap_price_defaults"],
    ];

    for (const [sheetName, tableName] of sheets) {
      if (workbook.SheetNames.includes(sheetName)) {
        console.log(`Loading ${sheetName}...`);
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        if (data.length > 0) {
          console.log(`  Found ${data.length} records`);
          if (tableName === "item_master") {
            data.forEach((row) => {
              if (!row.selling_price) row.selling_price = 6000;
            });
          }
          try {
            await insertDataToTable(tableName, data);
          } catch (err) {
            console.log(`  ⚠️  Warning loading ${sheetName}: ${err.message}`);
            console.log(`  Continuing with next sheet...`);
          }
        } else {
          console.log(`  No data found in ${sheetName}`);
        }
      } else {
        console.log(`⚠️  Sheet '${sheetName}' not found in Excel`);
      }
    }

    await initializeOpeningInventory();
    await recalculateCurrentStock();
    await backfillDotNumbers();
    console.log("Data loaded successfully from Excel");
  } catch (error) {
    console.error("Error loading Excel data:", error);
  }
}

async function backfillDotNumbers() {
  // For any item where dot_number is NULL but the item_name contains a DOT pattern,
  // extract and save it. Handles:
  //   "Goodyear Cold Process 825-16 DOT:2419"  → "2419"
  //   "Bridgestone Turanza 185/70R14 [DOT 2024]" → "2024"
  //   SKU ending in -DOT2024 with no dot_number → "2024"
  return new Promise((resolve) => {
    db.all(
      `SELECT item_id, item_name, sku FROM item_master WHERE dot_number IS NULL AND is_active IN (0,1)`,
      [],
      (err, rows) => {
        if (err || !rows || !rows.length) return resolve();
        const updates = [];
        for (const row of rows) {
          const name = row.item_name || "";
          const sku = row.sku || "";
          let dot = null;
          // "[DOT 2024]" or "[DOT 4521]"
          const bracketMatch = name.match(/\[DOT\s+([^\]]+)\]/i);
          if (bracketMatch) dot = bracketMatch[1].trim();
          // "DOT:2419" or "DOT:4521"
          if (!dot) {
            const colonMatch = name.match(/DOT[:\s]+([A-Z0-9]{4,})/i);
            if (colonMatch) dot = colonMatch[1].trim();
          }
          // SKU ends with -DOT2024 etc.
          if (!dot) {
            const skuMatch = sku.match(/-DOT([A-Z0-9]+)$/i);
            if (skuMatch) dot = skuMatch[1].trim();
          }
          if (dot) updates.push({ item_id: row.item_id, dot });
        }
        if (!updates.length) return resolve();
        let done = 0;
        for (const u of updates) {
          db.run(
            `UPDATE item_master SET dot_number = ? WHERE item_id = ?`,
            [u.dot, u.item_id],
            () => { if (++done === updates.length) resolve(); }
          );
        }
        console.log(`  ✓ Backfilled dot_number for ${updates.length} items`);
      }
    );
  });
}

async function initializeOpeningInventory() {
  // Use shared promisified helpers (defined inline here to avoid circular
  // require since lib/db.js imports Database.js)
  const dbAll = (sql, params = []) =>
    new Promise((resolve, reject) =>
      db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])))
    );
  const dbGet = (sql, params = []) =>
    new Promise((resolve, reject) =>
      db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
    );
  const dbRun = (sql, params = []) =>
    new Promise((resolve, reject) =>
      db.run(sql, params, (err) => (err ? reject(err) : resolve()))
    );

  try {
    const shops = await dbAll(
      "SELECT shop_id FROM shop_master WHERE is_active = 1",
    );
    if (!shops.length) return;

    const items = await dbAll(
      "SELECT item_id FROM item_master WHERE is_active = 1",
    );
    if (!items.length) return;

    const pairs = [];
    for (const shop of shops)
      for (const item of items)
        pairs.push({ shop_id: shop.shop_id, item_id: item.item_id });

    await Promise.all(
      pairs.map(async ({ shop_id, item_id }) => {
        const result = await dbGet(
          "SELECT COUNT(*) as cnt FROM inventory_ledger WHERE shop_id = ? AND item_id = ?",
          [shop_id, item_id],
        );
        if (result && result.cnt === 0) {
          const inventory_ledger_id = `INIT-${uuidv4()}`;
          await dbRun(
            `INSERT INTO inventory_ledger
              (inventory_ledger_id, shop_id, item_id, transaction_type, quantity, reference_id, created_by, created_at)
              VALUES (?, ?, ?, 'OPENING', ?, 'INITIAL', 'SYSTEM', CURRENT_TIMESTAMP)`,
            [inventory_ledger_id, shop_id, item_id, 100],
          );
        }
      }),
    );
  } catch (err) {
    console.error("initializeOpeningInventory error:", err);
  }
}

function insertDataToTable(tableName, data) {
  return new Promise((resolve, reject) => {
    // First get the actual columns that exist in the table to avoid "no column" errors
    db.all(`PRAGMA table_info(${tableName})`, [], (pragmaErr, tableInfo) => {
      const knownColumns = pragmaErr || !tableInfo ? null : new Set(tableInfo.map(c => c.name));
      if (knownColumns) {
        data = data.map(row => {
          const filtered = {};
          for (const key of Object.keys(row)) {
            if (knownColumns.has(key)) filtered[key] = row[key];
          }
          return filtered;
        }).filter(row => Object.keys(row).length > 0);
      }
      db.serialize(() => {
        // ── customer_master normalization ───────────────────────────────────────
        // Inject shop_id when missing and remap legacy column names so that rows
        // from older Excel exports (which lack shop_id / use different keys) still
        // load cleanly into the current schema.
        if (tableName === "customer_master") {
          const DEFAULT_SHOP_ID = "SHOP-001";
          data = data.map((row) => {
            const r = { ...row };
            // Remap legacy columns → canonical names
            if (r.is_active !== undefined && r.active_status === undefined) {
              // no-op: is_active not a column in customer_master schema; drop it
              delete r.is_active;
            }
            if (r.created_by !== undefined) delete r.created_by; // not in schema
            // Ensure shop_id is present
            if (!r.shop_id) r.shop_id = DEFAULT_SHOP_ID;
            // Ensure customer_code mirrors customer_id when absent
            if (!r.customer_code && r.customer_id)
              r.customer_code = r.customer_id;
            return r;
          });
        }
        // ───────────────────────────────────────────────────────────────────────

        // Collect ALL unique keys across ALL rows (not just first row),
        // so sparse columns like dot_number aren't dropped when the first row lacks them.
        const allKeys = new Set();
        for (const row of data) for (const k of Object.keys(row)) allKeys.add(k);
        const colKeys = Array.from(allKeys);
        const columns = colKeys.join(", ");
        const placeholders = colKeys.map(() => "?").join(", ");
        const query = `INSERT OR REPLACE INTO ${tableName} (${columns}) VALUES (${placeholders})`;

        const stmt = db.prepare(query);
        let successCount = 0;
        let errorCount = 0;

        for (const row of data) {
          // Always use colKeys order — missing keys default to null, empty strings → null
          const vals = colKeys.map(k => {
            const v = row[k];
            return (v === undefined || v === null || v === '') ? null : v;
          });
          stmt.run(vals, function (err) {
            if (err) {
              errorCount++;
              console.log(`    ⚠️  Row error (skipped): ${err.message}`);
            } else {
              successCount++;
            }
          });
        }

        stmt.finalize((err) => {
          if (errorCount > 0)
            console.log(
              `    ℹ️  Inserted ${successCount} rows, skipped ${errorCount} rows with errors`,
            );
          resolve();
        });
      }); // end db.serialize
    }); // end db.all PRAGMA
  });
}

function recalculateCurrentStock() {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM current_stock");
    db.all(
      `SELECT shop_id, item_id, SUM(quantity) as stock
       FROM inventory_ledger
       GROUP BY shop_id, item_id`,
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        const stmt = db.prepare(
          "INSERT INTO current_stock (shop_id, item_id, current_quantity, last_updated) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
        );
        for (const row of rows || [])
          stmt.run([row.shop_id, row.item_id, row.stock]);
        stmt.finalize(resolve);
      },
    );
  });
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = { db, initializeDatabase, loadExcelData };
