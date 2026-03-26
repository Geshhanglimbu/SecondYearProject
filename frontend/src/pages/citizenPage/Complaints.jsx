import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Complaints.css";

export default function Complaints() {
  const navigate = useNavigate();
  const [user, setUser]                 = useState(null);
  const [complaints, setComplaints]     = useState([]);
  const [filtered, setFiltered]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy]             = useState("date");
  const [activeMenu, setActiveMenu]     = useState("complaints");
  const [showModal, setShowModal]       = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [successMsg, setSuccessMsg]     = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { navigate("/login"); return; }
    const u = JSON.parse(stored);
    setUser(u);
    fetchRequests(u.id);
  }, []);

  const fetchRequests = async (userId) => {
    try {
      const res  = await fetch(`http://localhost:5001/api/requests/${userId}`);
      const data = await res.json();
      const safe = Array.isArray(data) ? data : [];
      setComplaints(safe);
      setFiltered(safe);
    } catch (err) {
      console.error("Failed to fetch requests:", err);
      setComplaints([]);
      setFiltered([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let result = [...complaints];
    if (statusFilter !== "all") {
      result = result.filter(c => (c.status || "pending").toLowerCase() === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        (c.type        || "").toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q) ||
        (c.location    || "").toLowerCase().includes(q)
      );
    }
    if (sortBy === "date")   result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (sortBy === "status") result.sort((a, b) => (a.status || "").localeCompare(b.status || ""));
    if (sortBy === "type")   result.sort((a, b) => (a.type   || "").localeCompare(b.type   || ""));
    setFiltered(result);
  }, [search, statusFilter, sortBy, complaints]);

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`http://localhost:5001/api/requests/${id}`, { method: "DELETE" });
      const data = await res.json();
      setComplaints(prev => prev.filter(c => c.id !== id));
      setShowModal(false);
      setDeleteTarget(null);
      setSuccessMsg("Request deleted successfully!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Delete failed. Check your backend.");
    }
  };

  const handleDeleteAll = async () => {
    if (!user) return;
    try {
      await fetch(`http://localhost:5001/api/requests/all/${user.id}`, { method: "DELETE" });
      setComplaints([]);
      setShowModal(false);
      setSuccessMsg("All requests deleted!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Delete all failed:", err);
      alert("Delete all failed. Check your backend.");
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" }) +
      "  " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  /* ── Status badge class ── */
  const getStatusClass = (status) => {
    const s = (status || "pending").toLowerCase();
    if (s === "completed")   return "status-completed";
    if (s === "resolved")    return "status-resolved";
    if (s === "rejected" || s === "declined") return "status-rejected";
    if (s === "accepted")    return "status-accepted";
    if (s === "in_progress") return "status-inprogress";
    return "status-pending";
  };

  /* ── Status label shown to citizen ── */
  const getStatusLabel = (status) => {
    const s = (status || "pending").toLowerCase();
    if (s === "in_progress") return "In Progress";
    if (s === "accepted")    return "Accepted";
    if (s === "completed")   return "Completed ✓";
    if (s === "resolved")    return "Resolved ✓";
    if (s === "rejected" || s === "declined") return "Declined";
    return "Pending";
  };

  const getTypeIcon = (type) => {
    const t = (type || "").toLowerCase();
    if (t.includes("recycle")) return "♻️";
    if (t.includes("medical")) return "🏥";
    if (t.includes("hazard"))  return "⚠️";
    if (t.includes("bulky"))   return "📦";
    return "🗑️";
  };

  const pendingCount     = complaints.filter(c => (c.status || "pending").toLowerCase() === "pending").length;
  const inProgressCount  = complaints.filter(c => (c.status || "").toLowerCase() === "in_progress").length;
  const completedCount   = complaints.filter(c => ["completed","resolved"].includes((c.status || "").toLowerCase())).length;

  if (loading) return (
    <div className="complaints-loading">
      <div className="loading-spinner"></div>
      <p>Loading your requests...</p>
    </div>
  );

  return (
    <div className="complaints-layout">

      <nav className="complaints-navbar">
        <div className="nav-brand">
          <div className="nav-logo">♻</div>
          <span className="nav-title">EcoConnect</span>
        </div>
        <div className="nav-user">
          <span className="nav-greeting">Hello {user?.name?.split(" ")[0]}</span>
          <div className="nav-avatar">
            {user?.image
              ? <img src={`http://localhost:5001/uploads/${user.image}`} alt="avatar" />
              : <span>{user?.name?.[0]?.toUpperCase()}</span>
            }
          </div>
        </div>
      </nav>

      <div className="complaints-body">

        <aside className="complaints-sidebar">
          <nav className="sidebar-nav">
            {[
              { key: "dashboard",  icon: "⊞", label: "Dashboard",  path: "/dashboard"   },
              { key: "newrequest", icon: "+",  label: "New Request", path: "/new-request" },
              { key: "complaints", icon: "⚑",  label: "Complaints", path: "/complaints"  },
              { key: "payments",   icon: "💳", label: "Payments",   path: "/payment"     },
              { key: "feedback",   icon: "✦",  label: "Feedback",   path: "/Feedback"    },
               { key: "leaderboard",   icon: "🏆",  label: "Leaderboard",   path: "/leaderboard"    },
                { key: "profile",   icon: "👤",  label: "Profile",   path: "/profile"    },

            ].map(item => (
              <button
                key={item.key}
                className={`sidebar-item ${activeMenu === item.key ? "sidebar-active" : ""}`}
                onClick={() => { setActiveMenu(item.key); navigate(item.path); }}
              >
                <span className="sidebar-icon">{item.icon}</span>
                <span className="sidebar-label">{item.label}</span>
                {item.key === "complaints" && pendingCount > 0 && (
                  <span className="sidebar-badge">{pendingCount}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-quote-card">
            <div className="quote-image">🌍</div>
            <p className="quote-text">"The best way to reduce waste is not to produce it."</p>
          </div>
        </aside>

        <main className="complaints-main">

          {successMsg && <div className="success-toast">✅ {successMsg}</div>}

          <div className="complaints-header">
            <div className="header-left">
              <h1 className="page-title">Your Complaints Lists</h1>
              <div className="header-stats">
                <span className="stat-chip stat-total">{complaints.length} Total</span>
                <span className="stat-chip stat-pending">{pendingCount} Pending</span>
                {inProgressCount > 0 && (
                  <span className="stat-chip stat-inprogress">{inProgressCount} In Progress</span>
                )}
                <span className="stat-chip stat-done">{completedCount} Completed</span>
              </div>
            </div>
            <div className="header-actions">
              <button className="btn-new-request-nav" onClick={() => navigate("/new-request")}>
                <span>+</span> New Request
              </button>
              <button
                className="btn-delete-all"
                onClick={() => { setDeleteTarget("all"); setShowModal(true); }}
                disabled={complaints.length === 0}
              >
                <span>🗑</span> Delete Lists
              </button>
             
              <button 
                className="btn-new-request-nav" 
                onClick={() => fetchRequests(user.id)}
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          <div className="search-bar-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-bar"
              placeholder="Search complaints..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button className="search-clear" onClick={() => setSearch("")}>✕</button>}
          </div>

          <div className="filters-row">
            <div className="filter-group">
              <span className="filter-label">Filter by Status:</span>
              {["all", "pending", "accepted", "in_progress", "completed"].map(s => (
                <button
                  key={s}
                  className={`filter-btn ${statusFilter === s ? "filter-active" : ""}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <div className="filter-group">
              <span className="filter-label">Sort by:</span>
              {[
                { key: "date",   icon: "📅", label: "Date"   },
                { key: "type",   icon: "≡",  label: "Type"   },
                { key: "status", icon: "↕",  label: "Status" },
              ].map(s => (
                <button
                  key={s.key}
                  className={`filter-btn ${sortBy === s.key ? "filter-active" : ""}`}
                  onClick={() => setSortBy(s.key)}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="complaints-list">
            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <h3>No requests found</h3>
                <p>{search ? "Try a different search term" : "You haven't submitted any requests yet"}</p>
                <button className="btn-new-request-nav" onClick={() => navigate("/new-request")}>
                  + Make a New Request
                </button>
              </div>
            ) : (
              filtered.map((c, i) => (
                <div key={c.id} className="complaint-card" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="complaint-card-left">
                    <div className="complaint-number">#{String(i + 1).padStart(2, "0")}</div>
                    <div className="complaint-icon-wrap">
                      <span className="complaint-icon">{getTypeIcon(c.type)}</span>
                    </div>
                  </div>
                  <div className="complaint-card-body">
                    <h3 className="complaint-title">{c.type || "General Request"}</h3>
                    <p className="complaint-desc">{c.description || "No description provided."}</p>
                    <div className="complaint-meta">
                      {c.location && (
                        <span className="complaint-date">
                          <span className="meta-icon">📍</span> {c.location}
                        </span>
                      )}
                      {c.pickup_date && (
                        <span className="complaint-date">
                          <span className="meta-icon">📅</span> {c.pickup_date}{c.pickup_time ? ` at ${c.pickup_time}` : ""}
                        </span>
                      )}
                      <span className="complaint-date">
                        <span className="meta-icon">🕐</span> {formatDate(c.created_at)}
                      </span>
                      {/* Show who completed it if available */}
                      {c.completed_by && (
                        <span className="complaint-date">
                          <span className="meta-icon">👷</span> Completed by {c.completed_by}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="complaint-card-right">
                    <span className={`status-badge ${getStatusClass(c.status)}`}>
                      {getStatusLabel(c.status)}
                    </span>
                    {/* Only allow delete if not in progress or completed */}
                    {!["in_progress","completed","resolved"].includes((c.status||"").toLowerCase()) && (
                      <button
                        className="delete-btn"
                        onClick={() => { setDeleteTarget(c.id); setShowModal(true); }}
                        title="Delete this request"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

        </main>
      </div>

      <footer className="complaints-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="footer-logo-row">
              <div className="nav-logo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M3 6l3 1m0 0l-3 9a5 5 0 006.5 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5 5 0 006.5 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/>
                </svg>
              </div>
              <span className="footer-brand-name">EcoConnect</span>
            </div>
            <p className="footer-tagline">Connecting communities for a greener future.</p>
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

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">🗑️</div>
            <h3 className="modal-title">
              {deleteTarget === "all" ? "Delete All Requests?" : "Delete This Request?"}
            </h3>
            <p className="modal-desc">
              {deleteTarget === "all"
                ? "This will permanently delete ALL your requests. This cannot be undone."
                : "This request will be permanently removed."}
            </p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => { setShowModal(false); setDeleteTarget(null); }}>
                Cancel
              </button>
              <button
                className="modal-confirm"
                onClick={() => deleteTarget === "all" ? handleDeleteAll() : handleDelete(deleteTarget)}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
