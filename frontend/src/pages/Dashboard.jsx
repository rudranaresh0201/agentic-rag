import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ActionConfirmModal from "../components/ActionConfirmModal";
import ApprovalCard from "../components/ApprovalCard";
import BriefingBanner from "../components/BriefingBanner";
import ChatArea from "../components/ChatArea";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import VoiceBar from "../components/VoiceBar";
import {
  deleteDocument,
  listDocuments,
  pollTaskStatus,
  uploadPdf,
  queryRagByDocument,
  queryApi,
  resetRag,
  ingestUrl,
  createChatSession,
  listChatSessions,
  getChatSession,
  saveMessage,
  deleteChatSession,
} from "../services/api";

// ── Pure helpers ──────────────────────────────────────────────────────────────
function normalizeDocuments(payload) {
  return (payload?.documents || []).map((doc) => ({
    id: doc.doc_id,
    name: doc.filename,
    chunks: doc.chunks,
    size: doc.size,
    uploaded_at: doc.uploaded_at,
  }));
}

function normalizeSources(sources) {
  if (!Array.isArray(sources)) return [];
  return sources
    .map((source, index) => ({
      id: Number(source?.id) || index + 1,
      text: String(source?.text || "").trim(),
      document: String(source?.document || source?.file || "Uploaded Doc"),
      page:
        typeof source?.page === "number"
          ? source.page
          : Number.isFinite(Number(source?.page))
          ? Number(source.page)
          : null,
    }))
    .filter((item) => item.text.length > 0);
}

