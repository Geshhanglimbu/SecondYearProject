/*
  Backend Server (Node.js + Express)
  - Handles API requests
  - Connects to MySQL database
  - Stores user registration data
  - Manages image upload using Multer
*/

import express from "express";
import mysql from "mysql2";
import cors from "cors";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import axios from "axios";
import crypto from "crypto"; // ✅ FIXED: was missing! needed for eSewa signature

// Auto-create uploads folder if missing
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
  console.log("uploads folder created");
}

const app = express();

// Allow frontend (React) to talk to backend (port 5001)
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174"],
  methods: "GET,POST,PUT,DELETE",
  credentials: true
}));

app.use(express.json());
app.use("/uploads", express.static("uploads"));

// MySQL database connection
const db = mysql.createConnection({
  host: "localhost",
  port: 3307,
  user: "root",
  password: "1234",
  database: "gms"
});

db.connect((err) => {
  if (err) throw err;
  console.log("MySQL Connected");

  // ✅ FIX: Safely add missing columns to payments table.
  // Uses INFORMATION_SCHEMA check instead of "IF NOT EXISTS" (not supported on older MySQL).
  // Each entry: [columnName, columnDefinition]
  const columnsToAdd = [
    ["gateway", "VARCHAR(50) NULL"],
    ["transaction_id", "VARCHAR(255) NULL"],
    ["paid_date", "DATE NULL"],
    ["description", "VARCHAR(255) NULL"],
  ];

  columnsToAdd.forEach(([colName, colDef]) => {
    // First check if the column already exists in INFORMATION_SCHEMA
    db.query(
      `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = ?`,
      [colName],
      (err, rows) => {
        if (err) { console.warn(`Migration check failed for ${colName}:`, err.message); return; }
        if (rows[0].cnt === 0) {
          // Column does not exist — safe to add
          db.query(`ALTER TABLE payments ADD COLUMN ${colName} ${colDef}`, (err2) => {
            if (err2) console.warn(`Migration ADD COLUMN ${colName} failed:`, err2.message);
            else console.log(`Migration: added column '${colName}' to payments table`);
          });
        }
        // Column already exists — do nothing
      }
    );
  });
});

// File upload settings (saves to /uploads folder)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });


/* ══════════════════════════════════════════════
   REGISTER API
   URL: POST /register
   What it does: Creates a new user account
   ══════════════════════════════════════════════ */
app.post("/register", upload.single("image"), async (req, res) => {
  const { role, name, email, phone, address, password } = req.body;

  // Encrypt the password so it's not stored as plain text
  // bcrypt turns "mypassword123" into something like "$2b$10$abc..."
  const hashedPassword = await bcrypt.hash(password, 10);
  const image = req.file ? req.file.filename : null;

  const sql = "INSERT INTO users (role, name, email, phone, address, password, image) VALUES (?, ?, ?, ?, ?, ?, ?)";

  db.query(sql, [role, name, email, phone, address, hashedPassword, image], (err) => {
    if (err) {
      // ER_DUP_ENTRY means someone already registered with that email
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(400).json({ message: "Email already registered! Please use a different email." });
      }
      console.log(err);
      return res.status(500).json({ message: "Registration failed" });
    }
    res.json({ message: "Registered successfully" });
  });
});


/* ══════════════════════════════════════════════
   LOGIN API
   URL: POST /login
   What it does: Checks email + password + role
   ══════════════════════════════════════════════ */
app.post("/login", async (req, res) => {
  const { email, password, role } = req.body;

  const sql = "SELECT * FROM users WHERE email = ? AND role = ?";
  db.query(sql, [email, role], async (err, results) => {
    if (err) {
      console.log("LOGIN SQL ERROR:", err);
      return res.status(500).json({ message: "Server error" });
    }

    if (results.length === 0) {
      return res.status(400).json({ message: "Invalid email or role" });
    }

    const user = results[0];
    // bcrypt.compare checks if the typed password matches the stored hash
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(400).json({ message: "Incorrect password" });
    }

    res.json({ message: "Login successful", user });
  });
});


/* ══════════════════════════════════════════════
   CITIZEN DASHBOARD API
   URL: GET /api/citizen/dashboard/:userId
   
   ✅ FIXED: This is now ONE single dashboard route
   ✅ FIXED: Now includes latestPayment AND pendingCount
   ✅ REMOVED: The old duplicate route that had no payment data
   ══════════════════════════════════════════════ */
