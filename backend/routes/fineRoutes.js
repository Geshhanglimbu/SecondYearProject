import express from "express";
import { db }  from "../config/db.js";

const router = express.Router();

/* ── GET summary for a user ── */
router.get("/summary/:userId", (req, res) => {
  db.query(
    `SELECT COUNT(*) as total_fines,
     SUM(CASE WHEN status='unpaid' THEN amount ELSE 0 END) as total_unpaid,
     COUNT(CASE WHEN status='unpaid' THEN 1 END) as unpaid_count
     FROM fines WHERE user_id = ?`,
    [req.params.userId],
    (err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch summary" });
      res.json(results[0] || { total_fines: 0, total_unpaid: 0, unpaid_count: 0 });
    }
  );
});

/* ── GET all fines (admin view) ── */
router.get("/", (req, res) => {
  db.query(
    `SELECT f.*, u.name as citizen_name, u.email as citizen_email
     FROM fines f JOIN users u ON f.user_id = u.id ORDER BY f.created_at DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch fines" });
      res.json(Array.isArray(results) ? results : []);
    }
  );
});

/* ── GET fines for a user ── */
router.get("/:userId", (req, res) => {
  db.query(
    "SELECT * FROM fines WHERE user_id = ? ORDER BY status ASC, due_date ASC",
    [req.params.userId],
    (err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch fines" });
      res.json(Array.isArray(results) ? results : []);
    }
  );
});

/* ── POST issue a fine ── */
router.post("/", (req, res) => {
  const { user_id, amount, reason, due_date, issued_by } = req.body;
  if (!user_id || !amount || !reason)
    return res.status(400).json({ message: "user_id, amount and reason are required" });

  db.query(
    "INSERT INTO fines (user_id, amount, reason, status, due_date, issued_by) VALUES (?, ?, ?, 'unpaid', ?, ?)",
    [user_id, amount, reason, due_date || null, issued_by || "Admin"],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Failed to issue fine" });
      res.json({ id: result.insertId, message: "Fine issued successfully" });
    }
  );
});

/* ── PUT mark fine as paid ── */
router.put("/:id/pay", (req, res) => {
  db.query(
    "UPDATE fines SET status='paid', paid_date=CURDATE() WHERE id=?",
    [req.params.id],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Failed to update fine" });
      if (result.affectedRows === 0) return res.status(404).json({ message: "Fine not found" });
      res.json({ message: "Fine marked as paid successfully" });
    }
  );
});

/* ── DELETE a fine ── */
router.delete("/:id", (req, res) => {
  db.query("DELETE FROM fines WHERE id = ?", [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ message: "Failed to delete fine" });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Fine not found" });
    res.json({ message: "Fine deleted successfully" });
  });
});

export default router;