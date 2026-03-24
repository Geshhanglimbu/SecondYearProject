// Script to create a test citizen user with known password and add a pending payment
import mysql from "mysql2";
import bcrypt from "bcryptjs";

const db = mysql.createConnection({
  host: "localhost",
  port: 3307,
  user: "root",
  password: "1234",
  database: "gms"
});

db.connect(async (err) => {
  if (err) { console.error("DB connect error:", err); process.exit(1); }
  console.log("Connected to MySQL");

  const testEmail = "testcitizen@test.com";
  const testPassword = "test123";
  const hashedPassword = await bcrypt.hash(testPassword, 10);

  // Check if test user already exists
  db.query("SELECT id, name, email FROM users WHERE email = ?", [testEmail], (err, existing) => {
    if (err) { console.error(err); db.end(); return; }

    const proceed = (userId) => {
      // Add pending payment for this user
      db.query("SELECT id FROM payments WHERE user_id = ? AND status IN ('pending','overdue')", [userId], (err, payments) => {
        if (err) { console.error(err); db.end(); return; }
        if (payments.length > 0) {
          console.log("User already has pending payment id:", payments[0].id);
          console.log("\n=== LOGIN CREDENTIALS ===");
          console.log("Email:", testEmail);
          console.log("Password:", testPassword);
          console.log("Role: citizen");
          console.log("=========================");
          db.end();
          return;
        }

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 15);
        const dueDateStr = dueDate.toISOString().split('T')[0];

        db.query(
          `INSERT INTO payments (user_id, amount, status, due_date, description, created_at)
           VALUES (?, 675.00, 'pending', ?, 'Monthly waste collection fee', NOW())`,
          [userId, dueDateStr],
          (err, result) => {
            if (err) { console.error("Payment insert error:", err); db.end(); return; }
            console.log("Payment inserted! id:", result.insertId);
            console.log("\n=== LOGIN CREDENTIALS ===");
            console.log("Email:", testEmail);
            console.log("Password:", testPassword);
            console.log("Role: citizen");
            console.log("=========================");
            db.end();
          }
        );
      });
    };

    if (existing.length > 0) {
      console.log("Test user already exists, id:", existing[0].id);
      proceed(existing[0].id);
    } else {
      db.query(
        "INSERT INTO users (role, name, email, phone, address, password) VALUES (?, ?, ?, ?, ?, ?)",
        ["citizen", "Test Citizen", testEmail, "9800000000", "Kathmandu", hashedPassword],
        (err, result) => {
          if (err) { console.error("User insert error:", err); db.end(); return; }
          console.log("Test citizen created! id:", result.insertId);
          proceed(result.insertId);
        }
      );
    }
  });
});
