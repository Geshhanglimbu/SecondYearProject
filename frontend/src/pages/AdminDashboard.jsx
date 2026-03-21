import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [complaints, setComplaints] = useState([]);
  const [citizens, setCitizens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tabFilter, setTabFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [successMsg, setSuccessMsg] = useState("");
  const itemsPerPage = 10;

  // Fetch all complaints from all users
  const fetchComplaints = async () => {
    try {
      const res = await fetch("http://localhost:5001/api/admin/requests");
      const data = await res.json();
      setComplaints(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch complaints:", err);
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all registered citizens
  const fetchCitizens = async () => {
    try {
      const res = await fetch("http://localhost:5001/api/admin/citizens");
      const data = await res.json();
      setCitizens(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch citizens:", err);
      setCitizens([]);
    }
  };

  useEffect(() => {
    fetchComplaints();
    fetchCitizens();
  }, []);

  // Update complaint status
  const updateStatus = async (id, status) => {
    try {
      await fetch(`http://localhost:5001/api/admin/requests/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setComplaints(prev =>
        prev.map(c => (c.id === id ? { ...c, status } : c))
      );
      setSuccessMsg(`Request ${status} successfully!`);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Status update failed:", err);
      alert("Failed to update status.");
    }
  };

  // Stats
  const totalCount    = complaints.length;
  const pendingCount  = complaints.filter(c => (c.status || "pending").toLowerCase() === "pending").length;
  const acceptedCount = complaints.filter(c => (c.status || "").toLowerCase() === "accepted").length;
  const declinedCount = complaints.filter(c => (c.status || "").toLowerCase() === "rejected" || (c.status || "").toLowerCase() === "declined").length;

  // Filter + search
  const filtered = complaints.filter(c => {
    const s = (c.status || "pending").toLowerCase();
    const matchTab =
      tabFilter === "all" ? true :
      tabFilter === "pending"  ? s === "pending" :
      tabFilter === "accepted" ? s === "accepted" :
      tabFilter === "declined" ? (s === "rejected" || s === "declined") :
      true;

    const q = search.toLowerCase();
    const matchSearch = !q || (
      String(c.id).includes(q) ||
      (c.citizen_name || c.user_name || "").toLowerCase().includes(q) ||
      (c.type         || "").toLowerCase().includes(q) ||
      (c.location     || "").toLowerCase().includes(q)
    );
    return matchTab && matchSearch;
  });

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated  = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  };

  const getStatusClass = (status) => {
    const s = (status || "pending").toLowerCase();
    if (s === "pending")  return "status-pending";
    if (s === "accepted") return "status-accepted";
    if (s === "rejected" || s === "declined") return "status-declined";
    return "status-pending";
  };

  const getStatusLabel = (status) => {
    const s = (status || "pending").toLowerCase();
    if (s === "rejected") return "Declined";
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  if (loading) return (
    <div className="admin-loading">
      <div className="admin-spinner"></div>
      <p>Loading admin dashboard...</p>
    </div>
  );

  return (
    <div className="admin-layout">

      {/* NAVBAR */}
      <nav className="admin-navbar">
        <div className="admin-nav-brand">
          <div className="admin-nav-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 6l3 1m0 0l-3 9a5 5 0 006.5 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5 5 0 006.5 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/>
            </svg>
          </div>
          <span className="admin-nav-title">EcoConnect</span>
        </div>
        <div className="admin-nav-right">
          <div className="admin-nav-user">
            <div className="admin-user-info">
              <span className="admin-user-name">Alex Morgan</span>
              <span className="admin-user-role">Head Administrator</span>
            </div>
            <div className="admin-avatar">AM</div>
          </div>
          <button className="admin-logout-btn" onClick={() => navigate("/login")}>
            <span>→</span> Logout
          </button>
        </div>
      </nav>

      <div className="admin-body">

        {/* SIDEBAR */}
        <aside className="admin-sidebar">
          <nav className="admin-sidebar-nav">
            {[
              { key: "dashboard",  icon: "⊞", label: "Dashboard"  },
              { key: "complaints", icon: "💬", label: "Complaints" },
              { key: "citizens",   icon: "👤", label: "Citizens"   },
            ].map(item => (
              <button
                key={item.key}
                className={`admin-sidebar-item ${activeMenu === item.key ? "admin-sidebar-active" : ""}`}
                onClick={() => { setActiveMenu(item.key); setCurrentPage(1); }}
              >
                <span className="admin-sidebar-icon">{item.icon}</span>
                <span className="admin-sidebar-label">{item.label}</span>
                {item.key === "complaints" && pendingCount > 0 && (
                  <span className="admin-sidebar-badge">{pendingCount}</span>
                )}
              </button>
            ))}
          </nav>
          <button className="admin-signout-btn" onClick={() => navigate("/login")}>
            <span>→</span> Sign Out
          </button>
        </aside>

        {/* MAIN CONTENT */}
        <main className="admin-main">
          {successMsg && <div className="admin-success-toast">✅ {successMsg}</div>}

          {/* DASHBOARD & COMPLAINTS VIEW */}
          {(activeMenu === "dashboard" || activeMenu === "complaints") && (
            <>
              {/* STATS CARDS */}
              {activeMenu === "dashboard" && (
                <div className="admin-stats-row">
                  <div className="stat-card stat-card-total">
                    <div className="stat-card-icon">💬</div>
                    <div className="stat-card-info">
                      <span className="stat-card-label">TOTAL COMPLAINTS</span>
                      <span className="stat-card-value">{totalCount.toLocaleString()}</span>
                      <span className="stat-card-change stat-up">+12%</span>
                    </div>
                  </div>
                  <div className="stat-card stat-card-pending">
                    <div className="stat-card-icon">🕐</div>
                    <div className="stat-card-info">
                      <span className="stat-card-label">PENDING</span>
                      <span className="stat-card-value">{pendingCount}</span>
                      <span className="stat-card-change stat-down">-5%</span>
                    </div>
                  </div>
                  <div className="stat-card stat-card-accepted">
                    <div className="stat-card-icon">✅</div>
                    <div className="stat-card-info">
                      <span className="stat-card-label">ACCEPTED</span>
                      <span className="stat-card-value">{acceptedCount}</span>
                      <span className="stat-card-change stat-up">+8%</span>
                    </div>
                  </div>
                  <div className="stat-card stat-card-declined">
                    <div className="stat-card-icon">❌</div>
                    <div className="stat-card-info">
                      <span className="stat-card-label">DECLINED</span>
                      <span className="stat-card-value">{declinedCount}</span>
                      <span className="stat-card-change stat-up">+2%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* COMPLAINTS TABLE */}
              <div className="admin-complaints-section">
                <div className="admin-section-header">
                  <h2 className="admin-section-title">Complaint Requests</h2>
                  <p className="admin-section-sub">Manage and triage citizen reported issues</p>
                </div>

                <div className="admin-search-wrap">
                  <span className="admin-search-icon">🔍</span>
                  <input
                    type="text"
                    className="admin-search-input"
                    placeholder="Search by complaint ID, citizen name, category or location..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                  />
                </div>

                <div className="admin-tabs">
                  {["all", "pending", "accepted", "declined"].map(tab => (
                    <button
                      key={tab}
                      className={`admin-tab ${tabFilter === tab ? "admin-tab-active" : ""}`}
                      onClick={() => { setTabFilter(tab); setCurrentPage(1); }}
                    >
                      {tab === "all" ? "All Requests" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>

                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Citizen Name</th>
                        <th>Category</th>
                        <th>Location</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="admin-empty-row">
                            <div className="admin-empty-state">
                              <span>📭</span>
                              <p>No complaints found</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginated.map((c, i) => {
                          const s = (c.status || "pending").toLowerCase();
                          const isPending  = s === "pending";
                          const isAccepted = s === "accepted";
                          const isDeclined = s === "rejected" || s === "declined";
                          return (
                            <tr key={c.id} className="admin-table-row" style={{ animationDelay: `${i * 0.04}s` }}>
                              <td className="col-id">#{String(c.id).padStart(3, "0")}</td>
                              <td className="col-name">{c.citizen_name || c.user_name || "Unknown"}</td>
                              <td className="col-category">
                                <span className="category-dot"></span>
                                {c.type || "General"}
                              </td>
                              <td className="col-location">
                                <span className="location-pin">📍</span>
                                {c.location || "—"}
                              </td>
                              <td className="col-date">{formatDate(c.created_at)}</td>
                              <td className="col-status">
                                <span className={`admin-status-badge ${getStatusClass(c.status)}`}>
                                  {getStatusLabel(c.status)}
                                </span>
                              </td>
                              <td className="col-actions">
                                {isPending && (
                                  <div className="action-btns">
                                    <button
                                      className="action-btn-accept"
                                      title="Accept"
                                      onClick={() => updateStatus(c.id, "accepted")}
                                    >✓</button>
                                    <button
                                      className="action-btn-decline"
                                      title="Decline"
                                      onClick={() => updateStatus(c.id, "declined")}
                                    >✕</button>
                                    <button className="action-btn-more" title="More">⋯</button>
                                  </div>
                                )}
                                {(isAccepted || isDeclined) && (
                                  <button
                                    className="action-btn-reopen"
                                    onClick={() => updateStatus(c.id, "pending")}
                                  >
                                    ↺ Reopen
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* PAGINATION */}
                {totalPages > 1 && (
                  <div className="admin-pagination">
                    <span className="pagination-info">
                      Showing <strong>{(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filtered.length)}</strong> of <strong>{filtered.length}</strong> results
                    </span>
                    <div className="pagination-btns">
                      <button
                        className="page-btn"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >Previous</button>
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                        <button
                          key={p}
                          className={`page-btn ${currentPage === p ? "page-btn-active" : ""}`}
                          onClick={() => setCurrentPage(p)}
                        >{p}</button>
                      ))}
                      <button
                        className="page-btn"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >Next</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* CITIZENS VIEW */}
          {activeMenu === "citizens" && (
            <div className="admin-citizens-section">
              <div className="admin-section-header">
                <h2 className="admin-section-title">Registered Citizens</h2>
                <p className="admin-section-sub">All citizens registered in the EcoConnect system</p>
              </div>
              <div className="citizens-stats">
                <span className="citizens-total-chip">👥 {citizens.length} Total Citizens</span>
              </div>
              <div className="citizens-grid">
                {citizens.length === 0 ? (
                  <div className="admin-empty-state">
                    <span>👤</span>
                    <p>No citizens found</p>
                  </div>
                ) : (
                  citizens.map((citizen, i) => (
                    <div key={citizen.id} className="citizen-card" style={{ animationDelay: `${i * 0.04}s` }}>
                      <div className="citizen-avatar">
                        {citizen.image
                          ? <img src={`http://localhost:5001/uploads/${citizen.image}`} alt="avatar" />
                          : <span>{(citizen.name || "?")[0].toUpperCase()}</span>
                        }
                      </div>
                      <div className="citizen-info">
                        <h4 className="citizen-name">{citizen.name || "Unknown"}</h4>
                        <p className="citizen-email">{citizen.email || "—"}</p>
                        <p className="citizen-joined">Joined: {formatDate(citizen.created_at)}</p>
                      </div>
                      <div className="citizen-complaint-count">
                        <span className="complaint-count-num">
                          {complaints.filter(c => c.user_id === citizen.id).length}
                        </span>
                        <span className="complaint-count-label">Complaints</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* FOOTER */}
      <footer className="admin-footer">
        <div className="admin-footer-inner">
          <div className="footer-brand">
            <div className="footer-logo-row">
              <div className="admin-nav-logo footer-logo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M3 6l3 1m0 0l-3 9a5 5 0 006.5 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5 5 0 006.5 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/>
                </svg>
              </div>
              <span className="footer-brand-name">EcoConnect</span>
            </div>
            <p className="footer-tagline">Connecting communities for a greener future. Simplify your waste management and boost your eco-score.</p>
            <p className="footer-copy">© 2025 EcoConnect. All rights reserved.</p>
          </div>
          <div className="footer-links">
            <h4>Quick Links</h4>
            <ul>
              {["Dashboard","New Request","Complaints","About Us","Privacy Policy","Terms of Service"].map(l => (
                <li key={l}><a href="#">{l}</a></li>
              ))}
            </ul>
          </div>
          <div className="footer-connect">
            <h4>Connect</h4>
            <div className="footer-socials">
              <a href="#" className="social-btn">𝕏</a>
              <a href="#" className="social-btn">in</a>
              <a href="#" className="social-btn">📸</a>
            </div>
            <p className="footer-email">info@ecoconnect.com</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
