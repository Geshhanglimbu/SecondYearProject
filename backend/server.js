/*
  Backend Server (Node.js + Express)
  - Handles API requests
  - Connects to MySQL database
  - Stores user registration data
  - Manages image upload using Multer
*/

import express from "express";
import mysql   from "mysql2";
import cors    from "cors";
import bcrypt  from "bcryptjs";
import multer  from "multer";
import path    from "path";
import fs      from "fs";
import axios   from "axios";
import crypto  from "crypto";

// Auto-create uploads folder if missing
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

// ✅ MySQL connection
const db = mysql.createConnection({
  host:     "localhost",
  port:     3307,
  user:     "root",
  password: "@window09",
  database: "garbage_management"
});

db.connect((err) => {
  if (err) {
    console.log("❌ MySQL Connection Error:", err.message);
    throw err;
  }
  console.log("✅ MySQL Connected Successfully");
});

// File upload settings
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename:    (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });


/* ══════════════════════════════════════════════
   REGISTER API
   ══════════════════════════════════════════════ */
app.post("/register", upload.single("image"), async (req, res) => {
  const { role, name, email, phone, address, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const image = req.file ? req.file.filename : null;

  const sql = "INSERT INTO users (role, name, email, phone, address, password, image) VALUES (?, ?, ?, ?, ?, ?, ?)";
  db.query(sql, [role, name, email, phone, address, hashedPassword, image], (err) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY")
        return res.status(400).json({ message: "Email already registered! Please use a different email." });
      console.log(err);
      return res.status(500).json({ message: "Registration failed" });
    }
    res.json({ message: "Registered successfully" });
  });
});


/* ══════════════════════════════════════════════
   LOGIN API
   ══════════════════════════════════════════════ */
app.post("/login", async (req, res) => {
  const { email, password, role } = req.body;
  console.log("🔐 Login attempt:", { email, role });

  const sql = "SELECT * FROM users WHERE email = ? AND role = ?";
  db.query(sql, [email, role], async (err, results) => {
    if (err) {
      console.log("❌ LOGIN SQL ERROR:", err);
      return res.status(500).json({ message: "Server error" });
    }
    console.log("🔍 Query results:", results.length, "user(s) found");
    if (results.length === 0)
      return res.status(400).json({ message: "Invalid email or role" });

    const user  = results[0];
    const match = await bcrypt.compare(password, user.password);
    console.log("🔑 Password match:", match);
    if (!match)
      return res.status(400).json({ message: "Incorrect password" });

    res.json({ message: "Login successful", user });
  });
});


/* ══════════════════════════════════════════════
   CITIZEN DASHBOARD API
   ══════════════════════════════════════════════ */
app.get("/api/citizen/dashboard/:userId", (req, res) => {
  const userId = req.params.userId;

  const requestsQuery      = `SELECT * FROM requests   WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`;
  const complaintsQuery    = `SELECT * FROM complaints WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`;
  const latestPaymentQuery = `
    SELECT * FROM payments WHERE user_id = ? AND status != 'paid'
    ORDER BY CASE WHEN status='overdue' THEN 1 WHEN status='pending' THEN 2 ELSE 3 END, due_date ASC
    LIMIT 1
  `;
  const pendingCountQuery  = `SELECT COUNT(*) as count FROM payments WHERE user_id = ? AND status != 'paid'`;

  db.query(requestsQuery, [userId], (err, recentRequests) => {
    if (err) return res.status(500).json({ message: "Failed to fetch requests" });
    db.query(complaintsQuery, [userId], (err, recentComplaints) => {
      if (err) recentComplaints = [];
      db.query(latestPaymentQuery, [userId], (err, paymentResults) => {
        if (err) paymentResults = [];
        db.query(pendingCountQuery, [userId], (err, countResults) => {
          if (err) countResults = [{ count: 0 }];
          const totalRequests = recentRequests.length;
          res.json({
            stats: {
              points:       totalRequests * 100,
              recycledKg:   totalRequests * 10,
              treesPlanted: Math.floor(totalRequests / 2),
              wasteReduced: Math.min(totalRequests * 5, 100),
            },
            recentRequests,
            recentComplaints,
            latestPayment: paymentResults[0] || null,
            pendingCount:  countResults[0]?.count || 0,
          });
        });
      });
    });
  });
});