app.get("/api/citizen/dashboard/:userId", (req, res) => {
  const userId = req.params.userId;

  // Query 1: Get 5 most recent requests for this user
  const requestsQuery = `
    SELECT * FROM requests 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 5
  `;

  // Query 2: Get 5 most recent complaints
  const complaintsQuery = `
    SELECT * FROM complaints 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 5
  `;

  // Query 3: Get the single most urgent UNPAID bill
  // overdue bills come first (most urgent), then pending
  // status != 'paid' means: only get bills that still need to be paid
  const latestPaymentQuery = `
    SELECT * FROM payments 
    WHERE user_id = ? AND status != 'paid'
    ORDER BY 
      CASE 
        WHEN status = 'overdue' THEN 1 
        WHEN status = 'pending' THEN 2 
        ELSE 3 
      END, 
      due_date ASC
    LIMIT 1
  `;

  // Query 4: Count ALL unpaid bills (for the sidebar badge number)
  // This gives us the total count, not just 1
  const pendingCountQuery = `
    SELECT COUNT(*) as count 
    FROM payments 
    WHERE user_id = ? AND status != 'paid'
  `;

  // Run Query 1 first
  db.query(requestsQuery, [userId], (err, recentRequests) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Failed to fetch requests" });
    }

    // Run Query 2 inside Query 1's result
    db.query(complaintsQuery, [userId], (err, recentComplaints) => {
      if (err) recentComplaints = []; // don't crash if complaints table missing

      // Run Query 3 inside Query 2's result
      db.query(latestPaymentQuery, [userId], (err, paymentResults) => {
        if (err) paymentResults = []; // don't crash if payments table missing

        // Run Query 4 inside Query 3's result
        db.query(pendingCountQuery, [userId], (err, countResults) => {
          if (err) countResults = [{ count: 0 }];

          // Calculate eco stats from number of requests
          const totalRequests = recentRequests.length;

          // Send everything back to frontend in one response
          res.json({
            stats: {
              points: totalRequests * 100,
              recycledKg: totalRequests * 10,
              treesPlanted: Math.floor(totalRequests / 2),
              wasteReduced: Math.min(totalRequests * 5, 100),
            },
            recentRequests,
            recentComplaints,
            latestPayment: paymentResults[0] || null,   // null = no unpaid bills
            pendingCount: countResults[0]?.count || 0, // number for sidebar badge
          });
        });
      });
    });
  });
});


/* ══════════════════════════════════════════════
   SUBMIT REQUEST API
   URL: POST /api/submit-request
   What it does: Saves a new waste pickup request
   ══════════════════════════════════════════════ */
app.post("/api/submit-request", upload.array("files", 5), (req, res) => {
  const { type, description, pickupDate, pickupTime, userId, location } = req.body;

  if (!userId) return res.status(400).json({ message: "User ID is required" });

  // Join multiple image filenames with commas: "img1.jpg,img2.jpg,img3.jpg"
  const images = req.files && req.files.length > 0
    ? req.files.map(f => f.filename).join(",")
    : null;

  const sql = "INSERT INTO requests (user_id, type, description, pickup_date, pickup_time, image, location) VALUES (?, ?, ?, ?, ?, ?, ?)";

  db.query(sql, [userId, type, description, pickupDate, pickupTime, images, location || null], (err) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Request submission failed" });
    }
    res.status(200).json({ message: "Request submitted successfully!" });
  });
});


/* ══════════════════════════════════════════════
   GET USER REQUESTS API
   URL: GET /api/requests/:userId
   What it does: Returns all past requests for a user
   ══════════════════════════════════════════════ */
app.get("/api/requests/:userId", (req, res) => {
  const userId = req.params.userId;
  const sql = "SELECT * FROM requests WHERE user_id = ? ORDER BY created_at DESC";

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Failed to fetch requests" });
    }
    res.json(results);
  });
});


/* ══════════════════════════════════════════════════════════
   PAYMENT ROUTES
   ══════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────
   PAYMENT ROUTE 1: GET ALL PAYMENTS FOR A USER
   URL: GET /api/payments/:userId
   Called by: Payment.jsx when page loads
   ────────────────────────────────────────────── */
