import { useState } from "react";
import { cancelAction, confirmAction, resumeAgent } from "../services/api";

const TYPE_META = {
  send_email: { icon: "📧", label: "Email Pending Approval" },
  create_pr:  { icon: "🐙", label: "Pull Request Pending Approval" },
};

function Field({ label, value, onChange, multiline = false }) {
  const base =
    "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-[#f5c518]/50 focus:ring-1 focus:ring-[#f5c518]/20 transition";
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      {multiline ? (
        <textarea
          rows={4}
          className={`${base} resize-y`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type="text"
          className={base}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function EmailFields({ payload, onChange }) {
  return (
    <div className="space-y-3">
      <Field label="To"      value={payload.to}      onChange={(v) => onChange({ ...payload, to: v })} />
      <Field label="Subject" value={payload.subject} onChange={(v) => onChange({ ...payload, subject: v })} />
      <Field label="Body"    value={payload.body}    onChange={(v) => onChange({ ...payload, body: v })} multiline />
    </div>
  );
}

function PrFields({ payload, onChange }) {
  return (
    <div className="space-y-3">
      <Field label="Repo (owner/repo)" value={payload.repo}  onChange={(v) => onChange({ ...payload, repo: v })} />
      <Field label="Title"             value={payload.title} onChange={(v) => onChange({ ...payload, title: v })} />
      <Field label="Head branch"       value={payload.head}  onChange={(v) => onChange({ ...payload, head: v })} />
      <Field label="Body"              value={payload.body}  onChange={(v) => onChange({ ...payload, body: v })} multiline />
    </div>
  );
}

export default function ApprovalCard({ interruptData, threadId, onResolved }) {
  const { type, payload = {}, preview } = interruptData;
  const meta = TYPE_META[type] || { icon: "⚡", label: type };

  const [editedPayload, setEditedPayload] = useState({ ...payload });
  const [busy, setBusy] = useState(null); // "approve" | "reject" | null
  const [error, setError] = useState("");

  const handle = async (approved) => {
    setBusy(approved ? "approve" : "reject");
    setError("");
    try {
      let result;
      if (interruptData.action_id) {
        // pending_action flow (gmail_node, calendar_node): call the actions REST API directly.
        // resumeAgent would try to resume a LangGraph checkpoint that doesn't exist here.
        if (approved) {
          await confirmAction(interruptData.action_id, editedPayload);
          result = { status: "ok", answer: "Done — action confirmed." };
        } else {
          await cancelAction(interruptData.action_id);
          result = { status: "ok", answer: "Action cancelled." };
        }
      } else {
        // LangGraph interrupt flow (pr_create_node etc.): resume the paused graph.
        result = await resumeAgent(threadId, approved, approved ? editedPayload : null);
      }
      onResolved(result);
    } catch (e) {
      setError(e.message || "Something went wrong.");
      setBusy(null);
    }
  };

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">{meta.icon}</span>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-500">
            Human approval required
          </p>
          <p className="text-sm font-semibold text-slate-100">{meta.label}</p>
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <p className="mb-4 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
          {preview}
        </p>
      )}

      {/* Editable fields */}
      <div className="mb-5">
        {type === "send_email" && (
          <EmailFields payload={editedPayload} onChange={setEditedPayload} />
        )}
        {type === "create_pr" && (
          <PrFields payload={editedPayload} onChange={setEditedPayload} />
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="mb-4 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => handle(true)}
          disabled={!!busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#f5c518] px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-[#e0b214] disabled:opacity-50"
        >
          {busy === "approve" ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
          ) : (
            "✓"
          )}
          Approve
        </button>

        <button
          type="button"
          onClick={() => handle(false)}
          disabled={!!busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-500/50 bg-transparent px-4 py-2.5 text-sm font-semibold text-rose-400 transition hover:border-rose-400 hover:text-rose-300 disabled:opacity-50"
        >
          {busy === "reject" ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-rose-400/30 border-t-rose-400" />
          ) : (
            "✕"
          )}
          Reject
        </button>
      </div>
    </div>
  );
}
