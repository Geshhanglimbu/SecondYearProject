import express from "express";
import { db }   from "../config/db.js";

const router = express.Router();

/* ══════════════════════════════════════════════
   GET /api/staff/schedules
   ══════════════════════════════════════════════ */
// GET /api/staff/schedules  — add staff_id filter
router.get("/schedules", (req, res) => {
  const { staff_id } = req.query;
  console.log("📋 Fetching schedules for staff_id:", staff_id);

  const sql = `
    SELECT s.id, s.request_id, s.staff_id, s.area,
      s.collection_date, s.status, s.type,
      s.location, s.pickup_time, s.citizen_name,
      s.staff_name, s.completed_at, s.created_at
    FROM schedules s
    ORDER BY s.collection_date DESC
  `;

  db.query(sql, [], (err, results) => {
    if (err) {
      console.error("❌ schedules error:", err.message);
      return res.status(500).json({ message: "Failed to fetch schedules", error: err.message });
    }
    console.log(`✅ Total schedules in DB: ${results.length}`);
    console.log("Staff IDs in schedules:", results.map(r => r.staff_id));
    res.json(results);
  });
});

/* ══════════════════════════════════════════════
   PUT /api/staff/schedules/:id
   Updates schedule status AND syncs requests.status
   so the citizen sees the change in their page.
   ══════════════════════════════════════════════ */
router.put("/schedules/:id", (req, res) => {
  const { status, staff_name } = req.body;
  const scheduleId = parseInt(req.params.id);
  const completedAt = status === "completed" ? new Date() : null;

  db.query(
    `UPDATE schedules SET status = ?, staff_name = ?, completed_at = ? WHERE id = ?`,
    [status, staff_name || "Staff", completedAt, scheduleId],
    (err) => {
      if (err) return res.status(500).json({ message: "Failed to update schedule", error: err.message });

      db.query("SELECT request_id, citizen_name, location FROM schedules WHERE id = ?", [scheduleId], (err2, rows) => {
        if (err2 || !rows.length) return res.json({ message: "Schedule updated" });

        const requestId = rows[0].request_id;

        // ✅ If request_id exists, sync directly
        if (requestId) {
          syncRequestStatus(requestId, status, staff_name);
          return res.json({ message: "Schedule updated successfully" });
        }

        // ✅ Fallback: find request by citizen_name + location if request_id is NULL
        db.query(
          `SELECT id FROM requests WHERE location = ? ORDER BY created_at DESC LIMIT 1`,
          [rows[0].location],
          (err3, reqRows) => {
            if (!err3 && reqRows.length > 0) {
              syncRequestStatus(reqRows[0].id, status, staff_name);
            }
            return res.json({ message: "Schedule updated successfully" });
          }
        );
      });
    }
  );
});

// Helper function to sync request status
function syncRequestStatus(requestId, status, staff_name) {
  if (status === "completed") {
    db.query(
      `UPDATE requests SET status = 'completed', completed_by = ? WHERE id = ?`,
      [staff_name || "Staff", requestId],
      (err) => { if (err) console.error("⚠️ Request sync error:", err.message); }
    );
  } else if (status === "pending") {
    db.query(`UPDATE requests SET status = 'accepted', completed_by = NULL WHERE id = ?`, [requestId]);
  } else if (status === "in_progress") {
    db.query(`UPDATE requests SET status = 'in_progress' WHERE id = ?`, [requestId]);
  }
}
export default router;