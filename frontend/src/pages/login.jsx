import React, { useState } from "react";
import { Link } from "react-router-dom";
import './login.css';

const Login = () => {
  const [role, setRole] = useState("citizen");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("Login successful:", data);
        // redirect or save token here
      } else {
        setError(data.message || "Login failed");
      }
    } catch (error) {
      console.error("Server error:", error);
      setError("Server error. Try again later.");
    }
  };

  return (
    <div className="container">
      <div className="login-box">
        <img
        src="/download (23).jpeg" alt="logo image"
        className="logo"
        />

        <h1>Welcome Back</h1>
        <p>Log in to manage your smart garbage system</p>

        {/* Role Buttons */}
        <div className="role-selection">
          <button
            className={`role-btn ${role === "admin" ? "active" : ""}`}
            onClick={() => setRole("admin")}
          >
            Admin
          </button>

          <button
            className={`role-btn ${role === "citizen" ? "active" : ""}`}
            onClick={() => setRole("citizen")}
          >
            Citizen
          </button>

          <button
            className={`role-btn ${role === "staff" ? "active" : ""}`}
            onClick={() => setRole("staff")}
          >
            Staff
          </button>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <label>Email Address</label>
          <div className="input-group">
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <label>Password</label>
          <div className="input-group">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <span
              className="eye-password"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "👁️" : "👁️‍🗨️"}
            </span>
          </div>

          <a href="/forgot-password" className="forgot-link">
            Forgot Password?
          </a>

          <button type="submit" className="login-btn">
            Log In
          </button>
        </form>

        {error && <p className="error">{error}</p>}

        <p>
         <p>
        Don't have an account? <Link to="/register">Sign Up</Link>
      </p>

        </p>
      </div>
    </div>
  );
};

export default Login;
