import { useState, useEffect, useCallback } from "react";
import "./AdminFeedbackPanel.css";

const BASE = "http://localhost:5001";

const TYPE_CFG = {
  issue:      { label: "Issue",      icon: "⚠️", color: "#f59e0b", bg: "#fef3c7" },
  suggestion: { label: "Suggestion", icon: "💡", color: "#3b82f6", bg: "#eff6ff" },
  compliment: { label: "Compliment", icon: "🌟", color: "#10b981", bg: "#ecfdf5" },
  other:      { label: "Other",      icon: "💬", color: "#8b5cf6", bg: "#f5f3ff" },
};

const STATUS_CFG = {
  pending:     { label: "Pending",     color: "#f59e0b", bg: "#fef3c7" },
  in_progress: { label: "In Progress", color: "#3b82f6", bg: "#eff6ff" },
  resolved:    { label: "Resolved",    color: "#10b981", bg: "#ecfdf5" },
  received:    { label: "Received",    color: "#8b5cf6", bg: "#f5f3ff" },
  closed:      { label: "Closed",      color: "#6b7280", bg: "#f3f4f6" },
};

function StarDisplay({ rating, size = 14 }) {
  if (!rating || rating === 0) return <span style={{ color: "#d1d5db", fontSize: size }}>No rating</span>;
  return (
    <span style={{ fontSize: size, letterSpacing: 1 }}>
      {"★".repeat(rating)}<span style={{ color: "#d1d5db" }}>{"★".repeat(5 - rating)}</span>
    </span>
  );
}

