export const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8003";

const API_HEADERS = {
  "X-API-Key": "mysecretkey123",
};

export function getAuthToken() {
  return localStorage.getItem("aria_token");
}

async function apiFetch(url, options = {}) {
  const token = getAuthToken();
  return fetch(url, {
    ...options,
    headers: {
      ...API_HEADERS,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

function buildStatusError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getBackendErrorMessage(payload, fallbackMessage) {
  if (!payload) {
    return fallbackMessage;
  }

  const detail = payload.detail;
  if (typeof detail === "string") {
    return detail;
  }

  if (detail && typeof detail === "object") {
    if (typeof detail.message === "string") {
      return detail.message;
    }
    if (typeof detail.error === "string") {
      return detail.error;
    }
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  return fallbackMessage;
}

function buildApiError(error, fallbackMessage) {
  if (error?.code === "ECONNABORTED") {
    return new Error("Model is loading, please wait...");
  }

  const code = error?.response?.data?.detail?.code;
  if (code === "file_too_large") {
    return new Error("File too large. Max size: 200MB");
  }

  const backendMessage = getBackendErrorMessage(error?.response?.data, fallbackMessage);
  return new Error(backendMessage || fallbackMessage);
}

export async function uploadPdf(file, onUploadProgress) {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await apiFetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error: ${res.status} ${text}`);
    }
    const data = await res.json();
    if (typeof onUploadProgress === "function") {
      onUploadProgress({ loaded: 1, total: 1 });
    }
    return data;
  } catch (error) {
    throw buildApiError(error, "Upload failed");
  }
}

function parseAgentResponse(data) {
  if (data.status === "awaiting_approval") {
    return {
      status: "awaiting_approval",
      thread_id: data.thread_id,
      interrupt_data: data.interrupt_data,
    };
  }
  return {
    answer: data.answer,
    status: "ok",
    thread_id: data.thread_id,
    guard_fired: false,
    retrieval_score: null,
    sources: [
      ...(data.rag_sources || []).filter(Boolean).map((s, i) => ({
        id: i + 1,
        text: `Retrieved from internal document`,
        document: s,
        page: 1,
        type: "doc"
      })),
      ...(data.web_sources || []).filter(Boolean).map((s, i) => ({
        id: (data.rag_sources || []).length + i + 1,
        text: `Retrieved from web`,
        document: s,
        page: 1,
        type: "web"
      })),
    ],
    route: data.route,
    steps: data.steps || [],
    media_result: data.media_result || null,
    gmail_results: data.gmail_results || [],
    calendar_results: data.calendar_results || [],
    action_id: data.action_id || null,
    code_result: data.code_result || null,
    execution_result: data.execution_result || null,
    social_post: data.social_post || null,
    email_draft: data.email_draft || null,
    resume_result: data.resume_result || null,
    standup_result: data.standup_result || null,
    data_result: data.data_result || null,
  };
}

export async function queryApi(query, threadId = null) {
  try {
    const res = await apiFetch(`${API_BASE}/agent/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, thread_id: threadId }),
    });
    if (res.status === 429) throw buildStatusError(429, "Too many requests");
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error: ${res.status} ${text}`);
    }
    return parseAgentResponse(await res.json());
  } catch (error) {
    throw buildApiError(error, "Model is loading, please wait...");
  }
}

export async function resumeAgent(threadId, approved, editedPayload = null) {
  try {
    const res = await apiFetch(`${API_BASE}/agent/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread_id: threadId, approved, edited_payload: editedPayload }),
    });
    if (res.status === 429) throw buildStatusError(429, "Too many requests");
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error: ${res.status} ${text}`);
    }
    return parseAgentResponse(await res.json());
  } catch (error) {
    throw buildApiError(error, "Failed to resume agent.");
  }
}

export async function queryRagByDocument(query, documentId) {
  try {
    const res = await apiFetch(`${API_BASE}/agent/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (res.status === 429) throw buildStatusError(429, "Too many requests");
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error: ${res.status} ${text}`);
    }
    const data = await res.json();
    return {
      answer: data.answer,
      status: "ok",
      guard_fired: false,
      retrieval_score: null,
      sources: [
        ...data.rag_sources.filter(Boolean).map((s, i) => ({
          id: i + 1,
          text: `Retrieved from internal document`,
          document: s,
          page: 1,
          type: "doc"
        })),
        ...data.web_sources.filter(Boolean).map((s, i) => ({
          id: data.rag_sources.length + i + 1,
          text: `Retrieved from web`,
          document: s,
          page: 1,
          type: "web"
        })),
      ],
      route: data.route,
      steps: data.steps || [],
      media_result: data.media_result || null,
      gmail_results: data.gmail_results || [],
      calendar_results: data.calendar_results || [],
      action_id: data.action_id || null,
    };
  } catch (error) {
    throw buildApiError(error, "Model is loading, please wait...");
  }
}

export async function listDocuments() {
  try {
    const res = await apiFetch(`${API_BASE}/documents`, {
      method: "GET",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error: ${res.status} ${text}`);
    }
    const data = await res.json();
    console.log("DOCUMENTS RESPONSE:", data);
    return data;
  } catch (error) {
    throw buildApiError(error, "Failed to load documents.");
  }
}

