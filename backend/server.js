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

// Auto-create uploads folder if missing
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
  console.log("uploads folder created");
}

const app = express();

// Allow frontend  to talk to backend (port 5001)
app.use(cors({
  origin: "http://localhost:5173",
  methods: "GET,POST",
  credentials: true
}));

app.use(express.json());
app.use("/uploads", express.static("uploads"));

// MySQL database connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "gms"
});

db.connect((err) => {
  if (err) throw err;
  console.log("MySQL Connected");
});

// File upload settings (saves to /uploads folder)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename:    (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });


  //  REGISTER API
  
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



  //  LOGIN API
  
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


  //  CITIZEN DASHBOARD API

   
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



  //  SUBMIT REQUEST API
   
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



  //  GET USER REQUESTS API
   
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



  //  PAYMENT ROUTE 

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



app.post("/api/payments/esewa/initiate", (req, res) => {
  const { amount, userId } = req.body;

  const txnId = `ECO-${userId}-${Date.now()}`;

  
  const parsedAmount = parseFloat(amount);          // e.g. 675.00 (full amount from DB)

  // We treat the incoming amount AS the total (already includes tax)
  // Split it back: base = total / 1.125
  const baseAmount  = parseFloat((parsedAmount / 1.125).toFixed(2));  // 600.00
  const taxAmount   = parseFloat((parsedAmount - baseAmount).toFixed(2)); // 75.00
  const totalAmount = parseFloat((baseAmount + taxAmount).toFixed(2));    // 675.00

  // eSewa sandbox secret key — official test key from eSewa docs
  const secretKey = ESEWA_SECRECT_KEY;

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



  //  PAYMENT ROUTE 3: ESEWA VERIFY
  
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



  //  PAYMENT ROUTE 4: KHALTI INITIATE
   

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



  //  PAYMENT ROUTE 5: KHALTI VERIFY
  
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



  //  PAYMENT ROUTE 6: MARK PAYMENT AS PAID MANUALLY
  
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



  //  TEST ROUTE
  
app.get("/test", (req, res) => {
  res.json({ message: "Backend is working!" });
});


// Start server on port 5001
app.listen(5001, () => console.log("Server running on port 5001"));