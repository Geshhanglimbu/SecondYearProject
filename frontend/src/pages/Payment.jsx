import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Payment.css";

const Payment = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [payments, setPayments] = useState([]);
  const [currentPayment, setCurrentPayment] = useState(null);
  const [selectedGateway, setSelectedGateway] = useState("esewa");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState("pending"); // pending | history

  const BASE_FEE = 600;
  const TAX_RATE = 0.125;
  const TAX_AMOUNT = BASE_FEE * TAX_RATE;
  const TOTAL = BASE_FEE + TAX_AMOUNT;

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) { navigate("/login"); return; }
    const parsed = JSON.parse(savedUser);
    setUser(parsed);
    fetchPayments(parsed.id);
  }, []);

  const fetchPayments = async (userId) => {
    try {
      const res = await fetch(`http://localhost:5001/api/payments/${userId}`);
      const data = await res.json();
      setPayments(data);
      // Find latest pending/overdue
      const pending = data.find(p => p.status === "pending" || p.status === "overdue");
      setCurrentPayment(pending || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getBillingPeriod = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const fmt = (d) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    return `${fmt(start)} – ${fmt(end)}`;
  };

  const getDueDate = () => {
    if (currentPayment?.due_date) {
      return new Date(currentPayment.due_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    }
    const end = new Date();
    end.setDate(end.getDate() + 15);
    return end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  const getAccountId = () => {
    if (!user) return "ECO-XXXXXX";
    return `ECO-${String(user.id).padStart(4, "0")}-${user.name?.substring(0,2).toUpperCase() || "XX"}`;
  };

  // ─────────────────────────────────────────────────────────
  // eSewa Payment
  // Asks backend to generate a signed form, then submits it
  // to eSewa's website invisibly
  // ─────────────────────────────────────────────────────────
  const handleEsewaPayment = async () => {
    // Use amount from database bill, fallback to default TOTAL
    const amount = currentPayment?.amount || TOTAL;

    try {
      // Step 1: Ask our backend to calculate signature
      // We do this on backend because the secret key must stay hidden
      const res = await fetch("http://localhost:5001/api/payments/esewa/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, userId: user.id }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("eSewa initiate error:", err);
        alert("eSewa setup failed: " + (err.message || "Unknown error"));
        setProcessing(false);
        return;
      }

      // Step 2: Backend returns all fields INCLUDING the correct signature
      const fields = await res.json();
      console.log("eSewa fields from backend:", fields);

      // Step 3: Build an invisible HTML form with those fields
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "https://rc-epay.esewa.com.np/api/epay/main/v2/form";

      // Put every field into the form as a hidden input
      Object.entries(fields).forEach(([k, v]) => {
        const input = document.createElement("input");
        input.type  = "hidden";
        input.name  = k;
        input.value = v;
        form.appendChild(input);
      });

      // Step 4: Add form to page and submit — user goes to eSewa website
      document.body.appendChild(form);
      form.submit();

    } catch (err) {
      console.error("eSewa error:", err);
      alert("eSewa connection failed. Is your backend running?");
      setProcessing(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // Khalti Payment
  // Asks backend to get a Khalti payment URL, then redirects user there
  // ─────────────────────────────────────────────────────────
  const handleKhaltiPayment = async () => {
    const amount = currentPayment?.amount || TOTAL;

    try {
      const res = await fetch("http://localhost:5001/api/payments/khalti/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId:    user.id,
          paymentId: currentPayment?.id,
          amount:    Math.round(amount * 100), // Khalti uses PAISA — Rs.675 = 67500 paisa
          name:      user.name,
          email:     user.email || "user@ecoconnect.com",
        }),
      });

      const data = await res.json();
      console.log("Khalti response:", data);

      if (data.payment_url) {
        // Redirect user to Khalti's payment page
        window.location.href = data.payment_url;
      } else {
        alert("Khalti initiation failed: " + (data.message || "Check your Khalti secret key in server.js"));
        setProcessing(false);
      }
    } catch (err) {
      console.error("Khalti error:", err);
      alert("Khalti connection failed. Is your backend running?");
      setProcessing(false);
    }
  };

  const handleFinalize = async () => {
    if (!agreed) { alert("Please agree to the terms first."); return; }
    if (!currentPayment) { alert("No pending payment found."); return; }

    setProcessing(true);
    try {
      if (selectedGateway === "esewa") {
        await handleEsewaPayment();           // ← await so errors are caught
      } else if (selectedGateway === "khalti") {
        await handleKhaltiPayment();
      } else if (selectedGateway === "qr") {
        alert("Please scan the QR code and complete payment in your banking app.");
        setProcessing(false);
      }
    } catch {
      setProcessing(false);
    }
  };

  const getStatusClass = (status) => {
    if (status === "paid") return "badge-paid";
    if (status === "overdue") return "badge-overdue";
    return "badge-pending";
  };

  if (loading) return <div className="pay-loading">Loading payments...</div>;

  return (
    <div className="pay-page">

      {/* NAVBAR */}
      <nav className="pay-navbar">
        <div className="pay-nav-left">
          <div className="pay-logo" onClick={() => navigate("/dashboard")}>
            <span className="pay-logo-icon">♻</span>
            <span className="pay-logo-text">EcoConnect</span>
          </div>
          <div className="pay-breadcrumb">
            <span onClick={() => navigate("/dashboard")} className="pay-bc-link">Portal</span>
            <span className="pay-bc-sep">›</span>
            <span className="pay-bc-active">Payment</span>
          </div>
        </div>
        <div className="pay-nav-right">
          <span className="pay-hello">{user?.name || "User"}</span>
          <div className="pay-avatar">
            {user?.image
              ? <img src={`http://localhost:5001/uploads/${user.image}`} alt="av" />
              : <span>{user?.name?.[0]?.toUpperCase()}</span>}
          </div>
        </div>
      </nav>

      <div className="pay-body">

        {/* SIDEBAR */}
        <aside className="pay-sidebar">
          <div className="pay-sidebar-section">
            <div className="pay-sidebar-label">MANAGEMENT</div>
            <div className="pay-menu-item" onClick={() => navigate("/dashboard")}>
              <span>📊</span> Dashboard
            </div>
            <div className="pay-menu-item" onClick={() => navigate("/new-request")}>
              <span>📋</span> New Requests
              <span className="pay-badge-new">NEW</span>
            </div>
            <div className="pay-menu-item" onClick={() => navigate("/complaints")}>
              <span>💬</span> Complaints
            </div>
          </div>

          <div className="pay-sidebar-section">
            <div className="pay-sidebar-label">USER PORTAL</div>
            <div className="pay-menu-item pay-menu-active">
              <span>💳</span> Payment
            </div>
          </div>

          {/* GREEN IMPACT BOX */}
          <div className="pay-impact-box">
            <div className="pay-impact-header">
              <span>🌿</span> GREEN IMPACT
            </div>
            <p>Your recycling streak has saved <strong>18.5 kg</strong> of plastic from landfills this year.</p>
            <div className="pay-impact-bar">
              <div className="pay-impact-fill" style={{ width: "62%" }} />
            </div>
            <div className="pay-impact-pct">62% to your monthly goal</div>
          </div>

          <div className="pay-logout" onClick={() => { localStorage.removeItem("user"); navigate("/login"); }}>
            ↪ Logout Session
          </div>
        </aside>

        {/* MAIN */}
        <main className="pay-main">
          <div className="pay-main-header">
            <h1 className="pay-title">Finalize Payment</h1>
            {currentPayment?.status === "overdue" && (
              <span className="pay-overdue-badge">⚠ PAYMENT OVERDUE</span>
            )}
          </div>

          {/* TABS */}
          <div className="pay-tabs">
            <button className={`pay-tab ${activeTab === "pending" ? "pay-tab-active" : ""}`}
              onClick={() => setActiveTab("pending")}>Current Payment</button>
            <button className={`pay-tab ${activeTab === "history" ? "pay-tab-active" : ""}`}
              onClick={() => setActiveTab("history")}>Payment History</button>
          </div>

          {activeTab === "history" ? (
            /* PAYMENT HISTORY */
            <div className="pay-history">
              <h3 className="pay-section-title">All Payments</h3>
              {payments.length === 0 ? (
                <div className="pay-empty">No payment records found.</div>
              ) : (
                <div className="pay-history-list">
                  {payments.map((p) => (
                    <div key={p.id} className="pay-history-item">
                      <div className="pay-history-left">
                        <div className="pay-history-icon">💳</div>
                        <div>
                          <div className="pay-history-desc">{p.description || "Monthly waste fee"}</div>
                          <div className="pay-history-date">
                            Due: {new Date(p.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            {p.paid_date && ` · Paid: ${new Date(p.paid_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                          </div>
                        </div>
                      </div>
                      <div className="pay-history-right">
                        <span className="pay-history-amount">Rs. {Number(p.amount).toLocaleString()}</span>
                        <span className={`pay-badge ${getStatusClass(p.status)}`}>{p.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* CURRENT PAYMENT */
            <div className="pay-content">
              <div className="pay-left-col">

                {/* FEE SUMMARY */}
                <div className="pay-card">
                  <h3 className="pay-card-title">Fee Summary</h3>
                  <p className="pay-card-sub">Billed to: {user?.address || "Your registered address"}</p>

                  {/* AMOUNT HERO */}
                  <div className="pay-amount-hero">
                    <div className="pay-amount-label">TOTAL AMOUNT PAYABLE</div>
                    <div className="pay-amount-value">
                      Rs. {Number(currentPayment?.amount || TOTAL).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="pay-due-date">⏰ Due Date: {getDueDate()}</div>
                  </div>

                  {/* BILLING DETAILS */}
                  <div className="pay-details-list">
                    <div className="pay-detail-row">
                      <span className="pay-detail-icon">📅</span>
                      <div>
                        <div className="pay-detail-label">BILLING INTERVAL</div>
                        <div className="pay-detail-value">{getBillingPeriod()}</div>
                      </div>
                    </div>
                    <div className="pay-detail-row">
                      <span className="pay-detail-icon">📍</span>
                      <div>
                        <div className="pay-detail-label">SERVICE LOCATION</div>
                        <div className="pay-detail-value">{user?.address || "Registered Address"}</div>
                      </div>
                    </div>
                    <div className="pay-detail-row">
                      <span className="pay-detail-icon">🗑</span>
                      <div>
                        <div className="pay-detail-label">SERVICE TYPE</div>
                        <div className="pay-detail-value">Biodegradable & Non-Bio Segregated</div>
                      </div>
                    </div>
                    <div className="pay-detail-row">
                      <span className="pay-detail-icon">🪪</span>
                      <div>
                        <div className="pay-detail-label">ACCOUNT ID</div>
                        <div className="pay-detail-value">{getAccountId()}</div>
                      </div>
                    </div>
                  </div>

                  {/* FEE BREAKDOWN */}
                  <div className="pay-breakdown">
                    <div className="pay-breakdown-row">
                      <span>Municipal Collection Fee</span>
                      <span>Rs. {BASE_FEE.toLocaleString()}.00</span>
                    </div>
                    <div className="pay-breakdown-row">
                      <span>Sanitation Tax (12.5%)</span>
                      <span>Rs. {TAX_AMOUNT.toLocaleString()}.00</span>
                    </div>
                    <div className="pay-breakdown-total">
                      <span>Total Payable</span>
                      <span className="pay-total-val">Rs. {TOTAL.toLocaleString()}.00</span>
                    </div>
                  </div>

                  {/* SECURITY NOTE */}
                  <div className="pay-security">
                    <span className="pay-security-icon">🔒</span>
                    <div>
                      <div className="pay-security-title">PCI-DSS Compliant Gateway</div>
                      <div className="pay-security-desc">Your transaction details are encrypted at rest and in transit. EcoConnect never stores your financial credentials.</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COL */}
              <div className="pay-right-col">
                <div className="pay-card">
                  <h3 className="pay-card-title">Select Payment Gateway</h3>
                  <p className="pay-card-sub">Choose a secure method to process your municipal fee.</p>

                  {/* GATEWAY OPTIONS */}
                  <div className="pay-gateways">
                    <div
                      className={`pay-gateway ${selectedGateway === "esewa" ? "pay-gateway-active" : ""}`}
                      onClick={() => setSelectedGateway("esewa")}
                    >
                      <div className="pay-gw-icon pay-gw-esewa">e</div>
                      <span>ESEWA WALLET</span>
                      {selectedGateway === "esewa" && <span className="pay-gw-check">✓</span>}
                    </div>
                    <div
                      className={`pay-gateway ${selectedGateway === "khalti" ? "pay-gateway-active" : ""}`}
                      onClick={() => setSelectedGateway("khalti")}
                    >
                      <div className="pay-gw-icon pay-gw-khalti">K</div>
                      <span>KHALTI PAY</span>
                      {selectedGateway === "khalti" && <span className="pay-gw-check">✓</span>}
                    </div>
                    <div
                      className={`pay-gateway ${selectedGateway === "qr" ? "pay-gateway-active" : ""}`}
                      onClick={() => setSelectedGateway("qr")}
                    >
                      <div className="pay-gw-icon pay-gw-qr">⊞</div>
                      <span>FONEPAY QR</span>
                      {selectedGateway === "qr" && <span className="pay-gw-check">✓</span>}
                    </div>
                  </div>

                  {/* QR CODE SECTION */}
                  {selectedGateway === "qr" && (
                    <div className="pay-qr-section">
                      <div className="pay-qr-left">
                        <div className="pay-qr-box">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=EcoConnect-Payment-${getAccountId()}-Rs${TOTAL}`}
                            alt="QR Code"
                          />
                        </div>
                        <div className="pay-qr-ready">🟢 GATEWAY READY</div>
                      </div>
                      <div className="pay-qr-steps">
                        <h4>Scan and Pay Instantly</h4>
                        <p>Fastest way to clear your dues using mobile banking.</p>
                        {[
                          "Launch your preferred Mobile Banking App.",
                          "Select the 'Scan & Pay' icon on the home screen.",
                          "Scan the generated QR code shown on the left.",
                          `Review and authorize the Rs. ${TOTAL.toLocaleString()} payment.`
                        ].map((step, i) => (
                          <div key={i} className="pay-step">
                            <span className="pay-step-num">{i + 1}</span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ESEWA INFO */}
                  {selectedGateway === "esewa" && (
                    <div className="pay-gateway-info pay-esewa-info">
                      <span>🟢</span>
                      <div>
                        <strong>eSewa Wallet</strong>
                        <p>You'll be redirected to eSewa's secure payment portal to complete the transaction.</p>
                      </div>
                    </div>
                  )}

                  {/* KHALTI INFO */}
                  {selectedGateway === "khalti" && (
                    <div className="pay-gateway-info pay-khalti-info">
                      <span>💜</span>
                      <div>
                        <strong>Khalti Digital Wallet</strong>
                        <p>You'll be redirected to Khalti's secure portal. Use your Khalti PIN or linked bank to pay.</p>
                      </div>
                    </div>
                  )}

                  {/* AGREE CHECKBOX */}
                  <div className="pay-agree">
                    <input
                      type="checkbox" id="agree"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                    />
                    <label htmlFor="agree">
                      I certify that the billing information and service address are accurate. Electronic confirmation serves as a digital signature. View <a href="#">Service Policy</a>.
                    </label>
                  </div>

                  {/* FINALIZE BUTTON */}
                  <button
                    className="pay-finalize-btn"
                    onClick={handleFinalize}
                    disabled={!agreed || processing || !currentPayment}
                  >
                    {processing ? "Processing..." : `Finalize Payment →`}
                  </button>

                  {!currentPayment && (
                    <div className="pay-no-due">✅ No pending payments! You're all clear.</div>
                  )}

                  {/* TRUST BADGES */}
                  <div className="pay-trust">
                    <div className="pay-trust-item">
                      <span>🔒</span>
                      <div>
                        <strong>VERIFIED SECURE</strong>
                        <span>256-bit SSL Layer</span>
                      </div>
                    </div>
                    <div className="pay-trust-item">
                      <span>📄</span>
                      <div>
                        <strong>INSTANT RECEIPT</strong>
                        <span>Auto-Cloud Sync</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* FOOTER */}
      <footer className="pay-footer">
        <div className="pay-footer-inner">
          <div className="pay-footer-logo">
            <span className="pay-logo-icon">♻</span>
            <span className="pay-logo-text">EcoConnect</span>
            <span className="pay-footer-copy">© 2025 Metropolitan Waste Division</span>
          </div>
          <div className="pay-footer-links">
            <a href="#">Terms & Conditions</a>
            <a href="#">Data Privacy</a>
            <a href="#">Help Desk</a>
            <a href="#">Refund Policy</a>
          </div>
          <div className="pay-footer-status">
            <span className="pay-status-dot" /> System Online
          </div>
        </div>
      </footer>

    </div>
  );
};

export default Payment;
