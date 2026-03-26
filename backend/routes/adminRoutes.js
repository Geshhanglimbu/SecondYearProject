import express from "express";
import { db }   from "../config/db.js";

const router = express.Router();

/* ══════════════════════════════════════════════
   GET /api/admin/requests
   ══════════════════════════════════════════════ */
router.get("/requests", (req, res) => {
  const sql = `
    SELECT r.*, u.name AS citizen_name
    FROM requests r
    LEFT JOIN users u ON r.user_id = u.id
    ORDER BY r.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: "Failed to fetch requests", error: err.message });
    res.json(results);
  });
});

/* ══════════════════════════════════════════════
   PUT /api/admin/requests/:id/status
   - accepted  → set requests.status = 'accepted'
                 INSERT into schedules WITH request_id stored
   - declined  → set requests.status = 'declined'
   - pending   → reopen
   ══════════════════════════════════════════════ */
router.put("/requests/:id/status", (req, res) => {
  const { status } = req.body;
  const reqId = parseInt(req.params.id);

  db.query("UPDATE requests SET status = ? WHERE id = ?", [status, reqId], (err) => {
    if (err) return res.status(500).json({ message: "Failed to update status", error: err.message });

    if (status === "accepted") {
      // First check if a schedule already exists for this request_id
      db.query("SELECT id FROM schedules WHERE request_id = ?", [reqId], (err2, existing) => {
        if (err2) { console.error("⚠️ Schedule check error:", err2.message); return res.json({ message: "Status updated" }); }
        if (existing.length > 0) return res.json({ message: "Status updated" }); // already has schedule

        // Insert schedule with request_id so staff→citizen sync works
        const insertSql = `
          INSERT INTO schedules
            (request_id, staff_id, area, collection_date, status, type, location, pickup_time, citizen_name, created_at)
          SELECT
            r.id,
            r.assigned_to,
            r.location,
            COALESCE(r.pickup_date, DATE_ADD(CURDATE(), INTERVAL 1 DAY)),
            'pending',
            r.type,
            r.location,
            r.pickup_time,
            u.name,
            NOW()
          FROM requests r
          LEFT JOIN users u ON r.user_id = u.id
          WHERE r.id = ?
        `;
        db.query(insertSql, [reqId], (err3) => {
          if (err3) console.error("⚠️ Schedule insert error:", err3.message);
          else      console.log(`✅ Schedule created for request ${reqId}`);
        });
      });
    }

    res.json({ message: "Status updated successfully" });
  });
});

/* ══════════════════════════════════════════════
   GET /api/admin/citizens
   ══════════════════════════════════════════════ */
router.get("/citizens", (req, res) => {
  db.query(
    "SELECT id, name, email, image, created_at FROM users WHERE role = 'citizen' ORDER BY created_at DESC",
    (err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch citizens", error: err.message });
      res.json(results);
    }
  );
});


/* ══════════════════════════════════════════════
   REQUESTS
   ══════════════════════════════════════════════ */
router.get("/requests", (req, res) => {
  db.query(
    `SELECT r.*, u.name AS citizen_name
     FROM requests r LEFT JOIN users u ON r.user_id = u.id
     ORDER BY r.created_at DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch requests", error: err.message });
      res.json(results);
    }
  );
});

router.put("/requests/:id/status", (req, res) => {
  const { status } = req.body;
  const reqId = parseInt(req.params.id);
  db.query("UPDATE requests SET status = ? WHERE id = ?", [status, reqId], (err) => {
    if (err) return res.status(500).json({ message: "Failed to update status", error: err.message });
    if (status === "accepted") {
      db.query("SELECT id FROM schedules WHERE request_id = ?", [reqId], (err2, existing) => {
        if (err2 || existing.length > 0) return;
        db.query(
          `INSERT INTO schedules (request_id,staff_id,area,collection_date,status,type,location,pickup_time,citizen_name,created_at)
           SELECT r.id,r.assigned_to,r.location,COALESCE(r.pickup_date,DATE_ADD(CURDATE(),INTERVAL 1 DAY)),'pending',r.type,r.location,r.pickup_time,u.name,NOW()
           FROM requests r LEFT JOIN users u ON r.user_id=u.id WHERE r.id=?`,
          [reqId],
          (err3) => { if (err3) console.error("⚠️ Schedule insert error:", err3.message); }
        );
      });
    }
    res.json({ message: "Status updated successfully" });
  });
});

/* ══════════════════════════════════════════════
   CITIZENS
   ══════════════════════════════════════════════ */
router.get("/citizens", (req, res) => {
  db.query(
    "SELECT id, name, email, phone, ward, image, created_at FROM users WHERE role='citizen' ORDER BY created_at DESC",
    (err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch citizens", error: err.message });
      res.json(results);
    }
  );
});

/* ══════════════════════════════════════════════
   STAFF LIST (for GPS tracking)
   ══════════════════════════════════════════════ */
