import { motion } from "framer-motion";
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
  HiPlus,
} from "react-icons/hi2";

function SectionLabel({ children }) {
  return (
    <p style={{
      margin: "0 0 8px 0",
      fontSize: "10px",
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      color: "#8a8a8a",
    }}>
      {children}
    </p>
  );
}

function Sidebar({
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
}) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [urlValue, setUrlValue]     = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlStatus, setUrlStatus]   = useState(null);
  const [urlError, setUrlError]     = useState("");

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
    } catch (err) {
      setUrlStatus("error");
      setUrlError(err?.message || "Failed to ingest URL");
    } finally {
      setUrlLoading(false);
    }
  };

  const docs = Array.isArray(uploadedFiles) ? uploadedFiles : [];
  const busy = uploading || Boolean(processingDoc);

  return (
    <div
      className="glass-float"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#000000",
        borderRight: "1px solid rgba(245,197,24,0.15)",
        padding: "16px 12px",
        gap: "18px",
        fontFamily: "'Inter', system-ui, sans-serif",
        overflowX: "hidden",
        overflowY: "hidden",
        flexShrink: 0,
      }}
    >
      {/* ── Collapse toggle ─────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: collapsed ? "center" : "flex-end" }}>
        <button
          type="button"
          onClick={onToggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            background: "none",
            border: "1px solid rgba(245,197,24,0.25)",
            borderRadius: "10px",
            padding: "5px 8px",
            color: "#f5c518",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            lineHeight: 0,
            transition: "background 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#f5c518";
            e.currentTarget.style.color = "#000000";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "none";
            e.currentTarget.style.color = "#f5c518";
          }}
        >
          <motion.span animate={{ rotate: collapsed ? 180 : 0 }} style={{ display: "block", lineHeight: 0 }}>
            {collapsed
              ? <HiChevronDoubleRight style={{ width: "15px", height: "15px" }} />
              : <HiChevronDoubleLeft  style={{ width: "15px", height: "15px" }} />
            }
          </motion.span>
        </button>
      </div>

      {/* ── Upload PDF ──────────────────────────────────────── */}
      <div>
        {!collapsed && <SectionLabel>Upload</SectionLabel>}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          style={{
            border: `1px solid ${dragActive ? "#f5c518" : "rgba(245,197,24,0.25)"}`,
            borderRadius: "12px",
            background: dragActive ? "rgba(245,197,24,0.06)" : "#000000",
            padding: collapsed ? "6px" : "10px",
            transition: "border-color 0.15s, background 0.15s",
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
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: collapsed ? "7px" : "10px 16px",
              background: busy ? "#c8a212" : "#f5c518",
              color: "#000000",
              border: "none",
              borderRadius: "10px",
              fontWeight: 700,
              fontSize: "13px",
              fontFamily: "inherit",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.75 : 1,
              boxShadow: busy ? "none" : "0 0 20px rgba(245,197,24,0.35)",
              transition: "opacity 0.15s, box-shadow 0.15s",
            }}
          >
            {busy
              ? <HiMiniArrowPath className="animate-spin" style={{ width: "14px", height: "14px" }} />
              : <HiArrowUpTray style={{ width: "14px", height: "14px" }} />
            }
            {!collapsed && (uploading ? "Uploading…" : processingDoc ? "Processing…" : "Upload PDF")}
          </button>

          {!collapsed && !busy && (
            <p style={{ fontSize: "11px", color: "#8a8a8a", marginTop: "6px", textAlign: "center" }}>
              Drag & drop or click
            </p>
          )}

          {uploading && !collapsed && (
            <div style={{ marginTop: "8px" }}>
              <div style={{ height: "3px", borderRadius: "2px", background: "rgba(245,197,24,0.15)", overflow: "hidden" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  style={{ height: "100%", background: "#f5c518", borderRadius: "2px" }}
                />
              </div>
              <p style={{ fontSize: "10px", color: "#8a8a8a", textAlign: "right", marginTop: "3px" }}>
                {uploadProgress}%
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── URL Ingest ──────────────────────────────────────── */}
      {collapsed ? (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <HiLink style={{ width: "15px", height: "15px", color: "#f5c518" }} title="Ingest URL" />
        </div>
      ) : (
        <div>
          <SectionLabel>Ingest URL</SectionLabel>
          <form onSubmit={handleUrlSubmit} style={{ display: "flex", gap: "6px" }}>
            <div style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              borderRadius: "10px",
              border: "1px solid rgba(245,197,24,0.25)",
              background: "#000000",
              padding: "6px 10px",
            }}>
              <HiLink style={{ width: "14px", height: "14px", color: "#f5c518", flexShrink: 0 }} />
              <input
                type="url"
                value={urlValue}
                onChange={(e) => { setUrlValue(e.target.value); setUrlStatus(null); }}
                placeholder="Paste a URL…"
                disabled={urlLoading}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontSize: "12px",
                  color: "#ffffff",
                  fontFamily: "inherit",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={urlLoading || !urlValue.trim()}
              title="Add URL"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "36px",
                height: "36px",
                flexShrink: 0,
                background: "#000000",
                border: "1px solid rgba(245,197,24,0.25)",
                borderRadius: "10px",
                color: urlLoading || !urlValue.trim() ? "#8a8a8a" : "#f5c518",
                cursor: urlLoading || !urlValue.trim() ? "not-allowed" : "pointer",
                lineHeight: 0,
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!urlLoading && urlValue.trim()) {
                  e.currentTarget.style.background = "#f5c518";
                  e.currentTarget.style.color = "#000000";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#000000";
                e.currentTarget.style.color = urlLoading || !urlValue.trim() ? "#8a8a8a" : "#f5c518";
              }}
            >
              {urlLoading
                ? <HiArrowPath className="animate-spin" style={{ width: "13px", height: "13px" }} />
                : <HiPlus style={{ width: "13px", height: "13px" }} />
              }
            </button>
          </form>

          {urlStatus === "ok" && (
            <p style={{ fontSize: "11px", color: "#22c55e", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
              <HiCheckCircle style={{ width: "12px", height: "12px" }} /> Ingested
            </p>
          )}
          {urlStatus === "duplicate" && (
            <p style={{ fontSize: "11px", color: "#8a8a8a", marginTop: "4px" }}>Already in knowledge base.</p>
          )}
          {urlStatus === "error" && (
            <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "4px" }}>{urlError}</p>
          )}
        </div>
      )}

      {/* ── Documents ───────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
        {!collapsed && <SectionLabel>Documents ({docs.length})</SectionLabel>}

        <div style={{ flex: 1, overflowY: "auto" }}>
          {docs.length === 0 ? (
            !collapsed && (
              <p style={{ fontSize: "12px", color: "#8a8a8a", padding: "4px 0" }}>No documents yet</p>
            )
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {docs.map((doc) => {
                const isActive = activeDocumentId === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => onSelectDocument(doc.id)}
                    style={{
                      borderRadius: "10px",
                      borderLeftWidth: "2px",
                      borderLeftStyle: "solid",
                      borderLeftColor: isActive ? "#f5c518" : "transparent",
                      background: isActive ? "rgba(245,197,24,0.05)" : "#000000",
                      padding: collapsed ? "8px 6px" : "10px 12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: collapsed ? "center" : "flex-start",
                      justifyContent: collapsed ? "center" : "space-between",
                      gap: "8px",
                      transition: "background 0.15s, border-left-color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.borderLeftColor = "#f5c518";
                        e.currentTarget.style.background = "rgba(245,197,24,0.05)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.borderLeftColor = "transparent";
                        e.currentTarget.style.background = "#000000";
                      }
                    }}
                  >
                    <div style={{ display: "flex", alignItems: collapsed ? "center" : "flex-start", gap: "10px", minWidth: 0, flex: 1 }}>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        background: "rgba(245,197,24,0.1)",
                        flexShrink: 0,
                      }}>
                        <HiDocumentText style={{ width: "14px", height: "14px", color: "#f5c518" }} />
                      </div>
                      {!collapsed && (
                        <div style={{ minWidth: 0 }}>
                          <p style={{
                            margin: 0,
                            fontSize: "13px",
                            fontWeight: 700,
                            color: "#ffffff",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}>
                            {doc.name}
                          </p>
                          <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#8a8a8a" }}>
                            {doc.chunks ?? "—"} chunks
                          </p>
                        </div>
                      )}
                    </div>

                    {!collapsed && (
                      <button
                        type="button"
                        title="Delete document"
                        onClick={(e) => { e.stopPropagation(); onDeleteFile(doc.id); }}
                        style={{
                          background: "none",
                          border: "none",
                          padding: "2px",
                          cursor: "pointer",
                          color: "#444444",
                          flexShrink: 0,
                          lineHeight: 0,
                          transition: "color 0.15s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "#444444"; }}
                      >
                        <HiTrash style={{ width: "13px", height: "13px" }} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Actions ─────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <button
          type="button"
          onClick={() => onSelectDocument(null)}
          title="Search across all documents"
          style={{
            width: "100%",
            padding: collapsed ? "8px" : "8px 12px",
            background: "#000000",
            border: "1px solid rgba(245,197,24,0.25)",
            borderRadius: "10px",
            color: "#8a8a8a",
            fontSize: "12px",
            fontWeight: 500,
            fontFamily: "inherit",
            cursor: "pointer",
            transition: "background 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#f5c518";
            e.currentTarget.style.color = "#000000";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#000000";
            e.currentTarget.style.color = "#8a8a8a";
          }}
        >
          {collapsed ? "All" : "Search All Docs"}
        </button>

        <button
          type="button"
          onClick={onClearAll}
          disabled={clearing || busy || docs.length === 0}
          title="Clear all documents"
          style={{
            width: "100%",
            padding: collapsed ? "8px" : "8px 12px",
            background: "transparent",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "10px",
            color: "#ef4444",
            fontSize: "12px",
            fontWeight: 500,
            fontFamily: "inherit",
            cursor: clearing || busy || docs.length === 0 ? "not-allowed" : "pointer",
            opacity: clearing || busy || docs.length === 0 ? 0.35 : 1,
            transition: "opacity 0.15s",
          }}
        >
          {clearing ? "Clearing…" : collapsed ? "✕" : "Clear All"}
        </button>
      </div>

      {/* ── Stats ───────────────────────────────────────────── */}
      {!collapsed && (
        <div style={{
          borderTop: "1px solid rgba(245,197,24,0.15)",
          paddingTop: "12px",
          display: "flex",
          justifyContent: "space-around",
        }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#f5c518", lineHeight: 1 }}>
              {docs.length}
            </p>
            <p style={{ margin: "3px 0 0", fontSize: "10px", color: "#8a8a8a", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Docs
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Sidebar;
