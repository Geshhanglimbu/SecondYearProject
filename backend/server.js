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
import crypto   from "crypto"; // ✅ FIXED: was missing! needed for eSewa signature

// Auto-create uploads folder if missing
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
  console.log("uploads folder created");
}

const app = express();

// Allow frontend (React on port 5173) to talk to backend (port 5001)
app.use(cors({
  origin: "http://localhost:5173",
  methods: "GET,POST,PUT,DELETE",
  credentials: true
}));

app.use(express.json());
app.use("/uploads", express.static("uploads"));

// MySQL database connection
const db = mysql.createConnection({
  host: "127.0.0.1",
  port: 3306,
  user: "root",
  password: "1234",
  database: "gms"
});
db.connect((err) => {
  if (err) throw err;
  console.log("MySQL Connected");
});

// Auto-create assignments table if missing
const createAssignmentsTableSql = `
  CREATE TABLE IF NOT EXISTS assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_type ENUM('request', 'complaint') NOT NULL,
    task_id INT NOT NULL,
    worker_id VARCHAR(50) NOT NULL,
    worker_name VARCHAR(255) NOT NULL,
    assigned_by INT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_task_assignment (task_type, task_id)
  )
`;

db.query(createAssignmentsTableSql, (err) => {
  if (err) {
    console.error("Failed to ensure assignments table exists:", err);
  } else {
    console.log("assignments table ready");
  }
});

// File upload settings (saves to /uploads folder)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename:    (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
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
              points:       totalRequests * 100,
              recycledKg:   totalRequests * 10,
              treesPlanted: Math.floor(totalRequests / 2),
              wasteReduced: Math.min(totalRequests * 5, 100),
            },
            recentRequests,
            recentComplaints,
            latestPayment: paymentResults[0] || null,   // null = no unpaid bills
            pendingCount:  countResults[0]?.count || 0, // number for sidebar badge
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
  const { amount, userId } = req.body;

  // Unique transaction ID: ECO-5-1709234567890
  const txnId = `ECO-${userId}-${Date.now()}`;

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
  const baseAmount  = parseFloat((parsedAmount / 1.125).toFixed(2));  // 600.00
  const taxAmount   = parseFloat((parsedAmount - baseAmount).toFixed(2)); // 75.00
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
    amount:                  baseAmount,   // 600.00
    tax_amount:              taxAmount,    // 75.00
    total_amount:            totalAmount,  // 675.00
    transaction_uuid:        txnId,
    product_code:            "EPAYTEST",
    signature:               signature,
    signed_field_names:      "total_amount,transaction_uuid,product_code",
    success_url:             "http://localhost:5173/payment/success",
    failure_url:             "http://localhost:5173/payment/failed",
    product_service_charge:  "0",
    product_delivery_charge: "0",
  });
});


/* ──────────────────────────────────────────────
   PAYMENT ROUTE 3: ESEWA VERIFY
   URL: POST /api/payments/esewa/verify
   Called by: PaymentSuccess.jsx after eSewa redirects back
   ────────────────────────────────────────────── */
app.post("/api/payments/esewa/verify", async (req, res) => {
  const { data, paymentId } = req.body;

  try {
    // eSewa sends back a base64 encoded string — decode it to read the result
    const decoded = JSON.parse(Buffer.from(data, "base64").toString("utf-8"));
    console.log("eSewa decoded response:", decoded);

    if (decoded.status === "COMPLETE") {
      const sql = `
        UPDATE payments 
        SET status = 'paid', paid_date = CURDATE(), gateway = 'esewa', transaction_id = ? 
        WHERE id = ?
      `;
      db.query(sql, [decoded.transaction_uuid, paymentId], (err) => {
        if (err) { console.log(err); return res.status(500).json({ message: "DB update failed" }); }
        res.json({ message: "eSewa payment verified!", verified: true });
      });
    } else {
      res.status(400).json({ message: "eSewa payment not completed", verified: false });
    }
  } catch (err) {
    console.log("eSewa verify error:", err.message);
    res.status(500).json({ message: "Verification error" });
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
        return_url:            "http://localhost:5173/payment/success",
        website_url:           "http://localhost:5173",
        amount:                amount,  // in paisa! Rs.675 = 67500 paisa
        purchase_order_id:     `ECO-${userId}-${Date.now()}`,
        purchase_order_name:   "EcoConnect Monthly Waste Fee",
        customer_info: {
          name:  name  || "EcoConnect User",
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
      pidx:        response.data.pidx,
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
  const { pidx, paymentId } = req.body;

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

    if (response.data?.status === "Completed") {
      const sql = `
        UPDATE payments 
        SET status = 'paid', paid_date = CURDATE(), gateway = 'khalti', transaction_id = ? 
        WHERE id = ?
      `;
      db.query(sql, [pidx, paymentId], (err) => {
        if (err) { console.log(err); return res.status(500).json({ message: "DB update failed" }); }
        res.json({ message: "Khalti payment verified!", verified: true });
      });
    } else {
      res.status(400).json({ message: "Khalti payment not completed", verified: false });
    }
  } catch (err) {
    console.log("Khalti verify error:", err.response?.data || err.message);
    res.status(500).json({ message: "Khalti verification error" });
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

/* ══════════════════════════════════════════════
   ADMIN READ ROUTES
   ══════════════════════════════════════════════ */
app.get("/api/admin/complaints", (req, res) => {
  const sql = "SELECT * FROM complaints ORDER BY created_at DESC";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Failed to fetch admin complaints:", err);
      return res.status(500).json({ message: "Failed to fetch complaints" });
    }
    res.json(results);
  });
});

app.get("/api/admin/requests", (req, res) => {
  const sql = "SELECT * FROM requests ORDER BY created_at DESC";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Failed to fetch admin requests:", err);
      return res.status(500).json({ message: "Failed to fetch requests" });
    }
    res.json(results);
  });
});

