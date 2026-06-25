import { useState } from "react";
import { cancelAction, confirmAction, resumeAgent } from "../services/api";

const TYPE_META = {
  send_email:            { icon: "📧", label: "Send Email — Pending Approval" },
  create_pr:             { icon: "🐙", label: "Pull Request — Pending Approval" },
  code_diff_preview:     { icon: "🔍", label: "Code Diff — Pending Approval" },
  create_calendar_event: { icon: "📅", label: "Calendar Event — Pending Approval" },
};

// ── shared field primitives ────────────────────────────────────────────────────

function Label({ children }) {
  return (
    <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
      {children}
    </p>
  );
}

function Field({ label, value, onChange, multiline = false }) {
  const base =
    "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 " +
    "placeholder-slate-500 outline-none focus:border-[#f5c518]/50 focus:ring-1 " +
    "focus:ring-[#f5c518]/20 transition";
  return (
    <div>
      <Label>{label}</Label>
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

// ── per-type field groups ──────────────────────────────────────────────────────

function EmailFields({ payload, onChange }) {
  return (
    <div className="space-y-3">
      <Field label="To"      value={payload.to      ?? ""} onChange={(v) => onChange({ ...payload, to: v })} />
      <Field label="Subject" value={payload.subject ?? ""} onChange={(v) => onChange({ ...payload, subject: v })} />
      <Field label="Body"    value={payload.body    ?? ""} onChange={(v) => onChange({ ...payload, body: v })} multiline />
    </div>
  );
}

function PrFields({ payload, onChange }) {
  return (
    <div className="space-y-3">
      <Field label="Repo (owner/repo)" value={payload.repo  ?? ""} onChange={(v) => onChange({ ...payload, repo: v })} />
      <Field label="Title"             value={payload.title ?? ""} onChange={(v) => onChange({ ...payload, title: v })} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Head branch" value={payload.head ?? ""} onChange={(v) => onChange({ ...payload, head: v })} />
        <Field label="Base branch" value={payload.base ?? ""} onChange={(v) => onChange({ ...payload, base: v })} />
      </div>
      <Field label="Body"              value={payload.body  ?? ""} onChange={(v) => onChange({ ...payload, body: v })} multiline />
    </div>
  );
}

function CalendarEventFields({ payload, onChange }) {
  return (
    <div className="space-y-3">
      <Field label="Event title" value={payload.title ?? ""} onChange={(v) => onChange({ ...payload, title: v })} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start (ISO 8601)" value={payload.start_datetime ?? ""} onChange={(v) => onChange({ ...payload, start_datetime: v })} />
        <Field label="End (ISO 8601)"   value={payload.end_datetime   ?? ""} onChange={(v) => onChange({ ...payload, end_datetime:   v })} />
      </div>
      <Field label="Description (optional)" value={payload.description ?? ""} onChange={(v) => onChange({ ...payload, description: v })} multiline />
      <Field
        label="Attendees (comma-separated emails)"
        value={Array.isArray(payload.attendees) ? payload.attendees.join(", ") : (payload.attendees ?? "")}
        onChange={(v) => onChange({ ...payload, attendees: v.split(",").map((s) => s.trim()).filter(Boolean) })}
      />
    </div>
  );
}

function DiffLine({ line }) {
  const color =
    line.startsWith("+++") || line.startsWith("---") ? "text-slate-400" :
    line.startsWith("+")                              ? "text-emerald-400" :
    line.startsWith("-")                              ? "text-rose-400" :
    line.startsWith("@@")                             ? "text-sky-400" :
    "text-slate-300";
  return <span className={`block whitespace-pre ${color}`}>{line}</span>;
}

function DiffPreviewFields({ payload, onChange }) {
  const fileCount = (payload.files ?? []).length;
  const lines = (payload.diff_text ?? "").split("\n");

  return (
    <div className="space-y-3">
      {/* Metadata row */}
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Target repo (owner/repo)"
          value={payload.repo ?? ""}
          onChange={(v) => onChange({ ...payload, repo: v })}
        />
        <Field
          label="Base branch"
          value={payload.base ?? "main"}
          onChange={(v) => onChange({ ...payload, base: v })}
        />
      </div>

      {/* Branch — prominent, gold-tinted */}
      <div>
        <Label>Branch</Label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            className="flex-1 rounded-lg border border-[#f5c518]/30 bg-[#f5c518]/5 px-3 py-2
                       text-xs text-[#f5c518] outline-none focus:border-[#f5c518]/60
                       focus:ring-1 focus:ring-[#f5c518]/20 transition font-mono"
            value={payload.branch ?? ""}
            onChange={(e) => onChange({ ...payload, branch: e.target.value })}
          />
        </div>
      </div>

      <Field
        label="Commit message"
        value={payload.commit_message ?? ""}
        onChange={(v) => onChange({ ...payload, commit_message: v })}
      />

      {/* Diff viewer */}
      <div>
        <Label>
          Unified diff&nbsp;
          <span className="normal-case text-slate-400">
            ({fileCount} file{fileCount !== 1 ? "s" : ""})
          </span>
        </Label>
        <pre
          className="max-h-80 overflow-auto rounded-lg border border-white/10
                     bg-black/60 p-3 text-[11px] leading-[1.6]"
        >
          {lines.map((line, i) => (
            <DiffLine key={i} line={line} />
          ))}
        </pre>
      </div>
    </div>
  );
}

// ── success banner shown after code_diff_preview confirm ──────────────────────

function DiffSuccessBanner({ result, onDone }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 space-y-2">
        <p className="text-xs font-semibold text-emerald-300">Pull request opened</p>
        <a
          href={result.pr_url}
          target="_blank"
          rel="noreferrer"
          className="block text-xs text-[#f5c518] hover:underline break-all"
        >
          #{result.pr_number} — {result.pr_url}
        </a>
        <p className="text-[10px] text-slate-400 font-mono">{result.branch}</p>
        {result.files_committed?.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {result.files_committed.map((f) => (
              <li key={f} className="text-[10px] text-slate-500 font-mono">+ {f}</li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={onDone}
        className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs
                   font-semibold text-slate-300 transition hover:bg-white/10"
      >
        Done
      </button>
    </div>
  );
}

// ── error block: plain string or structured {stage, reason} ───────────────────

function ErrorBlock({ error }) {
  if (!error) return null;
  const isStructured = error && typeof error === "object";
  return (
    <div className="mb-4 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 space-y-1">
      {isStructured ? (
        <>
          <p>
            <span className="font-semibold">Failed at stage: </span>
            <span className="font-mono">{error.stage}</span>
          </p>
          <p className="text-rose-400/80">{error.reason}</p>
        </>
      ) : (
        <p>{error}</p>
      )}
    </div>
  );
}

// ── main card ─────────────────────────────────────────────────────────────────

export default function ApprovalCard({ interruptData, threadId, onResolved }) {
  const { type, payload = {}, preview } = interruptData;
  const meta = TYPE_META[type] ?? { icon: "⚡", label: type };

  const [editedPayload, setEditedPayload] = useState({ ...payload });
  const [busy, setBusy]         = useState(null);      // "approve" | "reject" | null
  const [error, setError]       = useState(null);      // string | {stage,reason} | null
  const [diffResult, setDiffResult] = useState(null);  // code_diff_preview success payload

  const handle = async (approved) => {
    setBusy(approved ? "approve" : "reject");
    setError(null);

    try {
      if (interruptData.action_id) {
        // pending_action path: call the actions REST API directly
        if (approved) {
          const data = await confirmAction(interruptData.action_id, editedPayload);

          if (type === "code_diff_preview") {
            // Stay in the card and show the PR link rather than collapsing
            setDiffResult(data.result);
            setBusy(null);
            return;
          }

          onResolved({ status: "ok", answer: "Done — action confirmed." });
        } else {
          await cancelAction(interruptData.action_id);
          onResolved({ status: "ok", answer: "Action cancelled." });
        }
      } else {
        // LangGraph interrupt path
        const result = await resumeAgent(threadId, approved, approved ? editedPayload : null);
        onResolved(result);
      }
    } catch (e) {
      // For code_diff_preview the backend returns {stage, reason} as the detail object.
      // confirmAction attaches it as err.detail so we can render it structured.
      if (type === "code_diff_preview" && e.detail && typeof e.detail === "object") {
        setError(e.detail);
      } else {
        setError(e.message || "Something went wrong.");
      }
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

      {/* Preview summary line */}
      {preview && !diffResult && (
        <p className="mb-4 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
          {preview}
        </p>
      )}

      {/* Body: success banner OR editable fields */}
      {diffResult ? (
        <DiffSuccessBanner
          result={diffResult}
          onDone={() =>
            onResolved({
              status: "ok",
              answer: `PR #${diffResult.pr_number} opened: ${diffResult.pr_url}`,
            })
          }
        />
      ) : (
        <>
          <div className="mb-5">
            {type === "send_email"            && <EmailFields         payload={editedPayload} onChange={setEditedPayload} />}
            {type === "create_pr"             && <PrFields            payload={editedPayload} onChange={setEditedPayload} />}
            {type === "code_diff_preview"     && <DiffPreviewFields   payload={editedPayload} onChange={setEditedPayload} />}
            {type === "create_calendar_event" && <CalendarEventFields payload={editedPayload} onChange={setEditedPayload} />}
          </div>

          <ErrorBlock error={error} />

          {/* Confirm / Reject */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handle(true)}
              disabled={!!busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#f5c518]
                         px-4 py-2.5 text-sm font-semibold text-black transition
                         hover:bg-[#e0b214] disabled:opacity-50"
            >
              {busy === "approve" ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
              ) : "✓"}
              Confirm
            </button>

            <button
              type="button"
              onClick={() => handle(false)}
              disabled={!!busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl
                         border border-rose-500/50 bg-transparent px-4 py-2.5 text-sm
                         font-semibold text-rose-400 transition hover:border-rose-400
                         hover:text-rose-300 disabled:opacity-50"
            >
              {busy === "reject" ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-rose-400/30 border-t-rose-400" />
              ) : "✕"}
              Reject
            </button>
          </div>
        </>
      )}
    </div>
  );
}
