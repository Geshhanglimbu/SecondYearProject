import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./LandingPage.css";

const STATS = [
  { value: "48K+",  label: "Active Citizens",    icon: "◈" },
  { value: "2.3M",  label: "KG Recycled",         icon: "◉" },
  { value: "12K+",  label: "Trees Planted",        icon: "◆" },
  { value: "98%",   label: "Satisfaction Rate",    icon: "◇" },
];

const FEATURES = [
  {
    icon: "🚛",
    title: "Smart Pickup Scheduling",
    desc: "Book waste collection in seconds. Real-time slot availability, route tracking, and automated reminders — all in one tap.",
    accent: "#10b981",
  },
  {
    icon: "♻️",
    title: "Recycling Intelligence",
    desc: "AI-powered sorting guidance tells you exactly what goes where. Reduce contamination, maximize recovery.",
    accent: "#3b82f6",
  },
  {
    icon: "🏆",
    title: "Eco Reward System",
    desc: "Every action earns you points. Climb the leaderboard, unlock badges, and convert eco-credits into real perks.",
    accent: "#f59e0b",
  },

  {
    icon: "⚡",
    title: "Instant Complaint Resolution",
    desc: "File issues directly to the right department. Track status in real time — no more dropped requests.",
    accent: "#ef4444",
  },
  {
    icon: "💳",
    title: "Seamless Payments",
    desc: "Pay waste management bills, view history, and get due-date alerts — zero friction, zero late fees.",
    accent: "#06b6d4",
  },
];