app.get("/api/admin/stats", (req, res) => {
  const sql = `
    SELECT
      (SELECT COUNT(*) FROM users) AS totalUsers,
      (SELECT COUNT(*) FROM requests) AS totalRequests,
      (SELECT COUNT(*) FROM complaints) AS totalComplaints,
      (SELECT COUNT(*) FROM payments) AS totalPayments
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Failed to fetch admin stats:", err);
      return res.status(500).json({ message: "Failed to fetch stats" });
    }

    res.json(results[0]);
  });
});




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
  const valid = ["pending", "in_progress", "resolved", "rejected", "completed"];

  if (!valid.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  db.query("UPDATE complaints SET status = ? WHERE id = ?", [status, id], (err, result) => {
    if (err) {
      console.error("Failed to update complaint status:", err);
      return res.status(500).json({ message: "Failed to update status" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Complaint not found" });
    }

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

/* PUT update request status (for admin) */
app.put("/api/requests/:id/status", (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  const valid = ["pending", "approved", "in_progress", "completed", "rejected"];

  if (!valid.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  db.query("UPDATE requests SET status = ? WHERE id = ?", [status, id], (err, result) => {
    if (err) {
      console.error("Failed to update request status:", err);
      return res.status(500).json({ message: "Failed to update request status" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Request not found" });
    }

    res.json({ message: "Request status updated successfully" });
  });
});

/* ══════════════════════════════════════════════════════════
   ASSIGNMENT ROUTES
   These connect admin assignment to worker tasks
   ══════════════════════════════════════════════════════════ */

/* POST assign a worker to a request */
app.post("/api/requests/:id/assign", (req, res) => {
  const requestId = req.params.id;
  const { workerId, workerName, assignedBy } = req.body;

  if (!workerId || !workerName) {
    return res.status(400).json({ message: "workerId and workerName are required" });
  }

  const checkSql = "SELECT id FROM requests WHERE id = ?";
  db.query(checkSql, [requestId], (checkErr, checkResults) => {
    if (checkErr) {
      console.error("Failed to verify request before assignment:", checkErr);
      return res.status(500).json({ message: "Failed to assign worker" });
    }

    if (checkResults.length === 0) {
      return res.status(404).json({ message: "Request not found" });
    }

    const assignSql = `
      INSERT INTO assignments (task_type, task_id, worker_id, worker_name, assigned_by)
      VALUES ('request', ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        worker_id = VALUES(worker_id),
        worker_name = VALUES(worker_name),
        assigned_by = VALUES(assigned_by),
        updated_at = CURRENT_TIMESTAMP
    `;

    db.query(assignSql, [requestId, workerId, workerName, assignedBy || null], (assignErr) => {
      if (assignErr) {
        console.error("Failed to assign request worker:", assignErr);
        return res.status(500).json({ message: "Failed to assign worker" });
      }

      const updateStatusSql = `
        UPDATE requests
        SET status = CASE WHEN status = 'pending' THEN 'approved' ELSE status END
        WHERE id = ?
      `;

      db.query(updateStatusSql, [requestId], (statusErr) => {
        if (statusErr) {
          console.error("Assigned worker but failed to adjust request status:", statusErr);
        }

        res.json({ message: "Worker assigned to request successfully" });
      });
    });
  });
});

/* POST assign a worker to a complaint */
app.post("/api/complaints/:id/assign", (req, res) => {
  const complaintId = req.params.id;
  const { workerId, workerName, assignedBy } = req.body;

  if (!workerId || !workerName) {
    return res.status(400).json({ message: "workerId and workerName are required" });
  }

  const checkSql = "SELECT id FROM complaints WHERE id = ?";
  db.query(checkSql, [complaintId], (checkErr, checkResults) => {
    if (checkErr) {
      console.error("Failed to verify complaint before assignment:", checkErr);
      return res.status(500).json({ message: "Failed to assign worker" });
    }

    if (checkResults.length === 0) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const assignSql = `
      INSERT INTO assignments (task_type, task_id, worker_id, worker_name, assigned_by)
      VALUES ('complaint', ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        worker_id = VALUES(worker_id),
        worker_name = VALUES(worker_name),
        assigned_by = VALUES(assigned_by),
        updated_at = CURRENT_TIMESTAMP
    `;

    db.query(assignSql, [complaintId, workerId, workerName, assignedBy || null], (assignErr) => {
      if (assignErr) {
        console.error("Failed to assign complaint worker:", assignErr);
        return res.status(500).json({ message: "Failed to assign worker" });
      }

      const updateStatusSql = `
        UPDATE complaints
        SET status = CASE WHEN status = 'pending' THEN 'in_progress' ELSE status END
        WHERE id = ?
      `;

      db.query(updateStatusSql, [complaintId], (statusErr) => {
        if (statusErr) {
          console.error("Assigned worker but failed to adjust complaint status:", statusErr);
        }

        res.json({ message: "Worker assigned to complaint successfully" });
      });
    });
  });
});

/* GET all assigned tasks for one worker */
app.get("/api/worker/tasks/:workerId", (req, res) => {
  const workerId = req.params.workerId;

  const sql = `
    SELECT
      a.id AS assignment_id,
      a.task_type,
      a.task_id,
      a.worker_id,
      a.worker_name,
      a.assigned_at,
      r.id AS request_id,
      r.user_id AS request_user_id,
      r.type AS request_type,
      r.description AS request_description,
      r.pickup_date,
      r.pickup_time,
      r.image AS request_image,
      r.location AS request_location,
      r.status AS request_status,
      c.id AS complaint_id,
      c.user_id AS complaint_user_id,
      c.title AS complaint_title,
      c.description AS complaint_description,
      c.location AS complaint_location,
      c.status AS complaint_status,
      c.created_at AS complaint_created_at
    FROM assignments a
    LEFT JOIN requests r
      ON a.task_type = 'request' AND a.task_id = r.id
    LEFT JOIN complaints c
      ON a.task_type = 'complaint' AND a.task_id = c.id
    WHERE a.worker_id = ?
    ORDER BY a.assigned_at DESC
  `;

  db.query(sql, [workerId], (err, results) => {
    if (err) {
      console.error("Failed to fetch worker tasks:", err);
      return res.status(500).json({ message: "Failed to fetch worker tasks" });
    }

    const mapped = results.map((row) => {
      if (row.task_type === 'request') {
        return {
          assignmentId: row.assignment_id,
          taskType: 'request',
          taskId: row.request_id,
          workerId: row.worker_id,
          workerName: row.worker_name,
          assignedAt: row.assigned_at,
          userId: row.request_user_id,
          title: row.request_type || `Request #${row.request_id}`,
          description: row.request_description,
          location: row.request_location,
          status: row.request_status,
          pickupDate: row.pickup_date,
          pickupTime: row.pickup_time,
          image: row.request_image,
        };
      }

      return {
        assignmentId: row.assignment_id,
        taskType: 'complaint',
        taskId: row.complaint_id,
        workerId: row.worker_id,
        workerName: row.worker_name,
        assignedAt: row.assigned_at,
        userId: row.complaint_user_id,
        title: row.complaint_title || `Complaint #${row.complaint_id}`,
        description: row.complaint_description,
        location: row.complaint_location,
        status: row.complaint_status,
        createdAt: row.complaint_created_at,
      };
    });

    res.json(mapped);
  });
});

