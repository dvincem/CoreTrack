const express = require("express");
const router = express.Router();
const { db } = require("../Database");
const { v4: uuidv4 } = require("uuid");

router.get("/staff-kpi/:shop_id", (req, res) => {
  db.get(`
    SELECT
      COUNT(*) AS totalStaff,
      COUNT(CASE WHEN role IN ('Owner','Manager','Sales','Cashier','Admin') THEN 1 END) AS mgmtCount,
      COUNT(CASE WHEN role IN ('Tireman','Technician','Mechanic','Vulcanizer','Helper','Service Staff') THEN 1 END) AS serviceCount,
      COUNT(CASE WHEN work_status IN ('VACATION','SUSPENDED') THEN 1 END) AS onLeave
    FROM staff_master WHERE is_active = 1`, [],
    (err, row) => res.json(err ? { error: err.message } : row));
});

router.get("/staff/:shop_id", (req, res) => {
  const { q, role, page, perPage } = req.query;
  const paginated = page !== undefined || perPage !== undefined || q !== undefined;

  const whereParts = [`s.is_active = 1`];
  const params = [];
  
  // Enhanced Role Filtering
  if (role === 'Management') {
    whereParts.push(`s.role IN ('Owner', 'Manager', 'Sales', 'Cashier', 'Admin')`);
  } else if (role === 'Service') {
    whereParts.push(`s.role IN ('Tireman', 'Technician', 'Mechanic', 'Vulcanizer', 'Helper', 'Service Staff')`);
  } else if (role === 'On Leave') {
    whereParts.push(`s.work_status IN ('VACATION', 'SUSPENDED')`);
  } else if (role) {
    whereParts.push(`s.role = ?`);
    params.push(role);
  }

  if (q && String(q).trim()) {
    const needle = `%${String(q).trim()}%`;
    whereParts.push(`(s.full_name LIKE ? OR s.email LIKE ? OR s.role LIKE ? OR s.staff_code LIKE ?)`);
    params.push(needle, needle, needle, needle);
  }
  const whereSql = `WHERE ${whereParts.join(" AND ")}`;
  const orderSql = `ORDER BY s.full_name`;

  if (!paginated) {
    db.all(`SELECT s.* FROM staff_master s ${whereSql} ${orderSql}`, params,
      (err, rows) => res.json(err ? { error: err.message } : (rows || [])));
    return;
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedPerPage = Math.min(200, Math.max(1, parseInt(perPage, 10) || 20));
  const offset = (parsedPage - 1) * parsedPerPage;

  db.get(`SELECT COUNT(*) as total FROM staff_master s ${whereSql}`, params, (errC, row) => {
    if (errC) return res.json({ error: errC.message });
    const total = row?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / parsedPerPage));
    db.all(`SELECT s.* FROM staff_master s ${whereSql} ${orderSql} LIMIT ? OFFSET ?`,
      [...params, parsedPerPage, offset],
      (err, rows) => {
        if (err) return res.json({ error: err.message });
        res.json({ data: rows || [], meta: { page: parsedPage, perPage: parsedPerPage, total, totalCount: total, totalPages } });
      });
  });
});

router.post("/staff", (req, res) => {
  const { full_name, email, role } = req.body;
  if (!full_name || !full_name.trim()) {
    return res.status(400).json({ error: "full_name is required" });
  }
  const staff_id = `STAFF-${uuidv4()}`;
  const prefix = full_name.trim().substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const staff_code = `EMP-${prefix}-${Date.now().toString().slice(-4)}`;
  db.run(
    `INSERT INTO staff_master (staff_id, staff_code, full_name, email, role, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
    [staff_id, staff_code, full_name.trim(), email || null, role || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ staff_id, staff_code, full_name: full_name.trim(), email: email || null, role: role || null, is_active: 1 });
    },
  );
});

router.delete("/staff/:staff_id", (req, res) => {
  const { staff_id } = req.params;
  db.run(`UPDATE staff_master SET is_active = 0 WHERE staff_id = ?`, [staff_id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(422).json({ error: "Staff not found" });
    res.json({ staff_id, message: "Employee removed successfully" });
  });
});

router.patch("/staff/:staff_id", (req, res) => {
  const { staff_id } = req.params;
  const { full_name, email, role } = req.body;
  if (!full_name || !full_name.trim()) return res.status(400).json({ error: "full_name is required" });
  db.run(
    `UPDATE staff_master SET full_name = ?, email = ?, role = ? WHERE staff_id = ?`,
    [full_name.trim(), email || null, role || null, staff_id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ staff_id, full_name: full_name.trim(), email: email || null, role: role || null });
    }
  );
});

router.patch("/staff/:staff_id/work-status", (req, res) => {
  const { staff_id } = req.params;
  const { work_status } = req.body;
  const valid = ["ACTIVE", "ALWAYS_PRESENT", "VACATION", "SUSPENDED", "TERMINATED"];
  if (!valid.includes(work_status)) return res.status(400).json({ error: "Invalid work_status" });
  db.run(`UPDATE staff_master SET work_status = ? WHERE staff_id = ?`, [work_status, staff_id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ staff_id, work_status });
  });
});

router.post("/attendance", (req, res) => {
  const { staff_id, shop_id, attendance_date, status } = req.body;
  if (!staff_id || !shop_id || !attendance_date) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const attendance_id = `ATT-${uuidv4()}`;
  db.run(
    `INSERT INTO staff_attendance (attendance_id, staff_id, shop_id, attendance_date, status, recorded_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(staff_id, attendance_date) DO UPDATE SET status = ?, recorded_at = CURRENT_TIMESTAMP`,
    [attendance_id, staff_id, shop_id, attendance_date, status || "PRESENT", status || "PRESENT"],
    (err) => {
      res.json(err ? { error: err.message } : { status: "success", attendance_id });
    },
  );
});

router.get("/attendance/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  const { attendance_date } = req.query;
  
  db.all(
    `SELECT staff_id, full_name, staff_code, work_status 
     FROM staff_master 
     WHERE is_active = 1`,
    [],
    (errStaff, staffList) => {
      if (errStaff) return res.json({ error: errStaff.message });

      db.all(
        `SELECT sa.*, s.full_name, s.staff_code
         FROM staff_attendance sa
         LEFT JOIN staff_master s ON sa.staff_id = s.staff_id
         WHERE sa.shop_id = ? AND DATE(sa.attendance_date) = ?
         ORDER BY s.full_name`,
        [shop_id, attendance_date],
        (errAtt, attRows) => {
          if (errAtt) return res.json({ error: errAtt.message });

          const attMap = new Map();
          attRows.forEach(row => attMap.set(row.staff_id, row));

          const todayStr = new Date().toISOString().split('T')[0];
          const finalRows = [...attRows];
          staffList.forEach(s => {
            if (s.work_status === 'ALWAYS_PRESENT' && !attMap.has(s.staff_id) && attendance_date <= todayStr) {
              finalRows.push({
                attendance_id: `AUTO-${s.staff_id}`,
                staff_id: s.staff_id,
                shop_id: shop_id,
                attendance_date: attendance_date,
                status: 'PRESENT',
                recorded_at: null,
                full_name: s.full_name,
                staff_code: s.staff_code,
                is_auto: true
              });
            }
          });

          finalRows.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
          res.json(finalRows);
        },
      );
    }
  );
});

router.get("/attendance-history/:shop_id/:staff_id", (req, res) => {
  const { shop_id, staff_id } = req.params;
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: "from and to required" });

  db.get(`SELECT work_status FROM staff_master WHERE staff_id = ?`, [staff_id], (errS, staff) => {
    if (errS) return res.status(500).json({ error: errS.message });

    db.all(
      `SELECT attendance_date, status
       FROM staff_attendance
       WHERE shop_id = ? AND staff_id = ? AND DATE(attendance_date) BETWEEN ? AND ?
       ORDER BY attendance_date`,
      [shop_id, staff_id, from, to],
      (err, rows) => {
        if (err) return res.json({ error: err.message });
        
        if (staff?.work_status === 'ALWAYS_PRESENT') {
          const recordsMap = new Map();
          rows.forEach(r => recordsMap.set(r.attendance_date.split('T')[0], r.status));
          
          const synthesized = [];
          const todayStr = new Date().toISOString().split('T')[0];
          let current = new Date(from);
          const endDate = new Date(to);
          while (current <= endDate) {
            const dateStr = current.toISOString().split('T')[0];
            const explicitStatus = recordsMap.get(dateStr);
            
            synthesized.push({
              attendance_date: dateStr,
              status: explicitStatus || (dateStr <= todayStr ? 'PRESENT' : null)
            });
            current.setDate(current.getDate() + 1);
          }
          return res.json(synthesized);
        }
        
        res.json(rows);
      }
    );
  });
});

router.get("/attendance-stats/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: "from and to required" });

  const dFrom = new Date(from);
  const dTo = new Date(to);
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const dEndForStats = dTo < today ? dTo : today;
  const diffDaysUpToToday = Math.max(0, Math.ceil(Math.abs(dEndForStats - dFrom) / (1000 * 60 * 60 * 24)) + 1);
  const diffDays = Math.ceil(Math.abs(dTo - dFrom) / (1000 * 60 * 60 * 24)) + 1;

  db.all(
    `SELECT s.staff_id, s.work_status,
       COUNT(sa.attendance_id) as record_count,
       SUM(CASE WHEN sa.status = 'PRESENT' THEN 1 ELSE 0 END) as present_records,
       SUM(CASE WHEN sa.status = 'ABSENT'  THEN 1 ELSE 0 END) as absent_records
     FROM staff_master s
     LEFT JOIN staff_attendance sa ON s.staff_id = sa.staff_id AND sa.shop_id = ? AND DATE(sa.attendance_date) BETWEEN ? AND ?
     WHERE s.is_active = 1
     GROUP BY s.staff_id`,
    [shop_id, from, to],
    (err, rows) => {
      if (err) return res.json({ error: err.message });
      const results = rows.map(r => {
        let total = r.record_count;
        let present = r.present_records;
        let absent = r.absent_records;
        if (r.work_status === 'ALWAYS_PRESENT') {
          // Total days is diffDays, but present days only up to today
          total = diffDays;
          present = diffDaysUpToToday;
          absent = 0;
        }
        return { staff_id: r.staff_id, total_days: total, present_days: present, absent_days: absent };
      });
      res.json(results);
    }
  );
});

async function generatePayrollInternal(shop_id, business_date, generated_by = 'SYSTEM') {
  // 1. Clear existing payroll for this date/shop if it exists (allows regeneration)
  await new Promise((resolve, reject) => {
    db.run(`DELETE FROM staff_daily_revenue WHERE shop_id = ? AND business_date = ?`,
      [shop_id, business_date], (err) => (err ? reject(err) : resolve()));
  });

  const staffList = await new Promise((resolve, reject) => {
    db.all(
      `SELECT DISTINCT s.staff_id 
       FROM staff_master s
       LEFT JOIN staff_attendance sa ON s.staff_id = sa.staff_id AND DATE(sa.attendance_date) = ?
       WHERE s.is_active = 1 
         AND (sa.status = 'PRESENT' OR s.work_status = 'ALWAYS_PRESENT')`,
      [business_date], (err, rows) => (err ? reject(err) : resolve(rows)));
  });

  if (staffList.length === 0) return { payrolls: [], message: "No staff present" };

  const payrolls = [];
  return new Promise((resolve, reject) => {
    let processed = 0;
    db.serialize(() => {
      for (const staff of staffList) {
        const payout_id = `PAY-${require('uuid').v4()}`;
        db.all(
          `SELECT total_amount, commission_amount
           FROM labor_log
           WHERE staff_id = ? AND shop_id = ? AND business_date = ? AND is_void = 0`,
          [staff.staff_id, shop_id, business_date],
          (err, logs) => {
            if (err) { processed++; if (processed === staffList.length) resolve({ payrolls, status: "success" }); return; }
            const service_total = (logs || []).filter(l => l.commission_amount === 0).reduce((sum, l) => sum + (l.total_amount || 0), 0);
            const commission_total = (logs || []).reduce((sum, l) => sum + (l.commission_amount || 0), 0);
            const final_payout = service_total / 2 + commission_total;
            db.run(
              `INSERT INTO staff_daily_revenue (payout_id, shop_id, staff_id, business_date, service_total, commission_total, final_payout, generated_by, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
              [payout_id, shop_id, staff.staff_id, business_date, service_total, commission_total, final_payout, generated_by],
              (err) => {
                processed++;
                if (!err) payrolls.push({ payout_id, staff_id: staff.staff_id, final_payout, service_total, commission_total });
                if (processed === staffList.length) resolve({ payrolls, status: "success", generated: payrolls.length });
              },
            );
          },
        );
      }
    });
  });
}

router.post("/payroll/generate", async (req, res) => {
  const { shop_id, business_date, generated_by } = req.body;
  if (!shop_id || !business_date) return res.status(400).json({ error: "Missing shop_id or business_date" });
  
  const todayStr = new Date().toISOString().split('T')[0];
  if (business_date > todayStr) {
    return res.status(400).json({ error: "Cannot generate payroll for future dates" });
  }

  try {
    const result = await generatePayrollInternal(shop_id, business_date, generated_by);
    res.json(result);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get("/payroll/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  const { business_date } = req.query;
  let query = `SELECT sr.*, s.full_name, s.staff_code
    FROM staff_daily_revenue sr
    LEFT JOIN staff_master s ON sr.staff_id = s.staff_id
    WHERE sr.shop_id = ?`;
  const params = [shop_id];
  if (business_date) { query += ` AND DATE(sr.business_date) = ?`; params.push(business_date); }
  query += ` ORDER BY sr.business_date DESC, s.full_name`;
  db.all(query, params, (err, rows) => res.json(err ? { error: err.message } : rows));
});

router.get("/labor-log/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  const { date } = req.query;
  const business_date = date || new Date().toISOString().split("T")[0];
  db.all(
    `SELECT ll.*, sm.full_name, sm.staff_code
     FROM labor_log ll
     LEFT JOIN staff_master sm ON ll.staff_id = sm.staff_id
     WHERE ll.shop_id = ? AND ll.business_date = ?
     ORDER BY ll.log_datetime DESC`,
    [shop_id, business_date],
    (err, rows) => res.json(err ? { error: err.message } : rows)
  );
});

router.get("/labor-summary/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  const { date } = req.query;
  const business_date = date || new Date().toISOString().split("T")[0];
  db.all(
    `SELECT sm.staff_id, sm.full_name, sm.staff_code,
       COUNT(ll.log_id) as service_count,
       COALESCE(SUM(CASE WHEN ll.is_void=0 THEN ll.total_amount ELSE 0 END),0) as service_total,
       COALESCE(SUM(CASE WHEN ll.is_void=0 THEN ll.commission_amount ELSE 0 END),0) as commission_total
     FROM staff_master sm
     LEFT JOIN labor_log ll ON sm.staff_id = ll.staff_id AND ll.shop_id = ? AND ll.business_date = ?
     WHERE sm.is_active = 1
       AND EXISTS (SELECT 1 FROM labor_log WHERE staff_id = sm.staff_id AND shop_id = ? AND business_date = ? AND is_void = 0)
     GROUP BY sm.staff_id
     ORDER BY sm.full_name`,
    [shop_id, business_date, shop_id, business_date],
    (err, rows) => {
      if (err) return res.json({ error: err.message });
      res.json(rows.map(r => ({ ...r, gross_earnings: r.service_total + r.commission_total, net_earnings: (r.service_total / 2) + r.commission_total })));
    }
  );
});

