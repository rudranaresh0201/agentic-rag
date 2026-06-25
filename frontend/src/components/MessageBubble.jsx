import { useState } from "react";
import EmailCard from "./EmailCard";
import EventCard from "./EventCard";
import MediaPlayer from "./MediaPlayer";

// ── Inline code block with copy button ────────────────────────────────────────
function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div style={{
      margin: "10px 0",
      borderRadius: "10px",
      border: "1px solid rgba(245,197,24,0.2)",
      overflow: "hidden",
      background: "#0d0d0d",
    }}>
      {/* Header bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 12px",
        background: "rgba(245,197,24,0.06)",
        borderBottom: "1px solid rgba(245,197,24,0.12)",
      }}>
        <span style={{
          fontSize: "10px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#f5c518",
          fontFamily: "monospace",
        }}>
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          style={{
            fontSize: "10px",
            fontWeight: 500,
            color: copied ? "#4ade80" : "#8a8a8a",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px 6px",
            borderRadius: "4px",
            transition: "color 0.2s",
            fontFamily: "monospace",
          }}
        >
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      {/* Code body */}
      <pre style={{
        margin: 0,
        padding: "14px 16px",
        overflowX: "auto",
        fontSize: "12.5px",
        lineHeight: 1.65,
        color: "#e2e8f0",
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        whiteSpace: "pre",
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ── Execution output terminal panel ───────────────────────────────────────────
function ExecutionPanel({ result }) {
  const { stdout, stderr, success } = result;
  if (!stdout && !stderr) return null;

  return (
    <div style={{
      marginTop: "10px",
      borderRadius: "10px",
      border: `1px solid ${success ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)"}`,
      overflow: "hidden",
      background: "#060606",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 12px",
        background: success ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)",
        borderBottom: `1px solid ${success ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)"}`,
      }}>
        <span style={{ fontSize: "11px" }}>{success ? "✅" : "❌"}</span>
        <span style={{
          fontSize: "10px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: success ? "#4ade80" : "#f87171",
          fontFamily: "monospace",
        }}>
          {success ? "execution succeeded" : "execution failed"}
        </span>
      </div>
      <pre style={{
        margin: 0,
        padding: "12px 16px",
        fontSize: "12px",
        lineHeight: 1.6,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        color: stderr && !success ? "#f87171" : "#a3e635",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}>
        {stdout || stderr}
      </pre>
    </div>
  );
}

// ── Parse text into text/code segments for rendering ─────────────────────────
function parseSegments(text) {
  const segments = [];
  const fence = /```(\w*)\n([\s\S]*?)```/g;
  let last = 0;
  let match;

  while ((match = fence.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ type: "text", content: text.slice(last, match.index) });
    }
    segments.push({ type: "code", language: match[1] || "text", content: match[2] });
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    segments.push({ type: "text", content: text.slice(last) });
  }

  return segments.length ? segments : [{ type: "text", content: text }];
}

