import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const NewComplaint = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      navigate("/login");
      return;
    }

    const user = JSON.parse(storedUser);

    if (!title.trim() || !description.trim()) {
      setError("Title and description are required.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("http://localhost:5001/api/complaints", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          title: title.trim(),
          description: description.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to submit complaint");
      }

      setSuccess("Complaint submitted successfully.");
      setTitle("");
      setDescription("");

      setTimeout(() => {
        navigate("/complaints");
      }, 1000);
    } catch (err) {
      setError(err.message || "Failed to submit complaint");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <div
        style={{
          maxWidth: "720px",
          margin: "0 auto",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "20px",
          padding: "2rem",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.8rem", color: "#0f172a" }}>Submit New Complaint</h1>
          <p style={{ marginTop: "0.5rem", color: "#64748b" }}>
            Report an issue and our team will review it.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: 600,
                color: "#334155",
              }}
            >
              Complaint Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Overflowing garbage near my area"
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid #cbd5e1",
                borderRadius: "12px",
                padding: "0.9rem 1rem",
                fontSize: "0.95rem",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: 600,
                color: "#334155",
              }}
            >
              Description
            </label>
            <textarea
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue clearly..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid #cbd5e1",
                borderRadius: "12px",
                padding: "0.9rem 1rem",
                fontSize: "0.95rem",
                resize: "vertical",
              }}
            />
          </div>

          {error && (
            <p style={{ margin: 0, color: "#dc2626", fontSize: "0.92rem" }}>{error}</p>
          )}

          {success && (
            <p style={{ margin: 0, color: "#059669", fontSize: "0.92rem" }}>{success}</p>
          )}

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              style={{
                border: "1px solid #cbd5e1",
                background: "#fff",
                color: "#475569",
                borderRadius: "12px",
                padding: "0.85rem 1.1rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              style={{
                border: "none",
                background: "linear-gradient(90deg, #16a34a, #22c55e)",
                color: "#fff",
                borderRadius: "12px",
                padding: "0.85rem 1.1rem",
                fontWeight: 700,
                cursor: "pointer",
                minWidth: "180px",
              }}
            >
              {submitting ? "Submitting..." : "Submit Complaint"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewComplaint;