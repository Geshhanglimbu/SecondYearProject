/*
  Backend Server (Node.js + Express)
  - Handles API requests
  - Connects to MySQL database
  - Stores user registration data
  - Manages image upload using Multer
*/

import express  from "express";
import mysql    from "mysql2";
import cors     from "cors";
import bcrypt   from "bcryptjs";
import multer   from "multer";
import path     from "path";
import fs       from "fs";
import axios    from "axios";
import crypto   from "crypto";

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
  console.log("uploads folder created");
}

const app = express();

app.use(cors({
  origin: "http://localhost:5173",
  methods: "GET,POST,PUT,DELETE",
  credentials: true
}));

app.use(express.json());
app.use("/uploads", express.static("uploads"));

const db = mysql.createConnection({
  host:     "localhost",
  port:     3307,
  user:     "root",
  password: "1234",
  database: "gms"
});

db.connect((err) => {
  if (err) throw err;
  console.log("MySQL Connected");

  // ── Auto-migrate: safely add columns that may be missing ────────────────
  // Uses INFORMATION_SCHEMA so it works on MySQL 5.7+ (no IF NOT EXISTS needed)
  const columnsToAdd = [
    ["gateway",        "VARCHAR(50)  NULL"],
    ["transaction_id", "VARCHAR(255) NULL"],
    ["paid_date",      "DATE         NULL"],
    ["description",    "VARCHAR(255) NULL"],
  ];

  // Print existing columns so you can see schema on startup
  db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments'
     ORDER BY ORDINAL_POSITION`,
    (err, cols) => {
      if (!err && cols.length > 0) {
        console.log("payments columns:", cols.map(c => c.COLUMN_NAME).join(", "));
      } else {
        console.log("payments table not found yet or error:", err?.message);
      }
    }
  );

  columnsToAdd.forEach(([colName, colDef]) => {
    db.query(
      `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = ?`,
      [colName],
      (err, rows) => {
        if (err) { console.warn("Migration check failed:", colName, err.message); return; }
        if (rows[0].cnt === 0) {
          db.query(`ALTER TABLE payments ADD COLUMN ${colName} ${colDef}`, (err2) => {
            if (err2) console.warn("Migration ADD failed:", colName, err2.message);
            else      console.log("✅ Added column:", colName);
          });
        }
      }
    );
  });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename:    (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });


/* ══════════════════════════════════════════════
   REGISTER
   ══════════════════════════════════════════════ */
app.post("/register", upload.single("image"), async (req, res) => {
  const { role, name, email, phone, address, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const image = req.file ? req.file.filename : null;
  const sql = "INSERT INTO users (role, name, email, phone, address, password, image) VALUES (?, ?, ?, ?, ?, ?, ?)";
  db.query(sql, [role, name, email, phone, address, hashedPassword, image], (err) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY") return res.status(400).json({ message: "Email already registered! Please use a different email." });
      console.log(err);
      return res.status(500).json({ message: "Registration failed" });
    }
    res.json({ message: "Registered successfully" });
  });
});


/* ══════════════════════════════════════════════
   LOGIN
   ══════════════════════════════════════════════ */
app.post("/login", async (req, res) => {
  const { email, password, role } = req.body;
  db.query("SELECT * FROM users WHERE email = ? AND role = ?", [email, role], async (err, results) => {
    if (err) { console.log("LOGIN SQL ERROR:", err); return res.status(500).json({ message: "Server error" }); }
    if (results.length === 0) return res.status(400).json({ message: "Invalid email or role" });
    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Incorrect password" });
    res.json({ message: "Login successful", user });
  });
});


/* ══════════════════════════════════════════════
   CITIZEN DASHBOARD
   ══════════════════════════════════════════════ */
app.get("/api/citizen/dashboard/:userId", (req, res) => {
  const userId = req.params.userId;
  const requestsQuery    = `SELECT * FROM requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`;
  const complaintsQuery  = `SELECT * FROM complaints WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`;
  const latestPaymentQuery = `
    SELECT * FROM payments WHERE user_id = ? AND status != 'paid'
    ORDER BY CASE WHEN status='overdue' THEN 1 WHEN status='pending' THEN 2 ELSE 3 END, due_date ASC LIMIT 1`;
  const pendingCountQuery = `SELECT COUNT(*) as count FROM payments WHERE user_id = ? AND status != 'paid'`;

  db.query(requestsQuery, [userId], (err, recentRequests) => {
    if (err) { console.log(err); return res.status(500).json({ message: "Failed to fetch requests" }); }
    db.query(complaintsQuery, [userId], (err, recentComplaints) => {
      if (err) recentComplaints = [];
      db.query(latestPaymentQuery, [userId], (err, paymentResults) => {
        if (err) paymentResults = [];
        db.query(pendingCountQuery, [userId], (err, countResults) => {
          if (err) countResults = [{ count: 0 }];
          const totalRequests = recentRequests.length;
          res.json({
            stats: {
              points: totalRequests * 100, recycledKg: totalRequests * 10,
              treesPlanted: Math.floor(totalRequests / 2), wasteReduced: Math.min(totalRequests * 5, 100),
            },
            recentRequests, recentComplaints,
            latestPayment: paymentResults[0] || null,
            pendingCount:  countResults[0]?.count || 0,
          });
        });
      });
    });
  });
});


/* ══════════════════════════════════════════════
   SUBMIT REQUEST
   ══════════════════════════════════════════════ */
app.post("/api/submit-request", upload.array("files", 5), (req, res) => {
  const { type, description, pickupDate, pickupTime, userId, location } = req.body;
  if (!userId) return res.status(400).json({ message: "User ID is required" });
  const images = req.files && req.files.length > 0 ? req.files.map(f => f.filename).join(",") : null;
  db.query(
    "INSERT INTO requests (user_id, type, description, pickup_date, pickup_time, image, location) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [userId, type, description, pickupDate, pickupTime, images, location || null],
    (err) => {
      if (err) { console.log(err); return res.status(500).json({ message: "Request submission failed" }); }
      res.status(200).json({ message: "Request submitted successfully!" });
    }
  );
});


/* ══════════════════════════════════════════════
   GET USER REQUESTS
   ══════════════════════════════════════════════ */
app.get("/api/requests/:userId", (req, res) => {
  db.query("SELECT * FROM requests WHERE user_id = ? ORDER BY created_at DESC", [req.params.userId], (err, results) => {
    if (err) { console.log(err); return res.status(500).json({ message: "Failed to fetch requests" }); }
    res.json(results);
  });
});


/* ══════════════════════════════════════════════════════════
   PAYMENT ROUTES
   ══════════════════════════════════════════════════════════ */

/* ── GET all payments for a user ── */
app.get("/api/payments/:userId", (req, res) => {
  db.query(
    "SELECT * FROM payments WHERE user_id = ? ORDER BY id DESC",
    [req.params.userId],
    (err, results) => {
      if (err) { console.log(err); return res.status(500).json({ message: "Failed to fetch payments" }); }
      res.json(results);
    }
  );
});


/* ── eSewa INITIATE ── */
app.post("/api/payments/esewa/initiate", (req, res) => {
  const { amount, userId, paymentId } = req.body;

  const txnId = paymentId
    ? `ECO-${userId}-${paymentId}-${Date.now()}`
    : `ECO-${userId}-${Date.now()}`;

  const parsedAmount = parseFloat(amount);
  const baseAmount   = parseFloat((parsedAmount / 1.125).toFixed(2));
  const taxAmount    = parseFloat((parsedAmount - baseAmount).toFixed(2));
  const totalAmount  = parseFloat((baseAmount + taxAmount).toFixed(2));
  const secretKey    = "8gBm/:&EnhH.1/q";
  const message      = `total_amount=${totalAmount},transaction_uuid=${txnId},product_code=EPAYTEST`;

  const signature = crypto.createHmac("sha256", secretKey).update(message).digest("base64");

  console.log("eSewa initiate → txnId:", txnId, "| total:", totalAmount, "| sig:", signature);

  res.json({
    amount:                  baseAmount,
    tax_amount:              taxAmount,
    total_amount:            totalAmount,
    transaction_uuid:        txnId,
    product_code:            "EPAYTEST",
    signature,
    signed_field_names:      "total_amount,transaction_uuid,product_code",
    success_url:            "http://localhost:5173/payment/success",
    failure_url:             "http://localhost:5173/payment/failed",
    product_service_charge:  "0",
    product_delivery_charge: "0",
  });
});


/* ── eSewa VERIFY ── */
app.post("/api/payments/esewa/verify", async (req, res) => {
  const { data, paymentId, userId } = req.body;

  // STEP 1: Decode base64
  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(data, "base64").toString("utf-8"));
  } catch (e) {
    console.log("eSewa: base64 decode failed:", e.message);
    return res.status(400).json({ message: "Invalid eSewa data", verified: false });
  }

  // STEP 2: Log everything — read this in your terminal after every payment
 
  console.log("     eSewa VERIFY CALLED         ");
  console.log("Frontend sent  → userId:", userId, "| paymentId:", paymentId);
  console.log("eSewa decoded  →", JSON.stringify(decoded, null, 2));

  // STEP 3: Case-insensitive status check
  // eSewa test env sends "COMPLETE", "complete", or "Completed" — handle all
  const rawStatus = (decoded.status || "").toUpperCase().trim();
  const isSuccess = ["COMPLETE", "COMPLETED", "SUCCESS"].includes(rawStatus);
  console.log("Status check   → raw:", decoded.status, "| normalised:", rawStatus, "| pass:", isSuccess);

  if (!isSuccess) {
    console.log("eSewa: PAYMENT NOT SUCCESSFUL. Status was:", decoded.status);
    return res.status(400).json({
      message: `Payment not completed. eSewa status: "${decoded.status}"`,
      verified: false
    });
  }

  const txnUuid = decoded.transaction_uuid || "";

  // STEP 4: Resolve paymentId — explicit > extracted from txnUuid > userId lookup
  let resolvedPaymentId = (paymentId && paymentId !== "null" && paymentId !== "undefined")
    ? String(paymentId) : null;

  if (!resolvedPaymentId && txnUuid) {
    // txnId format: ECO-{userId}-{paymentId}-{timestamp} when paymentId known (4 parts)
    const parts = txnUuid.split("-");
    if (parts.length >= 4 && parts[0] === "ECO") {
      resolvedPaymentId = parts[2];
      console.log("Extracted paymentId from txnUuid →", resolvedPaymentId);
    }
  }

  // Parse amount safely — eSewa test returns "675.0" as string
  const rawAmt = decoded.total_amount || decoded.amount || 0;
  const amount = parseFloat(String(rawAmt).replace(/[^0-9.]/g, "")) || 0;

  console.log("Resolved paymentId:", resolvedPaymentId, "| amount:", amount);

  // STEP 5: DB helpers — split into two queries so missing columns never crash the INSERT

  // Updates only status + paid_date (guaranteed to exist), then gateway + txn_id separately
  const doUpdate = (rowId) => {
    db.query(
      `UPDATE payments SET status='paid', paid_date=CURDATE() WHERE id=?`,
      [rowId],
      (err, r) => {
        if (err) {
          console.log("UPDATE failed:", err.message);
          return res.status(500).json({ message: "DB update failed: " + err.message });
        }
        console.log("UPDATE OK → affectedRows:", r.affectedRows, "| rowId:", rowId);
        // Non-fatal: set gateway + transaction_id if those columns exist
        db.query(
          `UPDATE payments SET gateway='esewa', transaction_id=? WHERE id=?`,
          [txnUuid, rowId],
          (err2) => { if (err2) console.log("gateway/txnId update (non-fatal):", err2.message); }
        );
        return res.json({ message: "eSewa payment verified!", verified: true, transactionId: txnUuid });
      }
    );
  };

  // Inserts with only the 4 guaranteed core columns, then adds extras separately
  const doInsert = (uid) => {
    db.query(
      `INSERT INTO payments (user_id, amount, status, due_date) VALUES (?, ?, 'paid', CURDATE())`,
      [uid, amount],
      (err, r) => {
        if (err) {
          console.log("INSERT failed:", err.message);
          // Still return verified:true — money was taken, don't confuse citizen
          return res.json({ message: "eSewa verified! (DB record pending)", verified: true, transactionId: txnUuid });
        }
        const newId = r.insertId;
        console.log("INSERT OK → new row id:", newId);
        // Non-fatal extras
        db.query(
          `UPDATE payments SET gateway='esewa', transaction_id=?, description='Monthly waste fee (eSewa)', paid_date=CURDATE() WHERE id=?`,
          [txnUuid, newId],
          (err2) => { if (err2) console.log("extras update (non-fatal):", err2.message); }
        );
        return res.json({ message: "eSewa payment verified!", verified: true, transactionId: txnUuid, paymentId: newId });
      }
    );
  };

  // STEP 6: Pick the right DB path
  if (resolvedPaymentId) {
    console.log("DB path → UPDATE row id:", resolvedPaymentId);
    doUpdate(resolvedPaymentId);

  } else if (userId) {
    db.query(
      `SELECT id FROM payments WHERE user_id=? AND status != 'paid' ORDER BY created_at DESC LIMIT 1`,
      [userId],
      (err, rows) => {
        if (!err && rows.length > 0) {
          console.log("DB path → UPDATE existing row id:", rows[0].id);
          doUpdate(rows[0].id);
        } else {
          console.log("DB path → INSERT new row for userId:", userId, "(no pending row found)");
          doInsert(userId);
        }
      }
    );

  } else {
    console.log("eSewa WARNING: no userId AND no paymentId — DB not updated!");
    res.json({ message: "eSewa payment verified!", verified: true, transactionId: txnUuid });
  }
});


/* ── Khalti INITIATE ── */
app.post("/api/payments/khalti/initiate", async (req, res) => {
  const { userId, paymentId, amount, name, email } = req.body;
  try {
    const response = await axios.post(
      "https://a.khalti.com/api/v2/epayment/initiate/",
      {
        return_url:          `http://localhost:5173/payment/success?userId=${userId}${paymentId ? "&paymentId=" + paymentId : ""}`,
        website_url:         "http://localhost:5173",
        amount,
        purchase_order_id:   `ECO-${userId}-${Date.now()}`,
        purchase_order_name: "EcoConnect Monthly Waste Fee",
        customer_info: { name: name || "EcoConnect User", email: email || "user@ecoconnect.com" },
      },
      { headers: { Authorization: "Key YOUR_KHALTI_TEST_SECRET_KEY", "Content-Type": "application/json" } }
    );
    res.json({ payment_url: response.data.payment_url, pidx: response.data.pidx });
  } catch (err) {
    console.log("Khalti initiate error:", err.response?.data || err.message);
    res.status(500).json({ message: "Khalti initiation failed", error: err.response?.data });
  }
});


/* ── Khalti VERIFY ── */
app.post("/api/payments/khalti/verify", async (req, res) => {
  const { pidx, paymentId, userId } = req.body;
  try {
    const response = await axios.post(
      "https://a.khalti.com/api/v2/epayment/lookup/",
      { pidx },
      { headers: { Authorization: "Key YOUR_KHALTI_TEST_SECRET_KEY", "Content-Type": "application/json" } }
    );
    console.log("Khalti lookup:", response.data);

    if (response.data?.status === "Completed") {
      const resolvedPaymentId = (paymentId && paymentId !== "null") ? paymentId : null;

      const doUpdate = (rowId) => {
        db.query(`UPDATE payments SET status='paid', paid_date=CURDATE() WHERE id=?`, [rowId], (err, r) => {
          if (err) return res.status(500).json({ message: "DB update failed" });
          db.query(`UPDATE payments SET gateway='khalti', transaction_id=? WHERE id=?`, [pidx, rowId], () => {});
          res.json({ message: "Khalti payment verified!", verified: true, transactionId: pidx });
        });
      };

      const doInsert = (uid) => {
        const amtRs = response.data.total_amount ? (response.data.total_amount / 100).toFixed(2) : 0;
        db.query(`INSERT INTO payments (user_id, amount, status, due_date) VALUES (?, ?, 'paid', CURDATE())`, [uid, amtRs], (err, r) => {
          if (err) return res.json({ message: "Khalti verified!", verified: true, transactionId: pidx });
          db.query(`UPDATE payments SET gateway='khalti', transaction_id=?, description='Monthly waste fee (Khalti)', paid_date=CURDATE() WHERE id=?`, [pidx, r.insertId], () => {});
          res.json({ message: "Khalti payment verified!", verified: true, transactionId: pidx, paymentId: r.insertId });
        });
      };

      if (resolvedPaymentId) {
        doUpdate(resolvedPaymentId);
      } else if (userId) {
        db.query(`SELECT id FROM payments WHERE user_id=? AND status!='paid' ORDER BY created_at DESC LIMIT 1`, [userId], (err, rows) => {
          if (!err && rows.length > 0) doUpdate(rows[0].id);
          else doInsert(userId);
        });
      } else {
        res.json({ message: "Khalti payment verified!", verified: true, transactionId: pidx });
      }

    } else {
      res.status(400).json({ message: "Khalti not completed: " + (response.data?.status || "unknown"), verified: false });
    }
  } catch (err) {
    console.log("Khalti verify error:", err.response?.data || err.message);
    res.status(500).json({ message: "Khalti verification error: " + (err.response?.data?.detail || err.message) });
  }
});


/* ── Mark payment paid manually (QR/admin) ── */
app.post("/api/payments/mark-paid", (req, res) => {
  const { paymentId, gateway, transaction_id } = req.body;
  db.query(
    `UPDATE payments SET status='paid', paid_date=CURDATE(), gateway=?, transaction_id=? WHERE id=?`,
    [gateway || "manual", transaction_id || null, paymentId],
    (err) => {
      if (err) { console.log(err); return res.status(500).json({ message: "Payment update failed" }); }
      res.json({ message: "Payment marked as paid!" });
    }
  );
});


/* ── Delete a paid payment record ── */
app.delete("/api/payments/:id", (req, res) => {
  db.query("DELETE FROM payments WHERE id = ? AND status = 'paid'", [req.params.id], (err, result) => {
    if (err) { console.error(err); return res.status(500).json({ message: "Failed to delete payment record" }); }
    if (result.affectedRows === 0) return res.status(404).json({ message: "Record not found or cannot delete unpaid records" });
    res.json({ message: "Payment record deleted successfully" });
  });
});


/* ══════════════════════════════════════════════
   DEBUG — open in browser to inspect DB
   http://localhost:5001/api/debug/payments/YOUR_USER_ID
   ══════════════════════════════════════════════ */
app.get("/api/debug/payments/:userId", (req, res) => {
  db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payments' ORDER BY ORDINAL_POSITION`,
    (err, cols) => {
      db.query(`SELECT * FROM payments WHERE user_id=? ORDER BY id DESC`, [req.params.userId], (err2, rows) => {
        res.json({
          columns:    err  ? "error" : cols.map(c => c.COLUMN_NAME),
          rows:       err2 ? "error: " + err2.message : rows,
          row_count:  rows?.length || 0,
        });
      });
    }
  );
});


/* ══════════════════════════════════════════════
   TEST ROUTE
   ══════════════════════════════════════════════ */
app.get("/test", (req, res) => res.json({ message: "Backend is working!" }));


app.listen(5001, () => console.log("Server running on port 5001"));


/* ══════════════════════════════════════════════════════════
   COMPLAINTS ROUTES
   ══════════════════════════════════════════════════════════ */
app.get("/api/complaints/:userId", (req, res) => {
  db.query(`SELECT * FROM complaints WHERE user_id = ? ORDER BY created_at DESC`, [req.params.userId], (err, results) => {
    if (err) { console.error(err); return res.status(500).json({ message: "Failed to fetch complaints" }); }
    res.json(results);
  });
});

app.post("/api/complaints", (req, res) => {
  const { userId, title, description } = req.body;
  if (!userId || !title || !description) return res.status(400).json({ message: "userId, title and description are required" });
  db.query(`INSERT INTO complaints (user_id, title, description, status, created_at) VALUES (?, ?, ?, 'pending', NOW())`, [userId, title, description], (err, result) => {
    if (err) { console.error(err); return res.status(500).json({ message: "Failed to submit complaint" }); }
    res.json({ id: result.insertId, message: "Complaint submitted successfully" });
  });
});

app.delete("/api/complaints/all/:userId", (req, res) => {
  db.query("DELETE FROM complaints WHERE user_id = ?", [req.params.userId], (err, result) => {
    if (err) { console.error(err); return res.status(500).json({ message: "Failed to delete complaints" }); }
    res.json({ message: "All complaints deleted", deleted: result.affectedRows });
  });
});

app.delete("/api/complaints/:id", (req, res) => {
  db.query("DELETE FROM complaints WHERE id = ?", [req.params.id], (err, result) => {
    if (err) { console.error(err); return res.status(500).json({ message: "Failed to delete complaint" }); }
    if (result.affectedRows === 0) return res.status(404).json({ message: "Complaint not found" });
    res.json({ message: "Complaint deleted successfully" });
  });
});

app.put("/api/complaints/:id/status", (req, res) => {
  const { status } = req.body;
  if (!['pending', 'completed', 'resolved'].includes(status)) return res.status(400).json({ message: "Invalid status" });
  db.query("UPDATE complaints SET status = ? WHERE id = ?", [status, req.params.id], (err) => {
    if (err) return res.status(500).json({ message: "Failed to update status" });
    res.json({ message: "Status updated successfully" });
  });
});


/* ══════════════════════════════════════════════════════════
   REQUESTS DELETE ROUTES
   ══════════════════════════════════════════════════════════ */
app.delete("/api/requests/all/:userId", (req, res) => {
  db.query("DELETE FROM requests WHERE user_id = ?", [req.params.userId], (err, result) => {
    if (err) { console.error(err); return res.status(500).json({ message: "Failed to delete requests" }); }
    res.json({ message: "All requests deleted", deleted: result.affectedRows });
  });
});

