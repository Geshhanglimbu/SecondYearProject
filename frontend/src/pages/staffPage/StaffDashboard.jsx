import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./StaffDashboard.css";
import { Link } from "react-router-dom";

// ── Lightweight bar chart (no external lib needed) ──
function WeeklyChart({ data }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="stf-chart-wrap">
      {data.map((d, i) => (
        <div key={i} className="stf-chart-col">
          <span className="stf-chart-val">{d.count}</span>
          <div className="stf-chart-bar-bg">
            <div
              className="stf-chart-bar-fill"
              style={{ height: `${(d.count / max) * 100}%` }}
            />
          </div>
          <span className="stf-chart-day">{d.day}</span>
        </div>
      ))}
    </div>
  );
}

// ── Mini map (OpenStreetMap iframe, no API key needed) ──
function RouteMap({ tasks }) {
  const locations = tasks.filter(t => t.location && t.location !== "—").slice(0, 5);
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=85.2,27.6,85.4,27.8&layer=mapnik&marker=27.7172,85.3240`;
  return (
    <div className="stf-map-wrap">
      <iframe
        title="Task Map"
        src={src}
        className="stf-map-iframe"
        loading="lazy"
      />
      <div className="stf-map-pins">
        {locations.length === 0
          ? <p className="stf-map-empty">No location data available</p>
          : locations.map((t, i) => (
            <div key={i} className="stf-map-pin-item">
              <span className="stf-map-pin-dot" style={{ background: t.status === "completed" ? "var(--green-500)" : t.status === "in_progress" ? "var(--purple)" : "var(--amber)" }} />
              <span className="stf-map-pin-label">{t.id} — {t.location}</span>
              <span className={`stf-status-badge ${t.status === "completed" ? "stf-badge-completed" : t.status === "in_progress" ? "stf-badge-inprogress" : "stf-badge-pending"}`}>
                {t.status === "in_progress" ? "In Progress" : t.status === "completed" ? "Done" : "Pending"}
              </span>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── Weather widget (Open-Meteo, free, no key) ──
function WeatherWidget() {
  const [weather, setWeather] = useState(null);
  const [wLoading, setWLoading] = useState(true);

  useEffect(() => {
    fetch("https://api.open-meteo.com/v1/forecast?latitude=27.7172&longitude=85.3240&current=temperature_2m,weathercode,windspeed_10m,relative_humidity_2m&timezone=Asia/Kathmandu")
      .then(r => r.json())
      .then(d => {
        const code = d.current.weathercode;
        const emoji =
          code === 0 ? "☀️" :
          code <= 2  ? "⛅" :
          code <= 48 ? "☁️" :
          code <= 67 ? "🌧️" :
          code <= 77 ? "❄️" :
          code <= 82 ? "🌦️" : "⛈️";
        const desc =
          code === 0 ? "Clear sky" :
          code <= 2  ? "Partly cloudy" :
          code <= 48 ? "Overcast / Fog" :
          code <= 67 ? "Rain" :
          code <= 77 ? "Snow" :
          code <= 82 ? "Showers" : "Thunderstorm";
        setWeather({
          temp: Math.round(d.current.temperature_2m),
          wind: Math.round(d.current.windspeed_10m),
          humidity: d.current.relative_humidity_2m,
          emoji, desc,
        });
      })
      .catch(() => setWeather(null))
      .finally(() => setWLoading(false));
  }, []);

  if (wLoading) return (
    <div className="stf-weather-card stf-weather-loading">
      <div className="stf-spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
      <span>Fetching weather…</span>
    </div>
  );

  if (!weather) return (
    <div className="stf-weather-card stf-weather-error">
      <span>🌐</span>
      <span>Weather unavailable</span>
    </div>
  );

  return (
    <div className="stf-weather-card">
      <div className="stf-weather-left">
        <div className="stf-weather-emoji">{weather.emoji}</div>
        <div>
          <div className="stf-weather-temp">{weather.temp}°C</div>
          <div className="stf-weather-desc">{weather.desc}</div>
          <div className="stf-weather-loc">📍 Kathmandu, Nepal</div>
        </div>
      </div>
      <div className="stf-weather-right">
        <div className="stf-weather-stat">
          <span>💨</span>
          <span>{weather.wind} km/h</span>
          <small>Wind</small>
        </div>
        <div className="stf-weather-stat">
          <span>💧</span>
          <span>{weather.humidity}%</span>
          <small>Humidity</small>
        </div>
        <div className="stf-weather-tip">
          {weather.desc.includes("Rain") || weather.desc.includes("Thunder")
            ? "⚠️ Carry rain gear today"
            : weather.temp > 30
            ? "🥤 Stay hydrated on field"
            : " Good conditions for fieldwork"}
        </div>
      </div>
    </div>
  );
}

const BASE = "http://localhost:5001"; // ← single place to change your API base URL

export default function StaffDashboard() {
  const navigate = useNavigate();

  const [tasks,        setTasks]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState("active");
  const [activePage,   setActivePage]   = useState("dashboard");
  const [actionMenu,   setActionMenu]   = useState(null);
  const [toast,        setToast]        = useState(null);
  const [logoutModal,  setLogoutModal]  = useState(false);
  const [updates,      setUpdates]      = useState([]);
  const [staffUser,    setStaffUser]    = useState(null);
  const [currentTime,  setCurrentTime]  = useState(new Date());

  const [darkMode,      setDarkMode]      = useState(() => localStorage.getItem("stf-dark") === "true");
  const [dailyGoal,     setDailyGoal]     = useState(10);
  const [streak,        setStreak]        = useState(() => parseInt(localStorage.getItem("stf-streak") || "0"));
  const [notifications, setNotifications] = useState([]);
  const [notifOpen,     setNotifOpen]     = useState(false);
  const [weeklyData,    setWeeklyData]    = useState([]);
  const notifRef = useRef(null);

  // ── Dark mode ──
  useEffect(() => {
    document.body.classList.toggle("stf-dark", darkMode);
    localStorage.setItem("stf-dark", darkMode);
  }, [darkMode]);

  // ── Load staff user from localStorage ──
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { navigate("/login"); return; }
    setStaffUser(JSON.parse(stored));
  }, []);

  // ── Live clock ──
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = () => currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  const formatDay  = () => currentTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const hour       = currentTime.getHours();
  const greeting   = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  // ════════════════════════════════════════════════
  // FIX 1 — fetch from /api/staff/schedules with
  //          staff_id so only THIS worker's tasks come back.
  //          The old code used /schedules with no filter,
  //          returning every schedule in the database.
  // ════════════════════════════════════════════════
  const fetchSchedules = async (user) => {
    // Use the user passed in directly (avoids stale closure on staffUser)
    const staffId = user?.id;
    if (!staffId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // ✅ FIXED URL — was: /schedules (no filter)
      //               now: /api/staff/schedules?staff_id=X
      const res  = await fetch(`${BASE}/api/staff/schedules?staff_id=${staffId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const safe = Array.isArray(data) ? data : [];

      const formatted = safe.map(s => ({
        id:       `SCH-${s.id}`,
        dbId:     s.id,
        name:     s.type || s.area || "General Task",
        location: s.location || s.area || "—",
        date:     s.collection_date,
        time:     s.pickup_time || "—",
        citizen:  s.citizen_name || "Unknown",
        status:   s.status || "pending",
      }));

      setTasks(prev => {
        if (prev.length > 0 && formatted.length > prev.length) {
          const newOnes = formatted.slice(prev.length);
          setNotifications(n => [
            ...newOnes.map(t => ({ id: t.id, msg: `New task assigned: ${t.id}`, time: "Just now", read: false })),
            ...n,
          ]);
        }
        return formatted;
      });

      buildWeeklyData(formatted);
    } catch (err) {
      console.error("fetchSchedules error:", err);
      showToast("Failed to load tasks", "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Build weekly chart from completed tasks ──
  const buildWeeklyData = (taskList) => {
    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const today = new Date();
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      return { day: days[d.getDay()], date: d.toDateString(), count: 0 };
    });
    taskList.filter(t => t.status === "completed" && t.date).forEach(t => {
      const td = new Date(t.date).toDateString();
      const slot = week.find(w => w.date === td);
      if (slot) slot.count++;
    });
    setWeeklyData(week);
  };

  // ════════════════════════════════════════════════
  // FIX 2 — wait for staffUser to be set before fetching.
  //          The old code called fetchSchedules() in a
  //          separate useEffect that ran before staffUser
  //          was populated, so staffId was always null/undefined.
  // ════════════════════════════════════════════════
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { navigate("/login"); return; }
    const parsed = JSON.parse(stored);
    setStaffUser(parsed);
    fetchSchedules(parsed); // ✅ pass user directly, no stale closure
  }, []);

  useEffect(() => {
  if (!staffUser?.id) return;
 
  const sendLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetch("http://localhost:5001/api/admin/gps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            staff_id: staffUser.id,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        }).catch(() => {}); // silent fail — don't interrupt staff
      },
      () => {} // permission denied — silent
    );
  };
 
  sendLocation(); // send immediately on mount
  const interval = setInterval(sendLocation, 30000); // then every 30s
  return () => clearInterval(interval);
}, [staffUser?.id]);

  // ── Close dropdowns on outside click ──
  useEffect(() => {
    const close = (e) => {
      setActionMenu(null);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const totalCount      = tasks.length;
  const pendingCount    = tasks.filter(t => t.status === "pending").length;
  const inProgressCount = tasks.filter(t => t.status === "in_progress").length;
  const completedCount  = tasks.filter(t => t.status === "completed").length;
  const todayCompleted  = completedCount;
  const goalPct         = Math.min((todayCompleted / dailyGoal) * 100, 100);
  const unreadCount     = notifications.filter(n => !n.read).length;

  const displayedTasks = activeTab === "active"
    ? tasks.filter(t => t.status !== "completed")
    : tasks.filter(t => t.status === "completed");

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  // ════════════════════════════════════════════════
  // FIX 3 — use the correct PUT endpoint.
  //          Old: /schedules/:id  (scheduleRoutes.js — no staff_name support)
  //          New: /api/staff/schedules/:id  (staffRoutes.js — handles
  //               staff_name + completed_at stamping)
  // ════════════════════════════════════════════════
  const updateTaskStatus = useCallback(async (id, dbId, status) => {
    try {
      // ✅ FIXED URL — was: /schedules/${dbId}
      //               now: /api/staff/schedules/${dbId}
      const res = await fetch(`${BASE}/api/staff/schedules/${dbId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          status,
          staff_name: staffUser?.name || "Staff",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }

      setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
      setActionMenu(null);

      const label =
        status === "completed"   ? "✅ Completed" :
        status === "in_progress" ? "🔄 In Progress" : "↺ Reopened";

      const newUpdate = { id: Date.now(), msg: `Task ${id} marked as ${label}`, time: "Just now" };
      setUpdates(prev => [newUpdate, ...prev.slice(0, 9)]);

      if (status === "completed") {
        const newStreak = streak + 1;
        setStreak(newStreak);
        localStorage.setItem("stf-streak", newStreak);
        setWeeklyData(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { ...copy[copy.length - 1], count: copy[copy.length - 1].count + 1 };
          return copy;
        });
      }

      showToast(`Task ${id} updated!`);
    } catch (err) {
      console.error("updateTaskStatus error:", err);
      showToast("Failed to update task", "error");
    }
  }, [staffUser, streak]);

  const handleLogout = () => {
    setLogoutModal(false);
    localStorage.removeItem("user");
    navigate("/login");
  };

  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  };

  const getStatusClass = (s) =>
    s === "completed" ? "stf-badge-completed" : s === "in_progress" ? "stf-badge-inprogress" : "stf-badge-pending";
  const getStatusLabel = (s) =>
    s === "completed" ? "Completed" : s === "in_progress" ? "In Progress" : "Pending";

  const navItems = [
    { key: "dashboard", icon: "▦",  label: "Dashboard" },
    { key: "tasks",     icon: "⚑",  label: "Tasks",    badge: pendingCount > 0 ? pendingCount : null },
    { key: "schedule",  icon: "📅", label: "Schedule"  },
    { key: "map",       icon: "🗺️", label: "Route Map" },
    { key: "profile",   icon: "👤", label: "Profile"   },
  ];

  const markAllRead = () => setNotifications(n => n.map(x => ({ ...x, read: true })));

  return (
    <div className={`stf-root${darkMode ? " stf-dark" : ""}`}>

      {/* ══════════════════ NAVBAR ══════════════════ */}
      <nav className="stf-navbar">
        <div className="stf-nav-brand">
          <div className="stf-logo-mark">♻
          </div>
          <span className="stf-brand-name">EcoConnect</span>
        </div>

        <div className="stf-clock-pill">
          <span className="stf-clock-time">{formatTime()}</span>
          <span className="stf-clock-sep">·</span>
          <span className="stf-clock-date">{formatDay()}</span>
        </div>

        <div className="stf-nav-right">

          {/* 🔔 Notification Bell */}
          <div className="stf-notif-wrap" ref={notifRef} onClick={e => e.stopPropagation()}>
            <button className="stf-notif-btn" onClick={() => { setNotifOpen(o => !o); markAllRead(); }}>
              🔔
              {unreadCount > 0 && <span className="stf-notif-dot">{unreadCount}</span>}
            </button>
            {notifOpen && (
              <div className="stf-notif-panel">
                <div className="stf-notif-header">
                  <span>Notifications</span>
                  <button onClick={() => setNotifications([])}>Clear all</button>
                </div>
                {notifications.length === 0
                  ? <div className="stf-notif-empty">🎉 You're all caught up!</div>
                  : notifications.slice(0, 8).map(n => (
                    <div key={n.id} className="stf-notif-item">
                      <span className="stf-notif-icon">📌</span>
                      <div>
                        <div className="stf-notif-msg">{n.msg}</div>
                        <div className="stf-notif-time">{n.time}</div>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}
          </div>

          {/* 🌙 Dark Mode */}
          <button
            className={`stf-dark-toggle ${darkMode ? "stf-dark-on" : ""}`}
            onClick={() => setDarkMode(d => !d)}
            title="Toggle dark mode"
          >
            {darkMode ? "☀️" : "🌙"}
          </button>

          <div className="stf-user-chip" onClick={() => setActivePage("profile")} style={{ cursor: "pointer" }}>
            <div className="stf-user-avatar">
              {staffUser?.image
                ? <img src={`${BASE}/uploads/${staffUser.image}`} alt="avatar" />
                : <span>{staffUser?.name?.[0]?.toUpperCase() || "S"}</span>
              }
            </div>
            <div className="stf-user-info">
              <span className="stf-user-name">{staffUser?.name || "Staff"}</span>
              <span className="stf-user-role">Staff · 🔥{streak}</span>
            </div>
          </div>

          <button className="stf-logout-btn" onClick={() => setLogoutModal(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            Logout
          </button>
        </div>
      </nav>

      <div className="stf-body">

        {/* ══════════════════ SIDEBAR ══════════════════ */}
        <aside className="stf-sidebar">
          <div className="stf-sidebar-top">
            {navItems.map(item => (
              <button
                key={item.key}
                className={`stf-nav-item ${activePage === item.key ? "stf-nav-active" : ""}`}
                onClick={() => setActivePage(item.key)}
              >
                <span className="stf-nav-icon">{item.icon}</span>
                <span className="stf-nav-label">{item.label}</span>
                {item.badge && <span className="stf-nav-badge">{item.badge}</span>}
              </button>
            ))}
          </div>

          <div className="stf-sidebar-info">
            <div className="stf-info-icon">🔥</div>
            <div className="stf-info-label">{streak}-Day Streak</div>
            <div className="stf-info-sub">Keep it up!</div>
          </div>

          <div className="stf-sidebar-quote">
            <div className="stf-quote-line"></div>
            <p>"Every clean street starts with dedicated hands."</p>
          </div>
        </aside>

        {/* ══════════════════ MAIN ══════════════════ */}
        <main className="stf-main">

          {/* ══ DASHBOARD PAGE ══ */}
          {activePage === "dashboard" && (
            <>
              <div className="stf-hero">
                <div className="stf-hero-dots"></div>
                <div className="stf-hero-content">
                  <div>
                    <p className="stf-hero-tag">{greeting} 👋</p>
                    <h1 className="stf-hero-title">
                      Welcome, <span className="stf-hero-name">{staffUser?.name?.split(" ")[0] || "Staff"}</span>
                    </h1>
                    <p className="stf-hero-sub">Here are your assigned tasks. Keep up the great work!</p>
                  </div>
                  <div className="stf-hero-right">
                    <div className="stf-hero-stat-big">
                      <span className="stf-hero-num">{totalCount}</span>
                      <span className="stf-hero-label">Total Tasks</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="stf-stats-strip">
                {[
                  { icon: "📋", label: "Total Tasks",  value: totalCount,      color: "#3b82f6" },
                  { icon: "🕐", label: "Pending",      value: pendingCount,    color: "#f59e0b" },
                  { icon: "🔄", label: "In Progress",  value: inProgressCount, color: "#8b5cf6" },
                  { icon: "✅", label: "Completed",    value: completedCount,  color: "#22c55e" },
                ].map((s, i) => (
                  <div className="stf-stat-card" key={i} style={{ animationDelay: `${i * 0.1}s` }}>
                    <div className="stf-stat-icon">{s.icon}</div>
                    <div className="stf-stat-body">
                      <div className="stf-stat-val" style={{ color: s.color }}>{s.value}</div>
                      <div className="stf-stat-label">{s.label}</div>
                    </div>
                    <div className="stf-stat-bar" style={{ background: s.color + "22" }}>
                      <div className="stf-stat-fill" style={{ background: s.color, width: totalCount > 0 ? `${(s.value / totalCount) * 100}%` : "0%" }}/>
                    </div>
                  </div>
                ))}
              </div>

              <div className="stf-feature-row">
                <div className="stf-goal-card">
                  <div className="stf-goal-header">
                    <div>
                      <h3 className="stf-goal-title">Daily Goal</h3>
                      <p className="stf-goal-sub">{todayCompleted} of {dailyGoal} tasks completed</p>
                    </div>
                    <div className="stf-goal-pct">{Math.round(goalPct)}%</div>
                  </div>
                  <div className="stf-goal-bar-bg">
                    <div className="stf-goal-bar-fill" style={{ width: `${goalPct}%` }}/>
                  </div>
                  <div className="stf-goal-footer">
                    <span>{goalPct >= 100 ? "🎉 Goal reached!" : `${dailyGoal - todayCompleted} more to go`}</span>
                    <div className="stf-goal-adjust">
                      <button onClick={() => setDailyGoal(g => Math.max(1, g - 1))}>−</button>
                      <span>Goal: {dailyGoal}</span>
                      <button onClick={() => setDailyGoal(g => g + 1)}>+</button>
                    </div>
                  </div>
                </div>

                <div className="stf-streak-card">
                  <div className="stf-streak-fire">🔥</div>
                  <div className="stf-streak-num">{streak}</div>
                  <div className="stf-streak-label">Day Streak</div>
                  <div className="stf-streak-sub">
                    {streak === 0 ? "Complete a task to start!" :
                     streak < 3  ? "Keep going! 💪" :
                     streak < 7  ? "On a roll! 🚀" : "Unstoppable! 🏆"}
                  </div>
                  <button className="stf-streak-reset" onClick={() => { setStreak(0); localStorage.setItem("stf-streak","0"); }}>Reset</button>
                </div>

                <div className="stf-weather-wrap">
                  <h3 className="stf-feature-title">☁️ Field Weather</h3>
                  <WeatherWidget />
                </div>
              </div>

              <div className="stf-chart-card">
                <div className="stf-chart-header">
                  <h3 className="stf-feature-title">📊 Weekly Performance</h3>
                  <span className="stf-chart-total">{weeklyData.reduce((a,d) => a+d.count,0)} tasks this week</span>
                </div>
                <WeeklyChart data={weeklyData.length ? weeklyData : [
                  {day:"Sun",count:0},{day:"Mon",count:0},{day:"Tue",count:0},
                  {day:"Wed",count:0},{day:"Thu",count:0},{day:"Fri",count:0},{day:"Sat",count:0}
                ]} />
              </div>

              {updates.length > 0 && (
                <div className="stf-updates-card">
                  <h3 className="stf-updates-title">Recent Updates</h3>
                  {updates.slice(0, 5).map(u => (
                    <div key={u.id} className="stf-update-item">
                      <div className="stf-update-dot"></div>
                      <div>
                        <div className="stf-update-msg">{u.msg}</div>
                        <div className="stf-update-time">{u.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ══ TASKS / SCHEDULE TABLE ══ */}
          {(activePage === "dashboard" || activePage === "tasks" || activePage === "schedule") && (
            <div className="stf-table-section">
              <div className="stf-section-head">
                <h2 className="stf-section-title">
                  {activePage === "schedule" ? "Collection Schedule" : "Assigned Tasks"}
                </h2>
                <p className="stf-section-sub">Tasks assigned by admin — update status as you complete them</p>
              </div>

              <div className="stf-tabs">
                <button className={`stf-tab ${activeTab === "active" ? "stf-tab-active" : ""}`} onClick={() => setActiveTab("active")}>
                  Active ({pendingCount + inProgressCount})
                </button>
                <button className={`stf-tab ${activeTab === "completed" ? "stf-tab-active" : ""}`} onClick={() => setActiveTab("completed")}>
                  Completed ({completedCount})
                </button>
              </div>

              <div className="stf-table-wrap">
                {loading ? (
                  <div className="stf-loading-row">
                    <div className="stf-spinner"></div>
                    <p>Loading tasks…</p>
                  </div>
                ) : (
                  <table className="stf-table">
                    <thead>
                      <tr>
                        <th>Task ID</th><th>Citizen</th><th>Category</th>
                        <th>Location</th><th>Date</th><th>Status</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedTasks.length === 0 ? (
                        <tr><td colSpan="7">
                          <div className="stf-empty">
                            <span>{activeTab === "active" ? "🎉" : "📭"}</span>
                            <p>{activeTab === "active" ? "All tasks completed!" : "No completed tasks yet."}</p>
                          </div>
                        </td></tr>
                      ) : displayedTasks.map((task, i) => (
                        <tr key={task.id} className="stf-tr" style={{ animationDelay: `${i * 0.04}s` }}>
                          <td className="stf-col-id">{task.id}</td>
                          <td className="stf-col-name">{task.citizen}</td>
                          <td className="stf-col-cat"><span className="stf-cat-dot"></span>{task.name}</td>
                          <td className="stf-col-loc">📍 {task.location}</td>
                          <td className="stf-col-date">{formatDate(task.date)}</td>
                          <td>
                            <span className={`stf-status-badge ${getStatusClass(task.status)}`}>
                              {getStatusLabel(task.status)}
                            </span>
                          </td>
                          <td>
                            <div className="stf-action-wrap" onClick={e => e.stopPropagation()}>
                              <button className="stf-action-trigger" onClick={() => setActionMenu(actionMenu === task.id ? null : task.id)}>⋯</button>
                              {actionMenu === task.id && (
                                <div className="stf-drop-menu">
                                  {task.status !== "completed" && (
                                    <button className="stf-drop-item stf-drop-complete" onClick={() => updateTaskStatus(task.id, task.dbId, "completed")}>✓ Mark as Completed</button>
                                  )}
                                  {task.status === "pending" && (
                                    <button className="stf-drop-item stf-drop-progress" onClick={() => updateTaskStatus(task.id, task.dbId, "in_progress")}>→ Set In Progress</button>
                                  )}
                                  {(task.status === "completed" || task.status === "in_progress") && (
                                    <button className="stf-drop-item stf-drop-reopen" onClick={() => updateTaskStatus(task.id, task.dbId, "pending")}>↺ Reopen Task</button>
                                  )}
                                  <button className="stf-drop-item stf-drop-dismiss" onClick={() => setActionMenu(null)}>✕ Dismiss</button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ══ MAP PAGE ══ */}
          {activePage === "map" && (
            <div className="stf-page-section">
              <div className="stf-section-head">
                <h2 className="stf-section-title">🗺️ Route Map</h2>
                <div className="stf-section-line"></div>
              </div>
              <p className="stf-section-sub" style={{ marginBottom: 16 }}>
                Task locations across Kathmandu — {tasks.length} total assignments
              </p>
              <RouteMap tasks={tasks} />
            </div>
          )}

          {/* ══ PROFILE PAGE ══ */}
          {activePage === "profile" && (
            <div className="stf-page-section">
              <div className="stf-section-head">
                <h2 className="stf-section-title">👤 My Profile</h2>
                <div className="stf-section-line"></div>
              </div>

              <div className="stf-profile-grid">
                <div className="stf-profile-card">
                  <div className="stf-profile-avatar">
                    {staffUser?.image
                      ? <img src={`${BASE}/uploads/${staffUser.image}`} alt="avatar" />
                      : <span>{staffUser?.name?.[0]?.toUpperCase() || "S"}</span>
                    }
                  </div>
                  <h3 className="stf-profile-name">{staffUser?.name || "Staff Member"}</h3>
                  <p className="stf-profile-role">🟢 Field Staff · Active</p>
                  <p className="stf-profile-email">{staffUser?.email || "staff@ecoconnect.com"}</p>
                  <div className="stf-profile-streak">🔥 {streak}-day streak</div>
                </div>

                <div className="stf-profile-stats">
                  <h4 className="stf-profile-stats-title">Performance Overview</h4>
                  <div className="stf-profile-stats-grid">
                    {[
                      { label: "Total Assigned", value: totalCount,      color: "#3b82f6", icon: "📋" },
                      { label: "Completed",       value: completedCount,  color: "#22c55e", icon: "✅" },
                      { label: "In Progress",     value: inProgressCount, color: "#8b5cf6", icon: "🔄" },
                      { label: "Pending",         value: pendingCount,    color: "#f59e0b", icon: "🕐" },
                      { label: "Completion Rate", value: totalCount > 0 ? `${Math.round((completedCount/totalCount)*100)}%` : "0%", color: "#22c55e", icon: "📈" },
                      { label: "Day Streak",      value: `${streak} 🔥`,  color: "#f97316", icon: "🏆" },
                    ].map((s, i) => (
                      <div key={i} className="stf-profile-stat-item" style={{ borderLeft: `3px solid ${s.color}` }}>
                        <div className="stf-profile-stat-icon">{s.icon}</div>
                        <div>
                          <div className="stf-profile-stat-val" style={{ color: s.color }}>{s.value}</div>
                          <div className="stf-profile-stat-label">{s.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 20 }}>
                    <div className="stf-goal-header">
                      <span className="stf-goal-sub">Overall completion</span>
                      <span className="stf-goal-pct">{totalCount > 0 ? Math.round((completedCount/totalCount)*100) : 0}%</span>
                    </div>
                    <div className="stf-goal-bar-bg" style={{ marginTop: 8 }}>
                      <div className="stf-goal-bar-fill" style={{ width: totalCount > 0 ? `${(completedCount/totalCount)*100}%` : "0%" }}/>
                    </div>
                  </div>
                </div>
              </div>

              <div className="stf-chart-card" style={{ marginTop: 20 }}>
                <div className="stf-chart-header">
                  <h3 className="stf-feature-title">📊 This Week's Activity</h3>
                  <span className="stf-chart-total">{weeklyData.reduce((a,d)=>a+d.count,0)} completed</span>
                </div>
                <WeeklyChart data={weeklyData.length ? weeklyData : [
                  {day:"Sun",count:0},{day:"Mon",count:0},{day:"Tue",count:0},
                  {day:"Wed",count:0},{day:"Thu",count:0},{day:"Fri",count:0},{day:"Sat",count:0}
                ]} />
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ══════════════════ FOOTER ══════════════════ */}
      <footer className="stf-footer">
        <div className="stf-footer-inner">
          <div className="stf-footer-brand">
            <div className="stf-footer-logo-row">
              <div className="stf-logo-mark stf-logo-sm">♻
              </div>
              <span className="stf-footer-brand-name">EcoConnect</span>
            </div>
            <p className="stf-footer-tagline">Connecting communities for a greener future.</p>
            <p className="stf-footer-copy">© 2025 EcoConnect. All rights reserved.</p>
          </div>
         <div className="stf-footer-col">Navigation
            <ul className="db-footer-links">
              {[
                { label: "Dashboard",   action: () => setActiveMenu("dashboard") },
                { label: "Tasks", action: () => navigate("/tasks")   },
                { label: "Schedule",  action: () => navigate("/schedule")    },
                { label: "Route Map",    action: () => navigate("/route-map")       },
                { label: "Profile",    action: () => navigate("/profile")      },
              ].map(l => (
                <li key={l.label}>
                  <button className="db-footer-link-btn" onClick={l.action}>{l.label}</button>
                </li>
              ))}
            </ul>
          </div>
          <div className="stf-footer-col">
            <h4>Company</h4>
            <ul>
              {["About Us","Privacy Policy","Terms of Service","Help Center","Contact"].map(l => (
                <li key={l}><a href="#">{l}</a></li>
              ))}
            </ul>
          </div>
          <div className="stf-footer-col">
            <h4>Contact</h4>
            <div className="stf-footer-contact">
              <div>✉️ info@ecoconnect.com</div>
              <div>📞 +977 01-4XXXXXX</div>
              <div>📍 Kathmandu, Nepal</div>
            </div>
          </div>
        </div>
        <div className="stf-footer-bottom">
          <span>© 2025 EcoConnect. All rights reserved.</span>
          <div>
            <a href="#">Privacy</a>
            <span style={{ color: "rgba(255,255,255,0.15)", margin: "0 6px" }}>·</span>
            <a href="#">Terms</a>
          </div>
        </div>
      </footer>

      {/* TOAST */}
      {toast && (
        <div className={`stf-toast ${toast.type === "error" ? "stf-toast-error" : ""}`}>
          {toast.msg}
        </div>
      )}

      {/* LOGOUT MODAL */}
      {logoutModal && (
        <div className="stf-overlay" onClick={() => setLogoutModal(false)}>
          <div className="stf-modal" onClick={e => e.stopPropagation()}>
            <div className="stf-modal-emoji"></div>
            <h3 className="stf-modal-title">Log out of EcoConnect?</h3>
            <p className="stf-modal-sub">You'll be redirected to the login page.</p>
            <div className="stf-modal-btns">
              <button className="stf-btn-cancel" onClick={() => setLogoutModal(false)}>Cancel</button>
              <button className="stf-btn-logout" onClick={handleLogout}>Yes, Log Out</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
