import { useEffect, useState } from "react";
import { HiEnvelope, HiCalendarDays, HiCodeBracket } from "react-icons/hi2";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8003";

export default function TopBar() {
  const [status, setStatus] = useState({ gmail: false, calendar: false });

  useEffect(() => {
    fetch(`${API_BASE}/mcp/status`, {
      headers: { "X-API-Key": "mysecretkey123" },
    })
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .catch(() => {});
  }, []);

  const pills = [
    { label: "Gmail",    Icon: HiEnvelope,    connected: status.gmail    },
    { label: "Calendar", Icon: HiCalendarDays, connected: status.calendar },
    { label: "GitHub",   Icon: HiCodeBracket,  connected: true            },
  ];

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: "64px",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(245,197,24,0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{
          color: "#ffffff",
          fontWeight: 900,
          fontSize: "28px",
          letterSpacing: "-0.04em",
          lineHeight: 1,
        }}>
          ARIA
        </span>
        <span
          className="animate-aria-pulse"
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#f5c518",
            flexShrink: 0,
          }}
        />
        <span className="sr-only">ARIA assistant is online</span>
      </div>

      {/* Status pills */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {pills.map(({ label, Icon, connected }) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "999px",
              background: "#000000",
              border: "1px solid rgba(245,197,24,0.25)",
              fontSize: "12px",
              fontWeight: 500,
              color: "#ffffff",
            }}
          >
            <Icon style={{ width: "14px", height: "14px", color: "#f5c518", flexShrink: 0 }} />
            <span>{label}</span>
            <span
              aria-label={connected ? "connected" : "disconnected"}
              style={{
                display: "inline-block",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: connected ? "#f5c518" : "rgba(138,138,138,0.5)",
                flexShrink: 0,
              }}
            />
          </div>
        ))}
      </div>
    </header>
  );
}
