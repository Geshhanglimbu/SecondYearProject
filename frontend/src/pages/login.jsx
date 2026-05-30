import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./login.css";

const Login = () => {
  const [role, setRole] = useState("citizen");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://localhost:5001/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("user", JSON.stringify(data.user));
        if (data.user.role === "citizen") navigate("/dashboard");
        else if (data.user.role === "admin") navigate("/admin-dashboard");
        else if (data.user.role === "staff") navigate("/staff-dashboard");
      } else {
        setError(data.message || "Login failed");
      }
    } catch (error) {
      setError("Server error. Try again later.");
    } finally {
      setLoading(false);
    }
    
  };

  return (
    <div className="login-page">

      {/* LEFT PANEL */}
      <div className="login-left">
        <div className="login-left-inner">
          <div className="brand">
            <span className="brand-icon">♻</span>
            <span className="brand-name">EcoConnect</span>
          </div>
          <h1 className="left-heading">
            Building a <span className="highlight">Cleaner</span><br />
            City Together
          </h1>
          <p className="left-sub">
            Join thousands of citizens managing waste smarter, earning eco-points, and making their community greener.
          </p>
          <div className="left-stats">
            <div className="stat">
              <span className="stat-num">12K+</span>
              <span className="stat-label">Active Citizens</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-num">98%</span>
              <span className="stat-label">Pickup Success</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-num">50T</span>
              <span className="stat-label">Waste Recycled</span>
            </div>
          </div>
        </div>
        <div className="left-circles">
          <div className="circle c1" />
          <div className="circle c2" />
          <div className="circle c3" />
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="login-right">
        <div className="login-card">

          <div className="card-header">
            <h2>Welcome Back</h2>
            <p>Sign in to your EcoConnect account</p>
          </div>

          {/* ROLE TABS */}
          <div className="role-tabs">
            {["citizen", "admin", "staff"].map((r) => (
              <button
                key={r}
                className={`role-tab ${role === r ? "role-tab-active" : ""}`}
                onClick={() => setRole(r)}
                type="button"
              >
                {r === "citizen" ? "🏘 Citizen" : r === "admin" ? "🛡 Admin" : "👷 Staff"}
              </button>
              
            ))}
            
          </div>

          {/* ERROR */}
          {error && <div className="login-error">⚠ {error}</div>}

          {/* FORM */}
          <form onSubmit={handleSubmit} className="login-form">

            <div className="form-field">
              <label>Email Address</label>
              <div className="input-wrap">
                <span className="input-icon">✉</span>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-field">
              <div className="label-row">
                <label>Password</label>
                <a href="/forgot-password" className="forgot">Forgot password?</a>
              </div>
              <div className="input-wrap">
                <span className="input-icon">🔒</span>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "👁" : "👁‍🗨"}
                </button>
              </div>
            </div>

            <button type="submit" className="signin-btn" disabled={loading}>
              {loading ? "Signing in..." : "Sign In →"}
            </button>

          </form>

          <div className="register-link">
            Don't have an account?{" "}
            <Link to="/register">Register here</Link>
          </div>
          <div className="back-home" onClick={() => navigate("/")}>
            ← Back to Home
          </div>
        </div>
       
      </div>

    </div>
  );
};


export default Login;