router.get("/staff", (req, res) => {
  db.query(
    "SELECT id, name, email, phone, ward, image, created_at FROM users WHERE role='staff' ORDER BY name ASC",
    (err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch staff", error: err.message });
      res.json(results);
    }
  );
});

/* ══════════════════════════════════════════════
   PAYMENTS
   ══════════════════════════════════════════════ */
router.get("/payments", (req, res) => {
  db.query(
    `SELECT p.*, u.name AS citizen_name, u.email AS citizen_email
     FROM payments p LEFT JOIN users u ON p.user_id = u.id
     ORDER BY p.created_at DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch payments", error: err.message });
      res.json(results);
    }
  );
});

router.post("/payments", (req, res) => {
  const { user_id, amount, description, due_date } = req.body;
  if (!user_id || !amount || !description)
    return res.status(400).json({ message: "user_id, amount, description are required" });
  db.query(
    `INSERT INTO payments (user_id, amount, description, status, due_date, created_at)
     VALUES (?, ?, ?, 'unpaid', ?, NOW())`,
    [user_id, amount, description, due_date || null],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Failed to create payment", error: err.message });
      res.json({ id: result.insertId, message: "Payment created successfully" });
    }
  );
});

router.put("/payments/:id", (req, res) => {
  const { status } = req.body;
  db.query("UPDATE payments SET status=? WHERE id=?", [status, req.params.id], (err) => {
    if (err) return res.status(500).json({ message: "Failed to update payment" });
    res.json({ message: "Payment updated" });
  });
});

router.delete("/payments/:id", (req, res) => {
  db.query("DELETE FROM payments WHERE id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ message: "Failed to delete payment" });
    res.json({ message: "Payment deleted" });
  });
});

/* ══════════════════════════════════════════════
   FINES
   ══════════════════════════════════════════════ */
router.get("/fines", (req, res) => {
  db.query(
    `SELECT f.*, u.name AS citizen_name, u.email AS citizen_email
     FROM fines f LEFT JOIN users u ON f.user_id = u.id
     ORDER BY f.created_at DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch fines", error: err.message });
      res.json(results);
    }
  );
});

router.post("/fines", (req, res) => {
  const { user_id, amount, reason, due_date } = req.body;
  if (!user_id || !amount || !reason)
    return res.status(400).json({ message: "user_id, amount, reason are required" });
  db.query(
    `INSERT INTO fines (user_id, amount, reason, status, issued_date, due_date, issued_by, created_at)
     VALUES (?, ?, ?, 'unpaid', CURDATE(), ?, 'Admin', NOW())`,
    [user_id, amount, reason, due_date || null],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Failed to create fine", error: err.message });
      res.json({ id: result.insertId, message: "Fine issued successfully" });
    }
  );
});

router.put("/fines/:id", (req, res) => {
  const { status } = req.body;
  db.query("UPDATE fines SET status=? WHERE id=?", [status, req.params.id], (err) => {
    if (err) return res.status(500).json({ message: "Failed to update fine" });
    res.json({ message: "Fine updated" });
  });
});

router.delete("/fines/:id", (req, res) => {
  db.query("DELETE FROM fines WHERE id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ message: "Failed to delete fine" });
    res.json({ message: "Fine deleted" });
  });
});

/* ══════════════════════════════════════════════
   GPS TRACKING
   Staff POST their location → /api/admin/gps
   Admin GET all staff locations → /api/admin/gps
   ══════════════════════════════════════════════ */
const ensureGpsTable = (cb) => {
  db.query(
    `CREATE TABLE IF NOT EXISTS staff_locations (
      staff_id   INT PRIMARY KEY,
      lat        DOUBLE NOT NULL,
      lng        DOUBLE NOT NULL,
      updated_at DATETIME NOT NULL,
      FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    cb
  );
};

router.post("/gps", (req, res) => {
  const { staff_id, lat, lng } = req.body;
  if (!staff_id || lat == null || lng == null)
    return res.status(400).json({ message: "staff_id, lat, lng required" });

  const upsert = () => db.query(
    `INSERT INTO staff_locations (staff_id, lat, lng, updated_at) VALUES (?,?,?,NOW())
     ON DUPLICATE KEY UPDATE lat=VALUES(lat), lng=VALUES(lng), updated_at=NOW()`,
    [staff_id, lat, lng],
    (err) => {
      if (err) return res.status(500).json({ message: "GPS update failed", error: err.message });
      res.json({ message: "Location updated" });
    }
  );

  ensureGpsTable((e) => { if (e) return res.status(500).json({ message: "Table error" }); upsert(); });
});

router.get("/gps", (req, res) => {
  ensureGpsTable(() => {
    db.query(
      `SELECT sl.staff_id, sl.lat, sl.lng, sl.updated_at, u.name, u.phone, u.ward
       FROM staff_locations sl JOIN users u ON u.id=sl.staff_id
       ORDER BY sl.updated_at DESC`,
      (err, results) => {
        if (err) return res.json([]);
        res.json(results);
      }
    );
  });
});



export default router;