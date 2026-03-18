import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./register.css";

function Register() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    role: "citizen",
    name: "",
    email: "",
    phone: "",
    address: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setImage(file);
    if (file) setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match!");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    Object.keys(form).forEach((key) => {
      if (key !== "confirmPassword") formData.append(key, form[key]);
    });
    if (image) formData.append("image", image);

    try {
      const res = await fetch("http://localhost:5001/register", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess("Account created successfully! Redirecting to login...");
        setTimeout(() => navigate("/login"), 2000);
      } else {
        setError(data.message || "Registration failed.");
      }
    } catch (err) {
      setError("Server error. Make sure your backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reg-page">

      {/* LEFT PANEL */}
      <div className="reg-left">
        <div className="reg-left-inner">
          <div className="reg-brand">
            <span className="reg-brand-icon">♻</span>
            <span className="reg-brand-name">EcoConnect</span>
          </div>

          <h1 className="reg-heading">
            Start Making a <span className="reg-highlight">Difference</span><br />
            Today
          </h1>
          <p className="reg-sub">
            Join thousands of citizens already using EcoConnect to manage waste, earn eco-points, and build greener communities.
          </p>

          <div className="reg-features">
            <div className="reg-feature">
              <span className="reg-feature-icon">🌱</span>
              <div>
                <div className="reg-feature-title">Earn Eco Points</div>
                <div className="reg-feature-desc">Get rewarded for every recycling action</div>
              </div>
            </div>
            <div className="reg-feature">
              <span className="reg-feature-icon">📅</span>
              <div>
                <div className="reg-feature-title">Smart Scheduling</div>
                <div className="reg-feature-desc">Book waste pickups in seconds</div>
              </div>
            </div>
            <div className="reg-feature">
              <span className="reg-feature-icon">📊</span>
              <div>
                <div className="reg-feature-title">Track Your Impact</div>
                <div className="reg-feature-desc">See your contribution to a cleaner city</div>
              </div>
            </div>
          </div>
        </div>

        <div className="reg-circles">
          <div className="reg-circle rc1" />
          <div className="reg-circle rc2" />
          <div className="reg-circle rc3" />
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="reg-right">
        <div className="reg-card">

          <div className="reg-card-header">
            <h2>Create Account</h2>
            <p>Join EcoConnect and start your green journey</p>
          </div>

          {error   && <div className="reg-error">⚠ {error}</div>}
          {success && <div className="reg-success">✅ {success}</div>}

          <form onSubmit={handleSubmit} className="reg-form">

            {/* AVATAR UPLOAD */}
            <div className="reg-avatar-row">
              <label htmlFor="avatarUpload" className="reg-avatar-circle">
                {imagePreview
                  ? <img src={imagePreview} alt="preview" />
                  : <span>📷</span>}
              </label>
              <input id="avatarUpload" type="file" accept="image/*"
                style={{ display: "none" }} onChange={handleImageChange} />
              <div className="reg-avatar-info">
                <label htmlFor="avatarUpload" className="reg-avatar-btn">
                  {imagePreview ? "Change Photo" : "Upload Photo"}
                </label>
                <span className="reg-avatar-hint">Optional — JPG, PNG up to 5MB</span>
              </div>
            </div>

            {/* ROLE TABS */}
            <div className="reg-field">
              <label>Register as</label>
              <div className="reg-role-tabs">
                {["citizen", "admin", "staff"].map((r) => (
                  <button
                    key={r} type="button"
                    className={`reg-role-tab ${form.role === r ? "reg-role-active" : ""}`}
                    onClick={() => setForm({ ...form, role: r })}
                  >
                    {r === "citizen" ? "🏘 Citizen" : r === "admin" ? "🛡 Admin" : "👷 Staff"}
                  </button>
                ))}
              </div>
            </div>

            {/* TWO COLUMN ROW */}
            <div className="reg-row">
              <div className="reg-field">
                <label>Full Name <span className="reg-req">*</span></label>
                <div className="reg-input-wrap">
                  <span className="reg-input-icon">👤</span>
                  <input type="text" name="name" placeholder="Your full name"
                    value={form.name} onChange={handleChange} required />
                </div>
              </div>
              <div className="reg-field">
                <label>Phone Number</label>
                <div className="reg-input-wrap">
                  <span className="reg-input-icon">📞</span>
                  <input type="text" name="phone" placeholder="9800000000"
                    value={form.phone} onChange={handleChange} />
                </div>
              </div>
            </div>

            {/* EMAIL */}
            <div className="reg-field">
              <label>Email Address <span className="reg-req">*</span></label>
              <div className="reg-input-wrap">
                <span className="reg-input-icon">✉</span>
                <input type="email" name="email" placeholder="you@example.com"
                  value={form.email} onChange={handleChange} required />
              </div>
            </div>

            {/* ADDRESS */}
            <div className="reg-field">
              <label>Address</label>
              <div className="reg-input-wrap">
                <span className="reg-input-icon">📍</span>
                <input type="text" name="address" placeholder="Your full address"
                  value={form.address} onChange={handleChange} />
              </div>
            </div>

            {/* PASSWORDS ROW */}
            <div className="reg-row">
              <div className="reg-field">
                <label>Password <span className="reg-req">*</span></label>
                <div className="reg-input-wrap">
                  <span className="reg-input-icon">🔒</span>
                  <input type={showPassword ? "text" : "password"} name="password"
                    placeholder="Min 6 characters" value={form.password} onChange={handleChange} required />
                  <button type="button" className="reg-eye" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? "👁" : "👁‍🗨"}
                  </button>
                </div>
              </div>
              <div className="reg-field">
                <label>Confirm Password <span className="reg-req">*</span></label>
                <div className="reg-input-wrap">
                  <span className="reg-input-icon">🔒</span>
                  <input type={showConfirm ? "text" : "password"} name="confirmPassword"
                    placeholder="Re-enter password" value={form.confirmPassword} onChange={handleChange} required />
                  <button type="button" className="reg-eye" onClick={() => setShowConfirm(!showConfirm)}>
                    {showConfirm ? "👁" : "👁‍🗨"}
                  </button>
                </div>
              </div>
            </div>

            {/* SUBMIT */}
            <button type="submit" className="reg-submit-btn" disabled={loading}>
              {loading ? "Creating Account..." : "Create Account →"}
            </button>

          </form>

          <div className="reg-login-link">
            Already have an account? <Link to="/login">Sign in here</Link>
          </div>

        </div>
      </div>

    </div>
  );
}

export default Register;