/* ══════════════════════════════════════════════
   SUBMIT REQUEST API
   ══════════════════════════════════════════════ */
app.post("/api/submit-request", upload.array("files", 5), (req, res) => {
  const { type, description, pickupDate, pickupTime, userId, location } = req.body;
  if (!userId) return res.status(400).json({ message: "User ID is required" });

  const images = req.files && req.files.length > 0
    ? req.files.map(f => f.filename).join(",")
    : null;

  const sql = "INSERT INTO requests (user_id, type, description, pickup_date, pickup_time, image, location) VALUES (?, ?, ?, ?, ?, ?, ?)";
  db.query(sql, [userId, type, description, pickupDate, pickupTime, images, location || null], (err) => {
    if (err) { console.log(err); return res.status(500).json({ message: "Request submission failed" }); }
    res.status(200).json({ message: "Request submitted successfully!" });
  });
});


/* ══════════════════════════════════════════════
   GET USER REQUESTS API
   ══════════════════════════════════════════════ */
app.get("/api/requests/:userId", (req, res) => {
  const userId = req.params.userId;
  db.query("SELECT * FROM requests WHERE user_id = ? ORDER BY created_at DESC", [userId], (err, results) => {
    if (err) return res.status(500).json({ message: "Failed to fetch requests" });
    res.json(results);
  });
});


/* ══════════════════════════════════════════════
   REQUESTS DELETE ROUTES
   ══════════════════════════════════════════════ */
app.delete("/api/requests/all/:userId", (req, res) => {
  db.query("DELETE FROM requests WHERE user_id = ?", [req.params.userId], (err, result) => {
    if (err) return res.status(500).json({ message: "Failed to delete requests" });
    res.json({ message: "All requests deleted", deleted: result.affectedRows });
  });
});

app.delete("/api/requests/:id", (req, res) => {
  db.query("DELETE FROM requests WHERE id = ?", [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ message: "Failed to delete request" });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Request not found" });
    res.json({ message: "Request deleted successfully" });
  });
});


/* ══════════════════════════════════════════════
   PAYMENT ROUTES
   ══════════════════════════════════════════════ */
app.get("/api/payments/:userId", (req, res) => {
  db.query("SELECT * FROM payments WHERE user_id = ? ORDER BY due_date DESC", [req.params.userId], (err, results) => {
    if (err) return res.status(500).json({ message: "Failed to fetch payments" });
    res.json(results);
  });
});

app.post("/api/payments/esewa/initiate", (req, res) => {
  const { amount, userId } = req.body;
  const txnId       = `ECO-${userId}-${Date.now()}`;
  const parsedAmount = parseFloat(amount);
  const baseAmount  = parseFloat((parsedAmount / 1.125).toFixed(2));
  const taxAmount   = parseFloat((parsedAmount - baseAmount).toFixed(2));
  const totalAmount = parseFloat((baseAmount + taxAmount).toFixed(2));
  const secretKey   = "8gBm/:&EnhH.1/q";
  const message     = `total_amount=${totalAmount},transaction_uuid=${txnId},product_code=EPAYTEST`;
  const signature   = crypto.createHmac("sha256", secretKey).update(message).digest("base64");
  res.json({
    amount: baseAmount, tax_amount: taxAmount, total_amount: totalAmount,
    transaction_uuid: txnId, product_code: "EPAYTEST", signature,
    signed_field_names: "total_amount,transaction_uuid,product_code",
    success_url: "http://localhost:5173/payment/success",
    failure_url: "http://localhost:5173/payment/failed",
    product_service_charge: "0", product_delivery_charge: "0",
  });
});

app.post("/api/payments/esewa/verify", async (req, res) => {
  const { data, paymentId } = req.body;
  try {
    const decoded = JSON.parse(Buffer.from(data, "base64").toString("utf-8"));
    if (decoded.status === "COMPLETE") {
      db.query(
        `UPDATE payments SET status='paid', paid_date=CURDATE(), gateway='esewa', transaction_id=? WHERE id=?`,
        [decoded.transaction_uuid, paymentId],
        (err) => {
          if (err) return res.status(500).json({ message: "DB update failed" });
          res.json({ message: "eSewa payment verified!", verified: true });
        }
      );
    } else {
      res.status(400).json({ message: "eSewa payment not completed", verified: false });
    }
  } catch { res.status(500).json({ message: "Verification error" }); }
});