app.get("/api/payments/:userId", (req, res) => {
  const userId = req.params.userId;
  const sql = "SELECT * FROM payments WHERE user_id = ? ORDER BY due_date DESC";

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Failed to fetch payments" });
    }
    res.json(results);
  });
});


/* ──────────────────────────────────────────────
   PAYMENT ROUTE 2: ESEWA INITIATE
   URL: POST /api/payments/esewa/initiate
   Called by: Payment.jsx when user clicks "Finalize" with eSewa
   
   WHY: eSewa needs a security signature. We make it here on the
   backend using a secret key so users can't fake it.
   ────────────────────────────────────────────── */
app.post("/api/payments/esewa/initiate", (req, res) => {
  const { amount, userId, paymentId } = req.body;

  // Unique transaction ID includes paymentId so verify route can find the record
  // Format: ECO-userId-paymentId-timestamp
  const txnId = paymentId
    ? `ECO-${userId}-${paymentId}-${Date.now()}`
    : `ECO-${userId}-${Date.now()}`;

  // ─────────────────────────────────────────────────────
  // ✅ FIXED AMOUNT CALCULATION
  //
  // eSewa rule: amount + tax_amount + service_charge + delivery_charge = total_amount
  // If these don't add up EXACTLY, eSewa rejects with ES104!
  //
  // We treat the payment amount as the BASE (before tax):
  //   base    = what user owes before tax (e.g. 600)
  //   tax     = 12.5% of base           (e.g. 75)
  //   total   = base + tax              (e.g. 675)
  //
  // The signature must use this SAME total_amount — never a rounded version.
  // ─────────────────────────────────────────────────────
  const parsedAmount = parseFloat(amount);          // e.g. 675.00 (full amount from DB)

  // We treat the incoming amount AS the total (already includes tax)
  // Split it back: base = total / 1.125
  const baseAmount = parseFloat((parsedAmount / 1.125).toFixed(2));  // 600.00
  const taxAmount = parseFloat((parsedAmount - baseAmount).toFixed(2)); // 75.00
  const totalAmount = parseFloat((baseAmount + taxAmount).toFixed(2));    // 675.00

  // eSewa sandbox secret key — official test key from eSewa docs
  const secretKey = "8gBm/:&EnhH.1/q";

  // Signature message MUST be in this exact format, exact field order
  // Use the CALCULATED totalAmount (not parsedAmount) to avoid floating point issues
  const message = `total_amount=${totalAmount},transaction_uuid=${txnId},product_code=EPAYTEST`;

  console.log("eSewa signature message:", message); // log so you can debug

  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(message)
    .digest("base64");

  console.log("eSewa signature:", signature);

  // ALL these fields go into the hidden form on frontend
  // amount + tax_amount + service_charge + delivery_charge MUST equal total_amount
  res.json({
    amount: baseAmount,   // 600.00
    tax_amount: taxAmount,    // 75.00
    total_amount: totalAmount,  // 675.00
    transaction_uuid: txnId,
    product_code: "EPAYTEST",
    signature: signature,
    signed_field_names: "total_amount,transaction_uuid,product_code",
    success_url: `http://localhost:5174/payment/success?userId=${userId}${paymentId ? "&paymentId=" + paymentId : ""}`,
    failure_url: "http://localhost:5174/payment/failed",
    product_service_charge: "0",
    product_delivery_charge: "0",
  });
});


/* ──────────────────────────────────────────────
   PAYMENT ROUTE 3: ESEWA VERIFY
   URL: POST /api/payments/esewa/verify
   Called by: PaymentSuccess.jsx after eSewa redirects back
   ────────────────────────────────────────────── */
