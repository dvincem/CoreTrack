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
// Serve uploaded logos and other assets from the public directory
app.use(express.static(path.join(__dirname, "public")));

// ── Auth ──────────────────────────────────────────────────────────────────────
const { authMiddleware } = require("./middleware/auth");
const authRouter  = require("./routes/auth");
const setupRouter = require("./routes/setup");

// Public endpoints — registered BEFORE authMiddleware
app.use("/api", authRouter);
app.use("/api", setupRouter);

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
const profileRouter      = require("./routes/profile");
const brandsRouter       = require("./routes/brands");

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
app.use("/api", profileRouter);
app.use("/api", brandsRouter);
const searchRouter = require("./routes/search");
app.use("/api", searchRouter);

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
  const os = require('os');
  function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
      const iface = interfaces[devName];
      for (let i = 0; i < iface.length; i++) {
        const alias = iface[i];
        if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
          return alias.address;
        }
      }
    }
    return 'localhost';
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log(`CoreTrack Server Running`);
  console.log(`${"=".repeat(70)}`);
  console.log(`Local:   http://localhost:${PORT}`);
  console.log(`Network: http://${getLocalIP()}:${PORT}`);
  console.log(`Database: tire_shop.db`);
  
  console.log(`${"=".repeat(70)}\n`);
});

initializeDatabase()
  .then(() => {
    console.log("✅ Database structure ready.");
  })
  .catch((err) => {
    console.error("Initialization error:", err);
  });