app.post("/api/payments/khalti/initiate", async (req, res) => {
  const { userId, amount, name, email } = req.body;
  try {
    const response = await axios.post(
      "https://a.khalti.com/api/v2/epayment/initiate/",
      {
        return_url:          "http://localhost:5173/payment/success",
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
    res.status(500).json({ message: "Khalti initiation failed", error: err.response?.data });
  }
});

app.post("/api/payments/khalti/verify", async (req, res) => {
  const { pidx, paymentId } = req.body;
  try {
    const response = await axios.post(
      "https://a.khalti.com/api/v2/epayment/lookup/",
      { pidx },
      { headers: { Authorization: "Key YOUR_KHALTI_TEST_SECRET_KEY", "Content-Type": "application/json" } }
    );
    if (response.data?.status === "Completed") {
      db.query(
        `UPDATE payments SET status='paid', paid_date=CURDATE(), gateway='khalti', transaction_id=? WHERE id=?`,
        [pidx, paymentId],
        (err) => {
          if (err) return res.status(500).json({ message: "DB update failed" });
          res.json({ message: "Khalti payment verified!", verified: true });
        }
      );
    } else {
      res.status(400).json({ message: "Khalti payment not completed", verified: false });
    }
  } catch (err) {
    res.status(500).json({ message: "Khalti verification error" });
  }
});

app.post("/api/payments/mark-paid", (req, res) => {
  const { paymentId, gateway, transaction_id } = req.body;
  db.query(
    `UPDATE payments SET status='paid', paid_date=CURDATE(), gateway=?, transaction_id=? WHERE id=?`,
    [gateway || "manual", transaction_id || null, paymentId],
    (err) => {
      if (err) return res.status(500).json({ message: "Payment update failed" });
      res.json({ message: "Payment marked as paid!" });
    }
  );
});


/* ══════════════════════════════════════════════
   COMPLAINTS ROUTES
   ══════════════════════════════════════════════ */
app.get("/api/complaints/:userId", (req, res) => {
  db.query("SELECT * FROM complaints WHERE user_id = ? ORDER BY created_at DESC", [req.params.userId], (err, results) => {
    if (err) return res.status(500).json({ message: "Failed to fetch complaints" });
    res.json(results);
  });
});

app.post("/api/complaints", (req, res) => {
  const { userId, title, description } = req.body;
  if (!userId || !title || !description)
    return res.status(400).json({ message: "userId, title and description are required" });
  db.query(
    "INSERT INTO complaints (user_id, title, description, status, created_at) VALUES (?, ?, ?, 'pending', NOW())",
    [userId, title, description],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Failed to submit complaint" });
      res.json({ id: result.insertId, message: "Complaint submitted successfully" });
    }
  );
});

app.delete("/api/complaints/all/:userId", (req, res) => {
  db.query("DELETE FROM complaints WHERE user_id = ?", [req.params.userId], (err, result) => {
    if (err) return res.status(500).json({ message: "Failed to delete complaints" });
    res.json({ message: "All complaints deleted", deleted: result.affectedRows });
  });
});

app.delete("/api/complaints/:id", (req, res) => {
  db.query("DELETE FROM complaints WHERE id = ?", [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ message: "Failed to delete complaint" });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Complaint not found" });
    res.json({ message: "Complaint deleted successfully" });
  });
});

app.put("/api/complaints/:id/status", (req, res) => {
  const { status } = req.body;
  const valid = ["pending", "completed", "resolved"];
  if (!valid.includes(status)) return res.status(400).json({ message: "Invalid status" });
  db.query("UPDATE complaints SET status = ? WHERE id = ?", [status, req.params.id], (err) => {
    if (err) return res.status(500).json({ message: "Failed to update status" });
    res.json({ message: "Status updated successfully" });
  });
});


/* ══════════════════════════════════════════════
   ADMIN ROUTES
   ══════════════════════════════════════════════ */

