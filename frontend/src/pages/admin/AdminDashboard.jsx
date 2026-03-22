import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const statusOptions = [
  { label: "All Statuses", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "In Progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
  { label: "Completed", value: "completed" },
  { label: "Rejected", value: "rejected" },
];

const typeOptions = [
  { label: "All Types", value: "all" },
  { label: "Complaint", value: "complaint" },
  { label: "Request", value: "request" },
];

const timelineOptions = [
  { label: "Today", value: "today" },
  { label: "Last 7 Days", value: "7days" },
  { label: "Last 30 Days", value: "30days" },
];

const cardBase = {
  background: "#ffffff",
  border: "1px solid #e3e8ef",
  borderRadius: "24px",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)",
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: "1.1rem",
  color: "#30415f",
  fontWeight: 800,
};

const pillButtonStyle = {
  borderRadius: "999px",
  border: "1px solid #d1dbe5",
  background: "#fff",
  color: "#586a84",
  padding: "0.75rem 1.2rem",
  cursor: "pointer",
  fontWeight: 600,
};

const getItemDate = (item) => {
  const raw = item?.created_at || item?.pickup_date || item?.request_date;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const withinTimeline = (date, timeline) => {
  if (!date) return false;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (timeline === "today") {
    return date >= startOfToday;
  }

  if (timeline === "7days") {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    return date >= sevenDaysAgo;
  }

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  return date >= thirtyDaysAgo;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalRequests: 0,
    totalComplaints: 0,
    totalPayments: 0,
  });
  const [requests, setRequests] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [timeline, setTimeline] = useState("7days");
  const [notifyQuery, setNotifyQuery] = useState("");
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifySuccess, setNotifySuccess] = useState("");

  const baseWorkerLocations = [
    { id: 1, name: "Truck 1", top: 38, left: 27, color: "#2563eb" },
    { id: 2, name: "Truck 2", top: 22, left: 47, color: "#16a34a" },
  ];

  const [workerLocations, setWorkerLocations] = useState(baseWorkerLocations);

  const fetchDashboardData = async () => {
    setError("");
    setNotifySuccess("");

    try {
      const [statsRes, requestsRes, complaintsRes] = await Promise.all([
        fetch("http://localhost:5001/api/admin/stats"),
        fetch("http://localhost:5001/api/admin/requests"),
        fetch("http://localhost:5001/api/admin/complaints"),
      ]);

      const [statsData, requestsData, complaintsData] = await Promise.all([
        statsRes.json(),
        requestsRes.json(),
        complaintsRes.json(),
      ]);

      if (!statsRes.ok) {
        throw new Error(statsData.message || "Failed to fetch dashboard stats");
      }

      if (!requestsRes.ok) {
        throw new Error(requestsData.message || "Failed to fetch requests");
      }

      if (!complaintsRes.ok) {
        throw new Error(complaintsData.message || "Failed to fetch complaints");
      }

      setStats({
        totalUsers: statsData.totalUsers ?? 0,
        totalRequests: statsData.totalRequests ?? 0,
        totalComplaints: statsData.totalComplaints ?? 0,
        totalPayments: statsData.totalPayments ?? 0,
      });
      setRequests(Array.isArray(requestsData) ? requestsData : []);
      setComplaints(Array.isArray(complaintsData) ? complaintsData : []);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setWorkerLocations((prev) =>
        prev.map((worker, index) => {
          const time = Date.now() / 1000 + index * 2;
          const nextTop = worker.id === 1 ? 38 + Math.sin(time) * 6 : 22 + Math.cos(time) * 5;
          const nextLeft = worker.id === 1 ? 27 + Math.cos(time * 0.9) * 7 : 47 + Math.sin(time * 0.8) * 6;

          return {
            ...worker,
            top: Math.max(12, Math.min(82, nextTop)),
            left: Math.max(10, Math.min(88, nextLeft)),
          };
        })
      );
    }, 1800);

    return () => clearInterval(interval);
  }, []);

  const filteredRequests = useMemo(() => {
    return requests.filter((item) => {
      const itemDate = getItemDate(item);
      const typeMatch = typeFilter === "all" || typeFilter === "request";
      const statusMatch = statusFilter === "all" || (item.status || "pending") === statusFilter;
      const timelineMatch = itemDate ? withinTimeline(itemDate, timeline) : true;
      return typeMatch && statusMatch && timelineMatch;
    });
  }, [requests, statusFilter, typeFilter, timeline]);

  const filteredComplaints = useMemo(() => {
    return complaints.filter((item) => {
      const itemDate = getItemDate(item);
      const typeMatch = typeFilter === "all" || typeFilter === "complaint";
      const statusMatch = statusFilter === "all" || (item.status || "pending") === statusFilter;
      const timelineMatch = itemDate ? withinTimeline(itemDate, timeline) : true;
      return typeMatch && statusMatch && timelineMatch;
    });
  }, [complaints, statusFilter, typeFilter, timeline]);

  const resolvedCases = useMemo(() => {
    return complaints.filter((item) => ["resolved", "completed"].includes(item.status)).length;
  }, [complaints]);

  const resolutionChartData = useMemo(() => {
    const monthly = new Map();

    filteredComplaints.forEach((item) => {
      const date = getItemDate(item);
      if (!date) return;
      const monthLabel = String(date.getMonth() + 1).padStart(2, "0");
      monthly.set(monthLabel, (monthly.get(monthLabel) || 0) + 1);
    });

    const entries = Array.from(monthly.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return entries.length > 0 ? entries : [["03", filteredComplaints.length || 0]];
  }, [filteredComplaints]);

  const workerLeaderboard = useMemo(() => {
    return [
      { name: "Truck 1 Crew", points: 10 },
      { name: "Truck 2 Crew", points: 8 },
      { name: "Collection Team A", points: 6 },
    ];
  }, []);

  const handleSendNotification = (e) => {
    e.preventDefault();
    if (!notifyTitle.trim() || !notifyMessage.trim()) {
      return;
    }
    setNotifySuccess("Notification prepared successfully.");
    setNotifyTitle("");
    setNotifyMessage("");
  };

  const handleAdminLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  const metricCards = [
    { label: "Total Complaints", value: stats.totalComplaints, sub: "overall cases registered", icon: "⚑", accent: "#f59e0b" },
    { label: "Resolved Cases", value: resolvedCases, sub: "successful resolutions", icon: "✓", accent: "#22c55e" },
    { label: "New Request", value: filteredRequests.length, sub: "incoming service requests", icon: "🗂", accent: "#3b82f6" },
    { label: "Active Workers", value: workerLocations.length, sub: "live trucks on map", icon: "📍", accent: "#8b5cf6" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f6f3fa 0%, #f8fafc 100%)",
        padding: "2rem 1.5rem 3rem",
        fontFamily: "Arial, sans-serif",
        color: "#24324a",
      }}
    >
      <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
        <header
          style={{
            background: "rgba(255,255,255,0.78)",
            border: "1px solid #e7ebf2",
            borderRadius: "22px",
            boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
            backdropFilter: "blur(10px)",
            padding: "1rem 1.4rem",
            marginBottom: "1.25rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, #63c483, #4aa368)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: "1.2rem",
              }}
            >
              ♻
            </div>
            <div>
              <p style={{ margin: 0, color: "#41a362", fontWeight: 800, fontSize: "1.05rem" }}>EcoConnect</p>
              <p style={{ margin: "0.2rem 0 0", color: "#7b8aa5", fontSize: "0.9rem" }}>Admin Control Center</p>
            </div>
          </div>

          <nav style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap", alignItems: "center", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "999px", padding: "0.34rem" }}>
            <Link to="/admin" style={{ color: "#31425f", textDecoration: "none", fontWeight: 700, fontSize: "0.92rem", padding: "0.46rem 0.9rem", borderRadius: "999px", background: "#ffffff" }}>Dashboard</Link>
           <Link to="/admin/requests" style={{ color: "#4b5d79", textDecoration: "none", fontWeight: 700, fontSize: "0.92rem", padding: "0.46rem 0.9rem", borderRadius: "999px" }}>New Request</Link>
         <Link to="/admin/complaints" style={{ color: "#4b5d79", textDecoration: "none", fontWeight: 700, fontSize: "0.92rem", padding: "0.46rem 0.9rem", borderRadius: "999px" }}>Complaints</Link>
          </nav>

          <button
            type="button"
            onClick={handleAdminLogout}
            title="Logout"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.85rem",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "999px",
              padding: "0.45rem 0.55rem 0.45rem 0.95rem",
              cursor: "pointer",
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#94a3b8" }}>Signed in as</p>
              <p style={{ margin: "0.15rem 0 0", color: "#24324a", fontWeight: 700 }}>Admin · Logout</p>
            </div>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #dbeafe, #bfdbfe)",
                color: "#1d4ed8",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
              }}
            >
              A
            </div>
          </button>
        </header>
        <div style={{ display: "grid", gridTemplateColumns: "250px minmax(0, 1fr)", gap: "1.5rem", alignItems: "start" }}>
          <aside style={{ ...cardBase, padding: "1.4rem", position: "sticky", top: "1.5rem", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)" }}>
            <h3 style={{ margin: 0, fontSize: "1.15rem", color: "#30415f" }}>Filters & Controls</h3>

            <div style={{ marginTop: "1.5rem" }}>
              <label style={{ display: "block", fontSize: "0.95rem", fontWeight: 700, color: "#667896", marginBottom: "0.55rem" }}>
                Status Filter
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: "100%", height: "54px", padding: "0 1rem", borderRadius: "16px", border: "1px solid #d4dde6", fontSize: "0.98rem", background: "#fff", color: "#334155" }}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: "1.3rem" }}>
              <label style={{ display: "block", fontSize: "0.95rem", fontWeight: 700, color: "#667896", marginBottom: "0.55rem" }}>
                Type Filter
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{ width: "100%", height: "54px", padding: "0 1rem", borderRadius: "16px", border: "1px solid #d4dde6", fontSize: "0.98rem", background: "#fff", color: "#334155" }}
              >
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: "1.3rem" }}>
              <label style={{ display: "block", fontSize: "0.95rem", fontWeight: 700, color: "#667896", marginBottom: "0.55rem" }}>
                Timeline Controls
              </label>
              <div style={{ display: "grid", gap: "0.65rem", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                {timelineOptions.map((option, index) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTimeline(option.value)}
                    style={{
  height: "44px",
  padding: "0 0.7rem",
  borderRadius: "14px",
  border: timeline === option.value ? "1px solid #63c483" : "1px solid #d4dde6",
  background: timeline === option.value ? "#66c67c" : "#fff",
  color: timeline === option.value ? "#fff" : "#54657f",
  fontWeight: 600,
  fontSize: "0.9rem",
  cursor: "pointer",
  gridColumn: index === 2 ? "1 / span 1" : "auto",
}}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <main style={{ display: "grid", gap: "1.5rem" }}>
            <section>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                <div style={{ maxWidth: "700px" }}>
                  <h1
                    style={{
                      margin: 0,
                      fontSize: "1.72rem",
                      lineHeight: 1.08,
                      letterSpacing: "-0.03em",
                      fontWeight: 800,
                      color: "#2b3650",
                    }}
                  >
                    Welcome back, Here’s an overview of the system
                  </h1>
                  <p
                    style={{
                      margin: "0.42rem 0 0",
                      fontSize: "0.9rem",
                      lineHeight: 1.45,
                      color: "#7486a2",
                      maxWidth: "560px",
                    }}
                  >
                    Monitor key performance indicators and manage operations efficiently.
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={fetchDashboardData}
                    style={pillButtonStyle}
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {loading && <p style={{ marginTop: "1rem" }}>Loading dashboard stats...</p>}
              {error && <p style={{ marginTop: "1rem", color: "#dc2626" }}>{error}</p>}
            </section>

            {!loading && !error && (
              <>
                <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "1rem" }}>
                  {metricCards.map((item) => (
                    <div key={item.label} style={{ ...cardBase, padding: "1.35rem 1.45rem", position: "relative", overflow: "hidden", background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)" }}>
                      <div
                        style={{
                          position: "absolute",
                          top: "-20px",
                          right: "-12px",
                          width: "72px",
                          height: "72px",
                          borderRadius: "50%",
                          background: `${item.accent}18`,
                        }}
                      />
                      <div
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "14px",
                          background: `${item.accent}18`,
                          color: item.accent,
                          display: "grid",
                          placeItems: "center",
                          fontSize: "1.1rem",
                          fontWeight: 800,
                          marginBottom: "0.9rem",
                          position: "relative",
                        }}
                      >
                        {item.icon}
                      </div>
                      <p style={{ margin: 0, color: "#7a89a4", fontSize: "0.9rem" }}>{item.label}</p>
                      <p style={{ margin: "0.48rem 0 0.28rem", fontSize: "2rem", lineHeight: 1, fontWeight: 800, color: "#24324a" }}>{item.value}</p>
                      <p style={{ margin: 0, color: "#97a5bd", fontSize: "0.86rem" }}>{item.sub}</p>
                    </div>
                  ))}
                </section>

                <section style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "1.5rem" }}>
                  <div style={{ ...cardBase, padding: "1.4rem" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                      <h2 style={sectionTitleStyle}>Worker Live Locations</h2>
                      <span style={{ color: "#22c55e", fontSize: "0.88rem", fontWeight: 700 }}>● Truck movement live</span>
                    </div>

                    <div style={{ position: "relative", overflow: "hidden", borderRadius: "18px", height: "260px", border: "1px solid #d9e4ee", background: "#dbe9d3" }}>
                      <iframe
                        title="Worker Live Locations"
                        src="https://www.openstreetmap.org/export/embed.html?bbox=87.931%2C26.637%2C87.971%2C26.664&layer=mapnik"
                        style={{ width: "100%", height: "100%", border: 0 }}
                      />

                      {workerLocations.map((worker) => (
                        <div
                          key={worker.id}
                          title={worker.name}
                          style={{
                            position: "absolute",
                            top: `${worker.top}%`,
                            left: `${worker.left}%`,
                            transform: "translate(-50%, -50%)",
                            zIndex: 3,
                            transition: "top 1.6s ease, left 1.6s ease",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "0.35rem",
                          }}
                        >
                          <div
                            style={{
                              padding: "0.35rem 0.55rem",
                              borderRadius: "999px",
                              background: "rgba(255,255,255,0.96)",
                              border: `1px solid ${worker.color}33`,
                              color: "#334155",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              boxShadow: "0 8px 18px rgba(15, 23, 42, 0.08)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {worker.name}
                          </div>
                          <div
                            style={{
                              width: "40px",
                              height: "40px",
                              borderRadius: "14px",
                              background: "rgba(255,255,255,0.96)",
                              border: `2px solid ${worker.color}`,
                              boxShadow: "0 12px 20px rgba(15, 23, 42, 0.12)",
                              display: "grid",
                              placeItems: "center",
                              fontSize: "1.15rem",
                            }}
                          >
                            🚚
                          </div>
                          <div
                            style={{
                              width: "10px",
                              height: "10px",
                              borderRadius: "50%",
                              background: worker.color,
                              boxShadow: `0 0 0 6px ${worker.color}22`,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ ...cardBase, padding: "1.4rem" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                      <h2 style={sectionTitleStyle}>Worker Leaderboard</h2>
                      <select style={{ minWidth: "112px", height: "46px", borderRadius: "14px", border: "1px solid #d4dde6", padding: "0 0.95rem", background: "#fff", color: "#54657f", fontSize: "0.95rem" }}>
                        <option>All Time</option>
                        <option>Monthly</option>
                        <option>Weekly</option>
                      </select>
                    </div>
                    <p style={{ margin: "0 0 1rem", color: "#63b77c", fontWeight: 700 }}>
                      Top performer: {workerLeaderboard[0].name} · {workerLeaderboard[0].points} points
                    </p>
                    <div style={{ display: "grid", gap: "0.9rem" }}>
                      {workerLeaderboard.map((worker, index) => (
                        <div key={worker.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#34435f", padding: "0.7rem 0.8rem", borderRadius: "14px", background: index === 0 ? "#f0fdf4" : "#f8fafc", border: "1px solid #e5e7eb" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                            <span style={{ width: "28px", height: "28px", borderRadius: "50%", background: index === 0 ? "#22c55e" : "#e2e8f0", color: index === 0 ? "#fff" : "#475569", display: "grid", placeItems: "center", fontSize: "0.85rem", fontWeight: 800 }}>
                              {index + 1}
                            </span>
                            {worker.name}
                          </span>
                          <strong style={{ color: "#49a36a" }}>{worker.points} Points</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section style={{ ...cardBase, padding: "1.4rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                    <h2 style={sectionTitleStyle}>Complaint Resolution Rate</h2>
                    <select style={{ minWidth: "112px", height: "46px", borderRadius: "14px", border: "1px solid #d4dde6", padding: "0 0.95rem", background: "#fff", color: "#54657f", fontSize: "0.95rem" }}>
                      <option>Monthly</option>
                      <option>Weekly</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", gap: "1rem", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "999px", padding: "0.45rem 0.8rem", color: "#64748b", fontSize: "0.85rem" }}>
                        Total complaints: {filteredComplaints.length}
                      </div>
                      <div style={{ background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: "999px", padding: "0.45rem 0.8rem", color: "#15803d", fontSize: "0.85rem", fontWeight: 700 }}>
                        Resolved: {resolvedCases}
                      </div>
                    </div>
                    <span style={{ color: "#8b9ab2", fontSize: "0.88rem" }}>Monthly trend view</span>
                  </div>
                  <div style={{ height: "190px", display: "flex", alignItems: "end", gap: "1.25rem", padding: "1rem 0.75rem 0.25rem", background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)", border: "1px solid #edf2f7", borderRadius: "18px" }}>
                    {resolutionChartData.map(([label, value]) => {
                      const max = Math.max(...resolutionChartData.map((item) => item[1]), 1);
                      const height = `${Math.max((value / max) * 140, value > 0 ? 24 : 8)}px`;
                      return (
                        <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.55rem", minWidth: "38px" }}>
                          <span style={{ color: "#5b6b84", fontSize: "0.82rem", fontWeight: 700 }}>{value}</span>
                          <div style={{ width: "22px", height, background: "linear-gradient(180deg, #86efac 0%, #4ade80 100%)", borderRadius: "999px", boxShadow: "0 8px 16px rgba(74, 222, 128, 0.22)" }} />
                          <span style={{ color: "#8797b0", fontSize: "0.85rem" }}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section style={{ ...cardBase, padding: "1.5rem", background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                    <h2 style={{ ...sectionTitleStyle, marginBottom: 0 }}>Send Notification</h2>
                    <div style={{ background: "#f0fdf4", border: "1px solid #cce6d4", borderRadius: "999px", padding: "0.45rem 0.85rem", color: "#3f8f5d", fontWeight: 700, fontSize: "0.85rem" }}>
                      Notification Center
                    </div>
                  </div>
                  <form onSubmit={handleSendNotification} style={{ display: "grid", gap: "0.9rem" }}>
                    <label style={{ display: "grid", gap: "0.4rem", color: "#7a89a4" }}>
                      Search citizen
                      <input
                        value={notifyQuery}
                        onChange={(e) => setNotifyQuery(e.target.value)}
                        placeholder="Search by name or email"
                        style={{ width: "100%", height: "56px", boxSizing: "border-box", padding: "0 1rem", borderRadius: "16px", border: "1px solid #d4dde6", fontSize: "0.98rem", color: "#334155", background: "#fff" }}
                      />
                    </label>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", color: "#97a5bd", fontSize: "0.92rem" }}>
                      <p style={{ margin: 0 }}>Selected user ID: None</p>
                      <p style={{ margin: 0 }}>Ready to notify citizens instantly</p>
                    </div>
                    <input
                      value={notifyTitle}
                      onChange={(e) => setNotifyTitle(e.target.value)}
                      placeholder="Title"
                      style={{ width: "100%", height: "56px", boxSizing: "border-box", padding: "0 1rem", borderRadius: "16px", border: "1px solid #d4dde6", fontSize: "0.98rem", color: "#334155", background: "#fff" }}
                    />
                    <textarea
                      value={notifyMessage}
                      onChange={(e) => setNotifyMessage(e.target.value)}
                      placeholder="Message"
                      rows={4}
                      style={{ width: "100%", minHeight: "132px", boxSizing: "border-box", padding: "0.95rem 1rem", borderRadius: "16px", border: "1px solid #d4dde6", fontSize: "0.98rem", resize: "vertical", color: "#334155", background: "#fff", lineHeight: 1.5 }}
                    />
                    {notifySuccess && <p style={{ margin: 0, color: "#4aa368" }}>{notifySuccess}</p>}
                    <button
                      type="submit"
                      style={{ width: "fit-content", minWidth: "104px", height: "48px", border: "none", borderRadius: "14px", background: "#63c483", color: "#fff", padding: "0 1.2rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 10px 18px rgba(99, 196, 131, 0.2)" }}
                    >
                      Send
                    </button>
                  </form>
                </section>

                <footer style={{ ...cardBase, padding: "1.3rem 1.45rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "0.85rem" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "0.6rem" }}>
                        <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: "#63c483", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 }}>♻</div>
                        <strong style={{ fontSize: "1.1rem", color: "#41a362" }}>EcoConnect</strong>
                      </div>
                      <p style={{ margin: "0 0 0.6rem", color: "#677996", lineHeight: 1.55, fontSize: "0.92rem" }}>
                        Connecting communities for a greener future. Simplify your waste management and boost your eco-score.
                      </p>
                      <p style={{ margin: 0, color: "#677996" }}>© 2026 EcoConnect. All rights reserved.</p>
                    </div>

                    <div>
                      <h3 style={{ margin: 0, color: "#31425f" }}>Quick Links</h3>
                      <div style={{ display: "grid", gap: "0.55rem", marginTop: "0.85rem", fontSize: "0.92rem" }}>
                        <Link to="/admin" style={{ color: "#41a362", textDecoration: "none" }}>Dashboard</Link>
                        <Link to="/admin/requests" style={{ color: "#41a362", textDecoration: "none" }}>New Request</Link>
                        <Link to="/admin/complaints" style={{ color: "#41a362", textDecoration: "none" }}>Complaints</Link>
                        <span style={{ color: "#41a362" }}>About Us</span>
                        <span style={{ color: "#41a362" }}>Privacy Policy</span>
                        <span style={{ color: "#41a362" }}>Terms of Service</span>
                      </div>
                    </div>

                    <div>
                      <h3 style={{ margin: 0, color: "#31425f" }}>Connect</h3>
                      <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.85rem", marginBottom: "0.7rem" }}>
                        {["f", "◎", "in"].map((icon) => (
                          <div key={icon} style={{ width: "34px", height: "34px", borderRadius: "50%", border: "1px solid #d4dde6", display: "grid", placeItems: "center", color: "#8797b0" }}>
                            {icon}
                          </div>
                        ))}
                      </div>
                      <p style={{ margin: 0, color: "#677996" }}>info@ecoconnect.com</p>
                    </div>
                  </div>
                </footer>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
