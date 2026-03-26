// ── Add to your runMigrations() in config/db.js ───────────
// Paste these ALTER TABLE calls inside runMigrations so they
// run once on server start (MySQL ignores them if the column
// already exists when you use IF NOT EXISTS).

export function runStaffMigrations(db) {
  // Helper function to add a column only if it doesn't exist
  function addColumnIfNotExists(table, column, columnDef) {
    const sql = `
      SELECT COUNT(*) AS count 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = '${table}' 
        AND COLUMN_NAME = '${column}'
    `;
    db.query(sql, (err, results) => {
      if (err) return console.error(`${table} migration error:`, err.message);

      if (results[0].count === 0) {
        db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${columnDef}`, (err2) => {
          if (err2) console.error(`${table}.${column} migration error:`, err2.message);
          else console.log(`${table}.${column} column OK`);
        });
      } else {
        console.log(`${table}.${column} already exists, skipping`);
      }
    });
  }

  // 1. schedules table
  addColumnIfNotExists("schedules", "staff_id", "INT DEFAULT NULL");
  addColumnIfNotExists("schedules", "staff_name", "VARCHAR(120) DEFAULT NULL");
  addColumnIfNotExists("schedules", "completed_at", "DATETIME DEFAULT NULL");

  // 2. requests table
  addColumnIfNotExists("requests", "assigned_to", "INT DEFAULT NULL");
}

// ── How to wire it in server.js ────────────────────────────
//
// import { runStaffMigrations } from "./config/staffMigrations.js";
//
// db.connect((err) => {
//   if (err) throw err;
//   console.log("MySQL Connected");
//   runMigrations(db);
//   runStaffMigrations(db);   // ← add this line
// });