router.post("/labor-log", (req, res) => {
  const { shop_id, staff_id, service_id, service_name, quantity, unit_price, commission_amount, business_date, encoded_by } = req.body;
  if (!shop_id || !staff_id || !service_id || !unit_price) return res.status(400).json({ error: "Missing fields" });
  const log_id = `LOG-${uuidv4()}`;
  const qty = parseFloat(quantity) || 1;
  const price = parseFloat(unit_price);
  const total = qty * price;
  const commission = parseFloat(commission_amount) || 0;
  const bdate = business_date || new Date().toISOString().split("T")[0];
  db.run(
    `INSERT INTO labor_log (log_id, shop_id, staff_id, service_id, service_name, quantity, unit_price, total_amount, commission_amount, business_date, encoded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [log_id, shop_id, staff_id, service_id, service_name, qty, price, total, commission, bdate, encoded_by || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ log_id, total_amount: total, commission_amount: commission });
    }
  );
});

router.post("/commission-direct", (req, res) => {
  const { shop_id, staff_id, commission_amount, notes, business_date, encoded_by } = req.body;
  if (!shop_id || !staff_id || !commission_amount) return res.status(400).json({ error: "Required fields missing" });
  const amt = parseFloat(commission_amount);
  if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: "Invalid amount" });
  const log_id = `LOG-${uuidv4()}`;
  const bdate = business_date || new Date().toISOString().split("T")[0];
  const svcName = notes ? `Direct Commission — ${notes}` : "Direct Commission";
  db.run(
    `INSERT INTO labor_log (log_id, shop_id, staff_id, service_id, service_name, quantity, unit_price, total_amount, commission_amount, business_date, encoded_by)
     VALUES (?, ?, ?, 'DIRECT_COMMISSION', ?, 1, 0, 0, ?, ?, ?)`,
    [log_id, shop_id, staff_id, svcName, amt, bdate, encoded_by || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ log_id, commission_amount: amt });
    }
  );
});

router.put("/labor-log/:log_id/void", async (req, res) => {
  const { log_id } = req.params;
  const { void_reason } = req.body;

  try {
    // Check if payroll exists for this log's date
    const log = await new Promise((resolve, reject) => {
      db.get(`SELECT business_date, shop_id FROM labor_log WHERE log_id = ?`, [log_id], (err, row) => err ? reject(err) : resolve(row));
    });

    if (!log) return res.status(404).json({ error: "Log not found" });

    const payroll = await new Promise((resolve, reject) => {
      db.get(`SELECT payout_id FROM staff_daily_revenue WHERE shop_id = ? AND business_date = ?`, [log.shop_id, log.business_date], (err, row) => err ? reject(err) : resolve(row));
    });

    if (payroll) {
      return res.status(400).json({ error: "Cannot void: Payroll already finalized for this date. Regenerate payroll first." });
    }

    db.run(`UPDATE labor_log SET is_void = 1, void_reason = ? WHERE log_id = ?`, [void_reason || "Voided", log_id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ log_id, message: "Entry voided" });
      });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/services-summary/:shop_id", (req, res) => {
  const { shop_id } = req.params;
  const { startDate, endDate, page, perPage } = req.query;
  const paginated = page !== undefined || perPage !== undefined;
  const today = new Date().toISOString().split("T")[0];
  const start = startDate || today;
  const end = endDate || today;
  db.all(
    `SELECT ll.log_id, ll.staff_id, ll.service_id, ll.service_name,
            ll.quantity, ll.unit_price, ll.total_amount, ll.commission_amount,
            ll.business_date, sm.full_name, sm.staff_code
     FROM labor_log ll
     LEFT JOIN staff_master sm ON ll.staff_id = sm.staff_id
     WHERE ll.shop_id = ? AND DATE(ll.business_date) BETWEEN ? AND ? AND ll.is_void = 0
     ORDER BY sm.full_name, ll.log_datetime`,
    [shop_id, start, end],
    (err, rows) => {
      if (err) return res.json({ error: err.message });
      const map = {};
      for (const r of rows) {
        if (!map[r.staff_id]) map[r.staff_id] = { staff_id: r.staff_id, full_name: r.full_name || r.staff_id, staff_code: r.staff_code, services: [], commissions: [] };
        if (r.commission_amount > 0) map[r.staff_id].commissions.push({ log_id: r.log_id, service_name: r.service_name, quantity: r.quantity, amount: r.commission_amount, business_date: r.business_date });
        else map[r.staff_id].services.push({ log_id: r.log_id, service_name: r.service_name, quantity: r.quantity, amount: r.total_amount, business_date: r.business_date });
      }
      const all = Object.values(map);
      if (!paginated) return res.json(all);
      const pPage = Math.max(1, parseInt(page, 10) || 1);
      const pPerPage = Math.min(200, Math.max(1, parseInt(perPage, 10) || 50));
      const total = all.length;
      res.json({ data: all.slice((pPage-1)*pPerPage, pPage*pPerPage), meta: { page: pPage, perPage: pPerPage, total, totalPages: Math.max(1, Math.ceil(total / pPerPage)) } });
    }
  );
});

module.exports = router;
module.exports.generatePayrollInternal = generatePayrollInternal;
