import express from "express";
import axios   from "axios";
import crypto  from "crypto";
import { db }  from "../config/db.js";

const router = express.Router();

/* ── GET all payments for a user ── */
router.get("/:userId", (req, res) => {
  db.query(
    "SELECT * FROM payments WHERE user_id = ? ORDER BY id DESC",
    [req.params.userId],
    (err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch payments" });
      res.json(results);
    }
  );
});

/* ── eSewa INITIATE ── */
router.post("/esewa/initiate", (req, res) => {
  const { amount, userId, paymentId } = req.body;

  const txnId        = paymentId ? `ECO-${userId}-${paymentId}-${Date.now()}` : `ECO-${userId}-${Date.now()}`;
  const parsedAmount = parseFloat(amount);
  const baseAmount   = parseFloat((parsedAmount / 1.125).toFixed(2));
  const taxAmount    = parseFloat((parsedAmount - baseAmount).toFixed(2));
  const totalAmount  = parseFloat((baseAmount + taxAmount).toFixed(2));
  const secretKey    = "8gBm/:&EnhH.1/q";
  const message      = `total_amount=${totalAmount},transaction_uuid=${txnId},product_code=EPAYTEST`;
  const signature    = crypto.createHmac("sha256", secretKey).update(message).digest("base64");

  console.log("eSewa initiate → txnId:", txnId, "| total:", totalAmount);

  res.json({
    amount: baseAmount, tax_amount: taxAmount, total_amount: totalAmount,
    transaction_uuid: txnId, product_code: "EPAYTEST", signature,
    signed_field_names:      "total_amount,transaction_uuid,product_code",
    success_url:             "http://localhost:5173/payment/success",
    failure_url:             "http://localhost:5173/payment/failed",
    product_service_charge:  "0",
    product_delivery_charge: "0",
  });
});

/* ── eSewa VERIFY ── */
router.post("/esewa/verify", async (req, res) => {
  const { data, paymentId, userId } = req.body;

  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(data, "base64").toString("utf-8"));
  } catch (e) {
    return res.status(400).json({ message: "Invalid eSewa data", verified: false });
  }

  console.log("eSewa decoded →", JSON.stringify(decoded, null, 2));

  const rawStatus = (decoded.status || "").toUpperCase().trim();
  const isSuccess = ["COMPLETE", "COMPLETED", "SUCCESS"].includes(rawStatus);
  if (!isSuccess)
    return res.status(400).json({ message: `Payment not completed. Status: "${decoded.status}"`, verified: false });

  const txnUuid = decoded.transaction_uuid || "";
  let resolvedPaymentId = (paymentId && paymentId !== "null" && paymentId !== "undefined") ? String(paymentId) : null;

  if (!resolvedPaymentId && txnUuid) {
    const parts = txnUuid.split("-");
    if (parts.length >= 4 && parts[0] === "ECO") resolvedPaymentId = parts[2];
  }

  const rawAmt = decoded.total_amount || decoded.amount || 0;
  const amount = parseFloat(String(rawAmt).replace(/[^0-9.]/g, "")) || 0;

  const doUpdate = (rowId) => {
    db.query(`UPDATE payments SET status='paid', paid_date=CURDATE() WHERE id=?`, [rowId], (err) => {
      if (err) return res.status(500).json({ message: "DB update failed: " + err.message });
      db.query(`UPDATE payments SET gateway='esewa', transaction_id=? WHERE id=?`, [txnUuid, rowId], () => {});
      res.json({ message: "eSewa payment verified!", verified: true, transactionId: txnUuid });
    });
  };

  const doInsert = (uid) => {
    db.query(`INSERT INTO payments (user_id, amount, status, due_date) VALUES (?, ?, 'paid', CURDATE())`, [uid, amount], (err, r) => {
      if (err) return res.json({ message: "eSewa verified! (DB record pending)", verified: true, transactionId: txnUuid });
      db.query(`UPDATE payments SET gateway='esewa', transaction_id=?, description='Monthly waste fee (eSewa)', paid_date=CURDATE() WHERE id=?`, [txnUuid, r.insertId], () => {});
      res.json({ message: "eSewa payment verified!", verified: true, transactionId: txnUuid, paymentId: r.insertId });
    });
  };

  if (resolvedPaymentId) {
    doUpdate(resolvedPaymentId);
  } else if (userId) {
    db.query(`SELECT id FROM payments WHERE user_id=? AND status != 'paid' ORDER BY created_at DESC LIMIT 1`, [userId], (err, rows) => {
      if (!err && rows.length > 0) doUpdate(rows[0].id);
      else doInsert(userId);
    });
  } else {
    res.json({ message: "eSewa payment verified!", verified: true, transactionId: txnUuid });
  }
});