/* GET all requests for admin */
app.get("/api/admin/requests", (req, res) => {
  const sql = `
    SELECT r.*, u.name as citizen_name 
    FROM requests r 
    LEFT JOIN users u ON r.user_id = u.id 
    ORDER BY r.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) { console.log("❌ Admin requests error:", err); return res.status(500).json({ message: "Failed to fetch requests" }); }
    res.json(results);
  });
});

/* PUT update request status — when accepted, auto-add to schedules for staff */
app.put("/api/admin/requests/:id/status", (req, res) => {
  const { status } = req.body;
  const id = req.params.id;

  db.query("UPDATE requests SET status = ? WHERE id = ?", [status, id], (err) => {
    if (err) return res.status(500).json({ message: "Failed to update status" });

    if (status === "accepted") {
      const getReq = `
        SELECT r.*, u.name as citizen_name 
        FROM requests r 
        LEFT JOIN users u ON r.user_id = u.id 
        WHERE r.id = ?
      `;
      db.query(getReq, [id], (err, results) => {
        if (err || results.length === 0) return res.json({ message: "Status updated successfully" });

        const r = results[0];
        db.query("SELECT id FROM schedules WHERE request_id = ?", [id], (err, existing) => {
          if (err || (existing && existing.length > 0))
            return res.json({ message: "Status updated successfully" });

          const insertSql = `INSERT INTO schedules (request_id, area, collection_date, status) VALUES (?, ?, ?, 'pending')`;
          const area = r.location || "General Area";
          const date = r.pickup_date || new Date().toISOString().split("T")[0];

          db.query(insertSql, [id, area, date], (err) => {
            if (err) console.log("⚠️ Schedule insert error:", err.message);
            else console.log(`✅ Schedule created for request #${id}`);
          });

          res.json({ message: "Status updated successfully" });
        });
      });
    } else {
      res.json({ message: "Status updated successfully" });
    }
  });
});

/* GET all citizens for admin */
app.get("/api/admin/citizens", (req, res) => {
  db.query(
    "SELECT id, name, email, image, created_at FROM users WHERE role = 'citizen' ORDER BY created_at DESC",
    (err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch citizens" });
      res.json(results);
    }
  );
});


/* ══════════════════════════════════════════════
   STAFF ROUTES
   ══════════════════════════════════════════════ */

/* GET all schedules for staff */
app.get("/schedules", (req, res) => {
  const sql = `
    SELECT 
      s.id, s.area, s.collection_date, s.status, s.request_id,
      r.type, r.description, r.location, r.pickup_time,
      u.name as citizen_name
    FROM schedules s
    LEFT JOIN requests r ON s.request_id = r.id
    LEFT JOIN users    u ON r.user_id = u.id
    ORDER BY s.collection_date DESC
  `;
  db.query(sql, (err, results) => {
    if (err) { console.log("❌ Schedules error:", err); return res.status(500).json({ message: "Failed to fetch schedules" }); }
    res.json(results);
  });
});

/* ✅ PUT update schedule status — when completed, also update requests table with staff name */
app.put("/schedules/:id", (req, res) => {
  const { status, staff_name } = req.body;

  // Step 1: Update schedule status
  db.query("UPDATE schedules SET status = ? WHERE id = ?", [status, req.params.id], (err) => {
    if (err) return res.status(500).json({ message: "Failed to update schedule" });

    // Step 2: If completed → update requests table with completed status + staff name
    if (status === "completed") {
      const sql = `
        UPDATE requests r
        JOIN schedules s ON s.request_id = r.id
        SET r.status = 'completed', r.completed_by = ?
        WHERE s.id = ?
      `;
      db.query(sql, [staff_name || "Staff", req.params.id], (err) => {
        if (err) console.log("⚠️ Request update error:", err.message);
        else console.log(`✅ Request marked completed by ${staff_name}`);
      });
    }

    // Step 3: If reopened → reset request status back to accepted
    if (status === "pending") {
      const sql = `
        UPDATE requests r
        JOIN schedules s ON s.request_id = r.id
        SET r.status = 'accepted', r.completed_by = NULL
        WHERE s.id = ?
      `;
      db.query(sql, [req.params.id], (err) => {
        if (err) console.log("⚠️ Request reopen error:", err.message);
      });
    }

    res.json({ message: "Schedule updated successfully" });
  });
});


/* ══════════════════════════════════════════════
   TEST ROUTE
   ══════════════════════════════════════════════ */
app.get("/test", (req, res) => {
  res.json({ message: "Backend is working!" });
});


// Start server on port 5001
app.listen(5001, () => console.log("🚀 Server running on port 5001"));
