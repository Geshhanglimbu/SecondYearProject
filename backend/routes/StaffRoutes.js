import express from "express";
import { db }   from "../config/db.js";

const router = express.Router();

/* ══════════════════════════════════════════════
   GET /api/staff/schedules
   ══════════════════════════════════════════════ */
router.get("/schedules", (req, res) => {
  const sql = `
    SELECT
      s.id, s.request_id, s.staff_id, s.area,
      s.collection_date, s.status, s.type,
      s.location, s.pickup_time, s.citizen_name,
      s.staff_name, s.completed_at, s.created_at
    FROM schedules s
    ORDER BY s.collection_date DESC
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ schedules query error:", err.message);
      return res.status(500).json({ message: "Failed to fetch schedules", error: err.message });
    }
    console.log(`✅ Schedules fetched: ${results.length} rows`);
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

  // Step 1 — update the schedule row
  db.query(
    `UPDATE schedules SET status = ?, staff_name = ?, completed_at = ? WHERE id = ?`,
    [status, staff_name || "Staff", completedAt, scheduleId],
    (err) => {
      if (err) {
        console.error("❌ schedule update error:", err.message);
        return res.status(500).json({ message: "Failed to update schedule", error: err.message });
      }

      // Step 2 — fetch the request_id linked to this schedule
      db.query("SELECT request_id FROM schedules WHERE id = ?", [scheduleId], (err2, rows) => {
        if (err2 || !rows.length) {
          console.log("⚠️ Could not find request_id for schedule", scheduleId);
          return res.json({ message: "Schedule updated (no linked request)" });
        }

        const requestId = rows[0].request_id;

        if (!requestId) {
          // No request_id stored — schedule was created manually, nothing to sync
          return res.json({ message: "Schedule updated (manually created, no request link)" });
        }

        // Step 3 — sync requests.status so citizen sees it
        if (status === "completed") {
          db.query(
            `UPDATE requests SET status = 'completed', completed_by = ? WHERE id = ?`,
            [staff_name || "Staff", requestId],
            (err3) => {
              if (err3) console.error("⚠️ Request sync error:", err3.message);
              else      console.log(`✅ Request ${requestId} marked completed by ${staff_name}`);
            }
          );
        }

        if (status === "pending") {
          // Staff reopened — roll request back to accepted
          db.query(
            `UPDATE requests SET status = 'accepted', completed_by = NULL WHERE id = ?`,
            [requestId],
            (err3) => { if (err3) console.error("⚠️ Reopen sync error:", err3.message); }
          );
        }

        if (status === "in_progress") {
          // Optional: reflect in-progress on the request too
          db.query(
            `UPDATE requests SET status = 'in_progress' WHERE id = ?`,
            [requestId],
            (err3) => { if (err3) console.error("⚠️ In-progress sync error:", err3.message); }
          );
        }

        res.json({ message: "Schedule updated successfully" });
      });
    }
  );
});

/* ══════════════════════════════════════════════
   GET /api/staff/debug
   http://localhost:5001/api/staff/debug
   ══════════════════════════════════════════════ */
router.get("/debug", (req, res) => {
  db.query(
    `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN ('schedules','requests','users')
     ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const grouped = {};
      rows.forEach(r => {
        if (!grouped[r.TABLE_NAME]) grouped[r.TABLE_NAME] = [];
        grouped[r.TABLE_NAME].push(`${r.COLUMN_NAME} (${r.DATA_TYPE})`);
      });
      res.json(grouped);
    }
  );
});

export default router;