app.delete("/api/requests/:id", (req, res) => {
  db.query("DELETE FROM requests WHERE id = ?", [req.params.id], (err, result) => {
    if (err) { console.error(err); return res.status(500).json({ message: "Failed to delete request" }); }
    if (result.affectedRows === 0) return res.status(404).json({ message: "Request not found" });
    res.json({ message: "Request deleted successfully" });
  });
});


/* ══════════════════════════════════════════════
   SCHEDULES ROUTES
   ══════════════════════════════════════════════ */
app.get("/schedules", (req, res) => {
  db.query("SELECT * FROM schedules ORDER BY collection_date ASC", (err, results) => {
    if (err) { console.error(err); return res.status(500).json({ message: "Failed to fetch schedules" }); }
    res.json(Array.isArray(results) ? results : []);
  });
});

app.get("/schedules/staff/:staffId", (req, res) => {
  db.query("SELECT * FROM schedules WHERE staff_id = ? ORDER BY collection_date ASC", [req.params.staffId], (err, results) => {
    if (err) { console.error(err); return res.status(500).json({ message: "Failed to fetch schedules" }); }
    res.json(Array.isArray(results) ? results : []);
  });
});

app.put("/schedules/:id", (req, res) => {
  const { status } = req.body;
  if (!["pending", "in_progress", "completed"].includes(status)) return res.status(400).json({ message: "Invalid status" });
  db.query("UPDATE schedules SET status = ? WHERE id = ?", [status, req.params.id], (err, result) => {
    if (err) { console.error(err); return res.status(500).json({ message: "Failed to update schedule" }); }
    if (result.affectedRows === 0) return res.status(404).json({ message: "Schedule not found" });
    res.json({ message: "Schedule updated successfully" });
  });
});

