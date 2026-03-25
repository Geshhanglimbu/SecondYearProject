import express from "express";
import bcrypt  from "bcryptjs";
import { db }  from "../config/db.js";
import { upload } from "../config/multer.js";

const router = express.Router();

/* ── REGISTER ── */
router.post("/register", upload.single("image"), async (req, res) => {
  const { role, name, email, phone, address, password } = req.body;

  db.query(
    "SELECT email, phone FROM users WHERE email = ? OR phone = ?",
    [email, phone],
    async (err, results) => {
      if (err) return res.status(500).json({ message: "Server error" });

      if (results.length > 0) {
        if (results.some(u => u.phone === phone))
          return res.status(400).json({ message: "Phone number already registered. Please use a different phone number." });
        if (results.some(u => u.email === email))
          return res.status(400).json({ message: "Email already registered. Please use a different email." });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const image = req.file ? req.file.filename : null;

      db.query(
        "INSERT INTO users (role, name, email, phone, address, password, image) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [role, name, email, phone, address, hashedPassword, image],
        (insertErr) => {
          if (insertErr) return res.status(500).json({ message: "Registration failed" });
          res.json({ message: "Registered successfully" });
        }
      );
    }
  );
});

/* ── LOGIN ── */
router.post("/login", async (req, res) => {
  const { email, password, role } = req.body;

  db.query(
    "SELECT * FROM users WHERE email = ? AND role = ?",
    [email, role],
    async (err, results) => {
      if (err) return res.status(500).json({ message: "Server error" });
      if (results.length === 0) return res.status(400).json({ message: "Invalid email or role" });

      const user  = results[0];
      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(400).json({ message: "Incorrect password" });

      res.json({ message: "Login successful", user });
    }
  );
});

export default router;