/* GET one worker's request assignments only */
app.get("/api/worker/requests/:workerId", (req, res) => {
  const workerId = req.params.workerId;

  const sql = `
    SELECT
      a.id AS assignment_id,
      a.worker_id,
      a.worker_name,
      a.assigned_at,
      r.*
    FROM assignments a
    INNER JOIN requests r ON a.task_type = 'request' AND a.task_id = r.id
    WHERE a.worker_id = ?
    ORDER BY a.assigned_at DESC
  `;

  db.query(sql, [workerId], (err, results) => {
    if (err) {
      console.error("Failed to fetch worker request assignments:", err);
      return res.status(500).json({ message: "Failed to fetch worker request assignments" });
    }
    res.json(results);
  });
});

/* GET one worker's complaint assignments only */
app.get("/api/worker/complaints/:workerId", (req, res) => {
  const workerId = req.params.workerId;

  const sql = `
    SELECT
      a.id AS assignment_id,
      a.worker_id,
      a.worker_name,
      a.assigned_at,
      c.*
    FROM assignments a
    INNER JOIN complaints c ON a.task_type = 'complaint' AND a.task_id = c.id
    WHERE a.worker_id = ?
    ORDER BY a.assigned_at DESC
  `;

  db.query(sql, [workerId], (err, results) => {
    if (err) {
      console.error("Failed to fetch worker complaint assignments:", err);
      return res.status(500).json({ message: "Failed to fetch worker complaint assignments" });
    }
    res.json(results);
  });
});

// Start server on port 5001
app.listen(5001, () => console.log("Server running on port 5001"));