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

// ── Route Map using Leaflet — one pin per task ──
function RouteMap({ tasks }) {
  const mapRef      = useRef(null);
  const leafletRef  = useRef(null);
  const markersRef  = useRef({});  // ← use object keyed by task.id, not array
  const [ready, setReady] = useState(false);

  const validTasks = tasks.filter(t => t.location && t.location !== "—");

 const geocode = async (address) => {
  try {
    const res  = await fetch(`http://localhost:5001/api/geocode?q=${encodeURIComponent(address)}`);
    const data = await res.json();
    if (data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch {}
  return null;
};

  const getColor = (status) =>
    status === "completed"   ? "#22c55e" :
    status === "in_progress" ? "#8b5cf6" : "#f59e0b";

  const getLabel = (status) =>
    status === "completed"   ? "✅ Done" :
    status === "in_progress" ? "🔄 In Progress" : "🕐 Pending";

  // ── Step 1: Load Leaflet JS/CSS once ──
  useEffect(() => {
    if (window.L) { setReady(true); return; }

    if (!document.getElementById("leaflet-css")) {
      const link  = document.createElement("link");
      link.id     = "leaflet-css";
      link.rel    = "stylesheet";
      link.href   = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    if (!document.getElementById("leaflet-js")) {
      const script   = document.createElement("script");
      script.id      = "leaflet-js";
      script.src     = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload  = () => setReady(true);
      document.head.appendChild(script);
    }
  }, []);

  // ── Step 2: Init map only after Leaflet is ready ──
  useEffect(() => {
    if (!ready || !mapRef.current || leafletRef.current) return;
    const L   = window.L;
    const map = L.map(mapRef.current).setView([27.7172, 85.3240], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
    leafletRef.current = map;
  }, [ready]);

  // ── Step 3: Add markers after map is initialized ──
  useEffect(() => {
    if (!leafletRef.current || !window.L) return;
    addMarkers();
  }, [leafletRef.current, tasks]);

  const addMarkers = async () => {
    const L   = window.L;
    const map = leafletRef.current;
    if (!L || !map) return;

    // Remove old markers
    Object.values(markersRef.current).forEach(m => map.removeLayer(m));
    markersRef.current = {};

    const bounds = [];

    for (const task of validTasks) {
      const coords = await geocode(task.location);
      if (!coords) continue;

      const color = getColor(task.status);
      const num   = task.id.replace("SCH-", "");

      const icon = L.divIcon({
        className: "",
        html: `
          <div style="
            background:${color};
            width:36px; height:36px;
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            border:3px solid white;
            box-shadow:0 2px 8px rgba(0,0,0,0.35);
            display:flex; align-items:center; justify-content:center;
          ">
            <span style="transform:rotate(45deg); font-size:12px; color:white; font-weight:800; line-height:1;">
              ${num}
            </span>
          </div>`,
        iconSize:    [36, 36],
        iconAnchor:  [18, 36],
        popupAnchor: [0, -40],
      });

      const popup = `
        <div style="font-family:sans-serif; min-width:190px; padding:4px;">
          <div style="font-weight:800; font-size:14px; margin-bottom:6px; color:#111;">${task.id}</div>
          <div style="margin-bottom:3px; font-size:13px;">👤 <strong>${task.citizen}</strong></div>
          <div style="margin-bottom:3px; font-size:13px;">📦 ${task.name}</div>
          <div style="margin-bottom:3px; font-size:12px; color:#555;">📍 ${task.location}</div>
          <div style="margin-bottom:6px; font-size:12px; color:#555;">📅 ${task.date ? new Date(task.date).toLocaleDateString() : "—"}</div>
          <span style="
            font-size:11px; font-weight:700;
            color:${color};
            background:${color}22;
            padding:3px 10px; border-radius:999px;
          ">${getLabel(task.status)}</span>
        </div>
      `;

      const marker = L.marker(coords, { icon }).addTo(map).bindPopup(popup);
      markersRef.current[task.id] = marker; // ← key by task.id
      bounds.push(coords);
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  // ── Click handler: fly to marker by task.id ──
  const flyToTask = (taskId) => {
    const marker = markersRef.current[taskId];
    if (marker && leafletRef.current) {
      leafletRef.current.flyTo(marker.getLatLng(), 16, { duration: 1.2 });
      setTimeout(() => marker.openPopup(), 1300);
    }
  };

  return (
    <div style={{ display: "flex", gap: "16px", height: "600px" }}>

      {/* ── Left sidebar: task list ── */}
      <div style={{
        width: "280px", overflowY: "auto", flexShrink: 0,
        background: "var(--card-bg, #1e2433)",
        borderRadius: "12px", padding: "12px",
        display: "flex", flexDirection: "column", gap: "8px",
      }}>
        <div style={{ fontWeight: 700, fontSize: "13px", color: "#9ca3af", marginBottom: "4px" }}>
          📍 {validTasks.length} Task Locations
        </div>

        {validTasks.length === 0 ? (
          <p style={{ color: "#6b7280", fontSize: "13px" }}>No tasks with location data</p>
        ) : (
          validTasks.map((t) => (
            <div
              key={t.id}
              onClick={() => flyToTask(t.id)}
              style={{
                padding: "10px 12px", borderRadius: "8px",
                background: "var(--card-bg2, #252d3d)",
                borderLeft: `3px solid ${getColor(t.status)}`,
                cursor: "pointer", transition: "all 0.2s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.opacity   = "0.85";
                e.currentTarget.style.transform = "translateX(3px)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.opacity   = "1";
                e.currentTarget.style.transform = "translateX(0)";
              }}
            >
              <div style={{ fontWeight: 700, fontSize: "13px", color: "#f3f4f6" }}>{t.id}</div>
              <div style={{ fontSize: "12px", color: "#9ca3af", margin: "2px 0" }}>👤 {t.citizen}</div>
              <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>📍 {t.location}</div>
              <span style={{
                fontSize: "11px", fontWeight: 600,
                color: getColor(t.status),
                background: getColor(t.status) + "22",
                padding: "2px 8px", borderRadius: "999px",
              }}>
                {getLabel(t.status)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* ── Right: Leaflet map ── */}
      <div style={{ flex: 1, borderRadius: "12px", overflow: "hidden", position: "relative" }}>
        {!ready && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 999, borderRadius: "12px",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#1e2433", color: "white", flexDirection: "column", gap: "12px",
          }}>
            <div style={{
              width: 36, height: 36, border: "3px solid #10b981",
              borderTopColor: "transparent", borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }} />
            <p style={{ margin: 0, fontWeight: 600 }}>Loading map…</p>
          </div>
        )}
        {validTasks.length === 0 && ready && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 999,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.5)", color: "white", borderRadius: "12px",
          }}>
            <span style={{ fontSize: "40px" }}>🗺️</span>
            <p style={{ marginTop: "12px", fontWeight: 600 }}>No task locations to display</p>
          </div>
        )}
        <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
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

const BASE = "http://localhost:5001";

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

  // ── Live clock ──
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = () => currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  const formatDay  = () => currentTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const hour       = currentTime.getHours();
  const greeting   = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const fetchSchedules = async (user) => {
    const staffId = user?.id;
    if (!staffId) { setLoading(false); return; }

    try {
      setLoading(true);
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

  // ── Load user + fetch schedules ──
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { navigate("/login"); return; }
    const parsed = JSON.parse(stored);
    setStaffUser(parsed);
    fetchSchedules(parsed);
  }, []);

  // ── GPS location reporting ──
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
          }).catch(() => {});
        },
        () => {}
      );
    };

    sendLocation();
    const interval = setInterval(sendLocation, 30000);
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

  const updateTaskStatus = useCallback(async (id, dbId, status) => {
    try {
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
          <div className="stf-logo-mark">♻</div>
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
              <div className="stf-logo-mark stf-logo-sm">♻</div>
              <span className="stf-footer-brand-name">EcoConnect</span>
            </div>
            <p className="stf-footer-tagline">Connecting communities for a greener future.</p>
            <p className="stf-footer-copy">© 2025 EcoConnect. All rights reserved.</p>
          </div>
          <div className="stf-footer-col">
            <h4>Navigation</h4>
            <ul className="db-footer-links">
              {[
                { label: "Dashboard", action: () => setActivePage("dashboard") },
                { label: "Tasks",     action: () => setActivePage("tasks")     },
                { label: "Schedule",  action: () => setActivePage("schedule")  },
                { label: "Route Map", action: () => setActivePage("map")       },
                { label: "Profile",   action: () => setActivePage("profile")   },
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
