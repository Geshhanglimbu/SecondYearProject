// // ═══════════════════════════════════════════════════════════════
// //  profileRoutes.js  —  EcoConnect Backend
// //  Mount at: app.use('/api/citizen', profileRoutes)
// //  Requires: express, multer, bcrypt, your DB pool (db)
// // ═══════════════════════════════════════════════════════════════

// import express from 'express';
// import multer from 'multer';
// import bcrypt from 'bcryptjs';
// import path from 'path';
// import fs from 'fs';
// import mysql from 'mysql2/promise';

// const router = express.Router();

// const db = mysql.createPool({
//   host:     "localhost",
//   port:     3307,
//   user:     "root",
//   password: "1234",
//   database: "gms"
// });

// // ══════════════════════════════════════════
// //  MULTER CONFIG (avatar uploads)
// // ══════════════════════════════════════════
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const dir = 'uploads';
//     if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
//     cb(null, dir);
//   },
//   filename: (req, file, cb) => {
//     const ext  = path.extname(file.originalname);
//     const name = `avatar_${req.params.id}_${Date.now()}${ext}`;
//     cb(null, name);
//   },
// });
// const upload = multer({
//   storage,
//   limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
//   fileFilter: (req, file, cb) => {
//     const allowed = /jpeg|jpg|png|webp/i;
//     if (allowed.test(path.extname(file.originalname)) && allowed.test(file.mimetype)) cb(null, true);
//     else cb(new Error('Only JPG, PNG, WEBP images are allowed'));
//   },
// });

// // ══════════════════════════════════════════════════════════════
// //  GET /api/citizen/profile/:id
// //  Returns full citizen profile + stats + recent activity
// // ══════════════════════════════════════════════════════════════
// router.get('/profile/:id', async (req, res) => {
//   try {
//     const { id } = req.params;

//     // ── Main profile row ──
//     const [[user]] = await db.query(
//       `SELECT id, name, email, phone, address, ward, bio, image, created_at
//        FROM users WHERE id = ? AND role = 'citizen'`,
//       [id]
//     );
//     if (!user) return res.status(404).json({ message: 'User not found' });

//     // ── Eco stats ──
//     const [[stats]] = await db.query(
//       `SELECT 
//          COALESCE(SUM(points), 0)        AS points,
//          COALESCE(SUM(recycled_kg), 0)   AS recycledKg,
//          COALESCE(SUM(trees_planted), 0) AS treesPlanted,
//          COALESCE(AVG(waste_reduced), 0) AS wasteReduced
//        FROM citizen_stats WHERE user_id = ?`,
//       [id]
//     );

//     // ── Feedback count ──
//     const [[fb]] = await db.query(
//       `SELECT COUNT(*) AS feedbackCount FROM feedback WHERE user_id = ?`,
//       [id]
//     );

//     // ── Recent activity (last 20 items across requests, complaints, payments, feedback) ──
//     const [activity] = await db.query(
//       `(SELECT 'pickup'   AS type, 'Pickup Scheduled'   AS title, '📦' AS icon, '#10b981' AS color, 50  AS points, created_at AS date FROM requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 5)
//        UNION ALL
//        (SELECT 'complaint' AS type, CONCAT('Complaint: ', LEFT(description,40)) AS title, '⚑' AS icon, '#ef4444' AS color, 20 AS points, created_at AS date FROM complaints WHERE user_id = ? ORDER BY created_at DESC LIMIT 5)
//        UNION ALL
//        (SELECT 'payment'  AS type, 'Bill Paid'          AS title, '₨'  AS icon, '#3b82f6' AS color, 30  AS points, paid_date AS date FROM payments WHERE user_id = ? AND status='paid' ORDER BY paid_date DESC LIMIT 5)
//        UNION ALL
//        (SELECT 'feedback' AS type, 'Feedback Submitted' AS title, '✦'  AS icon, '#8b5cf6' AS color, 50  AS points, created_at AS date FROM feedback WHERE user_id = ? ORDER BY created_at DESC LIMIT 5)
//        ORDER BY date DESC LIMIT 20`,
//       [id, id, id, id]
//     );

