// ════════════════════════════════════
//  scheduleRoutes.js
// ════════════════════════════════════
import express from "express";
import { db }  from "../config/db.js";

const router = express.Router();

router.get("/", (req, res) => {
  db.query("SELECT * FROM schedules ORDER BY collection_date ASC", (err, results) => {
    if (err) return res.status(500).json({ message: "Failed to fetch schedules" });
    res.json(Array.isArray(results) ? results : []);
  });
});

router.get("/staff/:staffId", (req, res) => {
  db.query(
    "SELECT * FROM schedules WHERE staff_id = ? ORDER BY collection_date ASC",
    [req.params.staffId],
    (err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch schedules" });
      res.json(Array.isArray(results) ? results : []);
    }
  );
});

router.post("/", (req, res) => {
  const { staff_id, area, collection_date } = req.body;
  if (!area || !collection_date)
    return res.status(400).json({ message: "area and collection_date are required" });

  db.query(
    "INSERT INTO schedules (staff_id, area, collection_date, status) VALUES (?, ?, ?, 'pending')",
    [staff_id || null, area, collection_date],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Failed to create schedule" });
      res.json({ id: result.insertId, message: "Schedule created successfully" });
    }
  );
});

router.put("/:id", (req, res) => {
  const { status, staff_name } = req.body;
  if (!["pending", "in_progress", "completed"].includes(status))
    return res.status(400).json({ message: "Invalid status" });

  db.query(
    "UPDATE schedules SET status = ? WHERE id = ?",
    [status, req.params.id],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Failed to update schedule" });
      if (result.affectedRows === 0) return res.status(404).json({ message: "Schedule not found" });
      res.json({ message: "Schedule updated successfully" });
    }
  );
});

export default router;