// ── Social post card ──────────────────────────────────────────────────────────
function SocialPostCard({ post }) {
  const [copied, setCopied] = useState(false);
  const icons = { linkedin: "🔵", twitter: "🐦", instagram: "📸" };
  const full = [post.content, ...(post.hashtags || []).map(h => `#${h}`)].join(" ");
  return (
    <div style={{
      marginTop: "10px",
      borderRadius: "10px",
      border: "1px solid rgba(245,197,24,0.2)",
      background: "#0d0d0d",
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 12px",
        background: "rgba(245,197,24,0.06)",
        borderBottom: "1px solid rgba(245,197,24,0.12)",
      }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "#f5c518" }}>
          {icons[post.platform] || "📱"} {post.platform?.toUpperCase()} POST
        </span>
        <button
          onClick={() => { navigator.clipboard.writeText(full); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
          style={{ fontSize: "10px", color: copied ? "#4ade80" : "#8a8a8a", background: "none", border: "none", cursor: "pointer" }}
        >
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      <div style={{ padding: "12px 16px", fontSize: "13px", color: "#e2e8f0", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
        {post.content}
      </div>
      {post.hashtags?.length > 0 && (
        <div style={{ padding: "0 16px 12px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {post.hashtags.map((h, i) => (
            <span key={i} style={{ fontSize: "11px", color: "#f5c518", background: "rgba(245,197,24,0.08)", borderRadius: "999px", padding: "2px 8px" }}>
              #{h.replace(/^#+/, "")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Email draft card ──────────────────────────────────────────────────────────
function EmailDraftCard({ draft }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{
      marginTop: "10px",
      borderRadius: "10px",
      border: "1px solid rgba(99,102,241,0.3)",
      background: "#0a0a14",
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 12px",
        background: "rgba(99,102,241,0.08)",
        borderBottom: "1px solid rgba(99,102,241,0.15)",
      }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "#818cf8" }}>✍️ EMAIL DRAFT</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(`To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}`);
            setCopied(true); setTimeout(() => setCopied(false), 1800);
          }}
          style={{ fontSize: "10px", color: copied ? "#4ade80" : "#8a8a8a", background: "none", border: "none", cursor: "pointer" }}
        >
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      <div style={{ padding: "12px 16px" }}>
        {draft.to && <p style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>To: <span style={{ color: "#94a3b8" }}>{draft.to}</span></p>}
        {draft.subject && <p style={{ fontSize: "11px", color: "#64748b", marginBottom: "8px" }}>Subject: <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{draft.subject}</span></p>}
        <p style={{ fontSize: "13px", color: "#e2e8f0", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{draft.body}</p>
      </div>
    </div>
  );
}

// ── Resume result card ────────────────────────────────────────────────────────
function ResumeCard({ result }) {
  return (
    <div style={{
      marginTop: "10px",
      borderRadius: "10px",
      border: "1px solid rgba(52,211,153,0.25)",
      background: "#050f0a",
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 12px",
        background: "rgba(52,211,153,0.06)",
        borderBottom: "1px solid rgba(52,211,153,0.12)",
      }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "#34d399" }}>📄 TAILORED RESUME</span>
        <span style={{ fontSize: "11px", color: result.match_score >= 70 ? "#4ade80" : "#f59e0b", fontWeight: 600 }}>
          {result.match_score}% match
        </span>
      </div>
      <div style={{ padding: "12px 16px" }}>
        {result.tailored_bullets?.length > 0 && (
          <ul style={{ margin: "0 0 10px", paddingLeft: "16px" }}>
            {result.tailored_bullets.map((b, i) => (
              <li key={i} style={{ fontSize: "13px", color: "#e2e8f0", marginBottom: "6px", lineHeight: 1.55 }}>{b}</li>
            ))}
          </ul>
        )}
        {result.suggestions?.length > 0 && (
          <div style={{ borderTop: "1px solid rgba(52,211,153,0.1)", paddingTop: "8px", marginTop: "4px" }}>
            <p style={{ fontSize: "10px", fontWeight: 600, color: "#34d399", textTransform: "uppercase", marginBottom: "6px" }}>Suggestions</p>
            {result.suggestions.map((s, i) => (
              <p key={i} style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>• {s}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Standup card ──────────────────────────────────────────────────────────────
function StandupCard({ result }) {
  const sections = [
    { label: "Yesterday", value: result.yesterday, icon: "✅" },
    { label: "Today", value: result.today, icon: "🎯" },
    { label: "Blockers", value: result.blockers, icon: "🚧" },
  ];
  return (
    <div style={{
      marginTop: "10px",
      borderRadius: "10px",
      border: "1px solid rgba(251,191,36,0.2)",
      background: "#0d0a00",
      overflow: "hidden",
    }}>
      <div style={{
        padding: "6px 12px",
        background: "rgba(251,191,36,0.06)",
        borderBottom: "1px solid rgba(251,191,36,0.12)",
      }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "#fbbf24" }}>📋 DAILY STANDUP</span>
      </div>
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {sections.map(({ label, value, icon }) => value ? (
          <div key={label}>
            <p style={{ fontSize: "10px", fontWeight: 700, color: "#fbbf24", textTransform: "uppercase", marginBottom: "3px" }}>
              {icon} {label}
            </p>
            <p style={{ fontSize: "13px", color: "#e2e8f0", lineHeight: 1.6 }}>{value}</p>
          </div>
        ) : null)}
      </div>
    </div>
  );
}

// ── Data analyst result card ──────────────────────────────────────────────────
function DataResultCard({ result }) {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <div style={{
      marginTop: "10px",
      borderRadius: "10px",
      border: `1px solid ${result.success ? "rgba(99,102,241,0.3)" : "rgba(248,113,113,0.25)"}`,
      background: "#08080f",
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 12px",
        background: result.success ? "rgba(99,102,241,0.07)" : "rgba(248,113,113,0.06)",
        borderBottom: `1px solid ${result.success ? "rgba(99,102,241,0.15)" : "rgba(248,113,113,0.15)"}`,
      }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: result.success ? "#818cf8" : "#f87171" }}>
          📊 DATA ANALYSIS {result.success ? "✅" : "❌"}
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setShowCode(s => !s)}
            style={{ fontSize: "10px", color: "#8a8a8a", background: "none", border: "none", cursor: "pointer" }}
          >
            {showCode ? "hide code" : "show code"}
          </button>
          <button
            onClick={() => { navigator.clipboard.writeText(result.output); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
            style={{ fontSize: "10px", color: copied ? "#4ade80" : "#8a8a8a", background: "none", border: "none", cursor: "pointer" }}
          >
            {copied ? "✓ copied" : "copy output"}
          </button>
        </div>
      </div>
      {result.output && (
        <pre style={{
          margin: 0, padding: "12px 16px",
          fontSize: "12px", lineHeight: 1.6,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          color: result.success ? "#a3e635" : "#f87171",
          whiteSpace: "pre-wrap", wordBreak: "break-word",
          maxHeight: "320px", overflowY: "auto",
        }}>
          {result.output}
        </pre>
      )}
      {showCode && result.code && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <CodeBlock language="python" code={result.code} />
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function MessageBubble({ message }) {
  const text = message?.content || message?.text || "";

  const sources = Array.isArray(message?.sources)
    ? message.sources
        .map((src, idx) => {
          if (src && typeof src === "object") {
            return {
              id: Number(src.id) || idx + 1,
              document: src.document || src.title || "Uploaded Doc",
              page: src.page ?? null,
              text: String(src.text || "").trim(),
            };
          }
          if (typeof src === "string") {
            return { id: idx + 1, document: "Uploaded Doc", page: null, text: src };
          }
          return null;
        })
        .filter(Boolean)
    : [];

  const gmailResults    = Array.isArray(message?.gmail_results)    ? message.gmail_results    : [];
  const calendarResults = Array.isArray(message?.calendar_results) ? message.calendar_results : [];
  const executionResult = message?.execution_result || null;
  const socialPost      = message?.social_post      || null;
  const emailDraft      = message?.email_draft      || null;
  const resumeResult    = message?.resume_result    || null;
  const standupResult   = message?.standup_result   || null;
  const dataResult      = message?.data_result      || null;

  const scrollToSource = (sourceId) => {
    const el = document.getElementById(`source-${sourceId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const original = el.style.background;
    el.style.background = "rgba(99,102,241,0.18)";
    window.setTimeout(() => { el.style.background = original; }, 900);
  };

  const renderTextWithCitations = (value) => {
    if (!value) return null;
    const parts = String(value).split(/(\[\d+\])/g);
    return parts.map((part, idx) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (!match) return <span key={idx}>{part}</span>;
      return (
        <span
          key={idx}
          className="cursor-pointer font-medium text-indigo-400 hover:underline"
          onClick={() => scrollToSource(Number(match[1]))}
        >
          {part}
        </span>
      );
    });
  };

  const segments = parseSegments(text);
  const hasCode = segments.some((s) => s.type === "code");

  return (
    <div>
      {/* Answer — text segments and inline code blocks */}
      <div>
        {segments.map((seg, i) =>
          seg.type === "code" ? (
            <CodeBlock key={i} language={seg.language} code={seg.content} />
          ) : (
            <div
              key={i}
              className="whitespace-pre-wrap text-sm leading-relaxed text-slate-100"
            >
              {renderTextWithCitations(seg.content)}
            </div>
          )
        )}
      </div>

      {/* Execution output — only shown when code was run */}
      {executionResult && hasCode && (
        <ExecutionPanel result={executionResult} />
      )}

      {/* Structured result cards */}
      {socialPost    && <SocialPostCard post={socialPost} />}
      {emailDraft    && emailDraft.body && <EmailDraftCard draft={emailDraft} />}
      {resumeResult  && resumeResult.tailored_bullets?.length > 0 && <ResumeCard result={resumeResult} />}
      {standupResult && standupResult.yesterday && <StandupCard result={standupResult} />}
      {dataResult    && <DataResultCard result={dataResult} />}

      {/* Media player */}
      {message?.media_result && <MediaPlayer media_result={message.media_result} />}

      {/* Gmail results */}
      {gmailResults.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            📧 Gmail · {gmailResults.length} email{gmailResults.length !== 1 ? "s" : ""}
          </p>
          {gmailResults.map((email, i) => (
            <EmailCard key={i} email={email} />
          ))}
        </div>
      )}

      {/* Calendar results */}
      {calendarResults.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            📅 Calendar · {calendarResults.length} event{calendarResults.length !== 1 ? "s" : ""}
          </p>
          {calendarResults.map((event, i) => (
            <EventCard key={i} event={event} />
          ))}
        </div>
      )}

      {/* RAG source citations */}
      {sources.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Sources
          </p>
          <div className="space-y-1.5">
            {sources.map((src) => (
              <div
                id={`source-${src.id}`}
                key={src.id}
                className="rounded-lg border border-white/[0.07] bg-slate-950/60 p-2 transition-colors duration-300"
              >
                <p className="text-[10px] font-semibold text-slate-400">
                  [{src.id}] {src.document}
                  {src.page ? ` · Page ${src.page}` : ""}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">{src.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