/* ── Detail drawer that slides in from right ── */
function FeedbackDrawer({ item, onClose, onSave, saving }) {
  const [status,   setStatus]   = useState(item.status   || "pending");
  const [response, setResponse] = useState(item.admin_response || "");
  const typeCfg   = TYPE_CFG[item.type]   || TYPE_CFG.other;
  const statusCfg = STATUS_CFG[status]    || STATUS_CFG.pending;

  const formatDate = (d) => new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  return (
    <div className="afb-drawer-overlay" onClick={onClose}>
      <div className="afb-drawer" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="afb-drawer-head">
          <div className="afb-drawer-type" style={{ background: typeCfg.bg, color: typeCfg.color }}>
            {typeCfg.icon} {typeCfg.label}
          </div>
          <button className="afb-drawer-close" onClick={onClose}>✕</button>
        </div>

        {/* Citizen info */}
        <div className="afb-drawer-citizen">
          <div className="afb-dc-avatar">{(item.user_name||"?")[0].toUpperCase()}</div>
          <div>
            <div className="afb-dc-name">{item.user_name || "Unknown"}</div>
            <div className="afb-dc-email">{item.user_email || "—"}</div>
            {item.user_ward && <div className="afb-dc-ward">Ward {item.user_ward}</div>}
          </div>
          <div className="afb-dc-date">{formatDate(item.created_at)}</div>
        </div>

        {/* Content */}
        <div className="afb-drawer-content">
          <h3 className="afb-drawer-title">{item.title}</h3>
          <p  className="afb-drawer-details">{item.details}</p>

          {item.rating > 0 && (
            <div className="afb-drawer-rating">
              <span className="afb-dr-label">Rating</span>
              <StarDisplay rating={item.rating} size={20}/>
              <span className="afb-dr-word">
                {["","Poor","Fair","Good","Great","Excellent!"][item.rating]}
              </span>
            </div>
          )}

          {item.photo && (
            <div className="afb-drawer-photo">
              <img
                src={`${BASE}/uploads/${item.photo}`}
                alt="feedback"
                onClick={() => window.open(`${BASE}/uploads/${item.photo}`, "_blank")}
              />
              <span>Click to open full size</span>
            </div>
          )}
        </div>

        {/* Admin tools */}
        <div className="afb-drawer-tools">
          <div className="afb-tool-row">
            <label className="afb-tool-label">Update Status</label>
            <div className="afb-status-btns">
              {Object.entries(STATUS_CFG).map(([key, cfg]) => (
                <button
                  key={key}
                  className={`afb-status-btn ${status === key ? "afb-status-btn-active" : ""}`}
                  style={status === key ? { background: cfg.bg, color: cfg.color, borderColor: cfg.color } : {}}
                  onClick={() => setStatus(key)}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          <div className="afb-tool-row">
            <label className="afb-tool-label">Reply to Citizen</label>
            <textarea
              className="afb-response-input"
              rows={4}
              placeholder="Write a response — the citizen will see this on their feedback page…"
              value={response}
              onChange={e => setResponse(e.target.value)}
            />
            <div className="afb-char">{response.length}/500</div>
          </div>

          {item.admin_response && (
            <div className="afb-prev-response">
              <span className="afb-prev-label">Previous response:</span>
              <p>{item.admin_response}</p>
            </div>
          )}
        </div>

        {/* Save */}
        <div className="afb-drawer-footer">
          <button className="afb-drawer-cancel" onClick={onClose}>Cancel</button>
          <button
            className="afb-drawer-save"
            onClick={() => onSave(item.id, status, response)}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN ADMIN FEEDBACK PANEL
   Usage: drop <AdminFeedbackPanel /> inside the
   admin dashboard's {activeMenu === "feedback"} block
   ══════════════════════════════════════════════ */
export default function AdminFeedbackPanel({ showToast }) {
  const [items,      setItems]      = useState([]);
  const [stats,      setStats]      = useState({});
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [selected,   setSelected]   = useState(null);   // drawer item
  const [confirm,    setConfirm]    = useState(null);   // delete confirm

  // Filters
  const [search,     setSearch]     = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy,     setSortBy]     = useState("newest");
  const [page,       setPage]       = useState(1);
  const PER_PAGE = 10;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [fbRes, stRes] = await Promise.all([
        fetch(`${BASE}/api/feedback/all?type=${typeFilter}&status=${statusFilter}&search=${encodeURIComponent(search)}`),
        fetch(`${BASE}/api/feedback/stats`),
      ]);
      const [fb, st] = await Promise.all([fbRes.json(), stRes.json()]);
      setItems(Array.isArray(fb) ? fb : []);
      setStats(st || {});
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [typeFilter, statusFilter, search]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Sort ── */
  const sorted = [...items].sort((a, b) => {
    if (sortBy === "newest")  return new Date(b.created_at) - new Date(a.created_at);
    if (sortBy === "oldest")  return new Date(a.created_at) - new Date(b.created_at);
    if (sortBy === "rating")  return (b.rating || 0) - (a.rating || 0);
    if (sortBy === "status")  return (a.status||"").localeCompare(b.status||"");
    return 0;
  });

  const totalPages = Math.ceil(sorted.length / PER_PAGE);
  const paginated  = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  /* ── Save (status + response) ── */
  const handleSave = async (id, status, admin_response) => {
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/feedback/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, admin_response }),
      });
      if (!res.ok) throw new Error("Update failed");
      // Update local state immediately
      setItems(prev => prev.map(i => i.id === id ? { ...i, status, admin_response } : i));
      setSelected(prev => prev ? { ...prev, status, admin_response } : null);
      if (showToast) showToast("Feedback updated successfully!", "success");
      setSelected(null);
    } catch (e) {
      if (showToast) showToast("Failed to update feedback", "error");
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete ── */
  const handleDelete = async (id) => {
    try {
      await fetch(`${BASE}/api/feedback/${id}`, { method: "DELETE" });
      setItems(prev => prev.filter(i => i.id !== id));
      setConfirm(null);
      setSelected(null);
      if (showToast) showToast("Feedback deleted", "success");
    } catch {
      if (showToast) showToast("Delete failed", "error");
    }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <div className="afb-root">

      {/* ── Drawer ── */}
      {selected && (
        <FeedbackDrawer
          item={selected}
          onClose={() => setSelected(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {/* ── Delete confirm ── */}
      {confirm && (
        <div className="afb-overlay" onClick={() => setConfirm(null)}>
          <div className="afb-confirm-box" onClick={e => e.stopPropagation()}>
            <div className="afb-confirm-icon">🗑️</div>
            <h3>Delete Feedback?</h3>
            <p>This cannot be undone.</p>
            <div className="afb-confirm-btns">
              <button className="afb-cancel-btn" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="afb-delete-btn" onClick={() => handleDelete(confirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stats row ── */}
      <div className="afb-stats">
        {[
          { label: "Total",       value: stats.total       || 0, color: "#6b7280", icon: "💬" },
          { label: "Pending",     value: stats.pending     || 0, color: "#f59e0b", icon: "🕐" },
          { label: "In Progress", value: stats.in_progress || 0, color: "#3b82f6", icon: "🔄" },
          { label: "Resolved",    value: stats.resolved    || 0, color: "#10b981", icon: "✅" },
          { label: "Avg Rating",  value: stats.avg_rating  ? `${stats.avg_rating}★` : "—", color: "#f97316", icon: "⭐" },
          { label: "Responded",   value: stats.responded   || 0, color: "#8b5cf6", icon: "📩" },
        ].map((s, i) => (
          <div key={i} className="afb-stat" style={{ borderTop: `3px solid ${s.color}` }}>
            <div className="afb-stat-icon">{s.icon}</div>
            <div className="afb-stat-val" style={{ color: s.color }}>{s.value}</div>
            <div className="afb-stat-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Type breakdown ── */}
      <div className="afb-type-row">
        {[
          { key:"issue",      label:"Issues",       val: stats.issues      || 0 },
          { key:"suggestion", label:"Suggestions",  val: stats.suggestions || 0 },
          { key:"compliment", label:"Compliments",  val: stats.compliments || 0 },
          { key:"other",      label:"Other",        val: stats.other       || 0 },
        ].map(t => {
          const cfg = TYPE_CFG[t.key];
          const pct = stats.total > 0 ? Math.round((t.val / stats.total) * 100) : 0;
          return (
            <div key={t.key} className="afb-type-card" style={{ borderLeft: `4px solid ${cfg.color}` }}>
              <div className="afb-type-icon">{cfg.icon}</div>
              <div className="afb-type-info">
                <div className="afb-type-val">{t.val}</div>
                <div className="afb-type-lbl">{t.label}</div>
              </div>
              <div className="afb-type-pct" style={{ color: cfg.color }}>{pct}%</div>
            </div>
          );
        })}
      </div>

      {/* ── Controls ── */}
      <div className="afb-controls">
        <div className="afb-search-wrap">
          <span className="afb-search-icon">🔍</span>
          <input
            className="afb-search"
            placeholder="Search by title, details or citizen name…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          {search && <button className="afb-search-clear" onClick={() => setSearch("")}>✕</button>}
        </div>

        <div className="afb-filter-group">
          <select className="afb-select" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
            <option value="all">All Types</option>
            {Object.entries(TYPE_CFG).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
          <select className="afb-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="afb-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="rating">Highest rating</option>
            <option value="status">By status</option>
          </select>
        </div>

        <div className="afb-result-count">{sorted.length} results</div>
      </div>

      {/* ── Status filter tabs ── */}
      <div className="afb-tabs">
        {["all", "pending", "in_progress", "resolved", "closed"].map(s => {
          const cfg = s === "all" ? null : STATUS_CFG[s];
          const count = s === "all" ? (stats.total||0)
            : s === "pending"     ? (stats.pending||0)
            : s === "in_progress" ? (stats.in_progress||0)
            : s === "resolved"    ? (stats.resolved||0)
            : (stats.closed||0);
          return (
            <button
              key={s}
              className={`afb-tab ${statusFilter === s ? "afb-tab-active" : ""}`}
              style={statusFilter === s && cfg ? { borderBottomColor: cfg.color, color: cfg.color } : {}}
              onClick={() => { setStatusFilter(s); setPage(1); }}
            >
              {s === "all" ? "All" : cfg?.label}
              <span className="afb-tab-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="afb-loading"><div className="afb-spinner"/><p>Loading feedback…</p></div>
      ) : paginated.length === 0 ? (
        <div className="afb-empty">
          <span>📭</span>
          <p>No feedback found{search ? ` for "${search}"` : ""}</p>
        </div>
      ) : (
        <div className="afb-table-wrap">
          <table className="afb-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Citizen</th>
                <th>Type</th>
                <th>Title</th>
                <th>Rating</th>
                <th>Date</th>
                <th>Status</th>
                <th>Response</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((item, i) => {
                const typeCfg   = TYPE_CFG[item.type]     || TYPE_CFG.other;
                const statusCfg = STATUS_CFG[item.status] || STATUS_CFG.pending;
                return (
                  <tr key={item.id} className="afb-tr" style={{ animationDelay: `${i * 0.03}s` }}>
                    <td className="afb-col-id">#{String(item.id).padStart(3, "0")}</td>

                    <td className="afb-col-citizen">
                      <div className="afb-citizen-cell">
                        <div className="afb-citizen-avatar">{(item.user_name||"?")[0].toUpperCase()}</div>
                        <div>
                          <div className="afb-citizen-name">{item.user_name || "Unknown"}</div>
                          <div className="afb-citizen-email">{item.user_email || "—"}</div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="afb-type-badge" style={{ background: typeCfg.bg, color: typeCfg.color }}>
                        {typeCfg.icon} {typeCfg.label}
                      </span>
                    </td>

                    <td className="afb-col-title">
                      <div className="afb-title-cell">
                        <span>{item.title}</span>
                        {item.photo && <span className="afb-photo-indicator" title="Has photo">📷</span>}
                      </div>
                      <div className="afb-title-preview">{item.details?.substring(0, 60)}…</div>
                    </td>

                    <td>
                      <StarDisplay rating={item.rating}/>
                    </td>

                    <td className="afb-col-date">{formatDate(item.created_at)}</td>

                    <td>
                      <span className="afb-status-badge" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                        {statusCfg.label}
                      </span>
                    </td>

                    <td className="afb-col-response">
                      {item.admin_response
                        ? <span className="afb-responded-tag">✓ Replied</span>
                        : <span className="afb-no-response">—</span>
                      }
                    </td>

                    <td>
                      <div className="afb-row-actions">
                        <button
                          className="afb-action-view"
                          onClick={() => setSelected(item)}
                          title="View & respond"
                        >
                          View
                        </button>
                        <button
                          className="afb-action-delete"
                          onClick={() => setConfirm(item.id)}
                          title="Delete"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="afb-pagination">
          <span className="afb-page-info">
            Showing <strong>{(page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE, sorted.length)}</strong> of <strong>{sorted.length}</strong>
          </span>
          <div className="afb-page-btns">
            <button className="afb-page-btn" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}>←</button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
              <button key={p} className={`afb-page-btn ${page===p?"afb-page-active":""}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button className="afb-page-btn" onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}>→</button>
          </div>
        </div>
      )}

    </div>
  );
}
