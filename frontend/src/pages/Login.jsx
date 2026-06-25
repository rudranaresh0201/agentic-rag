import { useState } from "react";
import { motion } from "framer-motion";
import { FaGoogle } from "react-icons/fa";

const LOGIN_URL = "http://127.0.0.1:8003/auth/google/login";

function GoogleButton() {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={() => { window.location.href = LOGIN_URL; }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        width: "100%",
        padding: "15px 24px",
        background: "#000000",
        border: `1px solid ${hovered ? "var(--accent)" : "rgba(245,197,24,0.35)"}`,
        borderRadius: "12px",
        color: "#ffffff",
        fontSize: "15px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        boxShadow: hovered ? "0 0 28px rgba(245,197,24,0.22), inset 0 0 0 1px rgba(245,197,24,0.1)" : "none",
        fontFamily: "inherit",
        letterSpacing: "0.01em",
      }}
    >
      <FaGoogle style={{ color: "var(--accent)", fontSize: "17px", flexShrink: 0 }} />
      Continue with Google
    </button>
  );
}

export default function Login() {
  return (
    <div style={{
      position: "relative",
      minHeight: "100vh",
      background: "#000000",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Ambient yellow radial glow — mirrors body::after from index.css */}
      <div style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        background: "radial-gradient(circle 1000px at 50% 50%, rgba(245,197,24,0.07), transparent 70%)",
        zIndex: 0,
      }} />

      {/* Subtle grid texture */}
      <div style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
        zIndex: 0,
      }} />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "28px",
          padding: "52px 44px 40px",
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "24px",
          backdropFilter: "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
          maxWidth: "400px",
          width: "calc(100% - 32px)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset",
        }}
      >
        {/* Logo + tagline */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{
              fontSize: "54px",
              fontWeight: 800,
              letterSpacing: "-3px",
              color: "#ffffff",
              lineHeight: 1,
            }}>
              ARIA
            </span>
            <span
              className="animate-aria-pulse"
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: "var(--accent)",
                flexShrink: 0,
                alignSelf: "flex-end",
                marginBottom: "6px",
              }}
            />
          </div>

          <p style={{
            fontSize: "22px",
            fontWeight: 700,
            color: "#ffffff",
            margin: 0,
            letterSpacing: "-0.4px",
            lineHeight: 1.2,
          }}>
            Your Personal Intelligence
          </p>

          <p style={{
            fontSize: "14px",
            color: "var(--text-secondary)",
            margin: 0,
            lineHeight: 1.55,
            maxWidth: "280px",
          }}>
            Ask anything. Remember everything.<br />Act on what matters.
          </p>
        </div>

        {/* Divider */}
        <div style={{
          width: "100%",
          height: "1px",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)",
        }} />

        {/* Sign-in section */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "16px" }}>
          <GoogleButton />
        </div>

        {/* Footer */}
        <p style={{
          fontSize: "11px",
          color: "#383838",
          margin: 0,
          textAlign: "center",
          letterSpacing: "0.02em",
        }}>
          Powered by LangGraph · Groq · Claude
        </p>
      </motion.div>
    </div>
  );
}
