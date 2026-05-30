import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./Feedback.css";

const TYPE_CONFIG = {
  issue:      { label: "Report an Issue",     icon: "⚠️", color: "#f59e0b", bg: "#fef3c7" },
  suggestion: { label: "Suggestion",          icon: "💡", color: "#3b82f6", bg: "#eff6ff" },
  compliment: { label: "Compliment",          icon: "🌟", color: "#10b981", bg: "#ecfdf5" },
  other:      { label: "Other",               icon: "💬", color: "#8b5cf6", bg: "#f5f3ff" },
};

const STATUS_CONFIG = {
  pending:     { label: "Pending",     color: "#f59e0b", bg: "#fef3c7" },
  in_progress: { label: "In Progress", color: "#3b82f6", bg: "#eff6ff" },
  resolved:    { label: "Resolved",    color: "#10b981", bg: "#ecfdf5" },
  received:    { label: "Received",    color: "#8b5cf6", bg: "#f5f3ff" },
  closed:      { label: "Closed",      color: "#6b7280", bg: "#f3f4f6" },
};

export default function Feedback() {
  const navigate   = useNavigate();
  const fileRef    = useRef(null);
  const [user, setUser]               = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [successMsg, setSuccessMsg]   = useState("");
  const [activeMenu, setActiveMenu]   = useState("feedback");
  const [filterType, setFilterType]   = useState("all");
  const [deleteModal, setDeleteModal] = useState(null);

  // Form state
  const [type, setType]         = useState("issue");
  const [title, setTitle]       = useState("");
  const [details, setDetails]   = useState("");
  const [photo, setPhoto]       = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [rating, setRating]     = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { navigate("/login"); return; }
    const u = JSON.parse(stored);
    setUser(u);
    fetchSubmissions(u.id);
  }, []);

  const fetchSubmissions = async (userId) => {
    try {
      const res  = await fetch(`http://localhost:5001/api/feedback/${userId}`);
      const data = await res.json();
      setSubmissions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch feedback:", err);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhoto(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !details.trim()) {
      alert("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("userId",  user.id);
      formData.append("type",    type);
      formData.append("title",   title);
      formData.append("details", details);
      formData.append("rating",  rating);
      if (photo) formData.append("photo", photo);

      const res  = await fetch("http://localhost:5001/api/feedback", {
        method: "POST",
        body:   formData,
      });
      const data = await res.json();

      if (res.ok && data.id) {
        const newItem = {
          id:         data.id,
          type,
          title,
          details,
          rating,
          status:     "pending",
          created_at: new Date().toISOString(),
          photo:      data.photo || null,
        };
        setSubmissions(prev => [newItem, ...prev]);
        setSuccessMsg("Your feedback has been submitted successfully!");
        setTimeout(() => setSuccessMsg(""), 4000);
        // Reset form
        setTitle(""); setDetails(""); setPhoto(null);
        setPhotoPreview(null); setRating(0); setType("issue");
        if (fileRef.current) fileRef.current.value = "";
      } else {
        alert("Failed to submit: " + (data.message || "Unknown error"));
      }
    } catch (err) {
      console.error("Submit error:", err);
      alert("Submission failed. Is your backend running?");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`http://localhost:5001/api/feedback/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSubmissions(prev => prev.filter(s => s.id !== id));
        setDeleteModal(null);
      } else {
        alert("Failed to delete.");
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const filtered = filterType === "all"
    ? submissions
    : submissions.filter(s => s.type === filterType);

  const formatDate = (d) => new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });

  const navItems = [
    { key: "dashboard",  icon: "⊞", label: "Dashboard",  path: "/dashboard"   },
    { key: "request",    icon: "+",  label: "New Request", path: "/new-request" },
    { key: "complaints", icon: "⚑",  label: "Complaints", path: "/complaints"  },
    { key: "payment",    icon: "💳",  label: "Payments",   path: "/payment"     },
    { key: "feedback",   icon: "💬", label: "Feedback",   path: "/feedback"    },
     { key: "leaderboard",   icon: "🏆",  label: "Leaderboard",   path: "/leaderboard"    },
      { key: "profile",   icon: "👤",  label: "Profile",   path: "/profile"    },
  ];

  return (
    <div className="fb-layout">

      {/* ════ NAVBAR ════ */}
      <nav className="fb-navbar">
        <div className="fb-nav-brand" onClick={() => navigate("/dashboard")}>
          <div className="fb-logo">♻</div>
          <span className="fb-brand-name">EcoConnect</span>
        </div>
        <div className="fb-nav-user">
          <span className="fb-nav-hello">Hello, {user?.name?.split(" ")[0]}</span>
          <div className="fb-avatar">
            {user?.image
              ? <img src={`http://localhost:5001/uploads/${user.image}`} alt="av" />
              : <span>{user?.name?.[0]?.toUpperCase()}</span>}
          </div>
        </div>
      </nav>

      <div className="fb-body">

        {/* ════ SIDEBAR ════ */}
        <aside className="fb-sidebar">
          {navItems.map(item => (
            <button
              key={item.key}
              className={`fb-nav-item ${activeMenu === item.key ? "fb-nav-active" : ""}`}
              onClick={() => { setActiveMenu(item.key); navigate(item.path); }}
            >
              <span className="fb-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </aside>

        {/* ════ MAIN ════ */}
        <main className="fb-main">

          {/* Page header */}
          <div className="fb-page-header">
            <div className="fb-page-header-left">
              <h1 className="fb-page-title">Feedback & Reporting</h1>
              <p className="fb-page-sub">Help us improve EcoConnect by sharing your experience</p>
            </div>
            <div className="fb-header-stats">
              <div className="fb-stat-pill">{submissions.length} Submissions</div>
              <div className="fb-stat-pill fb-stat-green">
                {submissions.filter(s => s.status === "resolved").length} Resolved
              </div>
            </div>
          </div>

          {/* Success toast */}
          {successMsg && (
            <div className="fb-toast">
              <span>✅</span> {successMsg}
            </div>
          )}

          <div className="fb-content-grid">

            {/* ── LEFT: SUBMISSION FORM ── */}
            <div className="fb-form-col">
              <div className="fb-form-card">
                <div className="fb-form-header">
                  <div className="fb-form-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="fb-form-title">Have an issue or suggestion?</h2>
                    <p className="fb-form-sub">Let us know how we can improve our services.</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="fb-form">

                  {/* Type selector */}
                  <div className="fb-field">
                    <label className="fb-label">Type of submission</label>
                    <div className="fb-type-grid">
                      {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                        <button
                          key={key}
                          type="button"
                          className={`fb-type-btn ${type === key ? "fb-type-active" : ""}`}
                          style={type === key ? { borderColor: cfg.color, background: cfg.bg } : {}}
                          onClick={() => setType(key)}
                        >
                          <span>{cfg.icon}</span>
                          <span>{cfg.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Title */}
                  <div className="fb-field">
                    <label className="fb-label">Title <span className="fb-required">*</span></label>
                    <input
                      type="text"
                      className="fb-input"
                      placeholder={
                        type === "issue"      ? "e.g. Missed garbage collection on Ward 5" :
                        type === "suggestion" ? "e.g. Add more recycling bins near park" :
                        type === "compliment" ? "e.g. Great service this week!" :
                        "e.g. Question about billing"
                      }
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      required
                    />
                  </div>

                  {/* Details */}
                  <div className="fb-field">
                    <label className="fb-label">Details <span className="fb-required">*</span></label>
                    <textarea
                      className="fb-textarea"
                      placeholder="Describe the issue or your feedback in detail..."
                      rows={5}
                      value={details}
                      onChange={e => setDetails(e.target.value)}
                      required
                    />
                    <div className="fb-char-count">{details.length} / 1000</div>
                  </div>

                  {/* Star rating */}
                  <div className="fb-field">
                    <label className="fb-label">Rate our service (optional)</label>
                    <div className="fb-stars">
                      {[1,2,3,4,5].map(star => (
                        <button
                          key={star}
                          type="button"
                          className={`fb-star ${star <= (hoverRating || rating) ? "fb-star-active" : ""}`}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setRating(star === rating ? 0 : star)}
                        >
                          ★
                        </button>
                      ))}
                      {rating > 0 && (
                        <span className="fb-star-label">
                          {["","Poor","Fair","Good","Great","Excellent!"][rating]}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Photo upload */}
                  <div className="fb-field">
                    <label className="fb-label">Attach a photo (optional)</label>
                    {photoPreview ? (
                      <div className="fb-photo-preview">
                        <img src={photoPreview} alt="preview" />
                        <button type="button" className="fb-photo-remove" onClick={removePhoto}>
                          ✕ Remove
                        </button>
                      </div>
                    ) : (
                      <div
                        className="fb-upload-zone"
                        onClick={() => fileRef.current?.click()}
                      >
                        <span className="fb-upload-icon">📎</span>
                        <span className="fb-upload-text">Click to attach a photo</span>
                        <span className="fb-upload-hint">JPG, PNG up to 5MB</span>
                      </div>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      style={{ display: "none" }}
                    />
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    className="fb-submit-btn"
                    disabled={submitting || !title.trim() || !details.trim()}
                  >
                    {submitting ? (
                      <><span className="fb-btn-spinner"></span> Submitting...</>
                    ) : (
                      <>Submit Feedback →</>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* ── RIGHT: SUBMISSIONS LIST ── */}
            <div className="fb-list-col">
              <div className="fb-list-header">
                <h2 className="fb-list-title">Your Submissions</h2>
                <div className="fb-filter-row">
                  {["all", "issue", "suggestion", "compliment", "other"].map(f => (
                    <button
                      key={f}
                      className={`fb-filter-btn ${filterType === f ? "fb-filter-active" : ""}`}
                      onClick={() => setFilterType(f)}
                    >
                      {f === "all" ? "All" : TYPE_CONFIG[f]?.icon + " " + TYPE_CONFIG[f]?.label.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="fb-loading">
                  <div className="fb-spinner"></div>
                  <p>Loading submissions...</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="fb-empty">
                  <span className="fb-empty-icon">📭</span>
                  <h3>No submissions yet</h3>
                  <p>{filterType === "all" ? "Submit your first feedback using the form!" : "No " + filterType + "s found."}</p>
                </div>
              ) : (
                <div className="fb-submissions-list">
                  {filtered.map((item, i) => {
                    const typeCfg   = TYPE_CONFIG[item.type]   || TYPE_CONFIG.other;
                    const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                    return (
                      <div
                        key={item.id}
                        className="fb-submission-card"
                        style={{ animationDelay: `${i * 0.06}s` }}
                      >
                        <div className="fb-submission-left">
                          <div
                            className="fb-submission-icon"
                            style={{ background: typeCfg.bg, color: typeCfg.color }}
                          >
                            {typeCfg.icon}
                          </div>
                        </div>
                        <div className="fb-submission-body">
                          <div className="fb-submission-top">
                            <h3 className="fb-submission-title">{item.title}</h3>
                            <button
                              className="fb-delete-btn"
                              onClick={() => setDeleteModal(item)}
                              title="Delete"
                            >🗑</button>
                          </div>
                          <p className="fb-submission-details">{item.details}</p>
                          <div className="fb-submission-meta">
                            <span className="fb-meta-date">
                              📅 {formatDate(item.created_at)}
                            </span>
                            {item.rating > 0 && (
                              <span className="fb-meta-rating">
                                {"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}
                              </span>
                            )}
                            {item.photo && (
                              <span className="fb-meta-photo">📷 Photo attached</span>
                            )}
                          </div>
                          {item.admin_response && (
                            <div className="fb-admin-response">
                              <span className="fb-admin-label">💬 Admin Response:</span>
                              <p>{item.admin_response}</p>
                            </div>
                          )}
                        </div>
                        <div className="fb-submission-right">
                          <span
                            className="fb-status-badge"
                            style={{ color: statusCfg.color, background: statusCfg.bg }}
                          >
                            {statusCfg.label}
                          </span>
                          <span
                            className="fb-type-tag"
                            style={{ color: typeCfg.color }}
                          >
                            {typeCfg.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ════ DELETE MODAL ════ */}
      {deleteModal && (
        <div className="fb-modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="fb-modal" onClick={e => e.stopPropagation()}>
            <div className="fb-modal-icon">🗑️</div>
            <h3>Delete This Submission?</h3>
            <p><strong>{deleteModal.title}</strong></p>
            <p className="fb-modal-warn">This cannot be undone.</p>
            <div className="fb-modal-btns">
              <button className="fb-modal-cancel" onClick={() => setDeleteModal(null)}>Cancel</button>
              <button className="fb-modal-confirm" onClick={() => handleDelete(deleteModal.id)}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