/* ── Khalti INITIATE ── */
router.post("/khalti/initiate", async (req, res) => {
  const { userId, paymentId, amount, name, email } = req.body;
  try {
    const response = await axios.post(
      "https://a.khalti.com/api/v2/epayment/initiate/",
      {
        return_url:          `http://localhost:5173/payment/success?userId=${userId}${paymentId ? "&paymentId=" + paymentId : ""}`,
        website_url:         "http://localhost:5173",
        amount,
        purchase_order_id:   `ECO-${userId}-${Date.now()}`,
        purchase_order_name: "EcoConnect Monthly Waste Fee",
        customer_info: { name: name || "EcoConnect User", email: email || "user@ecoconnect.com" },
      },
      { headers: { Authorization: "Key YOUR_KHALTI_TEST_SECRET_KEY", "Content-Type": "application/json" } }
    );
    res.json({ payment_url: response.data.payment_url, pidx: response.data.pidx });
  } catch (err) {
    res.status(500).json({ message: "Khalti initiation failed", error: err.response?.data });
  }
});

/* ── Khalti VERIFY ── */
router.post("/khalti/verify", async (req, res) => {
  const { pidx, paymentId, userId } = req.body;
  try {
    const response = await axios.post(
      "https://a.khalti.com/api/v2/epayment/lookup/",
      { pidx },
      { headers: { Authorization: "Key YOUR_KHALTI_TEST_SECRET_KEY", "Content-Type": "application/json" } }
    );

    if (response.data?.status !== "Completed")
      return res.status(400).json({ message: "Khalti not completed: " + (response.data?.status || "unknown"), verified: false });

    const resolvedPaymentId = (paymentId && paymentId !== "null") ? paymentId : null;

    const doUpdate = (rowId) => {
      db.query(`UPDATE payments SET status='paid', paid_date=CURDATE() WHERE id=?`, [rowId], (err) => {
        if (err) return res.status(500).json({ message: "DB update failed" });
        db.query(`UPDATE payments SET gateway='khalti', transaction_id=? WHERE id=?`, [pidx, rowId], () => {});
        res.json({ message: "Khalti payment verified!", verified: true, transactionId: pidx });
      });
    };

    const doInsert = (uid) => {
      const amtRs = response.data.total_amount ? (response.data.total_amount / 100).toFixed(2) : 0;
      db.query(`INSERT INTO payments (user_id, amount, status, due_date) VALUES (?, ?, 'paid', CURDATE())`, [uid, amtRs], (err, r) => {
        if (err) return res.json({ message: "Khalti verified!", verified: true, transactionId: pidx });
        db.query(`UPDATE payments SET gateway='khalti', transaction_id=?, description='Monthly waste fee (Khalti)', paid_date=CURDATE() WHERE id=?`, [pidx, r.insertId], () => {});
        res.json({ message: "Khalti payment verified!", verified: true, transactionId: pidx, paymentId: r.insertId });
      });
    };

    if (resolvedPaymentId) {
      doUpdate(resolvedPaymentId);
    } else if (userId) {
      db.query(`SELECT id FROM payments WHERE user_id=? AND status!='paid' ORDER BY created_at DESC LIMIT 1`, [userId], (err, rows) => {
        if (!err && rows.length > 0) doUpdate(rows[0].id);
        else doInsert(userId);
      });
    } else {
      res.json({ message: "Khalti payment verified!", verified: true, transactionId: pidx });
    }
  } catch (err) {
    res.status(500).json({ message: "Khalti verification error: " + (err.response?.data?.detail || err.message) });
  }
});

/* ── Mark payment paid manually ── */
router.post("/mark-paid", (req, res) => {
  const { paymentId, gateway, transaction_id } = req.body;
  db.query(
    `UPDATE payments SET status='paid', paid_date=CURDATE(), gateway=?, transaction_id=? WHERE id=?`,
    [gateway || "manual", transaction_id || null, paymentId],
    (err) => {
      if (err) return res.status(500).json({ message: "Payment update failed" });
      res.json({ message: "Payment marked as paid!" });
    }
  );
});

/* ── Delete a paid payment record ── */
router.delete("/:id", (req, res) => {
  db.query("DELETE FROM payments WHERE id = ? AND status = 'paid'", [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ message: "Failed to delete payment record" });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Record not found or cannot delete unpaid records" });
    res.json({ message: "Payment record deleted successfully" });
  });
});

export default router;