app.post("/api/payments/esewa/verify", async (req, res) => {
  // ✅ FIX: Sanitize paymentId & userId — they can arrive as string "null"/"undefined" from URL params
  const { data } = req.body;
  const paymentId = (req.body.paymentId && req.body.paymentId !== "null" && req.body.paymentId !== "undefined") ? req.body.paymentId : null;
  const userId = (req.body.userId && req.body.userId !== "null" && req.body.userId !== "undefined") ? req.body.userId : null;

  try {
    const decoded = JSON.parse(Buffer.from(data, "base64").toString("utf-8"));

    // ── FULL DEBUG LOG — check your terminal to see exactly what eSewa sent ──
    console.log("=== eSewa DECODED RESPONSE ===");
    console.log(JSON.stringify(decoded, null, 2));
    console.log("status field:", decoded.status, "| userId:", userId, "| paymentId:", paymentId);
    console.log("==============================");

    // ✅ FIX: Case-insensitive status check.
    // eSewa test env can return "COMPLETE", "complete", "Completed", or "success"
    const rawStatus = (decoded.status || "").toUpperCase().trim();
    const isSuccess = ["COMPLETE", "COMPLETED", "SUCCESS"].includes(rawStatus);

    if (!isSuccess) {
      console.log("eSewa: payment NOT successful. Raw status:", decoded.status);
      return res.status(400).json({
        message: `eSewa payment not completed. Gateway returned status: "${decoded.status}"`,
        verified: false
      });
    }

    const txnUuid = decoded.transaction_uuid;

    // ✅ FIX: Extract paymentId from transaction UUID if not passed directly
    // Our format: ECO-{userId}-{paymentId}-{timestamp}
    let resolvedPaymentId = paymentId;
    if (!resolvedPaymentId && txnUuid) {
      const parts = txnUuid.split("-");
      if (parts.length >= 4 && parts[0] === "ECO") {
        resolvedPaymentId = parts[2];
        console.log("eSewa: extracted paymentId from txnUuid:", resolvedPaymentId);
      }
    }

    // ✅ FIX: Parse amount safely — eSewa test returns it as a string like "675.0"
    const rawAmount = decoded.total_amount || decoded.amount || 0;
    const parsedAmount = parseFloat(String(rawAmount).replace(/[^0-9.]/g, "")) || 0;

    // Helper: run a DB query and send response
    const dbWriteRespond = (sql, params, label) => {
      db.query(sql, params, (err, result) => {
        if (err) {
          console.log(`eSewa DB error (${label}):`, err);
          return res.status(500).json({ message: "DB write failed: " + err.message });
        }
        console.log(`eSewa DB ${label} OK — affectedRows:`, result.affectedRows, "| insertId:", result.insertId || "n/a");
        res.json({ message: "eSewa payment verified!", verified: true, transactionId: txnUuid });
      });
    };

    if (resolvedPaymentId) {
      // Best path: directly update the known payment row
      // ✅ FIX: cast to integer so WHERE id=? matches correctly
      const numericPaymentId = parseInt(resolvedPaymentId, 10);
      if (!isNaN(numericPaymentId)) {
        dbWriteRespond(
          `UPDATE payments SET status='paid', paid_date=CURDATE(), gateway='esewa', transaction_id=? WHERE id=?`,
          [txnUuid, numericPaymentId],
          "UPDATE by paymentId"
        );
      } else {
        console.log("eSewa WARNING: resolvedPaymentId is not a valid number:", resolvedPaymentId, "— falling through to userId path");
        // Fall through to userId path below
        handleUserIdPath();
      }
    } else if (userId) {
      handleUserIdPath();
    } else {
      console.log("eSewa WARNING: no userId or paymentId — DB not updated!");
      res.json({ message: "eSewa payment verified!", verified: true, transactionId: txnUuid });
    }

    // Helper: find pending row for userId or insert new paid row
    function handleUserIdPath() {
      if (!userId) {
        console.log("eSewa WARNING: no userId available — DB not updated!");
        res.json({ message: "eSewa payment verified!", verified: true, transactionId: txnUuid });
        return;
      }
      db.query(
        `SELECT id FROM payments WHERE user_id=? AND status != 'paid' ORDER BY created_at DESC LIMIT 1`,
        [userId],
        (err, rows) => {
          if (!err && rows.length > 0) {
            dbWriteRespond(
              `UPDATE payments SET status='paid', paid_date=CURDATE(), gateway='esewa', transaction_id=? WHERE id=?`,
              [txnUuid, rows[0].id],
              "UPDATE by userId"
            );
          } else {
            // No pending row found — INSERT so History is never empty
            console.log("eSewa: no pending row for userId", userId, "— inserting new paid record, amount:", parsedAmount);
            dbWriteRespond(
              `INSERT INTO payments (user_id, amount, status, gateway, transaction_id, paid_date, due_date, description, created_at)
               VALUES (?, ?, 'paid', 'esewa', ?, CURDATE(), CURDATE(), 'Monthly waste fee (eSewa)', NOW())`,
              [userId, parsedAmount, txnUuid],
              "INSERT new paid row"
            );
          }
        }
      );
    }

  } catch (err) {
    console.log("eSewa verify EXCEPTION:", err.message);
    res.status(500).json({ message: "Verification error: " + err.message });
  }
});


