

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const statusOptions = [
  { label: "All Statuses", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Rejected", value: "rejected" },
];

const typeOptions = [
  { label: "All Types", value: "" },
  { label: "Recycling", value: "recycling" },
  { label: "Bulk Waste", value: "bulk waste" },
  { label: "Organic", value: "organic" },
  { label: "General", value: "general" },
];

const pageBg = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #f6f3fa 0%, #f8fafc 100%)",
  padding: "2rem 1.5rem 3rem",
  fontFamily: "Arial, sans-serif",
  color: "#24324a",
};

const shellCard = {
  background: "#ffffff",
  border: "1px solid #e3e8ef",
  borderRadius: "24px",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)",
};

const statusBadgeStyle = (status) => {
  switch (status) {
    case "pending":
      return {
        background: "#fffbeb",
        color: "#b45309",
        border: "1px solid #fcd34d",
      };
    case "approved":
      return {
        background: "#ecfdf5",
        color: "#047857",
        border: "1px solid #a7f3d0",
      };
    case "in_progress":
      return {
        background: "#eff6ff",
        color: "#1d4ed8",
        border: "1px solid #bfdbfe",
      };
    case "completed":
      return {
        background: "#0f172a",
        color: "#ffffff",
        border: "1px solid #0f172a",
      };
    case "rejected":
      return {
        background: "#fff1f2",
        color: "#be123c",
        border: "1px solid #fecdd3",
      };
    default:
      return {
        background: "#f8fafc",
        color: "#475569",
        border: "1px solid #cbd5e1",
      };
  }
};

