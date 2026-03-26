import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./Payment.css";

const Payment = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [user, setUser]               = useState(null);
  const [payments, setPayments]       = useState([]);
  const [currentPayment, setCurrentPayment] = useState(null);
  const [fines, setFines]             = useState([]);
  const [fineSummary, setFineSummary] = useState({ total_unpaid: 0, unpaid_count: 0 });
  const [selectedGateway, setSelectedGateway] = useState("esewa");
  const [agreed, setAgreed]           = useState(false);
  const [loading, setLoading]         = useState(true);
  const [processing, setProcessing]   = useState(false);
  const [includeFines, setIncludeFines] = useState(false);
  const [step, setStep]               = useState(1);
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting]       = useState(false);

  const [activeTab, setActiveTab] = useState(
    searchParams.get("success") === "true" ? "history" : "current"
  );
  const [justPaid] = useState(searchParams.get("success") === "true");

  const BASE_FEE   = 600;
  const TAX_AMOUNT = BASE_FEE * 0.125;
  const BILL_TOTAL = parseFloat(currentPayment?.amount || BASE_FEE + TAX_AMOUNT);
  const FINES_TOTAL = parseFloat(fineSummary.total_unpaid || 0);
  const GRAND_TOTAL = includeFines ? BILL_TOTAL + FINES_TOTAL : BILL_TOTAL;
  const isAlreadyPaid = payments.length > 0 && !currentPayment;

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) { navigate("/login"); return; }
    const parsed = JSON.parse(savedUser);
    setUser(parsed);
    Promise.all([fetchPayments(parsed.id), fetchFines(parsed.id)])
      .finally(() => setLoading(false));

    if (searchParams.get("success") === "true") {
      window.history.replaceState({}, "", "/payment");
    }
  }, []);

  const fetchPayments = async (userId) => {
    try {
      const res  = await fetch(`http://localhost:5001/api/payments/${userId}`);
      const data = await res.json();
      const safe = Array.isArray(data) ? data : [];
      setPayments(safe);
      const unpaid = safe.find(p => p.status !== "paid");
      setCurrentPayment(unpaid || null);
    } catch (err) { console.error(err); }
  };

  // ✅ FIX 1: Each response body is read only once — stored in a variable first
  const fetchFines = async (userId) => {
    try {
      const [finesRes, summaryRes] = await Promise.all([
        fetch(`http://localhost:5001/api/fines/${userId}`),
        fetch(`http://localhost:5001/api/fines/summary/${userId}`),
      ]);

      // ✅ Read each body exactly once
      const finesData   = await finesRes.json();
      const summaryData = await summaryRes.json();

      setFines(Array.isArray(finesData) ? finesData : []);
      setFineSummary(summaryData || { total_unpaid: 0, unpaid_count: 0 });
    } catch (err) {
      console.error("Failed to fetch fines:", err);
      setFines([]);
    }
  };

  /* ── eSewa ── */
  const handleEsewaPayment = async () => {
    try {
      const res = await fetch("http://localhost:5001/api/payments/esewa/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount:    GRAND_TOTAL,
          userId:    user.id,
          paymentId: currentPayment?.id || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert("eSewa setup failed: " + (err.message || "Unknown error"));
        setProcessing(false);
        return;
      }
      const fields = await res.json();
      const form   = document.createElement("form");
      form.method  = "POST";
      form.action  = "https://rc-epay.esewa.com.np/api/epay/main/v2/form";
      Object.entries(fields).forEach(([k, v]) => {
        const input = document.createElement("input");
        input.type = "hidden"; input.name = k; input.value = v;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      alert("eSewa connection failed. Is your backend running?");
      setProcessing(false);
    }
  };

  /* ── Khalti ── */
  const handleKhaltiPayment = async () => {
    try {
      const res = await fetch("http://localhost:5001/api/payments/khalti/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId:    user.id,
          paymentId: currentPayment?.id || null,
          amount:    Math.round(GRAND_TOTAL * 100),
          name:      user.name,
          email:     user.email || "user@ecoconnect.com",
        }),
      });
      const data = await res.json();
      if (data.payment_url) {
        window.location.href = data.payment_url;
      } else {
        alert("Khalti initiation failed: " + (data.message || "Check Khalti secret key"));
        setProcessing(false);
      }
    } catch (err) {
      alert("Khalti connection failed. Is your backend running?");
      setProcessing(false);
    }
  };

  /* ── Finalize ── */
 
  const handleFinalize = async () => {
      if (payments.some(p => p.status === "paid") && !currentPayment) {
    alert("This bill is already paid.");
    return;
  }
    if (!agreed) { alert("Please agree to the terms first."); return; }
    if (GRAND_TOTAL <= 0) { alert("Nothing to pay."); return; }
    setProcessing(true);
    try {
      if (selectedGateway === "esewa")       await handleEsewaPayment();
      else if (selectedGateway === "khalti") await handleKhaltiPayment();
      else if (selectedGateway === "qr") {
        alert("Please scan the QR code and complete payment.");
        setProcessing(false);
      }
    } catch { setProcessing(false); }
  };

  const getStatusClass = (status) => {
    if (status === "paid")    return "badge-paid";
    if (status === "overdue") return "badge-overdue";
    return "badge-pending";
  };

  const handleDeletePayment = async (id) => {
    setDeleting(true);
    try {
      const res = await fetch(`http://localhost:5001/api/payments/${id}`, { method: "DELETE" });
      if (res.ok) { setPayments(prev => prev.filter(p => p.id !== id)); setDeleteModal(null); }
      else alert("Failed to delete payment record.");
    } catch { alert("Error deleting. Check backend."); }
    finally { setDeleting(false); }
  };

  const handleDeleteFine = async (id) => {
    setDeleting(true);
    try {
      const res = await fetch(`http://localhost:5001/api/fines/${id}`, { method: "DELETE" });
      if (res.ok) {
        setFines(prev => prev.filter(f => f.id !== id));
        // ✅ FIX 2: Read summary body only once
        const summaryRes  = await fetch(`http://localhost:5001/api/fines/summary/${user.id}`);
        const summaryData = await summaryRes.json();
        setFineSummary(summaryData);
        setDeleteModal(null);
      } else alert("Failed to delete fine record.");
    } catch { alert("Error deleting. Check backend."); }
    finally { setDeleting(false); }
  };

  const getBillingPeriod = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const fmt = (d) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    return `${fmt(start)} – ${fmt(end)}`;
  };

  const getDueDate = () => {
    if (currentPayment?.due_date) return new Date(currentPayment.due_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const end = new Date(); end.setDate(end.getDate() + 15);
    return end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  const getAccountId = () => {
    if (!user) return "ECO-XXXXXX";
    return `ECO-${String(user.id).padStart(4, "0")}-${user.name?.substring(0, 2).toUpperCase() || "XX"}`;
  };

  const unpaidFines = fines.filter(f => f.status === "unpaid");

  if (loading) return (
    <div className="pay-loading">
      <div className="pay-loading-spinner"></div>
      <p>Loading your payment details...</p>
    </div>
  );

  return (
    <div className="pay-page">

      {/* ════ NAVBAR ════ */}
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

        {/* ════ SIDEBAR ════ */}
        <aside className="pay-sidebar">
          <div className="pay-sidebar-section">
            <div className="pay-sidebar-label">MANAGEMENT</div>
            <div className="pay-menu-item" onClick={() => navigate("/dashboard")}><span>📊</span> Dashboard</div>
            <div className="pay-menu-item" onClick={() => navigate("/new-request")}><span>📋</span> New Requests<span className="pay-badge-new">NEW</span></div>
            <div className="pay-menu-item" onClick={() => navigate("/complaints")}><span>💬</span> Complaints</div>
            <div className="pay-menu-item" onClick={() => navigate("/Feedback")}><span>✦</span> Feedback</div>
            <div className="pay-menu-item" onClick={() => navigate("/leaderboard")}><span>🏆</span> Leaderboard</div>
            <div className="pay-menu-item" onClick={() => navigate("/profile")}><span>👤</span> Profile</div>
          </div>
          <div className="pay-sidebar-section">
            <div className="pay-sidebar-label">USER PORTAL</div>
            <div className="pay-menu-item pay-menu-active"><span>💳</span> Payment</div>
          </div>
          <div className="pay-sidebar-summary">
            <div className="pay-summary-row"><span>Monthly Bill</span><span className="pay-summary-amt">Rs. {BILL_TOTAL.toLocaleString()}</span></div>
            {unpaidFines.length > 0 && (
              <div className="pay-summary-row pay-summary-fine"><span>⚠ Fines ({unpaidFines.length})</span><span className="pay-summary-amt red">Rs. {FINES_TOTAL.toLocaleString()}</span></div>
            )}
            <div className="pay-summary-divider"></div>
            <div className="pay-summary-row pay-summary-total"><span>Total Due</span><span className="pay-summary-grand">Rs. {(BILL_TOTAL + FINES_TOTAL).toLocaleString()}</span></div>
          </div>
          <div className="pay-impact-box">
            <div className="pay-impact-header"><span>🌿</span> GREEN IMPACT</div>
            <p>Your recycling streak has saved <strong>18.5 kg</strong> of plastic from landfills this year.</p>
            <div className="pay-impact-bar"><div className="pay-impact-fill" style={{ width: "62%" }} /></div>
            <div className="pay-impact-pct">62% to your monthly goal</div>
          </div>
          <div className="pay-logout" onClick={() => { localStorage.removeItem("user"); navigate("/login"); }}>↪ Logout Session</div>
        </aside>

        {/* ════ MAIN ════ */}
        <main className="pay-main">
          <div className="pay-main-header">
            <h1 className="pay-title">Payments & Fines</h1>
            {currentPayment?.status === "overdue" && <span className="pay-overdue-badge">⚠ PAYMENT OVERDUE</span>}
          </div>

          {/* ── TABS ── */}
          <div className="pay-tabs">
            <button className={`pay-tab ${activeTab === "current" ? "pay-tab-active" : ""}`} onClick={() => setActiveTab("current")}>💳 Current Payment</button>
            <button className={`pay-tab ${activeTab === "fines" ? "pay-tab-active" : ""}`} onClick={() => setActiveTab("fines")}>
              ⚠ Fines {unpaidFines.length > 0 && <span className="pay-tab-badge">{unpaidFines.length}</span>}
            </button>
            <button className={`pay-tab ${activeTab === "history" ? "pay-tab-active" : ""}`} onClick={() => setActiveTab("history")}>📋 History</button>
          </div>

          {/* ══ TAB 1 — CURRENT PAYMENT ══ */}
          {activeTab === "current" && (
            <div className="pay-content">
              <div className="pay-left-col">
                <div className="pay-steps">
                  {["Review Bill", "Select Gateway", "Confirm & Pay"].map((label, i) => (
                    <div key={i} className={`pay-step-item ${step > i + 1 ? "pay-step-done" : step === i + 1 ? "pay-step-active" : ""}`}>
                      <div className="pay-step-circle">{step > i + 1 ? "✓" : i + 1}</div>
                      <span className="pay-step-label">{label}</span>
                      {i < 2 && <div className="pay-step-line"></div>}
                    </div>
                  ))}
                </div>

                {/* STEP 1 */}
                {step === 1 && (
                  <div className="pay-card pay-animate">
                    <h3 className="pay-card-title">📄 Review Your Bill</h3>
                    {isAlreadyPaid && (
                      <div style={{
                        background: "#d1fae5",
                        border: "1px solid #34d399",
                        padding: "10px",
                        borderRadius: "8px",
                        marginBottom: "10px",
                        color: "#065f46"
                      }}>
                        ✅ This bill is already paid. No further payment required.
                      </div>
                    )}
                    <p className="pay-card-sub">Billed to: {user?.address || "Your registered address"}</p>
                    <div className="pay-amount-hero">
                      <div className="pay-amount-label">MONTHLY BILL</div>
                      <div className="pay-amount-value">Rs. {BILL_TOTAL.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                      <div className="pay-due-date">⏰ Due: {getDueDate()}</div>
                    </div>
                    <div className="pay-details-list">
                      <div className="pay-detail-row"><span className="pay-detail-icon">📅</span><div><div className="pay-detail-label">BILLING INTERVAL</div><div className="pay-detail-value">{getBillingPeriod()}</div></div></div>
                      <div className="pay-detail-row"><span className="pay-detail-icon">📍</span><div><div className="pay-detail-label">SERVICE LOCATION</div><div className="pay-detail-value">{user?.address || "Registered Address"}</div></div></div>
                      <div className="pay-detail-row"><span className="pay-detail-icon">🗑</span><div><div className="pay-detail-label">SERVICE TYPE</div><div className="pay-detail-value">Biodegradable & Non-Bio Segregated</div></div></div>
                      <div className="pay-detail-row"><span className="pay-detail-icon">🪪</span><div><div className="pay-detail-label">ACCOUNT ID</div><div className="pay-detail-value">{getAccountId()}</div></div></div>
                    </div>
                    <div className="pay-breakdown">
                      <div className="pay-breakdown-row"><span>Municipal Collection Fee</span><span>Rs. {BASE_FEE.toLocaleString()}.00</span></div>
                      <div className="pay-breakdown-row"><span>Sanitation Tax (12.5%)</span><span>Rs. {TAX_AMOUNT.toLocaleString()}.00</span></div>
                      <div className="pay-breakdown-total"><span>Monthly Bill Subtotal</span><span className="pay-total-val">Rs. {BILL_TOTAL.toLocaleString()}.00</span></div>
                    </div>
                    {unpaidFines.length > 0 && (
                      <div className="pay-fines-panel">
                        <div className="pay-fines-panel-header">
                          <div className="pay-fines-panel-title">
                            <span>⚠️</span>
                            <div>
                              <div className="pay-fines-panel-heading">Outstanding Fines</div>
                              <div className="pay-fines-panel-sub">{unpaidFines.length} fine{unpaidFines.length > 1 ? "s" : ""} totalling <strong>Rs. {FINES_TOTAL.toLocaleString()}</strong></div>
                            </div>
                          </div>
                          <label className="pay-fines-toggle">
                            <input type="checkbox" checked={includeFines} onChange={e => setIncludeFines(e.target.checked)} />
                            <span className="pay-toggle-track"><span className="pay-toggle-thumb"></span></span>
                            <span className="pay-toggle-label">{includeFines ? "Included ✓" : "Include in payment"}</span>
                          </label>
                        </div>
                        <div className="pay-fines-items">
                          {unpaidFines.map((fine, i) => (
                            <div key={fine.id} className="pay-fine-item">
                              <div className="pay-fine-item-left">
                                <span className="pay-fine-num">#{i + 1}</span>
                                <div>
                                  <div className="pay-fine-item-reason">{fine.reason}</div>
                                  <div className="pay-fine-item-meta">Issued: {new Date(fine.issued_date || fine.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{fine.due_date && ` · Due: ${new Date(fine.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}</div>
                                </div>
                              </div>
                              <div className="pay-fine-item-amount">Rs. {Number(fine.amount).toLocaleString()}</div>
                            </div>
                          ))}
                        </div>
                        {includeFines && <div className="pay-fines-subtotal"><span>Fines Subtotal</span><span>Rs. {FINES_TOTAL.toLocaleString()}.00</span></div>}
                      </div>
                    )}
                    <div className="pay-grand-total">
                      <div className="pay-grand-label">TOTAL PAYABLE {includeFines && <span className="pay-grand-note">(bill + fines)</span>}</div>
                      <div className="pay-grand-amount">Rs. {GRAND_TOTAL.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div className="pay-security">
                      <span className="pay-security-icon">🔒</span>
                      <div><div className="pay-security-title">PCI-DSS Compliant Gateway</div><div className="pay-security-desc">Your transaction details are encrypted. EcoConnect never stores your financial credentials.</div></div>
                    </div>
                    {!isAlreadyPaid && (
                  <button className="pay-next-btn" onClick={() => setStep(2)}>
                    Continue to Payment Gateway →
                  </button>
                )}
                  </div>
                )}

                {/* STEP 2 */}
                {step === 2 && (
                  <div className="pay-card pay-animate">
                    <button className="pay-back-btn" onClick={() => setStep(1)}>← Back</button>
                    <h3 className="pay-card-title">🏦 Select Payment Gateway</h3>
                    <p className="pay-card-sub">Choose how you want to pay Rs. {GRAND_TOTAL.toLocaleString()}</p>
                    <div className="pay-gateway-cards">
                      {[
                        { id: "esewa",  icon: "e", label: "eSewa Wallet",  color: "#60bb46", bg: "#f0faf0", desc: "Pay via eSewa digital wallet. Redirected to eSewa's secure portal." },
                        { id: "khalti", icon: "K", label: "Khalti Pay",    color: "#5c2d91", bg: "#f5f0ff", desc: "Pay via Khalti wallet. Redirected to Khalti's secure payment page." },
                        { id: "qr",     icon: "⊞", label: "FonePay QR",   color: "#e65100", bg: "#fff8f0", desc: "Scan QR code with any mobile banking app. Fast and contactless." },
                      ].map(gw => (
                        <div key={gw.id} className={`pay-gateway-card ${selectedGateway === gw.id ? "pay-gateway-card-active" : ""}`} onClick={() => setSelectedGateway(gw.id)} style={{ borderColor: selectedGateway === gw.id ? gw.color : "" }}>
                          <div className="pay-gw-card-left">
                            <div className="pay-gw-card-icon" style={{ background: gw.bg, color: gw.color }}>{gw.icon}</div>
                            <div><div className="pay-gw-card-label">{gw.label}</div><div className="pay-gw-card-desc">{gw.desc}</div></div>
                          </div>
                          <div className={`pay-gw-radio ${selectedGateway === gw.id ? "pay-gw-radio-active" : ""}`} style={{ borderColor: selectedGateway === gw.id ? gw.color : "", background: selectedGateway === gw.id ? gw.color : "" }}></div>
                        </div>
                      ))}
                    </div>
                    {selectedGateway === "qr" && (
                      <div className="pay-qr-section">
                        <div className="pay-qr-left">
                          <div className="pay-qr-box"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=EcoConnect-Payment-${getAccountId()}-Rs${GRAND_TOTAL}`} alt="QR Code" /></div>
                          <div className="pay-qr-ready">🟢 READY TO SCAN</div>
                        </div>
                        <div className="pay-qr-steps">
                          <h4>Scan & Pay Instantly</h4>
                          {["Open your mobile banking app", "Tap 'Scan & Pay' or QR icon", `Scan the QR for Rs. ${GRAND_TOTAL.toLocaleString()}`, "Confirm and authorize payment"].map((s, i) => (
                            <div key={i} className="pay-step"><span className="pay-step-num">{i + 1}</span><span>{s}</span></div>
                          ))}
                        </div>
                      </div>
                    )}
                    <button className="pay-next-btn" onClick={() => setStep(3)}>Continue to Confirm →</button>
                  </div>
                )}

                {/* STEP 3 */}
                {step === 3 && (
                  <div className="pay-card pay-animate">
                    <button className="pay-back-btn" onClick={() => setStep(2)}>← Back</button>
                    <h3 className="pay-card-title">✅ Confirm Payment</h3>
                    <p className="pay-card-sub">Review your payment summary before finalizing</p>
                    <div className="pay-confirm-summary">
                      <div className="pay-confirm-row"><span>Payment Method</span><span className="pay-confirm-val">{selectedGateway === "esewa" ? "🟢 eSewa Wallet" : selectedGateway === "khalti" ? "💜 Khalti Pay" : "⊞ FonePay QR"}</span></div>
                      <div className="pay-confirm-row"><span>Account</span><span className="pay-confirm-val">{getAccountId()}</span></div>
                      <div className="pay-confirm-row"><span>Billing Period</span><span className="pay-confirm-val">{getBillingPeriod()}</span></div>
                      <div className="pay-confirm-row"><span>Monthly Bill</span><span className="pay-confirm-val">Rs. {BILL_TOTAL.toLocaleString()}</span></div>
                      {includeFines && FINES_TOTAL > 0 && <div className="pay-confirm-row pay-confirm-fine"><span>⚠ Fines ({unpaidFines.length})</span><span className="pay-confirm-val red">Rs. {FINES_TOTAL.toLocaleString()}</span></div>}
                      <div className="pay-confirm-total"><span>TOTAL TO PAY</span><span className="pay-confirm-grand">Rs. {GRAND_TOTAL.toLocaleString()}</span></div>
                    </div>
                    <div className="pay-what-next">
                      <div className="pay-what-title">What happens next?</div>
                      <div className="pay-what-steps">
                        {selectedGateway !== "qr" ? (
                          <>
                            <div className="pay-what-item"><span className="pay-what-num">1</span><span>You'll be redirected to {selectedGateway === "esewa" ? "eSewa" : "Khalti"}'s secure payment page</span></div>
                            <div className="pay-what-item"><span className="pay-what-num">2</span><span>Log in and confirm payment of Rs. {GRAND_TOTAL.toLocaleString()}</span></div>
                            <div className="pay-what-item"><span className="pay-what-num">3</span><span>You'll be redirected back to EcoConnect with confirmation</span></div>
                            <div className="pay-what-item"><span className="pay-what-num">4</span><span>Your payment status updates automatically</span></div>
                          </>
                        ) : (
                          <>
                            <div className="pay-what-item"><span className="pay-what-num">1</span><span>Scan the QR code on Step 2 with your banking app</span></div>
                            <div className="pay-what-item"><span className="pay-what-num">2</span><span>Authorize payment of Rs. {GRAND_TOTAL.toLocaleString()}</span></div>
                            <div className="pay-what-item"><span className="pay-what-num">3</span><span>Your status will update within 24 hours</span></div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="pay-agree">
                      <input type="checkbox" id="agree" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
                      <label htmlFor="agree">I confirm the billing information is accurate and authorize this payment of <strong>Rs. {GRAND_TOTAL.toLocaleString()}</strong>. View <a href="#">Service Policy</a>.</label>
                    </div>
                    <button className="pay-finalize-btn" onClick={handleFinalize} disabled={!agreed || processing || isAlreadyPaid}>
                      {processing ? "Processing..." : `Pay Rs. ${GRAND_TOTAL.toLocaleString()} via ${selectedGateway === "esewa" ? "eSewa" : selectedGateway === "khalti" ? "Khalti" : "QR"} →`}
                    </button>
                    <div className="pay-trust">
                      <div className="pay-trust-item"><span>🔒</span><div><strong>VERIFIED SECURE</strong><span>256-bit SSL Layer</span></div></div>
                      <div className="pay-trust-item"><span>📄</span><div><strong>INSTANT RECEIPT</strong><span>Auto-Cloud Sync</span></div></div>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN */}
              <div className="pay-right-col">
                <div className="pay-card pay-sticky-summary">
                  <h3 className="pay-card-title">💰 Payment Summary</h3>
                  <div className="pay-summary-section">
                    <div className="pay-summary-label">Monthly Bill</div>
                    <div className="pay-summary-breakdown">
                      <div className="pay-summary-line"><span>Municipal Fee</span><span>Rs. {BASE_FEE.toLocaleString()}</span></div>
                      <div className="pay-summary-line"><span>Tax (12.5%)</span><span>Rs. {TAX_AMOUNT.toLocaleString()}</span></div>
                      <div className="pay-summary-line pay-summary-sub-total"><span>Subtotal</span><span>Rs. {BILL_TOTAL.toLocaleString()}</span></div>
                    </div>
                  </div>
                  {unpaidFines.length > 0 && (
                    <div className="pay-summary-section pay-summary-fines-section">
                      <div className="pay-summary-label red">⚠ Outstanding Fines</div>
                      <div className="pay-summary-breakdown">
                        {unpaidFines.map((fine, i) => (
                          <div key={fine.id} className="pay-summary-line">
                            <span className="pay-summary-fine-reason">{i + 1}. {fine.reason.length > 22 ? fine.reason.substring(0, 22) + "..." : fine.reason}</span>
                            <span className="red">Rs. {Number(fine.amount).toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="pay-summary-line pay-summary-sub-total red"><span>Fines Total</span><span>Rs. {FINES_TOTAL.toLocaleString()}</span></div>
                      </div>
                      <div className="pay-include-fines-check"><label><input type="checkbox" checked={includeFines} onChange={e => setIncludeFines(e.target.checked)} /> Include fines in payment</label></div>
                    </div>
                  )}
                  <div className="pay-summary-grand-box">
                    <div className="pay-summary-grand-label">TOTAL PAYABLE</div>
                    <div className="pay-summary-grand-val">Rs. {GRAND_TOTAL.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                    {includeFines && <div className="pay-summary-grand-note">Includes monthly bill + {unpaidFines.length} fine{unpaidFines.length > 1 ? "s" : ""}</div>}
                  </div>
                  <div className="pay-right-steps">
                    {["Review Bill", "Select Gateway", "Confirm & Pay"].map((label, i) => (
                      <div key={i} className={`pay-right-step ${step === i + 1 ? "active" : step > i + 1 ? "done" : ""}`}>
                        <span className="pay-right-step-dot">{step > i + 1 ? "✓" : i + 1}</span>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ TAB 2 — FINES ══ */}
          {activeTab === "fines" && (
            <div className="pay-fines-tab">
              {unpaidFines.length > 0 ? (
                <div className="pay-fines-banner">
                  <div className="pay-fines-banner-left">
                    <span className="pay-fines-banner-icon">⚠️</span>
                    <div>
                      <div className="pay-fines-banner-title">You have outstanding fines</div>
                      <div className="pay-fines-banner-sub">{unpaidFines.length} unpaid fine{unpaidFines.length > 1 ? "s" : ""} totalling <strong>Rs. {FINES_TOTAL.toLocaleString()}</strong>. Pay them via the Current Payment tab.</div>
                    </div>
                  </div>
                  <button className="pay-fines-pay-btn" onClick={() => { setIncludeFines(true); setActiveTab("current"); setStep(1); }}>Pay All Fines →</button>
                </div>
              ) : (
                <div className="pay-fines-clear"><span>✅</span><h3>No outstanding fines!</h3><p>Your record is clean. Keep it up!</p></div>
              )}
              <h3 className="pay-section-title">All Fines</h3>
              {fines.length === 0 ? <div className="pay-empty">No fine records found.</div> : (
                <div className="pay-fines-list">
                  {fines.map((fine) => (
                    <div key={fine.id} className={`pay-fine-card ${fine.status === "unpaid" ? "pay-fine-unpaid" : "pay-fine-paid"}`}>
                      <div className="pay-fine-card-left">
                        <div className="pay-fine-icon">{fine.status === "paid" ? "✅" : "⚠️"}</div>
                        <div className="pay-fine-info">
                          <div className="pay-fine-reason">{fine.reason}</div>
                          <div className="pay-fine-meta">
                            <span>📅 {new Date(fine.issued_date || fine.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                            {fine.due_date && <span>⏰ Due: {new Date(fine.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                            <span>👤 {fine.issued_by || "Admin"}</span>
                            {fine.paid_date && <span>💚 Paid: {new Date(fine.paid_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="pay-fine-card-right">
                        <div className="pay-fine-amount">Rs. {Number(fine.amount).toLocaleString()}</div>
                        <span className={`pay-fine-status ${fine.status === "paid" ? "fine-paid" : "fine-unpaid"}`}>{fine.status === "paid" ? "Paid" : "Unpaid"}</span>
                        {fine.status === "paid" && (
                          <button className="pay-delete-btn" onClick={() => setDeleteModal({ type: "fine", id: fine.id, label: fine.reason, amount: Number(fine.amount).toLocaleString() })} title="Delete this fine record">🗑</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="pay-fine-rules">
                <h4>📋 Fine Policy</h4>
                <div className="pay-fine-rules-grid">
                  {[{ icon: "🗑️", rule: "Improper waste segregation", amount: "Rs. 200" }, { icon: "🚫", rule: "Illegal dumping", amount: "Rs. 100" }, { icon: "📅", rule: "Missing 3+ pickups", amount: "Rs. 50" }, { icon: "⏰", rule: "Late payment penalty", amount: "Rs. 100/week" }].map((r, i) => (
                    <div key={i} className="pay-fine-rule-item"><span>{r.icon}</span><div><div className="pay-fine-rule-name">{r.rule}</div><div className="pay-fine-rule-amt">{r.amount}</div></div></div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ TAB 3 — HISTORY ══ */}
          {activeTab === "history" && (
            <div className="pay-history">

              {/* ✅ Success banner after redirect from PaymentSuccess */}
              {justPaid && (
                <div style={{ background: "linear-gradient(135deg,#d1fae5,#a7f3d0)", border: "1.5px solid #34d399", borderRadius: "12px", padding: "14px 18px", marginBottom: "18px", display: "flex", alignItems: "center", gap: "10px", fontSize: "0.95rem", color: "#065f46", fontWeight: 500 }}>
                  <span style={{ fontSize: "1.4rem" }}>🎉</span>
                  <div>
                    <strong>Payment recorded successfully!</strong><br/>
                    <span style={{ fontWeight: 400, fontSize: "0.85rem" }}>Your latest payment is shown below — look for the <strong>paid</strong> badge.</span>
                  </div>
                </div>
              )}

              <h3 className="pay-section-title">Payment History</h3>
              {payments.length === 0 ? (
                <div className="pay-empty">No payment records found.</div>
              ) : (
                <div className="pay-history-list">
                  {/* ✅ Sort: paid first, then by most recent date */}
                  {[...payments]
                    .sort((a, b) => {
                      if (a.status === "paid" && b.status !== "paid") return -1;
                      if (a.status !== "paid" && b.status === "paid") return 1;
                      return new Date(b.paid_date || b.due_date || 0) - new Date(a.paid_date || a.due_date || 0);
                    })
                    .map((p) => (
                      <div key={p.id} className="pay-history-item">
                        <div className="pay-history-left">
                          <div className="pay-history-icon">💳</div>
                          <div>
                            <div className="pay-history-desc">{p.description || "Monthly waste fee"}</div>
                            <div className="pay-history-date">
                              {p.due_date ? `Due: ${new Date(p.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                              {p.paid_date && ` · Paid: ${new Date(p.paid_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                              {p.gateway && <span style={{ marginLeft: 8, opacity: 0.65, fontSize: "0.82rem" }}>via {p.gateway}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="pay-history-right">
                          <span className="pay-history-amount">Rs. {Number(p.amount).toLocaleString()}</span>
                          <span className={`pay-badge ${getStatusClass(p.status)}`}>{p.status}</span>
                          {p.status === "paid" && (
                            <button className="pay-delete-btn" onClick={() => setDeleteModal({ type: "payment", id: p.id, label: p.description || "Monthly waste fee", amount: Number(p.amount).toLocaleString() })} title="Delete this record">🗑</button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ════ FOOTER ════ */}
      <footer className="pay-footer">
        <div className="pay-footer-inner">
          <div className="pay-footer-logo"><span className="pay-logo-icon">♻</span><span className="pay-logo-text">EcoConnect</span><span className="pay-footer-copy">© 2025 Metropolitan Waste Division</span></div>
          <div className="pay-footer-links"><a href="#">Terms & Conditions</a><a href="#">Data Privacy</a><a href="#">Help Desk</a><a href="#">Refund Policy</a></div>
          <div className="pay-footer-status"><span className="pay-status-dot" /> System Online</div>
        </div>
      </footer>

      {/* ════ DELETE MODAL ════ */}
      {deleteModal && (
        <div className="pay-modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="pay-modal-box" onClick={e => e.stopPropagation()}>
            <div className="pay-modal-icon">🗑️</div>
            <h3 className="pay-modal-title">Delete This Record?</h3>
            <p className="pay-modal-desc">
              <strong>{deleteModal.label}</strong><br/>
              Rs. {deleteModal.amount} · {deleteModal.type === "payment" ? "Payment" : "Fine"} record<br/>
              <span className="pay-modal-warning">This will permanently remove the record. This cannot be undone.</span>
            </p>
            <div className="pay-modal-actions">
              <button className="pay-modal-cancel" onClick={() => setDeleteModal(null)} disabled={deleting}>Cancel</button>
              <button className="pay-modal-confirm" onClick={() => deleteModal.type === "payment" ? handleDeletePayment(deleteModal.id) : handleDeleteFine(deleteModal.id)} disabled={deleting}>{deleting ? "Deleting..." : "Yes, Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payment;
