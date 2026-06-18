import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { HiArrowUp } from "react-icons/hi2";
import AgentTheatre from "./AgentTheatre";
import ApprovalCard from "./ApprovalCard";
import MessageBubble from "./MessageBubble";

const QUICK_ACTIONS = [
  { icon: "📧", label: "Check my emails",  query: "Show me my recent emails"       },
  { icon: "📅", label: "My schedule today", query: "What's on my calendar today?"   },
  { icon: "🎵", label: "Play something",    query: "Play some music"                },
  { icon: "📄", label: "Search my docs",    query: "What documents do I have?"      },
];

export default function ChatArea({
  messages,
  query,
  onQueryChange,
  onSend,
  querying,
  inputDisabled,
  loadingMessage,
  onApprovalResolved = () => {},
}) {
  const [focused, setFocused] = useState(false);
  const messagesEndRef  = useRef(null);
  const answerAnchorRef = useRef(null);
  const active = messages.length > 0;

  const latestAssistantMsg = useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant") || null,
    [messages],
  );

  useEffect(() => {
    if (active) messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, active]);

  useEffect(() => {
    if (!latestAssistantMsg) return;
    answerAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [latestAssistantMsg]);

  // ── Shared composer ────────────────────────────────────────────────────────
  const composer = (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          borderRadius: "20px",
          border: `1px solid ${focused ? "#f5c518" : "rgba(245,197,24,0.3)"}`,
          background: "#000000",
          padding: "12px",
          transition: "border-color 0.3s, box-shadow 0.3s",
          boxShadow: focused ? "0 0 40px rgba(245,197,24,0.2)" : "none",
        }}
      >
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !inputDisabled) {
              e.preventDefault();
              onSend(query);
            }
          }}
          placeholder="Ask anything..."
          disabled={inputDisabled}
          aria-label="Message ARIA"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            padding: "4px 16px",
            fontSize: "16px",
            color: "#ffffff",
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        />
        <button
          onClick={() => onSend(query)}
          disabled={inputDisabled || !query.trim()}
          aria-label="Send message"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "48px",
            height: "48px",
            flexShrink: 0,
            borderRadius: "50%",
            background: "#f5c518",
            border: "none",
            color: "#000000",
            cursor: inputDisabled || !query.trim() ? "not-allowed" : "pointer",
            opacity: inputDisabled || !query.trim() ? 0.4 : 1,
            boxShadow: inputDisabled || !query.trim() ? "none" : "0 0 24px rgba(245,197,24,0.45)",
            transition: "opacity 0.2s, box-shadow 0.2s",
          }}
        >
          {querying ? (
            <span style={{
              width: "18px",
              height: "18px",
              border: "2px solid rgba(0,0,0,0.3)",
              borderTopColor: "#000000",
              borderRadius: "50%",
              display: "inline-block",
              animation: "spin 0.7s linear infinite",
            }} />
          ) : (
            <HiArrowUp style={{ width: "20px", height: "20px" }} />
          )}
        </button>
      </div>

      {/* Quick-action chips — only in hero */}
      {!active && (
        <div style={{
          marginTop: "20px",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "10px",
        }}>
          {QUICK_ACTIONS.map(({ icon, label, query: q }) => (
            <button
              key={label}
              onClick={() => onSend(q)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                borderRadius: "999px",
                border: "1px solid rgba(245,197,24,0.4)",
                background: "#000000",
                padding: "8px 16px",
                fontSize: "12px",
                color: "#f5c518",
                cursor: "pointer",
                fontFamily: "'Inter', system-ui, sans-serif",
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f5c518";
                e.currentTarget.style.color = "#000000";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#000000";
                e.currentTarget.style.color = "#f5c518";
              }}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // ── Hero (no messages) ─────────────────────────────────────────────────────
  if (!active) {
    return (
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{
          flex: 1,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "40px 24px",
          maxWidth: "784px",
          margin: "0 auto",
          width: "100%",
        }}>
          {/* Radial yellow glow */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: -1,
              background: "radial-gradient(ellipse at center, rgba(245,197,24,0.07) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />

          <h1 style={{
            fontSize: "clamp(48px, 7vw, 72px)",
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            margin: "0 0 24px",
          }}>
            <span style={{ display: "block", color: "#ffffff" }}>Think it.</span>
            <span style={{ display: "block", color: "#f5c518" }}>We handle it.</span>
          </h1>

          <p style={{
            fontSize: "17px",
            fontWeight: 300,
            color: "#8a8a8a",
            maxWidth: "480px",
            margin: "0 0 36px",
          }}>
            Ask anything. Read emails. Play music. Write code.
          </p>

          <div style={{ width: "100%", maxWidth: "680px" }}>
            {composer}
          </div>
        </div>
      </div>
    );
  }

  // ── Conversation view (has messages) ──────────────────────────────────────
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Scrollable messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 0" }}>
        <div style={{
          maxWidth: "680px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          paddingBottom: "24px",
        }}>
          <AnimatePresence>
            {messages.map((m, index) => {
              if (m.role === "user") {
                return (
                  <motion.div
                    key={`user-${index}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    style={{ display: "flex", justifyContent: "flex-end" }}
                  >
                    <div style={{
                      maxWidth: "80%",
                      borderRadius: "999px",
                      background: "#f5c518",
                      padding: "8px 16px",
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "#000000",
                    }}>
                      {m.content}
                    </div>
                  </motion.div>
                );
              }

              if (m.awaitingApproval) {
                return (
                  <motion.div
                    key={`assistant-${index}`}
                    ref={index === messages.length - 1 ? answerAnchorRef : null}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    style={{ maxWidth: "85%" }}
                  >
                    <ApprovalCard
                      interruptData={m.interruptData}
                      threadId={m.threadId}
                      onResolved={(result) => onApprovalResolved(result, index)}
                    />
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={`assistant-${index}`}
                  ref={index === messages.length - 1 ? answerAnchorRef : null}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    maxWidth: "85%",
                    borderRadius: "12px",
                    border: "1px solid rgba(245,197,24,0.15)",
                    borderLeft: "3px solid #f5c518",
                    background: "#000000",
                    padding: "12px 16px",
                    fontSize: "14px",
                    lineHeight: 1.65,
                    color: "#ffffff",
                    boxShadow: "0 0 24px rgba(245,197,24,0.08)",
                  }}
                >
                  {m.agent_steps?.length > 0 && (
                    <div style={{ marginBottom: "12px" }}>
                      <AgentTheatre agent_steps={m.agent_steps} />
                    </div>
                  )}
                  <MessageBubble message={m} />
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Loading indicator */}
          {querying && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                maxWidth: "85%",
                borderRadius: "12px",
                border: "1px solid rgba(245,197,24,0.15)",
                borderLeft: "3px solid #f5c518",
                background: "#000000",
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                boxShadow: "0 0 24px rgba(245,197,24,0.08)",
              }}
            >
              <span style={{ display: "flex", gap: "4px" }}>
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="animate-pulse"
                    style={{
                      display: "inline-block",
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "#f5c518",
                      opacity: 0.7,
                      animationDelay: `${delay}ms`,
                    }}
                  />
                ))}
              </span>
              <span style={{ fontSize: "13px", color: "#8a8a8a" }}>
                {loadingMessage || "Working on your request..."}
              </span>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer — pinned at bottom */}
      <div style={{
        flexShrink: 0,
        padding: "8px 24px 20px",
        borderTop: "1px solid rgba(245,197,24,0.08)",
      }}>
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          {composer}
        </div>
      </div>
    </div>
  );
}
