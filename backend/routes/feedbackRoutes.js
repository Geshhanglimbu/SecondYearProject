import express  from "express";
import { db }   from "../config/db.js";
import { upload } from "../config/multer.js";

const router = express.Router();

/* ══════════════════════════════════════════════
   IMPORTANT — Route order matters in Express.
   Specific named routes (/all, /stats) MUST come
   before the wildcard /:userId route, otherwise
   Express matches "all" and "stats" as user IDs.
   ══════════════════════════════════════════════ */

/* ── GET /api/feedback/all  → admin: all feedback with filters ── */
router.get("/all", (req, res) => {
  const { type, status, search } = req.query;

  let sql = `
    SELECT
      f.*,
      u.name  AS user_name,
      u.email AS user_email,
      u.ward  AS user_ward
    FROM feedback f
    JOIN users u ON f.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (type   && type   !== "all") { sql += " AND f.type = ?";   params.push(type);   }
  if (status && status !== "all") { sql += " AND f.status = ?"; params.push(status); }
  if (search && search.trim()) {
    sql += " AND (f.title LIKE ? OR f.details LIKE ? OR u.name LIKE ?)";
    const q = `%${search.trim()}%`;
    params.push(q, q, q);
  }

  sql += " ORDER BY f.created_at DESC";

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("❌ /api/feedback/all error:", err.message);
      return res.status(500).json({ message: "Failed to fetch feedback", error: err.message });
    }
    res.json(Array.isArray(results) ? results : []);
  });
});

/* ── GET /api/feedback/stats  → admin: summary counts ── */
router.get("/stats", (req, res) => {
  db.query(
    `SELECT
       COUNT(*)                                                     AS total,
       SUM(status = 'pending')                                      AS pending,
       SUM(status = 'in_progress')                                  AS in_progress,
       SUM(status = 'resolved')                                     AS resolved,
       SUM(status = 'closed')                                       AS closed,
       SUM(type   = 'issue')                                        AS issues,
       SUM(type   = 'suggestion')                                   AS suggestions,
       SUM(type   = 'compliment')                                   AS compliments,
       SUM(type   = 'other')                                        AS other,
       ROUND(AVG(NULLIF(rating, 0)), 1)                             AS avg_rating,
       SUM(rating = 5)                                              AS five_star,
       SUM(admin_response IS NOT NULL AND admin_response != '')     AS responded
     FROM feedback`,
    (err, rows) => {
      if (err) {
        console.error("❌ /api/feedback/stats error:", err.message);
        return res.status(500).json({ message: "Stats failed", error: err.message });
      }
      res.json(rows[0] || {});
    }
  );
});

/* ── GET /api/feedback/:userId  → citizen: own feedback ── */
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

/* ── POST /api/feedback  → citizen: submit feedback ── */
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

/* ── PUT /api/feedback/:id  → admin: update status + respond ── */
router.put("/:id", (req, res) => {
  const { status, admin_response } = req.body;
  const valid = ["pending", "in_progress", "resolved", "received", "closed"];
  if (status && !valid.includes(status))
    return res.status(400).json({ message: "Invalid status" });

  db.query(
    "UPDATE feedback SET status = ?, admin_response = ? WHERE id = ?",
    [status || "pending", admin_response ?? null, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ message: "Failed to update feedback" });
      res.json({ message: "Feedback updated successfully" });
    }
  );
});

/* ── DELETE /api/feedback/:id ── */
router.delete("/:id", (req, res) => {
  db.query("DELETE FROM feedback WHERE id = ?", [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ message: "Failed to delete feedback" });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Feedback not found" });
    res.json({ message: "Feedback deleted successfully" });
  });
});

export default router;