//     res.json({
//       ...user,
//       points:        Number(stats?.points      || 0),
//       recycledKg:    Number(stats?.recycledKg   || 0),
//       treesPlanted:  Number(stats?.treesPlanted || 0),
//       wasteReduced:  Math.round(Number(stats?.wasteReduced || 0)),
//       feedbackCount: Number(fb?.feedbackCount   || 0),
//       activity,
//     });
//   } catch (err) {
//     console.error('GET /profile/:id', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // ══════════════════════════════════════════════════════════════
// //  PUT /api/citizen/profile/:id
// //  Updates name, email, phone, address, ward, bio, avatar
// // ══════════════════════════════════════════════════════════════
// router.put('/profile/:id', upload.single('image'), async (req, res) => {
//   try {
//     const { id }                           = req.params;
//     const { name, email, phone, address, ward, bio } = req.body;

//     // Check email uniqueness (exclude self)
//     if (email) {
//       const [[existing]] = await db.query(
//         'SELECT id FROM users WHERE email = ? AND id != ?', [email, id]
//       );
//       if (existing) return res.status(409).json({ message: 'Email already in use' });
//     }

//     // Build dynamic update
//     const fields = [];
//     const vals   = [];
//     if (name    !== undefined) { fields.push('name = ?');    vals.push(name);    }
//     if (email   !== undefined) { fields.push('email = ?');   vals.push(email);   }
//     if (phone   !== undefined) { fields.push('phone = ?');   vals.push(phone);   }
//     if (address !== undefined) { fields.push('address = ?'); vals.push(address); }
//     if (ward    !== undefined) { fields.push('ward = ?');    vals.push(ward);    }
//     if (bio     !== undefined) { fields.push('bio = ?');     vals.push(bio);     }

//     // Handle avatar
//     if (req.file) {
//       // Delete old avatar if exists
//       const [[old]] = await db.query('SELECT image FROM users WHERE id = ?', [id]);
//       if (old?.image) {
//         const oldPath = path.join('uploads', old.image);
//         if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
//       }
//       fields.push('image = ?');
//       vals.push(req.file.filename);
//     }

//     if (fields.length === 0) return res.status(400).json({ message: 'Nothing to update' });

//     vals.push(id);
//     await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, vals);

//     const [[updated]] = await db.query(
//       'SELECT id, name, email, phone, address, ward, bio, image FROM users WHERE id = ?', [id]
//     );
//     res.json({ message: 'Profile updated', user: updated });
//   } catch (err) {
//     console.error('PUT /profile/:id', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // ══════════════════════════════════════════════════════════════
// //  PUT /api/citizen/change-password/:id
// //  Body: { currentPassword, newPassword }
// // ══════════════════════════════════════════════════════════════
// router.put('/change-password/:id', async (req, res) => {
//   try {
//     const { id }                           = req.params;
//     const { currentPassword, newPassword } = req.body;

//     if (!currentPassword || !newPassword)
//       return res.status(400).json({ message: 'Both passwords are required' });
//     if (newPassword.length < 8)
//       return res.status(400).json({ message: 'Password must be at least 8 characters' });

//     const [[user]] = await db.query('SELECT password FROM users WHERE id = ?', [id]);
//     if (!user) return res.status(404).json({ message: 'User not found' });

//     const match = await bcrypt.compare(currentPassword, user.password);
//     if (!match)  return res.status(401).json({ message: 'Current password is incorrect' });

//     const hashed = await bcrypt.hash(newPassword, 12);
//     await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, id]);

//     res.json({ message: 'Password updated successfully' });
//   } catch (err) {
//     console.error('PUT /change-password/:id', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // ══════════════════════════════════════════════════════════════
// //  GET /api/citizen/dashboard/:id
// //  (keep existing, extended with missing fields)
// // ══════════════════════════════════════════════════════════════
// router.get('/dashboard/:id', async (req, res) => {
//   try {
//     const { id } = req.params;