/* ──────────────────────────────────────────────
   PAYMENT ROUTE 4: KHALTI INITIATE
   URL: POST /api/payments/khalti/initiate
   Called by: Payment.jsx when user picks Khalti
   
   NOTE: Must come BEFORE /api/payments/:userId
   so Express doesn't think "khalti" is a userId!
   ────────────────────────────────────────────── */
app.post("/api/payments/khalti/initiate", async (req, res) => {
  const { userId, paymentId, amount, name, email } = req.body;

  try {
    const response = await axios.post(
      "https://a.khalti.com/api/v2/epayment/initiate/",
      {
        return_url: `http://localhost:5174/payment/success?userId=${userId}${paymentId ? "&paymentId=" + paymentId : ""}`,
        website_url: "http://localhost:5174",
        amount: amount,  // in paisa! Rs.675 = 67500 paisa
        purchase_order_id: `ECO-${userId}-${Date.now()}`,
        purchase_order_name: "EcoConnect Monthly Waste Fee",
        customer_info: {
          name: name || "EcoConnect User",
          email: email || "user@ecoconnect.com",
        },
      },
      {
        headers: {
          Authorization: "Key YOUR_KHALTI_TEST_SECRET_KEY", // ← replace this
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      payment_url: response.data.payment_url,
      pidx: response.data.pidx,
    });

  } catch (err) {
    console.log("Khalti initiate error:", err.response?.data || err.message);
    res.status(500).json({ message: "Khalti initiation failed", error: err.response?.data });
  }
});


/* ──────────────────────────────────────────────
   PAYMENT ROUTE 5: KHALTI VERIFY
   URL: POST /api/payments/khalti/verify
   Called by: PaymentSuccess.jsx after Khalti redirects back
   ────────────────────────────────────────────── */
app.post("/api/payments/khalti/verify", async (req, res) => {
  const { pidx } = req.body;
  // ✅ FIX: Sanitize — can arrive as string "null"/"undefined" from URL params
  const paymentId = (req.body.paymentId && req.body.paymentId !== "null" && req.body.paymentId !== "undefined") ? req.body.paymentId : null;
  const userId = (req.body.userId && req.body.userId !== "null" && req.body.userId !== "undefined") ? req.body.userId : null;

  try {
    const response = await axios.post(
      "https://a.khalti.com/api/v2/epayment/lookup/",
      { pidx },
      {
        headers: {
          Authorization: "Key YOUR_KHALTI_TEST_SECRET_KEY",
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Khalti lookup response:", response.data);

    if (response.data?.status === "Completed") {
      console.log("Khalti pidx:", pidx, "userId:", userId, "paymentId:", paymentId);

      if (paymentId) {
        const sql = `UPDATE payments SET status='paid', paid_date=CURDATE(), gateway='khalti', transaction_id=? WHERE id=?`;
        db.query(sql, [pidx, paymentId], (err, result) => {
          if (err) { console.log("Khalti DB error:", err); return res.status(500).json({ message: "DB update failed" }); }
          console.log("Khalti updated by paymentId, rows:", result.affectedRows);
          res.json({ message: "Khalti payment verified!", verified: true, transactionId: pidx });
        });

      } else if (userId) {
        // Step 1: Find most recent pending payment for this user
        const findSql = `SELECT id FROM payments WHERE user_id=? AND status != 'paid' ORDER BY created_at DESC LIMIT 1`;
        db.query(findSql, [userId], (err, rows) => {
          if (err || rows.length === 0) {
            // ✅ FIX: No pending row — INSERT a new paid record so it shows in History
            console.log("Khalti: no pending row found for user", userId, "— inserting new paid record");
            const amountRs = response.data.total_amount
              ? (response.data.total_amount / 100).toFixed(2)
              : 0;
            const insertSql = `
              INSERT INTO payments 
                (user_id, amount, status, gateway, transaction_id, paid_date, due_date, description, created_at)
              VALUES (?, ?, 'paid', 'khalti', ?, CURDATE(), CURDATE(), 'Monthly waste fee (Khalti)', NOW())
            `;
            db.query(insertSql, [userId, amountRs, pidx], (err2, result) => {
              if (err2) {
                console.log("Khalti INSERT error:", err2);
                return res.json({ message: "Khalti payment verified!", verified: true, transactionId: pidx });
              }
              console.log("Khalti: inserted new paid payment row, id:", result.insertId);
              res.json({ message: "Khalti payment verified!", verified: true, transactionId: pidx, paymentId: result.insertId });
            });
            return;
          }
          // Step 2: Update that specific payment
          const updateSql = `UPDATE payments SET status='paid', paid_date=CURDATE(), gateway='khalti', transaction_id=? WHERE id=?`;
          db.query(updateSql, [pidx, rows[0].id], (err2, result) => {
            if (err2) { console.log("Khalti DB update error:", err2); return res.status(500).json({ message: "DB update failed" }); }
            console.log("Khalti updated by userId, rows:", result.affectedRows, "payment id:", rows[0].id);
            res.json({ message: "Khalti payment verified!", verified: true, transactionId: pidx, paymentId: rows[0].id });
          });
        });

      } else {
        res.json({ message: "Khalti payment verified!", verified: true, transactionId: pidx });
      }
    } else {
      res.status(400).json({
        message: "Khalti payment not completed. Status: " + (response.data?.status || "unknown"),
        verified: false
      });
    }
  } catch (err) {
    console.log("Khalti verify error:", err.response?.data || err.message);
    res.status(500).json({ message: "Khalti verification error: " + (err.response?.data?.detail || err.message) });
  }
});


/* ──────────────────────────────────────────────
   PAYMENT ROUTE 6: MARK PAYMENT AS PAID MANUALLY
   URL: POST /api/payments/mark-paid
   Used for: QR payments or admin marking paid
   ────────────────────────────────────────────── */
app.post("/api/payments/mark-paid", (req, res) => {
  const { paymentId, gateway, transaction_id } = req.body;

  const sql = `
    UPDATE payments 
    SET status = 'paid', paid_date = CURDATE(), gateway = ?, transaction_id = ? 
    WHERE id = ?
  `;

  db.query(sql, [gateway || "manual", transaction_id || null, paymentId], (err) => {
    if (err) { console.log(err); return res.status(500).json({ message: "Payment update failed" }); }
    res.json({ message: "Payment marked as paid!" });
  });
});


/* ══════════════════════════════════════════════
   TEST ROUTE
   ══════════════════════════════════════════════ */
app.get("/test", (req, res) => {
  res.json({ message: "Backend is working!" });
});


// Start server on port 5001
app.listen(5001, () => console.log("Server running on port 5001"));


/* ══════════════════════════════════════════════════════════
   COMPLAINTS ROUTES
   ══════════════════════════════════════════════════════════ */

/* GET all complaints for a user */
app.get("/api/complaints/:userId", (req, res) => {
  const userId = req.params.userId;
  const sql = `SELECT * FROM complaints WHERE user_id = ? ORDER BY created_at DESC`;
  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error("Failed to fetch complaints:", err);
      return res.status(500).json({ message: "Failed to fetch complaints" });
    }
    res.json(results);
  });
});

/* POST submit a new complaint */
app.post("/api/complaints", (req, res) => {
  const { userId, title, description } = req.body;
  if (!userId || !title || !description) {
    return res.status(400).json({ message: "userId, title and description are required" });
  }
  const sql = `INSERT INTO complaints (user_id, title, description, status, created_at) VALUES (?, ?, ?, 'pending', NOW())`;
  db.query(sql, [userId, title, description], (err, result) => {
    if (err) {
      console.error("Failed to insert complaint:", err);
      return res.status(500).json({ message: "Failed to submit complaint" });
    }
    res.json({ id: result.insertId, message: "Complaint submitted successfully" });
  });
});

/* DELETE all complaints for a user — MUST be before /:id */
app.delete("/api/complaints/all/:userId", (req, res) => {
  const userId = req.params.userId;
  db.query("DELETE FROM complaints WHERE user_id = ?", [userId], (err, result) => {
    if (err) {
      console.error("Failed to delete all complaints:", err);
      return res.status(500).json({ message: "Failed to delete complaints" });
    }
    res.json({ message: "All complaints deleted", deleted: result.affectedRows });
  });
});

/* DELETE a single complaint */
app.delete("/api/complaints/:id", (req, res) => {
  const id = req.params.id;
  db.query("DELETE FROM complaints WHERE id = ?", [id], (err, result) => {
    if (err) {
      console.error("Failed to delete complaint:", err);
      return res.status(500).json({ message: "Failed to delete complaint" });
    }
    if (result.affectedRows === 0) return res.status(404).json({ message: "Complaint not found" });
    res.json({ message: "Complaint deleted successfully" });
  });
});

/* PUT update complaint status (for admin/staff) */
app.put("/api/complaints/:id/status", (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  const valid = ['pending', 'completed', 'resolved'];
  if (!valid.includes(status)) return res.status(400).json({ message: "Invalid status" });
  db.query("UPDATE complaints SET status = ? WHERE id = ?", [status, id], (err) => {
    if (err) return res.status(500).json({ message: "Failed to update status" });
    res.json({ message: "Status updated successfully" });
  });
});


/* ══════════════════════════════════════════════════════════
   REQUESTS DELETE ROUTES
   ══════════════════════════════════════════════════════════ */

/* DELETE all requests for a user — MUST be before /:id */
app.delete("/api/requests/all/:userId", (req, res) => {
  const userId = req.params.userId;
  db.query("DELETE FROM requests WHERE user_id = ?", [userId], (err, result) => {
    if (err) {
      console.error("Failed to delete all requests:", err);
      return res.status(500).json({ message: "Failed to delete requests" });
    }
    res.json({ message: "All requests deleted", deleted: result.affectedRows });
  });
});

/* DELETE a single request by id */
app.delete("/api/requests/:id", (req, res) => {
  const id = req.params.id;
  db.query("DELETE FROM requests WHERE id = ?", [id], (err, result) => {
    if (err) {
      console.error("Failed to delete request:", err);
      return res.status(500).json({ message: "Failed to delete request" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Request not found" });
    }
    res.json({ message: "Request deleted successfully" });
  });
});


/* ══════════════════════════════════════════════
   SCHEDULES ROUTES — for Staff Dashboard
   ══════════════════════════════════════════════ */

/* GET all schedules */
app.get("/schedules", (req, res) => {
  const sql = "SELECT * FROM schedules ORDER BY collection_date ASC";
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Failed to fetch schedules:", err);
      return res.status(500).json({ message: "Failed to fetch schedules" });
    }
    res.json(Array.isArray(results) ? results : []);
  });
});