function confidenceFromSources(answer, sources) {
  const quality = Math.min(100, Math.round((answer.length / 900) * 100));
  const sourceStrength = Math.min(100, sources.length * 28);
  return Math.round(0.6 * sourceStrength + 0.4 * quality);
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard() {
  const navigate = useNavigate();

  // ── State ─────────────────────────────────────────────────────────────────
  const [uploadedFiles, setUploadedFiles]   = useState([]);
  const [messages, setMessages]             = useState([]);
  const [activeDocumentId, setActiveDocumentId] = useState(null);
  const [query, setQuery]                   = useState("");
  const [activeTab, setActiveTab]           = useState("Answer");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [uploading, setUploading]           = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingDoc, setProcessingDoc]   = useState(null);
  const [rebuilding, setRebuilding]         = useState(false);
  const [querying, setQuerying]             = useState(false);
  const [clearing, setClearing]             = useState(false);
  const [error, setError]                   = useState("");
  const [loadingMessage, setLoadingMessage] = useState("");
  const [guardWarning, setGuardWarning]     = useState(false);
  const [retrievalScore, setRetrievalScore] = useState(null);
  const [statusMessage, setStatusMessage]   = useState("");
  const [statusTone, setStatusTone]         = useState("neutral");
  const [queryCount, setQueryCount]         = useState(0);
  const [chatSessions, setChatSessions]     = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const loadingTimeoutRef = useRef(null);
  const loadingSlowRef    = useRef(null);
  const activeSessionRef  = useRef(null);

  // Keep ref in sync so handleSend closure always sees latest session id
  useEffect(() => { activeSessionRef.current = activeSessionId; }, [activeSessionId]);

  // ── Memos ─────────────────────────────────────────────────────────────────
  const inputDisabled = useMemo(() => uploading || querying, [uploading, querying]);

  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((item) => item.role === "assistant") || null,
    [messages],
  );

  const sortedFiles = useMemo(
    () => [...uploadedFiles].sort((a, b) => String(b.uploaded_at).localeCompare(String(a.uploaded_at))),
    [uploadedFiles],
  );

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      localStorage.setItem("aria_token", token);
      params.delete("token");
      const newSearch = params.toString();
      window.history.replaceState(
        {},
        "",
        window.location.pathname + (newSearch ? `?${newSearch}` : ""),
      );
    } else {
      const stored = localStorage.getItem("aria_token");
      if (!stored) {
        navigate("/login", { replace: true });
        return;
      }
      // Decode JWT payload to check expiry (base64url → base64 conversion required)
      try {
        const b64 = stored.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
        const payload = JSON.parse(atob(padded));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          localStorage.removeItem("aria_token");
          navigate("/login", { replace: true });
        }
      } catch {
        // Decode failed — keep the token, let the backend reject it on the first call
      }
    }
  }, [navigate]);

  const refreshDocuments = async () => {
    const data = await listDocuments();
    setUploadedFiles(normalizeDocuments(data));
  };

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      try {
        const [docData, sessions] = await Promise.all([listDocuments(), listChatSessions()]);
        if (mounted) {
          setUploadedFiles(normalizeDocuments(docData));
          setChatSessions(sessions || []);
        }
      } catch {
        if (mounted) setError("Failed to load documents.");
      }
    };
    bootstrap();
    return () => { mounted = false; };
  }, []);

  const handleLoadSession = async (sessionId) => {
    const data = await getChatSession(sessionId);
    if (!data) return;
    setActiveSessionId(sessionId);
    setMessages(
      (data.messages || []).map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.metadata || {}),
      }))
    );
    setQuery("");
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setQuery("");
  };

  const handleDeleteSession = async (sessionId) => {
    await deleteChatSession(sessionId);
    setChatSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
    if (activeSessionId === sessionId) handleNewChat();
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleUpload = async (file) => {
    setError("");
    setUploading(true);
    setUploadProgress(0);
    try {
      const data = await uploadPdf(file, () => setUploadProgress(100));
      if (data?.task_id) {
        const taskId = data.task_id;
        setProcessingDoc({ name: file.name, taskId });
        pollTaskStatus(taskId, {
          intervalMs: 2000,
          onDone: async () => { setProcessingDoc(null); await refreshDocuments(); },
          onError: () => { setProcessingDoc(null); setError("Processing failed"); },
        });
        return;
      }
      if (data?.doc_id || typeof data?.chunks === "number") {
        await refreshDocuments();
        setUploadProgress(100);
        return;
      }
      throw new Error("Invalid response");
    } catch {
      setError("Upload failed");
    } finally {
      setTimeout(() => { setUploading(false); setUploadProgress(0); }, 250);
    }
  };

  const handleIngestUrl = async (url) => {
    setError("");
    const result = await ingestUrl(url);
    await refreshDocuments();
    return result;
  };

  const handleDeleteFile = async (fileId) => {
    if (!fileId) return;
    setError("");
    try {
      await deleteDocument(fileId);
      await refreshDocuments();
      if (activeDocumentId === fileId) setActiveDocumentId(null);
    } catch {
      setError("Failed to delete document.");
    }
  };

  const handleClearAll = async () => {
    setError("");
    setClearing(true);
    try {
      await resetRag();
      setUploadedFiles([]);
      setActiveDocumentId(null);
      setMessages([]);
      setQuery("");
    } catch {
      setError("Failed to clear documents.");
    } finally {
      setClearing(false);
    }
  };

  const handleSend = async (nextQuery) => {
    if (!nextQuery.trim() || querying) return;

    setQuerying(true);
    setError("");
    setStatusMessage("");
    setGuardWarning(false);
    setRetrievalScore(null);
    setActiveTab("Answer");
    const ask = nextQuery.trim();
    setQuery("");

    setMessages((prev) => [...prev, { role: "user", content: ask }]);

    // Ensure a session exists; create one lazily on first message
    let sessionId = activeSessionRef.current;
    if (!sessionId) {
      const created = await createChatSession(ask.slice(0, 60));
      if (created?.session_id) {
        sessionId = created.session_id;
        setActiveSessionId(sessionId);
        setChatSessions((prev) => [{ session_id: sessionId, title: ask.slice(0, 60), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...prev]);
      }
    }
    if (sessionId) saveMessage(sessionId, "user", ask);

    setLoadingMessage("Searching documents...");
    loadingTimeoutRef.current = window.setTimeout(() => setLoadingMessage("Generating answer..."), 1200);
    loadingSlowRef.current    = window.setTimeout(() => setLoadingMessage("Still working... (large response)"), 5000);

    try {
      const response = activeDocumentId
        ? await queryRagByDocument(ask, activeDocumentId)
        : await queryApi(ask);

      if (response?.status === "awaiting_approval") {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            awaitingApproval: true,
            threadId: response.thread_id,
            interruptData: response.interrupt_data,
          },
        ]);
      } else {
        const status     = String(response?.status || "ok");
        const guardFired = Boolean(response?.guard_fired);
        const score      = Number.isFinite(Number(response?.retrieval_score)) ? Number(response.retrieval_score) : null;

        setGuardWarning(guardFired);
        setRetrievalScore(score);

        if (status === "busy")           { setStatusMessage("System busy - try again in a few seconds"); setStatusTone("warning"); }
        else if (status === "timeout")   { setStatusMessage("Request took too long - try a shorter query"); setStatusTone("warning"); }
        else if (status === "no_context"){ setStatusMessage("No relevant info found in your documents"); setStatusTone("neutral"); }

        const answer     = String(response?.answer || "").trim();
        const sources    = normalizeSources(response?.sources);
        const confidence = score ?? confidenceFromSources(answer, sources);

        if (answer) {
          const assistantMeta = {
            sources, confidence, query: ask, status, guardFired, retrievalScore: score,
            media_result: response?.media_result || null,
            gmail_results: response?.gmail_results || [],
            calendar_results: response?.calendar_results || [],
            agent_steps: response?.steps || [],
            action_id: response?.action_id || null,
            code_result: response?.code_result || null,
            execution_result: response?.execution_result || null,
            social_post: response?.social_post || null,
            email_draft: response?.email_draft || null,
            resume_result: response?.resume_result || null,
            standup_result: response?.standup_result || null,
          };
          if (sessionId) saveMessage(sessionId, "assistant", answer, assistantMeta);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: answer,
              sources,
              confidence,
              query: ask,
              status,
              guardFired,
              retrievalScore: score,
              media_result:     response?.media_result     || null,
              gmail_results:    response?.gmail_results    || [],
              calendar_results: response?.calendar_results || [],
              agent_steps:      response?.steps            || [],
              action_id:        response?.action_id        || null,
              code_result:      response?.code_result      || null,
              execution_result: response?.execution_result || null,
              social_post:      response?.social_post      || null,
              email_draft:      response?.email_draft      || null,
              resume_result:    response?.resume_result    || null,
              standup_result:   response?.standup_result   || null,
              data_result:      response?.data_result      || null,
            },
          ]);
          setQueryCount((c) => c + 1);
        } else {
          setError("No response from model.");
        }
      }
    } catch (err) {
      setError(err?.status === 429 ? "Too many requests - please wait a few seconds" : "Something went wrong. Please try again.");
    } finally {
      setQuerying(false);
      setLoadingMessage("");
      window.clearTimeout(loadingTimeoutRef.current);
      window.clearTimeout(loadingSlowRef.current);
    }
  };

  const handleApprovalResolved = (result, messageIndex) => {
    setMessages((prev) => {
      const next = [...prev];
      if (result?.status === "awaiting_approval") {
        next[messageIndex] = {
          role: "assistant",
          awaitingApproval: true,
          threadId: result.thread_id,
          interruptData: result.interrupt_data,
        };
      } else {
        const answer  = String(result?.answer || "").trim();
        const sources = normalizeSources(result?.sources);
        next[messageIndex] = {
          role: "assistant",
          content: answer,
          sources,
          confidence: confidenceFromSources(answer, sources),
          status: "ok",
          guardFired: false,
          retrievalScore: null,
          media_result:     result?.media_result     || null,
          gmail_results:    result?.gmail_results    || [],
          calendar_results: result?.calendar_results || [],
          agent_steps:      result?.steps            || [],
          action_id:        result?.action_id        || null,
          code_result:      result?.code_result      || null,
          execution_result: result?.execution_result || null,
          social_post:      result?.social_post      || null,
          email_draft:      result?.email_draft      || null,
          resume_result:    result?.resume_result    || null,
          standup_result:   result?.standup_result   || null,
          data_result:      result?.data_result      || null,
        };
      }
      return next;
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: "#000000",
      minHeight: "100vh",
      color: "#ffffff",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Fixed overlays */}
      <TopBar />
      <ActionConfirmModal trigger={queryCount} />
      <VoiceBar
        onTranscript={handleSend}
        answerToSpeak={latestAssistantMessage?.content}
      />

      {/* Root layout below TopBar */}
      <div style={{
        paddingTop: "64px",
        display: "flex",
        height: "100vh",
        overflow: "hidden",
      }}>

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <motion.div
          animate={{ width: sidebarCollapsed ? "56px" : "260px" }}
          transition={{ type: "spring", stiffness: 280, damping: 30 }}
          style={{ flexShrink: 0, height: "100%", overflow: "hidden" }}
        >
          <Sidebar
            uploadedFiles={sortedFiles}
            activeDocumentId={activeDocumentId}
            uploading={uploading}
            processingDoc={processingDoc}
            uploadProgress={uploadProgress}
            onUpload={handleUpload}
            onIngestUrl={handleIngestUrl}
            onSelectDocument={setActiveDocumentId}
            onDeleteFile={handleDeleteFile}
            onClearAll={handleClearAll}
            clearing={clearing}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
            chatSessions={chatSessions}
            activeSessionId={activeSessionId}
            onNewChat={handleNewChat}
            onLoadSession={handleLoadSession}
            onDeleteSession={handleDeleteSession}
          />
        </motion.div>

        {/* ── Main area ───────────────────────────────────────────────── */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0,
        }}>
          <BriefingBanner />

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                margin: "8px 16px 0",
                padding: "10px 16px",
                borderRadius: "8px",
                background: "#1a0808",
                border: "1px solid #5a1a1a",
                color: "#f87171",
                fontSize: "13px",
                flexShrink: 0,
              }}
            >
              {error}
            </motion.div>
          )}

          <ChatArea
            messages={messages}
            query={query}
            onQueryChange={setQuery}
            onSend={handleSend}
            querying={querying}
            inputDisabled={inputDisabled}
            loadingMessage={loadingMessage}
            onApprovalResolved={handleApprovalResolved}
          />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
