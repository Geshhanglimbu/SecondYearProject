import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./PaymentSuccess.css";

const PaymentSuccess = ({ success: forcedSuccess = null }) => {
  const navigate      = useNavigate();
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown]   = useState(8);
  const [status, setStatus]         = useState("verifying"); // verifying | success | failed
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [errorMsg, setErrorMsg]     = useState("");

  useEffect(() => {
    // If forcedSuccess is explicitly false → it's the /payment/failed route
    if (forcedSuccess === false) {
      setStatus("failed");
      setErrorMsg("Your payment was cancelled or failed. No money was deducted.");
      startCountdown();
      return;
    }

    // Read URL parameters to detect which gateway returned
    const esewaData = searchParams.get("data");           // eSewa sends base64 data
    const khaltiStatus = searchParams.get("status");      // Khalti sends status
    const pidx         = searchParams.get("pidx");        // Khalti transaction ID
    const txnId        = searchParams.get("transaction_id"); // Khalti transaction ID
    const amount       = searchParams.get("amount");      // Khalti amount in paisa

    // Also read paymentId and userId from URL (passed by our backend in success_url)
    const urlPaymentId = searchParams.get("paymentId");
    const urlUserId    = searchParams.get("userId");

    if (esewaData) {
      // eSewa payment — verify with backend
      verifyEsewa(esewaData, urlPaymentId, urlUserId);
    } else if (khaltiStatus && pidx) {
      // Khalti payment — verify with backend
      verifyKhalti(pidx, khaltiStatus, txnId, amount, urlPaymentId, urlUserId);
    } else {
      // No payment data in URL — show generic success (manual/QR)
      setStatus("success");
      setPaymentInfo({ gateway: "Manual / QR", message: "Payment recorded manually." });
      startCountdown();
    }
  }, []);

  /* ── Verify eSewa payment ── */
  const verifyEsewa = async (data, urlPaymentId, urlUserId) => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      const resolvedUserId    = urlUserId    || storedUser.id;
      const resolvedPaymentId = urlPaymentId || null;

      console.log("Verifying eSewa - userId:", resolvedUserId, "paymentId:", resolvedPaymentId);

      const res = await fetch("http://localhost:5001/api/payments/esewa/verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          data,
          paymentId: resolvedPaymentId && resolvedPaymentId !== "" ? resolvedPaymentId : null,
          userId:    resolvedUserId    && resolvedUserId    !== "" ? resolvedUserId    : null,
        }),
      });

      const result = await res.json();

      if (res.ok && result.verified) {
        // Decode the base64 data to show payment details
        try {
          const decoded = JSON.parse(atob(data));
          setPaymentInfo({
            gateway:         "eSewa",
            transactionId:   decoded.transaction_uuid || decoded.ref_id || "N/A",
            amount:          decoded.total_amount     || "N/A",
            status:          decoded.status           || "COMPLETE",
          });
        } catch {
          setPaymentInfo({ gateway: "eSewa", message: "Payment verified successfully." });
        }
        setStatus("success");
      } else {
        setStatus("failed");
        setErrorMsg(result.message || "eSewa verification failed. Please contact support.");
      }
    } catch (err) {
      console.error("eSewa verify error:", err);
      setStatus("failed");
      setErrorMsg("Could not connect to server to verify payment. Please check your payment history.");
    } finally {
      startCountdown();
    }
  };

  /* ── Verify Khalti payment ── */
  const verifyKhalti = async (pidx, khaltiStatus, txnId, amount, urlPaymentId, urlUserId) => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      const resolvedUserId    = urlUserId    || storedUser.id;
      const resolvedPaymentId = urlPaymentId || null;

      console.log("Verifying Khalti - userId:", resolvedUserId, "paymentId:", resolvedPaymentId);

      const res = await fetch("http://localhost:5001/api/payments/khalti/verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          pidx,
          paymentId: resolvedPaymentId && resolvedPaymentId !== "" ? resolvedPaymentId : null,
          userId:    resolvedUserId    && resolvedUserId    !== "" ? resolvedUserId    : null,
        }),
      });

      const result = await res.json();

      if (res.ok && result.verified) {
        setPaymentInfo({
          gateway:       "Khalti",
          transactionId: pidx   || txnId || "N/A",
          amount:        amount ? `Rs. ${(parseInt(amount) / 100).toLocaleString()}` : "N/A",
          status:        khaltiStatus || "Completed",
        });
        setStatus("success");
      } else {
        setStatus("failed");
        setErrorMsg(result.message || "Khalti verification failed. Please contact support.");
      }
    } catch (err) {
      console.error("Khalti verify error:", err);
      setStatus("failed");
      setErrorMsg("Could not connect to server to verify payment. Please check your payment history.");
    } finally {
      startCountdown();
    }
  };

  /* ── Start countdown after verification ── */
  const startCountdown = () => {
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timer);
          // Pass success=true so Payment page auto-opens History tab
          navigate("/payment?success=true");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  /* ── Render ── */
  return (
    <div className="ps-page">

      {/* Background decoration */}
      <div className="ps-bg-circle ps-bg-circle-1"></div>
      <div className="ps-bg-circle ps-bg-circle-2"></div>

      <div className="ps-card">

        {/* ── VERIFYING STATE ── */}
        {status === "verifying" && (
          <div className="ps-verifying">
            <div className="ps-spinner"></div>
            <h2 className="ps-verifying-title">Verifying Payment...</h2>
            <p className="ps-verifying-sub">Please wait while we confirm your payment with the gateway. Do not close this page.</p>
          </div>
        )}

        {/* ── SUCCESS STATE ── */}
        {status === "success" && (
          <>
            {/* Animated checkmark */}
            <div className="ps-icon-wrap ps-success-wrap">
              <div className="ps-icon ps-icon-success">
                <svg viewBox="0 0 52 52">
                  <circle className="ps-check-circle" cx="26" cy="26" r="25" fill="none"/>
                  <path className="ps-check-tick" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                </svg>
              </div>
            </div>

            <h1 className="ps-title">Payment Successful!</h1>
            <p className="ps-desc">
              Your payment has been verified and recorded. Your waste management account has been updated.
            </p>

            {/* Payment details box */}
            {paymentInfo && (
              <div className="ps-details-box">
                <div className="ps-details-title">Payment Details</div>
                <div className="ps-details-grid">
                  <div className="ps-detail-row">
                    <span className="ps-detail-label">Gateway</span>
                    <span className="ps-detail-val ps-gateway-badge">
                      {paymentInfo.gateway === "eSewa"  ? "🟢 eSewa"  :
                       paymentInfo.gateway === "Khalti" ? "💜 Khalti" :
                       "⊞ " + paymentInfo.gateway}
                    </span>
                  </div>
                  {paymentInfo.transactionId && (
                    <div className="ps-detail-row">
                      <span className="ps-detail-label">Transaction ID</span>
                      <span className="ps-detail-val ps-txn-id">{paymentInfo.transactionId}</span>
                    </div>
                  )}
                  {paymentInfo.amount && (
                    <div className="ps-detail-row">
                      <span className="ps-detail-label">Amount Paid</span>
                      <span className="ps-detail-val ps-amount-val">{paymentInfo.amount}</span>
                    </div>
                  )}
                  <div className="ps-detail-row">
                    <span className="ps-detail-label">Status</span>
                    <span className="ps-detail-val ps-status-success">✓ Verified</span>
                  </div>
                </div>
              </div>
            )}

            <div className="ps-what-next">
              <div className="ps-what-item">✅ Payment recorded in your account</div>
              <div className="ps-what-item">✅ Monthly bill status updated to Paid</div>
              <div className="ps-what-item">✅ You can view receipt in Payment History</div>
            </div>
          </>
        )}

        {/* ── FAILED STATE ── */}
        {status === "failed" && (
          <>
            <div className="ps-icon-wrap ps-fail-wrap">
              <div className="ps-icon ps-icon-fail">✕</div>
            </div>
            <h1 className="ps-title ps-title-fail">Payment Failed</h1>
            <p className="ps-desc">
              {errorMsg || "Something went wrong. Your payment was not processed. No money was deducted."}
            </p>

            <div className="ps-fail-tips">
              <div className="ps-fail-tip">💡 Check your eSewa/Khalti balance</div>
              <div className="ps-fail-tip">💡 Make sure your internet was stable</div>
              <div className="ps-fail-tip">💡 Try a different payment method</div>
              <div className="ps-fail-tip">💡 Contact support if money was deducted</div>
            </div>
          </>
        )}

        {/* ── COUNTDOWN & BUTTONS (shown after verification) ── */}
        {status !== "verifying" && (
          <>
            <div className="ps-countdown">
              {status === "success"
                ? `Redirecting to payments in ${countdown}s...`
                : `Returning to payment page in ${countdown}s...`}
            </div>
            <div className="ps-btn-row">
              <button className="ps-btn-secondary" onClick={() => navigate("/dashboard")}>
                Go to Dashboard
              </button>
              <button className="ps-btn" onClick={() => navigate(status === "success" ? "/payment?success=true" : "/payment")}>
                {status === "success" ? "View Payment History →" : "Try Again →"}
              </button>
            </div>
          </>
        )}

      </div>

      {/* EcoConnect branding at bottom */}
      <div className="ps-brand">
        <span>♻</span> EcoConnect · Smart Garbage Management
      </div>

    </div>
  );
};

export const PaymentFailed = () => <PaymentSuccess success={false} />;
export default PaymentSuccess;
