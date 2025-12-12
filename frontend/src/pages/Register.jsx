import React, { useState } from "react";
import './register.css';

function Register() {
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

  // PHOTO PREVIEW
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setImage(file);
    if (file) setImagePreview(URL.createObjectURL(file));
  };

  // SUBMIT
  const handleSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    Object.keys(form).forEach((key) => formData.append(key, form[key]));
    if (image) formData.append("image", image);

    const res = await fetch("http://localhost:5001/register", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    alert(data.message);
  };

  return (
    <div className="register-page">

      {/* LEFT SIDE */}
      <div className="left-side">
        <img src="/gms.png" className="left-image" alt="Government Banner" />

        <h1 className="left-title">Join Us</h1>
        <p className="left-text">
          Become part of a cleaner, safer, and smarter community.
          Register your account to access your municipal services.
        </p>
      </div>

      {/* RIGHT SIDE */}
      <div className="right-side">

        <h2 className="form-title">Register Here</h2>

        <form className="form-container" onSubmit={handleSubmit}>

          {/* Photo Upload */}
          <div className="upload-wrapper">
            <label htmlFor="profileUpload" className="upload-circle">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="preview-img"
                />
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

          {/* Role */}
          <label>I am a...</label>
          <select
            className="input-select"
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="citizen">Citizen</option>
            <option value="admin">Administration</option>
            <option value="staff">Staff</option>
          </select>

          {/* Full Name */}
          <label>Full Name</label>
          <input
            type="text"
            placeholder="Ruwan"
            className="input-field"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          {/* Email */}
          <label>Email Address</label>
          <input
            type="email"
            placeholder="you@example.com"
            className="input-field"
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          {/* Phone */}
          <label>Phone Number</label>
          <input
            type="text"
            placeholder="9800000000"
            className="input-field"
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />

          {/* Address */}
          <label>Address</label>
          <input
            type="text"
            placeholder="Your Address"
            className="input-field"
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />

          {/* Password */}
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

          {/* Confirm Password */}
          <label>Confirm Password</label>
          <div className="password-row">
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="********"
              className="input-field"
              onChange={(e) =>
                setForm({ ...form, confirmPassword: e.target.value })
              }
            />
            <button
              type="button"
              className="show-btn"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? "Hide" : "Show"}
            </button>
          </div>

          {/* Button */}
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