/* GET schedules for a specific staff member */
app.get("/schedules/staff/:staffId", (req, res) => {
  const staffId = req.params.staffId;
  const sql = "SELECT * FROM schedules WHERE staff_id = ? ORDER BY collection_date ASC";
  db.query(sql, [staffId], (err, results) => {
    if (err) {
      console.error("Failed to fetch staff schedules:", err);
      return res.status(500).json({ message: "Failed to fetch schedules" });
    }
    res.json(Array.isArray(results) ? results : []);
  });
});

/* PUT update schedule status */
app.put("/schedules/:id", (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  const valid = ["pending", "in_progress", "completed"];
  if (!valid.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }
  const sql = "UPDATE schedules SET status = ? WHERE id = ?";
  db.query(sql, [status, id], (err, result) => {
    if (err) {
      console.error("Failed to update schedule:", err);
      return res.status(500).json({ message: "Failed to update schedule" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Schedule not found" });
    }
    res.json({ message: "Schedule updated successfully" });
  });
});

/* POST create new schedule (admin assigns task) */
app.post("/schedules", (req, res) => {
  const { staff_id, area, collection_date } = req.body;
  if (!area || !collection_date) {
    return res.status(400).json({ message: "area and collection_date are required" });
  }
  const sql = "INSERT INTO schedules (staff_id, area, collection_date, status) VALUES (?, ?, ?, 'pending')";
  db.query(sql, [staff_id || null, area, collection_date], (err, result) => {
    if (err) {
      console.error("Failed to create schedule:", err);
      return res.status(500).json({ message: "Failed to create schedule" });
    }
    res.json({ id: result.insertId, message: "Schedule created successfully" });
  });
});


/* ══════════════════════════════════════════════
   FINES ROUTES
   ══════════════════════════════════════════════ */

/* ── GET fine summary for a user — MUST be before /:userId ── */
app.get("/api/fines/summary/:userId", (req, res) => {
  const userId = req.params.userId;
  const sql = `
    SELECT 
      COUNT(*) as total_fines,
      SUM(CASE WHEN status = 'unpaid' THEN amount ELSE 0 END) as total_unpaid,
      COUNT(CASE WHEN status = 'unpaid' THEN 1 END) as unpaid_count
    FROM fines 
    WHERE user_id = ?
  `;
  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error("Failed to fetch fine summary:", err);
      return res.status(500).json({ message: "Failed to fetch summary" });
    }
    res.json(results[0] || { total_fines: 0, total_unpaid: 0, unpaid_count: 0 });
  });
});