const TESTIMONIALS = [
  {
    name: "Priya Sharma",
    role: "Resident, Lalitpur",
    avatar: "PS",
    color: "#10b981",
    text: "EcoConnect transformed how our colony manages waste. Scheduling pickups is effortless, and seeing our eco-score rise every week is genuinely motivating.",
    rating: 5,
  },
  {
    name: "Bikash Thapa",
    role: "Ward Supervisor",
    avatar: "BT",
    color: "#3b82f6",
    text: "Managing citizen requests used to be chaos. Now everything is tracked, routed, and resolved systematically. Our team's efficiency doubled.",
    rating: 5,
  },
  {
    name: "Anita Gurung",
    role: "Environmental Activist",
    avatar: "AG",
    color: "#f59e0b",
    text: "Finally a platform that makes sustainability feel rewarding instead of guilt-ridden. The community impact data is incredibly powerful.",
    rating: 5,
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Create Your Account", desc: "Sign up in under 60 seconds with your address and ward details." },
  { step: "02", title: "Explore Your Dashboard", desc: "View pickup schedules, bills, complaints, and your eco-score at a glance." },
  { step: "03", title: "Take Action", desc: "Schedule pickups, file complaints, pay bills, and give feedback — all in one place." },
  { step: "04", title: "Earn & Grow", desc: "Accumulate eco-points, climb ranks, and help your community go greener." },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const heroRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Particle canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles = Array.from({ length: 55 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.6 + 0.4,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      opacity: Math.random() * 0.4 + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(16,185,129,${p.opacity})`;
        ctx.fill();
      });
      // Lines between close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(16,185,129,${0.07 * (1 - dist / 110)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  // Auto-rotate testimonials
  useEffect(() => {
    const t = setInterval(() => setActiveTestimonial(a => (a + 1) % TESTIMONIALS.length), 4500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="lp-root">

      {/* ══ NAVBAR ══ */}
      <nav className={`lp-nav ${scrolled ? "lp-nav-scrolled" : ""}`}>
        <div className="lp-nav-inner">
          <div className="lp-nav-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <div className="lp-logo-mark">♻️</div>
            <span className="lp-brand-name">EcoConnect</span>
          </div>

          <div className={`lp-nav-links ${menuOpen ? "lp-nav-open" : ""}`}>
            {["Features", "How It Works", "Community", "About"].map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(/ /g, "-")}`} className="lp-nav-link" onClick={() => setMenuOpen(false)}>{l}</a>
            ))}
          </div>

          <div className="lp-nav-actions">
            <button className="lp-btn-ghost" onClick={() => navigate("/login")}>Sign In</button>
            <button className="lp-btn-primary" onClick={() => navigate("/register")}>Get Started</button>
          </div>

          <button className="lp-hamburger" onClick={() => setMenuOpen(!menuOpen)}>
            <span className={menuOpen ? "lp-ham-open" : ""}></span>
            <span className={menuOpen ? "lp-ham-open" : ""}></span>
            <span className={menuOpen ? "lp-ham-open" : ""}></span>
          </button>
        </div>
      </nav>

      {/* ══ HERO ══ */}
      <section className="lp-hero" ref={heroRef}>
        <canvas ref={canvasRef} className="lp-hero-canvas"></canvas>
        <div className="lp-hero-glow lp-glow-1"></div>
        <div className="lp-hero-glow lp-glow-2"></div>
        <div className="lp-hero-glow lp-glow-3"></div>

        <div className="lp-hero-inner">
          <div className="lp-hero-badge">
            <span className="lp-badge-dot"></span>
            Smart Waste Management · Kathmandu Valley
          </div>

          <h1 className="lp-hero-title">
            <span className="lp-hero-line1">Build a Greener</span>
            <span className="lp-hero-line2">City,<em> Together.</em></span>
          </h1>

          <p className="lp-hero-desc">
            EcoConnect bridges citizens and municipalities for seamless waste management,
            real-time tracking, and community-driven environmental impact — all in one platform.
          </p>

          <div className="lp-hero-ctas">
            <button className="lp-cta-main" onClick={() => navigate("/register")}>
              Join the Movement
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
            </button>
            <button className="lp-cta-secondary" onClick={() => document.getElementById("how-it-works").scrollIntoView({ behavior: "smooth" })}>
              <span className="lp-play-ring">▶</span>
              See How It Works
            </button>
          </div>

          <div className="lp-hero-trust">
            <div className="lp-trust-avatars">
              {["#10b981","#3b82f6","#f59e0b","#8b5cf6","#ef4444"].map((c,i) => (
                <div key={i} className="lp-trust-av" style={{ background: c, zIndex: 5 - i }}>
                  {["P","B","A","S","R"][i]}
                </div>
              ))}
            </div>
            <span className="lp-trust-text">Trusted by <strong>48,000+</strong> citizens across 77 wards</span>
          </div>
        </div>

        <div className="lp-hero-scroll">
          <span>Scroll</span>
          <div className="lp-scroll-line"></div>
        </div>
      </section>

      {/* ══ STATS ══ */}
      <section className="lp-stats">
        <div className="lp-stats-inner">
          {STATS.map((s, i) => (
            <div className="lp-stat-item" key={i} style={{ animationDelay: `${i * 0.1}s` }}>
              <span className="lp-stat-icon">{s.icon}</span>
              <span className="lp-stat-val">{s.value}</span>
              <span className="lp-stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ══ FEATURES ══ */}
      <section className="lp-features" id="features">
        <div className="lp-section-inner">
          <div className="lp-section-tag">Platform Features</div>
          <h2 className="lp-section-title">Everything you need<br />to manage waste — smarter.</h2>
          <p className="lp-section-sub">A complete ecosystem built for citizens, supervisors, and administrators alike.</p>

          <div className="lp-feat-grid">
            {FEATURES.map((f, i) => (
              <div className="lp-feat-card" key={i} style={{ "--accent": f.accent, animationDelay: `${i * 0.08}s` }}>
                <div className="lp-feat-icon-wrap">
                  <span>{f.icon}</span>
                  <div className="lp-feat-glow" style={{ background: f.accent }}></div>
                </div>
                <h3 className="lp-feat-title">{f.title}</h3>
                <p className="lp-feat-desc">{f.desc}</p>
                <div className="lp-feat-accent-line" style={{ background: f.accent }}></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ══ */}
      <section className="lp-how" id="how-it-works">
        <div className="lp-section-inner">
          <div className="lp-section-tag">Process</div>
          <h2 className="lp-section-title">Up and running<br />in four steps.</h2>

          <div className="lp-how-grid">
            {HOW_IT_WORKS.map((h, i) => (
              <div className="lp-how-card" key={i} style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="lp-how-step-num">{h.step}</div>
                {i < HOW_IT_WORKS.length - 1 && <div className="lp-how-connector"></div>}
                <h3 className="lp-how-title">{h.title}</h3>
                <p className="lp-how-desc">{h.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ COMMUNITY / TESTIMONIALS ══ */}
      <section className="lp-testimonials" id="community">
        <div className="lp-section-inner">
          <div className="lp-section-tag">Community</div>
          <h2 className="lp-section-title">Real voices,<br />real impact.</h2>

          <div className="lp-testi-stage">
            <div className="lp-testi-card">
              <div className="lp-testi-quote">"</div>
              <p className="lp-testi-text">{TESTIMONIALS[activeTestimonial].text}</p>
              <div className="lp-testi-footer">
                <div className="lp-testi-av" style={{ background: TESTIMONIALS[activeTestimonial].color }}>
                  {TESTIMONIALS[activeTestimonial].avatar}
                </div>
                <div>
                  <div className="lp-testi-name">{TESTIMONIALS[activeTestimonial].name}</div>
                  <div className="lp-testi-role">{TESTIMONIALS[activeTestimonial].role}</div>
                </div>
                <div className="lp-testi-stars">
                  {"★".repeat(TESTIMONIALS[activeTestimonial].rating)}
                </div>
              </div>
            </div>

            <div className="lp-testi-dots">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  className={`lp-testi-dot ${i === activeTestimonial ? "lp-dot-active" : ""}`}
                  onClick={() => setActiveTestimonial(i)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ CTA BANNER ══ */}
      <section className="lp-cta-band">
        <div className="lp-cta-band-glow"></div>
        <div className="lp-section-inner lp-cta-band-inner">
          <div className="lp-cta-band-left">
            <h2 className="lp-cta-band-title">Ready to make your<br />city greener?</h2>
            <p className="lp-cta-band-sub">Join thousands of citizens already making a difference. It takes less than a minute.</p>
          </div>
          <div className="lp-cta-band-right">
            <button className="lp-cta-main lp-cta-band-btn" onClick={() => navigate("/register")}>
              Create Free Account
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
            </button>
            <p className="lp-cta-note">No credit card · Free forever for citizens</p>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <div className="lp-logo-mark lp-logo-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
              </svg>
            </div>
            <span className="lp-brand-name">EcoConnect</span>
          </div>
          <p className="lp-footer-sub">Connecting communities for a greener tomorrow.</p>

          <div className="lp-footer-links">
            {["Privacy Policy", "Terms of Service", "Help Center", "Contact Us"].map(l => (
              <a key={l} href="#" className="lp-footer-link">{l}</a>
            ))}
          </div>
          <p className="lp-footer-copy">© 2025 EcoConnect. All rights reserved. · Kathmandu, Nepal</p>
        </div>
      </footer>
    </div>
  );
}
