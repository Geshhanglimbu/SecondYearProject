import React, { useState } from "react";
import './register.css';
import { useNavigate } from "react-router-dom";

function Register() {
  const navigate = useNavigate(); // ✅ moved to top of component
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  const [form, setForm] = useState({
    role: "citizen",
    name: "",
    email: "",
    phone: "",
    address: "",
    password: "",
    confirmPassword: "",
  });

  const [image, setImage] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setImage(file);
    if (file) setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ✅ Check passwords match before submitting
    if (form.password !== form.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    const formData = new FormData();
    Object.keys(form).forEach((key) => formData.append(key, form[key]));
    if (image) formData.append("image", image);

    try {
      const res = await fetch("http://localhost:5001/register", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      alert(data.message);

      // ✅ navigate INSIDE handleSubmit, after successful registration
      if (res.ok) {
        navigate("/login");
      }

    } catch (error) {
      console.error("Registration error:", error);
      alert("Something went wrong. Try again.");
    }
  };

  return (
    <div className="register-page">
      <div className="left-side">
        <img src="/gms.png" className="left-image" alt="Government Banner" />
        <h1 className="left-title">Join Us</h1>
        <p className="left-text">
          Become part of a cleaner, safer, and smarter community.
          Register your account to access your municipal services.
        </p>
      </div>

      <div className="right-side">
        <h2 className="form-title">Register Here</h2>

        <form className="form-container" onSubmit={handleSubmit}>

          <div className="upload-wrapper">
            <label htmlFor="profileUpload" className="upload-circle">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="preview-img" />
              ) : (
                <span className="upload-text-inside">Upload Photo</span>
              )}
            </label>
            <input
              type="file"
              id="profileUpload"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleImageChange}
            />
            <div className="upload-text">Profile Picture</div>
          </div>

          <label>I am a...</label>
          <select
            className="input-select"
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="citizen">Citizen</option>
            <option value="admin">Administration</option>
            <option value="staff">Staff</option>
          </select>

          <label>Full Name</label>
          <input
            type="text"
            placeholder="Ruwan"
            className="input-field"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <label>Email Address</label>
          <input
            type="email"
            placeholder="you@example.com"
            className="input-field"
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <label>Phone Number</label>
          <input
            type="text"
            placeholder="9800000000"
            className="input-field"
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />

          <label>Address</label>
          <input
            type="text"
            placeholder="Your Address"
            className="input-field"
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />

          <label>Create Password</label>
          <div className="password-row">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="********"
              className="input-field"
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="button"
              className="show-btn"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <label>Confirm Password</label>
          <div className="password-row">
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="********"
              className="input-field"
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            />
            <button
              type="button"
              className="show-btn"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? "Hide" : "Show"}
            </button>
          </div>

          <button className="register-btn" type="submit">
            Register
          </button>

          <p className="login-text">
            Already have an account? <a href="/login">Log in</a>
          </p>

        </form>
      </div>
    </div>
  );
}

export default Register;