const prettyType = (value) => {
  if (!value) return "General";
  return value
    .toString()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const prettyStatus = (value) => {
  if (!value) return "Pending";
  return value.replace(/_/g, " ");
};

const formatDateTime = (dateValue, timeValue) => {
  if (!dateValue) return "-";
  if (!timeValue) return dateValue;
  return `${dateValue} · ${timeValue}`;
};

export default function AdminRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [assignedWorker, setAssignedWorker] = useState({});
  const [assigningId, setAssigningId] = useState(null);

  const loadRequests = async () => {
    setError("");
    try {
      const response = await fetch("http://localhost:5001/api/admin/requests");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch requests");
      }

      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const updateStatus = async (id, status) => {
    setUpdatingId(id);
    setError("");

    try {
      const response = await fetch(`http://localhost:5001/api/requests/${id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update request status");
      }

      await loadRequests();
    } catch (err) {
      setError(err.message || "Failed to update request status");
    } finally {
      setUpdatingId(null);
    }
  };

  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((item) => item.status === "pending").length;
    const approved = requests.filter((item) => item.status === "approved").length;
    const inProgress = requests.filter((item) => item.status === "in_progress").length;
    return { total, pending, approved, inProgress };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (typeFilter && (item.type || "").toLowerCase() !== typeFilter.toLowerCase()) return false;
      if (!query) return true;

      const haystack = [
        item.id,
        item.type,
        item.description,
        item.location,
        item.status,
        item.user_id,
        item.pickup_date,
        item.pickup_time,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [requests, statusFilter, typeFilter, search]);

  const workers = [
    { id: "worker-1", name: "Truck 1 Crew" },
    { id: "worker-2", name: "Truck 2 Crew" },
    { id: "worker-3", name: "Collection Team A" },
  ];

  const handleAdminLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  const assignWorker = async (requestId, workerId) => {
    if (!workerId) return;

    const worker = workers.find((item) => item.id === workerId);
    if (!worker) return;

    setAssigningId(requestId);
    setError("");

    try {
      const storedUser = localStorage.getItem("user");
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;

      const response = await fetch(`http://localhost:5001/api/requests/${requestId}/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workerId: worker.id,
          workerName: worker.name,
          assignedBy: parsedUser?.id || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to assign worker");
      }

      setAssignedWorker((prev) => ({ ...prev, [requestId]: worker.id }));
      await loadRequests();
    } catch (err) {
      setError(err.message || "Failed to assign worker");
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div style={pageBg}>
      <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
        <header
          style={{
            ...shellCard,
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

          <nav style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            <Link to="/admin" style={{ color: "#31425f", textDecoration: "none", fontWeight: 700 }}>Dashboard</Link>
            <Link to="/admin/requests" style={{ color: "#31425f", textDecoration: "none", fontWeight: 700 }}>Requests</Link>
            <Link to="/admin/complaints" style={{ color: "#31425f", textDecoration: "none", fontWeight: 700 }}>Complaints</Link>
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

        <div style={{ ...shellCard, padding: "2rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
            <div>
              <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#24324a", margin: 0 }}>Service Requests</h1>
              <p style={{ fontSize: "1rem", color: "#667896", marginTop: "0.45rem" }}>
                Review, approve, and assign collection requests efficiently.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.88rem", color: "#64748b" }}>
                Showing {filteredRequests.length} of {requests.length}
              </span>
              <button
                type="button"
                onClick={loadRequests}
                style={{
                  borderRadius: "999px",
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  color: "#475569",
                  padding: "0.7rem 1.1rem",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                Refresh
              </button>
            </div>
          </div>

          {error && <p style={{ color: "#dc2626", marginTop: "1rem", fontSize: "0.95rem" }}>{error}</p>}
          {loading && <p style={{ marginTop: "1rem" }}>Loading requests...</p>}

          {!loading && !error && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: "1rem",
                  marginTop: "1.75rem",
                }}
              >
                {[
                  { label: "Total Requests", value: stats.total, color: "#24324a" },
                  { label: "Pending", value: stats.pending, color: "#d97706" },
                  { label: "Approved", value: stats.approved, color: "#059669" },
                  { label: "In Progress", value: stats.inProgress, color: "#2563eb" },
                ].map((item) => (
                  <div key={item.label} style={{ border: "1px solid #e2e8f0", borderRadius: "18px", padding: "1.15rem", background: "#fff" }}>
                    <p style={{ fontSize: "0.88rem", color: "#64748b", margin: 0 }}>{item.label}</p>
                    <p style={{ fontSize: "2rem", fontWeight: 800, color: item.color, margin: "0.6rem 0 0" }}>{item.value}</p>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gap: "0.9rem", gridTemplateColumns: "1.2fr 1fr 1fr", marginTop: "1.6rem" }}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by type, note, or ID"
                  style={{
                    width: "100%",
                    borderRadius: "14px",
                    border: "1px solid #cbd5e1",
                    padding: "0.95rem 1rem",
                    fontSize: "0.95rem",
                  }}
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    width: "100%",
                    borderRadius: "14px",
                    border: "1px solid #cbd5e1",
                    padding: "0.95rem 1rem",
                    fontSize: "0.95rem",
                  }}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={{
                    width: "100%",
                    borderRadius: "14px",
                    border: "1px solid #cbd5e1",
                    padding: "0.95rem 1rem",
                    fontSize: "0.95rem",
                  }}
                >
                  {typeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginTop: "1.6rem", display: "grid", gap: "1rem" }}>
                {filteredRequests.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "20px",
                      padding: "1.2rem",
                      background: "#fff",
                      transition: "all 0.2s ease",
                      boxShadow: "0 8px 18px rgba(15, 23, 42, 0.06)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                      <div>
                        <p style={{ fontSize: "1rem", fontWeight: 800, color: "#1e293b", margin: 0 }}>
                          {prettyType(item.type)} · Request #{item.id}
                        </p>
                        <p style={{ fontSize: "0.92rem", color: "#667896", margin: "0.3rem 0 0" }}>
                          {item.description || "No additional description provided."}
                        </p>
                      </div>

                      <span
                        style={{
                          ...statusBadgeStyle(item.status),
                          borderRadius: "999px",
                          padding: "0.5rem 0.9rem",
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          textTransform: "capitalize",
                          height: "fit-content",
                        }}
                      >
                        {prettyStatus(item.status)}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: item.image ? "180px repeat(3, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))",
                        gap: "1rem",
                        alignItems: "start",
                        marginTop: "1rem",
                      }}
                    >
                      {item.image && (
                        <img
                          src={`http://localhost:5001/uploads/${item.image}`}
                          alt="request"
                          style={{
                            width: "180px",
                            height: "110px",
                            objectFit: "cover",
                            borderRadius: "14px",
                            border: "1px solid #e2e8f0",
                            background: "#f1f5f9",
                          }}
                        />
                      )}

                      <div>
                        <p style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", margin: 0 }}>Submitted</p>
                        <p style={{ fontSize: "0.95rem", color: "#334155", marginTop: "0.35rem" }}>
                          {formatDateTime(item.pickup_date, item.pickup_time)}
                        </p>
                      </div>

                      <div>
                        <p style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", margin: 0 }}>Preferred</p>
                        <p style={{ fontSize: "0.95rem", color: "#334155", marginTop: "0.35rem" }}>
                          Flexible · {item.pickup_time || "-"}
                        </p>
                      </div>

                      <div>
                        <p style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", margin: 0 }}>Citizen ID</p>
                        <p style={{ fontSize: "0.95rem", color: "#334155", marginTop: "0.35rem" }}>#{item.user_id}</p>
                      </div>
                    </div>

                    <div style={{ marginTop: "1rem" }}>
                      <p style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", margin: 0 }}>Location</p>
                      <p style={{ fontSize: "0.95rem", color: "#334155", marginTop: "0.35rem", lineHeight: 1.5 }}>
                        {item.location || "-"}
                      </p>
                    </div>

                    <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                      <button
                        type="button"
                        onClick={() => updateStatus(item.id, "approved")}
                        disabled={updatingId === item.id}
                        style={{
                          border: "none",
                          borderRadius: "999px",
                          background: "linear-gradient(135deg, #63c483, #4aa368)",
                          color: "#fff",
                          padding: "0.75rem 1.2rem",
                          fontSize: "0.9rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(item.id, "in_progress")}
                        disabled={updatingId === item.id}
                        style={{
                          border: "1px solid #bfdbfe",
                          borderRadius: "999px",
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          padding: "0.75rem 1.2rem",
                          fontSize: "0.9rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Mark In Progress
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(item.id, "completed")}
                        disabled={updatingId === item.id}
                        style={{
                          border: "none",
                          borderRadius: "999px",
                          background: "#0f172a",
                          color: "#fff",
                          padding: "0.75rem 1.2rem",
                          fontSize: "0.9rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Complete
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(item.id, "rejected")}
                        disabled={updatingId === item.id}
                        style={{
                          border: "1px solid #fecdd3",
                          borderRadius: "999px",
                          background: "#fff1f2",
                          color: "#be123c",
                          padding: "0.75rem 1.2rem",
                          fontSize: "0.9rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Reject
                      </button>
                      <select
                        value={assignedWorker[item.id] || ""}
                        onChange={(e) => assignWorker(item.id, e.target.value)}
                        disabled={assigningId === item.id}
                        style={{
                          borderRadius: "999px",
                          border: "1px solid #cbd5e1",
                          background: "#fff",
                          color: "#334155",
                          padding: "0.75rem 1rem",
                          fontSize: "0.9rem",
                          minWidth: "200px",
                          cursor: "pointer",
                        }}
                      >
                        <option value="">{assigningId === item.id ? "Assigning..." : "Assign worker"}</option>
                        {workers.map((worker) => (
                          <option key={worker.id} value={worker.id}>{worker.name}</option>
                        ))}
                      </select>
                      {assignedWorker[item.id] && (
                        <span
                          style={{
                            alignSelf: "center",
                            fontSize: "0.85rem",
                            color: "#059669",
                            fontWeight: 700,
                          }}
                        >
                          ✔ Assigned
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {filteredRequests.length === 0 && (
                  <p style={{ fontSize: "1rem", color: "#94a3b8", textAlign: "center", marginTop: "2rem" }}>
                    📭 No requests found
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}