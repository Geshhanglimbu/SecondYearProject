import express  from "express";
import { db }   from "../config/db.js";
import { upload } from "../config/multer.js";

const router = express.Router();

/* ── Submit new request ── */
router.post("/submit-request", upload.array("files", 5), (req, res) => {
  const { type, description, pickupDate, pickupTime, userId, location } = req.body;
  if (!userId) return res.status(400).json({ message: "User ID is required" });

  const images = req.files?.length > 0 ? req.files.map(f => f.filename).join(",") : null;

  db.query(
    "INSERT INTO requests (user_id, type, description, pickup_date, pickup_time, image, location) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [userId, type, description, pickupDate, pickupTime, images, location || null],
    (err) => {
      if (err) return res.status(500).json({ message: "Request submission failed" });
      res.status(200).json({ message: "Request submitted successfully!" });
    }
  );
});

/* ── GET all requests for a user ── */
router.get("/:userId", (req, res) => {
  db.query(
    "SELECT * FROM requests WHERE user_id = ? ORDER BY created_at DESC",
    [req.params.userId],
    (err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch requests" });
      res.json(results);
    }
  );
});

/* ── DELETE all requests for a user ── */
router.delete("/all/:userId", (req, res) => {
  db.query("DELETE FROM requests WHERE user_id = ?", [req.params.userId], (err, result) => {
    if (err) return res.status(500).json({ message: "Failed to delete requests" });
    res.json({ message: "All requests deleted", deleted: result.affectedRows });
  });
});

/* ── DELETE single request ── */
router.delete("/:id", (req, res) => {
  db.query("DELETE FROM requests WHERE id = ?", [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ message: "Failed to delete request" });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Request not found" });
    res.json({ message: "Request deleted successfully" });
  });
});

export default router;