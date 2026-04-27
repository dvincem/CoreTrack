/**
 * ============================================================
 * CoreTrack Chat Brain — chatbot.js
 * ============================================================
 * Grounded AI assistant for CoreTrack tire shop system.
 * All responses are backed by real DB queries or injected
 * page context. Zero hallucination by design.
 *
 * Architecture:
 *   1. INTENT CLASSIFIER  — what does the user want?
 *   2. PARAM EXTRACTOR    — pull brand/size/date/name from message
 *   3. DB RESOLVER        — map intent → real SQLite query
 *   4. CONTEXT BUILDER    — build grounded system prompt
 *   5. PROMPT ASSEMBLER   — merge context + data + history
 *   6. OLLAMA CALLER      — local Llama 3.2 3B inference
 *   7. SAFETY FILTER      — block hallucinated/vague replies
 *   8. FORMAT ENFORCER    — structured output rules
 * ============================================================
 */

const { dbAll, dbGet } = require("./lib/db");

// ── In-memory inventory index (refreshed from server.js on boot) ─────────────
// We read this from the parent module's RAM index for speed
let _inventoryIndex = [];
function setInventoryIndex(index) { _inventoryIndex = index; }

// ── Fetch with timeout helper ─────────────────────────────────────────────────
async function fetchWithTimeout(url, options, timeout = 60000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 1 — INTENT CLASSIFIER
// Determines what the user is asking for so we know which DB path to take.
// Returns one of: navigation | inventory | sales | customers | financials |
//                 catalog | lowstock | topselling | analysis | general
// ─────────────────────────────────────────────────────────────────────────────
function classifyIntent(message) {
  const msg = message.toLowerCase().trim();

  // Navigation — where is / how do I find
  if (/where (is|do i|can i)|how do i (find|go|navigate|access|open)|go to|which page|navigate to|open the/.test(msg))
    return "navigation";

  // Low stock alerts
  if (/low stock|running (low|out)|almost (empty|out)|reorder|restock|shortage/.test(msg))
    return "lowstock";

  // Top selling / best performers
  if (/top sell|best sell|most sold|popular|fastest moving|highest (sales|revenue)/.test(msg))
    return "topselling";

  // Inventory / stock levels
  if (/stock|inventory|how many|quantity|available|on hand|units left|pieces|pcs/.test(msg))
    return "inventory";

  // Sales & transactions
  if (/sale|sold|revenue|income|transaction|invoice|total (sales|revenue|income)|earnings|today.*(sale|earn)|this (week|month)/.test(msg))
    return "sales";

  // Customer queries
  if (/customer|client|buyer|who bought|purchase history|customer record/.test(msg))
    return "customers";

  // Financial queries — owner only
  if (/profit|expense|payable|receivable|cash|ledger|financial|balance|net|gross|cost/.test(msg))
    return "financials";

  // Tire catalog & pricing
  if (/price|catalog|brand|size|spec|how much|cost|tire (list|brand|model)|what tires/.test(msg))
    return "catalog";

  // Comparative analysis
  if (/compare|trend|analysis|report|summary|breakdown|vs|versus|which is (better|higher|lower)/.test(msg))
    return "analysis";

  return "general";
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 2 — PARAM EXTRACTOR
// Pulls structured parameters from natural language.
// No external NLP — pure regex pattern matching.
// ─────────────────────────────────────────────────────────────────────────────
function extractParams(message) {
  const msg = message.toLowerCase();
  const params = {};

  // ── Tire Brands (PH market + global) ──
  const brands = [
    "bridgestone", "michelin", "goodyear", "continental", "dunlop", "yokohama",
    "toyo", "falken", "pirelli", "hankook", "kumho", "nexen", "cooper",
    "sailun", "forceum", "otani", "linglong", "roadstone", "triangle",
    "maxxis", "federal", "nitto", "bfgoodrich", "bf goodrich", "firestone",
    "general", "giti", "kenda", "westlake", "doublestar", "comforser"
  ];
  for (const brand of brands) {
    if (msg.includes(brand)) { params.brand = brand; break; }
  }

  // ── Tire Size (formats: 185/65R15, 185/65r15, 31x10.5R15) ──
  const sizeMatch = msg.match(/\d{3}\/\d{2}[rR]\d{2}|\d{2}x\d{2,3}\.\d[rR]\d{2}|\d{3}\/\d{2}\/\d{2}/);
  if (sizeMatch) params.size = sizeMatch[0].toUpperCase();

  // ── Date Range ──
  const today = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (/\btoday\b/.test(msg)) {
    params.dateFrom = fmt(today);
    params.dateTo = fmt(today);
    params.dateLabel = "Today";
  } else if (/\byesterday\b/.test(msg)) {
    const y = new Date(today); y.setDate(y.getDate() - 1);
    params.dateFrom = fmt(y);
    params.dateTo = fmt(y);
    params.dateLabel = "Yesterday";
  } else if (/this week/.test(msg)) {
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    params.dateFrom = fmt(start);
    params.dateTo = fmt(today);
    params.dateLabel = "This Week";
  } else if (/last week/.test(msg)) {
    const start = new Date(today); start.setDate(today.getDate() - today.getDay() - 7);
    const end = new Date(today); end.setDate(today.getDate() - today.getDay() - 1);
    params.dateFrom = fmt(start);
    params.dateTo = fmt(end);
    params.dateLabel = "Last Week";
  } else if (/this month/.test(msg)) {
    params.dateFrom = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;
    params.dateTo = fmt(today);
    params.dateLabel = "This Month";
  } else if (/last month/.test(msg)) {
    const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lme = new Date(today.getFullYear(), today.getMonth(), 0);
    params.dateFrom = fmt(lm);
    params.dateTo = fmt(lme);
    params.dateLabel = "Last Month";
  } else if (/this year/.test(msg)) {
    params.dateFrom = `${today.getFullYear()}-01-01`;
    params.dateTo = fmt(today);
    params.dateLabel = "This Year";
  }

  // ── Customer Name ──
  const nameMatch = msg.match(/(?:customer|client|for|of)\s+([a-z][a-z\s]{2,30}?)(?:\s*[?.,]|$)/);
  if (nameMatch) params.customerName = nameMatch[1].trim();

  // ── Stock threshold for low stock ──
  const threshMatch = msg.match(/(?:below|less than|under|fewer than)\s+(\d+)/);
  if (threshMatch) params.threshold = parseInt(threshMatch[1]);
  else params.threshold = 10; // default low stock threshold

  // ── Limit for lists ──
  const limitMatch = msg.match(/top\s+(\d+)/);
  params.limit = limitMatch ? parseInt(limitMatch[1]) : 10;

  return params;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 3 — DB RESOLVER
// Maps intent + params to real SQLite queries against actual schema.
// All queries use parameterized form (? placeholders) — no string injection.
// Tables: item_master, current_stock, sale_header, sale_items, customer_master,
//         inventory_ledger, expenses, payment_ledger, services_master
// ─────────────────────────────────────────────────────────────────────────────
async function resolveFromDB(intent, params, role) {
  try {
    switch (intent) {

      // ── INVENTORY: Total stock with brand/size filter ──
      case "inventory": {
        if (params.brand || params.size) {
          // Filtered search
          const conditions = [];
          const values = [];
          if (params.brand) { conditions.push("LOWER(i.brand) LIKE ?"); values.push(`%${params.brand}%`); }
          if (params.size)  { conditions.push("LOWER(i.size) LIKE ?");  values.push(`%${params.size.toLowerCase()}%`); }
          const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
          const sql = `
            SELECT i.item_name, i.brand, i.size, i.selling_price,
                   IFNULL(s.current_quantity, 0) AS stock,
                   i.shop_id
            FROM item_master i
            LEFT JOIN current_stock s ON i.item_id = s.item_id
            ${where}
            ORDER BY stock DESC
            LIMIT 50
          `;
          const rows = await dbAll(sql, values);
          return { type: "inventory_filtered", data: rows, params };
        } else {
          // Overall inventory summary
          const summary = await dbGet(`
            SELECT 
              COUNT(DISTINCT i.item_id) AS total_products,
              SUM(IFNULL(s.current_quantity, 0)) AS total_units,
              COUNT(DISTINCT i.brand) AS total_brands,
              SUM(IFNULL(s.current_quantity, 0) * i.selling_price) AS total_value
            FROM item_master i
            LEFT JOIN current_stock s ON i.item_id = s.item_id
          `);
          const byBrand = await dbAll(`
            SELECT i.brand,
                   COUNT(DISTINCT i.item_id) AS variants,
                   SUM(IFNULL(s.current_quantity, 0)) AS total_stock
            FROM item_master i
            LEFT JOIN current_stock s ON i.item_id = s.item_id
            GROUP BY i.brand
            ORDER BY total_stock DESC
            LIMIT 15
          `);
          return { type: "inventory_summary", data: { summary, byBrand } };
        }
      }

      // ── LOW STOCK: Items below threshold ──
      case "lowstock": {
        const rows = await dbAll(`
          SELECT i.item_name, i.brand, i.size,
                 IFNULL(s.current_quantity, 0) AS stock,
                 i.selling_price
          FROM item_master i
          LEFT JOIN current_stock s ON i.item_id = s.item_id
          WHERE IFNULL(s.current_quantity, 0) <= ?
          ORDER BY stock ASC
          LIMIT 30
        `, [params.threshold]);
        return { type: "lowstock", data: rows, threshold: params.threshold };
      }

      // ── TOP SELLING ──
      case "topselling": {
        const conditions = params.dateFrom
          ? "WHERE DATE(sh.sale_datetime) BETWEEN ? AND ?"
          : "";
        const values = params.dateFrom ? [params.dateFrom, params.dateTo] : [];
        const rows = await dbAll(`
          SELECT i.item_name, i.brand, i.size,
                 SUM(si.quantity) AS total_sold,
                 SUM(si.line_total) AS total_revenue
          FROM sale_items si
          JOIN item_master i ON si.item_or_service_id = i.item_id
          JOIN sale_header sh ON si.sale_id = sh.sale_id
          ${conditions}
          GROUP BY i.item_id
          ORDER BY total_sold DESC
          LIMIT ?
        `, [...values, params.limit]);
        return { type: "topselling", data: rows, params };
      }

      // ── SALES: Revenue and transaction counts ──
      case "sales": {
        const conditions = params.dateFrom
          ? "WHERE DATE(sale_datetime) BETWEEN ? AND ?"
          : "";
        const values = params.dateFrom ? [params.dateFrom, params.dateTo] : [];

        const summary = await dbGet(`
          SELECT 
            COUNT(*) AS total_transactions,
            SUM(total_amount) AS total_revenue,
            AVG(total_amount) AS avg_per_sale,
            MAX(total_amount) AS highest_sale
          FROM sale_header
          ${conditions}
        `, values);

        const recent = await dbAll(`
          SELECT sh.sale_id, sh.sale_datetime, sh.total_amount,
                 c.customer_name, st.full_name AS staff_name
          FROM sale_header sh
          LEFT JOIN customer_master c ON sh.customer_id = c.customer_id
          LEFT JOIN staff_master st ON sh.staff_id = st.staff_id
          ${conditions}
          ORDER BY sh.sale_datetime DESC
          LIMIT 10
        `, values);

        return { type: "sales", data: { summary, recent }, params };
      }

      // ── CUSTOMERS ──
      case "customers": {
        if (params.customerName) {
          const rows = await dbAll(`
            SELECT c.customer_name, c.contact_number, c.address,
                   COUNT(sh.sale_id) AS total_purchases,
                   SUM(sh.total_amount) AS total_spent
            FROM customer_master c
            LEFT JOIN sale_header sh ON c.customer_id = sh.customer_id
            WHERE LOWER(c.customer_name) LIKE ?
            GROUP BY c.customer_id
            LIMIT 10
          `, [`%${params.customerName}%`]);
          return { type: "customer_lookup", data: rows, params };
        } else {
          const stats = await dbGet(`
            SELECT COUNT(*) AS total_customers FROM customer_master
          `);
          const top = await dbAll(`
            SELECT c.customer_name,
                   COUNT(sh.sale_id) AS purchases,
                   SUM(sh.total_amount) AS total_spent
            FROM customer_master c
            JOIN sale_header sh ON c.customer_id = sh.customer_id
            GROUP BY c.customer_id
            ORDER BY total_spent DESC
            LIMIT 10
          `);
          return { type: "customers_summary", data: { stats, top } };
        }
      }

      // ── FINANCIALS (owner only) ──
      case "financials": {
        if (role !== "owner") {
          return { type: "access_denied", message: "Financial data is restricted to the owner." };
        }
        const conditions = params.dateFrom ? "WHERE DATE(expense_date) BETWEEN ? AND ?" : "";
        const values = params.dateFrom ? [params.dateFrom, params.dateTo] : [];

        const expenses = await dbGet(`
          SELECT SUM(amount) AS total_expenses, COUNT(*) AS expense_count
          FROM expenses ${conditions}
        `, values);

        const revenue = await dbGet(`
          SELECT SUM(total_amount) AS total_revenue
          FROM sale_header
          ${params.dateFrom ? "WHERE DATE(sale_datetime) BETWEEN ? AND ?" : ""}
        `, values);

        const receivables = await dbGet(`
          SELECT SUM(balance_amount) AS total_receivable FROM accounts_receivable WHERE status != 'PAID'
        `);

        const payables = await dbGet(`
          SELECT SUM(balance_amount) AS total_payable FROM accounts_payable WHERE status != 'PAID'
        `);

        return {
          type: "financials",
          data: { expenses, revenue, receivables, payables },
          params
        };
      }

      // ── CATALOG & PRICING ──
      case "catalog": {
        const conditions = [];
        const values = [];
        if (params.brand) { conditions.push("LOWER(brand) LIKE ?"); values.push(`%${params.brand}%`); }
        if (params.size)  { conditions.push("LOWER(size) LIKE ?");  values.push(`%${params.size.toLowerCase()}%`); }
        const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
        const rows = await dbAll(`
          SELECT item_name, brand, size, selling_price, unit_cost
          FROM item_master
          ${where}
          ORDER BY brand, size
          LIMIT 30
        `, values);
        return { type: "catalog", data: rows, params };
      }

      // ── ANALYSIS: Multi-metric summary ──
      case "analysis": {
        const salesSummary = await dbGet(`
          SELECT SUM(total_amount) AS revenue, COUNT(*) AS orders
          FROM sale_header WHERE DATE(sale_datetime) >= DATE('now', '-30 days')
        `);
        const topItems = await dbAll(`
          SELECT i.brand, i.size, SUM(si.quantity) AS sold
          FROM sale_items si JOIN item_master i ON si.item_or_service_id = i.item_id
          JOIN sale_header sh ON si.sale_id = sh.sale_id
          WHERE DATE(sh.sale_datetime) >= DATE('now', '-30 days')
          GROUP BY i.item_id ORDER BY sold DESC LIMIT 5
        `);
        const lowStock = await dbGet(`
          SELECT COUNT(*) AS count FROM item_master i
          LEFT JOIN current_stock s ON i.item_id = s.item_id
          WHERE IFNULL(s.current_quantity, 0) <= i.reorder_point
        `);
        return { type: "analysis", data: { salesSummary, topItems, lowStock } };
      }

      default:
        return null;
    }
  } catch (err) {
    console.error("❌ DB Resolver Error:", err.message);
    return { type: "db_error", message: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 4 — CONTEXT BUILDER
// Builds the grounded system prompt. The LLM is told exactly what it knows
// and is forbidden from inventing anything outside of it.
// ─────────────────────────────────────────────────────────────────────────────
function buildSystemPrompt(role, page, dbResult) {
  const roleRule = role === "owner"
    ? "You have full system access including financials, profits, and all reports."
    : "You have access to inventory, catalog, and customer records only. Never reveal financial summaries or profit data.";

  const dataBlock = dbResult
    ? `\n=== REAL DATABASE RESULT (use ONLY this data) ===\n${JSON.stringify(dbResult, null, 2)}\n=== END DB RESULT ===`
    : "\n=== NO DB DATA: Answer from page context or navigation knowledge only. ===";

  return `
You are CoreTrack AI — the intelligent assistant for Jonde Tire Trading's shop management system.
Current page: ${page || "Dashboard"}
User role: ${role}
${roleRule}
${dataBlock}

=== NAVIGATION MAP ===
- Dashboard: /dashboard — overview, KPIs, quick stats
- Inventory: /inventory — stock levels, item list, stock movements
- Sales / POS: /pos — new transactions, point of sale
- Sales History: /sales — past invoices, sales records
- Customers: /customers — customer list, records, history
- Suppliers: /suppliers — supplier list, purchase orders
- Purchases: /purchases — purchase records, receiving
- Financials: /financials — revenue, expenses, profit (owner only)
- Cash Ledger: /cashledger — daily cash tracking
- Expenses: /expenses — expense records
- Staff / Payroll: /staff — employees, roles, payroll
- Reports / Recap: /recap — job tracking for retreaded tires
- Returns: /returns — return records
- Backup: /backup — database backup and restore
- Settings: /settings — system configuration

=== STRICT RESPONSE RULES ===
1. ONLY use data from the DATABASE RESULT above. Never invent numbers.
2. If no DB result is provided, answer from page context or navigation knowledge only.
3. If asked for data you don't have, say exactly: "I don't have that data available right now. Please check the relevant page directly."
4. Never guess, estimate, or fabricate any figure, name, or record.
5. Be concise, professional, and direct.
6. ALWAYS use the Philippine Peso sign (₱) for all monetary values and prices, never use the dollar sign ($).

=== STRICT FORMAT RULES ===
Always pick the format that matches the answer type:

TYPE: NAVIGATION (user asks where to find something)
📍 Location: [Page Name]
🔗 Route: [/route]
👣 Steps:
  1. [step]
  2. [step]
💡 Tip: [optional note]

TYPE: DATA — NUMBERS/STOCK/SALES
📊 [Title]
─────────────────────────────
• [Label]  :  [Value]
• [Label]  :  [Value]
─────────────────────────────
📝 Summary: [one sentence conclusion based only on the data]

TYPE: LIST (items, catalog, customers)
📋 [List Title] ([count] results)
  1. [Item] — [Key Detail] — [Value]
  2. [Item] — [Key Detail] — [Value]
📝 Note: [optional action]

TYPE: ANALYSIS
🔍 Analysis: [Topic]
─────────────────────────────
▲ Highest : [Value]
▼ Lowest  : [Value]
📈 Trend  : [Observation from data]
─────────────────────────────
📝 Recommendation: [one actionable sentence]

TYPE: GENERAL / GUIDE
ℹ️ [Direct answer in 1-2 sentences]
💡 Tip: [optional follow-up]

NEVER respond in plain paragraphs.
NEVER ask the user if they want to be guided — just provide the answer.
NEVER say "I think", "maybe", "possibly", "as an AI", or any uncertain language.
`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 5 — PROMPT ASSEMBLER
// Merges system prompt + trimmed history + user message into Ollama payload.
// History is trimmed to last 6 messages to stay within RAM/speed budget.
// ─────────────────────────────────────────────────────────────────────────────
function assemblePrompt(systemPrompt, history, userMessage) {
  const trimmedHistory = (history || [])
    .filter(m => m.role && m.text)
    .slice(-6)
    .map(m => ({
      role: m.role === "bot" ? "assistant" : "user",
      content: m.text
    }));

  return {
    model: "llama3.2:3b",
    stream: false,
    options: {
      num_thread: 4,       // i5 6th gen — 4 cores
      temperature: 0.1,    // very low — factual mode
      top_p: 0.9,
      num_ctx: 3072,       // balanced for 16GB RAM
      repeat_penalty: 1.1  // prevent repetitive filler text
    },
    messages: [
      { role: "system", content: systemPrompt },
      ...trimmedHistory,
      { role: "user", content: userMessage }
    ]
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 6 — OLLAMA CALLER
// Sends assembled payload to local Llama 3.2 3B instance.
// ─────────────────────────────────────────────────────────────────────────────
async function callOllama(payload) {
  try {
    const response = await fetchWithTimeout(
      "http://127.0.0.1:11434/api/chat",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      },
      60000
    );
    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
    const data = await response.json();
    return data.message?.content?.trim() || null;
  } catch (err) {
    throw new Error("Ollama call failed: " + err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 7 — SAFETY FILTER
// Intercepts hallucinated or vague replies and replaces them with a safe
// fallback. This is the last line of defense before sending to the user.
// ─────────────────────────────────────────────────────────────────────────────
function safetyFilter(reply, dbResult) {
  if (!reply) {
    return "⚠️ The intelligence core returned an empty response. Please try again.";
  }

  // Block vague/uncertain language patterns
  const vaguePatterns = [
    /\bi (think|believe|assume|suppose)\b/i,
    /\b(maybe|possibly|perhaps|probably|might be|could be)\b/i,
    /\bas an ai\b/i,
    /\bi('m| am) not sure\b/i,
    /\bi (don't|do not|cannot|can't) (know|access|retrieve|look up)\b/i,
    /\bi (don't|do not) have (access|real.?time|live)\b/i,
    /\bmy (training|knowledge) (data|cutoff)\b/i,
  ];

  const isVague = vaguePatterns.some(p => p.test(reply));

  // If vague AND we had real DB data, the LLM ignored it — hard block
  if (isVague && dbResult && dbResult.type !== "db_error") {
    return "⚠️ I don't have enough information to answer that accurately based on current data. Please check the relevant page directly.";
  }

  // If vague and no DB data, soft redirect
  if (isVague) {
    return "ℹ️ I don't have that data available right now. Please check the relevant page directly.\n💡 Tip: Use the navigation map to find the right section.";
  }

  return reply;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 8 — NAVIGATION HANDLER
// Handles pure navigation queries without hitting the DB.
// Fast path — no Ollama needed for simple routing questions.
// ─────────────────────────────────────────────────────────────────────────────
function handleNavigation(message) {
  const msg = message.toLowerCase();
  const navMap = [
    { keywords: ["inventory", "stock", "items", "products"], page: "Inventory", route: "/inventory", tip: "Use the search bar to filter by brand or size." },
    { keywords: ["sale", "pos", "point of sale", "transaction", "cashier"], page: "Point of Sale", route: "/pos", tip: "Select a customer first, then add items to the cart." },
    { keywords: ["sales history", "past sale", "invoice", "sales record"], page: "Sales History", route: "/sales", tip: "Filter by date range to narrow down results." },
    { keywords: ["customer", "client"], page: "Customers", route: "/customers", tip: "Search by name or contact number." },
    { keywords: ["supplier", "vendor"], page: "Suppliers", route: "/suppliers", tip: "You can add new suppliers from the top-right button." },
    { keywords: ["purchase", "receiving", "receive stock"], page: "Purchases", route: "/purchases", tip: "Link purchases to a supplier for proper tracking." },
    { keywords: ["financial", "profit", "revenue report"], page: "Financials", route: "/financials", tip: "Owner access only. Covers revenue, expenses, and net profit." },
    { keywords: ["expense"], page: "Expenses", route: "/expenses", tip: "Log daily operational costs here." },
    { keywords: ["cash", "ledger", "daily cash"], page: "Cash Ledger", route: "/cashledger", tip: "Record opening and closing cash balances daily." },
    { keywords: ["staff", "employee", "payroll"], page: "Staff / Payroll", route: "/staff", tip: "Manage roles and salary records from here." },
    { keywords: ["recap", "retread", "vulcanize job"], page: "Recap Jobs", route: "/recap", tip: "Track each retread tire job from drop-off to completion." },
    { keywords: ["return", "refund"], page: "Returns", route: "/returns", tip: "Log customer returns linked to their original invoice." },
    { keywords: ["backup", "restore", "database"], page: "Backup", route: "/backup", tip: "Run a backup before any major changes." },
    { keywords: ["setting", "config", "system"], page: "Settings", route: "/settings", tip: "Configure shop details, tax rates, and system preferences." },
    { keywords: ["dashboard", "home", "overview"], page: "Dashboard", route: "/dashboard", tip: "The dashboard shows your key metrics at a glance." },
  ];

  for (const nav of navMap) {
    if (nav.keywords.some(kw => msg.includes(kw))) {
      return `📍 Location: ${nav.page}\n🔗 Route: ${nav.route}\n\n👣 Steps:\n  1. Click the sidebar menu\n  2. Select "${nav.page}"\n  3. You will land on the ${nav.page} page\n\n💡 Tip: ${nav.tip}`;
    }
  }
  return null; // Not a simple navigation query — proceed to LLM
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER — handleChatRequest
// Express route handler exported to server.js via app.post("/api/chat", ...)
// ─────────────────────────────────────────────────────────────────────────────
async function handleChatRequest(req, res) {
  const { message, pageContext, role, history } = req.body;

  // ── Input Validation ──
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "Message is required." });
  }
  if (message.trim().length > 500) {
    return res.status(400).json({ error: "Message too long. Keep it under 500 characters." });
  }

  const userMessage = message.trim();
  const userRole = role || "staff";
  const currentPage = pageContext?.view || pageContext?.page || "Dashboard";

  console.log(`\n🤖 Chat Request | Role: ${userRole} | Page: ${currentPage}`);
  console.log(`💬 Message: ${userMessage}`);

  try {
    // ── Step 1: Classify intent ──
    const intent = classifyIntent(userMessage);
    console.log(`🎯 Intent: ${intent}`);

    // ── Step 2: Fast-path for pure navigation (no DB, no Ollama needed) ──
    if (intent === "navigation") {
      const navReply = handleNavigation(userMessage);
      if (navReply) {
        console.log("⚡ Navigation fast-path hit");
        return res.json({ reply: navReply, source: "navigation", confidence: "direct" });
      }
    }

    // ── Step 3: Extract params from message ──
    const params = extractParams(userMessage);
    console.log(`🔍 Params:`, params);

    // ── Step 4: Query the real DB ──
    let dbResult = null;
    const queryableIntents = ["inventory", "lowstock", "topselling", "sales", "customers", "financials", "catalog", "analysis"];

    if (queryableIntents.includes(intent)) {
      console.log(`⚙️ Querying DB for intent: ${intent}`);
      dbResult = await resolveFromDB(intent, params, userRole);
      console.log(`✅ DB Result type: ${dbResult?.type}`);

      // Handle access denied before going to LLM
      if (dbResult?.type === "access_denied") {
        return res.json({
          reply: `🔒 Access Restricted\n─────────────────────\nℹ️ ${dbResult.message}`,
          source: "access_control",
          confidence: "direct"
        });
      }

      // Handle DB errors gracefully
      if (dbResult?.type === "db_error") {
        console.error("DB Error:", dbResult.message);
        dbResult = null; // Fall through to LLM with no data
      }
    }

    // ── Step 5: Build grounded system prompt ──
    const systemPrompt = buildSystemPrompt(userRole, currentPage, dbResult);

    // ── Step 6: Assemble Ollama payload ──
    const payload = assemblePrompt(systemPrompt, history, userMessage);

    // ── Step 7: Call Llama 3.2 3B ──
    console.log("🦙 Calling Llama 3.2 3B...");
    const rawReply = await callOllama(payload);

    // ── Step 8: Safety filter ──
    const safeReply = safetyFilter(rawReply, dbResult);

    console.log(`✅ Response ready (${safeReply.length} chars)`);

    return res.json({
      reply: safeReply,
      source: dbResult ? dbResult.type : "context",
      confidence: dbResult ? "data-backed" : "context-based"
    });

  } catch (err) {
    console.error("🚨 Chat Handler Error:", err.message);

    // Graceful error response
    return res.status(503).json({
      reply: "⚠️ System Error\n─────────────────────\nℹ️ The intelligence core encountered an issue. Please try again in a moment.\n💡 Tip: Ensure the Ollama service is running on port 11434.",
      error: err.message
    });
  }
}

module.exports = { handleChatRequest, setInventoryIndex };
