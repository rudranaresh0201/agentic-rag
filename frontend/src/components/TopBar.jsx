import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { HiEnvelope, HiCalendarDays, HiCodeBracket } from "react-icons/hi2";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8003";

export default function TopBar() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState({ gmail: false, calendar: false });
  const [connectError, setConnectError] = useState(null);
  const [githubModal, setGithubModal] = useState(false);
  const [githubToken, setGithubToken] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [githubSaving, setGithubSaving] = useState(false);
  const [githubSaved, setGithubSaved] = useState(false);
  const [githubTokenSet, setGithubTokenSet] = useState(false);
  const tokenInputRef = useRef(null);

  const handleLogout = () => {
    localStorage.removeItem("aria_token");
    navigate("/login", { replace: true });
  };

  const authHeaders = () => {
    const token = localStorage.getItem("aria_token");
    return { "X-API-Key": "mysecretkey123", "Authorization": `Bearer ${token}` };
  };

  const fetchStatus = () => {
    const token = localStorage.getItem("aria_token");
    if (!token) return;
    fetch(`${API_BASE}/mcp/status`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .catch(() => {});
    fetch(`${API_BASE}/auth/me`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setGithubTokenSet(d.github_token_set || false);
        setGithubUsername(d.github_username || "");
      })
      .catch(() => {});
  };

  const openGithubModal = () => {
    setGithubToken("");
    setGithubSaved(false);
    setGithubModal(true);
    setTimeout(() => tokenInputRef.current?.focus(), 80);
  };

  const saveGithub = async () => {
    setGithubSaving(true);
    try {
      const r = await fetch(`${API_BASE}/auth/settings/github`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ github_token: githubToken, github_username: githubUsername }),
      });
      if (r.ok) {
        setGithubSaved(true);
        setGithubTokenSet(true);
        setTimeout(() => setGithubModal(false), 900);
      }
    } finally {
      setGithubSaving(false);
    }
  };

  useEffect(() => {
    const connected = searchParams.get("google_connected") === "1";
    const oauthError = searchParams.get("google_error");

    if (connected) {
      setSearchParams({}, { replace: true });
      // Force status re-fetch after a short delay to ensure the DB write has settled
      setTimeout(fetchStatus, 600);
    } else if (oauthError) {
      setSearchParams({}, { replace: true });
      setConnectError(decodeURIComponent(oauthError));
    } else {
      fetchStatus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectGoogle = () => {
    const token = localStorage.getItem("aria_token");
    // Pass the exact current origin so the callback redirects back here, not a hardcoded URL.
    // This fixes the localhost vs 127.0.0.1 localStorage mismatch on Windows.
    const returnTo = encodeURIComponent(window.location.href.split("?")[0]);
    window.location.href = `${API_BASE}/mcp/auth?token=${token}&return_to=${returnTo}`;
  };

  const pills = [
    { label: "Gmail",    Icon: HiEnvelope,    connected: status.gmail,    clickable: !status.gmail,    onClick: connectGoogle },
    { label: "Calendar", Icon: HiCalendarDays, connected: status.calendar, clickable: !status.calendar, onClick: connectGoogle },
    { label: "GitHub",   Icon: HiCodeBracket,  connected: githubTokenSet,  clickable: !githubTokenSet,  onClick: openGithubModal },
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
      {/* OAuth error banner — fixed below topbar */}
      {connectError && (
        <div style={{
          position: "fixed",
          top: "64px",
          left: 0,
          right: 0,
          zIndex: 49,
          background: "rgba(239,68,68,0.15)",
          borderBottom: "1px solid rgba(239,68,68,0.35)",
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}>
          <span style={{ fontSize: "13px", color: "#fca5a5" }}>
            ⚠️ Google connect failed: {connectError}
          </span>
          <button
            onClick={() => setConnectError(null)}
            style={{ fontSize: "11px", color: "#fca5a5", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}
          >
            Dismiss
          </button>
        </div>
      )}

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

      {/* Status pills + logout */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {pills.map(({ label, Icon, connected, clickable, onClick }) => (
          <div
            key={label}
            onClick={clickable ? onClick : undefined}
            title={clickable ? `Connect ${label} — click to authorize` : `${label} connected`}
            className={clickable ? "aria-connect-pill" : ""}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "999px",
              background: clickable ? "rgba(245,197,24,0.08)" : "#000000",
              border: `1px solid ${clickable ? "rgba(245,197,24,0.65)" : "rgba(245,197,24,0.2)"}`,
              fontSize: "12px",
              fontWeight: 500,
              color: clickable ? "#f5c518" : "rgba(255,255,255,0.55)",
              cursor: clickable ? "pointer" : "default",
              transition: "border-color 0.2s, background 0.2s",
            }}
          >
            <Icon style={{ width: "14px", height: "14px", color: clickable ? "#f5c518" : "rgba(255,255,255,0.35)", flexShrink: 0 }} />
            <span>{label}</span>
            {clickable ? (
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#f5c518" }}>Connect</span>
            ) : null}
            <span
              aria-label={connected ? "connected" : "disconnected"}
              style={{
                display: "inline-block",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: connected ? "#4ade80" : "rgba(138,138,138,0.4)",
                flexShrink: 0,
              }}
            />
          </div>
        ))}
        <button
          onClick={handleLogout}
          style={{
            marginLeft: "4px",
            padding: "6px 14px",
            borderRadius: "999px",
            background: "transparent",
            border: "1px solid rgba(245,197,24,0.35)",
            color: "rgba(255,255,255,0.6)",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "border-color 0.2s, color 0.2s",
          }}
          onMouseEnter={e => { e.target.style.borderColor = "rgba(245,197,24,0.8)"; e.target.style.color = "#fff"; }}
          onMouseLeave={e => { e.target.style.borderColor = "rgba(245,197,24,0.35)"; e.target.style.color = "rgba(255,255,255,0.6)"; }}
        >
          Sign out
        </button>
      </div>
    </header>

    {/* GitHub settings modal */}
    {githubModal && (
      <div
        onClick={() => setGithubModal(false)}
        style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.6)", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: "#0e0e0e", border: "1px solid rgba(245,197,24,0.25)",
            borderRadius: "14px", padding: "28px 32px", width: "420px",
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          <div style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: "6px" }}>
            Connect GitHub
          </div>
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", marginBottom: "20px" }}>
            Your personal access token is stored securely and used only for your GitHub actions.
          </div>

          <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            GitHub Username
          </label>
          <input
            value={githubUsername}
            onChange={e => setGithubUsername(e.target.value)}
            placeholder="your-github-username"
            style={{
              display: "block", width: "100%", marginTop: "6px", marginBottom: "16px",
              background: "#1a1a1a", border: "1px solid rgba(245,197,24,0.2)",
              borderRadius: "8px", padding: "10px 12px", color: "#fff",
              fontSize: "13px", outline: "none", boxSizing: "border-box",
            }}
          />

          <label style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Personal Access Token
          </label>
          <input
            ref={tokenInputRef}
            type="password"
            value={githubToken}
            onChange={e => setGithubToken(e.target.value)}
            placeholder="ghp_..."
            style={{
              display: "block", width: "100%", marginTop: "6px", marginBottom: "6px",
              background: "#1a1a1a", border: "1px solid rgba(245,197,24,0.2)",
              borderRadius: "8px", padding: "10px 12px", color: "#fff",
              fontSize: "13px", outline: "none", boxSizing: "border-box",
            }}
          />
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "22px" }}>
            Needs repo scope. Generate at github.com/settings/tokens
          </div>

          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button
              onClick={() => setGithubModal(false)}
              style={{
                padding: "8px 18px", borderRadius: "8px", background: "transparent",
                border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)",
                fontSize: "13px", cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Cancel
            </button>
            <button
              onClick={saveGithub}
              disabled={!githubToken || !githubUsername || githubSaving}
              style={{
                padding: "8px 20px", borderRadius: "8px",
                background: githubSaved ? "#16a34a" : "#f5c518",
                border: "none", color: "#000", fontSize: "13px",
                fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                opacity: (!githubToken || !githubUsername) ? 0.4 : 1,
              }}
            >
              {githubSaved ? "Saved!" : githubSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    )}
  );
}
