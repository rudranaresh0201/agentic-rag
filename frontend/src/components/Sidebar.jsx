import { motion, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import {
  HiArrowUpTray,
  HiMiniArrowPath,
  HiLink,
  HiArrowPath,
  HiCheckCircle,
  HiDocumentText,
  HiTrash,
  HiChevronDoubleLeft,
  HiChevronDoubleRight,
  HiPencilSquare,
  HiChatBubbleLeftRight,
  HiChevronDown,
  HiChevronRight,
  HiMagnifyingGlass,
  HiXMark,
} from "react-icons/hi2";

function formatSessionTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function SectionLabel({ children, count }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      margin: "0 0 8px 2px",
    }}>
      <span style={{
        fontSize: "10px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        color: "#555",
      }}>
        {children}
      </span>
      {count != null && (
        <span style={{
          fontSize: "10px",
          fontWeight: 600,
          color: "#666",
          background: "rgba(245,197,24,0.08)",
          borderRadius: "999px",
          padding: "1px 7px",
        }}>
          {count}
        </span>
      )}
    </div>
  );
}

export default function Sidebar({
  uploadedFiles = [],
  activeDocumentId,
  uploading,
  processingDoc,
  uploadProgress,
  onUpload,
  onIngestUrl,
  onSelectDocument,
  onDeleteFile,
  onClearAll,
  clearing,
  collapsed = false,
  onToggleCollapsed,
  chatSessions = [],
  activeSessionId = null,
  onNewChat,
  onLoadSession,
  onDeleteSession,
}) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlStatus, setUrlStatus] = useState(null);
  const [urlError, setUrlError] = useState("");
  const [urlExpanded, setUrlExpanded] = useState(false);
  const [kbExpanded, setKbExpanded] = useState(true);

  const docs = Array.isArray(uploadedFiles) ? uploadedFiles : [];
  const busy = uploading || Boolean(processingDoc);

  const handleFiles = (files) => {
    const file = files?.[0];
    if (file) onUpload(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    const trimmed = urlValue.trim();
    if (!trimmed || urlLoading) return;
    setUrlLoading(true);
    setUrlStatus(null);
    setUrlError("");
    try {
      const result = await onIngestUrl(trimmed);
      setUrlStatus(result?.status === "already_ingested" ? "duplicate" : "ok");
      setUrlValue("");
      setTimeout(() => { setUrlStatus(null); setUrlExpanded(false); }, 2000);
    } catch (err) {
      setUrlStatus("error");
      setUrlError(err?.message || "Failed to ingest URL");
    } finally {
      setUrlLoading(false);
    }
  };

  // ── Collapsed sidebar ────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        height: "100%",
        background: "#000",
        borderRight: "1px solid rgba(245,197,24,0.12)",
        padding: "14px 8px",
        gap: "14px",
        overflowX: "hidden",
        overflowY: "hidden",
      }}>
        <button
          type="button"
          onClick={onNewChat}
          title="New chat"
          style={iconBtnStyle()}
        >
          <HiPencilSquare style={{ width: "15px", height: "15px" }} />
        </button>

        <button
          type="button"
          onClick={onToggleCollapsed}
          title="Expand sidebar"
          style={iconBtnStyle()}
        >
          <HiChevronDoubleRight style={{ width: "15px", height: "15px" }} />
        </button>

        <div style={{ flex: 1 }} />

        {chatSessions.length > 0 && (
          <div title={`${chatSessions.length} conversations`} style={{ textAlign: "center" }}>
            <HiChatBubbleLeftRight style={{ width: "15px", height: "15px", color: "#555" }} />
          </div>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          title="Upload PDF"
          style={iconBtnStyle({ active: !busy })}
        >
          {busy
            ? <HiMiniArrowPath className="animate-spin" style={{ width: "15px", height: "15px" }} />
            : <HiArrowUpTray style={{ width: "15px", height: "15px" }} />
          }
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
          disabled={busy}
        />

        {docs.length > 0 && (
          <div title={`${docs.length} document${docs.length !== 1 ? "s" : ""}`} style={{ textAlign: "center" }}>
            <HiDocumentText style={{ width: "15px", height: "15px", color: "#555" }} />
          </div>
        )}
      </div>
    );
  }

  // ── Expanded sidebar ─────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#000",
        borderRight: "1px solid rgba(245,197,24,0.12)",
        padding: "14px 12px",
        fontFamily: "'Inter', system-ui, sans-serif",
        overflowX: "hidden",
        overflowY: "hidden",
        gap: "0px",
      }}
    >
      {/* ── Header row ──────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "18px",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{
            fontSize: "13px",
            fontWeight: 800,
            color: "#f5c518",
            letterSpacing: "-0.01em",
          }}>
            ARIA
          </span>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            onClick={onNewChat}
            title="New chat"
            style={pillBtnStyle()}
            onMouseEnter={(e) => hoverPill(e, true)}
            onMouseLeave={(e) => hoverPill(e, false)}
          >
            <HiPencilSquare style={{ width: "13px", height: "13px" }} />
            New Chat
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            title="Collapse sidebar"
            style={iconBtnStyle()}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#f5c518"; e.currentTarget.style.color = "#000"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#f5c518"; }}
          >
            <HiChevronDoubleLeft style={{ width: "14px", height: "14px" }} />
          </button>
        </div>
      </div>

      {/* ── Chat History — takes all remaining vertical space ───────────────── */}
      <div style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        marginBottom: "16px",
      }}>
        <SectionLabel count={chatSessions.length || null}>
          Conversations
        </SectionLabel>

        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {chatSessions.length === 0 ? (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "32px 12px",
              gap: "10px",
            }}>
              <div style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "rgba(245,197,24,0.06)",
                border: "1px solid rgba(245,197,24,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <HiChatBubbleLeftRight style={{ width: "16px", height: "16px", color: "#555" }} />
              </div>
              <p style={{ fontSize: "12px", color: "#444", textAlign: "center", lineHeight: 1.5, margin: 0 }}>
                No conversations yet.<br />
                <span style={{ color: "#666" }}>Start chatting with ARIA.</span>
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {chatSessions.map((s) => {
                const isActive = activeSessionId === s.session_id;
                return (
                  <div
                    key={s.session_id}
                    onClick={() => onLoadSession(s.session_id)}
                    className="session-row"
                    style={{
                      borderRadius: "8px",
                      borderLeft: `2px solid ${isActive ? "#f5c518" : "transparent"}`,
                      background: isActive ? "rgba(245,197,24,0.07)" : "transparent",
                      padding: "8px 10px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "6px",
                      transition: "background 0.12s, border-left-color 0.12s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.borderLeftColor = "rgba(245,197,24,0.4)";
                        e.currentTarget.style.background = "rgba(245,197,24,0.04)";
                      }
                      const btn = e.currentTarget.querySelector(".del-btn");
                      if (btn) btn.style.opacity = "1";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.borderLeftColor = "transparent";
                        e.currentTarget.style.background = "transparent";
                      }
                      const btn = e.currentTarget.querySelector(".del-btn");
                      if (btn) btn.style.opacity = "0";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", minWidth: 0, flex: 1 }}>
                      <HiChatBubbleLeftRight style={{
                        width: "12px",
                        height: "12px",
                        color: isActive ? "#f5c518" : "#444",
                        flexShrink: 0,
                        marginTop: "2px",
                      }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{
                          margin: 0,
                          fontSize: "12.5px",
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? "#fff" : "#bbb",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          lineHeight: 1.4,
                        }}>
                          {s.title || "New Conversation"}
                        </p>
                        <p style={{
                          margin: "2px 0 0",
                          fontSize: "10px",
                          color: "#444",
                        }}>
                          {formatSessionTime(s.updated_at || s.created_at)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="del-btn"
                      title="Delete"
                      onClick={(e) => { e.stopPropagation(); onDeleteSession(s.session_id); }}
                      style={{
                        background: "none",
                        border: "none",
                        padding: "3px",
                        cursor: "pointer",
                        color: "#ef4444",
                        opacity: 0,
                        lineHeight: 0,
                        flexShrink: 0,
                        transition: "opacity 0.12s",
                        borderRadius: "4px",
                      }}
                    >
                      <HiTrash style={{ width: "11px", height: "11px" }} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Knowledge Base (bottom, collapsible) ─────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        borderTop: "1px solid rgba(245,197,24,0.1)",
        paddingTop: "14px",
      }}>
        {/* Section header with toggle */}
        <button
          type="button"
          onClick={() => setKbExpanded(v => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0 2px",
            marginBottom: kbExpanded ? "12px" : "0",
          }}
        >
          <span style={{
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "#555",
          }}>
            Knowledge Base
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {docs.length > 0 && (
              <span style={{
                fontSize: "10px",
                color: "#666",
                background: "rgba(245,197,24,0.08)",
                borderRadius: "999px",
                padding: "1px 7px",
              }}>
                {docs.length}
              </span>
            )}
            {kbExpanded
              ? <HiChevronDown style={{ width: "12px", height: "12px", color: "#555" }} />
              : <HiChevronRight style={{ width: "12px", height: "12px", color: "#555" }} />
            }
          </div>
        </button>

        <AnimatePresence initial={false}>
          {kbExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ overflow: "hidden" }}
            >
              {/* Upload + URL row */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                style={{
                  display: "flex",
                  gap: "6px",
                  marginBottom: "8px",
                }}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf"
                  style={{ display: "none" }}
                  onChange={(e) => handleFiles(e.target.files)}
                  disabled={busy}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => inputRef.current?.click()}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "5px",
                    padding: "7px 10px",
                    background: busy ? "#c8a212" : "#f5c518",
                    color: "#000",
                    border: "none",
                    borderRadius: "9px",
                    fontWeight: 700,
                    fontSize: "12px",
                    fontFamily: "inherit",
                    cursor: busy ? "not-allowed" : "pointer",
                    opacity: busy ? 0.8 : 1,
                    boxShadow: busy ? "none" : "0 0 14px rgba(245,197,24,0.25)",
                    transition: "opacity 0.15s",
                  }}
                >
                  {busy
                    ? <HiMiniArrowPath className="animate-spin" style={{ width: "13px", height: "13px" }} />
                    : <HiArrowUpTray style={{ width: "13px", height: "13px" }} />
                  }
                  {uploading ? "Uploading…" : processingDoc ? "Processing…" : "Upload PDF"}
                </button>
                <button
                  type="button"
                  onClick={() => { setUrlExpanded(v => !v); setUrlStatus(null); }}
                  title="Add URL to knowledge base"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "36px",
                    height: "36px",
                    flexShrink: 0,
                    background: urlExpanded ? "rgba(245,197,24,0.12)" : "#000",
                    border: `1px solid ${urlExpanded ? "rgba(245,197,24,0.5)" : "rgba(245,197,24,0.2)"}`,
                    borderRadius: "9px",
                    color: "#f5c518",
                    cursor: "pointer",
                    lineHeight: 0,
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                >
                  <HiLink style={{ width: "14px", height: "14px" }} />
                </button>
              </div>

              {/* Upload progress bar */}
              {uploading && (
                <div style={{ marginBottom: "8px" }}>
                  <div style={{ height: "2px", borderRadius: "2px", background: "rgba(245,197,24,0.12)", overflow: "hidden" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      style={{ height: "100%", background: "#f5c518", borderRadius: "2px" }}
                    />
                  </div>
                </div>
              )}

              {/* URL input — expands on demand */}
              <AnimatePresence initial={false}>
                {urlExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    style={{ overflow: "hidden", marginBottom: "8px" }}
                  >
                    <form onSubmit={handleUrlSubmit} style={{ display: "flex", gap: "6px" }}>
                      <div style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        borderRadius: "9px",
                        border: "1px solid rgba(245,197,24,0.25)",
                        background: "#000",
                        padding: "5px 8px",
                      }}>
                        <input
                          type="url"
                          value={urlValue}
                          onChange={(e) => { setUrlValue(e.target.value); setUrlStatus(null); }}
                          placeholder="Paste a URL…"
                          autoFocus
                          disabled={urlLoading}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            fontSize: "12px",
                            color: "#fff",
                            fontFamily: "inherit",
                          }}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={urlLoading || !urlValue.trim()}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "32px",
                          height: "32px",
                          flexShrink: 0,
                          background: "#000",
                          border: "1px solid rgba(245,197,24,0.25)",
                          borderRadius: "9px",
                          color: urlLoading || !urlValue.trim() ? "#555" : "#f5c518",
                          cursor: urlLoading || !urlValue.trim() ? "not-allowed" : "pointer",
                          lineHeight: 0,
                        }}
                      >
                        {urlLoading
                          ? <HiArrowPath className="animate-spin" style={{ width: "12px", height: "12px" }} />
                          : <HiArrowUpTray style={{ width: "12px", height: "12px" }} />
                        }
                      </button>
                    </form>
                    {urlStatus === "ok" && (
                      <p style={{ fontSize: "11px", color: "#22c55e", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <HiCheckCircle style={{ width: "12px", height: "12px" }} /> Ingested
                      </p>
                    )}
                    {urlStatus === "duplicate" && (
                      <p style={{ fontSize: "11px", color: "#555", marginTop: "4px" }}>Already in knowledge base.</p>
                    )}
                    {urlStatus === "error" && (
                      <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "4px" }}>{urlError}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Documents list */}
              {docs.length > 0 && (
                <div style={{
                  maxHeight: "160px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  marginBottom: "8px",
                }}>
                  {docs.map((doc) => {
                    const isActive = activeDocumentId === doc.id;
                    return (
                      <div
                        key={doc.id}
                        onClick={() => onSelectDocument(doc.id)}
                        style={{
                          borderRadius: "8px",
                          border: `1px solid ${isActive ? "rgba(245,197,24,0.3)" : "rgba(255,255,255,0.04)"}`,
                          background: isActive ? "rgba(245,197,24,0.06)" : "transparent",
                          padding: "6px 8px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          transition: "background 0.12s, border-color 0.12s",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                          const btn = e.currentTarget.querySelector(".doc-del");
                          if (btn) btn.style.opacity = "1";
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.background = "transparent";
                          const btn = e.currentTarget.querySelector(".doc-del");
                          if (btn) btn.style.opacity = "0";
                        }}
                      >
                        <div style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "6px",
                          background: "rgba(245,197,24,0.08)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          <HiDocumentText style={{ width: "12px", height: "12px", color: "#f5c518" }} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{
                            margin: 0,
                            fontSize: "11.5px",
                            fontWeight: isActive ? 600 : 400,
                            color: isActive ? "#fff" : "#bbb",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}>
                            {doc.name}
                          </p>
                          <p style={{ margin: 0, fontSize: "10px", color: "#444" }}>
                            {doc.chunks ?? "—"} chunks
                          </p>
                        </div>
                        <button
                          type="button"
                          className="doc-del"
                          title="Delete"
                          onClick={(e) => { e.stopPropagation(); onDeleteFile(doc.id); }}
                          style={{
                            background: "none",
                            border: "none",
                            padding: "2px",
                            cursor: "pointer",
                            color: "#ef4444",
                            opacity: 0,
                            lineHeight: 0,
                            flexShrink: 0,
                            transition: "opacity 0.12s",
                          }}
                        >
                          <HiTrash style={{ width: "11px", height: "11px" }} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {docs.length === 0 && (
                <p style={{ fontSize: "11px", color: "#333", margin: "0 0 8px 2px" }}>
                  No documents uploaded yet.
                </p>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => onSelectDocument(null)}
                  title="Search all documents"
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "5px",
                    padding: "6px 8px",
                    background: "transparent",
                    border: "1px solid rgba(245,197,24,0.18)",
                    borderRadius: "8px",
                    color: "#666",
                    fontSize: "11px",
                    fontFamily: "inherit",
                    cursor: "pointer",
                    transition: "background 0.12s, color 0.12s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(245,197,24,0.06)"; e.currentTarget.style.color = "#f5c518"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#666"; }}
                >
                  <HiMagnifyingGlass style={{ width: "11px", height: "11px" }} />
                  All Docs
                </button>
                <button
                  type="button"
                  onClick={onClearAll}
                  disabled={clearing || busy || docs.length === 0}
                  title="Clear all documents"
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "5px",
                    padding: "6px 8px",
                    background: "transparent",
                    border: "1px solid rgba(239,68,68,0.2)",
                    borderRadius: "8px",
                    color: "#ef4444",
                    fontSize: "11px",
                    fontFamily: "inherit",
                    cursor: clearing || busy || docs.length === 0 ? "not-allowed" : "pointer",
                    opacity: clearing || busy || docs.length === 0 ? 0.3 : 1,
                    transition: "opacity 0.15s",
                  }}
                >
                  <HiXMark style={{ width: "11px", height: "11px" }} />
                  {clearing ? "Clearing…" : "Clear All"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Style helpers ──────────────────────────────────────────────────────────────
function iconBtnStyle({ active = true } = {}) {
  return {
    background: "none",
    border: "1px solid rgba(245,197,24,0.2)",
    borderRadius: "8px",
    padding: "5px 7px",
    color: active ? "#f5c518" : "#555",
    cursor: active ? "pointer" : "not-allowed",
    display: "flex",
    alignItems: "center",
    lineHeight: 0,
    transition: "background 0.12s, color 0.12s",
  };
}

function pillBtnStyle() {
  return {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    background: "none",
    border: "1px solid rgba(245,197,24,0.22)",
    borderRadius: "8px",
    padding: "5px 10px",
    color: "#f5c518",
    fontSize: "12px",
    fontWeight: 600,
    fontFamily: "'Inter', system-ui, sans-serif",
    cursor: "pointer",
    transition: "background 0.12s, color 0.12s",
  };
}

function hoverPill(e, entering) {
  e.currentTarget.style.background = entering ? "#f5c518" : "none";
  e.currentTarget.style.color = entering ? "#000" : "#f5c518";
}
