// console.log("Leaderboard routes loaded");
import express from "express";
import { db }   from "../config/db.js";

const router = express.Router();

/* ══════════════════════════════════════════════
   POINT VALUES — how many points each action earns
   ══════════════════════════════════════════════ */

const POINTS = {
  request_completed : 50,
  request_submitted : 10,
  payment_paid      : 20,
  fine_cleared      : 15,
  feedback_given    : 5,
  streak_bonus      : 25,   // per 7-day streak milestone
};

const BADGES = [
  { id: "first_request",  name: "First Step",      icon: "🌱", desc: "Submit your first request",            condition: (s) => s.total_requests >= 1 },
  { id: "eco_starter",    name: "Eco Starter",      icon: "♻️", desc: "Complete 3 requests",                 condition: (s) => s.completed_requests >= 3 },
  { id: "green_warrior",  name: "Green Warrior",    icon: "🌿", desc: "Complete 10 requests",                condition: (s) => s.completed_requests >= 10 },
  { id: "eco_champion",   name: "Eco Champion",     icon: "🏆", desc: "Complete 25 requests",                condition: (s) => s.completed_requests >= 25 },
  { id: "clean_city",     name: "Clean City Hero",  icon: "🏙️", desc: "Complete 50 requests",               condition: (s) => s.completed_requests >= 50 },
  { id: "good_payer",     name: "Good Payer",        icon: "💳", desc: "Pay your first bill on time",         condition: (s) => s.paid_payments >= 1 },
  { id: "fine_free",      name: "Fine-Free",         icon: "✅", desc: "Clear all fines",                    condition: (s) => s.unpaid_fines === 0 && s.total_fines > 0 },
  { id: "feedback_giver", name: "Voice of the City", icon: "📢", desc: "Submit 5 feedback reports",          condition: (s) => s.total_feedback >= 5 },
  { id: "top_10",         name: "Top 10",            icon: "⭐", desc: "Reach the top 10 on leaderboard",   condition: (s) => s.rank <= 10 && s.rank > 0 },
  { id: "top_3",          name: "Podium",            icon: "🥇", desc: "Reach the top 3 on leaderboard",    condition: (s) => s.rank <= 3 && s.rank > 0 },
];

const LEVELS = [
  { name: "Seedling",   min: 0,    max: 99,   color: "#84cc16", icon: "🌱" },
  { name: "Grower",     min: 100,  max: 299,  color: "#22c55e", icon: "🌿" },
  { name: "Guardian",   min: 300,  max: 699,  color: "#10b981", icon: "🛡️" },
  { name: "Champion",   min: 700,  max: 1499, color: "#3b82f6", icon: "⚡" },
  { name: "Eco Legend", min: 1500, max: Infinity, color: "#f59e0b", icon: "🏆" },
];

const getLevel = (points) => LEVELS.find(l => points >= l.min && points <= l.max) || LEVELS[0];

/* ── Helper: compute/sync a citizen's stats & points ── */
const syncUserStats = (userId, cb) => {
  const sql = `
    SELECT
      (SELECT COUNT(*) FROM requests    WHERE user_id=? )                          AS total_requests,
      (SELECT COUNT(*) FROM requests    WHERE user_id=? AND status='completed')    AS completed_requests,
      (SELECT COUNT(*) FROM payments    WHERE user_id=? AND status='paid')         AS paid_payments,
      (SELECT COUNT(*) FROM payments    WHERE user_id=? AND status='unpaid')       AS unpaid_payments,
      (SELECT COUNT(*) FROM fines       WHERE user_id=? AND status='unpaid')       AS unpaid_fines,
      (SELECT COUNT(*) FROM fines       WHERE user_id=?)                           AS total_fines,
      (SELECT COUNT(*) FROM feedback    WHERE user_id=?)                           AS total_feedback,
      (SELECT COUNT(*) FROM complaints  WHERE user_id=?)                           AS total_complaints
  `;
  const p = [userId, userId, userId, userId, userId, userId, userId, userId];

  db.query(sql, p, (err, rows) => {
    if (err) return cb(err);
    const s = rows[0];

    const points =
      (s.total_requests     * POINTS.request_submitted) +
      (s.completed_requests * POINTS.request_completed) +
      (s.paid_payments      * POINTS.payment_paid)      +
      (s.total_feedback     * POINTS.feedback_given);

    // Upsert into citizen_stats
    db.query(
      `INSERT INTO citizen_stats (user_id, points, recycled_kg, trees_planted, waste_reduced)
       VALUES (?, ?, 0, 0, 0)
       ON DUPLICATE KEY UPDATE points = ?`,
      [userId, points, points],
      (err2) => {
        if (err2) return cb(err2);
        cb(null, { ...s, points });
      }
    );
  });
};

/* ══════════════════════════════════════════════
   GET /api/leaderboard/me/:userId
   Returns full profile: stats, points, level, badges, rank
   ══════════════════════════════════════════════ */