//     const [[stats]] = await db.query(
//       `SELECT 
//          COALESCE(SUM(points), 0)        AS points,
//          COALESCE(SUM(recycled_kg), 0)   AS recycledKg,
//          COALESCE(SUM(trees_planted), 0) AS treesPlanted,
//          COALESCE(AVG(waste_reduced), 0) AS wasteReduced
//        FROM citizen_stats WHERE user_id = ?`,
//       [id]
//     );

//     const [[latestPayment]] = await db.query(
//       `SELECT amount, due_date, status, description
//        FROM payments WHERE user_id = ? AND status IN ('pending','overdue')
//        ORDER BY due_date ASC LIMIT 1`,
//       [id]
//     );

//     const [[pendingRow]] = await db.query(
//       `SELECT COUNT(*) AS cnt FROM payments WHERE user_id = ? AND status IN ('pending','overdue')`,
//       [id]
//     );

//     res.json({
//       stats: {
//         points:       Number(stats?.points      || 0),
//         recycledKg:   Number(stats?.recycledKg   || 0),
//         treesPlanted: Number(stats?.treesPlanted || 0),
//         wasteReduced: Math.round(Number(stats?.wasteReduced || 0)),
//       },
//       latestPayment:  latestPayment || null,
//       pendingCount:   Number(pendingRow?.cnt || 0),
//     });
//   } catch (err) {
//     console.error('GET /dashboard/:id', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // ══════════════════════════════════════════════════════════════
// //  GET /api/landing/stats
// //  Public endpoint — aggregate stats for the landing page
// // ══════════════════════════════════════════════════════════════
// router.get('/landing/stats', async (req, res) => {
//   try {
//     const [[citizens]] = await db.query(
//       `SELECT COUNT(*) AS total FROM users WHERE role = 'citizen'`
//     );
//     const [[eco]] = await db.query(
//       `SELECT 
//          COALESCE(SUM(recycled_kg), 0)   AS totalRecycled,
//          COALESCE(SUM(trees_planted), 0) AS totalTrees
//        FROM citizen_stats`
//     );
//     const [[fb]] = await db.query(
//       `SELECT ROUND(AVG(rating) / 5 * 100, 0) AS satisfaction FROM feedback`
//     );
//     res.json({
//       citizens:     Number(citizens?.total       || 0),
//       recycledKg:   Number(eco?.totalRecycled    || 0),
//       trees:        Number(eco?.totalTrees       || 0),
//       satisfaction: Number(fb?.satisfaction       || 98),
//     });
//   } catch (err) {
//     console.error('GET /landing/stats', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // ══════════════════════════════════════════════════════════════
// //  POST /api/feedback  (if not already defined elsewhere)
// // ══════════════════════════════════════════════════════════════
// router.post('/feedback', async (req, res) => {
//   try {
//     const { userId, category, rating, title, message, anonymous } = req.body;
//     if (!category || !rating || !title || !message)
//       return res.status(400).json({ message: 'All fields are required' });

//     const [result] = await db.query(
//       `INSERT INTO feedback (user_id, category, rating, title, message, anonymous, created_at)
//        VALUES (?, ?, ?, ?, ?, ?, NOW())`,
//       [anonymous ? null : userId, category, rating, title, message, anonymous ? 1 : 0]
//     );

//     // Award points if not anonymous
//     if (!anonymous && userId) {
//       await db.query(
//         `INSERT INTO citizen_stats (user_id, points, recycled_kg, trees_planted, waste_reduced)
//          VALUES (?, 50, 0, 0, 0)
//          ON DUPLICATE KEY UPDATE points = points + 50`,
//         [userId]
//       );
//     }

//     res.status(201).json({ message: 'Feedback submitted', id: result.insertId });
//   } catch (err) {
//     console.error('POST /feedback', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// export default router;
