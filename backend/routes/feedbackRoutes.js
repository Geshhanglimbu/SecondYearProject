import express  from "express";
import { db }   from "../config/db.js";
import { upload } from "../config/multer.js";

const router = express.Router();

/* ── GET feedback for a user ── */
router.get("/:userId", (req, res) => {
  db.query(
    "SELECT * FROM feedback WHERE user_id = ? ORDER BY created_at DESC",
    [req.params.userId],
    (err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch feedback" });
      res.json(Array.isArray(results) ? results : []);
    }
  );
});

/* ── GET all feedback (admin view) ── */
router.get("/", (req, res) => {
  db.query(
    `SELECT f.*, u.name as user_name, u.email as user_email
     FROM feedback f JOIN users u ON f.user_id = u.id ORDER BY f.created_at DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch feedback" });
      res.json(Array.isArray(results) ? results : []);
    }
  );
});

/* ── POST submit feedback ── */
router.post("/", upload.single("photo"), (req, res) => {
  const { userId, type, title, details, rating } = req.body;
  if (!userId || !type || !title || !details)
    return res.status(400).json({ message: "userId, type, title and details are required" });

  const photo = req.file ? req.file.filename : null;

  db.query(
    "INSERT INTO feedback (user_id, type, title, details, rating, photo, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())",
    [userId, type, title, details, rating || 0, photo],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Failed to submit feedback" });
      res.json({ id: result.insertId, photo, message: "Feedback submitted successfully" });
    }
  );
});

/* ── PUT update feedback (admin) ── */
router.put("/:id", (req, res) => {
  const { status, admin_response } = req.body;
  const valid = ["pending", "in_progress", "resolved", "received", "closed"];
  if (status && !valid.includes(status))
    return res.status(400).json({ message: "Invalid status" });

  db.query(
    "UPDATE feedback SET status = ?, admin_response = ? WHERE id = ?",
    [status || "pending", admin_response || null, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ message: "Failed to update feedback" });
      res.json({ message: "Feedback updated successfully" });
    }
  );
});

/* ── DELETE feedback ── */
router.delete("/:id", (req, res) => {
  db.query("DELETE FROM feedback WHERE id = ?", [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ message: "Failed to delete feedback" });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Feedback not found" });
    res.json({ message: "Feedback deleted successfully" });
  });
});

export default router;