router.get("/me/:userId", (req, res) => {
  const userId = parseInt(req.params.userId);

  syncUserStats(userId, (err, stats) => {
    if (err) {
      console.error("❌ syncUserStats failed:", err.message);
      console.error("❌ Full error:", err);
      return res.status(500).json({ message: "Stats sync failed", error: err.message });
    }

    db.query(
      `SELECT COUNT(*) + 1 AS \`rank\` FROM citizen_stats WHERE points > (SELECT points FROM citizen_stats WHERE user_id=?)`,
      [userId],
      (err2, rankRows) => {
        if (err2) {
          console.error("❌ Rank query failed:", err2.message);
          return res.status(500).json({ message: "Rank query failed", error: err2.message });
        }

        const rank      = rankRows[0]?.rank || 1;
        const points    = stats.points;
        const level     = getLevel(points);
        const nextLevel = LEVELS[LEVELS.findIndex(l => l.name === level.name) + 1] || null;
        const progress  = nextLevel
          ? Math.round(((points - level.min) / (nextLevel.min - level.min)) * 100)
          : 100;

        const statsWithRank = { ...stats, rank };
        const earnedBadges  = BADGES.filter(b => b.condition(statsWithRank));

        res.json({
          points, rank, level, nextLevel, progress,
          stats: statsWithRank,
          badges: earnedBadges,
          allBadges: BADGES.map(b => ({ ...b, earned: b.condition(statsWithRank), condition: undefined })),
          pointValues: POINTS,
        });
      }
    );
  });
});

/* ══════════════════════════════════════════════
   GET /api/leaderboard/top
   Returns top 50 citizens by points
   ══════════════════════════════════════════════ */
router.get("/top", (req, res) => {
  db.query(
    `SELECT
       cs.user_id, cs.points,
       u.name, u.image, u.ward,
       (SELECT COUNT(*) FROM requests WHERE user_id=cs.user_id AND status='completed') AS completed_requests,
       RANK() OVER (ORDER BY cs.points DESC) AS \`rank\`
     FROM citizen_stats cs
     JOIN users u ON u.id = cs.user_id
     WHERE u.role = 'citizen'
     ORDER BY cs.points DESC
     LIMIT 50`,
    (err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch leaderboard", error: err.message });
      const enriched = results.map(r => ({ ...r, level: getLevel(r.points) }));
      res.json(enriched);
    }
  );
});

/* ══════════════════════════════════════════════
   POST /api/leaderboard/sync/:userId
   Force re-sync stats (call after any action)
   ══════════════════════════════════════════════ */
router.post("/sync/:userId", (req, res) => {
  syncUserStats(parseInt(req.params.userId), (err, stats) => {
    if (err) return res.status(500).json({ message: "Sync failed", error: err.message });
    res.json({ message: "Synced", points: stats.points });
  });
});

/* ══════════════════════════════════════════════
   GET /api/leaderboard/history/:userId
   Recent point-earning activity feed
   ══════════════════════════════════════════════ */
router.get("/history/:userId", (req, res) => {
  const userId = parseInt(req.params.userId);

  const requests_sql = `
    SELECT 'request' AS type, type AS detail, status, created_at,
      CASE WHEN status='completed' THEN ${POINTS.request_completed}
           ELSE ${POINTS.request_submitted} END AS points_earned
    FROM requests WHERE user_id=? ORDER BY created_at DESC LIMIT 10
  `;

  const payments_sql = `
    SELECT 'payment' AS type, 
           COALESCE(description, 'Payment') AS detail, 
           status, created_at,
      CASE WHEN status='paid' THEN ${POINTS.payment_paid} ELSE 0 END AS points_earned
    FROM payments WHERE user_id=? ORDER BY created_at DESC LIMIT 5
  `;

  const feedback_sql = `
    SELECT 'feedback' AS type, 
           COALESCE(title, 'Feedback') AS detail, 
           COALESCE(status, 'submitted') AS status, 
           created_at,
           ${POINTS.feedback_given} AS points_earned
    FROM feedback WHERE user_id=? ORDER BY created_at DESC LIMIT 5
  `;

  // Run all 3 queries separately to isolate which one fails
  db.query(requests_sql, [userId], (err1, req_results) => {
    if (err1) {
      console.error("❌ History requests query failed:", err1.message);
      return res.status(500).json({ message: "History failed (requests)", error: err1.message });
    }

    db.query(payments_sql, [userId], (err2, pay_results) => {
      if (err2) {
        console.error("❌ History payments query failed:", err2.message);
        return res.status(500).json({ message: "History failed (payments)", error: err2.message });
      }

      db.query(feedback_sql, [userId], (err3, feed_results) => {
        if (err3) {
          console.error("❌ History feedback query failed:", err3.message);
          return res.status(500).json({ message: "History failed (feedback)", error: err3.message });
        }

        // Merge and sort by date
        const combined = [...req_results, ...pay_results, ...feed_results]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 20);

        res.json(combined);
      });
    });
  });
});
export default router;