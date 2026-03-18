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
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) { navigate("/login"); return; }
    const parsedUser = JSON.parse(savedUser);
    setUser(parsedUser);
    fetchDashboardData(parsedUser.id);
  }, []);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = async (userId) => {
    try {
      const dashRes = await fetch(`http://localhost:5001/api/citizen/dashboard/${userId}`);
      const data = await dashRes.json();
      setStats(data.stats);
      setLatestPayment(data.latestPayment || null);
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
    if (points >= 5000) return { rank: "A+++", color: "#f59e0b", desc: "Legendary Eco Champion", icon: "🏆" };
    if (points >= 3000) return { rank: "A++",  color: "#10b981", desc: "Outstanding Contributor", icon: "🌟" };
    if (points >= 1000) return { rank: "A+",   color: "#3b82f6", desc: "Green City Leader",       icon: "🌿" };
    return                     { rank: "B",    color: "#8b5cf6", desc: "Rising Eco Citizen",       icon: "🌱" };
  };

  const getGreeting = () => {
    const h = currentTime.getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const formatTime = () => currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: true
  });

  const formatDay = () => currentTime.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  });

  const ecoRank = stats ? getEcoRank(stats.points) : { rank: "—", color: "#6b7280", desc: "Loading...", icon: "⏳" };

  const navItems = [
    { id: "dashboard",  icon: "▦",  label: "Dashboard",   path: null          },
    { id: "request",    icon: "+",  label: "New Request", path: "/new-request" },
    { id: "complaints", icon: "⚑",  label: "Complaints",  path: "/complaints"  },
    { id: "payment",    icon: "₨",  label: "Payments",    path: "/payment",
      badge: pendingBills > 0 ? pendingBills : null },
  ];

  return (
    <div className="db-root">

      {/* ══════════════ NAVBAR ══════════════ */}
      <nav className="db-navbar">
        <div className="db-nav-brand">
          <div className="db-logo-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
            </svg>
          </div>
          <span className="db-brand-name">EcoConnect</span>
        </div>

        <div className="db-nav-center">
          <div className="db-clock-pill">
            <span className="db-clock-time">{formatTime()}</span>
            <span className="db-clock-sep">·</span>
            <span className="db-clock-date">{formatDay()}</span>
          </div>
        </div>

        <div className="db-nav-right">
          <div className="db-user-chip">
            <div className="db-user-avatar">
              {user?.image
                ? <img src={`http://localhost:5001/uploads/${user.image}`} alt="avatar" />
                : <span>{user?.name?.[0]?.toUpperCase() || "U"}</span>}
            </div>
            <div className="db-user-info">
              <span className="db-user-name">{user?.name || "User"}</span>
              <span className="db-user-role">Citizen</span>
            </div>
          </div>
          <button className="db-logout-btn" onClick={handleLogout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            Logout
          </button>
        </div>
      </nav>

      <div className="db-body">

        {/* ══════════════ SIDEBAR ══════════════ */}
        <aside className="db-sidebar">
          <div className="db-sidebar-top">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`db-nav-item ${activeMenu === item.id ? "db-nav-active" : ""}`}
                onClick={() => { setActiveMenu(item.id); if (item.path) navigate(item.path); }}
              >
                <span className="db-nav-icon">{item.icon}</span>
                <span className="db-nav-label">{item.label}</span>
                {item.badge && <span className="db-nav-badge">{item.badge}</span>}
              </button>
            ))}
          </div>

          {/* Eco score mini card in sidebar */}
          <div className="db-sidebar-eco">
            <div className="db-eco-glow" style={{ background: ecoRank.color }}></div>
            <div className="db-eco-rank-icon">{ecoRank.icon}</div>
            <div className="db-eco-rank-label">Eco Rank</div>
            <div className="db-eco-rank-val" style={{ color: ecoRank.color }}>{ecoRank.rank}</div>
            <div className="db-eco-rank-desc">{ecoRank.desc}</div>
            <div className="db-eco-pts">
              <span className="db-eco-pts-num">{stats?.points?.toLocaleString() || "0"}</span>
              <span className="db-eco-pts-unit">pts</span>
            </div>
          </div>

          <div className="db-sidebar-quote">
            <div className="db-quote-line"></div>
            <p>"The best way to reduce waste is to not produce it."</p>
          </div>
        </aside>

        {/* ══════════════ MAIN ══════════════ */}
        <main className="db-main">
          {loading ? (
            <div className="db-loading">
              <div className="db-spinner"></div>
              <p>Loading your dashboard...</p>
            </div>
          ) : (
            <>
              {/* ── HERO BANNER ── */}
              <div className="db-hero">
                <div className="db-hero-bg-dots"></div>
                <div className="db-hero-content">
                  <div className="db-hero-left">
                    <p className="db-greeting-tag">{getGreeting()} 👋</p>
                    <h1 className="db-hero-title">
                      Welcome back,<br />
                      <span className="db-hero-name">{user?.name?.split(" ")[0] || "Citizen"}</span>
                    </h1>
                    <p className="db-hero-sub">
                      Here's your environmental impact at a glance.
                      Keep making a difference, one step at a time.
                    </p>
                    <button className="db-hero-cta" onClick={() => navigate("/new-request")}>
                      Schedule Pickup
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                      </svg>
                    </button>
                  </div>
                  <div className="db-hero-right">
                    <div className="db-hero-rank-card">
                      <div className="db-rank-ring" style={{ borderColor: ecoRank.color }}>
                        <span className="db-rank-icon-big">{ecoRank.icon}</span>
                        <span className="db-rank-letter" style={{ color: ecoRank.color }}>{ecoRank.rank}</span>
                      </div>
                      <p className="db-rank-desc-hero">{ecoRank.desc}</p>
                      <div className="db-rank-pts-hero">
                        <span style={{ color: ecoRank.color, fontWeight: 800, fontSize: "22px" }}>
                          {stats?.points?.toLocaleString() || 0}
                        </span>
                        <span style={{ color: "#9ca3af", fontSize: "13px" }}> points earned</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── STATS STRIP ── */}
              <div className="db-stats-strip">
                {[
                  { icon: "♻️", label: "Recycled",      value: `${stats?.recycledKg || 0} kg`,  color: "#10b981" },
                  { icon: "🌴", label: "Trees Planted",  value: stats?.treesPlanted || 0,         color: "#f59e0b" },
                  { icon: "🛡️", label: "Waste Reduced",  value: `${stats?.wasteReduced || 0}%`,   color: "#3b82f6" },
                  { icon: "📦", label: "Total Requests", value: Math.floor((stats?.points || 0) / 100), color: "#8b5cf6" },
                ].map((s, i) => (
                  <div className="db-stat-card" key={i} style={{ animationDelay: `${i * 0.1}s` }}>
                    <div className="db-stat-icon">{s.icon}</div>
                    <div className="db-stat-body">
                      <div className="db-stat-val" style={{ color: s.color }}>{s.value}</div>
                      <div className="db-stat-label">{s.label}</div>
                    </div>
                    <div className="db-stat-bar" style={{ background: s.color + "22" }}>
                      <div className="db-stat-fill" style={{ background: s.color }}></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── SECTION TITLE ── */}
              <div className="db-section-head">
                <h2 className="db-section-title">Quick Actions</h2>
                <div className="db-section-line"></div>
              </div>

              {/* ── ACTION CARDS ── */}
              <div className="db-action-grid">

                {/* Schedule Card */}
                <div className="db-action-card db-card-schedule">
                  <div className="db-card-icon-wrap">
                    <span>📦</span>
                  </div>
                  <div className="db-card-body">
                    <h3 className="db-card-title">Schedule a Pickup</h3>
                    <p className="db-card-desc">
                      Request a new waste collection or recycling service. Quick, easy, and tracked.
                    </p>
                  </div>
                  <button className="db-card-btn db-btn-primary" onClick={() => navigate("/new-request")}>
                    Schedule Now
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                    </svg>
                  </button>
                </div>

                {/* Complaints Card */}
                <div className="db-action-card db-card-complaints">
                  <div className="db-card-icon-wrap">
                    <span>⚑</span>
                  </div>
                  <div className="db-card-body">
                    <h3 className="db-card-title">Your Complaints</h3>
                    <p className="db-card-desc">
                      Track your submitted requests and complaints. See status updates in real time.
                    </p>
                  </div>
                  <button className="db-card-btn db-btn-outline" onClick={() => navigate("/complaints")}>
                    View All
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                    </svg>
                  </button>
                </div>

                {/* Payment Card */}
                <div className={`db-action-card db-card-payment ${latestPayment ? "db-card-payment-due" : ""}`}>
                  <div className="db-payment-header">
                    <div className="db-card-icon-wrap">
                      <span>₨</span>
                    </div>
                    {latestPayment && (
                      <span className={`db-pay-badge ${latestPayment.status === "overdue" ? "db-badge-overdue" : "db-badge-pending"}`}>
                        {latestPayment.status?.toUpperCase()}
                      </span>
                    )}
                  </div>

                  {latestPayment ? (
                    <div className="db-payment-body">
                      <div className="db-payment-amount-row">
                        <span className="db-pay-cur">Rs.</span>
                        <span className="db-pay-amt">{Number(latestPayment.amount).toLocaleString()}</span>
                      </div>
                      <div className="db-payment-meta">
                        <span>📅 Due: {new Date(latestPayment.due_date).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric"
                        })}</span>
                        <span>📋 {latestPayment.description || "Monthly waste fee"}</span>
                      </div>
                      <div className="db-payment-warning">
                        ⚠️ You have <strong>{pendingBills}</strong> unpaid bill{pendingBills > 1 ? "s" : ""}
                      </div>
                    </div>
                  ) : (
                    <div className="db-payment-clear">
                      <span className="db-clear-icon">✅</span>
                      <p>No pending bills — you're all clear!</p>
                    </div>
                  )}

                  <button
                    className={`db-card-btn ${latestPayment ? "db-btn-pay" : "db-btn-outline"}`}
                    onClick={() => navigate("/payment")}
                  >
                    {latestPayment ? "Pay Now" : "View Payments"}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                    </svg>
                  </button>
                </div>

              </div>
            </>
          )}
        </main>
      </div>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer className="db-footer">
        <div className="db-footer-top">
          <div className="db-footer-brand">
            <div className="db-footer-logo">
              <div className="db-logo-mark db-logo-mark-sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
                </svg>
              </div>
              <span className="db-footer-brand-name">EcoConnect</span>
            </div>
            <p className="db-footer-tagline">
              Connecting communities for a greener future.<br />
              Simplify your waste management and boost your eco-score.
            </p>
            <div className="db-footer-socials">
              {[
                { label: "𝕏",  href: "#" },
                { label: "in", href: "#" },
                { label: "▶",  href: "#" },
              ].map(s => (
                <a key={s.label} href={s.href} className="db-social-pill">{s.label}</a>
              ))}
            </div>
          </div>

          <div className="db-footer-col">
            <h4 className="db-footer-heading">Navigation</h4>
            <ul className="db-footer-links">
              {[
                { label: "Dashboard",   action: () => setActiveMenu("dashboard") },
                { label: "New Request", action: () => navigate("/new-request")   },
                { label: "Complaints",  action: () => navigate("/complaints")    },
                { label: "Payments",    action: () => navigate("/payment")       },
              ].map(l => (
                <li key={l.label}>
                  <button className="db-footer-link-btn" onClick={l.action}>{l.label}</button>
                </li>
              ))}
            </ul>
          </div>

          <div className="db-footer-col">
            <h4 className="db-footer-heading">Company</h4>
            <ul className="db-footer-links">
              {["About Us", "Privacy Policy", "Terms of Service", "Help Center", "Contact"].map(l => (
                <li key={l}><a href="#" className="db-footer-link">{l}</a></li>
              ))}
            </ul>
          </div>

          <div className="db-footer-col">
            <h4 className="db-footer-heading">Contact</h4>
            <div className="db-footer-contact">
              <div className="db-contact-row">
                <span>✉️</span>
                <span>info@ecoconnect.com</span>
              </div>
              <div className="db-contact-row">
                <span>📞</span>
                <span>+977 01-4XXXXXX</span>
              </div>
              <div className="db-contact-row">
                <span>📍</span>
                <span>Kathmandu, Nepal</span>
              </div>
            </div>
          </div>
        </div>

        <div className="db-footer-bottom">
          <span>© 2025 EcoConnect. All rights reserved.</span>
          <div className="db-footer-bottom-links">
            <a href="#">Privacy</a>
            <span>·</span>
            <a href="#">Terms</a>
            <span>·</span>
            <a href="#">Cookies</a>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default CitizenDashboard;
