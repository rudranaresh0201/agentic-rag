import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { HiCheckCircle, HiXCircle } from "react-icons/hi2";
import { API_BASE } from "../services/api";

const HEADERS = { "X-API-Key": "12345" };

// Action types that are handled inline by ApprovalCard (in-chat).
// They must never appear in this floating modal — the same action_id would
// cause a double-handling race and the modal's confirm path doesn't know
// how to render or surface their structured errors.
const INLINE_ONLY_TYPES = new Set(["code_diff_preview"]);

async function fetchActions() {
  try {
    const res = await fetch(`${API_BASE}/actions/pending`, { headers: HEADERS });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.actions || []).filter((a) => !INLINE_ONLY_TYPES.has(a.type));
  } catch {
    return [];
  }
}

function ActionDetail({ action }) {
  const { type, payload = {}, preview } = action;

  if (type === "send_email") {
    return (
      <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-slate-950/60 p-3 text-sm">
        <Row label="To"      value={payload.to}      />
        <Row label="Subject" value={payload.subject} />
        {payload.body && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Body</p>
            <p className="mt-0.5 max-h-28 overflow-y-auto whitespace-pre-wrap text-[11px] text-slate-300">
              {payload.body}
            </p>
          </div>
        )}
      </div>
    );
  }

  if (type === "create_calendar_event") {
    return (
      <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-slate-950/60 p-3 text-sm">
        <Row label="Title"  value={payload.title}          />
        <Row label="Start"  value={fmtDt(payload.start_datetime)} />
        <Row label="End"    value={fmtDt(payload.end_datetime)}   />
        {payload.description && <Row label="Desc" value={payload.description} />}
        {payload.attendees?.length > 0 && (
          <Row label="Attendees" value={payload.attendees.join(", ")} />
        )}
      </div>
    );
  }

  return preview ? (
    <p className="mt-2 text-sm text-slate-300">{preview}</p>
  ) : null;
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 text-xs text-slate-200">{value}</p>
    </div>
  );
}

function fmtDt(dt) {
  if (!dt) return "";
  try {
    const d = new Date(dt);
    return isNaN(d.getTime()) ? dt : d.toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
    });
  } catch { return dt; }
}

const TYPE_META = {
  send_email:            { icon: "📧", label: "Send Email" },
  create_calendar_event: { icon: "📅", label: "Create Calendar Event" },
};

export default function ActionConfirmModal({ trigger }) {
  const [actions, setActions]   = useState([]);
  const [busy, setBusy]         = useState(null); // "confirming" | "cancelling" | null
  const [error, setError]       = useState("");

  const refresh = useCallback(async () => {
    const next = await fetchActions();
    setActions(next);
  }, []);

  // Poll every 3 s
  useEffect(() => {
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [refresh]);

  // Immediate fetch whenever a new agent response arrives
  useEffect(() => {
    if (trigger > 0) refresh();
  }, [trigger, refresh]);

  const action = actions[0];

  const handleConfirm = async () => {
    if (!action) return;
    setBusy("confirming");
    setError("");
    try {
      const res = await fetch(`${API_BASE}/actions/confirm/${action.action_id}`, {
        method: "POST",
        headers: HEADERS,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        // detail may be a string or a structured object {stage, reason}.
        // Coerce to a readable string so we never render "[object Object]".
        const detail = d.detail;
        const message =
          typeof detail === "string" ? detail :
          detail && typeof detail === "object" && detail.reason
            ? `${detail.stage ? `[${detail.stage}] ` : ""}${detail.reason}`
            : `Error ${res.status}`;
        throw new Error(message);
      }
      setActions((prev) => prev.filter((a) => a.action_id !== action.action_id));
    } catch (e) {
      setError(e.message || "Action failed. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = async () => {
    if (!action) return;
    setBusy("cancelling");
    setError("");
    try {
      const res = await fetch(`${API_BASE}/actions/cancel/${action.action_id}`, {
        method: "POST",
        headers: HEADERS,
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setActions((prev) => prev.filter((a) => a.action_id !== action.action_id));
    } catch (e) {
      setError(e.message || "Cancel failed.");
    } finally {
      setBusy(null);
    }
  };

  const meta = action ? (TYPE_META[action.type] || { icon: "⚡", label: action.type }) : null;

  return (
    <AnimatePresence>
      {action && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <motion.div
            key="modal-card"
            initial={{ scale: 0.94, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, y: 16, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center gap-2">
              <span className="text-xl">{meta.icon}</span>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500">
                  Pending action · confirm to proceed
                </p>
                <p className="text-base font-semibold text-slate-100">{meta.label}</p>
              </div>
              {actions.length > 1 && (
                <span className="ml-auto rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                  1 of {actions.length}
                </span>
              )}
            </div>

            {/* Preview text */}
            {action.preview && (
              <p className="mt-3 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
                {action.preview}
              </p>
            )}

            {/* Detailed payload */}
            <ActionDetail action={action} />

            {/* Error */}
            {error && (
              <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {error}
              </p>
            )}

            {/* Buttons */}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!!busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {busy === "confirming" ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <HiCheckCircle className="text-base" />
                )}
                Confirm
              </button>

              <button
                type="button"
                onClick={handleCancel}
                disabled={!!busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-700 disabled:opacity-50"
              >
                {busy === "cancelling" ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-slate-400" />
                ) : (
                  <HiXCircle className="text-base" />
                )}
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