export function pollTaskStatus(taskId, { onDone, onError, intervalMs = 2000 } = {}) {
  if (!taskId) {
    onError?.(new Error("Missing task id"));
    return () => {};
  }

  let stopped = false;
  let timer = null;

  const stop = () => {
    stopped = true;
    if (timer) {
      window.clearTimeout(timer);
    }
  };

  const poll = async () => {
    if (stopped) {
      return;
    }

    try {
      const res = await apiFetch(`${API_BASE}/tasks/${taskId}`, {
        method: "GET",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error: ${res.status} ${text}`);
      }
      const data = await res.json();
      const status = data?.status;

      if (status === "done") {
        stop();
        onDone?.(data);
        return;
      }

      if (status === "failed") {
        stop();
        onError?.(new Error("Processing failed"));
        return;
      }

      timer = window.setTimeout(poll, intervalMs);
    } catch (error) {
      stop();
      onError?.(buildApiError(error, "Failed to check task status"));
    }
  };

  poll();
  return stop;
}

export async function deleteDocument(documentId) {
  if (!documentId) return null;
  try {
    const res = await apiFetch(`${API_BASE}/documents/${documentId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error: ${res.status} ${text}`);
    }
    return await res.json();
  } catch (error) {
    throw buildApiError(error, "Failed to delete document.");
  }
}

export async function resetRag() {
  try {
    const res = await apiFetch(`${API_BASE}/reset`, {
      method: "POST",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error: ${res.status} ${text}`);
    }
    const data = await res.json();
    return data;
  } catch (error) {
    throw buildApiError(error, "Failed to clear documents.");
  }
}

export async function getPendingActions() {
  try {
    const res = await apiFetch(`${API_BASE}/actions/pending`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.actions || [];
  } catch {
    return [];
  }
}

export async function confirmAction(actionId, editedPayload = null) {
  const opts = { method: "POST" };
  if (editedPayload) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify({ payload: editedPayload });
  }
  const res = await apiFetch(`${API_BASE}/actions/confirm/${actionId}`, opts);
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    // Preserve structured detail (e.g. {stage, reason} from code_diff_preview) on the
    // thrown error so callers can render stage-specific messages rather than "[object Object]".
    const message = typeof d.detail === "string" ? d.detail : `Error ${res.status}`;
    const err = new Error(message);
    err.detail = d.detail ?? null;
    throw err;
  }
  return res.json();
}

export async function cancelAction(actionId) {
  const res = await apiFetch(`${API_BASE}/actions/cancel/${actionId}`, { method: "POST" });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

// ── Chat history ──────────────────────────────────────────────────────────────

export async function createChatSession(title = null) {
  const res = await apiFetch(`${API_BASE}/history/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function listChatSessions() {
  try {
    const res = await apiFetch(`${API_BASE}/history/sessions`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export async function getChatSession(sessionId) {
  try {
    const res = await apiFetch(`${API_BASE}/history/sessions/${sessionId}`);
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function saveMessage(sessionId, role, content, metadata = {}) {
  try {
    await apiFetch(`${API_BASE}/history/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, content, metadata }),
    });
  } catch { /* non-fatal */ }
}

export async function deleteChatSession(sessionId) {
  const res = await apiFetch(`${API_BASE}/history/sessions/${sessionId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export async function ingestUrl(url) {
  try {
    const res = await apiFetch(`${API_BASE}/ingest-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error: ${res.status} ${text}`);
    }
    return await res.json();
  } catch (error) {
    throw buildApiError(error, "Failed to ingest URL.");
  }
}

export async function listUrlDocuments() {
  try {
    const res = await apiFetch(`${API_BASE}/ingest-url/list`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error: ${res.status} ${text}`);
    }
    return await res.json();
  } catch (error) {
    throw buildApiError(error, "Failed to load URL documents.");
  }
}
