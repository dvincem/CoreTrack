/**
 * featureIndex.js
 * Static index of every page and key sub-action in the system.
 * Used by GlobalSearch for instant, zero-latency Tier-1 feature discovery.
 *
 * Each entry: { label, description, keywords[], page, category }
 *   - label:       Short display name shown in the dropdown
 *   - description: One-line helper shown below the label
 *   - keywords:    Array of lowercase strings matched against user query
 *   - page:        NAV_SECTIONS item.id to navigate to
 *   - category:    Displayed in the badge ("Navigation" | "Action" | "Finance" | ...)
 */

export const FEATURE_INDEX = [

  // ── Main ──────────────────────────────────────────────────────────────────
  {
    label: 'Dashboard',
    description: 'Overview of sales, revenue, and shop status',
    keywords: ['dashboard', 'home', 'overview', 'summary', 'financial health', 'kpi', 'metrics', 'stats'],
    page: 'dashboard',
    category: 'Navigation',
  },
  {
    label: 'Point of Sale',
    description: 'Process a new sale — tires, services, and accessories',
    keywords: ['pos', 'point of sale', 'sell', 'new sale', 'record sale', 'transaction', 'invoice', 'cart', 'checkout', 'make sale', 'cash sale', 'credit sale'],
    page: 'pos',
    category: 'Navigation',
  },

  // ── Operations ────────────────────────────────────────────────────────────
  {
    label: 'Orders',
    description: 'Create and manage purchase orders to suppliers',
    keywords: ['orders', 'purchase order', 'po', 'order list', 'supplier order', 'order items', 'pending orders', 'order status'],
    page: 'orders',
    category: 'Navigation',
  },
  {
    label: 'Inventory',
    description: 'View current stock levels for all items',
    keywords: ['inventory', 'stock', 'stock level', 'current stock', 'items in stock', 'quantity on hand', 'low stock', 'reorder'],
    page: 'inventory',
    category: 'Navigation',
  },
  {
    label: 'Products',
    description: 'Manage the product/item master list, prices, and categories',
    keywords: ['products', 'item master', 'catalog', 'price list', 'add item', 'new item', 'add product', 'new product', 'sku', 'brands', 'tire brands', 'product categories', 'archive item', 'edit price'],
    page: 'products',
    category: 'Navigation',
  },
  {
    label: 'Expenses',
    description: 'Record and review business expenses',
    keywords: ['expenses', 'costs', 'spending', 'add expense', 'record expense', 'new expense', 'expense categories', 'operational costs', 'expenditure'],
    page: 'expenses',
    category: 'Navigation',
  },
  {
    label: 'Cash Ledger',
    description: 'Track daily cash, GCash, and bank transactions in/out',
    keywords: ['cash ledger', 'cash flow', 'cash in', 'cash out', 'gcash', 'bank', 'daily cash', 'petty cash', 'fund', 'ledger'],
    page: 'cashledger',
    category: 'Navigation',
  },
  {
    label: 'Purchases',
    description: 'Record goods received from suppliers (GRN)',
    keywords: ['purchases', 'grn', 'goods received', 'goods receipt', 'received items', 'stock in', 'receive delivery', 'purchase history', 'purchase receipt'],
    page: 'purchases',
    category: 'Navigation',
  },
  {
    label: 'Recap Tires',
    description: 'Manage retreat/recap tire jobs (intake, processing, claim)',
    keywords: ['recap', 'recap tires', 'retreat', 'retreading', 'recap job', 'intake recap', 'recap intake', 'claim recap', 'recap status', 'casing'],
    page: 'recap',
    category: 'Navigation',
  },
  {
    label: 'Returns',
    description: 'Process product returns, warranties, and replacements',
    keywords: ['returns', 'return', 'warranty', 'refund', 'replacement', 'defective', 'product return', 'sales return', 'purchase return', 'warranty claim'],
    page: 'returns',
    category: 'Navigation',
  },

  // ── Sales & Service ───────────────────────────────────────────────────────
  {
    label: 'Sales History',
    description: 'View all past sales transactions and invoices',
    keywords: ['sales', 'sales history', 'invoices', 'past sales', 'sales records', 'transactions list', 'sales report', 'void sale'],
    page: 'sales',
    category: 'Navigation',
  },
  {
    label: 'Services',
    description: 'Manage service offerings and their prices',
    keywords: ['services', 'service list', 'service prices', 'add service', 'new service', 'service rates', 'vulcanizing', 'balancing', 'service management', 'commission rate'],
    page: 'services',
    category: 'Navigation',
  },
  {
    label: 'Services Summary',
    description: 'Review service history and revenue by type',
    keywords: ['services summary', 'service history', 'service revenue', 'service performance', 'services report'],
    page: 'services-summary',
    category: 'Navigation',
  },

  // ── People ────────────────────────────────────────────────────────────────
  {
    label: 'Customers',
    description: 'View and manage customer records and vehicles',
    keywords: ['customers', 'clients', 'customer list', 'add customer', 'new customer', 'customer records', 'vehicle plates', 'customer vehicles', 'contact'],
    page: 'customers',
    category: 'Navigation',
  },
  {
    label: 'Suppliers',
    description: 'Manage supplier accounts and brand relationships',
    keywords: ['suppliers', 'vendor', 'supplier list', 'add supplier', 'new supplier', 'supplier brands', 'supplier details', 'vendor management'],
    page: 'suppliers',
    category: 'Navigation',
  },
  {
    label: 'Staff Management',
    description: 'Manage employee records, roles, and attendance',
    keywords: ['staff', 'employees', 'staff management', 'add staff', 'new staff', 'staff list', 'hr', 'human resources', 'staff roles', 'mark attendance', 'attendance log', 'staff attendance', 'record attendance'],
    page: 'staff-management',
    category: 'Navigation',
  },
  {
    label: 'Payroll',
    description: 'Compute staff salaries, deductions, bale, and net pay',
    keywords: ['payroll', 'salary', 'wages', 'pay staff', 'staff salary', 'net pay', 'deductions', 'payslip', 'compute salary'],
    page: 'payroll',
    category: 'Navigation',
  },

  // ── Finance ───────────────────────────────────────────────────────────────
  {
    label: 'Profit & Margins',
    description: 'Analyze profit margins by product and category',
    keywords: ['profits', 'profit margin', 'gross profit', 'margins', 'profit analysis', 'profit report', 'net profit', 'markup'],
    page: 'profits',
    category: 'Navigation',
  },
  {
    label: 'Receivables',
    description: 'Track money owed by customers (AR)',
    keywords: ['receivables', 'ar', 'accounts receivable', 'customer debt', 'collect payment', 'outstanding balance', 'credit accounts', 'overdue receivables', 'open receivables', 'unpaid accounts'],
    page: 'receivables',
    category: 'Navigation',
  },
  {
    label: 'Payables',
    description: 'Track money owed to suppliers (AP)',
    keywords: ['payables', 'ap', 'accounts payable', 'supplier debt', 'pay supplier', 'bills', 'outstanding payables', 'overdue payables', 'open payables', 'vendor bills'],
    page: 'payables',
    category: 'Navigation',
  },
  {
    label: 'Sales Projection',
    description: 'View sales forecast and target tracking',
    keywords: ['sales projection', 'forecast', 'sales target', 'projection', 'targets', 'goals', 'sales forecast'],
    page: 'sales-projection',
    category: 'Navigation',
  },

  // ── Reports ───────────────────────────────────────────────────────────────
  {
    label: 'Reports',
    description: 'Generate daily activity reports and closing summaries',
    keywords: ['reports', 'daily report', 'closing report', 'end of day report', 'generate report', 'activity report', 'day summary', 'daily closing'],
    page: 'reports',
    category: 'Navigation',
  },

  // ── Admin ─────────────────────────────────────────────────────────────────
  {
    label: 'Control Panel',
    description: 'Manage user credentials, page access, and system roles',
    keywords: ['control panel', 'settings', 'user management', 'access control', 'credentials', 'change pin', 'manage access', 'page access', 'system roles', 'admin panel', 'user accounts', 'login settings'],
    page: 'credentials',
    category: 'Navigation',
  },
  {
    label: 'System Feedback',
    description: 'View dry-run issues and system feedback tracker',
    keywords: ['system feedback', 'dry run', 'issues', 'bugs', 'feedback', 'tracker', 'dryrun'],
    page: 'dryrun',
    category: 'Navigation',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Key Sub-Actions (non-navigation: point to the hosting page)
  // ─────────────────────────────────────────────────────────────────────────

  {
    label: 'Record Bale (Salary Advance)',
    description: 'Deduct a salary advance from a staff member\'s payroll',
    keywords: ['bale', 'salary advance', 'cash advance', 'advance', 'loan deduction', 'payroll deduction', 'bale deduction', 'bale staff', 'record bale'],
    page: 'payroll',
    category: 'Action',
  },
  {
    label: 'Add Commission',
    description: 'Staff commission is assigned during a POS sale transaction',
    keywords: ['commission', 'add commission', 'sales commission', 'install commission', 'tireman commission', 'agent fee', 'commission rate'],
    page: 'pos',
    category: 'Action',
  },
  {
    label: 'Record a New Sale',
    description: 'Open POS to process a new sale transaction',
    keywords: ['new sale', 'make sale', 'process sale', 'add sale', 'new transaction', 'new invoice', 'sell product', 'sell tire'],
    page: 'pos',
    category: 'Action',
  },
  {
    label: 'Credit Sale / Installment',
    description: 'Process a sale with partial payment and create a receivable',
    keywords: ['credit sale', 'installment', 'partial payment', 'charge to account', 'credit transaction', 'buy now pay later'],
    page: 'pos',
    category: 'Action',
  },
  {
    label: 'Record Attendance',
    description: 'Mark staff present, absent, or on leave for today',
    keywords: ['attendance', 'mark attendance', 'record attendance', 'staff attendance', 'present', 'absent', 'leave', 'attendance log'],
    page: 'staff-management',
    category: 'Action',
  },
  {
    label: 'Add New Customer',
    description: 'Create a new customer record with contact and vehicle info',
    keywords: ['add customer', 'new customer', 'create customer', 'register customer', 'customer registration', 'add client'],
    page: 'customers',
    category: 'Action',
  },
  {
    label: 'Add Vehicle Plate',
    description: 'Register a vehicle plate number to a customer',
    keywords: ['add vehicle', 'add plate', 'vehicle plate', 'plate number', 'register vehicle', 'vehicle registration'],
    page: 'customers',
    category: 'Action',
  },
  {
    label: 'Add New Supplier',
    description: 'Register a new supplier with contact and brand info',
    keywords: ['add supplier', 'new supplier', 'create supplier', 'register supplier', 'new vendor'],
    page: 'suppliers',
    category: 'Action',
  },
  {
    label: 'Add New Product / Item',
    description: 'Create a new item in the product master catalog',
    keywords: ['add item', 'new item', 'add product', 'new product', 'create item', 'add tire', 'new tire', 'add sku', 'create product', 'add inventory item'],
    page: 'products',
    category: 'Action',
  },
  {
    label: 'Adjust Stock / Inventory',
    description: 'Manually adjust stock quantity in inventory',
    keywords: ['adjust stock', 'stock adjustment', 'manual stock', 'inventory adjustment', 'correct stock', 'add stock', 'reduce stock'],
    page: 'inventory',
    category: 'Action',
  },
  {
    label: 'Create Purchase Order',
    description: 'Raise a new purchase order for items from a supplier',
    keywords: ['create order', 'new order', 'create po', 'purchase order', 'raise order', 'order from supplier'],
    page: 'orders',
    category: 'Action',
  },
  {
    label: 'Receive Goods / GRN',
    description: 'Record goods received from a supplier delivery',
    keywords: ['receive goods', 'grn', 'goods received', 'receive delivery', 'record receipt', 'stock in', 'receive items', 'goods receipt note'],
    page: 'purchases',
    category: 'Action',
  },
  {
    label: 'Record an Expense',
    description: 'Log a new business expense with category and amount',
    keywords: ['record expense', 'add expense', 'new expense', 'log expense', 'enter expense', 'expense entry'],
    page: 'expenses',
    category: 'Action',
  },
  {
    label: 'Add Payable / Bill',
    description: 'Record a new amount owed to a supplier or vendor',
    keywords: ['add payable', 'new payable', 'add bill', 'record payable', 'vendor bill', 'supplier bill', 'new ap', 'add accounts payable'],
    page: 'payables',
    category: 'Action',
  },
  {
    label: 'Pay a Supplier',
    description: 'Record a payment against an outstanding payable',
    keywords: ['pay supplier', 'settle payable', 'supplier payment', 'pay bill', 'payable payment', 'record payment to supplier'],
    page: 'payables',
    category: 'Action',
  },
  {
    label: 'Add Receivable / Customer Credit',
    description: 'Create a new customer receivable or credit account',
    keywords: ['add receivable', 'new receivable', 'create receivable', 'customer credit', 'add ar', 'charge customer', 'open credit'],
    page: 'receivables',
    category: 'Action',
  },
  {
    label: 'Collect Customer Payment',
    description: 'Record a payment received from a customer against a receivable',
    keywords: ['collect payment', 'receive payment', 'customer payment', 'receivable payment', 'settle receivable', 'payment collection'],
    page: 'receivables',
    category: 'Action',
  },
  {
    label: 'Recap Tire Intake',
    description: 'Register a customer or shop-owned tire for retreading',
    keywords: ['recap intake', 'intake recap', 'new recap', 'add recap', 'register recap', 'retread intake', 'casing intake'],
    page: 'recap',
    category: 'Action',
  },
  {
    label: 'Process a Return',
    description: 'Handle a product return, warranty claim, or replacement',
    keywords: ['process return', 'new return', 'add return', 'warranty return', 'refund item', 'return product', 'replacement item'],
    page: 'returns',
    category: 'Action',
  },
  {
    label: 'Add Staff Member',
    description: 'Register a new employee in the system',
    keywords: ['add staff', 'new staff', 'new employee', 'hire staff', 'add employee', 'register employee', 'add tireman', 'add technician'],
    page: 'staff-management',
    category: 'Action',
  },
  {
    label: 'Compute Payroll / Salary',
    description: 'Calculate and generate payroll for staff',
    keywords: ['compute payroll', 'compute salary', 'generate payroll', 'payroll computation', 'salary calculation', 'process payroll', 'staff pay'],
    page: 'payroll',
    category: 'Action',
  },
  {
    label: 'Change User PIN / Password',
    description: 'Reset or change a staff login PIN or password',
    keywords: ['change pin', 'reset pin', 'change password', 'reset password', 'update pin', 'pin reset', 'credential reset'],
    page: 'credentials',
    category: 'Action',
  },
  {
    label: 'Manage Page Access',
    description: 'Grant or restrict which pages a staff account can access',
    keywords: ['page access', 'manage access', 'grant access', 'restrict access', 'user permissions', 'role access', 'access control'],
    page: 'credentials',
    category: 'Action',
  },
  {
    label: 'Add Service Type',
    description: 'Create a new service offering with price and commission settings',
    keywords: ['add service', 'new service', 'create service', 'service type', 'add vulcanizing', 'add balancing', 'service rate', 'service price'],
    page: 'services',
    category: 'Action',
  },
  {
    label: 'Close Day / End of Day',
    description: 'Perform daily closing to lock the business date and generate summary',
    keywords: ['close day', 'end of day', 'daily close', 'day closing', 'close shop', 'close business', 'eod', 'closing procedure'],
    page: 'dashboard',
    category: 'Action',
  },
  {
    label: 'Open Day / Start of Day',
    description: 'Open a new business day to begin recording transactions',
    keywords: ['open day', 'start day', 'open shop', 'start business', 'begin day', 'new business day'],
    page: 'dashboard',
    category: 'Action',
  },
  {
    label: 'Generate Daily Report',
    description: 'View the daily activity report for sales, expenses, and closings',
    keywords: ['daily report', 'generate report', 'day report', 'closing report', 'end of day report', 'activity report', 'day summary'],
    page: 'reports',
    category: 'Action',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Client-side fuzzy search function
// Returns top 5 scored feature entries for a given query string.
// ─────────────────────────────────────────────────────────────────────────────

export function searchFeatures(q) {
  if (!q || q.length < 2) return [];
  const query = q.toLowerCase().trim();

  const scored = FEATURE_INDEX.map((item) => {
    let score = 0;
    const labelLower = item.label.toLowerCase();
    const descLower = item.description.toLowerCase();

    // Label exact match
    if (labelLower === query) {
      score = 100;
    }
    // Label starts with query
    else if (labelLower.startsWith(query)) {
      score = 90;
    }
    // Any word in label starts with query
    else if (labelLower.split(/\s+/).some((w) => w.startsWith(query))) {
      score = 80;
    }
    // Label contains query as substring
    else if (labelLower.includes(query)) {
      score = 70;
    }

    // Keyword matches (only if label didn't already score high)
    if (score < 70) {
      for (const kw of item.keywords) {
        const kwLower = kw.toLowerCase();
        if (kwLower === query) { score = Math.max(score, 85); break; }
        if (kwLower.startsWith(query)) { score = Math.max(score, 75); }
        else if (kwLower.includes(query)) { score = Math.max(score, 55); }
      }
    }

    // Description match — lowest priority fallback
    if (score === 0 && descLower.includes(query)) {
      score = 20;
    }

    return { ...item, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
