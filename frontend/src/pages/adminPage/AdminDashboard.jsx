import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";

const BASE = "http://localhost:5001";

/* ── Toast helper ── */
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, []);
  return (
    <div className={`adm-toast adm-toast-${type}`}>
      <span>{type === "success" ? "✓" : "✕"}</span>
      {msg}
    </div>
  );
}

/* ── Confirm Modal ── */
function ConfirmModal({ title, desc, onConfirm, onCancel }) {
  return (
    <div className="adm-overlay" onClick={onCancel}>
      <div className="adm-modal" onClick={e => e.stopPropagation()}>
        <div className="adm-modal-icon">⚠️</div>
        <h3>{title}</h3>
        <p>{desc}</p>
        <div className="adm-modal-btns">
          <button className="adm-modal-cancel" onClick={onCancel}>Cancel</button>
          <button className="adm-modal-confirm" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   GPS MAP PANEL — Uses Leaflet (free, no API key)
   ══════════════════════════════════════════════════════════ */
function GPSPanel({ staffLocations, staffList, loading }) {
  const mapRef    = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef({});

  useEffect(() => {
    if (leafletRef.current) return; // already init
    // Inject Leaflet CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id   = "leaflet-css";
      link.rel  = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    // Inject Leaflet JS
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      const L = window.L;
      const map = L.map(mapRef.current).setView([27.7172, 85.3240], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
      }).addTo(map);
      leafletRef.current = map;
    };
    document.head.appendChild(script);
  }, []);

  // Update markers whenever staffLocations change
  useEffect(() => {
    if (!leafletRef.current || !window.L) return;
    const L   = window.L;
    const map = leafletRef.current;

    staffLocations.forEach(loc => {
      const icon = L.divIcon({
        className: "",
        html: `<div class="adm-map-marker"><span>${loc.name?.[0] || "S"}</span></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      });

      const minutesAgo = Math.round((Date.now() - new Date(loc.updated_at)) / 60000);
      const popup = `
        <div class="adm-map-popup">
          <strong>${loc.name}</strong>
          <div>📍 ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}</div>
          <div>🕐 ${minutesAgo < 1 ? "Just now" : `${minutesAgo}m ago`}</div>
          ${loc.ward ? `<div>Ward: ${loc.ward}</div>` : ""}
        </div>
      `;

      if (markersRef.current[loc.staff_id]) {
        markersRef.current[loc.staff_id].setLatLng([loc.lat, loc.lng]).setPopupContent(popup);
      } else {
        const marker = L.marker([loc.lat, loc.lng], { icon }).addTo(map).bindPopup(popup);
        markersRef.current[loc.staff_id] = marker;
      }
    });
  }, [staffLocations]);

  const flyTo = (lat, lng) => {
    if (leafletRef.current) {
      leafletRef.current.flyTo([lat, lng], 16, { duration: 1.2 });
    }
  };

  return (
    <div className="adm-gps-wrap">
      <div className="adm-gps-sidebar">
        <div className="adm-gps-sidebar-head">
          <h3>Active Workers</h3>
          <span className="adm-gps-count">{staffLocations.length} tracked</span>
        </div>
        <div className="adm-gps-list">
          {staffList.length === 0 && (
            <div className="adm-gps-empty">No staff registered</div>
          )}
          {staffList.map(staff => {
            const loc = staffLocations.find(l => l.staff_id === staff.id);
            const minutesAgo = loc ? Math.round((Date.now() - new Date(loc.updated_at)) / 60000) : null;
            const isOnline   = minutesAgo !== null && minutesAgo < 10;
            return (
              <div
                key={staff.id}
                className={`adm-gps-worker ${loc ? "adm-gps-worker-active" : ""}`}
                onClick={() => loc && flyTo(loc.lat, loc.lng)}
              >
                <div className="adm-gps-worker-avatar">
                  {staff.name?.[0]?.toUpperCase() || "S"}
                  <span className={`adm-gps-dot ${isOnline ? "adm-gps-dot-online" : loc ? "adm-gps-dot-idle" : "adm-gps-dot-offline"}`} />
                </div>
                <div className="adm-gps-worker-info">
                  <strong>{staff.name}</strong>
                  {loc
                    ? <span>{minutesAgo < 1 ? "Just now" : `${minutesAgo}m ago`} · {loc.lat.toFixed(3)}, {loc.lng.toFixed(3)}</span>
                    : <span className="adm-gps-no-signal">No signal</span>
                  }
                </div>
                {loc && <button className="adm-gps-locate-btn" onClick={() => flyTo(loc.lat, loc.lng)}>🎯</button>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="adm-gps-map-wrap">
        {loading && <div className="adm-gps-loading">Loading map data…</div>}
        <div ref={mapRef} className="adm-gps-map" />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PAYMENT FORM MODAL
   ══════════════════════════════════════════════════════════ */
function PaymentModal({ citizens, onSubmit, onClose }) {
  const [form, setForm] = useState({ user_id: "", amount: "", description: "", due_date: "" });
  const [err, setErr]   = useState("");
  const set = (k, v)    => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.user_id || !form.amount || !form.description) { setErr("All fields required."); return; }
    await onSubmit(form);
    onClose();
  };

  return (
    <div className="adm-overlay" onClick={onClose}>
      <div className="adm-form-modal" onClick={e => e.stopPropagation()}>
        <div className="adm-form-modal-head">
          <div className="adm-form-modal-icon adm-icon-payment">💳</div>
          <h3>Issue Payment</h3>
          <button className="adm-form-close" onClick={onClose}>✕</button>
        </div>
        {err && <div className="adm-form-err">{err}</div>}
        <div className="adm-form-grid">
          <label>
            <span>Citizen</span>
            <select value={form.user_id} onChange={e => set("user_id", e.target.value)}>
              <option value="">Select citizen…</option>
              {citizens.map(c => <option key={c.id} value={c.id}>{c.name} — {c.email}</option>)}
            </select>
          </label>
          <label>
            <span>Amount (NPR)</span>
            <input type="number" min="0" placeholder="e.g. 500" value={form.amount} onChange={e => set("amount", e.target.value)} />
          </label>
          <label className="adm-form-full">
            <span>Description / Reason</span>
            <textarea rows={3} placeholder="Monthly waste collection fee…" value={form.description} onChange={e => set("description", e.target.value)} />
          </label>
          <label>
            <span>Due Date (optional)</span>
            <input type="date" value={form.due_date} onChange={e => set("due_date", e.target.value)} />
          </label>
        </div>
        <div className="adm-form-actions">
          <button className="adm-form-cancel" onClick={onClose}>Cancel</button>
          <button className="adm-form-submit adm-submit-payment" onClick={handleSubmit}>Issue Payment</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   FINE FORM MODAL
   ══════════════════════════════════════════════════════════ */
function FineModal({ citizens, onSubmit, onClose }) {
  const [form, setForm] = useState({ user_id: "", amount: "", reason: "", due_date: "" });
  const [err, setErr]   = useState("");
  const set = (k, v)    => setForm(p => ({ ...p, [k]: v }));

  const REASONS = [
    "Illegal dumping",
    "Missed collection day",
    "Improper waste segregation",
    "Burning waste",
    "Hazardous waste mishandling",
    "Littering in public area",
    "Other",
  ];

  const handleSubmit = async () => {
    if (!form.user_id || !form.amount || !form.reason) { setErr("All fields required."); return; }
    await onSubmit(form);
    onClose();
  };

  return (
    <div className="adm-overlay" onClick={onClose}>
      <div className="adm-form-modal" onClick={e => e.stopPropagation()}>
        <div className="adm-form-modal-head">
          <div className="adm-form-modal-icon adm-icon-fine">⚠️</div>
          <h3>Issue Fine</h3>
          <button className="adm-form-close" onClick={onClose}>✕</button>
        </div>
        {err && <div className="adm-form-err">{err}</div>}
        <div className="adm-form-grid">
          <label>
            <span>Citizen</span>
            <select value={form.user_id} onChange={e => set("user_id", e.target.value)}>
              <option value="">Select citizen…</option>
              {citizens.map(c => <option key={c.id} value={c.id}>{c.name} — {c.email}</option>)}
            </select>
          </label>
          <label>
            <span>Amount (NPR)</span>
            <input type="number" min="0" placeholder="e.g. 1000" value={form.amount} onChange={e => set("amount", e.target.value)} />
          </label>
          <label className="adm-form-full">
            <span>Reason</span>
            <select value={form.reason} onChange={e => set("reason", e.target.value)}>
              <option value="">Select reason…</option>
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label>
            <span>Due Date (optional)</span>
            <input type="date" value={form.due_date} onChange={e => set("due_date", e.target.value)} />
          </label>
        </div>
        <div className="adm-form-actions">
          <button className="adm-form-cancel" onClick={onClose}>Cancel</button>
          <button className="adm-form-submit adm-submit-fine" onClick={handleSubmit}>Issue Fine</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN ADMIN DASHBOARD
   ══════════════════════════════════════════════════════════ */
export default function AdminDashboard() {
  const navigate = useNavigate();

  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [adminUser, setAdminUser]   = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Data
  const [complaints, setComplaints] = useState([]);
  const [citizens, setCitizens]     = useState([]);
  const [payments, setPayments]     = useState([]);
  const [fines, setFines]           = useState([]);
  const [staffList, setStaffList]   = useState([]);
  const [gpsData, setGpsData]       = useState([]);

  // UI state
  const [loading, setLoading]       = useState(true);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [search, setSearch]         = useState("");
  const [tabFilter, setTabFilter]   = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast]           = useState(null);
  const [confirm, setConfirm]       = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showFineModal, setShowFineModal]       = useState(false);
  const [pfSearch, setPfSearch]     = useState("");
  const [pfTab, setPfTab]           = useState("all");

  const itemsPerPage = 10;

  const showToast = (msg, type = "success") => setToast({ msg, type });

  // Auth
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { navigate("/login"); return; }
    setAdminUser(JSON.parse(stored));
  }, []);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const formatTime = () => currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  const formatDay  = () => currentTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const formatDate = (d) => { if (!d) return "—"; return new Date(d).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }); };

  // Fetch all data
  const fetchAll = useCallback(async () => {
    try {
      const [req, cit, pay, fin, staff] = await Promise.all([
        fetch(`${BASE}/api/admin/requests`).then(r => r.json()),
        fetch(`${BASE}/api/admin/citizens`).then(r => r.json()),
        fetch(`${BASE}/api/admin/payments`).then(r => r.json()),
        fetch(`${BASE}/api/admin/fines`).then(r => r.json()),
        fetch(`${BASE}/api/admin/staff`).then(r => r.json()),
      ]);
      setComplaints(Array.isArray(req)   ? req   : []);
      setCitizens  (Array.isArray(cit)   ? cit   : []);
      setPayments  (Array.isArray(pay)   ? pay   : []);
      setFines     (Array.isArray(fin)   ? fin   : []);
      setStaffList (Array.isArray(staff) ? staff : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // GPS polling every 15s
  const fetchGPS = useCallback(async () => {
    try {
      const data = await fetch(`${BASE}/api/admin/gps`).then(r => r.json());
      setGpsData(Array.isArray(data) ? data : []);
    } catch { setGpsData([]); }
    finally { setGpsLoading(false); }
  }, []);

  useEffect(() => {
    fetchGPS();
    const t = setInterval(fetchGPS, 15000);
    return () => clearInterval(t);
  }, [fetchGPS]);

  /* ── Request actions ── */
  const updateStatus = async (id, status) => {
    try {
      await fetch(`${BASE}/api/admin/requests/${id}/status`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setComplaints(prev => prev.map(c => c.id === id ? { ...c, status } : c));
      showToast(`Request ${status} successfully!`);
    } catch { showToast("Failed to update request", "error"); }
  };

  /* ── Payment actions ── */
  const createPayment = async (form) => {
    try {
      const res  = await fetch(`${BASE}/api/admin/payments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      await fetchAll();
      showToast("Payment issued successfully!");
    } catch (e) { showToast(e.message || "Failed to create payment", "error"); }
  };

  const deletePayment = (id) => setConfirm({
    title: "Delete Payment?", desc: "This cannot be undone.",
    onConfirm: async () => {
      await fetch(`${BASE}/api/admin/payments/${id}`, { method: "DELETE" });
      setPayments(prev => prev.filter(p => p.id !== id));
      showToast("Payment deleted"); setConfirm(null);
    }
  });

  const markPaymentPaid = async (id) => {
    await fetch(`${BASE}/api/admin/payments/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });
    setPayments(prev => prev.map(p => p.id === id ? { ...p, status: "paid" } : p));
    showToast("Marked as paid!");
  };

  /* ── Fine actions ── */
  const createFine = async (form) => {
    try {
      const res  = await fetch(`${BASE}/api/admin/fines`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      await fetchAll();
      showToast("Fine issued successfully!");
    } catch (e) { showToast(e.message || "Failed to create fine", "error"); }
  };

  const deleteFine = (id) => setConfirm({
    title: "Delete Fine?", desc: "This cannot be undone.",
    onConfirm: async () => {
      await fetch(`${BASE}/api/admin/fines/${id}`, { method: "DELETE" });
      setFines(prev => prev.filter(f => f.id !== id));
      showToast("Fine deleted"); setConfirm(null);
    }
  });

  const markFinePaid = async (id) => {
    await fetch(`${BASE}/api/admin/fines/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });
    setFines(prev => prev.map(f => f.id === id ? { ...f, status: "paid" } : f));
    showToast("Fine marked as paid!");
  };

  const handleLogout = () => { localStorage.removeItem("user"); navigate("/login"); };

  /* ── Derived counts ── */
  const pendingCount  = complaints.filter(c => (c.status||"pending").toLowerCase() === "pending").length;
  const acceptedCount = complaints.filter(c => (c.status||"").toLowerCase() === "accepted").length;
  const declinedCount = complaints.filter(c => ["rejected","declined"].includes((c.status||"").toLowerCase())).length;

  const unpaidPayments = payments.filter(p => p.status === "unpaid").length;
  const unpaidFines    = fines.filter(f => f.status === "unpaid").length;
  const onlineStaff    = gpsData.filter(l => (Date.now() - new Date(l.updated_at)) < 600000).length;

  /* ── Complaints filter ── */
  const filteredComplaints = complaints.filter(c => {
    const s = (c.status||"pending").toLowerCase();
    const matchTab =
      tabFilter === "all"      ? true :
      tabFilter === "pending"  ? s === "pending" :
      tabFilter === "accepted" ? s === "accepted" :
      tabFilter === "declined" ? (s === "rejected" || s === "declined") : true;
    const q = search.toLowerCase();
    return matchTab && (!q || (
      String(c.id).includes(q) ||
      (c.citizen_name||"").toLowerCase().includes(q) ||
      (c.type||"").toLowerCase().includes(q) ||
      (c.location||"").toLowerCase().includes(q)
    ));
  });
  const totalPages = Math.ceil(filteredComplaints.length / itemsPerPage);
  const paginated  = filteredComplaints.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage);

  /* ── Payments+Fines filter ── */
  const filteredPayments = payments.filter(p => {
    const matchTab = pfTab === "all" ? true : p.status === pfTab;
    const q = pfSearch.toLowerCase();
    return matchTab && (!q || (p.citizen_name||"").toLowerCase().includes(q) || (p.description||"").toLowerCase().includes(q));
  });
  const filteredFines = fines.filter(f => {
    const matchTab = pfTab === "all" ? true : f.status === pfTab;
    const q = pfSearch.toLowerCase();
    return matchTab && (!q || (f.citizen_name||"").toLowerCase().includes(q) || (f.reason||"").toLowerCase().includes(q));
  });

  const getStatusClass = (status) => {
    const s = (status||"pending").toLowerCase();
    if (s === "pending")  return "adm-badge-pending";
    if (s === "accepted" || s === "paid") return "adm-badge-accepted";
    if (s === "rejected" || s === "declined" || s === "unpaid") return "adm-badge-declined";
    return "adm-badge-pending";
  };
  const getStatusLabel = (s) => {
    const v = (s||"pending").toLowerCase();
    if (v === "rejected") return "Declined";
    return v.charAt(0).toUpperCase() + v.slice(1);
  };

  if (loading) return (
    <div className="adm-loading"><div className="adm-spinner"/><p>Loading admin dashboard…</p></div>
  );

  const navItems = [
    { key: "dashboard",  icon: "▦",  label: "Dashboard" },
    { key: "complaints", icon: "⚑",  label: "Requests",  badge: pendingCount || null },
    { key: "payments",   icon: "💳", label: "Payments",  badge: unpaidPayments || null },
    { key: "fines",      icon: "⚠️", label: "Fines",     badge: unpaidFines || null },
    { key: "gps",        icon: "📡", label: "GPS Track", badge: onlineStaff || null },
    { key: "citizens",   icon: "👤", label: "Citizens" },
  ];

  return (
    <div className="adm-root">

      {/* TOAST */}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* CONFIRM */}
      {confirm && <ConfirmModal {...confirm} onCancel={() => setConfirm(null)} />}

      {/* PAYMENT MODAL */}
      {showPaymentModal && <PaymentModal citizens={citizens} onSubmit={createPayment} onClose={() => setShowPaymentModal(false)} />}

      {/* FINE MODAL */}
      {showFineModal && <FineModal citizens={citizens} onSubmit={createFine} onClose={() => setShowFineModal(false)} />}

      {/* ══ NAVBAR ══ */}
      <nav className="adm-navbar">
        <div className="adm-nav-brand">
          <div className="adm-logo-mark">♻
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
              {adminUser?.image ? <img src={`${BASE}/uploads/${adminUser.image}`} alt="avatar"/> : <span>{adminUser?.name?.[0]?.toUpperCase()||"A"}</span>}
            </div>
            <div className="adm-user-info">
              <span className="adm-user-name">{adminUser?.name||"Admin"}</span>
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

        {/* ══ SIDEBAR ══ */}
        <aside className="adm-sidebar">
          <div className="adm-sidebar-top">
            {navItems.map(item => (
              <button key={item.key}
                className={`adm-nav-item ${activeMenu===item.key?"adm-nav-active":""}`}
                onClick={() => { setActiveMenu(item.key); setCurrentPage(1); }}
              >
                <span className="adm-nav-icon">{item.icon}</span>
                <span className="adm-nav-label">{item.label}</span>
                {item.badge > 0 && <span className="adm-nav-badge">{item.badge}</span>}
              </button>
            ))}
          </div>
          <div className="adm-sidebar-bottom">
            <div className="adm-sidebar-stat">
              <span className="adm-stat-num" style={{color:"#22c55e"}}>{onlineStaff}</span>
              <span className="adm-stat-lbl">Online Staff</span>
            </div>
            <div className="adm-sidebar-stat">
              <span className="adm-stat-num" style={{color:"#f59e0b"}}>{pendingCount}</span>
              <span className="adm-stat-lbl">Pending Req.</span>
            </div>
          </div>
        </aside>

        {/* ══ MAIN ══ */}
        <main className="adm-main">

          {/* ── DASHBOARD ── */}
          {activeMenu === "dashboard" && (
            <div className="adm-section">
              <div className="adm-section-head">
                <h2 className="adm-section-title">Dashboard Overview</h2>
              </div>
              <div className="adm-stats-grid">
                {[
                  { label:"Total Requests", value:complaints.length,  color:"#3b82f6", icon:"📋" },
                  { label:"Pending",        value:pendingCount,        color:"#f59e0b", icon:"🕐" },
                  { label:"Accepted",       value:acceptedCount,       color:"#22c55e", icon:"✅" },
                  { label:"Declined",       value:declinedCount,       color:"#ef4444", icon:"✕" },
                  { label:"Total Citizens", value:citizens.length,     color:"#8b5cf6", icon:"👤" },
                  { label:"Unpaid Bills",   value:unpaidPayments,      color:"#06b6d4", icon:"💳" },
                  { label:"Unpaid Fines",   value:unpaidFines,         color:"#f97316", icon:"⚠️" },
                  { label:"Online Staff",   value:onlineStaff,         color:"#22c55e", icon:"📡" },
                ].map((s,i) => (
                  <div key={i} className="adm-stat-card" style={{ borderTop:`3px solid ${s.color}` }}>
                    <div className="adm-stat-icon">{s.icon}</div>
                    <div className="adm-stat-val" style={{ color:s.color }}>{s.value}</div>
                    <div className="adm-stat-label">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="adm-dashboard-grid">
                <div className="adm-dash-card">
                  <h4>Recent Requests</h4>
                  {complaints.slice(0,5).map(c => (
                    <div key={c.id} className="adm-dash-row">
                      <span className="adm-dash-id">#{String(c.id).padStart(3,"0")}</span>
                      <span className="adm-dash-name">{c.citizen_name||"Unknown"}</span>
                      <span className={`adm-status-badge ${getStatusClass(c.status)}`}>{getStatusLabel(c.status)}</span>
                    </div>
                  ))}
                  <button className="adm-dash-more" onClick={() => setActiveMenu("complaints")}>View all →</button>
                </div>
                <div className="adm-dash-card">
                  <h4>Recent Fines</h4>
                  {fines.slice(0,5).map(f => (
                    <div key={f.id} className="adm-dash-row">
                      <span className="adm-dash-name">{f.citizen_name||"—"}</span>
                      <span className="adm-dash-amount">NPR {Number(f.amount).toLocaleString()}</span>
                      <span className={`adm-status-badge ${getStatusClass(f.status)}`}>{getStatusLabel(f.status)}</span>
                    </div>
                  ))}
                  <button className="adm-dash-more" onClick={() => setActiveMenu("fines")}>View all →</button>
                </div>
              </div>
            </div>
          )}

          {/* ── REQUESTS / COMPLAINTS ── */}
          {activeMenu === "complaints" && (
            <div className="adm-section">
              <div className="adm-section-head">
                <h2 className="adm-section-title">Citizen Requests</h2>
              </div>
              <div className="adm-search-wrap">
                <span>🔍</span>
                <input className="adm-search-input" placeholder="Search by ID, citizen, category or location…"
                  value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} />
              </div>
              <div className="adm-tabs">
                {["all","pending","accepted","declined"].map(tab => (
                  <button key={tab} className={`adm-tab ${tabFilter===tab?"adm-tab-active":""}`}
                    onClick={() => { setTabFilter(tab); setCurrentPage(1); }}>
                    {tab === "all" ? "All Requests" : tab.charAt(0).toUpperCase()+tab.slice(1)}
                  </button>
                ))}
              </div>
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead><tr><th>ID</th><th>Citizen</th><th>Category</th><th>Location</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {paginated.length === 0
                      ? <tr><td colSpan="7"><div className="adm-empty"><span>📭</span><p>No requests found</p></div></td></tr>
                      : paginated.map((c,i) => {
                          const s = (c.status||"pending").toLowerCase();
                          return (
                            <tr key={c.id} className="adm-tr" style={{ animationDelay:`${i*0.04}s` }}>
                              <td className="adm-col-id">#{String(c.id).padStart(3,"0")}</td>
                              <td className="adm-col-name">{c.citizen_name||"Unknown"}</td>
                              <td className="adm-col-cat"><span className="adm-cat-dot"/>{c.type||"General"}</td>
                              <td className="adm-col-loc">📍 {c.location||"—"}</td>
                              <td className="adm-col-date">{formatDate(c.created_at)}</td>
                              <td><span className={`adm-status-badge ${getStatusClass(c.status)}`}>{getStatusLabel(c.status)}</span></td>
                              <td>
                                {s === "pending" && (
                                  <div className="adm-action-btns">
                                    <button className="adm-btn-accept"  onClick={() => updateStatus(c.id,"accepted")}> Accept</button>
                                    <button className="adm-btn-decline" onClick={() => updateStatus(c.id,"declined")}> Decline</button>
                                  </div>
                                )}
                                {(s === "accepted" || s === "rejected" || s === "declined") && (
                                  <button className="adm-btn-reopen" onClick={() => updateStatus(c.id,"pending")}>↺ Reopen</button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                    }
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="adm-pagination">
                  <span className="adm-page-info">Showing <strong>{(currentPage-1)*itemsPerPage+1}–{Math.min(currentPage*itemsPerPage,filteredComplaints.length)}</strong> of <strong>{filteredComplaints.length}</strong></span>
                  <div className="adm-page-btns">
                    <button className="adm-page-btn" onClick={() => setCurrentPage(p => Math.max(1,p-1))} disabled={currentPage===1}>←</button>
                    {Array.from({length:Math.min(totalPages,5)},(_,i)=>i+1).map(p => (
                      <button key={p} className={`adm-page-btn ${currentPage===p?"adm-page-active":""}`} onClick={() => setCurrentPage(p)}>{p}</button>
                    ))}
                    <button className="adm-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages,p+1))} disabled={currentPage===totalPages}>→</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PAYMENTS ── */}
          {activeMenu === "payments" && (
            <div className="adm-section">
              <div className="adm-section-head">
                <h2 className="adm-section-title">Payment Management</h2>
                <button className="adm-btn-issue adm-btn-issue-pay" onClick={() => setShowPaymentModal(true)}>
                  + Issue Payment
                </button>
              </div>
              <div className="adm-pf-controls">
                <div className="adm-search-wrap">
                  <span>🔍</span>
                  <input className="adm-search-input" placeholder="Search citizen or description…"
                    value={pfSearch} onChange={e => setPfSearch(e.target.value)} />
                </div>
                <div className="adm-tabs">
                  {["all","unpaid","paid"].map(tab => (
                    <button key={tab} className={`adm-tab ${pfTab===tab?"adm-tab-active":""}`} onClick={() => setPfTab(tab)}>
                      {tab.charAt(0).toUpperCase()+tab.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="adm-pf-summary">
                <div className="adm-pf-chip adm-pf-total">Total: {payments.length}</div>
                <div className="adm-pf-chip adm-pf-unpaid">Unpaid: {unpaidPayments}</div>
                <div className="adm-pf-chip adm-pf-paid">Paid: {payments.filter(p=>p.status==="paid").length}</div>
                <div className="adm-pf-chip adm-pf-amount">Total Amount: NPR {payments.reduce((a,p)=>a+Number(p.amount),0).toLocaleString()}</div>
              </div>
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead><tr><th>ID</th><th>Citizen</th><th>Description</th><th>Amount</th><th>Due Date</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {filteredPayments.length === 0
                      ? <tr><td colSpan="7"><div className="adm-empty"><span>💳</span><p>No payments found</p></div></td></tr>
                      : filteredPayments.map((p,i) => (
                        <tr key={p.id} className="adm-tr" style={{ animationDelay:`${i*0.04}s` }}>
                          <td className="adm-col-id">#{String(p.id).padStart(3,"0")}</td>
                          <td className="adm-col-name">{p.citizen_name||"—"}<br/><small style={{color:"#9ca3af"}}>{p.citizen_email}</small></td>
                          <td>{p.description||"—"}</td>
                          <td><strong style={{color:"#3b82f6"}}>NPR {Number(p.amount).toLocaleString()}</strong></td>
                          <td className="adm-col-date">{formatDate(p.due_date)}</td>
                          <td><span className={`adm-status-badge ${getStatusClass(p.status)}`}>{getStatusLabel(p.status)}</span></td>
                          <td>
                            <div className="adm-action-btns">
                              {p.status === "unpaid" && (
                                <button className="adm-btn-accept" onClick={() => markPaymentPaid(p.id)}>✓ Paid</button>
                              )}
                              <button className="adm-btn-decline" onClick={() => deletePayment(p.id)}>🗑</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── FINES ── */}
          {activeMenu === "fines" && (
            <div className="adm-section">
              <div className="adm-section-head">
                <h2 className="adm-section-title">Fines Management</h2>
                <button className="adm-btn-issue adm-btn-issue-fine" onClick={() => setShowFineModal(true)}>
                  + Issue Fine
                </button>
              </div>
              <div className="adm-pf-controls">
                <div className="adm-search-wrap">
                  <span>🔍</span>
                  <input className="adm-search-input" placeholder="Search citizen or reason…"
                    value={pfSearch} onChange={e => setPfSearch(e.target.value)} />
                </div>
                <div className="adm-tabs">
                  {["all","unpaid","paid"].map(tab => (
                    <button key={tab} className={`adm-tab ${pfTab===tab?"adm-tab-active":""}`} onClick={() => setPfTab(tab)}>
                      {tab.charAt(0).toUpperCase()+tab.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="adm-pf-summary">
                <div className="adm-pf-chip adm-pf-total">Total: {fines.length}</div>
                <div className="adm-pf-chip adm-pf-unpaid">Unpaid: {unpaidFines}</div>
                <div className="adm-pf-chip adm-pf-paid">Paid: {fines.filter(f=>f.status==="paid").length}</div>
                <div className="adm-pf-chip adm-pf-amount">Total Amount: NPR {fines.reduce((a,f)=>a+Number(f.amount),0).toLocaleString()}</div>
              </div>
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead><tr><th>ID</th><th>Citizen</th><th>Reason</th><th>Amount</th><th>Issued</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {filteredFines.length === 0
                      ? <tr><td colSpan="8"><div className="adm-empty"><span>⚠️</span><p>No fines found</p></div></td></tr>
                      : filteredFines.map((f,i) => (
                        <tr key={f.id} className="adm-tr" style={{ animationDelay:`${i*0.04}s` }}>
                          <td className="adm-col-id">#{String(f.id).padStart(3,"0")}</td>
                          <td className="adm-col-name">{f.citizen_name||"—"}<br/><small style={{color:"#9ca3af"}}>{f.citizen_email}</small></td>
                          <td><span className="adm-fine-reason">{f.reason||"—"}</span></td>
                          <td><strong style={{color:"#ef4444"}}>NPR {Number(f.amount).toLocaleString()}</strong></td>
                          <td className="adm-col-date">{formatDate(f.issued_date)}</td>
                          <td className="adm-col-date">{formatDate(f.due_date)}</td>
                          <td><span className={`adm-status-badge ${getStatusClass(f.status)}`}>{getStatusLabel(f.status)}</span></td>
                          <td>
                            <div className="adm-action-btns">
                              {f.status === "unpaid" && (
                                <button className="adm-btn-accept" onClick={() => markFinePaid(f.id)}>✓ Mark Paid</button>
                              )}
                              <button className="adm-btn-decline" onClick={() => deleteFine(f.id)}>🗑</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── GPS TRACKING ── */}
          {activeMenu === "gps" && (
            <div className="adm-section adm-section-gps">
              <div className="adm-section-head">
                <h2 className="adm-section-title">📡 Live Worker Tracking</h2>
                <div className="adm-gps-legend">
                  <span className="adm-legend-dot adm-legend-online"/>Online (&lt;10m)
                  <span className="adm-legend-dot adm-legend-idle"/>Idle
                  <span className="adm-legend-dot adm-legend-offline"/>No signal
                </div>
                <button className="adm-btn-refresh" onClick={fetchGPS}>⟳ Refresh</button>
              </div>
              <GPSPanel staffLocations={gpsData} staffList={staffList} loading={gpsLoading} />
            </div>
          )}

          {/* ── CITIZENS ── */}
          {activeMenu === "citizens" && (
            <div className="adm-section">
              <div className="adm-section-head">
                <h2 className="adm-section-title">Registered Citizens</h2>
                <p className="adm-section-sub">All citizens in the EcoConnect system</p>
              </div>
              <div className="adm-citizens-chip">👥 {citizens.length} Total Citizens</div>
              <div className="adm-citizens-grid">
                {citizens.length === 0
                  ? <div className="adm-empty"><span>👤</span><p>No citizens found</p></div>
                  : citizens.map((citizen,i) => (
                    <div key={citizen.id} className="adm-citizen-card" style={{ animationDelay:`${i*0.05}s` }}>
                      <div className="adm-citizen-avatar">
                        {citizen.image ? <img src={`${BASE}/uploads/${citizen.image}`} alt="avatar"/> : <span>{(citizen.name||"?")[0].toUpperCase()}</span>}
                      </div>
                      <div className="adm-citizen-info">
                        <h4>{citizen.name||"Unknown"}</h4>
                        <p>{citizen.email||"—"}</p>
                        <span>Ward: {citizen.ward||"—"} · Joined: {formatDate(citizen.created_at)}</span>
                      </div>
                      <div className="adm-citizen-actions">
                        <div className="adm-citizen-count">
                          <span className="adm-citizen-num">{complaints.filter(c=>c.user_id===citizen.id).length}</span>
                          <span className="adm-citizen-lbl">Requests</span>
                        </div>
                        <div className="adm-citizen-count">
                          <span className="adm-citizen-num adm-fine-num">{fines.filter(f=>f.user_id===citizen.id).length}</span>
                          <span className="adm-citizen-lbl">Fines</span>
                        </div>
                      </div>
                      <div className="adm-citizen-btns">
                        <button className="adm-citizen-pay-btn" onClick={() => { setShowPaymentModal(true); }}>💳</button>
                        <button className="adm-citizen-fine-btn" onClick={() => { setShowFineModal(true); }}>⚠️</button>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ══ FOOTER ══ */}
      <footer className="adm-footer">
        <div className="adm-footer-inner">
          <div className="adm-footer-brand">
            <span className="adm-footer-brand-name">EcoConnect Admin</span>
            <p className="adm-footer-tagline">Connecting communities for a greener future.</p>
          </div>
          {/* <div className="adm-footer-col">Navigation
            <ul className="adm-footer-links">
              {[
                { label: "Dashboard",   action: () => setActiveMenu("dashboard") },
                { label: "Requests", action: () => navigate("/request")   },
                { label: "Payments",  action: () => navigate("/payment")    },
                { label: "Fines",    action: () => navigate("/fines")       },
                { label: "Gps-tracker",    action: () => navigate("/gps-tracker")      },
                { label: "Citizens",    action: () => navigate("/citizens")      },

              ].map(l => (
                <li key={l.label}>
                  <button className="adm-footer-link-btn" onClick={l.action}>{l.label}</button>
                </li>
              ))}
            </ul>
          </div> */}
          <div className="adm-footer-col">
            <h4>Company</h4>
            <ul>
              {["About Us","Privacy Policy","Terms of Service","Help Center","Contact"].map(l => (
                <li key={l}><a href="#">{l}</a></li>
              ))}
            </ul>
          </div>
          <div className="adm-footer-col"><h4>Contact</h4><div className="adm-footer-contact"><div>✉️ info@ecoconnect.com</div><div>📞 +977 01-4XXXXXX</div><div>📍 Kathmandu, Nepal</div></div></div>

        </div>
        <div className="adm-footer-bottom"><span>© 2025 EcoConnect. All rights reserved.</span></div>
      </footer>

    </div>
  );
}