app.post("/schedules", (req, res) => {
  const { staff_id, area, collection_date } = req.body;
  if (!area || !collection_date) return res.status(400).json({ message: "area and collection_date are required" });
  db.query("INSERT INTO schedules (staff_id, area, collection_date, status) VALUES (?, ?, ?, 'pending')", [staff_id || null, area, collection_date], (err, result) => {
    if (err) { console.error(err); return res.status(500).json({ message: "Failed to create schedule" }); }
    res.json({ id: result.insertId, message: "Schedule created successfully" });
  });
});


/* ══════════════════════════════════════════════
   FINES ROUTES
   ══════════════════════════════════════════════ */
app.get("/api/fines/summary/:userId", (req, res) => {
  db.query(
    `SELECT COUNT(*) as total_fines,
     SUM(CASE WHEN status='unpaid' THEN amount ELSE 0 END) as total_unpaid,
     COUNT(CASE WHEN status='unpaid' THEN 1 END) as unpaid_count
     FROM fines WHERE user_id = ?`,
    [req.params.userId],
    (err, results) => {
      if (err) { console.error(err); return res.status(500).json({ message: "Failed to fetch summary" }); }
      res.json(results[0] || { total_fines: 0, total_unpaid: 0, unpaid_count: 0 });
    }
  );
});

app.get("/api/fines/:userId", (req, res) => {
  db.query(`SELECT * FROM fines WHERE user_id = ? ORDER BY status ASC, due_date ASC`, [req.params.userId], (err, results) => {
    if (err) { console.error(err); return res.status(500).json({ message: "Failed to fetch fines" }); }
    res.json(Array.isArray(results) ? results : []);
  });
});

app.post("/api/fines", (req, res) => {
  const { user_id, amount, reason, due_date, issued_by } = req.body;
  if (!user_id || !amount || !reason) return res.status(400).json({ message: "user_id, amount and reason are required" });
  db.query(
    `INSERT INTO fines (user_id, amount, reason, status, due_date, issued_by) VALUES (?, ?, ?, 'unpaid', ?, ?)`,
    [user_id, amount, reason, due_date || null, issued_by || "Admin"],
    (err, result) => {
      if (err) { console.error(err); return res.status(500).json({ message: "Failed to issue fine" }); }
      res.json({ id: result.insertId, message: "Fine issued successfully" });
    }
  );
});

app.put("/api/fines/:id/pay", (req, res) => {
  db.query(`UPDATE fines SET status='paid', paid_date=CURDATE() WHERE id=?`, [req.params.id], (err, result) => {
    if (err) { console.error(err); return res.status(500).json({ message: "Failed to update fine" }); }
    if (result.affectedRows === 0) return res.status(404).json({ message: "Fine not found" });
    res.json({ message: "Fine marked as paid successfully" });
  });
});

app.delete("/api/fines/:id", (req, res) => {
  db.query("DELETE FROM fines WHERE id = ?", [req.params.id], (err, result) => {
    if (err) { console.error(err); return res.status(500).json({ message: "Failed to delete fine" }); }
    if (result.affectedRows === 0) return res.status(404).json({ message: "Fine not found" });
    res.json({ message: "Fine deleted successfully" });
  });
});

app.get("/api/fines", (req, res) => {
  db.query(
    `SELECT f.*, u.name as citizen_name, u.email as citizen_email FROM fines f JOIN users u ON f.user_id=u.id ORDER BY f.created_at DESC`,
    (err, results) => {
      if (err) { console.error(err); return res.status(500).json({ message: "Failed to fetch fines" }); }
      res.json(Array.isArray(results) ? results : []);
    }
  );
});
