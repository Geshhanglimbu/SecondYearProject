import express  from "express";
import cors     from "cors";
import fs       from "fs";
import path     from "path";

// ── Route imports ──
import authRoutes      from "./routes/authRoutes.js";
import paymentRoutes   from "./routes/paymentRoutes.js";
import requestRoutes   from "./routes/requestRoutes.js";
import complaintRoutes from "./routes/complaintRoutes.js";
import scheduleRoutes  from "./routes/scheduleRoutes.js";
import fineRoutes      from "./routes/fineRoutes.js";
import feedbackRoutes  from "./routes/feedbackRoutes.js";
import profileRoutes   from "./routes/profileRoute.js";
import { db, runMigrations } from "./config/db.js";


// ── Ensure uploads folder exists ──
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
  console.log("uploads folder created");
}

const app = express();

app.use(cors({
  origin:      "http://localhost:5173",
  methods:     "GET,POST,PUT,DELETE",
  credentials: true,
}));

app.use(express.json());
app.use("/uploads", express.static("uploads"));

// ── DB connect + migrate ──
db.connect((err) => {
  if (err) throw err;
  console.log("MySQL Connected");
  runMigrations(db);
});

// ── Mount routes ──
app.use("/",                authRoutes);
app.use("/api/payments",    paymentRoutes);
app.use("/api/requests",    requestRoutes);
app.use("/api/complaints",  complaintRoutes);
app.use("/schedules",       scheduleRoutes);
app.use("/api/fines",       fineRoutes);
app.use("/api/feedback",    feedbackRoutes);
app.use("/api/citizen",     profileRoutes);

// ── Health check ──
app.get("/test", (req, res) => res.json({ message: "Backend is working!" }));

// ── Debug route ──
app.get("/api/debug/payments/:userId", (req, res) => {
  db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payments' ORDER BY ORDINAL_POSITION`,
    (err, cols) => {
      db.query(`SELECT * FROM payments WHERE user_id=? ORDER BY id DESC`, [req.params.userId], (err2, rows) => {
        res.json({
          columns:   err  ? "error" : cols.map(c => c.COLUMN_NAME),
          rows:      err2 ? "error: " + err2.message : rows,
          row_count: rows?.length || 0,
        });
      });
    }
  );
});

app.listen(5001, () => console.log("Server running on port 5001"));