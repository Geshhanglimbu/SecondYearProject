import mysql from "mysql2";

export const db = mysql.createConnection({
  host:     "localhost",
  port:     3307,
  user:     "root",
  password: "1234",
  database: "gms",
});

export const runMigrations = (db) => {
  const columnsToAdd = [
    ["gateway",        "VARCHAR(50)  NULL"],
    ["transaction_id", "VARCHAR(255) NULL"],
    ["paid_date",      "DATE         NULL"],
    ["description",    "VARCHAR(255) NULL"],
  ];

  db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments'
     ORDER BY ORDINAL_POSITION`,
    (err, cols) => {
      if (!err && cols.length > 0) {
        console.log("payments columns:", cols.map(c => c.COLUMN_NAME).join(", "));
      } else {
        console.log("payments table not found yet or error:", err?.message);
      }
    }
  );

  columnsToAdd.forEach(([colName, colDef]) => {
    db.query(
      `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = ?`,
      [colName],
      (err, rows) => {
        if (err) { console.warn("Migration check failed:", colName, err.message); return; }
        if (rows[0].cnt === 0) {
          db.query(`ALTER TABLE payments ADD COLUMN ${colName} ${colDef}`, (err2) => {
            if (err2) console.warn("Migration ADD failed:", colName, err2.message);
            else      console.log("✅ Added column:", colName);
          });
        }
      }
    );
  });
};