/* ── GET all fines for a user ── */
app.get("/api/fines/:userId", (req, res) => {
  const userId = req.params.userId;
  const sql = `
    SELECT * FROM fines 
    WHERE user_id = ? 
    ORDER BY status ASC, due_date ASC
  `;
  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error("Failed to fetch fines:", err);
      return res.status(500).json({ message: "Failed to fetch fines" });
    }
    res.json(Array.isArray(results) ? results : []);
  });
});

/* ── POST issue a new fine (admin only) ── */
app.post("/api/fines", (req, res) => {
  const { user_id, amount, reason, due_date, issued_by } = req.body;

  if (!user_id || !amount || !reason) {
    return res.status(400).json({ message: "user_id, amount and reason are required" });
  }

  const sql = `
    INSERT INTO fines (user_id, amount, reason, status, due_date, issued_by)
    VALUES (?, ?, ?, 'unpaid', ?, ?)
  `;
  db.query(sql, [user_id, amount, reason, due_date || null, issued_by || "Admin"], (err, result) => {
    if (err) {
      console.error("Failed to issue fine:", err);
      return res.status(500).json({ message: "Failed to issue fine" });
    }
    res.json({ id: result.insertId, message: "Fine issued successfully" });
  });
});

/* ── PUT mark a fine as paid ── */
app.put("/api/fines/:id/pay", (req, res) => {
  const id = req.params.id;
  const sql = `
    UPDATE fines 
    SET status = 'paid', paid_date = CURDATE() 
    WHERE id = ?
  `;
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("Failed to mark fine as paid:", err);
      return res.status(500).json({ message: "Failed to update fine" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Fine not found" });
    }
    res.json({ message: "Fine marked as paid successfully" });
  });
});

