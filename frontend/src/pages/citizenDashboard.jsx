import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./CitizenDashboard.css";

const CitizenDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get logged in user from localStorage
    const savedUser = localStorage.getItem("user");
    if (!savedUser) {
      navigate("/login");
      return;
    }
    const parsedUser = JSON.parse(savedUser);
    setUser(parsedUser);
    fetchDashboardData(parsedUser.id);
  }, []);

  const fetchDashboardData = async (userId) => {
    try {
      const res = await fetch(`http://localhost:5001/api/citizen/dashboard/${userId}`);
      const data = await res.json();
      setStats(data.stats);
      setRequests(data.recentRequests);
      setComplaints(data.recentComplaints);
      setSchedule(data.nextSchedule);
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
    if (points >= 5000) return { rank: "A+++", label: "Clean city, proud citizen. Your effort leads the way! 🏆" };
    if (points >= 3000) return { rank: "A++", label: "Outstanding contributor to a greener community!" };
    if (points >= 1000) return { rank: "A+", label: "Great job keeping your city clean!" };
    return { rank: "B", label: "Keep going! Every effort counts." };
  };

  const ecoRank = stats ? getEcoRank(stats.points) : { rank: "—", label: "Loading..." };

  return (
    <div className="dashboard-wrapper">

      {/* NAVBAR */}
      <nav className="navbar">
        <div className="nav-logo">
          <span className="logo-icon">♻</span>
          <span className="logo-text">EcoConnect</span>
        </div>
        <div className="nav-right">
          <span className="hello-text">Hello {user?.name || "User"}</span>
          <div className="avatar-circle">
            {user?.image ? (
              <img src={`http://localhost:5001/uploads/${user.image}`} alt="avatar" />
            ) : (
              <span>{user?.name?.[0]?.toUpperCase() || "U"}</span>
            )}
          </div>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <div className="main-content">

        {/* LEFT SIDEBAR */}
        <div className="sidebar">
          <div className="sidebar-menu">
            <div
              className={`menu-item ${activeMenu === "dashboard" ? "active" : ""}`}
              onClick={() => setActiveMenu("dashboard")}
            >
              <span className="menu-icon">📊</span> Dashboard
            </div>
            <div
              className={`menu-item ${activeMenu === "request" ? "active" : ""}`}
              onClick={() => { setActiveMenu("request"); navigate("/new-request"); }}
            >
              <span className="menu-icon">+</span> New Request
            </div>
            <div
              className={`menu-item ${activeMenu === "complaints" ? "active" : ""}`}
              onClick={() => { setActiveMenu("complaints"); navigate("/complaints"); }}
            >
              <span className="menu-icon">💬</span> Complaints
            </div>
            <div
              className={`menu-item ${activeMenu === "schedule" ? "active" : ""}`}
              onClick={() => { setActiveMenu("schedule"); navigate("/schedule"); }}
            >
              <span className="menu-icon">📅</span> Schedule
            </div>
          </div>

          <div className="sidebar-quote">
            <p>"The best way to reduce waste is to not produce it."</p>
          </div>
        </div>

        {/* RIGHT CONTENT */}
        <div className="content-area">

          {loading ? (
            <div className="loading">Loading your dashboard...</div>
          ) : (
            <>
              {/* ECO RANK CARD */}
              <div className="eco-rank-card">
                <h3>Your eco rank</h3>
                <div className="rank-badge">{ecoRank.rank}</div>
                <p className="rank-label">{ecoRank.label}</p>
                <hr />
                <p className="points-label">You have earned</p>
                <div className="points-value">{stats?.points?.toLocaleString() || 0} points</div>
              </div>

              {/* YOUR ACTIVITY */}
              <h2 className="section-title">Your Activity</h2>

              <div className="activity-cards">
                <div className="activity-card">
                  <div className="activity-icon recycle-icon">♻</div>
                  <p className="activity-label">Recycled Items</p>
                  <p className="activity-value green">{stats?.recycledKg || 0} kg</p>
                </div>
                <div className="activity-card">
                  <div className="activity-icon tree-icon">🌴</div>
                  <p className="activity-label">Trees Planted</p>
                  <p className="activity-value green">{stats?.treesPlanted || 0}</p>
                </div>
                <div className="activity-card">
                  <div className="activity-icon shield-icon">🛡</div>
                  <p className="activity-label">Waste Reduced</p>
                  <p className="activity-value green">{stats?.wasteReduced || 0}%</p>
                </div>
              </div>

              {/* BOTTOM CARDS */}
              <div className="bottom-cards">

                {/* Schedule a new request */}
                <div className="bottom-card">
                  <h3>Schedule a new Request</h3>
                  <p>Easily schedule a new waste collection or recycling service with just a few clicks.</p>
                  <button className="schedule-btn" onClick={() => navigate("/new-request")}>
                    Schedule Now →
                  </button>
                </div>

                {/* Your complaints */}
                <div className="bottom-card">
                  <h3>Your complaints</h3>
                  <p>View the status and details of your submitted complaints and feedback.</p>
                  <button className="outline-btn" onClick={() => navigate("/complaints")}>
                    View Complaints →
                  </button>
                </div>

                {/* Collection Status */}
                <div className="bottom-card">
                  <h3>Collection Status</h3>
                  <p>Keep track of your upcoming and past waste collection schedules.</p>
                  {schedule ? (
                    <p className="next-collection">
                      Next collection: {new Date(schedule.pickup_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  ) : (
                    <p className="next-collection">No upcoming collection</p>
                  )}
                  <button className="text-btn" onClick={() => navigate("/schedule")}>
                    Details →
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
              <span className="logo-icon">♻</span>
              <span className="logo-text">EcoConnect</span>
            </div>
            <p>Connecting communities for a greener future. Simplify your waste management and boost your eco-score.</p>
            <p className="copyright">© 2025 EcoConnect. All rights reserved.</p>
          </div>

          <div className="footer-links">
            <h4>Quick Links</h4>
            <a href="#">Dashboard</a>
            <a href="#">New Request</a>
            <a href="#">Complaints</a>
            <a href="#">About Us</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
          </div>

          <div className="footer-connect">
            <h4>Connect</h4>
            <div className="social-icons">
              <span>🐦</span>
              <span>💼</span>
              <span>📷</span>
            </div>
            <p>info@ecoconnect.com</p>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default CitizenDashboard;
