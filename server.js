const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const cors = require("cors");

const { db, initializeDatabase, loadExcelData } = require("./Database");
const { dbAll, dbGet } = require("./lib/db");

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

// Serve built frontend in production
app.use(express.static(path.join(__dirname, "dist")));

// ── Auth ──────────────────────────────────────────────────────────────────────
const { authMiddleware } = require("./middleware/auth");
const authRouter = require("./routes/auth");

// Login endpoint must be registered BEFORE the auth middleware
app.use("/api", authRouter);

// Protect all remaining /api routes
app.use("/api", authMiddleware);

// ── Route modules ─────────────────────────────────────────────────────────────
const shopsRouter        = require("./routes/shops");
const itemsRouter        = require("./routes/items");
const servicesRouter     = require("./routes/services");
const staffRouter        = require("./routes/staff");
const suppliersRouter    = require("./routes/suppliers");
const salesRouter        = require("./routes/sales");
const ordersRouter       = require("./routes/orders");
const customersRouter    = require("./routes/customers");
const financialsRouter   = require("./routes/financials");
const recapRouter        = require("./routes/recap");
const profitsRouter      = require("./routes/profits");
const expensesRouter     = require("./routes/expenses");
const cashLedgerRouter   = require("./routes/cashledger");
const returnsRouter      = require("./routes/returns");
const { router: backupRouter, runBackupToFile } = require("./routes/backup");
const purchasesRouter    = require("./routes/purchases");
const credentialsRouter  = require("./routes/credentials");
const reportsRouter      = require("./routes/reports");

app.use("/api", shopsRouter);
app.use("/api", itemsRouter);
app.use("/api", servicesRouter);
app.use("/api", staffRouter);
app.use("/api", suppliersRouter);
app.use("/api", salesRouter);
app.use("/api", ordersRouter);
app.use("/api", customersRouter);
app.use("/api", financialsRouter);
app.use("/api", recapRouter);
app.use("/api", profitsRouter);
app.use("/api", expensesRouter);
app.use("/api", cashLedgerRouter);
app.use("/api", returnsRouter);
app.use("/api", backupRouter);
app.use("/api", purchasesRouter);
app.use("/api", credentialsRouter);
app.use("/api/reports", reportsRouter);

