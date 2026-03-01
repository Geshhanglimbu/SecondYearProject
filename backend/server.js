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

// Auto-create uploads folder if missing
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
  console.log("uploads folder created");
}

// Basic setup and middleware

const app = express();

// Allow frontend (React) to communicate with backend
app.use(cors({
  origin: "http://localhost:5173",
  methods: "GET,POST",
  credentials: true
}));

// Parse incoming JSON data
app.use(express.json());

// Public folder for serving uploaded images
app.use("/uploads", express.static("uploads"));

// MySQL connection setup
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

// Storage settings for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({ storage });

/* ------------------ REGISTER API ------------------ */
app.post("/register", upload.single("image"), async (req, res) => {
  const { role, name, email, phone, address, password } = req.body;

  // Encrypt password before storing
  const hashedPassword = await bcrypt.hash(password, 10);

  const image = req.file ? req.file.filename : null;

  const sql =
    "INSERT INTO users (role, name, email, phone, address, password, image) VALUES (?, ?, ?, ?, ?, ?, ?)";

  db.query(
    sql,
    [role, name, email, phone, address, hashedPassword, image],
    (err, result) => {
      if (err) {
          if (err.code === "ER_DUP_ENTRY") {
          return res.status(400).json({ message: "Email already registered! Please use a different email." });
        }
        console.log(err);
        return res.status(500).json({ message: "Registration failed" });
      }

      res.json({ message: "Registered successfully" });
    }
  );
});


/* ------------------ LOGIN API ------------------ */

app.post("/login", async (req, res) => {
  const { email, password, role } = req.body;

  const sql = "SELECT * FROM users WHERE email = ? AND role = ?";
  db.query(sql, [email, role], async (err, results) => {
    if (err) {

      console.log("LOGIN SQL ERROR: ", err);

      return res.status(500).json({ message: "Server error" });
    }

    if (results.length === 0) {
      return res.status(400).json({ message: "Invalid email or role" });
    }

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(400).json({ message: "Incorrect password" });
    }

    res.json({ message: "Login successful", user });
  });
});
/* ------------------ CITIZEN DASHBOARD API ------------------ */
// Add this route to your server.js file

app.get("/api/citizen/dashboard/:userId", (req, res) => {
  const userId = req.params.userId;

  // Get user's recent requests
  const requestsQuery = `
    SELECT * FROM requests 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 5
  `;

  // Get next upcoming schedule
  const scheduleQuery = `
    SELECT * FROM requests 
    WHERE user_id = ? AND pickup_date >= CURDATE() 
    ORDER BY pickup_date ASC 
    LIMIT 1
  `;

  // Get complaints
  const complaintsQuery = `
    SELECT * FROM complaints 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 5
  `;

  // Run all queries
  db.query(requestsQuery, [userId], (err, recentRequests) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Failed to fetch requests" });
    }

    db.query(scheduleQuery, [userId], (err, scheduleResults) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "Failed to fetch schedule" });
      }

      db.query(complaintsQuery, [userId], (err, recentComplaints) => {
        if (err) {
          // If complaints table doesn't exist yet, just return empty array
          recentComplaints = [];
        }

        // Calculate stats based on requests
        const totalRequests = recentRequests.length;
        const points = totalRequests * 100; // 100 points per request
        const recycledKg = totalRequests * 10;
        const treesPlanted = Math.floor(totalRequests / 2);
        const wasteReduced = Math.min(totalRequests * 5, 100);

        res.json({
          stats: {
            points,
            recycledKg,
            treesPlanted,
            wasteReduced,
          },
          recentRequests,
          recentComplaints,
          nextSchedule: scheduleResults[0] || null,
        });
      });
    });
  });
});

/* ------------------ SUBMIT REQUEST API ------------------ */
// Assuming you have a 'requests' table in your 'gms' database with columns like:
// id (auto-increment), user_id (int), type (varchar), description (text), pickup_date (date), pickup_time (time), image (varchar), created_at (timestamp)
// Create it if needed: 
// CREATE TABLE requests (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   user_id INT,
//   type VARCHAR(50),
//   description TEXT,
//   pickup_date DATE,
//   pickup_time TIME,
//   image VARCHAR(255),
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
// );
// FOREIGN KEY (user_id) REFERENCES users(id);  // Optional, if you want to link to users


app.post("/api/submit-request", upload.array("files", 5), (req, res) => {
  const { type, description, pickupDate, pickupTime, userId, location } = req.body;

  if (!userId) return res.status(400).json({ message: "User ID is required" });

  //  correctly get multiple images
  const images = req.files && req.files.length > 0
    ? req.files.map(f => f.filename).join(",")
    : null;

  //  7 question marks for 7 values
  const sql = "INSERT INTO requests (user_id, type, description, pickup_date, pickup_time, image, location) VALUES (?, ?, ?, ?, ?, ?, ?)";

  db.query(sql, [userId, type, description, pickupDate, pickupTime, images, location || null], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Request submission failed" });
    }
    res.status(200).json({ message: "Request submitted successfully!" });
  });
});
/* ------------------ GET USER REQUESTS API ------------------
    THIS NEW ROUTE lets the citizen view all their past requests
*/

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


/* ------------------ TEST ROUTE ------------------ */
app.get("/test", (req, res) => {
  res.json({ message: "Backend is working!" });
});

// Start the backend server
app.listen(5001, () => console.log("Server running on port 5001"));