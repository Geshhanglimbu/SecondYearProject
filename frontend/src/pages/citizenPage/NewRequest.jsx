import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./NewRequest.css";

const requestTypes = [
  { id: "recycling", icon: "♻", title: "Recycling Pickup", description: "Schedule a collection for your recyclable items." },
  { id: "bin", icon: "🗑", title: "Bin Replacement", description: "Request a new or replacement waste bin." },
  { id: "bulk", icon: "🌿", title: "Bulk Waste", description: "Arrange pickup for large, non-standard items." },
];

const NewRequest = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [selectedType, setSelectedType] = useState("recycling");
  const [description, setDescription] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [location, setLocation] = useState("");
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) { navigate("/login"); return; }
    setUser(JSON.parse(savedUser));
  }, []);

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    const combined = [...images, ...files].slice(0, 5);
    setImages(combined);
    setImagePreviews(combined.map((f) => URL.createObjectURL(f)));
  };

  const removeImage = (index) => {
    const newImgs = images.filter((_, i) => i !== index);
    setImages(newImgs);
    setImagePreviews(newImgs.map((f) => URL.createObjectURL(f)));
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) { setError("Geolocation not supported."); return; }
    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          const data = await res.json();
          setLocation(data.display_name || `${latitude}, ${longitude}`);
        } catch { setLocation(`${latitude}, ${longitude}`); }
        setLoadingLocation(false);
      },
      () => { setError("Could not get location. Type it manually."); setLoadingLocation(false); }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!description || !pickupDate || !pickupTime) { setError("Please fill in all required fields."); return; }
    setLoading(true);
    const formData = new FormData();
    formData.append("userId", user.id);
    formData.append("type", selectedType);
    formData.append("description", description);
    formData.append("pickupDate", pickupDate);
    formData.append("pickupTime", pickupTime);
    formData.append("location", location);
    images.forEach((img) => formData.append("files", img));
    try {
      const res = await fetch("http://localhost:5001/api/submit-request", { method: "POST", body: formData });
      
      const data = await res.json();
      console.log("Response:", data); 

      if (data.message === "Request submitted successfully!") {
        // alert("SUCCESS! Request submitted!");
        setSuccess(true);
        setDescription("");
        setPickupDate(""); 
        setPickupTime("");
        setImages([]);
        setImagePreviews([]);
          setLocation("");
        setTimeout(() => setSuccess(false), 4000);
      } else { setError(data.message || "Submission failed."); }
    } catch 
    { setError("Server error. Make sure your backend is running."); }
    finally { setLoading(false); }
  };

  return (
    <div className="nr-page">

      {/* NAVBAR */}
      <nav className="nr-navbar">
        <div className="nr-logo">
          <span className="nr-logo-icon">♻</span>
          <span className="nr-logo-text">EcoConnect</span>
        </div>
        <div className="nr-nav-right">
          <span className="nr-hello">Hello {user?.name || "User"}</span>
          <div className="nr-avatar">
            {user?.image
              ? <img src={`http://localhost:5001/uploads/${user.image}`} alt="avatar" />
              : <span>{user?.name?.[0]?.toUpperCase() || "U"}</span>}
          </div>
          <button className="nr-logout" onClick={() => { localStorage.removeItem("user"); navigate("/login"); }}>
            Logout
          </button>
        </div>
      </nav>

      {/* CONTENT WRAPPER - sits below fixed navbar */}
      <div className="nr-content">

        {/* SIDEBAR */}
        <aside className="nr-sidebar">
          <nav className="nr-menu">
            <div className="nr-menu-item" onClick={() => navigate("/dashboard")}>
              <span>📊</span><span>Dashboard</span>
            </div>
            <div className="nr-menu-item nr-menu-active">
              <span>+</span><span>New Request</span>
            </div>
            <div className="nr-menu-item" onClick={() => navigate("/complaints")}>
              <span>💬</span><span>Complaints</span>
            </div>
            {/* <div className="nr-menu-item" onClick={() => navigate("/schedule")}>
              <span>📅</span><span>Schedule</span>
            </div> */}
            <div className="nr-menu-item" onClick={() => navigate("/payment")}>
              <span>💳</span><span>Payment</span>
            </div>
            <div className="nr-menu-item" onClick={() => navigate("/Feedback")}>
              <span>✦</span><span>Feedback</span>
            </div>
          </nav>
          <div className="nr-quote-box">
            <p>"The easiest waste to manage is the waste we never create."</p>
          </div>
        </aside>

        {/* SCROLLABLE MAIN */}
        <main className="nr-main">

          {/* TYPE CARDS */}
          <div className="nr-type-grid">
            {requestTypes.map((t) => (
              <div
                key={t.id}
                className={`nr-type-card ${selectedType === t.id ? "nr-selected" : ""}`}
                onClick={() => setSelectedType(t.id)}
              >
                <div className="nr-type-icon">{t.icon}</div>
                <h3>{t.title}</h3>
                <p>{t.description}</p>
              </div>
            ))}
          </div>

          {/* FORM */}
          <form className="nr-form" onSubmit={handleSubmit}>

            {/* IMAGES */}
            <div className="nr-field">
              <label>Upload Images <span className="nr-optional">(optional, max 5)</span></label>
              <label className="nr-file-btn" htmlFor="imgUpload">
                📎 {images.length > 0 ? `${images.length} file(s) selected` : "Choose Files"}
              </label>
              <input
                id="imgUpload" type="file" accept="image/*"
                multiple style={{ display: "none" }}
                onChange={handleImageChange}
              />
              {imagePreviews.length > 0 && (
                <div className="nr-preview-grid">
                  {imagePreviews.map((src, i) => (
                    <div key={i} className="nr-preview-item">
                      <img src={src} alt={`img-${i}`} />
                      <button type="button" className="nr-remove-btn" onClick={() => removeImage(i)}>✕</button>
                    </div>
                  ))}
                  {images.length < 5 && (
                    <label htmlFor="imgUpload" className="nr-add-more">
                      <span>+</span><small>Add More</small>
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* DESCRIPTION */}
            <div className="nr-field">
              <label>Describe the issue <span className="nr-req">*</span></label>
              <textarea
                placeholder="Provide details about your request..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4} required
              />
            </div>

            {/* LOCATION */}
            <div className="nr-field">
              <label>Pickup Location</label>
              <div className="nr-loc-row">
                <input
                  type="text"
                  placeholder="Enter address or use GPS..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="nr-loc-input"
                />
                <button type="button" className="nr-gps-btn" onClick={handleGetLocation} disabled={loadingLocation}>
                  {loadingLocation ? "📡 Locating..." : "📍 GPS"}
                </button>
              </div>
            </div>

            {/* DATE + TIME */}
            <div className="nr-date-row">
              <div className="nr-field">
                <label>Pickup Date <span className="nr-req">*</span></label>
                <input type="date" value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]} required />
              </div>
              <div className="nr-field">
                <label>Pickup Time <span className="nr-req">*</span></label>
                <input type="time" value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)} required />
              </div>
            </div>

           {/* ✅ alerts right above submit button so user always sees them */}
            {success && (
            <div className="nr-success">
                ✅ Request submitted successfully! We will be in touch soon.
            </div>
            )}
            {error && (
            <div className="nr-error">
                ⚠ {error}
            </div>
            )}

            <button type="submit" className="nr-submit-btn" disabled={loading}>
            {loading ? "Submitting..." : "Submit Request"}
            </button>

          </form>
        </main>
      </div>

      {/* FOOTER */}
      <footer className="nr-footer">
        <div className="nr-footer-grid">
          <div>
            <div className="nr-logo"><span className="nr-logo-icon">♻</span><span className="nr-logo-text">EcoConnect</span></div>
            <p>Connecting communities for a greener future.</p>
            <small>© 2025 EcoConnect. All rights reserved.</small>
          </div>
          <div>
            <h4>Quick Links</h4>
            <a href="#">Dashboard</a>
            <a href="#">New Request</a>
            <a href="#">Complaints</a>
            <a href="#">About Us</a>
          </div>
          <div>
            <h4>Connect</h4>
            <p>🐦 💼 📷</p>
            <p>info@ecoconnect.com</p>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default NewRequest;
