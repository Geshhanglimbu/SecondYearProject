import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./Leaderboard.css";

const BASE = "http://localhost:5001";

/* ── Animated counter ── */
function Counter({ to, duration = 1200 }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = to / (duration / 16);
    const timer = setInterval(() => {
      start = Math.min(start + step, to);
      setVal(Math.floor(start));
      if (start >= to) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [to]);
  return <>{val.toLocaleString()}</>;
}

/* ── Circular progress ring ── */
function Ring({ pct, size = 120, stroke = 10, color = "#22c55e", children }) {
  const r   = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="lb-ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4}
          strokeLinecap="round" style={{ transition: "stroke-dasharray 1s ease" }}/>
      </svg>
      <div className="lb-ring-inner">{children}</div>
    </div>
  );
}

/* ── Badge card ── */
function BadgeCard({ badge }) {
  return (
    <div className={`lb-badge-card ${badge.earned ? "lb-badge-earned" : "lb-badge-locked"}`}>
      <div className="lb-badge-icon">{badge.earned ? badge.icon : "🔒"}</div>
      <div className="lb-badge-name">{badge.name}</div>
      <div className="lb-badge-desc">{badge.desc}</div>
      {badge.earned && <div className="lb-badge-check">✓</div>}
    </div>
  );
}

/* ── Rank medal ── */
function Medal({ rank }) {
  if (rank === 1) return <span className="lb-medal lb-gold">🥇</span>;
  if (rank === 2) return <span className="lb-medal lb-silver">🥈</span>;
  if (rank === 3) return <span className="lb-medal lb-bronze">🥉</span>;
  return <span className="lb-rank-num">#{rank}</span>;
}

/* ── Activity type config ── */
const ACTIVITY_META = {
  request : { icon: "🗑️", color: "#22c55e", label: "Request" },
  payment : { icon: "💳", color: "#3b82f6", label: "Payment" },
  feedback: { icon: "📢", color: "#8b5cf6", label: "Feedback" },
};

