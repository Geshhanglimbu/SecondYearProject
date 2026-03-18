import { useState, useEffect, useCallback } from "react";
import "./StaffDashboard.css";

const STATUS_MAP = {
  pending:     { label: "Pending"     },
  in_progress: { label: "In Progress" },
  completed:   { label: "Completed"   },
};

/* ─── SVG Icon Helper ─── */
const Svg = ({ children, size = 18, sw = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const DashIcon  = () => <Svg size={20}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></Svg>;
const TasksIcon = () => <Svg size={20}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9h8M8 13h5"/></Svg>;
const CalIcon   = () => <Svg size={20}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></Svg>;
const MapIcon   = () => <Svg size={20}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></Svg>;
const LogoutIco = () => <Svg size={18}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Svg>;
const PinIco    = () => <Svg size={12}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></Svg>;
const ChevronR  = () => <Svg size={15} sw={2.5}><polyline points="9 18 15 12 9 6"/></Svg>;
const CheckIco  = () => <Svg size={18}><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></Svg>;
const AlertIco  = () => <Svg size={18}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></Svg>;
const UserIco   = () => <Svg size={18}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Svg>;
const FilterIco = () => <Svg size={15}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></Svg>;
const ClockIco  = () => <Svg size={22}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Svg>;
const DoneIco   = () => <Svg size={22}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></Svg>;

export default function StaffDashboard() {
  const [tasks,       setTasks]       = useState([]);
  const [updates,     setUpdates]     = useState([]);
  const [activeTab,   setActiveTab]   = useState("active");
  const [activePage,  setActivePage]  = useState("dashboard");
  const [actionMenu,  setActionMenu]  = useState(null);
  const [toast,       setToast]       = useState(null);
  const [logoutModal, setLogoutModal] = useState(false);
  const [loading,     setLoading]     = useState(true);

  // Get logged in user from localStorage
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  /* ── Fetch schedules from backend ── */
  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const res  = await fetch("http://localhost:5001/schedules");
      const data = await res.json();
      const safe = Array.isArray(data) ? data : [];
      const formatted = safe.map(s => ({
        id:       `SCH-${s.id}`,
        name:     s.area,
        location: s.area,
        time:     s.collection_date,
        status:   s.status || "pending",
        dbId:     s.id
      }));
      setTasks(formatted);
    } catch (err) {
      showToast("Failed to load tasks", "error");
    } finally {
      setLoading(false);
    }
  };

  /* ── Derived counts ── */
  const totalTasks     = tasks.length;
  const completedCount = tasks.filter(t => t.status === "completed").length;
  const pendingCount   = tasks.filter(t => t.status !== "completed").length;

  const displayedTasks = activeTab === "active"
    ? tasks.filter(t => t.status !== "completed")
    : tasks.filter(t => t.status === "completed");

  /* ── Toast helper ── */
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  /* ── Mark completed ── */
  const markComplete = useCallback(async (id, dbId) => {
    try {
      await fetch(`http://localhost:5001/schedules/${dbId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: "completed" })
      });
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: "completed" } : t));
      setActionMenu(null);
      setUpdates(prev => [{
        id:   Date.now(),
        type: "complete",
        msg:  `Task ${id} marked as Completed`,
        time: "Just now",
      }, ...prev]);
      showToast(`✅ Task ${id} completed!`);
    } catch {
      showToast("Failed to update task", "error");
    }
  }, []);

  /* ── Mark in progress ── */
  const markInProgress = useCallback(async (id, dbId) => {
    try {
      await fetch(`http://localhost:5001/schedules/${dbId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: "in_progress" })
      });
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: "in_progress" } : t));
      setActionMenu(null);
      showToast(`🔄 Task ${id} set to In Progress`, "info");
    } catch {
      showToast("Failed to update task", "error");
    }
  }, []);

  /* ── Close dropdown on outside click ── */
  useEffect(() => {
    const close = () => setActionMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  /* ── Logout ── */
  const handleLogout = () => {
    setLogoutModal(false);
    localStorage.removeItem("user");
    showToast("👋 Logging out...");
    setTimeout(() => { window.location.href = "/login"; }, 1600);
  };

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const updateIconMap = {
    complete: { iconClass: "complete", el: <CheckIco /> },
    alert:    { iconClass: "alert",    el: <AlertIco /> },
    review:   { iconClass: "review",   el: <UserIco />  },
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard",     Icon: DashIcon  },
    { id: "tasks",     label: "Tasks",         Icon: TasksIcon },
    { id: "schedule",  label: "Schedule",      Icon: CalIcon   },
    { id: "areas",     label: "Service Areas", Icon: MapIcon   },
  ];

  return (
    <div className="wd-wrapper">

      {/* ════ HEADER ════ */}
      <header className="wd-header">
        <div className="wd-header-left">
          <div className="wd-logo-wrap">
            <div className="wd-logo-circle">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                <path d="M8 12l2 2 4-4"/>
              </svg>
            </div>
            <span className="wd-logo-name">EcoConnect</span>
          </div>
          <span className="wd-header-title">Staff Dashboard</span>
        </div>

        <div className="wd-header-right">
          <div className="wd-user-info">
            <div className="wd-user-name">{user.name || "Staff"}</div>
            <div className="wd-user-role">{user.role || "staff"}</div>
          </div>
          <div className="wd-avatar">
            {user.name ? user.name.charAt(0).toUpperCase() : "S"}
          </div>
        </div>
      </header>

      {/* ════ BODY ════ */}
      <div className="wd-body">

        {/* ── SIDEBAR ── */}
        <aside className="wd-sidebar">
          <ul className="wd-nav-list">
            {navItems.map(({ id, label, Icon }) => (
              <li key={id}>
                <button
                  className={`wd-nav-btn ${activePage === id ? "active" : ""}`}
                  onClick={() => setActivePage(id)}
                >
                  <Icon /> {label}
                </button>
              </li>
            ))}
          </ul>

          <div className="wd-sidebar-bottom">
            <button className="wd-logout-btn" onClick={() => setLogoutModal(true)}>
              <LogoutIco /> Logout
            </button>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className="wd-main">

          <h1 className="wd-greeting">
            {greeting}, <span>{user.name || "Staff"}!</span>
          </h1>

          {/* ─ Stat Cards ─ */}
          <div className="wd-stat-grid">
            <div className="wd-stat-card">
              <div className="wd-stat-top">
                <div className="wd-stat-icon green"><TasksIcon /></div>
                <span className="wd-stat-badge green">Total</span>
              </div>
              <div className="wd-stat-label">Today's Tasks</div>
              <div className="wd-stat-value dark">{totalTasks}</div>
              <div className="wd-stat-sub">Total work requests assigned</div>
            </div>

            <div className="wd-stat-card">
              <div className="wd-stat-top">
                <div className="wd-stat-icon orange"><ClockIco /></div>
                <span className="wd-stat-badge orange">Active</span>
              </div>
              <div className="wd-stat-label">Pending Tasks</div>
              <div className="wd-stat-value orange">{pendingCount}</div>
              <div className="wd-stat-sub">In progress or awaiting start</div>
            </div>

            <div className="wd-stat-card">
              <div className="wd-stat-top">
                <div className="wd-stat-icon green"><DoneIco /></div>
                <span className="wd-stat-badge green">Done</span>
              </div>
              <div className="wd-stat-label">Completed Tasks</div>
              <div className="wd-stat-value green">{completedCount}</div>
              <div className="wd-stat-sub">
                {totalTasks > 0
                  ? `${Math.round((completedCount / totalTasks) * 100)}% completion rate`
                  : "No tasks yet"}
              </div>
            </div>
          </div>

          {/* ─ Tasks Card ─ */}
          <div className="wd-card delay-1">
            <div className="wd-card-header">
              <div>
                <div className="wd-card-title">Assigned Tasks</div>
                <div className="wd-card-sub">Tasks assigned by admin — tap ••• to update status</div>
              </div>
              <div className="wd-card-header-right">
                <button
                  className={`wd-tab-btn ${activeTab === "active" ? "active" : ""}`}
                  onClick={() => setActiveTab("active")}
                >
                  Active ({pendingCount})
                </button>
                <button
                  className={`wd-tab-btn ${activeTab === "completed" ? "active" : ""}`}
                  onClick={() => setActiveTab("completed")}
                >
                  Completed ({completedCount})
                </button>
                <button className="wd-icon-btn"><FilterIco /></button>
              </div>
            </div>

            <div className="wd-table-wrap">
              {loading ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#888" }}>
                  Loading tasks...
                </div>
              ) : (
                <table className="wd-table">
                  <thead>
                    <tr>
                      {["Task ID", "Details", "Date", "Status", "Actions"].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedTasks.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="wd-empty">
                          {activeTab === "active"
                            ? "🎉 All tasks completed!"
                            : "No completed tasks yet."}
                        </td>
                      </tr>
                    ) : displayedTasks.map((task) => (
                      <tr key={task.id}>
                        <td><span className="wd-task-id">{task.id}</span></td>
                        <td>
                          <div className="wd-task-name">{task.name}</div>
                          <div className="wd-task-loc"><PinIco />{task.location}</div>
                        </td>
                        <td><span className="wd-task-time">{task.time}</span></td>
                        <td>
                          <span className={`wd-badge ${task.status}`}>
                            {STATUS_MAP[task.status]?.label}
                          </span>
                        </td>
                        <td>
                          <div className="wd-action-wrap" onClick={e => e.stopPropagation()}>
                            <button
                              className="wd-action-trigger"
                              onClick={() => setActionMenu(actionMenu === task.id ? null : task.id)}
                            >
                              •••
                            </button>
                            {actionMenu === task.id && (
                              <div className="wd-drop-menu">
                                {task.status !== "completed" && (
                                  <button
                                    className="wd-drop-item complete"
                                    onClick={() => markComplete(task.id, task.dbId)}
                                  >
                                    ✓ Mark as Completed
                                  </button>
                                )}
                                {task.status === "pending" && (
                                  <button
                                    className="wd-drop-item progress"
                                    onClick={() => markInProgress(task.id, task.dbId)}
                                  >
                                    → Set In Progress
                                  </button>
                                )}
                                {task.status === "completed" && (
                                  <button
                                    className="wd-drop-item reopen"
                                    onClick={() => markInProgress(task.id, task.dbId)}
                                  >
                                    ↺ Reopen Task
                                  </button>
                                )}
                                <button
                                  className="wd-drop-item danger"
                                  onClick={() => setActionMenu(null)}
                                >
                                  ✕ Dismiss
                                </button>
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

            <button className="wd-view-all">
              View All {activeTab === "active" ? "Active" : "Completed"} Tasks &nbsp;<ChevronR />
            </button>
          </div>

          {/* ─ Recent Updates ─ */}
          <div className="wd-card delay-2">
            <div className="wd-updates-header">
              <div className="wd-card-title">Recent Updates</div>
              <div className="wd-card-sub">Latest activity on your tasks</div>
            </div>
            {updates.length === 0 ? (
              <div style={{ padding: "1rem", color: "#888" }}>No recent updates yet.</div>
            ) : updates.slice(0, 5).map((u) => {
              const cfg = updateIconMap[u.type] || updateIconMap.complete;
              return (
                <div key={u.id} className="wd-update-item">
                  <div className={`wd-update-icon ${cfg.iconClass}`}>{cfg.el}</div>
                  <div>
                    <div className="wd-update-msg">{u.msg}</div>
                    <div className="wd-update-time">{u.time}</div>
                  </div>
                </div>
              );
            })}
          </div>

        </main>
      </div>

      {/* ── TOAST ── */}
      {toast && <div className={`wd-toast ${toast.type}`}>{toast.msg}</div>}

      {/* ── LOGOUT MODAL ── */}
      {logoutModal && (
        <div className="wd-overlay" onClick={() => setLogoutModal(false)}>
          <div className="wd-modal" onClick={e => e.stopPropagation()}>
            <div className="wd-modal-emoji">👋</div>
            <div className="wd-modal-title">Log out of EcoConnect?</div>
            <div className="wd-modal-sub">
              You'll be redirected to the login page.
              Any unsaved progress may be lost.
            </div>
            <div className="wd-modal-btns">
              <button className="wd-btn-cancel" onClick={() => setLogoutModal(false)}>
                Cancel
              </button>
              <button className="wd-btn-logout" onClick={handleLogout}>
                Yes, Log Out
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}