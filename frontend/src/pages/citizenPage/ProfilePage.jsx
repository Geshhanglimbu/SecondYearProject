import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./ProfilePage.css";

const TABS = [
  { id: "overview",  label: "Overview",  icon: "◈" },
  { id: "edit",      label: "Edit Profile", icon: "✎" },
  { id: "security",  label: "Security",  icon: "🛡" },
  { id: "activity",  label: "Activity",  icon: "◉" },
];

const getEcoRank = (pts) => {
  if (pts >= 5000) return { rank: "A+++", color: "#f59e0b", desc: "Legendary Eco Champion", icon: "🏆", next: null,       nextPts: null };
  if (pts >= 3000) return { rank: "A++",  color: "#10b981", desc: "Outstanding Contributor", icon: "🌟", next: "A+++",    nextPts: 5000 };
  if (pts >= 1000) return { rank: "A+",   color: "#3b82f6", desc: "Green City Leader",       icon: "🌿", next: "A++",     nextPts: 3000 };
  return                   { rank: "B",   color: "#8b5cf6", desc: "Rising Eco Citizen",       icon: "🌱", next: "A+",      nextPts: 1000 };
};

export default function ProfilePage() {
  const navigate  = useNavigate();
  const [user, setUser]           = useState(null);
  const [profile, setProfile]     = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  // Edit form state
  const [editForm, setEditForm]   = useState({ name:"", email:"", phone:"", address:"", ward:"", bio:"" });
  const [pwForm, setPwForm]       = useState({ current:"", newPw:"", confirm:"" });
  const [pwMsg, setPwMsg]         = useState("");
  const [showPw, setShowPw]       = useState({ current:false, newPw:false, confirm:false });
  const [previewImg, setPreviewImg] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (!saved) { navigate("/login"); return; }
    const u = JSON.parse(saved);
    setUser(u);
    fetchProfile(u.id);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchProfile = async (id) => {
    try {
      const res  = await fetch(`http://localhost:5001/api/citizen/profile/${id}`);
      const data = await res.json();
      setProfile(data);
      setEditForm({
        name:    data.name    || "",
        email:   data.email   || "",
        phone:   data.phone   || "",
        address: data.address || "",
        ward:    data.ward    || "",
        bio:     data.bio     || "",
      });
    } catch(e) { console.error(e); }
    finally    { setLoading(false); }
  };

  const handleLogout = () => { localStorage.removeItem("user"); navigate("/login"); };

  const handleSaveProfile = async () => {
    setSaving(true); setSaveMsg("");
    try {
      const formData = new FormData();
      Object.entries(editForm).forEach(([k,v]) => formData.append(k, v));
      if (fileRef.current?.files[0]) formData.append("image", fileRef.current.files[0]);

      const res  = await fetch(`http://localhost:5001/api/citizen/profile/${user.id}`, {
        method: "PUT", body: formData,
      });
      const data = await res.json();
      const updated = { ...user, ...data.user };
      localStorage.setItem("user", JSON.stringify(updated));
      setUser(updated);
      setProfile(p => ({ ...p, ...data.user }));
      setSaveMsg("✓ Profile updated successfully!");
      if (data.user?.image) setPreviewImg(null);
    } catch(e) { setSaveMsg("✗ Update failed. Please try again."); }
    finally    { setSaving(false); setTimeout(() => setSaveMsg(""), 4000); }
  };

  const handleChangePassword = async () => {
    if (pwForm.newPw !== pwForm.confirm) { setPwMsg("✗ Passwords do not match."); return; }
    if (pwForm.newPw.length < 8)         { setPwMsg("✗ Minimum 8 characters."); return; }
    setPwMsg(""); setSaving(true);
    try {
      const res = await fetch(`http://localhost:5001/api/citizen/change-password/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.newPw }),
      });
      const data = await res.json();
      if (res.ok) { setPwMsg("✓ Password changed!"); setPwForm({ current:"", newPw:"", confirm:"" }); }
      else        { setPwMsg(`✗ ${data.message || "Failed."}`); }
    } catch { setPwMsg("✗ Server error."); }
    finally { setSaving(false); setTimeout(() => setPwMsg(""), 5000); }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPreviewImg(ev.target.result);
    reader.readAsDataURL(file);
  };

  const formatTime = () => currentTime.toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", hour12:true });
  const formatDay  = () => currentTime.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" });

  const eco   = profile ? getEcoRank(profile.points || 0) : null;
  const pct   = eco?.nextPts ? Math.min(100, ((profile?.points || 0) / eco.nextPts) * 100) : 100;
  const avatarSrc = previewImg
    || (profile?.image ? `http://localhost:5001/uploads/${profile.image}` : null);

  const navItems = [
    { id:"dashboard",  icon:"▦", label:"Dashboard",   path:"/dashboard"   },
    { id:"request",    icon:"+", label:"New Request", path:"/new-request" },
    { id:"complaints", icon:"⚑", label:"Complaints",  path:"/complaints"  },
    { id:"payment",    icon:"₨", label:"Payments",    path:"/payment"     },
    { id:"feedback",   icon:"✦", label:"Feedback",    path:"/feedback"    },
    { id:"profile",    icon:"◎", label:"Profile",     path:"/profile"     },
  ];

  return (
    <div className="pr-root">

      {/* ══ NAVBAR ══ */}
      <nav className="db-navbar">
        <div className="db-nav-brand">
          <div className="db-logo-mark">
            ♻
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
              {avatarSrc
                ? <img src={avatarSrc} alt="avatar" />
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

        {/* ══ SIDEBAR ══ */}
        <aside className="db-sidebar">
          <div className="db-sidebar-top">
            {navItems.map(item => (
              <button
                key={item.id}
                className={`db-nav-item ${item.id === "profile" ? "db-nav-active" : ""}`}
                onClick={() => navigate(item.path)}
              >
                <span className="db-nav-icon">{item.icon}</span>
                <span className="db-nav-label">{item.label}</span>
              </button>
            ))}
          </div>
          <div className="db-sidebar-quote">
            <div className="db-quote-line"></div>
            <p>"Your identity is your first step to a greener city."</p>
          </div>
        </aside>

        {/* ══ MAIN ══ */}
        <main className="pr-main">
          {loading ? (
            <div className="db-loading"><div className="db-spinner"></div><p>Loading profile…</p></div>
          ) : (
            <>
              {/* ── PROFILE HERO ── */}
              <div className="pr-hero">
                <div className="pr-hero-bg"></div>
                <div className="pr-hero-content">

                  {/* Avatar */}
                  <div className="pr-avatar-wrap">
                    <div className="pr-avatar-ring" style={{ borderColor: eco?.color }}>
                      {avatarSrc
                        ? <img src={avatarSrc} alt="profile" className="pr-avatar-img" />
                        : <span className="pr-avatar-init" style={{ background: eco?.color }}>
                            {profile?.name?.[0]?.toUpperCase() || "U"}
                          </span>}
                    </div>
                    <button className="pr-av-edit-btn" onClick={() => fileRef.current?.click()}>✎</button>
                    <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleImageChange} />
                  </div>

                  {/* Info */}
                  <div className="pr-hero-info">
                    <div className="pr-hero-name-row">
                      <h1 className="pr-hero-name">{profile?.name || "Citizen"}</h1>
                      <span className="pr-verified-badge">✓ Verified</span>
                    </div>
                    <p className="pr-hero-email">{profile?.email}</p>
                    {profile?.bio && <p className="pr-hero-bio">{profile.bio}</p>}
                    <div className="pr-hero-tags">
                      {profile?.ward    && <span className="pr-tag">📍 Ward {profile.ward}</span>}
                      {profile?.address && <span className="pr-tag">🏠 {profile.address}</span>}
                      {profile?.phone   && <span className="pr-tag">📞 {profile.phone}</span>}
                      <span className="pr-tag">🗓 Joined {new Date(profile?.created_at || Date.now()).toLocaleDateString("en-US",{month:"short",year:"numeric"})}</span>
                    </div>
                  </div>

                  {/* Eco badge */}
                  <div className="pr-eco-badge" style={{ "--eco-color": eco?.color }}>
                    <div className="pr-eco-ring">
                      <span className="pr-eco-icon">{eco?.icon}</span>
                      <span className="pr-eco-rank" style={{ color: eco?.color }}>{eco?.rank}</span>
                    </div>
                    <div className="pr-eco-label">{eco?.desc}</div>
                    <div className="pr-eco-pts-row">
                      <span className="pr-eco-pts" style={{ color: eco?.color }}>{(profile?.points || 0).toLocaleString()}</span>
                      <span className="pr-eco-pts-unit">pts</span>
                    </div>
                    {eco?.nextPts && (
                      <div className="pr-eco-progress-wrap">
                        <div className="pr-eco-progress-bar">
                          <div className="pr-eco-progress-fill" style={{ width: `${pct}%`, background: eco?.color }}></div>
                        </div>
                        <span className="pr-eco-next">{eco.nextPts - (profile?.points||0)} pts to {eco.next}</span>
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* ── TABS ── */}
              <div className="pr-tabs">
                {TABS.map(t => (
                  <button
                    key={t.id}
                    className={`pr-tab ${activeTab === t.id ? "pr-tab-active" : ""}`}
                    onClick={() => setActiveTab(t.id)}
                  >
                    <span className="pr-tab-icon">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ══ TAB: OVERVIEW ══ */}
              {activeTab === "overview" && (
                <div className="pr-panel pr-overview">
                  <div className="pr-overview-grid">

                    {/* Stats */}
                    <div className="pr-ov-card">
                      <h3 className="pr-ov-title">Impact Stats</h3>
                      <div className="pr-impact-list">
                        {[
                          { icon:"♻️", label:"Recycled",      val:`${profile?.recycledKg || 0} kg`,        color:"#10b981" },
                          { icon:"🌴", label:"Trees Planted",  val: profile?.treesPlanted || 0,             color:"#f59e0b" },
                          { icon:"🛡️", label:"Waste Reduced",  val:`${profile?.wasteReduced || 0}%`,         color:"#3b82f6" },
                          { icon:"📦", label:"Total Requests", val: Math.floor((profile?.points||0)/100),   color:"#8b5cf6" },
                          { icon:"⭐", label:"Eco Points",     val:(profile?.points||0).toLocaleString(),   color:"#f59e0b" },
                          { icon:"📝", label:"Feedbacks",      val: profile?.feedbackCount || 0,            color:"#06b6d4" },
                        ].map((s,i) => (
                          <div className="pr-impact-row" key={i}>
                            <span className="pr-impact-icon">{s.icon}</span>
                            <span className="pr-impact-label">{s.label}</span>
                            <span className="pr-impact-val" style={{ color: s.color }}>{s.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Account Info */}
                    <div className="pr-ov-card">
                      <h3 className="pr-ov-title">Account Details</h3>
                      <div className="pr-detail-list">
                        {[
                          { label:"Full Name",  val: profile?.name  || "—" },
                          { label:"Email",      val: profile?.email || "—" },
                          { label:"Phone",      val: profile?.phone || "—" },
                          { label:"Ward",       val: profile?.ward  || "—" },
                          { label:"Address",    val: profile?.address || "—" },
                          { label:"Member Since", val: new Date(profile?.created_at || Date.now()).toLocaleDateString("en-US",{day:"numeric",month:"long",year:"numeric"}) },
                        ].map((d,i) => (
                          <div className="pr-detail-row" key={i}>
                            <span className="pr-detail-label">{d.label}</span>
                            <span className="pr-detail-val">{d.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Rank Progress */}
                    <div className="pr-ov-card pr-rank-card">
                      <h3 className="pr-ov-title">Eco Rank Journey</h3>
                      <div className="pr-rank-journey">
                        {[
                          { rank:"B",    icon:"🌱", pts:0,    color:"#8b5cf6" },
                          { rank:"A+",   icon:"🌿", pts:1000, color:"#3b82f6" },
                          { rank:"A++",  icon:"🌟", pts:3000, color:"#10b981" },
                          { rank:"A+++", icon:"🏆", pts:5000, color:"#f59e0b" },
                        ].map((r, i) => {
                          const reached = (profile?.points||0) >= r.pts;
                          return (
                            <div className={`pr-rank-step ${reached ? "pr-rank-reached" : ""}`} key={i}>
                              <div className="pr-rank-step-icon" style={{ borderColor: reached ? r.color : "rgba(255,255,255,0.08)", background: reached ? r.color+"22" : "transparent" }}>
                                {r.icon}
                              </div>
                              <div className="pr-rank-step-info">
                                <span className="pr-rank-step-label" style={{ color: reached ? r.color : "#4b5563" }}>{r.rank}</span>
                                <span className="pr-rank-step-pts">{r.pts.toLocaleString()} pts</span>
                              </div>
                              {reached && <span className="pr-rank-check" style={{ color: r.color }}>✓</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* ══ TAB: EDIT PROFILE ══ */}
              {activeTab === "edit" && (
                <div className="pr-panel">
                  <div className="pr-form-grid">

                    {/* Avatar upload */}
                    <div className="pr-form-section pr-form-full">
                      <h3 className="pr-form-heading">Profile Photo</h3>
                      <div className="pr-av-upload-row">
                        <div className="pr-av-preview">
                          {avatarSrc
                            ? <img src={avatarSrc} alt="preview" />
                            : <span style={{ fontSize:"28px", color: eco?.color }}>{profile?.name?.[0]?.toUpperCase()}</span>}
                        </div>
                        <div>
                          <button className="pr-upload-btn" onClick={() => fileRef.current?.click()}>
                            Choose Photo
                          </button>
                          <p className="pr-upload-hint">JPG, PNG or WEBP · Max 5MB</p>
                        </div>
                      </div>
                    </div>

                    {/* Fields */}
                    {[
                      { label:"Full Name",    key:"name",    type:"text",  placeholder:"Your full name",      half:true  },
                      { label:"Email",        key:"email",   type:"email", placeholder:"your@email.com",      half:true  },
                      { label:"Phone",        key:"phone",   type:"tel",   placeholder:"+977 98XXXXXXXX",     half:true  },
                      { label:"Ward Number",  key:"ward",    type:"text",  placeholder:"e.g. 14",             half:true  },
                      { label:"Address",      key:"address", type:"text",  placeholder:"Your street address", half:false },
                    ].map(f => (
                      <div className={`pr-form-section ${f.half ? "" : "pr-form-full"}`} key={f.key}>
                        <label className="pr-form-label">{f.label}</label>
                        <input
                          type={f.type}
                          className="pr-form-input"
                          placeholder={f.placeholder}
                          value={editForm[f.key]}
                          onChange={e => setEditForm(ef => ({ ...ef, [f.key]: e.target.value }))}
                        />
                      </div>
                    ))}

                    <div className="pr-form-section pr-form-full">
                      <label className="pr-form-label">
                        Bio
                        <span className="pr-char-count">{editForm.bio.length}/200</span>
                      </label>
                      <textarea
                        className="pr-form-input pr-form-textarea"
                        placeholder="A short bio about yourself…"
                        value={editForm.bio}
                        rows={3}
                        onChange={e => setEditForm(ef => ({ ...ef, bio: e.target.value.slice(0,200) }))}
                      />
                    </div>

                    <div className="pr-form-section pr-form-full pr-form-actions">
                      {saveMsg && <p className={`pr-save-msg ${saveMsg.startsWith("✓") ? "pr-msg-ok" : "pr-msg-err"}`}>{saveMsg}</p>}
                      <button className={`pr-save-btn ${saving ? "pr-saving" : ""}`} onClick={handleSaveProfile} disabled={saving}>
                        {saving ? <><span className="db-spinner pr-inline-spin"></span> Saving…</> : "Save Changes"}
                      </button>
                    </div>

                  </div>
                </div>
              )}

              {/* ══ TAB: SECURITY ══ */}
              {activeTab === "security" && (
                <div className="pr-panel">
                  <div className="pr-security-wrap">
                    <h3 className="pr-form-heading">Change Password</h3>
                    <p className="pr-security-sub">Use a strong password with at least 8 characters, a number, and a special character.</p>

                    <div className="pr-pw-fields">
                      {[
                        { label:"Current Password",  key:"current", ph:"Enter current password" },
                        { label:"New Password",       key:"newPw",   ph:"Min. 8 characters"      },
                        { label:"Confirm Password",   key:"confirm", ph:"Re-enter new password"  },
                      ].map(f => (
                        <div className="pr-pw-field" key={f.key}>
                          <label className="pr-form-label">{f.label}</label>
                          <div className="pr-pw-wrap">
                            <input
                              type={showPw[f.key] ? "text" : "password"}
                              className="pr-form-input"
                              placeholder={f.ph}
                              value={pwForm[f.key]}
                              onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))}
                            />
                            <button className="pr-pw-eye" onClick={() => setShowPw(s => ({ ...s, [f.key]: !s[f.key] }))}>
                              {showPw[f.key] ? "🙈" : "👁"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {pwMsg && <p className={`pr-save-msg ${pwMsg.startsWith("✓") ? "pr-msg-ok" : "pr-msg-err"}`}>{pwMsg}</p>}
                    <button className={`pr-save-btn ${saving ? "pr-saving" : ""}`} onClick={handleChangePassword} disabled={saving}>
                      {saving ? "Updating…" : "Update Password"}
                    </button>

                    {/* Security tips */}
                    <div className="pr-security-tips">
                      <h4>Security Tips</h4>
                      {[
                        "Never share your password with anyone, including EcoConnect staff.",
                        "Use a unique password that you don't use on other websites.",
                        "Enable email alerts for any suspicious login activity.",
                      ].map((tip,i) => (
                        <div className="pr-tip-row" key={i}>
                          <span className="pr-tip-dot"></span>
                          <span>{tip}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ══ TAB: ACTIVITY ══ */}
              {activeTab === "activity" && (
                <div className="pr-panel">
                  <div className="pr-activity-wrap">
                    <h3 className="pr-form-heading">Recent Activity</h3>
                    <div className="pr-activity-list">
                      {(profile?.activity || []).length === 0 ? (
                        <div className="pr-activity-empty">
                          <span>📭</span>
                          <p>No activity recorded yet. Start scheduling pickups and earning eco-points!</p>
                          <button className="pr-save-btn" onClick={() => navigate("/new-request")}>Schedule First Pickup</button>
                        </div>
                      ) : profile.activity.map((a, i) => (
                        <div className="pr-activity-item" key={i}>
                          <div className="pr-act-icon" style={{ background: a.color+"22", color: a.color }}>{a.icon}</div>
                          <div className="pr-act-body">
                            <span className="pr-act-title">{a.title}</span>
                            <span className="pr-act-date">{new Date(a.date).toLocaleDateString("en-US",{day:"numeric",month:"short",year:"numeric"})}</span>
                          </div>
                          {a.points && <span className="pr-act-pts">+{a.points} pts</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </>
          )}
        </main>
      </div>

      {/* ══ FOOTER ══ */}
      <footer className="db-footer">
        <div className="db-footer-bottom" style={{ borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:"16px" }}>
          <span>© 2025 EcoConnect. All rights reserved.</span>
          <div className="db-footer-bottom-links">
            <a href="#">Privacy</a><span>·</span>
            <a href="#">Terms</a><span>·</span>
            <a href="#">Cookies</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
