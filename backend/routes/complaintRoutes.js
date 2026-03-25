import express from "express";
import { db }  from "../config/db.js";

const router = express.Router();

/* ── GET all complaints for a user ── */
router.get("/:userId", (req, res) => {
  db.query(
    "SELECT * FROM complaints WHERE user_id = ? ORDER BY created_at DESC",
    [req.params.userId],
    (err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch complaints" });
      res.json(results);
    }
  );
});

/* ── POST submit complaint ── */
router.post("/", (req, res) => {
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

/* ── PUT update complaint status ── */
router.put("/:id/status", (req, res) => {
  const { status } = req.body;
  if (!["pending", "completed", "resolved"].includes(status))
    return res.status(400).json({ message: "Invalid status" });

  db.query("UPDATE complaints SET status = ? WHERE id = ?", [status, req.params.id], (err) => {
    if (err) return res.status(500).json({ message: "Failed to update status" });
    res.json({ message: "Status updated successfully" });
  });
});

/* ── DELETE all complaints for a user ── */
router.delete("/all/:userId", (req, res) => {
  db.query("DELETE FROM complaints WHERE user_id = ?", [req.params.userId], (err, result) => {
    if (err) return res.status(500).json({ message: "Failed to delete complaints" });
    res.json({ message: "All complaints deleted", deleted: result.affectedRows });
  });
});

/* ── DELETE single complaint ── */
router.delete("/:id", (req, res) => {
  db.query("DELETE FROM complaints WHERE id = ?", [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ message: "Failed to delete complaint" });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Complaint not found" });
    res.json({ message: "Complaint deleted successfully" });
  });
});

export default router;