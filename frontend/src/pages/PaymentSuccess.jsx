import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./PaymentSuccess.css";

const PaymentSuccess = ({ success = true }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timer); navigate("/payment"); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="ps-page">
      <div className="ps-card">
        {success ? (
          <>
            <div className="ps-icon ps-icon-success">✓</div>
            <h1 className="ps-title">Payment Successful!</h1>
            <p className="ps-desc">Your monthly waste management fee has been paid. A receipt has been sent to your email.</p>
          </>
        ) : (
          <>
            <div className="ps-icon ps-icon-fail">✕</div>
            <h1 className="ps-title ps-title-fail">Payment Failed</h1>
            <p className="ps-desc">Something went wrong. Your payment was not processed. Please try again.</p>
          </>
        )}
        <div className="ps-countdown">Redirecting in {countdown}s...</div>
        <button className="ps-btn" onClick={() => navigate("/payment")}>
          Go to Payments →
        </button>
      </div>
    </div>
  );
};

export const PaymentFailed = () => <PaymentSuccess success={false} />;
export default PaymentSuccess;
