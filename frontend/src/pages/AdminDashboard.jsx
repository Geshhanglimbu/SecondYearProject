import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu]   = useState("dashboard");
  const [complaints, setComplaints]   = useState([]);
  const [citizens, setCitizens]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [tabFilter, setTabFilter]     = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [successMsg, setSuccessMsg]   = useState("");
  const [adminUser, setAdminUser]     = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const itemsPerPage = 10;

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { navigate("/login"); return; }
    setAdminUser(JSON.parse(stored));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = () => currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  const formatDay  = () => currentTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const fetchComplaints = async () => {
    try {
      const res  = await fetch("http://localhost:5001/api/admin/requests");
      const data = await res.json();
      setComplaints(Array.isArray(data) ? data : []);
    } catch (err) { setComplaints([]); }
    finally { setLoading(false); }
  };

  const fetchCitizens = async () => {
    try {
      const res  = await fetch("http://localhost:5001/api/admin/citizens");
      const data = await res.json();
      setCitizens(Array.isArray(data) ? data : []);
    } catch (err) { setCitizens([]); }
  };

  useEffect(() => { fetchComplaints(); fetchCitizens(); }, []);

  const updateStatus = async (id, status) => {
    try {
      await fetch(`http://localhost:5001/api/admin/requests/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setComplaints(prev => prev.map(c => c.id === id ? { ...c, status } : c));
      setSuccessMsg(`Request ${status} successfully!`);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch { alert("Failed to update status."); }
  };

  const handleLogout = () => { localStorage.removeItem("user"); navigate("/login"); };

  const totalCount    = complaints.length;
  const pendingCount  = complaints.filter(c => (c.status || "pending").toLowerCase() === "pending").length;
  const acceptedCount = complaints.filter(c => (c.status || "").toLowerCase() === "accepted").length;
  const declinedCount = complaints.filter(c => ["rejected","declined"].includes((c.status||"").toLowerCase())).length;

  const filtered = complaints.filter(c => {
    const s = (c.status || "pending").toLowerCase();
    const matchTab =
      tabFilter === "all"      ? true :
      tabFilter === "pending"  ? s === "pending" :
      tabFilter === "accepted" ? s === "accepted" :
      tabFilter === "declined" ? (s === "rejected" || s === "declined") : true;
    const q = search.toLowerCase();
    const matchSearch = !q || (
      String(c.id).includes(q) ||
      (c.citizen_name||c.user_name||"").toLowerCase().includes(q) ||
      (c.type||"").toLowerCase().includes(q) ||
      (c.location||"").toLowerCase().includes(q)
    );
    return matchTab && matchSearch;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated  = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  };

  const getStatusClass = (status) => {
    const s = (status || "pending").toLowerCase();
    if (s === "pending")  return "adm-badge-pending";
    if (s === "accepted") return "adm-badge-accepted";
    if (s === "rejected" || s === "declined") return "adm-badge-declined";
    return "adm-badge-pending";
  };

  const getStatusLabel = (status) => {
    const s = (status || "pending").toLowerCase();
    if (s === "rejected") return "Declined";
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  if (loading) return (
    <div className="adm-loading">
      <div className="adm-spinner"></div>
      <p>Loading admin dashboard...</p>
    </div>
  );

  const navItems = [
    { key: "dashboard",  icon: "▦",  label: "Dashboard"  },
    { key: "complaints", icon: "⚑",  label: "Complaints", badge: pendingCount > 0 ? pendingCount : null },
    { key: "citizens",   icon: "👤", label: "Citizens"   },
  ];

  return (
    <div className="adm-root">

      {/* ══════ NAVBAR ══════ */}
      <nav className="adm-navbar">
        <div className="adm-nav-brand">
          <div className="adm-logo-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
            </svg>
          </div>
          <span className="adm-brand-name">EcoConnect</span>
        </div>

        <div className="adm-clock-pill">
          <span className="adm-clock-time">{formatTime()}</span>
          <span className="adm-clock-sep">·</span>
          <span className="adm-clock-date">{formatDay()}</span>
        </div>

        <div className="adm-nav-right">
          <div className="adm-user-chip">
            <div className="adm-user-avatar">
              {adminUser?.image
                ? <img src={`http://localhost:5001/uploads/${adminUser.image}`} alt="avatar" />
                : <span>{adminUser?.name?.[0]?.toUpperCase() || "A"}</span>
              }
            </div>
            <div className="adm-user-info">
              <span className="adm-user-name">{adminUser?.name || "Admin"}</span>
              <span className="adm-user-role">Admin</span>
            </div>
          </div>
          <button className="adm-logout-btn" onClick={handleLogout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            Logout
          </button>
        </div>
      </nav>

      <div className="adm-body">

        {/* ══════ SIDEBAR ══════ */}
        <aside className="adm-sidebar">
          <div className="adm-sidebar-top">
            {navItems.map(item => (
              <button
                key={item.key}
                className={`adm-nav-item ${activeMenu === item.key ? "adm-nav-active" : ""}`}
                onClick={() => { setActiveMenu(item.key); setCurrentPage(1); }}
              >
                <span className="adm-nav-icon">{item.icon}</span>
                <span className="adm-nav-label">{item.label}</span>
                {item.badge && <span className="adm-nav-badge">{item.badge}</span>}
              </button>
            ))}
          </div>

          <div className="adm-sidebar-info">
            <div className="adm-info-icon">🛡️</div>
            <div className="adm-info-label">Admin Panel</div>
            <div className="adm-info-sub">Full system access</div>
          </div>

          <div className="adm-sidebar-quote">
            <div className="adm-quote-line"></div>
            <p>"Manage waste, build a better tomorrow."</p>
          </div>
        </aside>

        {/* ══════ MAIN ══════ */}
        <main className="adm-main">
          {successMsg && <div className="adm-toast">✅ {successMsg}</div>}

          {/* DASHBOARD VIEW */}
          {activeMenu === "dashboard" && (
            <>
              {/* Hero Banner */}
              <div className="adm-hero">
                <div className="adm-hero-dots"></div>
                <div className="adm-hero-content">
                  <div>
                    <p className="adm-hero-tag">Welcome back</p>
                    <h1 className="adm-hero-title">
                      Hello, <span className="adm-hero-name">{adminUser?.name?.split(" ")[0] || "Admin"}</span>
                    </h1>
                    <p className="adm-hero-sub">Here's an overview of all citizen complaints and system activity.</p>
                  </div>
                  <div className="adm-hero-right">
                    <div className="adm-hero-stat-big">
                      <span className="adm-hero-num">{totalCount}</span>
                      <span className="adm-hero-label">Total Complaints</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Strip */}
              <div className="adm-stats-strip">
                {[
                  { icon: "💬", label: "Total",    value: totalCount,    color: "#3b82f6" },
                  { icon: "🕐", label: "Pending",  value: pendingCount,  color: "#f59e0b" },
                  { icon: "✅", label: "Accepted", value: acceptedCount, color: "#22c55e" },
                  { icon: "❌", label: "Declined", value: declinedCount, color: "#ef4444" },
                ].map((s, i) => (
                  <div className="adm-stat-card" key={i} style={{ animationDelay: `${i * 0.1}s` }}>
                    <div className="adm-stat-icon">{s.icon}</div>
                    <div className="adm-stat-body">
                      <div className="adm-stat-val" style={{ color: s.color }}>{s.value}</div>
                      <div className="adm-stat-label">{s.label}</div>
                    </div>
                    <div className="adm-stat-bar" style={{ background: s.color + "22" }}>
                      <div className="adm-stat-fill" style={{ background: s.color, width: totalCount > 0 ? `${(s.value/totalCount)*100}%` : "0%" }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* COMPLAINTS TABLE — shown on both dashboard and complaints tab */}
          {(activeMenu === "dashboard" || activeMenu === "complaints") && (
            <div className="adm-table-section">
              <div className="adm-section-head">
                <h2 className="adm-section-title">Complaint Requests</h2>
                <p className="adm-section-sub">Manage and triage citizen reported issues</p>
              </div>

              <div className="adm-search-wrap">
                <span className="adm-search-icon">🔍</span>
                <input
                  className="adm-search-input"
                  placeholder="Search by ID, citizen name, category or location..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                />
              </div>

              <div className="adm-tabs">
                {["all","pending","accepted","declined"].map(tab => (
                  <button
                    key={tab}
                    className={`adm-tab ${tabFilter === tab ? "adm-tab-active" : ""}`}
                    onClick={() => { setTabFilter(tab); setCurrentPage(1); }}
                  >
                    {tab === "all" ? "All Requests" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              <div className="adm-table-wrap">
                <table className="adm-table">
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
                      <tr><td colSpan="7">
                        <div className="adm-empty">
                          <span>📭</span>
                          <p>No complaints found</p>
                        </div>
                      </td></tr>
                    ) : paginated.map((c, i) => {
                      const s          = (c.status || "pending").toLowerCase();
                      const isPending  = s === "pending";
                      const isAccepted = s === "accepted";
                      const isDeclined = s === "rejected" || s === "declined";
                      return (
                        <tr key={c.id} className="adm-tr" style={{ animationDelay: `${i * 0.04}s` }}>
                          <td className="adm-col-id">#{String(c.id).padStart(3,"0")}</td>
                          <td className="adm-col-name">{c.citizen_name || c.user_name || "Unknown"}</td>
                          <td className="adm-col-cat"><span className="adm-cat-dot"></span>{c.type || "General"}</td>
                          <td className="adm-col-loc">📍 {c.location || "—"}</td>
                          <td className="adm-col-date">{formatDate(c.created_at)}</td>
                          <td><span className={`adm-status-badge ${getStatusClass(c.status)}`}>{getStatusLabel(c.status)}</span></td>
                          <td>
                            {isPending && (
                              <div className="adm-action-btns">
                                <button className="adm-btn-accept"  onClick={() => updateStatus(c.id, "accepted")}>✓</button>
                                <button className="adm-btn-decline" onClick={() => updateStatus(c.id, "declined")}>✕</button>
                                <button className="adm-btn-more">⋯</button>
                              </div>
                            )}
                            {(isAccepted || isDeclined) && (
                              <button className="adm-btn-reopen" onClick={() => updateStatus(c.id, "pending")}>↺ Reopen</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="adm-pagination">
                  <span className="adm-page-info">
                    Showing <strong>{(currentPage-1)*itemsPerPage+1}–{Math.min(currentPage*itemsPerPage, filtered.length)}</strong> of <strong>{filtered.length}</strong>
                  </span>
                  <div className="adm-page-btns">
                    <button className="adm-page-btn" onClick={() => setCurrentPage(p => Math.max(1,p-1))} disabled={currentPage===1}>Previous</button>
                    {Array.from({ length: Math.min(totalPages,5) },(_,i)=>i+1).map(p=>(
                      <button key={p} className={`adm-page-btn ${currentPage===p?"adm-page-active":""}`} onClick={()=>setCurrentPage(p)}>{p}</button>
                    ))}
                    <button className="adm-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages,p+1))} disabled={currentPage===totalPages}>Next</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CITIZENS VIEW */}
          {activeMenu === "citizens" && (
            <div className="adm-citizens-section">
              <div className="adm-section-head">
                <h2 className="adm-section-title">Registered Citizens</h2>
                <p className="adm-section-sub">All citizens registered in the EcoConnect system</p>
              </div>
              <div className="adm-citizens-chip">👥 {citizens.length} Total Citizens</div>
              <div className="adm-citizens-grid">
                {citizens.length === 0 ? (
                  <div className="adm-empty"><span>👤</span><p>No citizens found</p></div>
                ) : citizens.map((citizen, i) => (
                  <div key={citizen.id} className="adm-citizen-card" style={{ animationDelay: `${i*0.05}s` }}>
                    <div className="adm-citizen-avatar">
                      {citizen.image
                        ? <img src={`http://localhost:5001/uploads/${citizen.image}`} alt="avatar"/>
                        : <span>{(citizen.name||"?")[0].toUpperCase()}</span>
                      }
                    </div>
                    <div className="adm-citizen-info">
                      <h4>{citizen.name || "Unknown"}</h4>
                      <p>{citizen.email || "—"}</p>
                      <span>Joined: {formatDate(citizen.created_at)}</span>
                    </div>
                    <div className="adm-citizen-count">
                      <span className="adm-citizen-num">{complaints.filter(c => c.user_id === citizen.id).length}</span>
                      <span className="adm-citizen-lbl">Requests</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ══════ FOOTER ══════ */}
      <footer className="adm-footer">
        <div className="adm-footer-inner">
          <div className="adm-footer-brand">
            <div className="adm-footer-logo-row">
              <div className="adm-logo-mark adm-logo-sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
                </svg>
              </div>
              <span className="adm-footer-brand-name">EcoConnect</span>
            </div>
            <p className="adm-footer-tagline">Connecting communities for a greener future. Simplify your waste management and boost your eco-score.</p>
            <div className="adm-footer-socials">
              {["𝕏","in","▶"].map(s => <a key={s} href="#" className="adm-social-pill">{s}</a>)}
            </div>
          </div>
          <div className="adm-footer-col">
            <h4>Navigation</h4>
            <ul>
              {["Dashboard","Complaints","Citizens"].map(l => (
                <li key={l}><a href="#">{l}</a></li>
              ))}
            </ul>
          </div>
          <div className="adm-footer-col">
            <h4>Company</h4>
            <ul>
              {["About Us","Privacy Policy","Terms of Service","Help Center"].map(l => (
                <li key={l}><a href="#">{l}</a></li>
              ))}
            </ul>
          </div>
          <div className="adm-footer-col">
            <h4>Contact</h4>
            <div className="adm-footer-contact">
              <div>✉️ info@ecoconnect.com</div>
              <div>📞 +977 01-4XXXXXX</div>
              <div>📍 Kathmandu, Nepal</div>
            </div>
          </div>
        </div>
        <div className="adm-footer-bottom">
          <span>© 2025 EcoConnect. All rights reserved.</span>
          <div><a href="#">Privacy</a> · <a href="#">Terms</a> · <a href="#">Cookies</a></div>
        </div>
      </footer>

    </div>
  );
}
