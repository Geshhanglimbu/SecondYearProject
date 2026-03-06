import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./CitizenDashboard.css";

const CitizenDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [latestPayment, setLatestPayment] = useState(null);
  const [pendingBills, setPendingBills] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) { navigate("/login"); return; }
    const parsedUser = JSON.parse(savedUser);
    setUser(parsedUser);
    fetchDashboardData(parsedUser.id);
  }, []);

  const fetchDashboardData = async (userId) => {
    try {
      // ✅ ONE fetch call only - dashboard now returns latestPayment + pendingCount
      // ❌ REMOVED: fetch(`/api/payments/bills/${userId}`) — this URL never existed!
      const dashRes = await fetch(`http://localhost:5001/api/citizen/dashboard/${userId}`);
      const data = await dashRes.json();

      setStats(data.stats);
      setLatestPayment(data.latestPayment || null);
      // pendingCount comes from backend, fallback: 1 if latestPayment exists, else 0
      setPendingBills(data.pendingCount || (data.latestPayment ? 1 : 0));

    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  const getEcoRank = (points) => {
    if (points >= 5000) return { rank: "A+++", desc: "Clean city, proud citizen. Your effort leads the way! 🏆" };
    if (points >= 3000) return { rank: "A++",  desc: "Outstanding contributor to a greener community!" };
    if (points >= 1000) return { rank: "A+",   desc: "Great job keeping your city clean!" };
    return                      { rank: "B",    desc: "Keep going! Every effort counts." };
  };

  const ecoRank = stats ? getEcoRank(stats.points) : { rank: "—", desc: "Loading..." };

  return (
    <div className="dashboard-wrapper">

      {/* NAVBAR */}
      <nav className="navbar">
        <div className="nav-logo">
          <div className="logo-icon">♻</div>
          <span className="logo-text">EcoConnect</span>
        </div>
        <div className="nav-right">
          <span className="hello-text">Hello, {user?.name || "User"}</span>
          <div className="avatar-circle">
            {user?.image
              ? <img src={`http://localhost:5001/uploads/${user.image}`} alt="avatar" />
              : <span>{user?.name?.[0]?.toUpperCase() || "U"}</span>}
          </div>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      {/* LAYOUT */}
      <div className="main-content">

        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-menu">
            {[
              { id: "dashboard",  icon: "📊", label: "Dashboard" },
              { id: "request",    icon: "+",  label: "New Request",  path: "/new-request" },
              { id: "complaints", icon: "💬", label: "Complaints",   path: "/complaints" },
              { id: "payment",    icon: "💳", label: "Payments",     path: "/payment",
                badge: pendingBills > 0 ? pendingBills : null },
            ].map((item) => (
              <div
                key={item.id}
                className={`menu-item ${activeMenu === item.id ? "active" : ""}`}
                onClick={() => { setActiveMenu(item.id); if (item.path) navigate(item.path); }}
              >
                <span className="menu-icon">{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && <span className="sidebar-badge">{item.badge}</span>}
              </div>
            ))}
          </div>
          <div className="sidebar-quote">
            <p>"The best way to reduce waste is to not produce it."</p>
          </div>
        </aside>

        {/* CONTENT AREA */}
        <div className="content-area">
          {loading ? (
            <div className="loading">Loading your dashboard...</div>
          ) : (
            <>
              {/* WELCOME BANNER */}
              <div className="welcome-banner">
                <div className="welcome-text">
                  <h2>Welcome back, {user?.name?.split(" ")[0] || "Citizen"}! 👋</h2>
                  <p>Here's your environmental impact at a glance.</p>
                </div>
                <div className="eco-rank-badge">
                  <div className="rank-label">Your Eco Rank</div>
                  <div className="rank-value">{ecoRank.rank}</div>
                  <div className="rank-desc">{ecoRank.desc}</div>
                  <div className="points-row">
                    <div className="points-num">{stats?.points?.toLocaleString() || 0}</div>
                    <div className="points-sub">points earned</div>
                  </div>
                </div>
              </div>

              {/* ACTIVITY CARDS */}
              <div className="section-title">Your Activity</div>
              <div className="activity-cards">
                <div className="activity-card">
                  <div className="activity-icon">♻</div>
                  <div className="activity-label">Recycled Items</div>
                  <div className="activity-value green">{stats?.recycledKg || 0} kg</div>
                </div>
                <div className="activity-card">
                  <div className="activity-icon">🌴</div>
                  <div className="activity-label">Trees Planted</div>
                  <div className="activity-value green">{stats?.treesPlanted || 0}</div>
                </div>
                <div className="activity-card">
                  <div className="activity-icon">🛡</div>
                  <div className="activity-label">Waste Reduced</div>
                  <div className="activity-value green">{stats?.wasteReduced || 0}%</div>
                </div>
              </div>

              {/* QUICK ACTIONS */}
              <div className="section-title">Quick Actions</div>
              <div className="bottom-cards">

                <div className="bottom-card">
                  <h3>📦 Schedule a Request</h3>
                  <p>Easily schedule a new waste collection or recycling service with just a few clicks.</p>
                  <button className="schedule-btn" onClick={() => navigate("/new-request")}>Schedule Now →</button>
                </div>

                <div className="bottom-card">
                  <h3>💬 Your Complaints</h3>
                  <p>View the status and details of your submitted complaints and feedback.</p>
                  <button className="outline-btn" onClick={() => navigate("/complaints")}>View Complaints →</button>
                </div>

                {/* PAYMENT CARD */}
                <div className="bottom-card payment-card">
                  <div className="payment-card-top">
                    <h3>💳 Payments</h3>
                    {latestPayment && (
                      <span className={`payment-status-badge ${
                        latestPayment.status === "overdue"  ? "payment-overdue"  :
                        latestPayment.status === "pending"  ? "payment-pending"  : ""
                      }`}>
                        {latestPayment.status}
                      </span>
                    )}
                  </div>

                  {latestPayment ? (
                    <div className="payment-info">
                      <div className="payment-amount-row">
                        <span className="payment-currency">Rs.</span>
                        <span className="payment-amount">
                          {Number(latestPayment.amount).toLocaleString()}
                        </span>
                      </div>
                      <div className="payment-meta">
                        <span>📅 Due: {new Date(latestPayment.due_date).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric"
                        })}</span>
                        <span>📋 {latestPayment.description || "Monthly waste fee"}</span>
                      </div>
                      <p className="pending-bills-note">
                        ⚠️ You have <strong>{pendingBills}</strong> unpaid bill{pendingBills > 1 ? "s" : ""}.
                      </p>
                    </div>
                  ) : (
                    <div className="payment-empty">
                      <span className="payment-empty-icon">✅</span>
                      <p className="no-bills-note">No pending bills. You're all clear!</p>
                    </div>
                  )}

                  <button
                    className={latestPayment ? "pay-now-quick-btn" : "text-btn"}
                    onClick={() => navigate("/payment")}
                  >
                    {latestPayment ? "Pay Now →" : "View Payments →"}
                  </button>
                </div>

              </div>
            </>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="footer-logo">
              <div className="logo-icon" style={{width:"32px",height:"32px",fontSize:"16px"}}>♻</div>
              <span className="logo-text">EcoConnect</span>
            </div>
            <p>Connecting communities for a greener future.</p>
            <p className="copyright">© 2025 EcoConnect. All rights reserved.</p>
          </div>
          <div className="footer-links">
            <h4>Quick Links</h4>
            <a href="#">Dashboard</a>
            <a href="#">New Request</a>
            <a href="#">Complaints</a>
            <a href="#">About Us</a>
            <a href="#">Privacy Policy</a>
          </div>
          <div className="footer-connect">
            <h4>Connect</h4>
            <div className="social-icons">🐦 💼 📷</div>
            <p>info@ecoconnect.com</p>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default CitizenDashboard;