/* ── DELETE a fine (admin only) ── */
app.delete("/api/fines/:id", (req, res) => {
  const id = req.params.id;
  db.query("DELETE FROM fines WHERE id = ?", [id], (err, result) => {
    if (err) {
      console.error("Failed to delete fine:", err);
      return res.status(500).json({ message: "Failed to delete fine" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Fine not found" });
    }
    res.json({ message: "Fine deleted successfully" });
  });
});

/* ── GET all fines (admin view — all citizens) ── */
app.get("/api/fines", (req, res) => {
  const sql = `
    SELECT f.*, u.name as citizen_name, u.email as citizen_email
    FROM fines f
    JOIN users u ON f.user_id = u.id
    ORDER BY f.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Failed to fetch all fines:", err);
      return res.status(500).json({ message: "Failed to fetch fines" });
    }
    res.json(Array.isArray(results) ? results : []);
  });
});


/* ── DELETE a single payment record by id (citizen deletes paid history) ── */
app.delete("/api/payments/:id", (req, res) => {
  const id = req.params.id;
  /* Only allow deleting PAID records — never delete pending/overdue */
  const sql = "DELETE FROM payments WHERE id = ? AND status = 'paid'";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("Failed to delete payment:", err);
      return res.status(500).json({ message: "Failed to delete payment record" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Record not found or cannot delete unpaid records"
      });
    }
    res.json({ message: "Payment record deleted successfully" });
  });
});