// ── AUTO-BACKUP ENGINE (Every 30 Minutes) ──────────────────────────────────
let isBackupRunning = false;
setInterval(async () => {
  if (isBackupRunning) return;
  isBackupRunning = true;
  console.log(`[${new Date().toLocaleTimeString()}] 💾 Auto-backup starting...`);
  try {
    const result = await runBackupToFile();
    console.log(`[${new Date().toLocaleTimeString()}] ✅ Auto-backup complete (${result.tables} tables saved to backup.xlsx).`);
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ Auto-backup failed:`, err.message);
  } finally {
    isBackupRunning = false;
  }
}, 30 * 60 * 1000); // 30 minutes in ms


// ── HYBRID AI INFRASTRUCTURE ────────────────────────────────────────────────

const queryCache = new Map();
let inventoryIndex = []; // The "Fast Index" for stock

/**
 * Load database into RAM for instant searching (Fast-Search Skill)
 */
async function refreshInventoryIndex() {
  console.log("📦 Indexing inventory for Fast-Search...");
  try {
    const sql = `SELECT i.item_id, i.item_name, i.brand, i.size, i.selling_price, IFNULL(s.current_quantity, 0) as stock 
                 FROM item_master i LEFT JOIN current_stock s ON i.item_id = s.item_id`;
    const rows = await dbAll(sql);
    inventoryIndex = rows;
    setInventoryIndex(rows);
    console.log(`✅ Indexed ${rows.length} items in RAM.`);
  } catch (err) {
    console.error("❌ Failed to index inventory:", err.message);
  }
}

/**
 * Fast JS search instead of SQL for simple stock lookups
 */
function fastSearch(params) {
  return inventoryIndex.filter(item => {
    const matchBrand  = params.brand ? item.brand?.toLowerCase().includes(params.brand.toLowerCase()) : true;
    const matchSize   = params.size ? item.size?.toLowerCase().includes(params.size.toLowerCase()) : true;
    const matchDesign = params.design ? item.item_name?.toLowerCase().includes(params.design.toLowerCase()) : true;
    return matchBrand && matchSize && matchDesign;
  });
}

const fetchWithTimeout = async (url, options, timeout = 45000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

async function callOllama(systemPrompt, userMessage, temperature = 0.1, format = "text") {
  try {
    const response = await fetchWithTimeout("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2:3b",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
        stream: false,
        format: format === "json" ? "json" : undefined,
        options: { temperature, num_ctx: 4096 }
      })
    });
    if (!response.ok) throw new Error(`Ollama Error: ${response.status}`);
    const data = await response.json();
    return data.message.content.trim();
  } catch (error) {
    throw new Error("LLM Core Failure: " + error.message);
  }
}

const { handleChatRequest, setInventoryIndex } = require("./chatbot");
app.post("/api/chat", handleChatRequest);

// ── ROUTE: The Optimized Intelligence Core (Hybrid Omni-Router) ─────────────

app.post("/api/ai-consultant", async (req, res) => {
  const { message, pageContext } = req.body;
  if (!message) return res.status(400).json({ error: "No inquiry provided." });

  const cacheKey = message.toLowerCase().trim();
  if (queryCache.has(cacheKey)) {
    console.log("⚡ Cache Hit");
    return res.json({ answer: queryCache.get(cacheKey) });
  }

  const SYSTEM_MAP = `
    ROUTES: /inventory, /sales, /financials, /customers, /settings, /pos, /payroll.
    SCHEMA: 
    - item_master (specs, prices)
    - current_stock (quantities)
    - sale_header (revenue)
    - staff_master (roles)
  `;

  const OMNI_ROUTER_PROMPT = `
    You are the Executive Intelligence for Jonde Tire Trading. ${SYSTEM_MAP}
    Analyze user intent and respond ONLY in JSON:
    {
      "intent": "CHAT" | "GUIDE" | "FAST_SEARCH" | "COMPLEX_SQL",
      "response": "Direct reply if CHAT or GUIDE",
      "searchParams": { "brand": "...", "size": "...", "design": "..." }, 
      "sql": "SQLite query if COMPLEX_SQL",
      "reasoning": "Why this path?"
    }
    - Use FAST_SEARCH for specific tires, stock, or prices.
    - Use COMPLEX_SQL for totals, trends, or multi-table reports.
    - Use GUIDE for navigation / how-to.
    Page Context: ${JSON.stringify(pageContext || {})}`;

  try {
    console.log("🧠 Routing Request...");
    const routerRaw = await callOllama(OMNI_ROUTER_PROMPT, message, 0.2, "json");
    const decision = JSON.parse(routerRaw);

    // SKILL 1 & 2: Chat / Guide
    if (decision.intent === "CHAT" || decision.intent === "GUIDE") {
      return res.json({ answer: decision.response });
    }

    // SKILL 3: Fast Stock Search (In-Memory)
    if (decision.intent === "FAST_SEARCH") {
      console.log("⚡ Fast-Search Triggered");
      const results = fastSearch(decision.searchParams);
      
      if (results.length === 0) {
        return res.json({ answer: "I checked our current floor stock but couldn't find a match for those details. Try a broader search." });
      }

      const synthPrompt = `You are the Shop Intelligence Officer. Format this stock data into a professional response. 
                           Format: ANSWER [numbers], ANALYSIS [insight], NEXT STEPS [action].`;
      const report = await callOllama(synthPrompt, `User: ${message}\nData: ${JSON.stringify(results.slice(0, 10))}`, 0.3);
      return res.json({ answer: report });
    }

    // SKILL 4: Complex Data Analysis (SQL)
    if (decision.intent === "COMPLEX_SQL") {
      console.log("⚙️ SQL Engine Triggered");
      let rawSQL = decision.sql.replace(/```sql|```/g, "").trim();
      
      if (/(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|PRAGMA)/i.test(rawSQL)) {
        throw new Error("Security Violation: Destructive SQL blocked.");
      }

      const rows = await new Promise((resolve, reject) => {
        db.all(rawSQL, [], (err, rows) => (err ? reject(err) : resolve(rows)));
      });

      const synthPrompt = `You are the Lead Business Analyst. Format this complex data into a professional English report.
                           Format: ANSWER, ANALYSIS, NEXT STEPS.`;
      const report = await callOllama(synthPrompt, `User: ${message}\nData: ${JSON.stringify(rows).substring(0, 3000)}`, 0.3);
      
      queryCache.set(cacheKey, report);
      setTimeout(() => queryCache.delete(cacheKey), 300000);

      return res.json({ answer: report });
    }

  } catch (error) {
    console.error("🚨 Core Failure:", error.message);
    res.status(503).json({ error: "Intelligence core error.", details: error.message });
  }
});

// SPA catch-all
app.get("*", (_req, res) => {
  const distIndex = path.join(__dirname, "dist", "index.html");
  if (require("fs").existsSync(distIndex)) {
    res.sendFile(distIndex);
  } else {
    res.status(404).send("Run `npm run build` to generate the frontend.");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`CoreTrack Server Running`);
  console.log(`${"=".repeat(70)}`);
  console.log(`Local:   http://localhost:${PORT}`);
  console.log(`Network: http://192.168.254.137:${PORT}`);
  console.log(`Database: tire_shop.db`);
  
  // ── On-Boot Indexing & Diagnostics ──
  await refreshInventoryIndex();
  
  try {
    const ollamaCheck = await fetch('http://127.0.0.1:11434/');
    if (ollamaCheck.ok) {
      console.log("🟢 Ollama Engine: Online (Llama 3.2)");
    }
  } catch (err) {
    console.log("🔴 CRITICAL WARNING: Ollama is NOT running on port 11434.");
  }
  
  console.log(`${"=".repeat(70)}\n`);
});

initializeDatabase()
  .then(() => process.env.RESET_DB === '1' ? loadExcelData() : Promise.resolve())
  .catch((err) => {
    console.error("Initialization error:", err);
  });