export default function Leaderboard() {
  const navigate = useNavigate();
  const [user, setUser]             = useState(null);
  const [myData, setMyData]         = useState(null);
  const [topList, setTopList]       = useState([]);
  const [history, setHistory]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState("overview");
  const [lbSearch, setLbSearch]     = useState("");
  const [activeMenu, setActiveMenu] = useState("leaderboard");

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { navigate("/login"); return; }
    const u = JSON.parse(stored);
    setUser(u);
    loadAll(u.id);
  }, []);

  const loadAll = async (userId) => {
    try {
      // Sync first so stats are fresh
      await fetch(`${BASE}/api/leaderboard/sync/${userId}`, { method: "POST" });

      const [me, top, hist] = await Promise.all([
        fetch(`${BASE}/api/leaderboard/me/${userId}`).then(r => r.json()),
        fetch(`${BASE}/api/leaderboard/top`).then(r => r.json()),
        fetch(`${BASE}/api/leaderboard/history/${userId}`).then(r => r.json()),
      ]);
      setMyData(me);
      setTopList(Array.isArray(top) ? top : []);
      setHistory(Array.isArray(hist) ? hist : []);
    } catch (e) {
      console.error("Leaderboard load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredTop = topList.filter(c =>
    !lbSearch || (c.name||"").toLowerCase().includes(lbSearch.toLowerCase())
  );

  const myEntry = topList.find(c => c.user_id === user?.id);

  if (loading) return (
    <div className="lb-loading">
      <div className="lb-loading-ring"/>
      <p>Loading your eco profile…</p>
    </div>
  );

  const { points = 0, rank = "—", level = {}, nextLevel, progress = 0, stats = {}, badges = [], allBadges = [], pointValues = {} } = myData || {};

  const navItems = [
    { key: "dashboard",   icon: "⊞", label: "Dashboard",   path: "/dashboard"   },
    { key: "newrequest",  icon: "+",  label: "New Request",  path: "/new-request" },
    { key: "complaints",  icon: "⚑",  label: "Complaints",  path: "/complaints"  },
    { key: "leaderboard", icon: "🏆", label: "Leaderboard", path: "/leaderboard" },
    { key: "payments",    icon: "💳", label: "Payments",    path: "/payment"     },
    { key: "feedback",    icon: "✦",  label: "Feedback",    path: "/Feedback"    },
     { key: "profile",   icon: "👤",  label: "Profile",   path: "/profile"    },
  ];

  return (
    <div className="lb-root">

      {/* ══ NAVBAR ══ */}
      <nav className="lb-navbar">
        <div className="lb-nav-brand">
          <span className="lb-nav-logo">♻</span>
          <span className="lb-nav-title">EcoConnect</span>
        </div>
        <div className="lb-nav-right">
          <div className="lb-nav-pts">
            <span className="lb-nav-pts-icon">{level.icon}</span>
            <span className="lb-nav-pts-val">{points.toLocaleString()} pts</span>
          </div>
          <div className="lb-nav-avatar">
            {user?.image
              ? <img src={`${BASE}/uploads/${user.image}`} alt="avatar"/>
              : <span>{user?.name?.[0]?.toUpperCase()}</span>
            }
          </div>
        </div>
      </nav>

      <div className="lb-body">

        {/* ══ SIDEBAR ══ */}
        <aside className="lb-sidebar">
          {navItems.map(item => (
            <button key={item.key}
              className={`lb-nav-item ${activeMenu === item.key ? "lb-nav-active" : ""}`}
              onClick={() => { setActiveMenu(item.key); navigate(item.path); }}
            >
              <span className="lb-nav-icon">{item.icon}</span>
              <span className="lb-nav-label">{item.label}</span>
            </button>
          ))}

          {/* Mini rank card in sidebar */}
          <div className="lb-sidebar-rank">
            <div className="lb-sidebar-rank-label">Your Rank</div>
            <div className="lb-sidebar-rank-val">#{rank}</div>
            <div className="lb-sidebar-rank-pts">{points.toLocaleString()} pts</div>
            <div className="lb-sidebar-level" style={{ color: level.color }}>
              {level.icon} {level.name}
            </div>
          </div>
        </aside>

        {/* ══ MAIN ══ */}
        <main className="lb-main">

          {/* ── HERO BANNER ── */}
          <div className="lb-hero" style={{ "--level-color": level.color || "#22c55e" }}>
            <div className="lb-hero-left">
              <div className="lb-hero-greeting">
                Welcome back, <strong>{user?.name?.split(" ")[0]}</strong>
              </div>
              <div className="lb-hero-level">
                <span className="lb-hero-level-icon">{level.icon}</span>
                <div>
                  <div className="lb-hero-level-name">{level.name}</div>
                  <div className="lb-hero-level-sub">
                    {nextLevel ? `${nextLevel.min - points} pts to ${nextLevel.name}` : "Max level reached!"}
                  </div>
                </div>
              </div>
              <div className="lb-hero-progress-wrap">
                <div className="lb-hero-progress-bar">
                  <div className="lb-hero-progress-fill" style={{ width: `${progress}%`, background: level.color }}/>
                </div>
                <span className="lb-hero-progress-pct">{progress}%</span>
              </div>
            </div>

            <div className="lb-hero-center">
              <Ring pct={progress} size={140} stroke={12} color={level.color}>
                <div className="lb-hero-ring-pts"><Counter to={points}/></div>
                <div className="lb-hero-ring-label">points</div>
              </Ring>
            </div>

            <div className="lb-hero-right">
              <div className="lb-hero-rank-card">
                <div className="lb-hero-rank-num">#{rank}</div>
                <div className="lb-hero-rank-lbl">City Rank</div>
              </div>
              <div className="lb-hero-badges-preview">
                {badges.slice(0,4).map(b => (
                  <span key={b.id} className="lb-hero-badge-dot" title={b.name}>{b.icon}</span>
                ))}
                {badges.length > 4 && <span className="lb-hero-badge-more">+{badges.length-4}</span>}
              </div>
            </div>
          </div>

          {/* ── QUICK STATS ── */}
          <div className="lb-quick-stats">
            {[
              { label:"Requests Done",   value: stats.completed_requests || 0, icon:"✅", color:"#22c55e" },
              { label:"Total Requests",  value: stats.total_requests || 0,     icon:"📋", color:"#3b82f6" },
              { label:"Bills Paid",      value: stats.paid_payments || 0,      icon:"💳", color:"#8b5cf6" },
              { label:"Feedback Given",  value: stats.total_feedback || 0,     icon:"📢", color:"#f59e0b" },
              { label:"Badges Earned",   value: badges.length,                 icon:"🏅", color:"#ef4444" },
            ].map((s,i) => (
              <div key={i} className="lb-quick-stat" style={{ "--c": s.color }}>
                <div className="lb-qs-icon">{s.icon}</div>
                <div className="lb-qs-val"><Counter to={s.value}/></div>
                <div className="lb-qs-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── TABS ── */}
          <div className="lb-tabs">
            {[
              { key:"overview",    label:"Overview"    },
              { key:"leaderboard", label:"Leaderboard" },
              { key:"badges",      label:`Badges (${badges.length}/${allBadges.length})` },
              { key:"history",     label:"Activity"    },
              { key:"rewards",     label:"How to Earn" },
            ].map(t => (
              <button key={t.key}
                className={`lb-tab ${activeTab===t.key?"lb-tab-active":""}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ══ OVERVIEW ══ */}
          {activeTab === "overview" && (
            <div className="lb-panel">
              <div className="lb-overview-grid">

                {/* Level progress card */}
                <div className="lb-ov-card lb-ov-level">
                  <h3>Level Progress</h3>
                  <div className="lb-ov-levels">
                    {[
                      { name:"Seedling",   icon:"🌱", min:0,    color:"#84cc16" },
                      { name:"Grower",     icon:"🌿", min:100,  color:"#22c55e" },
                      { name:"Guardian",   icon:"🛡️", min:300,  color:"#10b981" },
                      { name:"Champion",   icon:"⚡", min:700,  color:"#3b82f6" },
                      { name:"Eco Legend", icon:"🏆", min:1500, color:"#f59e0b" },
                    ].map((lv, i) => {
                      const isActive  = level.name === lv.name;
                      const isPast    = points >= lv.min;
                      return (
                        <div key={i} className={`lb-ov-lv-row ${isActive?"lb-ov-lv-active":""} ${isPast?"lb-ov-lv-past":""}`}>
                          <span className="lb-ov-lv-icon">{lv.icon}</span>
                          <div className="lb-ov-lv-info">
                            <span className="lb-ov-lv-name" style={isActive?{color:lv.color}:{}}>{lv.name}</span>
                            <span className="lb-ov-lv-pts">{lv.min.toLocaleString()} pts</span>
                          </div>
                          {isPast && <span className="lb-ov-lv-done" style={{color:lv.color}}>✓</span>}
                          {isActive && <span className="lb-ov-lv-here">← You</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recent badges */}
                <div className="lb-ov-card">
                  <h3>Recent Badges</h3>
                  {badges.length === 0
                    ? <div className="lb-ov-empty">Complete your first request to earn badges!</div>
                    : <div className="lb-ov-badges-mini">
                        {badges.slice(0,6).map(b => (
                          <div key={b.id} className="lb-ov-badge-row">
                            <span className="lb-ov-badge-icon">{b.icon}</span>
                            <div>
                              <div className="lb-ov-badge-name">{b.name}</div>
                              <div className="lb-ov-badge-desc">{b.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                  }
                </div>

                {/* Nearby on leaderboard */}
                <div className="lb-ov-card lb-ov-nearby">
                  <h3>Your Position</h3>
                  {topList.slice(Math.max(0,(myEntry?.rank||1)-3), (myEntry?.rank||1)+2).map(c => (
                    <div key={c.user_id} className={`lb-ov-near-row ${c.user_id===user?.id?"lb-ov-near-me":""}`}>
                      <Medal rank={c.rank}/>
                      <div className="lb-ov-near-avatar">
                        {c.image ? <img src={`${BASE}/uploads/${c.image}`} alt=""/> : <span>{(c.name||"?")[0]}</span>}
                      </div>
                      <span className="lb-ov-near-name">{c.user_id===user?.id?"You ✦":c.name}</span>
                      <span className="lb-ov-near-pts">{c.points.toLocaleString()} pts</span>
                    </div>
                  ))}
                </div>

              </div>
            </div>
          )}

          {/* ══ LEADERBOARD ══ */}
          {activeTab === "leaderboard" && (
            <div className="lb-panel">
              {/* Top 3 podium */}
              {topList.length >= 3 && (
                <div className="lb-podium">
                  {[topList[1], topList[0], topList[2]].map((c, i) => {
                    const pos = [2,1,3][i];
                    const heights = ["120px","150px","90px"];
                    return (
                      <div key={c.user_id} className={`lb-pod lb-pod-${pos} ${c.user_id===user?.id?"lb-pod-me":""}`}>
                        <div className="lb-pod-avatar">
                          {c.image ? <img src={`${BASE}/uploads/${c.image}`} alt=""/> : <span>{(c.name||"?")[0]}</span>}
                        </div>
                        <div className="lb-pod-name">{c.user_id===user?.id?"You":c.name?.split(" ")[0]}</div>
                        <div className="lb-pod-pts">{c.points.toLocaleString()}</div>
                        <div className="lb-pod-level" style={{color:c.level?.color}}>{c.level?.icon} {c.level?.name}</div>
                        <div className="lb-pod-base" style={{ height: heights[i] }}>
                          <Medal rank={pos}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="lb-lb-controls">
                <div className="lb-lb-search-wrap">
                  <span>🔍</span>
                  <input className="lb-lb-search" placeholder="Search citizens…"
                    value={lbSearch} onChange={e => setLbSearch(e.target.value)}/>
                </div>
                <span className="lb-lb-count">{filteredTop.length} citizens</span>
              </div>

              <div className="lb-lb-list">
                {filteredTop.map((c, i) => {
                  const isMe = c.user_id === user?.id;
                  return (
                    <div key={c.user_id} className={`lb-lb-row ${isMe?"lb-lb-row-me":""}`}
                      style={{ animationDelay:`${i*0.03}s` }}>
                      <div className="lb-lb-rank"><Medal rank={c.rank}/></div>
                      <div className="lb-lb-avatar">
                        {c.image ? <img src={`${BASE}/uploads/${c.image}`} alt=""/> : <span>{(c.name||"?")[0]}</span>}
                      </div>
                      <div className="lb-lb-info">
                        <div className="lb-lb-name">{isMe ? <><strong>You</strong> ({c.name})</> : c.name}</div>
                        <div className="lb-lb-meta">
                          <span style={{color:c.level?.color}}>{c.level?.icon} {c.level?.name}</span>
                          {c.ward && <span>· Ward {c.ward}</span>}
                          <span>· {c.completed_requests} completed</span>
                        </div>
                      </div>
                      <div className="lb-lb-pts">
                        <span className="lb-lb-pts-val">{c.points.toLocaleString()}</span>
                        <span className="lb-lb-pts-label">pts</span>
                      </div>
                      {isMe && <span className="lb-lb-you-tag">You</span>}
                    </div>
                  );
                })}
                {filteredTop.length === 0 && (
                  <div className="lb-ov-empty">No results found.</div>
                )}
              </div>
            </div>
          )}

          {/* ══ BADGES ══ */}
          {activeTab === "badges" && (
            <div className="lb-panel">
              <div className="lb-badges-summary">
                <div className="lb-badges-count">
                  <span className="lb-bc-val">{badges.length}</span>
                  <span className="lb-bc-total">/ {allBadges.length}</span>
                  <span className="lb-bc-label">Badges Earned</span>
                </div>
                <div className="lb-badges-bar-wrap">
                  <div className="lb-badges-bar">
                    <div className="lb-badges-bar-fill" style={{ width:`${(badges.length/allBadges.length)*100}%`}}/>
                  </div>
                  <span>{Math.round((badges.length/allBadges.length)*100)}% complete</span>
                </div>
              </div>

              <div className="lb-badges-section">
                <div className="lb-badges-section-head">🏅 Earned ({badges.length})</div>
                <div className="lb-badges-grid">
                  {allBadges.filter(b=>b.earned).map(b => <BadgeCard key={b.id} badge={b}/>)}
                  {badges.length === 0 && <div className="lb-ov-empty">Submit your first request to earn a badge!</div>}
                </div>
              </div>

              <div className="lb-badges-section">
                <div className="lb-badges-section-head">🔒 Locked ({allBadges.filter(b=>!b.earned).length})</div>
                <div className="lb-badges-grid">
                  {allBadges.filter(b=>!b.earned).map(b => <BadgeCard key={b.id} badge={b}/>)}
                </div>
              </div>
            </div>
          )}

          {/* ══ ACTIVITY HISTORY ══ */}
          {activeTab === "history" && (
            <div className="lb-panel">
              <h3 className="lb-panel-title">Recent Activity</h3>
              {history.length === 0
                ? <div className="lb-ov-empty">No activity yet. Submit a request to get started!</div>
                : (
                  <div className="lb-history-list">
                    {history.map((h, i) => {
                      const meta = ACTIVITY_META[h.type] || ACTIVITY_META.request;
                      const pts  = h.points_earned || 0;
                      const date = new Date(h.created_at).toLocaleDateString("en-US",{month:"short",day:"2-digit",year:"numeric"});
                      return (
                        <div key={i} className="lb-history-row" style={{ animationDelay:`${i*0.04}s` }}>
                          <div className="lb-hist-icon" style={{ background:`${meta.color}18`, color:meta.color }}>
                            {meta.icon}
                          </div>
                          <div className="lb-hist-info">
                            <div className="lb-hist-title">{meta.label}: {h.detail || "—"}</div>
                            <div className="lb-hist-meta">
                              <span className={`lb-hist-status lb-hist-${h.status}`}>{h.status}</span>
                              <span>{date}</span>
                            </div>
                          </div>
                          {pts > 0 && (
                            <div className="lb-hist-pts">+{pts} pts</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              }
            </div>
          )}

          {/* ══ HOW TO EARN ══ */}
          {activeTab === "rewards" && (
            <div className="lb-panel">
              <h3 className="lb-panel-title">How to Earn Points</h3>
              <div className="lb-rewards-grid">
                {[
                  { icon:"🗑️", action:"Submit a request",        pts: pointValues.request_submitted || 10,  color:"#22c55e", tip:"Every pickup or waste request earns points." },
                  { icon:"✅", action:"Request completed",        pts: pointValues.request_completed || 50,  color:"#3b82f6", tip:"Earn big when staff marks your request done." },
                  { icon:"💳", action:"Pay a bill on time",       pts: pointValues.payment_paid      || 20,  color:"#8b5cf6", tip:"Settle your waste management fees." },
                  { icon:"⚖️", action:"Clear a fine",            pts: pointValues.fine_cleared      || 15,  color:"#f59e0b", tip:"Resolve any outstanding fines." },
                  { icon:"📢", action:"Submit feedback",          pts: pointValues.feedback_given    || 5,   color:"#ef4444", tip:"Help improve the city by sharing feedback." },
                  { icon:"🔥", action:"7-day activity streak",    pts: pointValues.streak_bonus      || 25,  color:"#f97316", tip:"Stay active every week for bonus points." },
                ].map((r,i) => (
                  <div key={i} className="lb-reward-card" style={{ "--rc": r.color }}>
                    <div className="lb-reward-icon">{r.icon}</div>
                    <div className="lb-reward-action">{r.action}</div>
                    <div className="lb-reward-pts" style={{ color:r.color }}>+{r.pts} pts</div>
                    <div className="lb-reward-tip">{r.tip}</div>
                  </div>
                ))}
              </div>

              <h3 className="lb-panel-title" style={{marginTop:32}}>Level Milestones</h3>
              <div className="lb-milestones">
                {[
                  { name:"Seedling",   icon:"🌱", min:0,    max:99,   color:"#84cc16", perk:"Access to basic waste requests" },
                  { name:"Grower",     icon:"🌿", min:100,  max:299,  color:"#22c55e", perk:"Priority request processing" },
                  { name:"Guardian",   icon:"🛡️", min:300,  max:699,  color:"#10b981", perk:"Monthly eco report card" },
                  { name:"Champion",   icon:"⚡", min:700,  max:1499, color:"#3b82f6", perk:"Featured on community board" },
                  { name:"Eco Legend", icon:"🏆", min:1500, max:null, color:"#f59e0b", perk:"City Eco Ambassador status" },
                ].map((lv,i) => {
                  const isActive = level.name === lv.name;
                  return (
                    <div key={i} className={`lb-milestone ${isActive?"lb-milestone-active":""}`}
                      style={{ "--mc": lv.color }}>
                      <div className="lb-ms-icon">{lv.icon}</div>
                      <div className="lb-ms-info">
                        <div className="lb-ms-name" style={isActive?{color:lv.color}:{}}>{lv.name} {isActive&&"← You"}</div>
                        <div className="lb-ms-range">{lv.min.toLocaleString()} – {lv.max?lv.max.toLocaleString():"∞"} pts</div>
                        <div className="lb-ms-perk">🎁 {lv.perk}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ══ FOOTER ══ */}
      <footer className="lb-footer">
        <div className="lb-footer-inner">
          <span>© 2025 EcoConnect · Kathmandu, Nepal</span>
          <span>Keep the city clean · Earn rewards · Rise the ranks</span>
        </div>
      </footer>

    </div>
  );
}
